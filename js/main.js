// Lamelia: entry point. Wires settings, audio and the kalimba together.

import { loadState, saveState, sanitize, viewFor, resolveNoteStyle } from './state.js';
import { setLang, getLang, t } from './i18n.js';
import { KalimbaAudio } from './audio.js';
import { Kalimba } from './kalimba.js';
import { buildLayout, noteName, usesFlats } from './tunings.js';
import { createSettings } from './settings.js';

let state = loadState();
setLang(state.lang);

const audio = new KalimbaAudio();
audio.volume = state.volume;
audio.reverb = state.reverb;

const kalimba = new Kalimba(document.getElementById('kalimba'), { audio });
const btnSettings = document.getElementById('btnSettings');
const tuningInfo = document.getElementById('tuningInfo');
const toastEl = document.getElementById('toast');

// ---- Rendering ------------------------------------------------------------------

function renderInfo() {
  const tu = state.tuning;
  if (tu.custom) {
    tuningInfo.textContent = t('tuning.summaryCustom', { keys: tu.keys });
    return;
  }
  const lang = getLang();
  const scale = t(`scale.${tu.scale}`);
  tuningInfo.textContent = t('tuning.summary', {
    keys: tu.keys,
    tonic: noteName(tu.root, resolveNoteStyle(state), usesFlats(tu.root, tu.scale), lang),
    scale: lang === 'de' ? scale : scale.toLocaleLowerCase(lang),
  });
}

function renderKalimba() {
  kalimba.setLayout(buildLayout(state.tuning, state.a4), viewFor(state));
  renderInfo();
  const label = t('settings.open');
  btnSettings.setAttribute('aria-label', label);
  btnSettings.title = label;
}

const viewSignature = (s) => JSON.stringify([s.lang, s.labels, s.noteNames, s.palette, s.a4, s.tuning]);

/** Change settings: validate, save, and refresh whatever depends on them. */
function update(mutator) {
  const before = viewSignature(state);
  const next = structuredClone(state);
  mutator(next);
  state = sanitize(next);
  saveState(state);

  audio.setVolume(state.volume);
  audio.setReverb(state.reverb);
  if (state.lang !== getLang()) setLang(state.lang);
  if (viewSignature(state) !== before) renderKalimba();
  syncWakeLock();
}

// ---- Install (Android Chrome) ---------------------------------------------------

let installEvent = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  installEvent = e;
});
window.addEventListener('appinstalled', () => {
  installEvent = null;
});

const install = {
  isStandalone: () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true,
  canPrompt: () => installEvent !== null,
  async prompt() {
    if (!installEvent) return;
    installEvent.prompt();
    try {
      await installEvent.userChoice;
    } catch {
      /* dismissed */
    }
    installEvent = null;
  },
};

// ---- Settings sheet -------------------------------------------------------------

const settings = createSettings({
  panel: document.getElementById('settings'),
  getState: () => state,
  update,
  install,
});
btnSettings.addEventListener('click', () => settings.open(btnSettings));

// ---- Screen stays on while playing ----------------------------------------------

let wakeLock = null;
async function syncWakeLock() {
  if (!('wakeLock' in navigator)) return;
  try {
    if (state.keepAwake && document.visibilityState === 'visible' && !wakeLock) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => (wakeLock = null));
    } else if (!state.keepAwake && wakeLock) {
      await wakeLock.release();
      wakeLock = null;
    }
  } catch {
    /* not allowed right now (low battery, etc.) */
  }
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden' && audio.ctx && audio.ctx.state === 'running') audio.ctx.suspend();
  syncWakeLock(); // the lock is released automatically when the page is hidden
});

// Browsers only allow sound after a touch, so wake the audio on the first one.
document.addEventListener('pointerdown', () => audio.resume(), { capture: true, passive: true });

// ---- Toast ----------------------------------------------------------------------

let toastTimer = 0;
function showToast(message) {
  toastEl.textContent = message;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 3200);
}

// ---- Offline support ------------------------------------------------------------

const canUseWorker = 'serviceWorker' in navigator && (location.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(location.hostname));
if (canUseWorker) {
  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('./sw.js');
      reg.addEventListener('updatefound', () => {
        const worker = reg.installing;
        if (!worker) return;
        worker.addEventListener('statechange', () => {
          if (worker.state === 'installed' && !navigator.serviceWorker.controller) showToast(t('app.offlineReady'));
        });
      });
    } catch (err) {
      console.warn('Lamelia: offline mode could not start', err);
    }
  });
}

// ---- Go ---------------------------------------------------------------------------

renderKalimba();
syncWakeLock();
