import { nicheService } from './nicheService.js';
import { sessionService, ChatSession, ChatMessage } from './sessionService.js';
import { aiService } from './aiService.js';

export interface IncomingMessagePayload {
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

    const activeNiche = nicheService.getActiveNiche();
    const session = sessionService.getOrCreateSession(cleanPhone, customerName, activeNiche.id);

    // Registra a mensagem do cliente
    sessionService.addMessage(cleanPhone, 'customer', text);

    // Se estiver em modo humano, a IA não responde
    if (session.status === 'human') {
      return {
        session,
        ignoredDueToHuman: true
      };
    }

    // Se o cliente pediu atendente humano explicitamente
    if (/(falar com atendente|humano|pessoa real|falar com alguem|falar com alguém)/i.test(text)) {
      sessionService.setStatus(cleanPhone, 'human');
      const transferNotice = `Transferindo você para a nossa equipe humana de atendimento da *${activeNiche.name}*. Em breve um de nossos consultores responderá aqui. 👨‍💻`;
      const reply = sessionService.addMessage(cleanPhone, 'bot', transferNotice);

      await this.dispatchExternalMessage(cleanPhone, transferNotice);
      return {
        session,
        replyMessage: reply
      };
    }

    // Gera a resposta da IA contextualizada para o nicho atual
    const botReplyText = await aiService.generateReply(text, session.messages, activeNiche);
    const reply = sessionService.addMessage(cleanPhone, 'bot', botReplyText);

    // Se houver integração real configurada, despacha
    await this.dispatchExternalMessage(cleanPhone, botReplyText);

    return {
      session,
      replyMessage: reply
    };
  }

  public async sendManualAgentMessage(phone: string, text: string): Promise<ChatMessage> {
    const cleanPhone = phone.replace(/\D/g, '');
    const message = sessionService.addMessage(cleanPhone, 'agent', text);
    await this.dispatchExternalMessage(cleanPhone, text);
    return message;
  }

  private async dispatchExternalMessage(phone: string, text: string): Promise<void> {
    // 1. Prioridade: Conexão direta nativa Baileys (QR Code)
    try {
      const { baileysService } = await import('./baileysService.js');
      if (baileysService.getStatus().status === 'connected') {
        await baileysService.sendMessage(phone, text);
        return;
      }
    } catch (err) {
      // Ignora e tenta outros provedores se houver
    }

    const provider = process.env.WHATSAPP_PROVIDER || 'simulator';

    if (provider === 'evolution' && process.env.EVOLUTION_API_URL && process.env.EVOLUTION_API_KEY) {
      try {
        const instance = process.env.EVOLUTION_INSTANCE || 'atendimento';
        const url = `${process.env.EVOLUTION_API_URL}/message/sendText/${instance}`;
        await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: process.env.EVOLUTION_API_KEY
          },
          body: JSON.stringify({
            number: phone,
            text
          })
        });
      } catch (err) {
        console.error('Erro ao despachar mensagem para Evolution API:', err);
      }
    }
  }
}

export const whatsappService = new WhatsAppService();
