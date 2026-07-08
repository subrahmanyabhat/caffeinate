const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

let state = null;

function send(msg) {
  return new Promise((resolve) => chrome.runtime.sendMessage(msg, resolve));
}

function fmtCountdown(state) {
  if (!state.active) return '';
  if (!state.flags.t || !state.endTime) return '<span class="n">∞</span> forever';
  const ms = state.endTime - Date.now();
  if (ms <= 0) return 'Stopping…';
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `<span class="n">${h}h ${String(m).padStart(2,'0')}m</span> left`;
  if (m > 0) return `<span class="n">${m}m ${String(s).padStart(2,'0')}s</span> left`;
  return `<span class="n">${s}s</span> left`;
}

function render() {
  if (!state) return;

  const active = state.active;

  // Status card
  const card = $('#mainToggle');
  card.classList.toggle('off', !active);
  $('#mainToggleLabel').textContent = active ? 'Caffeinated' : 'Caffeinate';

  // Status line subtitle
  const statusLine = $('#statusLine');
  if (active) {
    statusLine.textContent = state.flags.d ? 'Your screen is staying awake' : 'System awake, screen may dim';
  } else {
    statusLine.textContent = 'Tap to keep your screen awake';
  }

  // Badge
  const badge = $('#statusBadge');
  badge.classList.toggle('on', active);
  badge.classList.toggle('off', !active);
  $('#badgeLabel').textContent = active ? 'ON' : 'OFF';

  // Duration buttons
  $$('.timer-btn').forEach((b) => {
    const sec = b.dataset.sec ? parseInt(b.dataset.sec, 10) : null;
    const match = (sec === null && !state.durationSec) || (sec === state.durationSec);
    b.classList.toggle('active', (match && state.flags.t) || (sec === null && !state.flags.t));
  });

  // Screen on toggle
  $('#screenOnToggle').classList.toggle('on', !!state.flags.d);

  // Countdown
  const cd = $('#countdown');
  cd.innerHTML = fmtCountdown(state);
}

async function refresh() {
  state = await send({ type: 'getState' });
  render();
}

// Main toggle — status card or badge
async function toggleActive() {
  state = await send({ type: 'setActive', value: !state.active });
  render();
}
$('#mainToggle').addEventListener('click', toggleActive);
$('#statusBadge').addEventListener('click', toggleActive);

// Duration buttons
$$('.timer-btn').forEach((btn) => {
  btn.addEventListener('click', async () => {
    const sec = btn.dataset.sec ? parseInt(btn.dataset.sec, 10) : null;
    if (sec === null) {
      // Forever — disable timer flag
      state = await send({ type: 'setFlag', flag: 't', value: false });
      state = await send({ type: 'setDuration', value: null });
    } else {
      state = await send({ type: 'setFlag', flag: 't', value: true });
      state = await send({ type: 'setDuration', value: sec });
    }
    render();
  });
});

// Screen on toggle
$('#screenOnToggle').addEventListener('click', async () => {
  const newVal = !state.flags.d;
  state = await send({ type: 'setFlag', flag: 'd', value: newVal });
  state = await send({ type: 'setFlag', flag: 'i', value: !newVal });
  render();
});

// Live countdown
setInterval(() => { if (state) render(); }, 1000);

refresh();
