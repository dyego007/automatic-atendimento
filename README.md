# 🤖 AutoAtendimento WhatsApp Multi-Nicho

Sistema inteligente e modular de atendimento automatizado via **WhatsApp**, projetado para operar em **qualquer nicho de mercado** (consultório odontológico, distribuidora de bebidas, imobiliária, pet shop, restaurantes, etc.) bastando alterar uma configuração simples ou alternar o nicho ativo pelo painel web.

---

## ✨ Principais Funcionalidades

- 📲 **Conexão Real por QR Code (Baileys Nativo)**: Escaneie o QR Code na tela pelo aplicativo do WhatsApp do seu celular (*Aparelhos Conectados*) e comece a atender contatos reais imediatamente!
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
