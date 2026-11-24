import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  Browsers,
  WASocket
} from '@whiskeysockets/baileys';
import QRCode from 'qrcode';
import pino from 'pino';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { whatsappService } from './whatsappService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export type WhatsAppConnectionStatus = 'disconnected' | 'connecting' | 'connected';

export interface WhatsAppUserInfo {
  id: string;
  phone: string;
  name?: string;
}

export class BaileysService {
  private sock: WASocket | null = null;
  private authDir: string;
  private status: WhatsAppConnectionStatus = 'disconnected';
  private qrCodeBase64: string | null = null;
  private user: WhatsAppUserInfo | null = null;
  private reconnectAttempts = 0;

  constructor() {
    this.authDir = path.resolve(__dirname, '../../data/auth_session');
  }

  public getStatus() {
    return {
      status: this.status,
      qr: this.qrCodeBase64,
      user: this.user,
      reconnectAttempts: this.reconnectAttempts
    };
  }

  public async connect(): Promise<void> {
    if (this.status === 'connected') {
      return;
    }

    if (!fs.existsSync(this.authDir)) {
      fs.mkdirSync(this.authDir, { recursive: true });
    }

    this.status = 'connecting';
    const { state, saveCreds } = await useMultiFileAuthState(this.authDir);

    const logger = pino({ level: 'silent' });

    this.sock = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      logger,
      browser: Browsers.macOS('Desktop'),
      syncFullHistory: false
    });

    this.sock.ev.on('creds.update', saveCreds);

    this.sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        try {
          this.qrCodeBase64 = await QRCode.toDataURL(qr, {
            margin: 2,
            scale: 8,
            color: {
              dark: '#0f172a',
              light: '#ffffff'
            }
          });
          this.status = 'connecting';
          console.log('📲 Novo QR Code do WhatsApp gerado para leitura no painel.');
        } catch (err) {
          console.error('Erro ao converter QR Code para base64:', err);
        }
      }

      if (connection === 'close') {
        const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
        this.status = 'disconnected';
        this.qrCodeBase64 = null;
        this.user = null;

        console.log(`⚠️ Conexão WhatsApp fechada. Código: ${statusCode}. Reconectar: ${shouldReconnect}`);

        if (shouldReconnect) {
          this.reconnectAttempts++;
          setTimeout(() => this.connect(), 4000);
        } else {
          // Deslogado explicitamente, limpa sessão
          try {
            if (fs.existsSync(this.authDir)) {
              fs.rmSync(this.authDir, { recursive: true, force: true });
            }
          } catch (e) {
            console.error('Erro ao limpar pasta de auth:', e);
          }
        }
      } else if (connection === 'open') {
        this.status = 'connected';
        this.qrCodeBase64 = null;
        this.reconnectAttempts = 0;

        const rawId = this.sock?.user?.id || '';
        const cleanPhone = rawId.split(':')[0] || rawId.replace(/\D/g, '');

        this.user = {
          id: rawId,
          phone: cleanPhone,
          name: this.sock?.user?.name || 'WhatsApp Conectado'
        };

        console.log(`✅ WhatsApp conectado com sucesso! Número: ${this.user.phone}`);
      }
    });

    // Escuta de mensagens recebidas
    this.sock.ev.on('messages.upsert', async (m) => {
      if (m.type !== 'notify') return;

      for (const msg of m.messages) {
        // Ignora mensagens do próprio bot ou mensagens de status
        if (msg.key.fromMe || !msg.message || msg.key.remoteJid === 'status@broadcast') {
          continue;
        }

        const remoteJid = msg.key.remoteJid;
        if (!remoteJid || remoteJid.includes('@g.us')) {
          // Por padrão ignora grupos para focar em atendimento 1 a 1
          continue;
        }

        const phone = remoteJid.replace('@s.whatsapp.net', '');
        const customerName = msg.pushName || 'Cliente';
        const text =
          msg.message.conversation ||
          msg.message.extendedTextMessage?.text ||
          msg.message.imageMessage?.caption ||
          '';

        if (!text) continue;

        console.log(`📩 Mensagem recebida de ${customerName} (${phone}): "${text}"`);

        // Processa pelo serviço de atendimento
        const result = await whatsappService.handleIncomingMessage({
          phone,
          customerName,
          text,
          source: 'baileys'
        });

        // Se houver resposta gerada pela IA, envia de volta pelo Baileys
        if (result.replyMessage && this.sock) {
          await this.sock.sendMessage(remoteJid, {
            text: result.replyMessage.text
          });
          console.log(`🤖 Resposta enviada para ${phone}: "${result.replyMessage.text.slice(0, 50)}..."`);
        }
      }
    });
  }

  public async sendMessage(phone: string, text: string): Promise<boolean> {
    if (!this.sock || this.status !== 'connected') {
      return false;
    }
    const jid = `${phone.replace(/\D/g, '')}@s.whatsapp.net`;
    await this.sock.sendMessage(jid, { text });
    return true;
  }

  public async disconnect(): Promise<void> {
    try {
      if (this.sock) {
        await this.sock.logout();
      }
      this.status = 'disconnected';
      this.qrCodeBase64 = null;
      this.user = null;
      if (fs.existsSync(this.authDir)) {
        fs.rmSync(this.authDir, { recursive: true, force: true });
      }
    } catch (err) {
      console.error('Erro ao desconectar WhatsApp:', err);
    }
  }
}

export const baileysService = new BaileysService();
