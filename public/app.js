let currentStore = null;
let currentNiche = null;
let selectedChatPhone = null;
let simPhone = '5511999998888';
let pollInterval = null;
let currentUser = null;

// ─── Alertas Sonoros & Notificações Web Audio API ──────────────────────────────
let audioCtx = null;
let lastTotalMessages = null;
let knownHumanSessions = new Set();
let currentHumanWaitingPhone = null;

function getAudioContext() {
  if (!audioCtx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) audioCtx = new AudioContext();
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

function playNotificationSound(type = 'message') {
  if (localStorage.getItem('sound_alerts_enabled') === 'false') return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    if (type === 'human_alert') {
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(659.25, now);
      gain1.gain.setValueAtTime(0.3, now);
      gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.22);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.22);

      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(880, now + 0.18);
      gain2.gain.setValueAtTime(0.35, now + 0.18);
      gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.18);
      osc2.stop(now + 0.5);
    } else {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.12);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.3);
    }
  } catch (e) {
    console.warn('Erro ao reproduzir alerta sonoro:', e);
  }
}

function toggleSoundAlerts() {
  const enabled = localStorage.getItem('sound_alerts_enabled') !== 'false';
  const next = !enabled;
  localStorage.setItem('sound_alerts_enabled', next ? 'true' : 'false');
  updateSoundToggleUI(next);
  if (next) playNotificationSound('message');
}

function updateSoundToggleUI(enabled) {
  const icon = document.getElementById('soundToggleIcon');
  const label = document.getElementById('soundToggleLabel');
  const btn = document.getElementById('soundToggleBtn');
  if (!icon || !label) return;

  if (enabled) {
    icon.className = 'fas fa-volume-up text-emerald-400';
    label.textContent = 'Som Ativo';
    if (btn) btn.title = 'Alertas sonoros: Ativados (clique para silenciar)';
  } else {
    icon.className = 'fas fa-volume-mute text-slate-500';
    label.textContent = 'Mudo';
    if (btn) btn.title = 'Alertas sonoros: Silenciados (clique para ativar)';
  }
}

function goToHumanChat() {
  switchTab('livechat');
  if (currentHumanWaitingPhone) {
    selectLiveChat(currentHumanWaitingPhone);
  }
}

// Inicialização com Autenticação
document.addEventListener('DOMContentLoaded', async () => {
  const isAuth = await checkAuth();
  if (isAuth) {
    await initApp();
  }
});

async function checkAuth() {
  const token = localStorage.getItem('token');
  if (!token) {
    document.getElementById('loginScreen')?.classList.remove('hidden');
    return false;
  }

  try {
    const res = await fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!res.ok) {
      localStorage.removeItem('token');
      document.getElementById('loginScreen')?.classList.remove('hidden');
      return false;
    }

    const data = await res.json();
    currentUser = data.user;
    document.getElementById('loginScreen')?.classList.add('hidden');
    applyUserPermissions(currentUser);
    return true;
  } catch (err) {
    document.getElementById('loginScreen')?.classList.remove('hidden');
    return false;
  }
}

function applyUserPermissions(user) {
  if (!user) return;

  const initials = user.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
  document.getElementById('userAvatar').textContent = initials;
  document.getElementById('userNameLabel').textContent = user.name;

  const roleBadge = document.getElementById('userRoleBadge');
  const btnStores = document.getElementById('navBtn-stores');
  const btnNiches = document.getElementById('navBtn-niches');
  const topStoreSelect = document.getElementById('topStoreSelect');

  if (user.role === 'operator') {
    roleBadge.textContent = '🩺 Secretária / Operador';
    roleBadge.className = 'text-[10px] font-semibold text-teal-400 truncate';

    // Oculta abas restritas ao admin do SaaS
    btnStores?.classList.add('hidden');
    btnNiches?.classList.add('hidden');
    if (topStoreSelect) {
      topStoreSelect.disabled = true;
    }
  } else {
    roleBadge.textContent = '👑 Administrador SaaS';
    roleBadge.className = 'text-[10px] font-semibold text-amber-400 truncate';

    btnStores?.classList.remove('hidden');
    btnNiches?.classList.remove('hidden');
    if (topStoreSelect) {
      topStoreSelect.disabled = false;
    }
  }
}

async function handleLoginSubmit(e) {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value.trim();

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Erro no login.');
    }

    const data = await res.json();
    localStorage.setItem('token', data.token);
    currentUser = data.user;
    document.getElementById('loginScreen').classList.add('hidden');
    applyUserPermissions(currentUser);
    await initApp();
  } catch (err) {
    alert(err.message);
  }
}

function fillQuickLogin(email, password) {
  document.getElementById('loginEmail').value = email;
  document.getElementById('loginPassword').value = password;
  document.querySelector('#loginScreen form button[type="submit"]').click();
}

async function handleLogout() {
  const token = localStorage.getItem('token');
  if (token) {
    await fetch('/api/auth/logout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    });
  }
  localStorage.removeItem('token');
  currentUser = null;
  document.getElementById('loginScreen').classList.remove('hidden');
}

async function checkNotificationsAndAlerts() {
  if (!currentStore || !currentUser) return;
  try {
    const res = await fetch(`/api/sessions?storeId=${currentStore.id}`);
    if (!res.ok) return;
    const sessions = await res.json();

    let totalMsgCount = 0;
    const humanWaiting = sessions.filter(s => s.status === 'human');

    sessions.forEach(s => {
      totalMsgCount += (s.messages ? s.messages.length : 0);
    });

    // Detecta novas mensagens recebidas de clientes
    if (lastTotalMessages !== null && totalMsgCount > lastTotalMessages) {
      playNotificationSound('message');
    }
    lastTotalMessages = totalMsgCount;

    // Detecta se há cliente aguardando atendimento humano (Transbordo)
    const alertBanner = document.getElementById('humanAlertBanner');
    const alertCustomerName = document.getElementById('humanAlertCustomerName');

    if (humanWaiting.length > 0) {
      const firstWaiting = humanWaiting[0];
      currentHumanWaitingPhone = firstWaiting.phone;

      if (alertBanner) {
        alertBanner.classList.remove('hidden');
        if (alertCustomerName) {
          alertCustomerName.textContent = `${firstWaiting.customerName} (+${firstWaiting.phone})`;
        }
      }

      // Toca alarme se for um novo pedido de transbordo
      const hasNewHumanRequest = humanWaiting.some(s => !knownHumanSessions.has(s.phone));
      if (hasNewHumanRequest) {
        playNotificationSound('human_alert');
        humanWaiting.forEach(s => knownHumanSessions.add(s.phone));
      }
    } else {
      if (alertBanner) alertBanner.classList.add('hidden');
      currentHumanWaitingPhone = null;
      knownHumanSessions.clear();
    }
  } catch (err) {
    console.error('Erro na verificação de alertas e notificações:', err);
  }
}

async function initApp() {
  updateSoundToggleUI(localStorage.getItem('sound_alerts_enabled') !== 'false');
  await loadNiches();
  await loadStores();

  // Se for operador de loja específica, força a loja dele
  if (currentUser && currentUser.role === 'operator' && currentUser.storeId) {
    await changeActiveStore(currentUser.storeId);
    switchTab('appointments');
  } else {
    await refreshActiveStoreData();
  }

  if (!pollInterval) {
    pollInterval = setInterval(async () => {
      if (currentStore && currentUser) {
        await checkStoreWhatsAppStatus(currentStore.id);
        await loadStoreStats(currentStore.id);
        await checkNotificationsAndAlerts();
        if (!document.getElementById('tab-livechat').classList.contains('hidden')) {
          await loadLiveSessions(false);
          if (selectedChatPhone) {
            await loadActiveChatMessages(selectedChatPhone);
          }
        }
      }
    }, 2500);
  }
}

// Navegação entre Abas
function switchTab(tabId) {
  const tabs = ['stores', 'dashboard', 'livechat', 'appointments', 'simulator', 'niches', 'agenda'];
  const titles = {
    agenda: 'Disponibilidade por dia',
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

  if (tabId === 'agenda') loadAgendaDay();
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
  if (!document.getElementById('tab-agenda').classList.contains('hidden')) await loadAgendaDay();
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
      const isHuman = s.status === 'human';

      let baseClass = 'hover:bg-slate-900/60';
      if (isSelected) {
        baseClass = 'bg-slate-900 border-l-4 border-emerald-500';
      } else if (isHuman) {
        baseClass = 'bg-amber-500/10 border-l-4 border-amber-400 hover:bg-amber-500/15 animate-pulse';
      }

      item.className = `p-3.5 cursor-pointer transition flex items-center justify-between gap-3 ${baseClass}`;

      const lastMsg = s.messages.length > 0 ? s.messages[s.messages.length - 1].text : 'Conversa iniciada';

      item.onclick = () => selectLiveChat(s.phone);

      item.innerHTML = `
        <div class="flex items-center gap-3 overflow-hidden">
          <div class="w-10 h-10 rounded-full ${isHuman ? 'bg-amber-500/20 text-amber-300' : 'bg-slate-800 text-slate-300'} flex items-center justify-center font-bold shrink-0">
            <i class="fas ${isHuman ? 'fa-headset' : 'fa-user'} text-xs"></i>
          </div>
          <div class="overflow-hidden flex-1">
            <div class="flex items-center justify-between gap-2">
              <span class="text-xs font-bold text-slate-200 truncate">${s.customerName}</span>
              ${
                isHuman
                  ? '<span class="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-amber-500 text-slate-950 shrink-0">🚨 HUMANO</span>'
                  : '<span class="w-2 h-2 rounded-full bg-emerald-400 shrink-0" title="IA Ativa"></span>'
              }
            </div>
            <p class="text-[11px] ${isHuman ? 'text-amber-200 font-medium' : 'text-slate-400'} truncate mt-0.5">${lastMsg}</p>
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

      const audioPlayerHtml = m.audioUrl
        ? `<div class="mt-2 pt-1 border-t border-slate-300/60">
             <div class="text-[10px] font-bold text-emerald-800 flex items-center gap-1 mb-1">
               <i class="fas fa-microphone-alt"></i> Áudio de Voz da Secretária:
             </div>
             <audio controls class="w-full h-8 max-w-[240px]">
               <source src="${m.audioUrl}" type="audio/mpeg">
               Áudio indisponível
             </audio>
           </div>`
        : '';

      if (m.sender === 'customer') {
        bubble.className = 'flex justify-start';
        bubble.innerHTML = `
          <div class="bg-white text-slate-800 rounded-2xl rounded-tl-none px-3.5 py-2 max-w-[80%] text-xs shadow-sm">
            <div>${formatted}</div>
            ${audioPlayerHtml}
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
            ${audioPlayerHtml}
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
      session.messages.forEach(m => renderSimBubble(m.sender, m.text, m.timestamp, m.audioUrl));
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
      renderSimBubble(data.replyMessage.sender, data.replyMessage.text, data.replyMessage.timestamp, data.replyMessage.audioUrl);
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

function renderSimBubble(sender, text, timestamp, audioUrl) {
  const container = document.getElementById('simMessagesContainer');
  const wrapper = document.createElement('div');
  const time = new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const formatted = text.replace(/\*(.*?)\*/g, '<strong>$1</strong>').replace(/\n/g, '<br/>');

  const audioHtml = audioUrl
    ? `<div class="mt-2 pt-1 border-t border-slate-200">
         <div class="text-[9px] font-bold text-emerald-700 flex items-center gap-1 mb-0.5">
           <i class="fas fa-microphone-alt"></i> Áudio de Voz da Secretária:
         </div>
         <audio controls class="w-full h-7 max-w-[210px]">
           <source src="${audioUrl}" type="audio/mpeg">
         </audio>
       </div>`
    : '';

  if (sender === 'customer') {
    wrapper.className = 'flex justify-end';
    wrapper.innerHTML = `
      <div class="bg-[#d9fdd3] text-slate-800 rounded-lg rounded-tr-none px-3 py-1.5 max-w-[85%] text-xs shadow-sm">
        <div>${formatted}</div>
        ${audioHtml}
        <div class="text-[9px] text-slate-400 text-right mt-0.5">${time}</div>
      </div>
    `;
  } else {
    wrapper.className = 'flex justify-start';
    wrapper.innerHTML = `
      <div class="bg-white text-slate-800 rounded-lg rounded-tl-none px-3 py-1.5 max-w-[85%] text-xs shadow-sm">
        <div>${formatted}</div>
        ${audioHtml}
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
// MÓDULO DE AGENDAMENTOS, HORÁRIOS & CALENDÁRIO (ESTILO OUTLOOK)
// -------------------------------------------------------------
let fullCalendarInstance = null;
let activeModalApt = null;

async function loadAppointmentsPage() {
  await loadServices();
  await loadSchedule();
  await initOrUpdateCalendar();
}

async function initOrUpdateCalendar() {
  const calendarEl = document.getElementById('calendar');
  if (!calendarEl) return;

  if (!fullCalendarInstance) {
    fullCalendarInstance = new FullCalendar.Calendar(calendarEl, {
      initialView: 'timeGridWeek',
      headerToolbar: false, // Controlado pela nossa barra superior estilo Outlook
      slotMinTime: '07:00:00',
      slotMaxTime: '20:00:00',
      slotDuration: '00:30:00',
      allDaySlot: false,
      locale: 'pt-br',
      nowIndicator: true,
      height: 680,
      selectable: true,
      selectMirror: true,
      weekends: true,
      slotLabelFormat: {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      },
      dayHeaderFormat: {
        weekday: 'short',
        day: 'numeric',
        omitCommas: true
      },
      dateClick: function(info) {
        // Ao clicar em qualquer slot vazio -> abre o modal de agendar naquele horário
        openNewAppointmentModal(info.dateStr);
      },
      eventClick: function(info) {
        // Ao clicar em uma consulta marcada -> abre detalhes do paciente
        openAppointmentDetailModal(info.event.extendedProps);
      },
      datesSet: function(info) {
        updateCalendarPeriodTitle(info.view);
      }
    });

    fullCalendarInstance.render();
  }

  await loadAppointmentsToCalendar();
  setTimeout(() => {
    fullCalendarInstance.updateSize();
  }, 100);
}

function updateCalendarPeriodTitle(view) {
  const titleEl = document.getElementById('calPeriodTitle');
  if (titleEl && view) {
    titleEl.textContent = view.title;
  }
}

function calNavigate(action) {
  if (!fullCalendarInstance) return;
  if (action === 'today') fullCalendarInstance.today();
  if (action === 'prev') fullCalendarInstance.prev();
  if (action === 'next') fullCalendarInstance.next();
}

function calChangeView(viewName) {
  if (!fullCalendarInstance) return;
  fullCalendarInstance.changeView(viewName);

  const views = ['week', 'day', 'month', 'list'];
  const viewMap = {
    timeGridWeek: 'week',
    timeGridDay: 'day',
    dayGridMonth: 'month',
    listWeek: 'list'
  };

  const activeKey = viewMap[viewName];
  views.forEach(v => {
    const btn = document.getElementById(`btnView-${v}`);
    if (v === activeKey) {
      btn.className = 'px-3 py-1.5 rounded-lg bg-indigo-600 text-white transition shadow-sm';
    } else {
      btn.className = 'px-3 py-1.5 rounded-lg text-slate-400 hover:text-white transition';
    }
  });
}

async function loadAppointmentsToCalendar() {
  if (!currentStore || !fullCalendarInstance) return;
  try {
    const res = await fetch(`/api/appointments?storeId=${currentStore.id}`);
    const list = await res.json();

    const events = list.map(a => {
      const startDateTime = `${a.date}T${a.time}:00`;
      
      // Cores por status (Roxo / Indigo estilo Outlook para Confirmado)
      let bgColor = '#4f46e5'; // Indigo
      let borderColor = '#6366f1';
      if (a.status === 'confirmed') {
        bgColor = '#4338ca'; // Roxo/Azul do Outlook
        borderColor = '#6366f1';
      } else if (a.status === 'pending') {
        bgColor = '#d97706'; // Âmbar
        borderColor = '#f59e0b';
      } else if (a.status === 'completed') {
        bgColor = '#059669'; // Esmeralda
        borderColor = '#10b981';
      } else if (a.status === 'cancelled') {
        bgColor = '#dc2626'; // Vermelho
        borderColor = '#ef4444';
      }

      return {
        id: a.id,
        title: `${a.customerName} — ${a.serviceName}`,
        start: startDateTime,
        backgroundColor: bgColor,
        borderColor: borderColor,
        textColor: '#ffffff',
        extendedProps: a
      };
    });

    fullCalendarInstance.removeAllEvents();
    fullCalendarInstance.addEventSource(events);
  } catch (err) {
    console.error('Erro ao carregar eventos no calendário:', err);
  }
}

// -------------------------------------------------------------
// MODAIS DE AGENDAMENTO (DETALHES & NOVO)
// -------------------------------------------------------------
async function openNewAppointmentModal(dateStr) {
  const modal = document.getElementById('newAppointmentModal');
  modal.classList.remove('hidden');

  // Preenche serviços da clínica
  const select = document.getElementById('aptServiceSelect');
  select.innerHTML = '<option value="">Selecione o Procedimento...</option>';

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

  if (dateStr) {
    // Ex: "2026-11-24T10:00:00" ou "2026-11-24"
    const parts = dateStr.split('T');
    document.getElementById('aptDate').value = parts[0];
    if (parts[1]) {
      document.getElementById('aptTime').value = parts[1].substring(0, 5);
    } else {
      document.getElementById('aptTime').value = '09:00';
    }
  } else {
    document.getElementById('aptDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('aptTime').value = '09:00';
  }
}

function closeNewAppointmentModal() {
  document.getElementById('newAppointmentModal').classList.add('hidden');
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
    alert('Consulta agendada com sucesso no calendário!');
    closeNewAppointmentModal();
    document.getElementById('aptCustomerName').value = '';
    document.getElementById('aptCustomerPhone').value = '';
    document.getElementById('aptNotes').value = '';
    await loadAppointmentsToCalendar();
  } catch (err) {
    alert('Erro ao agendar: ' + err.message);
  }
}

function openAppointmentDetailModal(apt) {
  activeModalApt = apt;
  const modal = document.getElementById('appointmentDetailModal');
  modal.classList.remove('hidden');

  document.getElementById('modalAptCustomer').textContent = apt.customerName;
  document.getElementById('modalAptService').textContent = apt.serviceName;

  const formattedDate = apt.date.split('-').reverse().join('/');
  document.getElementById('modalAptDateTime').textContent = `${formattedDate} às ${apt.time}`;

  const cleanPhone = apt.customerPhone.replace(/\D/g, '');
  document.getElementById('modalAptPhone').textContent = `+${cleanPhone}`;
  document.getElementById('modalAptPhoneLink').href = `https://wa.me/${cleanPhone}`;

  document.getElementById('modalAptNotes').textContent = apt.notes || 'Nenhuma observação informada.';

  const badge = document.getElementById('modalAptStatusBadge');
  if (apt.status === 'confirmed') {
    badge.textContent = 'Confirmado';
    badge.className = 'text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400';
  } else if (apt.status === 'pending') {
    badge.textContent = 'Pendente';
    badge.className = 'text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400';
  } else if (apt.status === 'completed') {
    badge.textContent = 'Realizado';
    badge.className = 'text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400';
  } else {
    badge.textContent = 'Cancelado';
    badge.className = 'text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full bg-rose-500/10 text-rose-400';
  }

  const reminderEl = document.getElementById('modalAptReminderStatus');
  if (reminderEl) {
    if (apt.lastReminderSentAt) {
      const timeStr = new Date(apt.lastReminderSentAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      reminderEl.innerHTML = `<span class="text-emerald-400 font-bold flex items-center gap-1"><i class="fas fa-check-circle"></i> Enviado hoje às ${timeStr}</span>`;
    } else if (apt.reminder24hSent || apt.reminder2hSent) {
      reminderEl.innerHTML = `<span class="text-emerald-400 font-bold flex items-center gap-1"><i class="fas fa-check-circle"></i> Enviado</span>`;
    } else {
      reminderEl.innerHTML = `<span class="text-slate-400">Pendente de envio</span>`;
    }
  }
}

async function sendAppointmentReminderFromModal() {
  if (!activeModalApt) return;
  const btn = document.getElementById('btnModalSendReminder');
  const originalHtml = btn ? btn.innerHTML : '';
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...';
  }

  try {
    const res = await fetch(`/api/appointments/${activeModalApt.id}/remind`, { method: 'POST' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro ao enviar lembrete.');

    alert(data.message || 'Lembrete enviado com sucesso!');
    const reminderEl = document.getElementById('modalAptReminderStatus');
    if (reminderEl) {
      reminderEl.innerHTML = `<span class="text-emerald-400 font-bold flex items-center gap-1"><i class="fas fa-check-circle"></i> Enviado agora!</span>`;
    }
    await loadAppointmentsToCalendar();
  } catch (err) {
    alert('Erro ao enviar lembrete: ' + err.message);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = originalHtml;
    }
  }
}

function closeAppointmentDetailModal() {
  document.getElementById('appointmentDetailModal').classList.add('hidden');
  activeModalApt = null;
}

async function changeModalAptStatus(status) {
  if (!activeModalApt) return;
  try {
    await fetch(`/api/appointments/${activeModalApt.id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    closeAppointmentDetailModal();
    await loadAppointmentsToCalendar();
  } catch (err) {
    alert('Erro ao atualizar status: ' + err.message);
  }
}

async function deleteModalAppointment() {
  if (!activeModalApt) return;
  if (!confirm(`Deseja realmente excluir a consulta de '${activeModalApt.customerName}'?`)) return;
  try {
    await fetch(`/api/appointments/${activeModalApt.id}`, { method: 'DELETE' });
    closeAppointmentDetailModal();
    await loadAppointmentsToCalendar();
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
