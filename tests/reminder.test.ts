import test from 'node:test';
import assert from 'node:assert/strict';
import { appointmentService } from '../src/services/appointmentService.js';
import { whatsappService } from '../src/services/whatsappService.js';
import { reminderService } from '../src/services/reminderService.js';

test('Lembretes automáticos: disparo manual e resposta 1 confirma consulta', async () => {
  const storeId = 'loja-1';
  const customerPhone = '551199998877';

  // 1. Cria agendamento pendente
  const apt = appointmentService.createAppointment({
    storeId,
    customerName: 'Paciente Teste Lembrete',
    customerPhone,
    serviceName: 'Limpeza Dental e Profilaxia',
    date: '2026-11-25',
    time: '15:00',
    status: 'pending'
  });

  assert.equal(apt.status, 'pending');

  // 2. Dispara lembrete manual
  const result = await reminderService.sendManualReminder(apt.id);
  assert.equal(result.success, false); // offline/sem baileys conectado em teste, mas registrou no chat

  const updatedApt = appointmentService.getAppointment(apt.id);
  assert.ok(updatedApt?.lastReminderSentAt);

  // 3. Paciente responde "1" no WhatsApp para confirmar
  const response = await whatsappService.handleIncomingMessage({
    storeId,
    phone: customerPhone,
    text: '1',
    customerName: 'Paciente Teste Lembrete',
    source: 'simulator'
  });

  assert.ok(response.replyMessage?.text.includes('Presença Confirmada'));

  // 4. Verifica se status foi alterado para 'confirmed'
  const confirmedApt = appointmentService.getAppointment(apt.id);
  assert.equal(confirmedApt?.status, 'confirmed');

  // Limpa agendamento criado
  appointmentService.deleteAppointment(apt.id);
});

test('Lembretes automáticos: resposta 2 ativa fluxo de reagendamento', async () => {
  const storeId = 'loja-1';
  const customerPhone = '551199998866';

  const apt = appointmentService.createAppointment({
    storeId,
    customerName: 'Paciente Reagendamento',
    customerPhone,
    serviceName: 'Restauração em Resina',
    date: '2026-11-26',
    time: '11:00',
    status: 'confirmed'
  });

  // Paciente responde "2" (deseja reagendar)
  const response = await whatsappService.handleIncomingMessage({
    storeId,
    phone: customerPhone,
    text: '2',
    customerName: 'Paciente Reagendamento',
    source: 'simulator'
  });

  assert.ok(response.replyMessage?.text.includes('Reagendamento'));

  // Verifica se o status mudou para pending com nota de reagendamento
  const rescheduledApt = appointmentService.getAppointment(apt.id);
  assert.equal(rescheduledApt?.status, 'pending');
  assert.ok(rescheduledApt?.notes?.includes('reagendamento'));

  // Limpa
  appointmentService.deleteAppointment(apt.id);
});
