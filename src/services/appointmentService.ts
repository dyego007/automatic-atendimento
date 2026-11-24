import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { storeService } from './storeService.js';
import { nicheService } from './nicheService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface ServiceItem {
  id: string;
  name: string;
  price: string;
  duration: string;
  description?: string;
}

export interface WorkingHours {
  days: string[]; // ['seg', 'ter', 'qua', 'qui', 'sex', 'sab']
  startTime: string; // '08:00'
  endTime: string; // '18:00'
  lunchStart?: string; // '12:00'
  lunchEnd?: string; // '13:00'
  slotMinutes: number; // 30 ou 60
}

export interface Appointment {
  id: string;
  storeId: string;
  customerName: string;
  customerPhone: string;
  serviceId?: string;
  serviceName: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  status: 'confirmed' | 'pending' | 'cancelled' | 'completed';
  notes?: string;
  createdAt: string;
  reminder24hSent?: boolean;
  reminder2hSent?: boolean;
  lastReminderSentAt?: string;
}

export class AppointmentService {
  private appointmentsFile: string;
  private schedulesFile: string;
  private appointments: Map<string, Appointment> = new Map();
  private schedules: Map<string, WorkingHours> = new Map();

  constructor() {
    this.appointmentsFile = path.resolve(__dirname, '../../src/presets/appointments.json');
    this.schedulesFile = path.resolve(__dirname, '../../src/presets/schedules.json');
    this.loadData();
  }

  private loadData(): void {
    if (fs.existsSync(this.appointmentsFile)) {
      try {
        const content = fs.readFileSync(this.appointmentsFile, 'utf-8');
        const list: Appointment[] = JSON.parse(content);
        list.forEach(a => this.appointments.set(a.id, a));
      } catch (err) {
        console.error('Erro ao ler appointments.json:', err);
      }
    } else {
      // Cria alguns agendamentos de exemplo para clínica
      const sampleDate = new Date().toISOString().split('T')[0];
      const samples: Appointment[] = [
        {
          id: 'apt-1',
          storeId: 'loja-1',
          customerName: 'Leonardo Viana',
          customerPhone: '10338137284706',
          serviceName: 'Avaliação Inicial + Raio-X Diagnóstico',
          date: sampleDate,
          time: '10:00',
          status: 'confirmed',
          notes: 'Paciente relatou sensibilidade no molar.',
          createdAt: new Date().toISOString()
        },
        {
          id: 'apt-2',
          storeId: 'loja-1',
          customerName: 'Carol Silva',
          customerPhone: '5511988887777',
          serviceName: 'Clareamento Dental a Laser',
          date: sampleDate,
          time: '14:30',
          status: 'pending',
          notes: 'Primeira sessão do clareamento.',
          createdAt: new Date().toISOString()
        }
      ];
      samples.forEach(s => this.appointments.set(s.id, s));
      this.saveAppointments();
    }

    if (fs.existsSync(this.schedulesFile)) {
      try {
        const content = fs.readFileSync(this.schedulesFile, 'utf-8');
        const map = JSON.parse(content);
        Object.keys(map).forEach(k => this.schedules.set(k, map[k]));
      } catch (err) {
        console.error('Erro ao ler schedules.json:', err);
      }
    }
  }

  public getStoreSchedule(storeId: string): WorkingHours {
    const existing = this.schedules.get(storeId);
    if (existing) return existing;

    // Configuração padrão
    const defaultSchedule: WorkingHours = {
      days: ['seg', 'ter', 'qua', 'qui', 'sex', 'sab'],
      startTime: '08:00',
      endTime: '18:00',
      lunchStart: '12:00',
      lunchEnd: '13:00',
      slotMinutes: 45
    };

    this.schedules.set(storeId, defaultSchedule);
    this.saveSchedules();
    return defaultSchedule;
  }

  public saveStoreSchedule(storeId: string, schedule: WorkingHours): WorkingHours {
    this.schedules.set(storeId, schedule);
    this.saveSchedules();
    return schedule;
  }

  public listAppointments(storeId?: string, date?: string): Appointment[] {
    let list = Array.from(this.appointments.values());
    if (storeId) {
      list = list.filter(a => a.storeId === storeId);
    }
    if (date) {
      list = list.filter(a => a.date === date);
    }
    return list.sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
  }

  public createAppointment(data: Omit<Appointment, 'id' | 'createdAt'>): Appointment {
    const id = `apt-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 5)}`;
    const newApt: Appointment = {
      ...data,
      id,
      createdAt: new Date().toISOString()
    };

    this.appointments.set(id, newApt);
    this.saveAppointments();
    return newApt;
  }

  public getAppointment(id: string): Appointment | undefined {
    return this.appointments.get(id);
  }

  public updateAppointment(id: string, updates: Partial<Appointment>): Appointment {
    const apt = this.appointments.get(id);
    if (!apt) throw new Error('Agendamento não encontrado.');
    Object.assign(apt, updates);
    this.saveAppointments();
    return apt;
  }

  public findUpcomingByPhone(storeId: string, phone: string): Appointment | undefined {
    const cleanPhone = phone.replace(/\D/g, '');
    const now = new Date();
    const today = now.toISOString().split('T')[0];

    const list = this.listAppointments(storeId)
      .filter(a => {
        const aptCleanPhone = a.customerPhone.replace(/\D/g, '');
        const matchPhone = aptCleanPhone === cleanPhone || aptCleanPhone.endsWith(cleanPhone) || cleanPhone.endsWith(aptCleanPhone);
        return matchPhone && a.date >= today && a.status !== 'cancelled' && a.status !== 'completed';
      });

    return list[0];
  }

  public updateAppointmentStatus(id: string, status: 'confirmed' | 'pending' | 'cancelled' | 'completed'): Appointment {
    const apt = this.appointments.get(id);
    if (!apt) throw new Error('Agendamento não encontrado.');
    apt.status = status;
    this.saveAppointments();
    return apt;
  }

  public deleteAppointment(id: string): boolean {
    const deleted = this.appointments.delete(id);
    if (deleted) this.saveAppointments();
    return deleted;
  }

  // Serviços da Loja
  public getStoreServices(storeId: string): ServiceItem[] {
    const store = storeService.getStore(storeId) || storeService.getActiveStore();
    const niche = nicheService.getNiche(store.nicheId);

    if (niche.services && niche.services.length > 0) {
      return niche.services.map((s, idx) => ({
        id: `srv-${idx + 1}`,
        name: s.name,
        price: s.price,
        duration: s.duration || '45 minutos',
        description: s.description || ''
      }));
    }
    return [];
  }

  public addStoreService(storeId: string, item: Omit<ServiceItem, 'id'>): ServiceItem[] {
    const store = storeService.getStore(storeId) || storeService.getActiveStore();
    const niche = nicheService.getNiche(store.nicheId);
    if (!niche.services) niche.services = [];

    niche.services.push({
      name: item.name,
      price: item.price,
      duration: item.duration,
      description: item.description
    });

    nicheService.saveNiche(niche);
    return this.getStoreServices(storeId);
  }

  public deleteStoreService(storeId: string, serviceName: string): ServiceItem[] {
    const store = storeService.getStore(storeId) || storeService.getActiveStore();
    const niche = nicheService.getNiche(store.nicheId);
    if (!niche.services) return [];

    niche.services = niche.services.filter(s => s.name.toLowerCase() !== serviceName.toLowerCase());
    nicheService.saveNiche(niche);
    return this.getStoreServices(storeId);
  }

  // Gera slots de horários vagos para determinado dia
  public getAvailableSlots(storeId: string, dateStr: string): string[] {
    const schedule = this.getStoreSchedule(storeId);
    const booked = this.listAppointments(storeId, dateStr)
      .filter(a => a.status !== 'cancelled')
      .map(a => a.time);

    const slots: string[] = [];
    const [startH, startM] = schedule.startTime.split(':').map(Number);
    const [endH, endM] = schedule.endTime.split(':').map(Number);
    const [lunchStartH, lunchStartM] = (schedule.lunchStart || '12:00').split(':').map(Number);
    const [lunchEndH, lunchEndM] = (schedule.lunchEnd || '13:00').split(':').map(Number);

    let currentMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;
    const lunchStartMinutes = lunchStartH * 60 + lunchStartM;
    const lunchEndMinutes = lunchEndH * 60 + lunchEndM;

    while (currentMinutes + schedule.slotMinutes <= endMinutes) {
      // Pula se estiver no intervalo de almoço
      if (currentMinutes >= lunchStartMinutes && currentMinutes < lunchEndMinutes) {
        currentMinutes = lunchEndMinutes;
        continue;
      }

      const h = Math.floor(currentMinutes / 60).toString().padStart(2, '0');
      const m = (currentMinutes % 60).toString().padStart(2, '0');
      const timeStr = `${h}:${m}`;

      if (!booked.includes(timeStr)) {
        slots.push(timeStr);
      }

      currentMinutes += schedule.slotMinutes;
    }

    return slots;
  }

  private saveAppointments(): void {
    const list = Array.from(this.appointments.values());
    fs.writeFileSync(this.appointmentsFile, JSON.stringify(list, null, 2), 'utf-8');
  }

  private saveSchedules(): void {
    const obj: Record<string, WorkingHours> = {};
    this.schedules.forEach((val, key) => {
      obj[key] = val;
    });
    fs.writeFileSync(this.schedulesFile, JSON.stringify(obj, null, 2), 'utf-8');
  }
}

export const appointmentService = new AppointmentService();
