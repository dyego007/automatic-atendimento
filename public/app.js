let currentNiche = null;
let currentPhone = '5511999998888';

// Inicialização
document.addEventListener('DOMContentLoaded', async () => {
  await loadNiches();
  await loadSimulatorChat();
  document.getElementById('webhookUrlInput').value = `${window.location.origin}/webhook/whatsapp`;
});

// Troca de Abas
function switchTab(tabId) {
  const tabs = ['simulator', 'live', 'nicheConfig', 'webhook'];
  tabs.forEach(t => {
    const el = document.getElementById(`tab-${t}`);
    const btn = document.getElementById(`tabBtn-${t}`);
    if (t === tabId) {
      el.classList.remove('hidden');
      btn.classList.add('bg-emerald-600', 'text-white');
      btn.classList.remove('text-slate-300');
    } else {
      el.classList.add('hidden');
      btn.classList.remove('bg-emerald-600', 'text-white');
      btn.classList.add('text-slate-300');
    }
  });

  if (tabId === 'live') {
    loadSessions();
  }
}

// Carregar lista de Nichos
async function loadNiches() {
  try {
    const res = await fetch('/api/niches');
    const data = await res.json();

    const selector = document.getElementById('nicheSelector');
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
    renderNicheInfo(currentNiche);
  } catch (err) {
    console.error('Erro ao carregar nichos:', err);
  }
}

// Alterar Nicho Ativo
async function changeActiveNiche(id) {
  try {
    const res = await fetch('/api/niches/active', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    });
    const data = await res.json();
    currentNiche = data.active;
    renderNicheInfo(currentNiche);

    // Adiciona aviso visual no chat
    appendSystemMessage(`🎯 O Nicho foi alterado para: ${currentNiche.name}`);
  } catch (err) {
    alert('Erro ao alterar nicho: ' + err.message);
  }
}

// Renderiza dados do Nicho na tela
function renderNicheInfo(niche) {
  document.getElementById('bannerNicheName').textContent = `${niche.name} — ${niche.category}`;
  document.getElementById('bannerHours').textContent = `⏰ ${niche.businessInfo.hours}`;
  document.getElementById('infoNicheTitle').textContent = niche.name;
  document.getElementById('infoNicheCategory').textContent = niche.category;
  document.getElementById('infoNicheId').textContent = `id: ${niche.id}`;
  document.getElementById('infoNicheDesc').textContent = niche.description;
  document.getElementById('infoAgentName').textContent = niche.persona.agentName;
  document.getElementById('infoAgentTone').textContent = niche.persona.tone;
  document.getElementById('chatHeaderName').textContent = `${niche.name} (${niche.persona.agentName})`;

  // Preenche formulário de edição
  document.getElementById('editNicheId').value = niche.id;
  document.getElementById('editNicheName').value = niche.name;
  document.getElementById('editNicheCategory').value = niche.category;
  document.getElementById('editAgentName').value = niche.persona.agentName;
  document.getElementById('editInstructions').value = niche.persona.instructions;
  document.getElementById('editHours').value = niche.businessInfo.hours;
  document.getElementById('editAddress').value = niche.businessInfo.address;
  document.getElementById('editRawJson').value = JSON.stringify(niche, null, 2);
}

// Salvar / Editar Nicho
async function handleSaveNiche(event) {
  event.preventDefault();
  try {
    const raw = JSON.parse(document.getElementById('editRawJson').value);
    raw.id = document.getElementById('editNicheId').value.trim();
    raw.name = document.getElementById('editNicheName').value.trim();
    raw.category = document.getElementById('editNicheCategory').value.trim();
    raw.persona.agentName = document.getElementById('editAgentName').value.trim();
    raw.persona.instructions = document.getElementById('editInstructions').value.trim();
    raw.businessInfo.hours = document.getElementById('editHours').value.trim();
    raw.businessInfo.address = document.getElementById('editAddress').value.trim();

    const res = await fetch('/api/niches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(raw)
    });
    const result = await res.json();
    alert('Nicho salvo com sucesso!');
    await loadNiches();
  } catch (err) {
    alert('Erro ao salvar nicho (verifique se o JSON é válido): ' + err.message);
  }
}

// Carregar conversa do simulador
async function loadSimulatorChat() {
  try {
    const res = await fetch(`/api/sessions/${currentPhone}`);
    if (res.ok) {
      const session = await res.json();
      const container = document.getElementById('chatMessages');
      container.innerHTML = '';
      session.messages.forEach(m => renderBubble(m.sender, m.text, m.timestamp));
      scrollToBottom();
    }
  } catch (err) {
    console.error('Erro ao buscar conversa:', err);
  }
}

// Enviar mensagem no simulador
async function handleSendSimulatorMessage(e) {
  e.preventDefault();
  const input = document.getElementById('simulatorInput');
  const text = input.value.trim();
  if (!text) return;

  renderBubble('customer', text, new Date().toISOString());
  input.value = '';
  scrollToBottom();

  const typing = document.getElementById('typingIndicator');
  typing.classList.remove('hidden');

  try {
    const res = await fetch('/api/simulator/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: currentPhone,
        customerName: 'Você (Simulador)',
        text
      })
    });
    const data = await res.json();
    typing.classList.add('hidden');

    if (data.replyMessage) {
      renderBubble(data.replyMessage.sender, data.replyMessage.text, data.replyMessage.timestamp);
      scrollToBottom();
    } else if (data.ignoredDueToHuman) {
      appendSystemMessage('⚠️ O atendimento está em modo HUMANO. A IA não responderá até você reativar o robô.');
    }
  } catch (err) {
    typing.classList.add('hidden');
    appendSystemMessage('Erro ao enviar mensagem: ' + err.message);
  }
}

// Enviar mensagem rápida de teste
function sendQuickMessage(text) {
  document.getElementById('simulatorInput').value = text;
  document.querySelector('#tab-simulator form button[type="submit"]').click();
}

// Renderizar balão de mensagem no estilo WhatsApp
function renderBubble(sender, text, timestamp) {
  const container = document.getElementById('chatMessages');
  const wrapper = document.createElement('div');
  const time = new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // Formatação simples do WhatsApp (*negrito*)
  const formattedText = text
    .replace(/\*(.*?)\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br/>');

  if (sender === 'customer') {
    wrapper.className = 'flex justify-end';
    wrapper.innerHTML = `
      <div class="bg-[#d9fdd3] text-slate-800 rounded-lg rounded-tr-none px-3 py-2 max-w-[85%] text-xs shadow-sm relative">
        <div>${formattedText}</div>
        <div class="text-[9px] text-slate-400 text-right mt-1 flex items-center justify-end gap-1">
          <span>${time}</span>
          <i class="fas fa-check-double text-blue-500"></i>
        </div>
      </div>
    `;
  } else {
    wrapper.className = 'flex justify-start';
    wrapper.innerHTML = `
      <div class="bg-white text-slate-800 rounded-lg rounded-tl-none px-3 py-2 max-w-[85%] text-xs shadow-sm relative border border-slate-100">
        ${sender === 'agent' ? '<div class="text-[10px] font-bold text-amber-600 mb-0.5">👤 Atendente Humano</div>' : ''}
        <div>${formattedText}</div>
        <div class="text-[9px] text-slate-400 text-right mt-1">${time}</div>
      </div>
    `;
  }

  container.appendChild(wrapper);
}

function appendSystemMessage(msg) {
  const container = document.getElementById('chatMessages');
  const div = document.createElement('div');
  div.className = 'text-center my-2';
  div.innerHTML = `<span class="bg-amber-100 text-amber-900 text-[10px] px-2.5 py-1 rounded-full font-medium shadow-sm">${msg}</span>`;
  container.appendChild(div);
  scrollToBottom();
}

async function clearSimulatorChat() {
  if (!confirm('Deseja reiniciar a conversa do simulador?')) return;
  await fetch(`/api/sessions/${currentPhone}`, { method: 'DELETE' });
  document.getElementById('chatMessages').innerHTML = '';
  appendSystemMessage('Conversa reiniciada.');
}

function scrollToBottom() {
  const el = document.getElementById('chatMessages');
  el.scrollTop = el.scrollHeight;
}

// Carregar Sessões na Aba de Atendimentos
async function loadSessions() {
  try {
    const res = await fetch('/api/sessions');
    const sessions = await res.json();
    const container = document.getElementById('sessionsContainer');

    if (!sessions || sessions.length === 0) {
      container.innerHTML = '<div class="text-center py-10 text-slate-400 text-sm">Nenhum atendimento registrado.</div>';
      return;
    }

    container.innerHTML = '';
    sessions.forEach(s => {
      const card = document.createElement('div');
      card.className = 'border rounded-xl p-4 bg-white shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4';

      const lastMsg = s.messages.length > 0 ? s.messages[s.messages.length - 1].text : 'Sem mensagens';
      const statusBadge = s.status === 'human'
        ? '<span class="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full">Atendimento Humano</span>'
        : '<span class="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full">Robô IA Ativo</span>';

      card.innerHTML = `
        <div class="space-y-1">
          <div class="flex items-center gap-2">
            <span class="font-bold text-sm text-slate-800">${s.customerName} (${s.phone})</span>
            ${statusBadge}
          </div>
          <p class="text-xs text-slate-600 line-clamp-1">Última: "${lastMsg}"</p>
          <span class="text-[10px] text-slate-400">${new Date(s.lastActivity).toLocaleString()}</span>
        </div>
        <div class="flex items-center space-x-2">
          ${s.status === 'bot'
            ? `<button onclick="toggleSessionStatus('${s.phone}', 'human')" class="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-semibold">Assumir Chat</button>`
            : `<button onclick="toggleSessionStatus('${s.phone}', 'bot')" class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold">Devolver para IA</button>`
          }
        </div>
      `;
      container.appendChild(card);
    });
  } catch (err) {
    console.error('Erro ao listar sessões:', err);
  }
}

async function toggleSessionStatus(phone, status) {
  try {
    await fetch(`/api/sessions/${phone}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    loadSessions();
  } catch (err) {
    alert('Erro ao atualizar status: ' + err.message);
  }
}
