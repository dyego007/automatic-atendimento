// Agenda isolada por loja; nunca gera horários a partir do funcionamento.
let agendaRequest = 0;
function agendaToday() {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const v = type => parts.find(p => p.type === type).value;
  return v('year') + '-' + v('month') + '-' + v('day');
}
async function loadAgendaDay() {
  const dateInput = document.getElementById('agendaDate');
  if (!dateInput || !currentStore) return;
  dateInput.min = agendaToday();
  if (!dateInput.value) dateInput.value = agendaToday();
  const storeId = currentStore.id, date = dateInput.value, request = ++agendaRequest;
  document.getElementById('agendaSave').disabled = true;
  document.getElementById('agendaTimes').value = '';
  document.getElementById('agendaFeedback').textContent = 'Consultando agenda...';
  document.getElementById('agendaAvailable').textContent = '';
  document.getElementById('agendaBookings').replaceChildren();
  try {
    const res = await fetch('/api/stores/' + encodeURIComponent(storeId) + '/agenda?date=' + encodeURIComponent(date));
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Não foi possível consultar a agenda.');
    if (request !== agendaRequest || currentStore.id !== storeId || dateInput.value !== date) return;
    renderAgendaDay(data);
    document.getElementById('agendaFeedback').textContent = data.configured ? 'Horários cadastrados para esta data.' : 'Sem cadastro específico: usando a grade semanal de Agendamentos.';
    document.getElementById('agendaSave').disabled = false;
  } catch (err) {
    if (request === agendaRequest) document.getElementById('agendaFeedback').textContent = err.message;
  }
}
function renderAgendaDay(data) {
  document.getElementById('agendaTimes').value = data.times.join(', ');
  document.getElementById('agendaAvailable').textContent = data.available.length ? data.available.join(' • ') : 'Nenhum horário disponível neste dia.';
  const list = document.getElementById('agendaBookings');
  list.replaceChildren();
  if (!data.bookings.length) list.textContent = 'Nenhum agendamento confirmado nesta data.';
  data.bookings.forEach(booking => {
    const item = document.createElement('li');
    item.textContent = booking.time + ' — ' + booking.customerName + ' (' + booking.phone + ')';
    list.appendChild(item);
  });
}
async function saveAgendaDay(event) {
  event.preventDefault();
  if (!currentStore) return;
  const storeId = currentStore.id, date = document.getElementById('agendaDate').value;
  const times = document.getElementById('agendaTimes').value.split(/[,;\n]+/).map(time => time.trim()).filter(Boolean);
  const button = document.getElementById('agendaSave');
  button.disabled = true;
  try {
    const res = await fetch('/api/stores/' + encodeURIComponent(storeId) + '/agenda', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ date, times }) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Não foi possível salvar.');
    if (currentStore.id !== storeId || document.getElementById('agendaDate').value !== date) return;
    renderAgendaDay(data);
    document.getElementById('agendaFeedback').textContent = 'Agenda salva. O robô oferecerá somente os horários disponíveis desse dia.';
  } catch (err) {
    if (currentStore.id === storeId && document.getElementById('agendaDate').value === date) document.getElementById('agendaFeedback').textContent = err.message;
  } finally {
    if (currentStore.id === storeId && document.getElementById('agendaDate').value === date) button.disabled = false;
  }
}
