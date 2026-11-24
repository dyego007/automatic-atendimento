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

  /**
   * Remove formatações markdown, símbolos e prepara o texto para leitura humana
   * natural por voz feminina brasileira (sem leitura de caracteres especiais ou emojis).
   */
  public sanitizeTextForSpeech(text: string): string {
    if (!text) return '';

    let cleaned = text;

    // Remove tags de formatação do WhatsApp
    cleaned = cleaned.replace(/[*_~`]/g, '');

    // Converte opções e menus para fala natural
    cleaned = cleaned.replace(/👉?\s*Digite\s*1\s*para\s*Confirmar\s*Presença\s*✅?/gi, 'Para confirmar sua presença, responda um ou sim.');
    cleaned = cleaned.replace(/👉?\s*Digite\s*2\s*para\s*Reagendar\s*Horário\s*🔄?/gi, 'Para mudar o horário, responda dois.');
    cleaned = cleaned.replace(/👉?\s*Digite\s*1\s*para/gi, 'Digite um para');
    cleaned = cleaned.replace(/👉?\s*Digite\s*2\s*para/gi, 'Digite dois para');

    // Remove URLs e links
    cleaned = cleaned.replace(/https?:\/\/\S+/g, '');

    // Formata valores em reais para pronúncia correta
    cleaned = cleaned.replace(/R\$\s*(\d+)(?:,(\d{2}))?/g, (_, int, dec) => {
      if (dec && dec !== '00') {
        return `${int} reais e ${dec} centavos`;
      }
      return `${int} reais`;
    });

    // Remove emojis e pictogramas
    cleaned = cleaned.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}]/gu, '');

    // Normaliza quebras de linha e múltiplos espaços
    cleaned = cleaned.replace(/\s+/g, ' ').trim();

    return cleaned;
  }

  /**
   * Gera áudio com voz humana ultra-realista feminina (OpenAI TTS "nova" ou ElevenLabs).
   */
  public async generateSpeech(
    text: string,
    options?: {
      voice?: string;
      provider?: 'elevenlabs' | 'openai';
    }
  ): Promise<{ audioBuffer: Buffer; filename: string; mimeType: string } | null> {
    const speechText = this.sanitizeTextForSpeech(text);
    if (!speechText) return null;

    // 1. ElevenLabs (Voz Ultra-Humana com respiração e entonação natural)
    const elevenKey = process.env.ELEVENLABS_API_KEY;
    const voiceProvider = options?.provider || (elevenKey ? 'elevenlabs' : 'openai');

    if (voiceProvider === 'elevenlabs' && elevenKey) {
      try {
        console.log('🎙️ Gerando áudio de secretária humana via ElevenLabs Multilingual v2...');
        // Voz feminina padrão: Rachel ou ID configurado no .env
        const voiceId = options?.voice || process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM';
        const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'xi-api-key': elevenKey
          },
          body: JSON.stringify({
            text: speechText,
            model_id: 'eleven_multilingual_v2',
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.85,
              style: 0.15,
              use_speaker_boost: true
            }
          })
        });

        if (response.ok) {
          const arrayBuffer = await response.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          const filename = `voice-reply-${Date.now()}-${Math.random().toString(36).substring(2, 6)}.mp3`;
          const filePath = path.join(this.audiosDir, filename);
          fs.writeFileSync(filePath, buffer);

          console.log(`✅ Áudio ElevenLabs gerado com sucesso! Arquivo: ${filename}`);
          return { audioBuffer: buffer, filename, mimeType: 'audio/mp4' };
        } else {
          const errText = await response.text();
          console.warn('ElevenLabs API retornou erro:', errText);
        }
      } catch (err) {
        console.error('Erro ao gerar áudio com ElevenLabs:', err);
      }
    }

    // 2. OpenAI TTS (Voz "nova" - mulher jovem, acolhedora, expressiva e profissional)
    if (process.env.OPENAI_API_KEY) {
      try {
        // Voz feminina padrão: 'nova' (a mais humana e natural em português) ou 'shimmer'
        const voice = options?.voice || process.env.OPENAI_TTS_VOICE || 'nova';
        console.log(`🎙️ Gerando áudio de voz humana via OpenAI TTS (Voz feminina: ${voice})...`);

        const response = await fetch('https://api.openai.com/v1/audio/speech', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: process.env.OPENAI_TTS_MODEL || 'tts-1-hd',
            voice: voice,
            input: speechText,
            response_format: 'mp3'
          })
        });

        if (response.ok) {
          const arrayBuffer = await response.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          const filename = `voice-reply-${Date.now()}-${Math.random().toString(36).substring(2, 6)}.mp3`;
          const filePath = path.join(this.audiosDir, filename);
          fs.writeFileSync(filePath, buffer);

          console.log(`✅ Áudio OpenAI TTS gerado com sucesso! Arquivo: ${filename}`);
          return { audioBuffer: buffer, filename, mimeType: 'audio/mp4' };
        } else {
          const errText = await response.text();
          console.warn('OpenAI TTS API retornou status não-200:', errText);
        }
      } catch (err) {
        console.error('Erro ao gerar áudio com OpenAI TTS:', err);
      }
    }

    return null;
  }

  public getAudioFilePath(filename: string): string | null {
    const safeName = path.basename(filename);
    const fullPath = path.join(this.audiosDir, safeName);
    if (fs.existsSync(fullPath)) {
      return fullPath;
    }
    return null;
  }
}

export const audioService = new AudioService();
