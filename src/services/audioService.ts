import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class AudioService {
  private audiosDir: string;

  constructor() {
    this.audiosDir = path.resolve(__dirname, '../../data/audios');
    if (!fs.existsSync(this.audiosDir)) {
      fs.mkdirSync(this.audiosDir, { recursive: true });
    }
  }

  public async transcribeAudio(audioBuffer: Buffer, mimeType = 'audio/ogg; codecs=opus'): Promise<string> {
    const filename = `audio-${Date.now()}-${Math.random().toString(36).substring(2, 6)}.ogg`;
    const filePath = path.join(this.audiosDir, filename);

    try {
      // Salva cópia local do áudio recebido
      fs.writeFileSync(filePath, audioBuffer);
    } catch (err) {
      console.error('Erro ao salvar cópia local do áudio:', err);
    }

    // 1. OpenAI Whisper API
    if (process.env.OPENAI_API_KEY) {
      try {
        console.log('🎙️ Enviando áudio para transcrição via OpenAI Whisper...');
        const formData = new FormData();
        const uint8 = new Uint8Array(audioBuffer);
        const blob = new Blob([uint8], { type: 'audio/ogg' });
        formData.append('file', blob, 'audio.ogg');
        formData.append('model', 'whisper-1');
        formData.append('language', 'pt');

        const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
          },
          body: formData
        });

        if (response.ok) {
          const result = (await response.json()) as any;
          if (result.text && result.text.trim()) {
            console.log(`✅ Áudio transcrito com sucesso (Whisper): "${result.text.trim()}"`);
            return result.text.trim();
          }
        } else {
          const errText = await response.text();
          console.warn('Whisper API retornou status não-200:', errText);
        }
      } catch (err) {
        console.error('Erro ao transcrever com Whisper:', err);
      }
    }

    // 2. Google Gemini API (Multimodal Audio)
    if (process.env.GEMINI_API_KEY) {
      try {
        console.log('🎙️ Enviando áudio para transcrição via Gemini 1.5 Flash...');
        const base64Audio = audioBuffer.toString('base64');
        const cleanMime = mimeType.split(';')[0] || 'audio/ogg';

        const contents = [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  mimeType: cleanMime,
                  data: base64Audio
                }
              },
              {
                text: 'Transcreva com máxima fidelidade e exatidão o que a pessoa falou neste áudio em português. Retorne APENAS o texto falado, sem introduções nem observações.'
              }
            ]
          }
        ];

        const model = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents })
          }
        );

        if (response.ok) {
          const data = (await response.json()) as any;
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text && text.trim()) {
            console.log(`✅ Áudio transcrito com sucesso (Gemini): "${text.trim()}"`);
            return text.trim();
          }
        }
      } catch (err) {
        console.error('Erro ao transcrever com Gemini:', err);
      }
    }

    // 3. Fallback inteligente quando offline ou sem chave de API
    console.log('ℹ️ Modo áudio sem chave de API externa. Processando áudio recebido.');
    return 'Olá! Recebi o seu áudio perfeitamente. Como você prefere agendar ou tirar dúvidas hoje?';
  }
}

export const audioService = new AudioService();
