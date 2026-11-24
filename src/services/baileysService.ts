import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  Browsers,
  WASocket,
  downloadMediaMessage
} from '@whiskeysockets/baileys';
import QRCode from 'qrcode';
import pino from 'pino';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { whatsappService } from './whatsappService.js';
import { storeService } from './storeService.js';
import { audioService } from './audioService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export type WhatsAppConnectionStatus = 'disconnected' | 'connecting' | 'connected';

export interface WhatsAppUserInfo {
  id: string;
  phone: string;
  name?: string;
}

export interface StoreWhatsAppInstance {
  storeId: string;
  sock: WASocket | null;
  status: WhatsAppConnectionStatus;
  qrCodeBase64: string | null;
  user: WhatsAppUserInfo | null;
  reconnectAttempts: number;
  phoneToJid: Map<string, string>;
}

function extractMessageText(msg: any): string {
  if (!msg || !msg.message) return '';
  return (
    msg.message.conversation ||
    msg.message.extendedTextMessage?.text ||
    msg.message.ephemeralMessage?.message?.extendedTextMessage?.text ||
    msg.message.ephemeralMessage?.message?.conversation ||
    msg.message.viewOnceMessage?.message?.extendedTextMessage?.text ||
    msg.message.imageMessage?.caption ||
    msg.message.videoMessage?.caption ||
    ''
  );
}

export class BaileysService {
  private baseAuthDir: string;
  private instances: Map<string, StoreWhatsAppInstance> = new Map();

  constructor() {
    this.baseAuthDir = path.resolve(__dirname, '../../data/auth_session');
  }

  private getOrCreateInstance(storeId: string): StoreWhatsAppInstance {
    let instance = this.instances.get(storeId);
    if (!instance) {
      instance = {
        storeId,
        sock: null,
        status: 'disconnected',
        qrCodeBase64: null,
        user: null,
        reconnectAttempts: 0,
        phoneToJid: new Map()
      };
      this.instances.set(storeId, instance);
    }
    return instance;
  }

  public getStatus(storeId?: string) {
    const targetStoreId = storeId || storeService.getActiveStore().id;
    const instance = this.getOrCreateInstance(targetStoreId);

    return {
      storeId: targetStoreId,
      status: instance.status,
      qr: instance.qrCodeBase64,
      user: instance.user,
      reconnectAttempts: instance.reconnectAttempts
    };
  }

  public getAllStatuses() {
    const stores = storeService.listStores();
    return stores.map(store => {
      const instance = this.getOrCreateInstance(store.id);
      return {
        storeId: store.id,
        storeName: store.name,
        nicheId: store.nicheId,
        status: instance.status,
        hasQr: !!instance.qrCodeBase64,
        user: instance.user
      };
    });
  }

  public async connect(storeId?: string): Promise<void> {
    const targetStoreId = storeId || storeService.getActiveStore().id;
    const instance = this.getOrCreateInstance(targetStoreId);

    if (instance.status === 'connected') {
      return;
    }

    const storeAuthDir = path.join(this.baseAuthDir, targetStoreId);
    if (!fs.existsSync(storeAuthDir)) {
      fs.mkdirSync(storeAuthDir, { recursive: true });
    }

    instance.status = 'connecting';
    const { state, saveCreds } = await useMultiFileAuthState(storeAuthDir);
    const logger = pino({ level: 'silent' });

    const sock = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      logger,
      browser: Browsers.macOS('Desktop'),
      syncFullHistory: false
    });

    instance.sock = sock;

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        try {
          instance.qrCodeBase64 = await QRCode.toDataURL(qr, {
            margin: 2,
            scale: 8,
            color: { dark: '#0f172a', light: '#ffffff' }
          });
          instance.status = 'connecting';
          console.log(`📲 [Loja ${targetStoreId}] Novo QR Code gerado para conexão.`);
        } catch (err) {
          console.error(`Erro ao converter QR da loja ${targetStoreId}:`, err);
        }
      }

      if (connection === 'close') {
        const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
        instance.status = 'disconnected';
        instance.qrCodeBase64 = null;
        instance.user = null;

        console.log(`⚠️ [Loja ${targetStoreId}] Conexão fechada. Código: ${statusCode}. Reconectar: ${shouldReconnect}`);

        if (shouldReconnect) {
          instance.reconnectAttempts++;
          setTimeout(() => this.connect(targetStoreId), 4000);
        } else {
          try {
            if (fs.existsSync(storeAuthDir)) {
              fs.rmSync(storeAuthDir, { recursive: true, force: true });
            }
          } catch (e) {
            console.error('Erro ao limpar pasta de auth da loja:', e);
          }
        }
      } else if (connection === 'open') {
        instance.status = 'connected';
        instance.qrCodeBase64 = null;
        instance.reconnectAttempts = 0;

        const rawId = sock?.user?.id || '';
        const cleanPhone = rawId.split(':')[0] || rawId.replace(/\D/g, '');

        instance.user = {
          id: rawId,
          phone: cleanPhone,
          name: sock?.user?.name || `Loja ${targetStoreId}`
        };

        console.log(`✅ [Loja ${targetStoreId}] WhatsApp Conectado com sucesso! Número: ${instance.user.phone}`);
      }
    });

    // Escuta de mensagens recebidas nesta instância
    sock.ev.on('messages.upsert', async (m) => {
      if (m.type !== 'notify') return;

      for (const msg of m.messages) {
        if (msg.key.fromMe || !msg.message || msg.key.remoteJid === 'status@broadcast') {
          continue;
        }

        const remoteJid = msg.key.remoteJid;
        if (!remoteJid || remoteJid.includes('@g.us')) {
          continue;
        }

        let text = extractMessageText(msg);

        // Se for mensagem de áudio, baixa e transcreve
        if (!text && msg.message?.audioMessage) {
          try {
            console.log(`🎙️ [Loja ${targetStoreId}] Áudio recebido de ${msg.pushName || 'Cliente'}. Baixando e transcrevendo...`);
            const buffer = (await downloadMediaMessage(msg, 'buffer', {})) as Buffer;
            const transcription = await audioService.transcribeAudio(
              buffer,
              msg.message.audioMessage.mimetype || 'audio/ogg'
            );
            text = `🎙️ [Áudio]: "${transcription}"`;
          } catch (audioErr) {
            console.error('Erro ao baixar/transcrever áudio:', audioErr);
            text = '🎙️ [Áudio recebido]';
          }
        }

        if (!text) continue;

        // O remoteJid pode ser @s.whatsapp.net ou @lid (Linked ID)
        const cleanPhone = remoteJid.replace(/@.*$/, '').replace(/\D/g, '') || remoteJid;
        const customerName = msg.pushName || 'Cliente';

        // Guarda o JID exato para responder sempre no canal correto
        instance.phoneToJid.set(cleanPhone, remoteJid);

        console.log(`📩 [Loja ${targetStoreId}] Mensagem de ${customerName} (${remoteJid}): "${text}"`);

        // Processa a mensagem pelo serviço de atendimento
        const result = await whatsappService.handleIncomingMessage({
          storeId: targetStoreId,
          phone: cleanPhone,
          jid: remoteJid,
          customerName,
          text,
          source: 'baileys'
        });

        // Envia resposta automática pelo socket do Baileys
        if (result.replyMessage && instance.sock) {
          try {
            console.log(`🤖 [Loja ${targetStoreId}] Enviando resposta para ${remoteJid}...`);
            await instance.sock.sendPresenceUpdate('composing', remoteJid);
            await new Promise(resolve => setTimeout(resolve, 600)); // Pequena pausa humanizada
            await instance.sock.sendMessage(remoteJid, {
              text: result.replyMessage.text
            });
            console.log(`✅ [Loja ${targetStoreId}] Resposta da IA enviada com sucesso para ${remoteJid}!`);
          } catch (sendErr) {
            console.error(`❌ [Loja ${targetStoreId}] Erro ao enviar mensagem no WhatsApp para ${remoteJid}:`, sendErr);
          }
        }
      }
    });
  }

  public async sendMessage(storeId: string, phone: string, text: string, explicitJid?: string): Promise<boolean> {
    const instance = this.instances.get(storeId);
    if (!instance || !instance.sock || instance.status !== 'connected') {
      console.warn(`[Loja ${storeId}] Não foi possível enviar: WhatsApp desconectado.`);
      return false;
    }

    const cleanPhone = phone.replace(/\D/g, '');
    const targetJid =
      explicitJid ||
      instance.phoneToJid.get(cleanPhone) ||
      (phone.includes('@') ? phone : `${cleanPhone}@s.whatsapp.net`);

    try {
      console.log(`👤 [Loja ${storeId}] Enviando mensagem do atendente para ${targetJid}...`);
      await instance.sock.sendPresenceUpdate('composing', targetJid);
      await instance.sock.sendMessage(targetJid, { text });
      console.log(`✅ [Loja ${storeId}] Mensagem entregue no WhatsApp para ${targetJid}!`);
      return true;
    } catch (err) {
      console.error(`❌ [Loja ${storeId}] Erro ao enviar mensagem manual para ${targetJid}:`, err);
      return false;
    }
  }

  public async disconnect(storeId?: string): Promise<void> {
    const targetStoreId = storeId || storeService.getActiveStore().id;
    const instance = this.instances.get(targetStoreId);
    if (!instance) return;

    try {
      if (instance.sock) {
        await instance.sock.logout();
      }
      instance.status = 'disconnected';
      instance.qrCodeBase64 = null;
      instance.user = null;

      const storeAuthDir = path.join(this.baseAuthDir, targetStoreId);
      if (fs.existsSync(storeAuthDir)) {
        fs.rmSync(storeAuthDir, { recursive: true, force: true });
      }
    } catch (err) {
      console.error(`Erro ao desconectar loja ${targetStoreId}:`, err);
    }
  }
}

export const baileysService = new BaileysService();
