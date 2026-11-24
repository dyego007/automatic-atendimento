import test from 'node:test';
import assert from 'node:assert/strict';
import { audioService } from '../src/services/audioService.js';
import { whatsappService } from '../src/services/whatsappService.js';

test('AudioService: sanitizeTextForSpeech limpa emojis, markdown e formata fala natural de secretária', () => {
  const input = 'Olá! *Dra. Ana* atende amanhã às 14:00 🦷. Valor: R$ 150,00. 👉 Digite 1 para Confirmar Presença ✅ ou acesse https://site.com';
  const sanitized = audioService.sanitizeTextForSpeech(input);

  // Não deve conter markdown nem emojis
  assert.ok(!sanitized.includes('*'));
  assert.ok(!sanitized.includes('🦷'));
  assert.ok(!sanitized.includes('✅'));
  assert.ok(!sanitized.includes('https://'));

  // Deve ter transformado o valor monetário
  assert.ok(sanitized.includes('150 reais'));

  // Deve ter transformado a opção em fala humana
  assert.ok(sanitized.includes('Para confirmar sua presença, responda um ou sim'));
});

test('AudioService: sanitizeTextForSpeech trata strings vazias e especiais', () => {
  assert.equal(audioService.sanitizeTextForSpeech(''), '');
  assert.equal(audioService.sanitizeTextForSpeech('   '), '');
});

test('WhatsAppService: fluxo com áudio recebido gera resposta contextual', async () => {
  const result = await whatsappService.handleIncomingMessage({
    storeId: 'loja-1',
    phone: '551199998855',
    customerName: 'Cliente Áudio',
    text: '🎙️ [Áudio]: "Olá, gostaria de saber se vocês atendem clareamento dental e qual o horário"',
    isAudio: true,
    source: 'simulator'
  });

  assert.ok(result.session);
  assert.ok(result.replyMessage?.text);
  assert.equal(result.session.messages.length >= 2, true);
});
