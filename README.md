# 🤖 AutoAtendimento WhatsApp Multi-Nicho

Sistema inteligente e modular de atendimento automatizado via **WhatsApp**, projetado para operar em **qualquer nicho de mercado** (consultório odontológico, distribuidora de bebidas, imobiliária, pet shop, restaurantes, etc.) bastando alterar uma configuração simples ou alternar o nicho ativo pelo painel web.

---

## ✨ Principais Funcionalidades

- 🔒 **Sistema de Login & Controle de Acesso (RBAC)**: Autenticação com perfis separados: **Administrador do SaaS** (gerencia todas as lojas, clientes e nichos) e **Secretária/Atendente** (acesso restrito apenas à loja/clínica dele, sem ver dados de outros clientes).
- 🔔 **Lembretes Automáticos de Agendamento (Anti-Faltas)**: O robô envia lembrete no WhatsApp do cliente 24h e 2h antes da consulta. O paciente pode responder **1 para Confirmar** (a consulta fica verde/confirmada na hora) ou **2 para Reagendar** (a IA já oferece novos horários disponíveis). Também inclui botão no painel para disparo manual imediato!
- 🔊 **Alertas Sonoros & Notificações de Transbordo**: Notificações sonoras no painel (Web Audio API) ao receber novas mensagens e alerta visual piscante com aviso sonoro sempre que um cliente solicita atendimento humano, com botão "Atender Agora".
- 🎙️ **Compreensão de Áudios no WhatsApp**: Suporte nativo para mensagens de voz. O sistema transcreve o áudio do cliente (OpenAI Whisper ou Gemini 1.5 Flash) e a IA responde no contexto falado!
- 🗣️ **Resposta em Áudio com Voz Humana de Secretária (Text-to-Speech)**: Quando o cliente manda áudio, a IA responde também com nota de voz gravada na hora (**PTT com microfone verde no WhatsApp**). Utiliza síntese ultra-humana de alta qualidade (OpenAI TTS voz feminina `nova` ou ElevenLabs Multilingual), sanitizando emojis e símbolos para soar como uma secretária real falando, com player de áudio integrado no Live Chat e no Simulador!
- 📅 **Gestão de Agendamentos & Clínica**: Agenda completa de consultas estilo **Outlook / Teams**, cálculo automático de horários vagos, controle de status (*Confirmado, Pendente, Cancelado, Realizado*) e cadastro de horários de abertura, fechamento e almoço.
- 🩺 **Catálogo de Procedimentos & Preços**: Cadastre serviços com valor, duração estimada e orientações. A IA consulta esse catálogo em tempo real para responder aos pacientes no WhatsApp.
- 🏢 **Multi-Lojas / Multi-Comércios (Multi-Tenancy)**: Cadastre quantos comércios e clientes você quiser! Cada loja tem seu próprio número de WhatsApp, seu próprio QR Code isolado e seu catálogo de produtos e serviços.
- 📲 **Conexão Real por QR Code (Baileys Multi-Instâncias)**: Escaneie o QR Code individual de cada loja pelo WhatsApp de cada aparelho (*Aparelhos Conectados*) para ativar o robô naquele número específico.
- 📊 **Painel SaaS Moderno & Intuitivo**: Dashboard profissional com métricas em tempo real, status da conexão, conversas ativas e transbordo.
- 💬 **Live Chat (Estilo WhatsApp Web)**: Visualize todas as conversas recebidas pelo robô e assuma o atendimento humano com 1 clique quando necessário.
- 🔄 **Multi-Nicho Instantâneo**: Alterne entre **Dentista**, **Distribuidora**, **Imobiliária** ou crie seu próprio nicho com 1 clique.
- 📱 **Simulador Web Embutido**: Teste o comportamento do robô diretamente no seu navegador, sem precisar de celular.
- 🧠 **Motor de IA Flexível**:
  - Funciona imediatamente em modo **Offline/Mock Inteligente** (sem custo e sem necessidade de chaves de API).
  - Suporte nativo para **OpenAI** (GPT-4o-mini) e **Google Gemini**.
- 🔌 **Compatibilidade Híbrida**: Além da conexão direta via QR Code, também suporta Webhooks da **Evolution API**, **Z-API** e **WhatsApp Cloud API**.

---

## 🚀 Como Rodar o Projeto

### 1. Clonar e Instalar as Dependências
```bash
# Clone o repositório
git clone https://github.com/dyego007/automatic-atendimento.git
cd automatic-atendimento

# Instale os pacotes necessários
npm install
```

### 2. Iniciar em Modo de Desenvolvimento
```bash
npm run dev
```

Abra o seu navegador em:
👉 **[http://localhost:3000](http://localhost:3000)**

---

## 🎯 Nichos Pré-Configurados

Os nichos ficam salvos em arquivos JSON dentro de `src/presets/`:

| Nicho | Empresa Exemplo | Persona | Especialidade |
| :--- | :--- | :--- | :--- |
| **Dentista** | Clínica OdontoVida | Sofia | Agendamento de consultas, triagem de urgência, valores e convênios |
| **Distribuidora** | Disk Bebidas Express | Beto | Catálogo de bebidas geladas, gelo, carvão, pedido mínimo e delivery |
| **Imobiliária** | Nova Morada Imóveis | Lucas | Aluguel sem fiador, venda, agendamento de visitas com corretores |
| **Custom** | *Sua Empresa* | - | Modelo pronto em `template_custom.json` para qualquer negócio |

---

## 🤝 Fluxo de Trabalho em Equipe (Dyego & Amigo)

Para que ambos possam codificar e evoluir o sistema sem gerar conflitos ou quebrar o código:
1. **Antes de codificar**: sempre execute `git pull origin main`.
2. **Após codificar**: sempre execute `git pull`, `git add .`, `git commit` e `git push origin main`.
3. Veja o documento completo em [`WORKFLOW.md`](./WORKFLOW.md) e a arquitetura detalhada em [`ARCHITECTURE.md`](./ARCHITECTURE.md).


## Disponibilidade por data no WhatsApp

Selecione a loja e abra **Disponibilidade por dia**. Escolha a data e salve apenas os horários oferecidos (`HH:MM`, separados por vírgula ou linha). Para disponibilizar somente 13h, cadastre `13:00`. Salvar uma lista vazia fecha aquele dia. Sem um cadastro específico, a grade semanal de **Agendamentos** continua valendo, respeitando os dias de atendimento e desconsiderando horários passados no fuso de Brasília.

O robô confirma a data completa, mostra as vagas livres, pede a escolha de horário e exige confirmação final antes de reservar. Na confirmação ele verifica a disponibilidade novamente. O fluxo é determinístico, anterior ao provedor de IA, e funciona também no modo mock. Está ativo em dentista/imobiliária e nas demais lojas com disponibilidade por dia cadastrada.

As reservas usam o mesmo `appointmentService` da gestão existente: consultas cadastradas pelo painel bloqueiam a vaga no bot, e reservas do bot aparecem em **Agendamentos**. Cancelamentos pelo painel liberam a vaga. Os horários específicos ficam em `data/appointments.json` (ignorado pelo Git); as consultas seguem o armazenamento já utilizado pela agenda existente. Não há sincronização com agenda externa nem coordenação entre múltiplas instâncias. Cada horário representa uma vaga, sem cálculo de sobreposição por duração ou profissional.

Verificações: `node --import tsx --test tests/appointment.test.ts`, `npm run build`, `node --check public/agenda.js` e `node --check public/app.js`.
