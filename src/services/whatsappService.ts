import { nicheService } from './nicheService.js';
import { sessionService, ChatSession, ChatMessage } from './sessionService.js';
import { availabilityService } from './availabilityService.js';
import { appointmentService } from './appointmentService.js';
import { aiService } from './aiService.js';
import { storeService } from './storeService.js';
import { audioService } from './audioService.js';

export interface IncomingMessagePayload {
  storeId?: string;
  phone: string;
  jid?: string;
  customerName?: string;
  text: string;
  isAudio?: boolean;
  source?: 'simulator' | 'evolution' | 'meta' | 'zapi' | 'baileys';
}

export interface HandleIncomingMessageResult {
  session: ChatSession;
  replyMessage?: ChatMessage;
  replyAudioBuffer?: Buffer;
  replyAudioFilename?: string;
  ignoredDueToHuman?: boolean;
}

export class WhatsAppService {
  public async handleIncomingMessage(payload: IncomingMessagePayload): Promise<HandleIncomingMessageResult> {
    const { phone, customerName = 'Cliente WhatsApp', text, jid } = payload;
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

    const session = sessionService.getOrCreateSession(targetStoreId, cleanPhone, customerName, niche.id, jid);

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

      if (payload.source !== 'baileys') {
        await this.dispatchExternalMessage(targetStoreId, cleanPhone, transferNotice, jid);
      }
      return {
        session,
        replyMessage: reply
      };
    }

    // Resposta rápida a Lembrete de Consulta (1 = Confirmar, 2 = Reagendar)
    const cleanInput = text.trim().toLowerCase();
    const isConfirmOption = /^(1|confirmar|confirmo|sim|vou sim|vou|confirmado|presenca confirmada|presença confirmada)[.!]*$/i.test(cleanInput);
    const isRescheduleOption = /^(2|reagendar|reagenda|outro horario|outro horário|mudar data|mudar horario|mudar horário|desmarcar)[.!]*$/i.test(cleanInput);

    let pendingAptId = session.metadata?.pendingReminderAppointmentId;
    let targetApt = pendingAptId ? appointmentService.getAppointment(pendingAptId) : appointmentService.findUpcomingByPhone(targetStoreId, cleanPhone);

    if (targetApt && (isConfirmOption || isRescheduleOption) && !session.metadata?.appointmentFlow) {
      if (isConfirmOption) {
        appointmentService.updateAppointmentStatus(targetApt.id, 'confirmed');
        if (session.metadata) delete session.metadata.pendingReminderAppointmentId;

        const [ano, mes, dia] = targetApt.date.split('-');
        const dateFormatted = `${dia}/${mes}/${ano}`;
        const confirmText = `✅ *Presença Confirmada!*\n\nPerfeito, *${targetApt.customerName}*! Seu atendimento foi confirmado na *${store.name}*:\n🗓️ *Data:* ${dateFormatted} às *${targetApt.time}*\n🩺 *Serviço:* ${targetApt.serviceName}\n\nTe aguardamos! Se precisar de algo ou tiver qualquer dúvida antes, estamos por aqui. Tenha um ótimo dia! 😊`;

        const reply = sessionService.addMessage(targetStoreId, cleanPhone, 'bot', confirmText);
        if (payload.source !== 'baileys') {
          await this.dispatchExternalMessage(targetStoreId, cleanPhone, confirmText, jid);
        }
        return { session, replyMessage: reply };
      } else if (isRescheduleOption) {
        appointmentService.updateAppointment(targetApt.id, {
          status: 'pending',
          notes: `${targetApt.notes || ''} [Solicitou reagendamento em ${new Date().toLocaleDateString('pt-BR')}]`.trim()
        });
        session.metadata = session.metadata || {};
        session.metadata.appointmentFlow = { stage: 'date' };
        if (session.metadata) delete session.metadata.pendingReminderAppointmentId;

        const rescheduleText = `🔄 *Reagendamento de Atendimento*\n\nEntendido, *${targetApt.customerName}*! Vamos encontrar um novo dia e horário para você na *${store.name}*.\n\n🗓️ Para qual data você gostaria de reagendar?\n(Informe a data desejada, por exemplo *DD/MM/AAAA* ou responda *amanhã*).`;

        const reply = sessionService.addMessage(targetStoreId, cleanPhone, 'bot', rescheduleText);
        if (payload.source !== 'baileys') {
          await this.dispatchExternalMessage(targetStoreId, cleanPhone, rescheduleText, jid);
        }
        return { session, replyMessage: reply };
      }
    }

    // Gera a resposta da IA contextualizada para o nicho desta loja
    const agendaReply = availabilityService.reply(targetStoreId, text, session, ['dentista', 'imobiliaria'].includes(niche.id) || availabilityService.isConfigured(targetStoreId));
    const botReplyText = agendaReply ?? await aiService.generateReply(text, session.messages, niche);

    // Gera áudio com voz de secretária feminina humana se o cliente mandou áudio ou modo voz ativo
    let replyAudioBuffer: Buffer | undefined;
    let replyAudioFilename: string | undefined;

    const voiceMode = process.env.VOICE_REPLIES || 'audio_only'; // 'audio_only' | 'always' | 'off'
    const shouldVoiceReply = voiceMode === 'always' || (voiceMode === 'audio_only' && payload.isAudio);

    if (shouldVoiceReply) {
      try {
        const speech = await audioService.generateSpeech(botReplyText);
        if (speech) {
          replyAudioBuffer = speech.audioBuffer;
          replyAudioFilename = speech.filename;
        }
      } catch (voiceErr) {
        console.error('Erro ao sintetizar resposta de voz da secretária:', voiceErr);
      }
    }

    const reply = sessionService.addMessage(
      targetStoreId,
      cleanPhone,
      'bot',
      botReplyText,
      replyAudioFilename ? { audioUrl: `/api/audios/${replyAudioFilename}`, isAudio: true } : undefined
    );

    // Se a mensagem veio por outro canal (webhook externo), despacha
    if (payload.source !== 'baileys') {
      await this.dispatchExternalMessage(targetStoreId, cleanPhone, botReplyText, jid);
    }

    return {
      session,
      replyMessage: reply,
      replyAudioBuffer,
      replyAudioFilename
    };
  }

  public async sendManualAgentMessage(storeId: string, phone: string, text: string): Promise<ChatMessage> {
    const cleanPhone = phone.replace(/\D/g, '');
    const session = sessionService.getSession(storeId, cleanPhone);
    const message = sessionService.addMessage(storeId, cleanPhone, 'agent', text);
    await this.dispatchExternalMessage(storeId, cleanPhone, text, session?.jid);
    return message;
  }

  private async dispatchExternalMessage(storeId: string, phone: string, text: string, jid?: string): Promise<void> {
    // 1. Prioridade: Instância Baileys da própria loja
    try {
      const { baileysService } = await import('./baileysService.js');
      const isSent = await baileysService.sendMessage(storeId, phone, text, jid);
      if (isSent) return;
    } catch (err) {
      console.error('Erro ao despachar via Baileys:', err);
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
