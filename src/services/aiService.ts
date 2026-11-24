import { NicheConfig } from './nicheService.js';
import { ChatMessage } from './sessionService.js';

export class AIService {
  public buildSystemPrompt(niche: NicheConfig): string {
    let prompt = `Você é ${niche.persona.agentName}, assistente virtual de atendimento da empresa "${niche.name}".
Segmento / Nicho: ${niche.category}
Tom de voz: ${niche.persona.tone}

INSTRUÇÕES GERAIS:
${niche.persona.instructions}

DADOS DA EMPRESA:
- Horário de Funcionamento: ${niche.businessInfo.hours}
- Endereço / Localização: ${niche.businessInfo.address}
- Telefone / Contato: ${niche.businessInfo.phone}
${niche.businessInfo.paymentMethods ? `- Formas de Pagamento: ${niche.businessInfo.paymentMethods}` : ''}
${niche.businessInfo.deliveryRules ? `- Regras de Entrega: ${niche.businessInfo.deliveryRules}` : ''}
`;

    if (niche.agreements && niche.agreements.length > 0) {
      prompt += `\nCONVÊNIOS ACEITOS:\n${niche.agreements.map(a => `- ${a}`).join('\n')}\n`;
    }

    if (niche.services && niche.services.length > 0) {
      prompt += `\nCATÁLOGO DE SERVIÇOS:\n${niche.services
        .map(s => `- ${s.name}: ${s.price} ${s.duration ? `(${s.duration})` : ''} - ${s.description || ''}`)
        .join('\n')}\n`;
    }

    if (niche.products && niche.products.length > 0) {
      prompt += `\nCATÁLOGO DE PRODUTOS:\n${niche.products
        .map(p => `- ${p.name}: ${p.price} ${p.status ? `[${p.status}]` : ''}`)
        .join('\n')}\n`;
    }

    if (niche.faq && niche.faq.length > 0) {
      prompt += `\nPERGUNTAS FREQUENTES (FAQ):\n${niche.faq
        .map(f => `P: ${f.question}\nR: ${f.answer}`)
        .join('\n')}\n`;
    }

    prompt += `
DIRETRIZES DE RESPOSTA NO WHATSAPP:
- Responda em português de forma natural, ágil e concisa (máximo 2 a 3 parágrafos curtos).
- Use formatações leves do WhatsApp (*negrito*, quebras de linha com emojis amigáveis).
- Nunca invente preços ou dados que não estejam neste documento. Se não souber, pergunte ou ofereça transferir para um atendente humano.
`;

    return prompt;
  }

  public async generateReply(
    incomingText: string,
    history: ChatMessage[],
    niche: NicheConfig
  ): Promise<string> {
    const provider = process.env.AI_PROVIDER || 'mock';

    if (provider === 'openai' && process.env.OPENAI_API_KEY) {
      return this.callOpenAI(incomingText, history, niche);
    }

    if (provider === 'gemini' && process.env.GEMINI_API_KEY) {
      return this.callGemini(incomingText, history, niche);
    }

    // Provedor Mock Inteligente baseado em Contexto & Regras do Nicho
    return this.mockSmartReply(incomingText, niche);
  }

  private async callOpenAI(incomingText: string, history: ChatMessage[], niche: NicheConfig): Promise<string> {
    try {
      const systemPrompt = this.buildSystemPrompt(niche);
      const messages = [
        { role: 'system', content: systemPrompt },
        ...history.slice(-6).map(m => ({
          role: m.sender === 'customer' ? 'user' : 'assistant',
          content: m.text
        })),
        { role: 'user', content: incomingText }
      ];

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
          messages,
          temperature: 0.7
        })
      });

      const data = (await response.json()) as any;
      if (data.choices && data.choices[0]?.message?.content) {
        return data.choices[0].message.content.trim();
      }
      return this.mockSmartReply(incomingText, niche);
    } catch (err) {
      console.error('Erro na chamada OpenAI, usando fallback inteligente:', err);
      return this.mockSmartReply(incomingText, niche);
    }
  }

  private async callGemini(incomingText: string, history: ChatMessage[], niche: NicheConfig): Promise<string> {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      const model = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
      const systemPrompt = this.buildSystemPrompt(niche);

      const contents = [
        { role: 'user', parts: [{ text: `${systemPrompt}\n\nO cliente disse: "${incomingText}"` }] }
      ];

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents })
        }
      );

      const data = (await response.json()) as any;
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) return text.trim();
      return this.mockSmartReply(incomingText, niche);
    } catch (err) {
      console.error('Erro na chamada Gemini, usando fallback inteligente:', err);
      return this.mockSmartReply(incomingText, niche);
    }
  }

  private mockSmartReply(input: string, niche: NicheConfig): string {
    const text = input.toLowerCase().trim();
    const name = niche.persona.agentName;

    // Saudação inicial
    if (/^(oi|olá|ola|bom dia|boa tarde|boa noite|opa|eai|hey)/i.test(text)) {
      return (
        `Olá! Tudo bem? 😊\n\n` +
        `Eu sou a(o) *${name}*, assistente virtual da *${niche.name}*.\n` +
        `Como posso te ajudar hoje?\n\n` +
        `Você pode me perguntar sobre nossos serviços/produtos, horários, endereço ou solicitar um atendimento!`
      );
    }

    // Horários e Funcionamento
    if (text.includes('horario') || text.includes('horário') || text.includes('aberto') || text.includes('funciona') || text.includes('fecha')) {
      return `⏰ *Nosso Horário de Funcionamento:*\n${niche.businessInfo.hours}\n\nPodemos te ajudar com algo mais?`;
    }

    // Localização / Endereço
    if (text.includes('onde') || text.includes('endereco') || text.includes('endereço') || text.includes('fica') || text.includes('local')) {
      return `📍 *Nosso Endereço:*\n${niche.businessInfo.address}\n\nCaso precise de pontos de referência, é só avisar!`;
    }

    // Preços / Serviços / Cardápio / Catálogo
    if (text.includes('preco') || text.includes('preço') || text.includes('quanto') || text.includes('cardapio') || text.includes('cardápio') || text.includes('catalogo') || text.includes('catálogo') || text.includes('servico') || text.includes('serviço') || text.includes('produto')) {
      if (niche.services && niche.services.length > 0) {
        const items = niche.services.map(s => `• *${s.name}*: ${s.price} (${s.description || ''})`).join('\n');
        return `📋 *Confira nossos principais serviços:*\n\n${items}\n\nQual deles você gostaria de saber mais ou agendar?`;
      }
      if (niche.products && niche.products.length > 0) {
        const items = niche.products.map(p => `• *${p.name}*: ${p.price}`).join('\n');
        return `🍻 *Confira nossos principais produtos disponíveis:*\n\n${items}\n\nQuantos você gostaria de pedir? Entregamos rapidinho! 🚀`;
      }
    }

    // Formas de Pagamento
    if (text.includes('pagamento') || text.includes('pagar') || text.includes('cartao') || text.includes('cartão') || text.includes('pix') || text.includes('convenio') || text.includes('convênio')) {
      let reply = `💳 *Formas de Pagamento Aceitas:*\n${niche.businessInfo.paymentMethods || 'Pix, Dinheiro e Cartões'}`;
      if (niche.agreements && niche.agreements.length > 0) {
        reply += `\n\n🩺 *Convênios aceitos:* ${niche.agreements.join(', ')}`;
      }
      return reply;
    }

    // Pedido ou Agendamento
    if (text.includes('agendar') || text.includes('marcar') || text.includes('comprar') || text.includes('pedir') || text.includes('pedido') || text.includes('entrega')) {
      if (niche.id === 'dentista') {
        return `📅 Perfeito! Para agendarmos sua avaliação, por favor me informe:\n1. Seu *Nome Completo*\n2. Melhor dia (ex: Segunda ou Terça)\n3. Período preferido (*Manhã* ou *Tarde*)\n\nAssim já consulto a agenda dos nossos dentistas! ✨`;
      }
      if (niche.id === 'distribuidora') {
        return `🛵 Show de bola! Para agilizar seu pedido:\n1. Quais os itens e quantidades?\n2. Qual o endereço de entrega (Rua, Número e Bairro)?\n3. Qual a forma de pagamento (Pix, Cartão ou Dinheiro)?\n\nAssim que você me mandar, já separamos tudo geladinho! 🧊`;
      }
      return `Perfeito! Me informe seu nome e detalhes do que você precisa que já daremos andamento no seu atendimento! 🚀`;
    }

    // Atendente humano
    if (text.includes('humano') || text.includes('atendente') || text.includes('pessoa') || text.includes('falar com alguem') || text.includes('falar com alguém')) {
      return `Entendido! Estou transferindo o seu chamado para um de nossos atendentes humanos da equipe da *${niche.name}*. Um momento, por favor! ⏳`;
    }

    // Resposta padrão contextual
    return (
      `Obrigado pela sua mensagem! 😊\n\n` +
      `Aqui na *${niche.name}*, nós podemos te ajudar com informações sobre nossos valores, horários e atendimento.\n` +
      `Se desejar, digite *'serviços'*, *'horário'*, *'endereço'* ou *'falar com atendente'*!`
    );
  }
}

export const aiService = new AIService();
