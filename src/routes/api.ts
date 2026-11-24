import { Router } from 'express';
import { nicheService } from '../services/nicheService.js';
import { sessionService } from '../services/sessionService.js';
import { whatsappService } from '../services/whatsappService.js';
import { baileysService } from '../services/baileysService.js';

export const apiRouter = Router();

// --- Rotas de Conexão WhatsApp Real via QR Code (Baileys) ---
apiRouter.get('/whatsapp/status', (req, res) => {
  const status = baileysService.getStatus();
  res.json(status);
});

apiRouter.post('/whatsapp/connect', async (req, res) => {
  try {
    await baileysService.connect();
    const status = baileysService.getStatus();
    res.json({ message: 'Conexão iniciada. Escaneie o QR Code no WhatsApp.', status });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/whatsapp/disconnect', async (req, res) => {
  try {
    await baileysService.disconnect();
    res.json({ message: 'WhatsApp desconectado com sucesso.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- Métricas e Estatísticas do Sistema ---
apiRouter.get('/stats', (req, res) => {
  const sessions = sessionService.listSessions();
  const total = sessions.length;
  const botCount = sessions.filter(s => s.status === 'bot').length;
  const humanCount = sessions.filter(s => s.status === 'human').length;
  const totalMessages = sessions.reduce((acc, s) => acc + s.messages.length, 0);

  res.json({
    totalSessions: total,
    botActive: botCount,
    humanTakeover: humanCount,
    totalMessages,
    whatsappStatus: baileysService.getStatus().status
  });
});

// --- Rotas de Nichos ---
apiRouter.get('/niches', (req, res) => {
  const niches = nicheService.listNiches();
  const active = nicheService.getActiveNiche();
  res.json({
    activeId: active.id,
    niches
  });
});

apiRouter.get('/niches/active', (req, res) => {
  const active = nicheService.getActiveNiche();
  res.json(active);
});

apiRouter.post('/niches/active', (req, res) => {
  const { id } = req.body;
  if (!id) {
    return res.status(400).json({ error: "O campo 'id' é obrigatório." });
  }
  try {
    const updated = nicheService.setActiveNiche(id);
    res.json({ message: `Nicho alterado para '${updated.name}' com sucesso!`, active: updated });
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

apiRouter.post('/niches', (req, res) => {
  try {
    const saved = nicheService.saveNiche(req.body);
    res.json({ message: 'Nicho salvo com sucesso!', niche: saved });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// --- Rotas de Atendimento & Sessões ---
apiRouter.get('/sessions', (req, res) => {
  const sessions = sessionService.listSessions();
  res.json(sessions);
});

apiRouter.get('/sessions/:phone', (req, res) => {
  const session = sessionService.getSession(req.params.phone);
  if (!session) {
    return res.status(404).json({ error: 'Sessão não encontrada.' });
  }
  res.json(session);
});

apiRouter.post('/sessions/:phone/status', (req, res) => {
  const { status } = req.body;
  if (!['bot', 'human', 'finished'].includes(status)) {
    return res.status(400).json({ error: 'Status inválido (use: bot, human ou finished).' });
  }
  const session = sessionService.setStatus(req.params.phone, status);
  res.json({ message: 'Status atualizado com sucesso.', session });
});

apiRouter.post('/sessions/:phone/message', async (req, res) => {
  const { text } = req.body;
  if (!text) {
    return res.status(400).json({ error: "O campo 'text' é obrigatório." });
  }
  const message = await whatsappService.sendManualAgentMessage(req.params.phone, text);
  res.json({ message: 'Mensagem enviada pelo atendente.', data: message });
});

apiRouter.delete('/sessions/:phone', (req, res) => {
  sessionService.clearSession(req.params.phone);
  res.json({ message: 'Sessão reiniciada com sucesso.' });
});

// --- Rota do Simulador Web (Testes Rápidos de WhatsApp) ---
apiRouter.post('/simulator/send', async (req, res) => {
  const { phone = '5511999998888', customerName = 'Você (Simulador)', text } = req.body;
  if (!text) {
    return res.status(400).json({ error: "O campo 'text' é obrigatório." });
  }

  const result = await whatsappService.handleIncomingMessage({
    phone,
    customerName,
    text,
    source: 'simulator'
  });

  res.json(result);
});
