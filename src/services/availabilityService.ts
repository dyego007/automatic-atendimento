import fs from 'node:fs';
import path from 'node:path';
import { appointmentService } from './appointmentService.js';
import type { AppointmentService as BookingService } from './appointmentService.js';
import type { ChatSession } from './sessionService.js';

type Booking = { date: string; time: string; phone: string; customerName: string };
type Calendar = { days: Record<string, string[]>; bookings: Booking[] };
type Flow = { date?: string; time?: string; stage: 'date' | 'day' | 'time' | 'confirm' };
const normalize = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
export const validDate = (date: string) => /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(date)) && new Date(date + 'T12:00:00Z').toISOString().slice(0, 10) === date;
const validTime = (time: string) => /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time);

export class AvailabilityService {
  private calendars: Record<string, Calendar>;
  constructor(private filePath = path.resolve('data/appointments.json'), private now = () => new Date(), private backend: Pick<BookingService, 'getAvailableSlots' | 'getStoreSchedule' | 'listAppointments' | 'createAppointment'> = appointmentService) {
    this.calendars = fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, 'utf8')) : {};
  }
  private clock() {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(this.now());
    const value = (type: string) => parts.find(p => p.type === type)!.value;
    return { date: value('year') + '-' + value('month') + '-' + value('day'), time: value('hour') + ':' + value('minute') };
  }
  private calendar(storeId: string): Calendar { return this.calendars[storeId] || { days: {}, bookings: [] }; }
  public isConfigured(storeId: string): boolean { return Object.prototype.hasOwnProperty.call(this.calendars, storeId); }
  private persist(storeId: string, calendar: Calendar) {
    const updated = { ...this.calendars, [storeId]: calendar };
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.writeFileSync(this.filePath + '.tmp', JSON.stringify(updated, null, 2), 'utf8');
    fs.renameSync(this.filePath + '.tmp', this.filePath);
    this.calendars = updated;
  }
  public available(storeId: string, date: string): string[] {
    const clock = this.clock();
    const calendar = this.calendar(storeId);
    if (date < clock.date) return [];
    if (!validDate(date)) return [];
    const explicit = Object.prototype.hasOwnProperty.call(calendar.days, date);
    if (!explicit) {
      const schedule = this.backend.getStoreSchedule(storeId);
      const weekday = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'][new Date(date + 'T12:00:00Z').getUTCDay()];
      if (!Array.isArray(schedule.days) || !schedule.days.includes(weekday) || !Number.isFinite(schedule.slotMinutes) || schedule.slotMinutes <= 0 || !validTime(schedule.startTime) || !validTime(schedule.endTime)) return [];
    }
    const slots = explicit ? calendar.days[date] : this.backend.getAvailableSlots(storeId, date);
    const occupied = this.backend.listAppointments(storeId, date).filter(b => b.status !== 'cancelled');
    return slots.filter(time => !occupied.some(b => b.time === time) && (date > clock.date || time > clock.time) && !calendar.bookings.some(b => b.date === date && b.time === time)).sort();
  }
  public getDay(storeId: string, date: string) {
    if (!validDate(date)) throw new Error('Informe uma data válida no formato AAAA-MM-DD.');
    const calendar = this.calendar(storeId);
    return { date, configured: Object.prototype.hasOwnProperty.call(calendar.days, date), times: calendar.days[date] || [], available: this.available(storeId, date), bookings: [...calendar.bookings.filter(b => b.date === date), ...this.backend.listAppointments(storeId, date).filter(b => b.status !== 'cancelled').map(b => ({ date: b.date, time: b.time, phone: b.customerPhone, customerName: b.customerName }))] };
  }
  public setDay(storeId: string, date: string, times: unknown) {
    if (!validDate(date) || date < this.clock().date) throw new Error('Informe uma data válida, de hoje em diante.');
    if (!Array.isArray(times) || times.length > 1440 || !times.every(time => typeof time === 'string' && validTime(time))) throw new Error('Use horários no formato HH:MM, por exemplo 13:00.');
    const calendar = this.calendar(storeId);
    this.persist(storeId, { days: { ...calendar.days, [date]: [...new Set(times)].sort() }, bookings: calendar.bookings });
    return this.getDay(storeId, date);
  }
  public reserve(storeId: string, date: string, time: string, phone: string, customerName: string): boolean {
    if (!this.available(storeId, date).includes(time)) return false;
    const calendar = this.calendar(storeId);
    this.backend.createAppointment({ storeId, date, time, customerPhone: phone, customerName, serviceName: 'Atendimento', status: 'confirmed' });
    return true;
  }
  private label(date: string): string {
    return new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(date + 'T12:00:00Z'));
  }
  private options(storeId: string, date: string): string {
    const times = this.available(storeId, date);
    return times.length ? 'Horários disponíveis: *' + times.join('*, *') + '*.' : 'Não há horários disponíveis cadastrados para esse dia. Informe outra data ou peça para falar com um atendente.';
  }
  private parseDate(text: string): string | undefined {
    const today = this.clock().date;
    if (/\b(depois de amanha|amanha|hoje)\b/.test(text)) {
      const offset = text.includes('depois de amanha') ? 2 : text.includes('amanha') ? 1 : 0;
      const date = new Date(today + 'T12:00:00Z');
      date.setUTCDate(date.getUTCDate() + offset);
      return date.toISOString().slice(0, 10);
    }
    const iso = text.match(/\b\d{4}-\d{2}-\d{2}\b/);
    if (iso) return iso[0];
    const br = text.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{4}))?\b/);
    if (!br) return undefined;
    let year = br[3] || today.slice(0, 4);
    let date = year + '-' + br[2].padStart(2, '0') + '-' + br[1].padStart(2, '0');
    if (!br[3] && date < today && validDate(date)) date = String(Number(year) + 1) + date.slice(4);
    return date;
  }
  public reply(storeId: string, text: string, session: ChatSession, enabled: boolean): string | undefined {
    const input = normalize(text);
    session.metadata ||= {};
    let flow = session.metadata.appointmentFlow as Flow | undefined;
    if (!enabled && !flow) return undefined;
    const intent = /agend|marcar|consulta|disponib|vaga|encaixe/.test(input) || (/horario/.test(input) && !/funcion|aberto|fecha|endereco/.test(input));
    if (!flow && !intent && !this.parseDate(input) && !/\b(segunda|terca|quarta|quinta|sexta|sabado|domingo)\b/.test(input)) return undefined;
    const saveFlow = (value: Flow) => { session.metadata!.appointmentFlow = value; flow = value; };
    if (/^(cancelar|sair|desistir|deixa pra la)[.!]*$/.test(input)) {
      delete session.metadata.appointmentFlow;
      return 'Tudo bem, a solicitação de agendamento foi cancelada. Nenhum novo horário foi reservado.';
    }
    const date = this.parseDate(input);
    if (date) {
      if (!validDate(date) || date < this.clock().date) return 'Essa data é inválida ou já passou. Informe o dia desejado no formato *DD/MM/AAAA*.';
      saveFlow({ date, stage: 'day' });
      return '📅 Você quer atendimento em *' + this.label(date) + '*?\n\n' + this.options(storeId, date) + '\n\nConfirme o dia respondendo *sim* ou informe outra data.';
    }
    const yes = /^(sim|s|confirmo|confirmar|confirmado|pode ser|isso|ok|certo|pode confirmar)[.!]*$/.test(input);
    const no = /^(nao|n)[.!]*$/.test(input);
    if (!flow || flow.stage === 'date') {
      saveFlow({ stage: 'date' });
      return '📅 Para qual dia você deseja agendar? Informe a data completa (*DD/MM/AAAA*) ou diga *hoje* ou *amanhã*. Vou confirmar o dia e mostrar somente os horários disponíveis nessa data.';
    }
    if (no) {
      saveFlow({ stage: 'date' });
      return 'Sem problema! Qual outra data você prefere? Informe *DD/MM/AAAA*.';
    }
    if (flow.stage === 'day') {
      if (!yes) return 'Primeiro confirme o dia: *' + this.label(flow.date!) + '*. Responda *sim* ou informe outra data.\n\n' + this.options(storeId, flow.date!);
      saveFlow({ date: flow.date, stage: 'time' });
      return '📅 Dia confirmado: *' + this.label(flow.date!) + '*.\n\n' + this.options(storeId, flow.date!) + (this.available(storeId, flow.date!).length ? '\n\nQual desses horários você deseja?' : '');
    }
    if (flow.stage === 'confirm' && yes) {
      if (this.reserve(storeId, flow.date!, flow.time!, session.phone, session.customerName)) {
        const result = '✅ Agendamento confirmado para *' + this.label(flow.date!) + '*, às *' + flow.time + '*.';
        delete session.metadata.appointmentFlow;
        return result;
      }
      saveFlow({ date: flow.date, stage: 'time' });
      return 'Esse horário não está mais disponível.\n📅 Dia: *' + this.label(flow.date!) + '*.\n\n' + this.options(storeId, flow.date!);
    }
    const match = input.match(/(?:^|\s)(?:as\s+)?([01]?\d|2[0-3])(?:(?::|h)([0-5]\d)?)?(?:\s*h)?(?:$|\s|[.!?,])/);
    const time = match ? match[1].padStart(2, '0') + ':' + (match[2] || '00') : undefined;
    if (!time || !this.available(storeId, flow.date!).includes(time)) return '📅 Dia: *' + this.label(flow.date!) + '*.\n\n' + (time ? 'O horário *' + time + '* não está disponível.\n' : '') + this.options(storeId, flow.date!);
    saveFlow({ date: flow.date, time, stage: 'confirm' });
    return 'Confirma seu agendamento para *' + this.label(flow.date!) + '*, às *' + time + '*? Responda *sim* para reservar ou informe outro horário disponível.\n\n' + this.options(storeId, flow.date!);
  }
}
export const availabilityService = new AvailabilityService();
