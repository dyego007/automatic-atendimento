import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { AvailabilityService, validDate } from '../src/services/availabilityService.js';
import type { ChatSession } from '../src/services/sessionService.js';
function setup(t: any) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agenda-test-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'agenda.json');
  const now = () => new Date('2026-11-24T15:00:00Z'); // 12h em Brasília
  const bookings: any[] = [];
  const backend = {
    getAvailableSlots: () => [] as string[],
    getStoreSchedule: () => ({ days: ['seg', 'ter', 'qua', 'qui', 'sex'], startTime: '08:00', endTime: '18:00', slotMinutes: 45 }),
    listAppointments: (storeId?: string, date?: string) => bookings.filter(b => (!storeId || b.storeId === storeId) && (!date || b.date === date)),
    createAppointment: (data: any) => { const item = { ...data, id: String(bookings.length), createdAt: now().toISOString() }; bookings.push(item); return item; }
  };
  const service = new AvailabilityService(file, now, backend);
  const session: ChatSession = { storeId: 'a', phone: '551199990000', customerName: 'Teste', nicheId: 'dentista', status: 'bot', messages: [], lastActivity: now().toISOString() };
  return { service, session, file, now, backend, reply: (text: string) => service.reply('a', text, session, true)! };
}
test('oferece apenas 13h, confirma dia antes do horário e exige confirmação final', t => {
  const { service, reply } = setup(t);
  service.setDay('a', '2026-11-25', ['13:00']);
  assert.match(reply('Quero marcar horario'), /qual dia/i);
  const day = reply('amanhã');
  assert.match(day, /25\/11\/2026/);
  assert.match(day, /13:00/);
  assert.doesNotMatch(day, /14:00|08:00/);
  assert.match(reply('13h'), /Primeiro confirme o dia/);
  assert.equal(service.getDay('a', '2026-11-25').bookings.length, 0);
  assert.match(reply('sim'), /Dia confirmado/);
  assert.match(reply('14h'), /14:00.*não está disponível/);
  assert.match(reply('13h'), /Confirma seu agendamento/);
  assert.equal(service.getDay('a', '2026-11-25').bookings.length, 0);
  assert.match(reply('sim'), /Agendamento confirmado/);
  assert.deepEqual(service.available('a', '2026-11-25'), []);
});
test('agenda isolada por loja, deduplicada, ordenada e persistida', t => {
  const { service, file, now, backend } = setup(t);
  service.setDay('a', '2026-11-25', ['14:30', '13:00', '13:00']);
  assert.deepEqual(service.available('a', '2026-11-25'), ['13:00', '14:30']);
  assert.deepEqual(service.available('b', '2026-11-25'), []);
  assert.equal(service.reserve('a', '2026-11-25', '13:00', '1', 'Cliente'), true);
  const reloaded = new AvailabilityService(file, now, backend);
  assert.deepEqual(reloaded.available('a', '2026-11-25'), ['14:30']);
  reloaded.setDay('a', '2026-11-25', ['13:00', '14:30']);
  assert.deepEqual(reloaded.available('a', '2026-11-25'), ['14:30']);
});
test('duas confirmações não podem reservar a mesma vaga', t => {
  const { service, reply } = setup(t);
  service.setDay('a', '2026-11-25', ['13:00']);
  reply('agendar 25/11/2026'); reply('sim'); reply('13:00');
  assert.equal(service.reserve('a', '2026-11-25', '13:00', 'outra', 'Outro'), true);
  assert.match(reply('sim'), /não está mais disponível/);
  assert.equal(service.getDay('a', '2026-11-25').bookings.length, 1);
});
test('data sem cadastro ou dia fechado não inventa vagas', t => {
  const { service, reply } = setup(t);
  assert.match(reply('quero agendar 25/11/2026'), /Não há horários disponíveis cadastrados/);
  service.setDay('a', '2026-11-26', []);
  assert.match(reply('26/11/2026'), /Não há horários disponíveis cadastrados/);
});
test('valida datas, horários e elimina horários passados em Brasília', t => {
  const { service, reply } = setup(t);
  assert.equal(validDate('2026-02-30'), false);
  assert.throws(() => service.setDay('a', '2026-02-30', ['13:00']));
  assert.throws(() => service.setDay('a', '2026-11-25', ['25:00']));
  assert.throws(() => service.setDay('a', '2026-11-25', '13:00'));
  assert.throws(() => service.setDay('a', '2026-11-23', ['13:00']));
  service.setDay('a', '2026-11-24', ['11:00', '12:00', '13:00']);
  assert.deepEqual(service.available('a', '2026-11-24'), ['13:00']);
  assert.match(reply('agendar 30/02/2027'), /inválida/);
});
test('troca de data exige nova confirmação e não reserva o dia anterior', t => {
  const { service, reply } = setup(t);
  service.setDay('a', '2026-11-25', ['13:00']);
  service.setDay('a', '2026-11-26', ['15:00']);
  reply('agendar amanhã'); reply('sim'); reply('13:00');
  assert.match(reply('26/11/2026'), /26\/11\/2026/);
  assert.match(reply('15h'), /Primeiro confirme o dia/);
  assert.equal(service.getDay('a', '2026-11-25').bookings.length, 0);
});
test('preserva funcionamento, outros nichos e cancelamento', t => {
  const { service, session, reply } = setup(t);
  assert.equal(service.reply('a', 'Qual o horário de funcionamento?', session, true), undefined);
  assert.equal(service.reply('a', 'Quero fazer um pedido', session, false), undefined);
  assert.match(reply('quero agendar segunda'), /data completa/);
  assert.match(reply('cancelar'), /cancelada/);
  assert.equal(session.metadata?.appointmentFlow, undefined);
});

test('reservas do painel bloqueiam a vaga do bot e cancelamento devolve a vaga', t => {
  const { service, backend } = setup(t);
  service.setDay('a', '2026-11-25', ['13:00']);
  const booking = backend.createAppointment({ storeId: 'a', date: '2026-11-25', time: '13:00', customerPhone: '2', customerName: 'Painel', status: 'confirmed' });
  assert.deepEqual(service.available('a', '2026-11-25'), []);
  booking.status = 'cancelled';
  assert.deepEqual(service.available('a', '2026-11-25'), ['13:00']);
});
test('usa grade existente, respeita dia fechado e aceita disponibilidade específica', t => {
  const { service, backend } = setup(t);
  backend.getAvailableSlots = () => ['13:00', '14:00'];
  assert.deepEqual(service.available('a', '2026-11-25'), ['13:00', '14:00']);
  assert.deepEqual(service.available('a', '2026-11-29'), []);
  service.setDay('a', '2026-11-25', ['13:00']);
  assert.deepEqual(service.available('a', '2026-11-25'), ['13:00']);
  service.setDay('a', '2026-11-25', []);
  assert.deepEqual(service.available('a', '2026-11-25'), []);
});
test('reconhece data sem frase de agendamento e esclarece dia da semana', t => {
  const { reply } = setup(t);
  assert.match(reply('25/11/2026'), /25\/11\/2026/);
  reply('cancelar');
  assert.match(reply('sexta'), /data completa/);
});
