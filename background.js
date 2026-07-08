// ===== Caffeinate background service worker =====
// Uses chrome.power to keep the screen/system awake. This persists even
// when the popup is closed, which navigator.wakeLock cannot do.

const DEFAULT_STATE = {
  active: false,
  flags: { d: true, i: false, t: false, w: false }, // -d display, -i idle, -t timeout, -w while-charging
  durationSec: null,  // selected -t duration; null = infinite
  endTime: null,      // epoch ms when the timer expires
  charging: true      // last known charging state (for -w)
};

const TIMEOUT_ALARM = 'caffeinate-timeout';
const TICK_ALARM = 'caffeinate-tick';

async function getState() {
  const { state } = await chrome.storage.local.get('state');
  return state ? { ...DEFAULT_STATE, ...state, flags: { ...DEFAULT_STATE.flags, ...(state.flags || {}) } } : { ...DEFAULT_STATE };
}

async function saveState(state) {
  await chrome.storage.local.set({ state });
}

// Which keep-awake level to request based on flags.
function computeLevel(flags) {
  if (flags.d) return 'display';   // -d keeps the screen on (implies system awake)
  if (flags.i) return 'system';    // -i keeps system awake, screen may dim
  return 'display';                // default
}

// Should we currently be holding the lock?
function shouldKeepAwake(state) {
  if (!state.active) return false;
  if (state.flags.w && !state.charging) return false; // while-charging mode, not on power
  return true;
}

async function applyState(state) {
  const keep = shouldKeepAwake(state);

  if (keep) {
    chrome.power.requestKeepAwake(computeLevel(state.flags));
  } else {
    chrome.power.releaseKeepAwake();
  }

  // Manage the -w battery monitor offscreen document.
  await ensureBatteryMonitor(state.active && state.flags.w);

  // Manage timer alarms.
  await chrome.alarms.clear(TIMEOUT_ALARM);
  await chrome.alarms.clear(TICK_ALARM);
  if (state.active && state.flags.t && state.endTime) {
    chrome.alarms.create(TIMEOUT_ALARM, { when: state.endTime });
    chrome.alarms.create(TICK_ALARM, { periodInMinutes: 1 });
  }

  await updateBadge(state, keep);
}

async function updateBadge(state, keep) {
  if (!state.active) {
    await chrome.action.setBadgeText({ text: '' });
    return;
  }
  if (state.flags.t && state.endTime) {
    const msLeft = state.endTime - Date.now();
    if (msLeft <= 0) {
      await chrome.action.setBadgeText({ text: '' });
      return;
    }
    const minLeft = Math.ceil(msLeft / 60000);
    const text = minLeft >= 60 ? Math.ceil(minLeft / 60) + 'h' : minLeft + 'm';
    await chrome.action.setBadgeText({ text });
  } else {
    await chrome.action.setBadgeText({ text: '∞' });
  }
  const color = keep ? '#639922' : '#888780';
  await chrome.action.setBadgeBackgroundColor({ color });
}

// ===== Offscreen battery monitor (for -w "while charging") =====
async function ensureBatteryMonitor(needed) {
  const has = await chrome.offscreen.hasDocument();
  if (needed && !has) {
    await chrome.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: ['BATTERY_STATUS'],
      justification: 'Monitor charging state for the while-charging (-w) mode.'
    });
  } else if (!needed && has) {
    await chrome.offscreen.closeDocument();
  }
}

// ===== Message handling from popup & offscreen =====
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    let state = await getState();

    switch (msg.type) {
      case 'getState':
        sendResponse(state);
        return;

      case 'setActive': {
        state.active = msg.value;
        if (state.active && state.flags.t && state.durationSec) {
          state.endTime = Date.now() + state.durationSec * 1000;
        } else {
          state.endTime = null;
        }
        break;
      }

      case 'setFlag': {
        state.flags[msg.flag] = msg.value;
        // Recompute end time if the timeout flag or activity changed.
        if (state.active && state.flags.t && state.durationSec) {
          if (!state.endTime) state.endTime = Date.now() + state.durationSec * 1000;
        }
        if (!state.flags.t) state.endTime = null;
        break;
      }

      case 'setDuration': {
        state.durationSec = msg.value; // null = infinite
        if (state.active && state.flags.t && state.durationSec) {
          state.endTime = Date.now() + state.durationSec * 1000;
        } else {
          state.endTime = null;
        }
        break;
      }

      case 'battery': {
        state.charging = msg.charging;
        break;
      }
    }

    await saveState(state);
    await applyState(state);
    sendResponse(state);
  })();
  return true; // keep the message channel open for async response
});

// ===== Alarms =====
chrome.alarms.onAlarm.addListener(async (alarm) => {
  let state = await getState();
  if (alarm.name === TIMEOUT_ALARM) {
    state.active = false;
    state.endTime = null;
    await saveState(state);
    await applyState(state);
  } else if (alarm.name === TICK_ALARM) {
    const keep = shouldKeepAwake(state);
    await updateBadge(state, keep);
    if (state.endTime && Date.now() >= state.endTime) {
      state.active = false;
      state.endTime = null;
      await saveState(state);
      await applyState(state);
    }
  }
});

// ===== Reapply state on startup / install =====
chrome.runtime.onStartup.addListener(async () => {
  const state = await getState();
  await applyState(state);
});

chrome.runtime.onInstalled.addListener(async () => {
  const state = await getState();
  await applyState(state);
});
