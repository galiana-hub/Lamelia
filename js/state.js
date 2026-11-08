// Settings: defaults, validation and persistence (everything stays on the device).

import { LANGS, detectLang } from './i18n.js';
import { SCALES, MIN_KEYS, MAX_KEYS, usesFlats } from './tunings.js';

const STORAGE_KEY = 'lamelia.settings.v1';

export const DEFAULTS = {
  lang: null, // null = detect from the device
  volume: 0.8,
  reverb: 0.25,
  labels: 'both', // numbers | names | both
  noteNames: 'auto', // auto | solfege | letters
  palette: 'normal', // normal | cb | shapes
  keepAwake: true,
  a4: 440,
  tuning: {
    root: 0, // C
    octave: 4, // lowest key = C4
    scale: 'major',
    keys: 17,
    custom: null, // null, or MIDI notes from left to right
  },
};

const pick = (value, allowed, fallback) => (allowed.includes(value) ? value : fallback);
const num = (value, min, max, fallback) => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

export function sanitize(input) {
  const s = input && typeof input === 'object' ? input : {};
  const tu = s.tuning && typeof s.tuning === 'object' ? s.tuning : {};
  const keys = Math.round(num(tu.keys, MIN_KEYS, MAX_KEYS, DEFAULTS.tuning.keys));
  let custom = null;
  if (
    Array.isArray(tu.custom) &&
    tu.custom.length === keys &&
    tu.custom.every((m) => Number.isInteger(m) && m >= 24 && m <= 108)
  ) {
    custom = tu.custom.slice();
  }
  return {
    lang: LANGS[s.lang] ? s.lang : detectLang(),
    volume: num(s.volume, 0, 1, DEFAULTS.volume),
    reverb: num(s.reverb, 0, 1, DEFAULTS.reverb),
    labels: pick(s.labels, ['numbers', 'names', 'both'], DEFAULTS.labels),
    noteNames: pick(s.noteNames, ['auto', 'solfege', 'letters'], DEFAULTS.noteNames),
    palette: pick(s.palette, ['normal', 'cb', 'shapes'], DEFAULTS.palette),
    keepAwake: typeof s.keepAwake === 'boolean' ? s.keepAwake : DEFAULTS.keepAwake,
    a4: Math.round(num(s.a4, 400, 480, DEFAULTS.a4) * 10) / 10,
    tuning: {
      root: Math.round(num(tu.root, 0, 11, DEFAULTS.tuning.root)),
      octave: Math.round(num(tu.octave, 1, 6, DEFAULTS.tuning.octave)),
      scale: pick(tu.scale, Object.keys(SCALES), DEFAULTS.tuning.scale),
      keys,
      custom,
    },
  };
}

/** Which note names to show: Do Re Mi or C D E. "Automatic" follows the language. */
export function resolveNoteStyle(s) {
  if (s.noteNames === 'solfege' || s.noteNames === 'letters') return s.noteNames;
  return ['es', 'pt', 'fr'].includes(s.lang) ? 'solfege' : 'letters';
}

/** Display options handed to the kalimba. */
export function viewFor(s) {
  return {
    lang: s.lang,
    labels: s.labels,
    palette: s.palette,
    noteStyle: resolveNoteStyle(s),
    flats: usesFlats(s.tuning.root, s.tuning.scale),
  };
}

export function loadState() {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    return sanitize(raw ? JSON.parse(raw) : {});
  } catch {
    return sanitize({});
  }
}

export function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* private mode or storage disabled: the app still works, it just won't remember */
  }
}
