import { Router } from 'express';
import { nicheService } from '../services/nicheService.js';
import { sessionService } from '../services/sessionService.js';
import { whatsappService } from '../services/whatsappService.js';
import { baileysService } from '../services/baileysService.js';
import { storeService } from '../services/storeService.js';
import { appointmentService } from '../services/appointmentService.js';
import { availabilityService } from '../services/availabilityService.js';
import { authService } from '../services/authService.js';
import { reminderService } from '../services/reminderService.js';

export const apiRouter = Router();

// --- Rotas de Autenticação & Usuários ---
apiRouter.post('/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Informe e-mail e senha.' });
  }
  try {
    const result = authService.login(email, password);
    res.json(result);
  } catch (err: any) {
    res.status(401).json({ error: err.message });
  }
});

apiRouter.get('/auth/me', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '') || '';
  const user = authService.getUserByToken(token);
  if (!user) {
    return res.status(401).json({ error: 'Sessão inválida ou expirada.' });
  }
  res.json({ user });
});

apiRouter.post('/auth/logout', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '') || '';
  authService.logout(token);
  res.json({ message: 'Logout realizado com sucesso.' });
});

apiRouter.get('/users', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '') || '';
  const user = authService.getUserByToken(token);
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Acesso restrito ao administrador do SaaS.' });
  }
  res.json(authService.listUsers());
});

apiRouter.post('/users', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '') || '';
  const user = authService.getUserByToken(token);
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Acesso restrito ao administrador do SaaS.' });
  }

  const { name, email, password, role, storeId } = req.body;
  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: 'Preencha nome, e-mail, senha e perfil.' });
  }

  try {
    const created = authService.createUser({ name, email, password, role, storeId });
    res.json({ message: 'Usuário cadastrado com sucesso!', user: created });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.delete('/users/:id', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '') || '';
  const user = authService.getUserByToken(token);
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Acesso restrito ao administrador do SaaS.' });
  }

  try {
    const ok = authService.deleteUser(req.params.id);
    res.json({ message: 'Usuário removido com sucesso.', success: ok });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// --- Agenda: horários explícitos por loja e data (horário de Brasília) ---
apiRouter.get('/stores/:id/agenda', (req, res) => {
  if (!storeService.getStore(req.params.id)) return res.status(404).json({ error: 'Loja não encontrada.' });
  try {
    res.json(availabilityService.getDay(req.params.id, String(req.query.date || '')));
  } catch (err: any) { res.status(400).json({ error: err.message }); }
});
apiRouter.put('/stores/:id/agenda', (req, res) => {
  if (!storeService.getStore(req.params.id)) return res.status(404).json({ error: 'Loja não encontrada.' });
  try {
    res.json(availabilityService.setDay(req.params.id, req.body.date, req.body.times));
  } catch (err: any) { res.status(400).json({ error: err.message }); }
});


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

// Disparo manual de lembrete de consulta via WhatsApp
apiRouter.post('/appointments/:id/remind', async (req, res) => {
  try {
    const result = await reminderService.sendManualReminder(req.params.id);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Checagem sob demanda de lembretes pendentes
apiRouter.post('/reminders/check', async (req, res) => {
  try {
    const results = await reminderService.checkAndSendReminders();
    res.json({ message: 'Verificação de lembretes concluída.', count: results.length, results });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
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
  const slots = availabilityService.available(storeId, date);
  res.json({ date, slots });
});
