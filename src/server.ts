import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { apiRouter } from './routes/api.js';
import { webhookRouter } from './routes/webhook.js';
import { nicheService } from './services/nicheService.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir frontend / dashboard
const publicPath = path.resolve(__dirname, '../public');
app.use(express.static(publicPath));

// Rotas da aplicação
app.use('/api', apiRouter);
app.use('/webhook', webhookRouter);

// Fallback SPA
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/webhook')) {
    return next();
  }
  res.sendFile(path.join(publicPath, 'index.html'));
});

app.listen(PORT, () => {
  const activeNiche = nicheService.getActiveNiche();
  console.log('====================================================');
  console.log(`🤖 AUTOMATIC-ATENDIMENTO INICIADO COM SUCESSO!`);
  console.log(`🚀 Painel & Simulador Web: http://localhost:${PORT}`);
  console.log(`🎯 Nicho Ativo: ${activeNiche.name} (${activeNiche.category})`);
  console.log(`🔗 Webhook WhatsApp: http://localhost:${PORT}/webhook/whatsapp`);
  console.log('====================================================');
});
