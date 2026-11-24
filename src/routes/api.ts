import { Router } from 'express';
import { nicheService } from '../services/nicheService.js';
import { sessionService } from '../services/sessionService.js';
import { whatsappService } from '../services/whatsappService.js';
import { baileysService } from '../services/baileysService.js';
import { storeService } from '../services/storeService.js';
import { appointmentService } from '../services/appointmentService.js';

export const apiRouter = Router();

// --- Rotas de Lojas / Clientes (Multi-Tenancy) ---
apiRouter.get('/stores', (req, res) => {
  const stores = storeService.listStores();
  const statuses = baileysService.getAllStatuses();

  const enriched = stores.map(s => {
    const st = statuses.find(x => x.storeId === s.id);
    const sessions = sessionService.listSessions(s.id);
    return {
      ...s,
      whatsappStatus: st?.status || 'disconnected',
      user: st?.user || null,
      totalChats: sessions.length
    };
  });

  res.json({
    activeStoreId: storeService.getActiveStore().id,
    stores: enriched
  });
});

apiRouter.get('/stores/active', (req, res) => {
  const store = storeService.getActiveStore();
  const status = baileysService.getStatus(store.id);
  res.json({
    ...store,
    whatsappStatus: status.status,
    user: status.user
  });
});

apiRouter.post('/stores/active', (req, res) => {
  const { id } = req.body;
  if (!id) return res.status(400).json({ error: "O campo 'id' é obrigatório." });
  try {
    const store = storeService.setActiveStoreId(id);
    res.json({ message: `Loja ativa alterada para '${store.name}'`, store });
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

apiRouter.post('/stores', (req, res) => {
  const { name, nicheId, id } = req.body;
  if (!name || !nicheId) {
    return res.status(400).json({ error: 'Nome e Nicho são obrigatórios para criar uma loja.' });
  }
  try {
    const newStore = storeService.createStore({ name, nicheId, id });
    res.json({ message: 'Loja criada com sucesso!', store: newStore });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.delete('/stores/:id', async (req, res) => {
  try {
    const storeId = req.params.id;
    await baileysService.disconnect(storeId);
    storeService.deleteStore(storeId);
    res.json({ message: 'Loja removida com sucesso.' });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// --- WhatsApp por Loja (QR Code e Status) ---
apiRouter.get('/stores/:id/whatsapp/status', (req, res) => {
  const status = baileysService.getStatus(req.params.id);
  res.json(status);
});

apiRouter.post('/stores/:id/whatsapp/connect', async (req, res) => {
  try {
    const storeId = req.params.id;
    await baileysService.connect(storeId);
    const status = baileysService.getStatus(storeId);
    res.json({ message: `Conexão iniciada para a loja ${storeId}.`, status });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/stores/:id/whatsapp/disconnect', async (req, res) => {
  try {
    const storeId = req.params.id;
    await baileysService.disconnect(storeId);
    res.json({ message: `WhatsApp da loja ${storeId} desconectado.` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Retrocompatibilidade para rotas sem ID de loja (usa a loja ativa)
apiRouter.get('/whatsapp/status', (req, res) => {
  const active = storeService.getActiveStore();
  const status = baileysService.getStatus(active.id);
  res.json(status);
});

apiRouter.post('/whatsapp/connect', async (req, res) => {
  try {
    const active = storeService.getActiveStore();
    await baileysService.connect(active.id);
    const status = baileysService.getStatus(active.id);
    res.json({ message: 'Conexão iniciada. Escaneie o QR Code no WhatsApp.', status });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/whatsapp/disconnect', async (req, res) => {
  try {
    const active = storeService.getActiveStore();
    await baileysService.disconnect(active.id);
    res.json({ message: 'WhatsApp desconectado com sucesso.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- Métricas e Estatísticas por Loja ---
apiRouter.get('/stats', (req, res) => {
  const storeId = (req.query.storeId as string) || storeService.getActiveStore().id;
  const sessions = sessionService.listSessions(storeId);
  const total = sessions.length;
  const botCount = sessions.filter(s => s.status === 'bot').length;
  const humanCount = sessions.filter(s => s.status === 'human').length;
  const totalMessages = sessions.reduce((acc, s) => acc + s.messages.length, 0);

  res.json({
    storeId,
    totalSessions: total,
    botActive: botCount,
    humanTakeover: humanCount,
    totalMessages,
    whatsappStatus: baileysService.getStatus(storeId).status
  });
});

// --- Rotas de Nichos ---
apiRouter.get('/niches', (req, res) => {
  const niches = nicheService.listNiches();
  const activeStore = storeService.getActiveStore();
  res.json({
    activeId: activeStore.nicheId,
    niches
  });
});

apiRouter.get('/niches/active', (req, res) => {
  const activeStore = storeService.getActiveStore();
  const niche = nicheService.getNiche(activeStore.nicheId);
  res.json(niche);
});

apiRouter.post('/niches', (req, res) => {
  try {
    const saved = nicheService.saveNiche(req.body);
    res.json({ message: 'Nicho salvo com sucesso!', niche: saved });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// --- Rotas de Atendimento & Sessões por Loja ---
apiRouter.get('/sessions', (req, res) => {
  const storeId = (req.query.storeId as string) || storeService.getActiveStore().id;
  const sessions = sessionService.listSessions(storeId);
  res.json(sessions);
});

apiRouter.get('/sessions/:phone', (req, res) => {
  const storeId = (req.query.storeId as string) || storeService.getActiveStore().id;
  const session = sessionService.getSession(storeId, req.params.phone);
  if (!session) {
    return res.status(404).json({ error: 'Sessão não encontrada.' });
  }
  res.json(session);
});

apiRouter.post('/sessions/:phone/status', (req, res) => {
  const storeId = req.body.storeId || storeService.getActiveStore().id;
  const { status } = req.body;
  if (!['bot', 'human', 'finished'].includes(status)) {
    return res.status(400).json({ error: 'Status inválido (use: bot, human ou finished).' });
  }
  const session = sessionService.setStatus(storeId, req.params.phone, status);
  res.json({ message: 'Status atualizado com sucesso.', session });
});

apiRouter.post('/sessions/:phone/message', async (req, res) => {
  const storeId = req.body.storeId || storeService.getActiveStore().id;
  const { text } = req.body;
  if (!text) {
    return res.status(400).json({ error: "O campo 'text' é obrigatório." });
  }
  const message = await whatsappService.sendManualAgentMessage(storeId, req.params.phone, text);
  res.json({ message: 'Mensagem enviada pelo atendente.', data: message });
});

apiRouter.delete('/sessions/:phone', (req, res) => {
  const storeId = (req.query.storeId as string) || storeService.getActiveStore().id;
  sessionService.clearSession(storeId, req.params.phone);
  res.json({ message: 'Sessão reiniciada com sucesso.' });
});

// --- Rota do Simulador Web ---
apiRouter.post('/simulator/send', async (req, res) => {
  const storeId = req.body.storeId || storeService.getActiveStore().id;
  const { phone = '5511999998888', customerName = 'Você (Simulador)', text } = req.body;
  if (!text) {
    return res.status(400).json({ error: "O campo 'text' é obrigatório." });
  }

  const result = await whatsappService.handleIncomingMessage({
    storeId,
    phone,
    customerName,
    text,
    source: 'simulator'
  });

  res.json(result);
});

// --- Módulo de Agendamentos, Horários & Serviços ---
apiRouter.get('/appointments', (req, res) => {
  const storeId = (req.query.storeId as string) || storeService.getActiveStore().id;
  const date = req.query.date as string | undefined;
  const list = appointmentService.listAppointments(storeId, date);
  res.json(list);
});

apiRouter.post('/appointments', (req, res) => {
  const storeId = req.body.storeId || storeService.getActiveStore().id;
  const { customerName, customerPhone, serviceName, date, time, notes, status = 'confirmed' } = req.body;

  if (!customerName || !customerPhone || !serviceName || !date || !time) {
    return res.status(400).json({ error: 'Preencha nome, telefone, serviço, data e horário.' });
  }

  const created = appointmentService.createAppointment({
    storeId,
    customerName,
    customerPhone,
    serviceName,
    date,
    time,
    status,
    notes
  });

  res.json({ message: 'Agendamento criado com sucesso!', appointment: created });
});

apiRouter.patch('/appointments/:id/status', (req, res) => {
  const { status } = req.body;
  if (!['confirmed', 'pending', 'cancelled', 'completed'].includes(status)) {
    return res.status(400).json({ error: 'Status de agendamento inválido.' });
  }
  try {
    const updated = appointmentService.updateAppointmentStatus(req.params.id, status);
    res.json({ message: 'Status do agendamento atualizado.', appointment: updated });
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

apiRouter.delete('/appointments/:id', (req, res) => {
  const ok = appointmentService.deleteAppointment(req.params.id);
  res.json({ message: 'Agendamento removido com sucesso.', success: ok });
});

// Horários de Funcionamento da Loja
apiRouter.get('/schedules', (req, res) => {
  const storeId = (req.query.storeId as string) || storeService.getActiveStore().id;
  const schedule = appointmentService.getStoreSchedule(storeId);
  res.json(schedule);
});

apiRouter.post('/schedules', (req, res) => {
  const storeId = req.body.storeId || storeService.getActiveStore().id;
  const updated = appointmentService.saveStoreSchedule(storeId, req.body.schedule);
  res.json({ message: 'Horários atualizados com sucesso!', schedule: updated });
});

// Serviços da Loja
apiRouter.get('/services', (req, res) => {
  const storeId = (req.query.storeId as string) || storeService.getActiveStore().id;
  const services = appointmentService.getStoreServices(storeId);
  res.json(services);
});

apiRouter.post('/services', (req, res) => {
  const storeId = req.body.storeId || storeService.getActiveStore().id;
  const { name, price, duration = '45 min', description = '' } = req.body;
  if (!name || !price) {
    return res.status(400).json({ error: 'Nome e preço são obrigatórios.' });
  }
  const services = appointmentService.addStoreService(storeId, { name, price, duration, description });
  res.json({ message: 'Serviço adicionado com sucesso!', services });
});

apiRouter.delete('/services/:name', (req, res) => {
  const storeId = (req.query.storeId as string) || storeService.getActiveStore().id;
  const services = appointmentService.deleteStoreService(storeId, req.params.name);
  res.json({ message: 'Serviço removido com sucesso!', services });
});

// Slots Livres
apiRouter.get('/slots', (req, res) => {
  const storeId = (req.query.storeId as string) || storeService.getActiveStore().id;
  const date = (req.query.date as string) || new Date().toISOString().split('T')[0];
  const slots = appointmentService.getAvailableSlots(storeId, date);
  res.json({ date, slots });
});
