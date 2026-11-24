import { Router } from 'express';
import { whatsappService } from '../services/whatsappService.js';

export const webhookRouter = Router();

// Endpoint unificado para Webhooks de WhatsApp
webhookRouter.post('/whatsapp', async (req, res) => {
  try {
    const body = req.body;

    // 1. Padrão Evolution API
    if (body.event === 'messages.upsert' && body.data) {
      const messageData = body.data;
      if (messageData.key?.fromMe) {
        return res.status(200).json({ status: 'ignored_from_me' });
      }

      const phone = messageData.key?.remoteJid?.replace('@s.whatsapp.net', '') || '';
      const text =
        messageData.message?.conversation ||
        messageData.message?.extendedTextMessage?.text ||
        '';
      const customerName = messageData.pushName || 'Cliente WhatsApp';

      if (phone && text) {
        await whatsappService.handleIncomingMessage({
          phone,
          customerName,
          text,
          source: 'evolution'
        });
      }
      return res.status(200).json({ status: 'success' });
    }

    // 2. Padrão Z-API ou Genérico
    const phone = body.phone || body.from || body.sender;
    const text = body.text || body.message || body.body;
    const customerName = body.senderName || body.name || 'Cliente';

    if (phone && text) {
      await whatsappService.handleIncomingMessage({
        phone: String(phone),
        customerName,
        text: String(text),
        source: 'zapi'
      });
      return res.status(200).json({ status: 'success' });
    }

    // Retorno padrão para handshakes/verificações
    res.status(200).json({ status: 'received', message: 'Payload aceito' });
  } catch (err: any) {
    console.error('Erro no processamento do webhook:', err);
    res.status(500).json({ error: err.message });
  }
});

// Verificação GET (necessária para Meta Cloud API)
webhookRouter.get('/whatsapp', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === (process.env.WEBHOOK_VERIFY_TOKEN || 'automatic123')) {
    return res.status(200).send(challenge);
  }
  res.status(200).json({ status: 'online', service: 'Automatic Atendimento Webhook' });
});
