import { nicheService } from './nicheService.js';
import { sessionService, ChatSession, ChatMessage } from './sessionService.js';
import { aiService } from './aiService.js';
import { storeService } from './storeService.js';

export interface IncomingMessagePayload {
  storeId?: string;
  phone: string;
  customerName?: string;
  text: string;
  source?: 'simulator' | 'evolution' | 'meta' | 'zapi' | 'baileys';
}

export class WhatsAppService {
  public async handleIncomingMessage(payload: IncomingMessagePayload): Promise<{
    session: ChatSession;
    replyMessage?: ChatMessage;
    ignoredDueToHuman?: boolean;
  }> {
    const { phone, customerName = 'Cliente WhatsApp', text } = payload;
    const cleanPhone = phone.replace(/\D/g, '');

    // Identifica qual loja/comércio está recebendo a mensagem
    const targetStoreId = payload.storeId || storeService.getActiveStore().id;
    const store = storeService.getStore(targetStoreId) || storeService.getActiveStore();

    // Obtém o nicho específico configurado para esta loja
    let niche;
    try {
      niche = nicheService.getNiche(store.nicheId);
    } catch {
      niche = nicheService.getActiveNiche();
    }

    const session = sessionService.getOrCreateSession(targetStoreId, cleanPhone, customerName, niche.id);

    // Registra a mensagem do cliente na sessão da loja
    sessionService.addMessage(targetStoreId, cleanPhone, 'customer', text);

    // Se estiver em modo humano, a IA não responde
    if (session.status === 'human') {
      return {
        session,
        ignoredDueToHuman: true
      };
    }

    // Se o cliente pediu atendente humano explicitamente
    if (/(falar com atendente|humano|pessoa real|falar com alguem|falar com alguém)/i.test(text)) {
      sessionService.setStatus(targetStoreId, cleanPhone, 'human');
      const transferNotice = `Transferindo você para a nossa equipe de atendimento humano da *${store.name}*. Em breve um de nossos consultores responderá aqui. 👨‍💻`;
      const reply = sessionService.addMessage(targetStoreId, cleanPhone, 'bot', transferNotice);

      await this.dispatchExternalMessage(targetStoreId, cleanPhone, transferNotice);
      return {
        session,
        replyMessage: reply
      };
    }

    // Gera a resposta da IA contextualizada para o nicho desta loja
    const botReplyText = await aiService.generateReply(text, session.messages, niche);
    const reply = sessionService.addMessage(targetStoreId, cleanPhone, 'bot', botReplyText);

    // Despacha mensagem de volta
    await this.dispatchExternalMessage(targetStoreId, cleanPhone, botReplyText);

    return {
      session,
      replyMessage: reply
    };
  }

  public async sendManualAgentMessage(storeId: string, phone: string, text: string): Promise<ChatMessage> {
    const cleanPhone = phone.replace(/\D/g, '');
    const message = sessionService.addMessage(storeId, cleanPhone, 'agent', text);
    await this.dispatchExternalMessage(storeId, cleanPhone, text);
    return message;
  }

  private async dispatchExternalMessage(storeId: string, phone: string, text: string): Promise<void> {
    // 1. Prioridade: Instância Baileys da própria loja
    try {
      const { baileysService } = await import('./baileysService.js');
      const isSent = await baileysService.sendMessage(storeId, phone, text);
      if (isSent) return;
    } catch (err) {
      // Ignora e tenta outros provedores
    }

    // 2. Provedores genéricos de webhook
    const provider = process.env.WHATSAPP_PROVIDER || 'simulator';
    if (provider === 'evolution' && process.env.EVOLUTION_API_URL && process.env.EVOLUTION_API_KEY) {
      try {
        const instance = process.env.EVOLUTION_INSTANCE || storeId || 'atendimento';
        const url = `${process.env.EVOLUTION_API_URL}/message/sendText/${instance}`;
        await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: process.env.EVOLUTION_API_KEY
          },
          body: JSON.stringify({ number: phone, text })
        });
      } catch (err) {
        console.error('Erro ao despachar mensagem para Evolution API:', err);
      }
    }
  }
}

export const whatsappService = new WhatsAppService();
