let currentStore = null;
let currentNiche = null;
let selectedChatPhone = null;
let simPhone = '5511999998888';
let pollInterval = null;

// Inicialização
document.addEventListener('DOMContentLoaded', async () => {
  await loadNiches();
  await loadStores();
  await refreshActiveStoreData();

  pollInterval = setInterval(async () => {
    if (currentStore) {
      await checkStoreWhatsAppStatus(currentStore.id);
      await loadStoreStats(currentStore.id);
      if (!document.getElementById('tab-livechat').classList.contains('hidden')) {
        await loadLiveSessions(false);
        if (selectedChatPhone) {
          await loadActiveChatMessages(selectedChatPhone);
        }
      }
    }
  }, 2500);
});

// Navegação entre Abas
function switchTab(tabId) {
  const tabs = ['stores', 'dashboard', 'livechat', 'appointments', 'simulator', 'niches'];
  const titles = {
    stores: '<i class="fas fa-store text-emerald-400"></i> Minhas Lojas & Clientes Cadastrados',
    dashboard: '<i class="fas fa-qrcode text-emerald-400"></i> Conexão QR Code & Visão Geral',
    livechat: '<i class="fas fa-comments text-emerald-400"></i> Conversas ao Vivo (WhatsApp Web)',
    appointments: '<i class="fas fa-calendar-check text-emerald-400"></i> Agendamentos, Horários & Serviços',
    simulator: '<i class="fas fa-mobile-alt text-emerald-400"></i> Simulador Virtual de Testes',
    niches: '<i class="fas fa-layer-group text-emerald-400"></i> Catálogo de Nichos & Regras'
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

  if (tabId === 'stores') {
    loadStores();
  } else if (tabId === 'livechat') {
    loadLiveSessions(true);
  } else if (tabId === 'appointments') {
    loadAppointmentsPage();
  }
}

// -------------------------------------------------------------
// GESTÃO DE LOJAS (MULTI-TENANT)
// -------------------------------------------------------------
async function loadStores() {
  try {
    const res = await fetch('/api/stores');
    const data = await res.json();
    const select = document.getElementById('topStoreSelect');
    const grid = document.getElementById('storesGrid');

    select.innerHTML = '';
    grid.innerHTML = '';

    data.stores.forEach(s => {
      // Opção no Topo
      const opt = document.createElement('option');
      opt.value = s.id;
      opt.textContent = `${s.name} (${s.nicheId})`;
      if (s.id === data.activeStoreId) {
        opt.selected = true;
      }
      select.appendChild(opt);

      // Card na Aba de Lojas
      const card = document.createElement('div');
      card.className = 'bg-slate-950 border border-slate-800 p-5 rounded-2xl flex flex-col justify-between hover:border-slate-700 transition space-y-4';

      const isConnected = s.whatsappStatus === 'connected';
      const statusBadge = isConnected
        ? `<span class="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold px-2 py-0.5 rounded-full"><i class="fas fa-check-circle mr-1"></i>WhatsApp Conectado (+${s.user?.phone || ''})</span>`
        : `<span class="bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[10px] font-bold px-2 py-0.5 rounded-full"><i class="fas fa-times-circle mr-1"></i>Desconectado</span>`;

      card.innerHTML = `
        <div>
          <div class="flex items-center justify-between gap-2 mb-2">
            <span class="text-[10px] font-bold uppercase tracking-wider text-teal-400 bg-teal-500/10 px-2.5 py-0.5 rounded-full">
              Nicho: ${s.nicheId}
            </span>
            ${statusBadge}
          </div>
          <h4 class="text-base font-bold text-white">${s.name}</h4>
          <p class="text-xs text-slate-400 mt-1">ID da Sessão: <code>${s.id}</code></p>
        </div>

        <div class="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
          <button onclick="selectAndOpenStore('${s.id}')" class="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs rounded-xl transition flex items-center gap-1.5">
            <i class="fas fa-qrcode"></i> Conectar / Gerenciar
          </button>
          <button onclick="deleteStore('${s.id}')" title="Excluir Loja" class="p-2 text-slate-500 hover:text-rose-400 transition">
            <i class="fas fa-trash-alt text-xs"></i>
          </button>
        </div>
      `;
      grid.appendChild(card);
    });

    const activeRes = await fetch('/api/stores/active');
    currentStore = await activeRes.json();
    updateStoreUI();
  } catch (err) {
    console.error('Erro ao listar lojas:', err);
  }
}

async function changeActiveStore(id) {
  try {
    const res = await fetch('/api/stores/active', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    });
    const data = await res.json();
    currentStore = data.store;
    await refreshActiveStoreData();
  } catch (err) {
    alert('Erro ao trocar de loja: ' + err.message);
  }
}

async function selectAndOpenStore(id) {
  await changeActiveStore(id);
  switchTab('dashboard');
}

function openNewStoreModal() {
  const card = document.getElementById('newStoreCard');
  card.classList.remove('hidden');

  // Preenche opções de nichos
  const select = document.getElementById('newStoreNiche');
  select.innerHTML = `
    <option value="dentista">Clínica Odontológica (Dentista)</option>
    <option value="distribuidora">Distribuidora de Bebidas / Gelo</option>
    <option value="imobiliaria">Imobiliária & Locação</option>
    <option value="template_custom">Customizado (Qualquer Negócio)</option>
  `;
}

async function handleCreateStore(e) {
  e.preventDefault();
  const name = document.getElementById('newStoreName').value.trim();
  const nicheId = document.getElementById('newStoreNiche').value;

  try {
    const res = await fetch('/api/stores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, nicheId })
    });
    const data = await res.json();
    alert('Loja criada com sucesso!');
    document.getElementById('newStoreCard').classList.add('hidden');
    document.getElementById('newStoreName').value = '';
    await loadStores();
    await selectAndOpenStore(data.store.id);
  } catch (err) {
    alert('Erro ao criar loja: ' + err.message);
  }
}

async function deleteStore(id) {
  if (!confirm('Deseja excluir esta loja e desconectar o WhatsApp dela?')) return;
  try {
    await fetch(`/api/stores/${id}`, { method: 'DELETE' });
    await loadStores();
    await refreshActiveStoreData();
  } catch (err) {
    alert('Erro: ' + err.message);
  }
}

async function refreshActiveStoreData() {
  if (!currentStore) return;
  updateStoreUI();
  await checkStoreWhatsAppStatus(currentStore.id);
  await loadStoreStats(currentStore.id);
  await loadNicheForActiveStore(currentStore.nicheId);
  await loadSimulatorChat();
}

function updateStoreUI() {
  document.getElementById('sideActiveStoreName').textContent = currentStore.name;
  document.getElementById('dashBannerStoreName').textContent = currentStore.name;
  document.getElementById('dashBannerNicheName').textContent = `Nicho configurado: ${currentStore.nicheId}`;
  document.getElementById('topStoreSelect').value = currentStore.id;
}

// -------------------------------------------------------------
// CONEXÃO WHATSAPP POR LOJA (QR CODE)
// -------------------------------------------------------------
async function checkStoreWhatsAppStatus(storeId) {
  try {
    const res = await fetch(`/api/stores/${storeId}/whatsapp/status`);
    const data = await res.json();

    const qrContainer = document.getElementById('qrCodeContainer');
    const sideBadge = document.getElementById('sideWaStatusBadge');
    const topBadge = document.getElementById('waStatusBadgeTop');
    const btnConnect = document.getElementById('btnConnectWa');
    const btnDisconnect = document.getElementById('btnDisconnectWa');

    if (data.status === 'connected') {
      sideBadge.innerHTML = '<span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span> Conectado';
      sideBadge.className = 'inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-400';

      topBadge.innerHTML = `<span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span> Conectado (+${data.user?.phone || ''})`;
      topBadge.className = 'px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5';

      btnConnect.classList.add('hidden');
      btnDisconnect.classList.remove('hidden');

      qrContainer.innerHTML = `
        <div class="text-center p-4">
          <div class="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-3xl mx-auto mb-3 shadow-lg shadow-emerald-500/20">
            <i class="fas fa-check"></i>
          </div>
          <h4 class="font-bold text-slate-800 text-sm">WhatsApp da Loja Conectado!</h4>
          <p class="text-xs text-slate-500 mt-1">Número: +${data.user?.phone || ''}</p>
          <span class="inline-block mt-3 px-3 py-1 bg-emerald-100 text-emerald-800 text-[11px] font-semibold rounded-full">
            Atendimento Automático Ativo
          </span>
        </div>
      `;
    } else if (data.status === 'connecting') {
      sideBadge.innerHTML = '<span class="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span> Aguardando QR';
      sideBadge.className = 'inline-flex items-center gap-1.5 text-[11px] font-semibold text-amber-400';

      topBadge.innerHTML = '<span class="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span> Aguardando Leitura do QR';
      topBadge.className = 'px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1.5';

      btnConnect.classList.remove('hidden');
      btnDisconnect.classList.add('hidden');

      if (data.qr) {
        qrContainer.innerHTML = `<img src="${data.qr}" alt="QR Code" class="w-full h-full object-contain rounded-xl" />`;
      } else {
        qrContainer.innerHTML = `
          <div class="text-center p-4 text-slate-500">
            <i class="fas fa-spinner fa-spin text-3xl text-emerald-500 mb-2"></i>
            <p class="text-xs">Gerando QR Code...</p>
          </div>
        `;
      }
    } else {
      sideBadge.innerHTML = '<span class="w-2 h-2 rounded-full bg-rose-500"></span> Desconectado';
      sideBadge.className = 'inline-flex items-center gap-1.5 text-[11px] font-semibold text-rose-400';

      topBadge.innerHTML = '<span class="w-2 h-2 rounded-full bg-rose-500"></span> Desconectado';
      topBadge.className = 'px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center gap-1.5';

      btnConnect.classList.remove('hidden');
      btnDisconnect.classList.add('hidden');

      qrContainer.innerHTML = `
        <div class="text-center p-4">
          <i class="fas fa-qrcode text-5xl text-slate-300 mb-2"></i>
          <p class="text-xs text-slate-500 font-medium">Clique no botão para gerar o QR Code desta loja.</p>
        </div>
      `;
    }
  } catch (err) {
    console.error(err);
  }
}

async function connectActiveStoreWhatsApp() {
  if (!currentStore) return;
  const qrContainer = document.getElementById('qrCodeContainer');
  qrContainer.innerHTML = `
    <div class="text-center p-4 text-slate-500">
      <i class="fas fa-spinner fa-spin text-3xl text-emerald-500 mb-2"></i>
      <p class="text-xs font-semibold mt-2">Iniciando sessão da loja ${currentStore.name}...</p>
    </div>
  `;
  await fetch(`/api/stores/${currentStore.id}/whatsapp/connect`, { method: 'POST' });
  setTimeout(() => checkStoreWhatsAppStatus(currentStore.id), 1500);
}

async function disconnectActiveStoreWhatsApp() {
  if (!currentStore) return;
  if (!confirm(`Desconectar o WhatsApp da loja '${currentStore.name}'?`)) return;
  await fetch(`/api/stores/${currentStore.id}/whatsapp/disconnect`, { method: 'POST' });
  await checkStoreWhatsAppStatus(currentStore.id);
}

// -------------------------------------------------------------
// MÉTRICAS POR LOJA
// -------------------------------------------------------------
async function loadStoreStats(storeId) {
  try {
    const res = await fetch(`/api/stats?storeId=${storeId}`);
    const stats = await res.json();
    document.getElementById('statTotal').textContent = stats.totalSessions || 0;
    document.getElementById('statBot').textContent = stats.botActive || 0;
    document.getElementById('statHuman').textContent = stats.humanTakeover || 0;
    document.getElementById('statMessages').textContent = stats.totalMessages || 0;
  } catch (e) {
    // Silencia
  }
}

// -------------------------------------------------------------
// NICHOS
// -------------------------------------------------------------
async function loadNiches() {
  try {
    const res = await fetch('/api/niches');
    const data = await res.json();
    if (data.niches.length > 0) {
      renderNicheConfigForm(data.niches[0]);
    }
  } catch (err) {
    console.error(err);
  }
}

async function loadNicheForActiveStore(nicheId) {
  try {
    const res = await fetch('/api/niches');
    const data = await res.json();
    const niche = data.niches.find(n => n.id === nicheId) || data.niches[0];
    if (niche) {
      currentNiche = niche;
      document.getElementById('dashNicheName').textContent = niche.name;
      document.getElementById('dashNicheCategory').textContent = niche.category;
      document.getElementById('dashNicheId').textContent = `nicho: ${niche.id}`;
      document.getElementById('dashNicheDesc').textContent = niche.description;
      document.getElementById('dashAgentName').textContent = niche.persona.agentName;
      document.getElementById('dashHours').textContent = niche.businessInfo.hours;
      document.getElementById('simHeaderTitle').textContent = `${currentStore.name} (${niche.persona.agentName})`;
      renderNicheConfigForm(niche);
    }
  } catch (err) {
    console.error(err);
  }
}

function renderNicheConfigForm(niche) {
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

// -------------------------------------------------------------
// CONVERSAS AO VIVO DA LOJA SELECIONADA
// -------------------------------------------------------------
async function loadLiveSessions(selectFirst = false) {
  if (!currentStore) return;
  try {
    const res = await fetch(`/api/sessions?storeId=${currentStore.id}`);
    const sessions = await res.json();
    const list = document.getElementById('chatListContainer');

    if (!sessions || sessions.length === 0) {
      list.innerHTML = `<div class="text-center py-12 text-slate-500 text-xs">Nenhum cliente chamou a loja '${currentStore.name}' ainda.</div>`;
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
              ${isHuman ? '<span class="w-2 h-2 rounded-full bg-amber-400 shrink-0" title="Atendente Humano"></span>' : '<span class="w-2 h-2 rounded-full bg-emerald-400 shrink-0" title="IA Ativa"></span>'}
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
    console.error(err);
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
  if (!currentStore) return;
  try {
    const res = await fetch(`/api/sessions/${phone}?storeId=${currentStore.id}`);
    if (!res.ok) return;
    const session = await res.json();

    document.getElementById('activeChatName').textContent = session.customerName;
    document.getElementById('activeChatPhone').textContent = `+${session.phone} • Loja: ${currentStore.name}`;

    const badge = document.getElementById('activeChatStatusBadge');
    const btnHuman = document.getElementById('btnToggleHuman');

    if (session.status === 'human') {
      badge.textContent = '👤 Atendente Humano';
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
    console.error(err);
  }
}

async function toggleActiveChatHuman() {
  if (!selectedChatPhone || !currentStore) return;
  const res = await fetch(`/api/sessions/${selectedChatPhone}?storeId=${currentStore.id}`);
  const session = await res.json();
  const nextStatus = session.status === 'human' ? 'bot' : 'human';

  await fetch(`/api/sessions/${selectedChatPhone}/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ storeId: currentStore.id, status: nextStatus })
  });

  await loadActiveChatMessages(selectedChatPhone);
}

async function sendAgentLiveMessage(e) {
  e.preventDefault();
  if (!selectedChatPhone || !currentStore) return;
  const input = document.getElementById('agentInputText');
  const text = input.value.trim();
  if (!text) return;

  await fetch(`/api/sessions/${selectedChatPhone}/message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ storeId: currentStore.id, text })
  });

  input.value = '';
  await loadActiveChatMessages(selectedChatPhone);
}

// -------------------------------------------------------------
// SIMULADOR
// -------------------------------------------------------------
async function loadSimulatorChat() {
  if (!currentStore) return;
  try {
    const res = await fetch(`/api/sessions/${simPhone}?storeId=${currentStore.id}`);
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
  if (!currentStore) return;
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
      body: JSON.stringify({
        storeId: currentStore.id,
        phone: simPhone,
        customerName: 'Você (Simulador)',
        text
      })
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
  if (!currentStore) return;
  await fetch(`/api/sessions/${simPhone}?storeId=${currentStore.id}`, { method: 'DELETE' });
  document.getElementById('simMessagesContainer').innerHTML = '';
}

// -------------------------------------------------------------
// MÓDULO DE AGENDAMENTOS, HORÁRIOS & SERVIÇOS (CLÍNICA)
// -------------------------------------------------------------
async function loadAppointmentsPage() {
  setFilterDateToday();
  await loadAppointments();
  await loadServices();
  await loadSchedule();
}

function setFilterDateToday() {
  const today = new Date().toISOString().split('T')[0];
  const input = document.getElementById('appointmentDateFilter');
  if (input) input.value = today;
  loadAppointments();
}

async function loadAppointments() {
  if (!currentStore) return;
  const date = document.getElementById('appointmentDateFilter')?.value;
  try {
    const url = date ? `/api/appointments?storeId=${currentStore.id}&date=${date}` : `/api/appointments?storeId=${currentStore.id}`;
    const res = await fetch(url);
    const list = await res.json();
    const container = document.getElementById('appointmentsList');
    const badge = document.getElementById('appointmentCountBadge');

    badge.textContent = `${list.length} consulta${list.length === 1 ? '' : 's'}`;

    if (!list || list.length === 0) {
      container.innerHTML = `
        <div class="text-center py-10 text-slate-500 text-xs">
          <i class="fas fa-calendar-day text-3xl mb-2 text-slate-600 block"></i>
          Nenhuma consulta agendada para este dia nesta clínica.
        </div>
      `;
      return;
    }

    container.innerHTML = '';
    list.forEach(a => {
      const card = document.createElement('div');
      card.className = 'bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:border-slate-700 transition';

      let statusBadge = '';
      if (a.status === 'confirmed') {
        statusBadge = '<span class="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold px-2 py-0.5 rounded-full">Confirmado</span>';
      } else if (a.status === 'pending') {
        statusBadge = '<span class="bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-bold px-2 py-0.5 rounded-full">Pendente</span>';
      } else if (a.status === 'cancelled') {
        statusBadge = '<span class="bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[10px] font-bold px-2 py-0.5 rounded-full">Cancelado</span>';
      } else {
        statusBadge = '<span class="bg-teal-500/10 text-teal-400 border border-teal-500/20 text-[10px] font-bold px-2 py-0.5 rounded-full">Realizado</span>';
      }

      card.innerHTML = `
        <div class="flex items-center gap-3">
          <div class="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700 flex flex-col items-center justify-center shrink-0">
            <span class="text-xs font-black text-emerald-400 font-mono">${a.time}</span>
            <span class="text-[9px] text-slate-400 uppercase">${a.date.split('-').slice(1).reverse().join('/')}</span>
          </div>
          <div>
            <div class="flex items-center gap-2">
              <h5 class="text-xs font-bold text-white">${a.customerName}</h5>
              ${statusBadge}
            </div>
            <p class="text-[11px] text-emerald-300 font-medium mt-0.5">${a.serviceName}</p>
            <div class="text-[10px] text-slate-400 flex items-center gap-3 mt-1">
              <span><i class="fab fa-whatsapp text-emerald-400 mr-1"></i>+${a.customerPhone}</span>
              ${a.notes ? `<span><i class="fas fa-sticky-note text-amber-400 mr-1"></i>${a.notes}</span>` : ''}
            </div>
          </div>
        </div>

        <div class="flex items-center gap-1.5 self-end sm:self-center">
          ${a.status !== 'confirmed' ? `<button onclick="updateAppointmentStatus('${a.id}', 'confirmed')" title="Confirmar" class="px-2.5 py-1 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 rounded-lg text-xs font-semibold">Confirmar</button>` : ''}
          ${a.status !== 'cancelled' ? `<button onclick="updateAppointmentStatus('${a.id}', 'cancelled')" title="Cancelar" class="px-2.5 py-1 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 rounded-lg text-xs font-semibold">Cancelar</button>` : ''}
          <button onclick="deleteAppointment('${a.id}')" title="Excluir" class="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg transition"><i class="fas fa-trash-alt text-xs"></i></button>
        </div>
      `;
      container.appendChild(card);
    });
  } catch (err) {
    console.error('Erro ao buscar agendamentos:', err);
  }
}

async function openNewAppointmentModal() {
  const card = document.getElementById('newAppointmentCard');
  card.classList.remove('hidden');

  const select = document.getElementById('aptServiceSelect');
  select.innerHTML = '<option value="">Selecione o Serviço...</option>';

  try {
    const res = await fetch(`/api/services?storeId=${currentStore.id}`);
    const services = await res.json();
    services.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.name;
      opt.textContent = `${s.name} — ${s.price} (${s.duration})`;
      select.appendChild(opt);
    });
  } catch (e) {
    console.error(e);
  }

  const today = new Date().toISOString().split('T')[0];
  document.getElementById('aptDate').value = today;
  document.getElementById('aptTime').value = '09:00';
}

async function handleCreateAppointment(e) {
  e.preventDefault();
  if (!currentStore) return;

  const customerName = document.getElementById('aptCustomerName').value.trim();
  const customerPhone = document.getElementById('aptCustomerPhone').value.trim();
  const serviceName = document.getElementById('aptServiceSelect').value;
  const date = document.getElementById('aptDate').value;
  const time = document.getElementById('aptTime').value;
  const notes = document.getElementById('aptNotes').value.trim();

  try {
    await fetch('/api/appointments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        storeId: currentStore.id,
        customerName,
        customerPhone,
        serviceName,
        date,
        time,
        notes,
        status: 'confirmed'
      })
    });
    alert('Consulta agendada com sucesso!');
    document.getElementById('newAppointmentCard').classList.add('hidden');
    document.getElementById('aptCustomerName').value = '';
    document.getElementById('aptCustomerPhone').value = '';
    document.getElementById('aptNotes').value = '';
    await loadAppointments();
  } catch (err) {
    alert('Erro ao agendar: ' + err.message);
  }
}

async function updateAppointmentStatus(id, status) {
  try {
    await fetch(`/api/appointments/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    await loadAppointments();
  } catch (err) {
    alert('Erro ao atualizar: ' + err.message);
  }
}

async function deleteAppointment(id) {
  if (!confirm('Deseja excluir este agendamento?')) return;
  try {
    await fetch(`/api/appointments/${id}`, { method: 'DELETE' });
    await loadAppointments();
  } catch (err) {
    alert('Erro ao excluir: ' + err.message);
  }
}

// -------------------------------------------------------------
// SERVIÇOS & PROCEDIMENTOS
// -------------------------------------------------------------
async function loadServices() {
  if (!currentStore) return;
  try {
    const res = await fetch(`/api/services?storeId=${currentStore.id}`);
    const services = await res.json();
    const container = document.getElementById('servicesList');

    if (!services || services.length === 0) {
      container.innerHTML = '<div class="text-center py-6 text-slate-500 text-xs col-span-2">Nenhum serviço cadastrado ainda.</div>';
      return;
    }

    container.innerHTML = '';
    services.forEach(s => {
      const card = document.createElement('div');
      card.className = 'bg-slate-900 border border-slate-800 p-3.5 rounded-xl flex items-start justify-between gap-3 hover:border-slate-700 transition';
      card.innerHTML = `
        <div class="space-y-1">
          <div class="flex items-center gap-2">
            <h5 class="text-xs font-bold text-white">${s.name}</h5>
            <span class="text-[10px] text-teal-400 bg-teal-500/10 px-2 py-0.5 rounded-full font-mono">${s.duration}</span>
          </div>
          <div class="text-xs font-extrabold text-emerald-400 font-mono">${s.price}</div>
          ${s.description ? `<p class="text-[11px] text-slate-400">${s.description}</p>` : ''}
        </div>
        <button onclick="deleteService('${s.name}')" title="Excluir Serviço" class="p-1.5 text-slate-500 hover:text-rose-400 transition">
          <i class="fas fa-trash-alt text-xs"></i>
        </button>
      `;
      container.appendChild(card);
    });
  } catch (err) {
    console.error(err);
  }
}

async function handleCreateService(e) {
  e.preventDefault();
  if (!currentStore) return;

  const name = document.getElementById('srvName').value.trim();
  const price = document.getElementById('srvPrice').value.trim();
  const duration = document.getElementById('srvDuration').value.trim();
  const description = document.getElementById('srvDesc').value.trim();

  try {
    await fetch('/api/services', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ storeId: currentStore.id, name, price, duration, description })
    });
    alert('Serviço cadastrado com sucesso!');
    document.getElementById('newServiceForm').classList.add('hidden');
    document.getElementById('srvName').value = '';
    document.getElementById('srvPrice').value = '';
    document.getElementById('srvDuration').value = '';
    document.getElementById('srvDesc').value = '';
    await loadServices();
  } catch (err) {
    alert('Erro ao cadastrar serviço: ' + err.message);
  }
}

async function deleteService(name) {
  if (!confirm(`Deseja excluir o serviço '${name}'?`)) return;
  try {
    await fetch(`/api/services/${encodeURIComponent(name)}?storeId=${currentStore.id}`, { method: 'DELETE' });
    await loadServices();
  } catch (err) {
    alert('Erro: ' + err.message);
  }
}

// -------------------------------------------------------------
// HORÁRIOS DA CLÍNICA
// -------------------------------------------------------------
async function loadSchedule() {
  if (!currentStore) return;
  try {
    const res = await fetch(`/api/schedules?storeId=${currentStore.id}`);
    const sch = await res.json();

    document.getElementById('schStart').value = sch.startTime || '08:00';
    document.getElementById('schEnd').value = sch.endTime || '18:00';
    document.getElementById('schLunchStart').value = sch.lunchStart || '12:00';
    document.getElementById('schLunchEnd').value = sch.lunchEnd || '13:00';
    document.getElementById('schSlotMinutes').value = sch.slotMinutes || 45;

    ['seg', 'ter', 'qua', 'qui', 'sex', 'sab'].forEach(d => {
      const chk = document.getElementById(`day-${d}`);
      if (chk) chk.checked = sch.days.includes(d);
    });
  } catch (err) {
    console.error(err);
  }
}

async function handleSaveSchedule(e) {
  e.preventDefault();
  if (!currentStore) return;

  const days = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab'].filter(d => document.getElementById(`day-${d}`)?.checked);
  const schedule = {
    days,
    startTime: document.getElementById('schStart').value,
    endTime: document.getElementById('schEnd').value,
    lunchStart: document.getElementById('schLunchStart').value,
    lunchEnd: document.getElementById('schLunchEnd').value,
    slotMinutes: Number(document.getElementById('schSlotMinutes').value)
  };

  try {
    await fetch('/api/schedules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ storeId: currentStore.id, schedule })
    });
    alert('Horários de funcionamento da clínica salvos com sucesso!');
  } catch (err) {
    alert('Erro ao salvar horários: ' + err.message);
  }
}
