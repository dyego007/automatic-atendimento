import { appointmentService, Appointment } from './appointmentService.js';
import { storeService } from './storeService.js';
import { baileysService } from './baileysService.js';
import { sessionService } from './sessionService.js';

export interface ReminderResult {
  appointmentId: string;
  customerName: string;
  phone: string;
  type: '24h' | '2h' | 'manual';
  success: boolean;
  error?: string;
}

export class ReminderService {
  private timer: NodeJS.Timeout | null = null;
  private isChecking = false;

  public start(intervalMs = 60000): void {
    if (this.timer) return;
    console.log('⏰ [ReminderService] Serviço de lembretes automáticos iniciado (intervalo: 60s)');
    
    // Executa uma checagem inicial após 5s
    setTimeout(() => {
      this.checkAndSendReminders().catch(err => {
        console.error('Erro na checagem inicial de lembretes:', err);
      });
    }, 5000);

    this.timer = setInterval(() => {
      this.checkAndSendReminders().catch(err => {
        console.error('Erro na verificação periódica de lembretes:', err);
      });
    }, intervalMs);
  }

  public stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      console.log('⏰ [ReminderService] Serviço de lembretes parado');
    }
  }

  public async checkAndSendReminders(): Promise<ReminderResult[]> {
    if (this.isChecking) return [];
    this.isChecking = true;

    const results: ReminderResult[] = [];

    try {
      const stores = storeService.listStores();

      for (const store of stores) {
        const appointments = appointmentService.listAppointments(store.id);
        const now = new Date();

        for (const apt of appointments) {
          // Ignora cancelados ou já concluídos
          if (apt.status === 'cancelled' || apt.status === 'completed') {
            continue;
          }

          // Monta data/hora do agendamento
          const aptDateParts = apt.date.split('-').map(Number);
          const aptTimeParts = apt.time.split(':').map(Number);
          if (aptDateParts.length !== 3 || aptTimeParts.length !== 2) continue;

          const aptDateTime = new Date(
            aptDateParts[0],
            aptDateParts[1] - 1,
            aptDateParts[2],
            aptTimeParts[0],
            aptTimeParts[1],
            0
          );

          const diffMs = aptDateTime.getTime() - now.getTime();
          const diffHours = diffMs / (1000 * 60 * 60);

          // Lembrete de 24 Horas (entre 18h e 26h antes)
          if (diffHours >= 18 && diffHours <= 26 && !apt.reminder24hSent) {
            const sent = await this.sendReminder(apt, '24h');
            results.push({
              appointmentId: apt.id,
              customerName: apt.customerName,
              phone: apt.customerPhone,
              type: '24h',
              success: sent
            });
            if (sent) {
              appointmentService.updateAppointment(apt.id, {
                reminder24hSent: true,
                lastReminderSentAt: new Date().toISOString()
              });
            }
          }
          // Lembrete de 2 Horas (entre 45 minutos e 2h30 antes)
          else if (diffHours >= 0.75 && diffHours <= 2.5 && !apt.reminder2hSent) {
            const sent = await this.sendReminder(apt, '2h');
            results.push({
              appointmentId: apt.id,
              customerName: apt.customerName,
              phone: apt.customerPhone,
              type: '2h',
              success: sent
            });
            if (sent) {
              appointmentService.updateAppointment(apt.id, {
                reminder2hSent: true,
                lastReminderSentAt: new Date().toISOString()
              });
            }
          }
        }
      }
    } catch (err: any) {
      console.error('Erro ao verificar lembretes:', err);
    } finally {
      this.isChecking = false;
    }

    return results;
  }

  public async sendManualReminder(appointmentId: string): Promise<{ success: boolean; message: string }> {
    const apt = appointmentService.getAppointment(appointmentId);
    if (!apt) {
      throw new Error('Agendamento não encontrado.');
    }

    const sent = await this.sendReminder(apt, 'manual');
    appointmentService.updateAppointment(apt.id, {
      lastReminderSentAt: new Date().toISOString(),
      reminder24hSent: true
    });

    if (sent) {
      return { success: true, message: `Lembrete enviado com sucesso para ${apt.customerName} via WhatsApp!` };
    } else {
      return { success: false, message: 'WhatsApp desconectado no momento. Mensagem registrada no chat do cliente.' };
    }
  }

  private async sendReminder(apt: Appointment, type: '24h' | '2h' | 'manual'): Promise<boolean> {
    const store = storeService.getStore(apt.storeId) || storeService.getActiveStore();
    const cleanPhone = apt.customerPhone.replace(/\D/g, '');

    // Formata data DD/MM/AAAA
    const [ano, mes, dia] = apt.date.split('-');
    const formattedDate = `${dia}/${mes}/${ano}`;

    let tempoLabel = 'em breve';
    if (type === '24h') tempoLabel = 'amanhã';
    else if (type === '2h') tempoLabel = 'hoje (daqui a cerca de 2 horas)';

    const messageText = `🔔 *Lembrete de Agendamento — ${store.name}*

Olá, *${apt.customerName}*! Tudo bem? 😊
Passando para lembrar do seu atendimento agendado para *${tempoLabel}*:

🗓️ *Data:* ${formattedDate}
⏰ *Horário:* ${apt.time}
🩺 *Serviço:* ${apt.serviceName}

Por favor, confirme se você comparecerá:
👉 Digite *1* para *Confirmar Presença* ✅
👉 Digite *2* para *Reagendar Horário* 🔄`;

    console.log(`🔔 [Lembrete ${type}] Disparando para ${apt.customerName} (${cleanPhone}) na loja "${store.name}"...`);

    // Registra na sessão de atendimento para aparecer no Live Chat
    const session = sessionService.getOrCreateSession(apt.storeId, cleanPhone, apt.customerName);
    sessionService.addMessage(apt.storeId, cleanPhone, 'bot', messageText);

    // Guarda no metadata da sessão o ID do agendamento que aguarda confirmação
    session.metadata = session.metadata || {};
    session.metadata.pendingReminderAppointmentId = apt.id;

    // Dispara via Baileys WhatsApp se conectado
    try {
      const isSent = await baileysService.sendMessage(apt.storeId, cleanPhone, messageText, session.jid);
      if (isSent) {
        console.log(`✅ [Lembrete ${type}] Mensagem entregue com sucesso para ${apt.customerName}!`);
        return true;
      } else {
        console.warn(`⚠️ [Lembrete ${type}] WhatsApp da loja ${store.name} desconectado. Mensagem registrada no chat.`);
        return false;
      }
    } catch (err) {
      console.error(`❌ [Lembrete ${type}] Erro ao despachar mensagem via Baileys:`, err);
      return false;
    }
  }
}

export const reminderService = new ReminderService();
