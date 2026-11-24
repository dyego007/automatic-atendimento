let currentNiche = null;
let currentPhone = '5511999998888';
let selectedChatPhone = null;
let pollInterval = null;

// Inicialização
document.addEventListener('DOMContentLoaded', async () => {
  await loadNiches();
  await checkWhatsAppStatus();
  await loadStats();
  await loadSimulatorChat();

  // Polling regular para status do WhatsApp e Métricas
  pollInterval = setInterval(async () => {
    await checkWhatsAppStatus();
    await loadStats();
    if (document.getElementById('tab-livechat').classList.contains('hidden') === false) {
      await loadLiveSessions(false);
      if (selectedChatPhone) {
        await loadActiveChatMessages(selectedChatPhone);
      }
    }
  }, 2500);
});

// Navegação de Abas
function switchTab(tabId) {
  const tabs = ['dashboard', 'livechat', 'simulator', 'niches'];
  const titles = {
    dashboard: '<i class="fas fa-qrcode text-emerald-400"></i> Conexão WhatsApp & Visão Geral',
    livechat: '<i class="fas fa-comments text-emerald-400"></i> Conversas ao Vivo (WhatsApp Web)',
    simulator: '<i class="fas fa-mobile-alt text-emerald-400"></i> Simulador Virtual de Testes',
    niches: '<i class="fas fa-layer-group text-emerald-400"></i> Gerenciador de Nichos & Regras'
  };

  tabs.forEach(t => {
    const el = document.getElementById(`tab-${t}`);
    const btn = document.getElementById(`navBtn-${t}`);
    if (t === tabId) {
      el.classList.remove('hidden');
      btn.className = 'w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 transition-all';
    } else {
      el.classList.add('hidden');
      btn.className = 'w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-900 transition-all';
    }
  });

  document.getElementById('pageTitle').innerHTML = titles[tabId];

  if (tabId === 'livechat') {
    loadLiveSessions(true);
  }
}

// -------------------------------------------------------------
// CONEXÃO WHATSAPP REAL (BAILEYS / QR CODE)
// -------------------------------------------------------------
async function checkWhatsAppStatus() {
  try {
    const res = await fetch('/api/whatsapp/status');
    const data = await res.json();

    const qrContainer = document.getElementById('qrCodeContainer');
    const sideBadge = document.getElementById('sideWaStatusBadge');
    const sidePhone = document.getElementById('sideWaPhone');
    const topBadge = document.getElementById('waStatusBadgeTop');
    const btnConnect = document.getElementById('btnConnectWa');
    const btnDisconnect = document.getElementById('btnDisconnectWa');

    if (data.status === 'connected') {
      // Conectado com Sucesso
      sideBadge.innerHTML = '<span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span> Conectado';
      sideBadge.className = 'inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-400';
      sidePhone.textContent = data.user?.phone ? `+${data.user.phone}` : 'WhatsApp Online';

      topBadge.innerHTML = '<span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span> Conectado com Sucesso';
      topBadge.className = 'px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5';

      btnConnect.classList.add('hidden');
      btnDisconnect.classList.remove('hidden');

      qrContainer.innerHTML = `
        <div class="text-center p-4">
          <div class="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-3xl mx-auto mb-3 shadow-lg shadow-emerald-500/20">
            <i class="fas fa-check"></i>
          </div>
          <h4 class="font-bold text-slate-800 text-sm">WhatsApp Conectado!</h4>
          <p class="text-xs text-slate-500 mt-1">Número: +${data.user?.phone || ''}</p>
          <span class="inline-block mt-3 px-3 py-1 bg-emerald-100 text-emerald-800 text-[11px] font-semibold rounded-full">
            Robô IA Ativo e Respondendo
          </span>
        </div>
      `;
    } else if (data.status === 'connecting') {
      // Gerando / Aguardando leitura do QR Code
      sideBadge.innerHTML = '<span class="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span> Aguardando Leitura';
      sideBadge.className = 'inline-flex items-center gap-1.5 text-[11px] font-semibold text-amber-400';
      sidePhone.textContent = 'Escaneie o QR Code';

      topBadge.innerHTML = '<span class="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span> Aguardando Leitura';
      topBadge.className = 'px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1.5';

      btnConnect.classList.remove('hidden');
      btnDisconnect.classList.add('hidden');

      if (data.qr) {
        qrContainer.innerHTML = `
          <img src="${data.qr}" alt="QR Code WhatsApp" class="w-full h-full object-contain rounded-xl" />
        `;
      } else {
        qrContainer.innerHTML = `
          <div class="text-center p-4 text-slate-500">
            <i class="fas fa-spinner fa-spin text-3xl text-emerald-500 mb-2"></i>
            <p class="text-xs">Gerando QR Code...</p>
          </div>
        `;
      }
    } else {
      // Desconectado
      sideBadge.innerHTML = '<span class="w-2 h-2 rounded-full bg-rose-500"></span> Desconectado';
      sideBadge.className = 'inline-flex items-center gap-1.5 text-[11px] font-semibold text-rose-400';
      sidePhone.textContent = 'Nenhum aparelho';

      topBadge.innerHTML = '<span class="w-2 h-2 rounded-full bg-rose-500"></span> Desconectado';
      topBadge.className = 'px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center gap-1.5';

      btnConnect.classList.remove('hidden');
      btnDisconnect.classList.add('hidden');

      qrContainer.innerHTML = `
        <div class="text-center p-4">
          <i class="fas fa-qrcode text-5xl text-slate-300 mb-2"></i>
          <p class="text-xs text-slate-500 font-medium">Clique no botão para gerar o QR Code de leitura.</p>
        </div>
      `;
    }
  } catch (err) {
    console.error('Erro ao verificar status do WhatsApp:', err);
  }
}

async function connectWhatsApp() {
  try {
    const qrContainer = document.getElementById('qrCodeContainer');
    qrContainer.innerHTML = `
      <div class="text-center p-4 text-slate-500">
        <i class="fas fa-spinner fa-spin text-3xl text-emerald-500 mb-2"></i>
        <p class="text-xs font-semibold mt-2">Iniciando serviço e gerando QR Code...</p>
      </div>
    `;
    await fetch('/api/whatsapp/connect', { method: 'POST' });
    setTimeout(checkWhatsAppStatus, 1500);
  } catch (err) {
    alert('Erro ao conectar: ' + err.message);
  }
}

async function disconnectWhatsApp() {
  if (!confirm('Deseja realmente desconectar este WhatsApp?')) return;
  try {
    await fetch('/api/whatsapp/disconnect', { method: 'POST' });
    await checkWhatsAppStatus();
  } catch (err) {
    alert('Erro ao desconectar: ' + err.message);
  }
}

// -------------------------------------------------------------
// MÉTRICAS E ESTATÍSTICAS
// -------------------------------------------------------------
async function loadStats() {
  try {
    const res = await fetch('/api/stats');
    const stats = await res.json();
    document.getElementById('statTotal').textContent = stats.totalSessions || 0;
    document.getElementById('statBot').textContent = stats.botActive || 0;
    document.getElementById('statHuman').textContent = stats.humanTakeover || 0;
    document.getElementById('statMessages').textContent = stats.totalMessages || 0;

    const unread = document.getElementById('unreadBadge');
    if (stats.humanTakeover > 0) {
      unread.textContent = stats.humanTakeover;
      unread.classList.remove('hidden');
    } else {
      unread.classList.add('hidden');
    }
  } catch (e) {
    // Silencia erros de polling
  }
}

// -------------------------------------------------------------
// GESTÃO DE NICHOS
// -------------------------------------------------------------
async function loadNiches() {
  try {
    const res = await fetch('/api/niches');
    const data = await res.json();

    const selector = document.getElementById('globalNicheSelect');
    selector.innerHTML = '';

    data.niches.forEach(n => {
      const opt = document.createElement('option');
      opt.value = n.id;
      opt.textContent = `${n.name} (${n.category})`;
      if (n.id === data.activeId) {
        opt.selected = true;
      }
      selector.appendChild(opt);
    });

    const activeRes = await fetch('/api/niches/active');
    currentNiche = await activeRes.json();
    renderNicheDetails(currentNiche);
  } catch (err) {
    console.error('Erro ao carregar nichos:', err);
  }
}

async function changeActiveNiche(id) {
  try {
    const res = await fetch('/api/niches/active', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    });
    const data = await res.json();
    currentNiche = data.active;
    renderNicheDetails(currentNiche);
  } catch (err) {
    alert('Erro ao alterar nicho: ' + err.message);
  }
}

function renderNicheDetails(niche) {
  document.getElementById('dashNicheName').textContent = niche.name;
  document.getElementById('dashNicheCategory').textContent = niche.category;
  document.getElementById('dashNicheId').textContent = `id: ${niche.id}`;
  document.getElementById('dashNicheDesc').textContent = niche.description;
  document.getElementById('dashAgentName').textContent = niche.persona.agentName;
  document.getElementById('dashHours').textContent = niche.businessInfo.hours;
  document.getElementById('simHeaderTitle').textContent = `${niche.name} (${niche.persona.agentName})`;

  // Preenche formulário de edição
  document.getElementById('cfgId').value = niche.id;
  document.getElementById('cfgName').value = niche.name;
  document.getElementById('cfgCategory').value = niche.category;
  document.getElementById('cfgInstructions').value = niche.persona.instructions;
  document.getElementById('cfgRawJson').value = JSON.stringify(niche, null, 2);
}

async function saveNicheConfig(e) {
  e.preventDefault();
  try {
    const raw = JSON.parse(document.getElementById('cfgRawJson').value);
    raw.id = document.getElementById('cfgId').value.trim();
    raw.name = document.getElementById('cfgName').value.trim();
    raw.category = document.getElementById('cfgCategory').value.trim();
    raw.persona.instructions = document.getElementById('cfgInstructions').value.trim();

    await fetch('/api/niches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(raw)
    });
    alert('Nicho salvo com sucesso!');
    await loadNiches();
  } catch (err) {
    alert('Erro ao salvar (verifique o JSON): ' + err.message);
  }
}

function createNewNicheTemplate() {
  document.getElementById('cfgId').value = 'novo_nicho';
  document.getElementById('cfgName').value = 'Nova Empresa Exemplo';
  document.getElementById('cfgCategory').value = 'Serviços Gerais';
  document.getElementById('cfgInstructions').value = 'Você é o assistente virtual da Nova Empresa...';
}

// -------------------------------------------------------------
// CONVERSAS AO VIVO (WHATSAPP WEB EXPERIENCE)
// -------------------------------------------------------------
async function loadLiveSessions(selectFirst = false) {
  try {
    const res = await fetch('/api/sessions');
    const sessions = await res.json();
    const list = document.getElementById('chatListContainer');

    if (!sessions || sessions.length === 0) {
      list.innerHTML = '<div class="text-center py-12 text-slate-500 text-xs">Nenhum contato registrado ainda.</div>';
      return;
    }

    list.innerHTML = '';
    sessions.forEach((s, idx) => {
      const item = document.createElement('div');
      const isSelected = selectedChatPhone === s.phone;
      item.className = `p-3.5 cursor-pointer transition flex items-center justify-between gap-3 ${
        isSelected ? 'bg-slate-900 border-l-4 border-emerald-500' : 'hover:bg-slate-900/60'
      }`;

      const lastMsg = s.messages.length > 0 ? s.messages[s.messages.length - 1].text : 'Conversa iniciada';
      const isHuman = s.status === 'human';

      item.onclick = () => selectLiveChat(s.phone);

      item.innerHTML = `
        <div class="flex items-center gap-3 overflow-hidden">
          <div class="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-300 font-bold shrink-0">
            <i class="fas fa-user text-xs"></i>
          </div>
          <div class="overflow-hidden">
            <div class="flex items-center gap-2">
              <span class="text-xs font-bold text-slate-200 truncate">${s.customerName}</span>
              ${isHuman ? '<span class="w-2 h-2 rounded-full bg-amber-400 shrink-0" title="Atendimento Humano"></span>' : '<span class="w-2 h-2 rounded-full bg-emerald-400 shrink-0" title="IA Ativa"></span>'}
            </div>
            <p class="text-[11px] text-slate-400 truncate mt-0.5">${lastMsg}</p>
          </div>
        </div>
      `;
      list.appendChild(item);

      if (selectFirst && idx === 0 && !selectedChatPhone) {
        selectLiveChat(s.phone);
      }
    });
  } catch (err) {
    console.error('Erro ao buscar conversas:', err);
  }
}

async function selectLiveChat(phone) {
  selectedChatPhone = phone;
  document.getElementById('activeChatActions').classList.remove('hidden');
  document.getElementById('liveChatForm').classList.remove('hidden');
  await loadActiveChatMessages(phone);
  await loadLiveSessions(false);
}

async function loadActiveChatMessages(phone) {
  try {
    const res = await fetch(`/api/sessions/${phone}`);
    if (!res.ok) return;
    const session = await res.json();

    document.getElementById('activeChatName').textContent = session.customerName;
    document.getElementById('activeChatPhone').textContent = `+${session.phone} • Nicho: ${session.nicheId}`;

    const badge = document.getElementById('activeChatStatusBadge');
    const btnHuman = document.getElementById('btnToggleHuman');

    if (session.status === 'human') {
      badge.textContent = '👤 Atendimento Humano';
      badge.className = 'text-[11px] px-2.5 py-0.5 rounded-full font-semibold bg-amber-500/20 text-amber-400';
      btnHuman.textContent = 'Devolver para a IA';
      btnHuman.className = 'px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500 hover:bg-emerald-600 text-slate-950 transition';
    } else {
      badge.textContent = '🤖 Robô IA Ativo';
      badge.className = 'text-[11px] px-2.5 py-0.5 rounded-full font-semibold bg-emerald-500/20 text-emerald-400';
      btnHuman.textContent = 'Assumir Chat (Humano)';
      btnHuman.className = 'px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-slate-950 transition';
    }

    const container = document.getElementById('liveChatMessages');
    container.innerHTML = '';

    session.messages.forEach(m => {
      const bubble = document.createElement('div');
      const time = new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const formatted = m.text.replace(/\*(.*?)\*/g, '<strong>$1</strong>').replace(/\n/g, '<br/>');

      if (m.sender === 'customer') {
        bubble.className = 'flex justify-start';
        bubble.innerHTML = `
          <div class="bg-white text-slate-800 rounded-2xl rounded-tl-none px-3.5 py-2 max-w-[80%] text-xs shadow-sm">
            <div>${formatted}</div>
            <div class="text-[9px] text-slate-400 text-right mt-1">${time}</div>
          </div>
        `;
      } else {
        bubble.className = 'flex justify-end';
        const isAgent = m.sender === 'agent';
        bubble.innerHTML = `
          <div class="bg-[#d9fdd3] text-slate-800 rounded-2xl rounded-tr-none px-3.5 py-2 max-w-[80%] text-xs shadow-sm">
            ${isAgent ? '<div class="text-[10px] font-bold text-amber-700 mb-0.5"><i class="fas fa-headset mr-1"></i>Atendente Humano</div>' : ''}
            <div>${formatted}</div>
            <div class="text-[9px] text-slate-400 text-right mt-1 flex items-center justify-end gap-1">
              <span>${time}</span>
              <i class="fas fa-check-double text-blue-500"></i>
            </div>
          </div>
        `;
      }
      container.appendChild(bubble);
    });

    container.scrollTop = container.scrollHeight;
  } catch (err) {
    console.error('Erro ao carregar mensagens ativas:', err);
  }
}

async function toggleActiveChatHuman() {
  if (!selectedChatPhone) return;
  const res = await fetch(`/api/sessions/${selectedChatPhone}`);
  const session = await res.json();
  const nextStatus = session.status === 'human' ? 'bot' : 'human';

  await fetch(`/api/sessions/${selectedChatPhone}/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: nextStatus })
  });

  await loadActiveChatMessages(selectedChatPhone);
}

async function sendAgentLiveMessage(e) {
  e.preventDefault();
  if (!selectedChatPhone) return;
  const input = document.getElementById('agentInputText');
  const text = input.value.trim();
  if (!text) return;

  await fetch(`/api/sessions/${selectedChatPhone}/message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text })
  });

  input.value = '';
  await loadActiveChatMessages(selectedChatPhone);
}

// -------------------------------------------------------------
// SIMULADOR VIRTUAL
// -------------------------------------------------------------
async function loadSimulatorChat() {
  try {
    const res = await fetch(`/api/sessions/${currentPhone}`);
    if (res.ok) {
      const session = await res.json();
      const container = document.getElementById('simMessagesContainer');
      container.innerHTML = '';
      session.messages.forEach(m => renderSimBubble(m.sender, m.text, m.timestamp));
      container.scrollTop = container.scrollHeight;
    }
  } catch (err) {
    console.error(err);
  }
}

async function handleSimSubmit(e) {
  e.preventDefault();
  const input = document.getElementById('simInput');
  const text = input.value.trim();
  if (!text) return;

  renderSimBubble('customer', text, new Date().toISOString());
  input.value = '';

  const typing = document.getElementById('simTyping');
  typing.classList.remove('hidden');

  try {
    const res = await fetch('/api/simulator/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: currentPhone, customerName: 'Você (Simulador)', text })
    });
    const data = await res.json();
    typing.classList.add('hidden');

    if (data.replyMessage) {
      renderSimBubble(data.replyMessage.sender, data.replyMessage.text, data.replyMessage.timestamp);
    }
  } catch (err) {
    typing.classList.add('hidden');
    console.error(err);
  }
}

function sendSimText(text) {
  document.getElementById('simInput').value = text;
  document.querySelector('#tab-simulator form button[type="submit"]').click();
}

function renderSimBubble(sender, text, timestamp) {
  const container = document.getElementById('simMessagesContainer');
  const wrapper = document.createElement('div');
  const time = new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const formatted = text.replace(/\*(.*?)\*/g, '<strong>$1</strong>').replace(/\n/g, '<br/>');

  if (sender === 'customer') {
    wrapper.className = 'flex justify-end';
    wrapper.innerHTML = `
      <div class="bg-[#d9fdd3] text-slate-800 rounded-lg rounded-tr-none px-3 py-1.5 max-w-[85%] text-xs shadow-sm">
        <div>${formatted}</div>
        <div class="text-[9px] text-slate-400 text-right mt-0.5">${time}</div>
      </div>
    `;
  } else {
    wrapper.className = 'flex justify-start';
    wrapper.innerHTML = `
      <div class="bg-white text-slate-800 rounded-lg rounded-tl-none px-3 py-1.5 max-w-[85%] text-xs shadow-sm">
        <div>${formatted}</div>
        <div class="text-[9px] text-slate-400 text-right mt-0.5">${time}</div>
      </div>
    `;
  }

  container.appendChild(wrapper);
  container.scrollTop = container.scrollHeight;
}

async function clearSimChat() {
  await fetch(`/api/sessions/${currentPhone}`, { method: 'DELETE' });
  document.getElementById('simMessagesContainer').innerHTML = '';
}
