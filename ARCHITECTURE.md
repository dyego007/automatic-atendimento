# 🏛️ Arquitetura do Sistema - AutoAtendimento Multi-Nicho

Este documento explica como o sistema foi concebido para permitir que qualquer empresa ou nicho (clínica odontológica, distribuidora de bebidas, imobiliária, etc.) utilize o mesmo motor de inteligência e atendimento.

---

## 📐 Diagrama de Fluxo e Componentes

```mermaid
flowchart TD
    subgraph Clientes["Entrada de Clientes"]
        WA[WhatsApp Real\nEvolution API / Z-API] -->|Webhook HTTP| Router[Servidor Express\n/webhook/whatsapp]
        Sim[Simulador Web WhatsApp\nInterface do Navegador] -->|API REST| RouterSim[Servidor Express\n/api/simulator/send]
    end

    subgraph Core["Motor de Atendimento"]
        Router --> ServiceWA[WhatsAppService]
        RouterSim --> ServiceWA
        
        ServiceWA --> Session[SessionService\nHistórico & Status Bot/Humano]
        
        Session -->|Se Status = 'bot'| Engine[AIService\nInjeção de Contexto]
        Session -->|Se Status = 'human'| Pause[Aguarda Atendente Humano]
        
        NicheMgr[NicheService\nGestor de Nichos] -->|Fornece Persona, Catálogo & FAQ| Engine
        
        Presets[(Presets de Nichos\nsrc/presets/*.json)] --> NicheMgr
    end

    subgraph IA["Camada de Inteligência"]
        Engine -->|Se configurado| OpenAI[OpenAI GPT-4o-mini]
        Engine -->|Se configurado| Gemini[Google Gemini 1.5 Flash]
        Engine -->|Padrão Offline| Mock[Motor Heurístico Local\nSem custo de API]
    end

    subgraph Painel["Dashboard de Gestão"]
        Web[Painel Web / Navegador\nhttp://localhost:3000] -->|Troca de Nicho Instantânea| NicheMgr
        Web -->|Transbordo & Mensagens Manuais| Session
    end
```

---

## 📁 Estrutura de Pastas

```text
automatic-atendimento/
├── public/                 # Painel Web & Simulador do WhatsApp
│   ├── index.html          # Interface do simulador e abas de gestão
│   └── app.js              # Lógica do chat, envio e chamadas de API
├── src/
│   ├── presets/            # Nichos pré-configurados em JSON
│   │   ├── dentista.json
│   │   ├── distribuidora.json
│   │   ├── imobiliaria.json
│   │   └── template_custom.json
│   ├── routes/
│   │   ├── api.ts          # Endpoints do simulador, nichos e sessões
│   │   └── webhook.ts      # Receptor de mensagens do WhatsApp real
│   ├── services/
│   │   ├── aiService.ts    # Montagem de prompts e inferência de IA
│   │   ├── nicheService.ts # Carregamento e troca de nicho ativo
│   │   ├── sessionService.ts # Gestão de conversas e transbordo humano
│   │   └── whatsappService.ts # Orquestrador de mensagens
│   └── server.ts           # Entrada principal da aplicação Express
├── package.json
├── tsconfig.json
├── .env.example
├── WORKFLOW.md             # Regras obrigatórias de Git para a equipe
└── README.md               # Guia de início rápido
```

---

## 🔌 Conexão com Provedores Reais de WhatsApp
O endpoint `POST /webhook/whatsapp` já está preparado para receber mensagens da:
1. **Evolution API**: Reconhece o evento `messages.upsert`.
2. **Z-API**: Reconhece payloads com `phone` e `text`.
3. **Meta WhatsApp Cloud API**: Suporta a verificação de handshake `hub.challenge`.
