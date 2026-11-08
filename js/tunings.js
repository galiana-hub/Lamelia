// Tuning maths for Lamelia. Pure functions only (no DOM), so they can be tested in Node.

export const SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  pentMajor: [0, 2, 4, 7, 9],
  pentMinor: [0, 3, 5, 7, 10],
  chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
};
export const SCALE_IDS = Object.keys(SCALES);

export const MIN_KEYS = 5;
export const MAX_KEYS = 36;

const mod12 = (x) => ((x % 12) + 12) % 12;

export function midiToFreq(midi, a4 = 440) {
  return a4 * Math.pow(2, (midi - 69) / 12);
}

/** MIDI notes of a tuning, from the lowest key to the highest. */
export function generateAscending({ root, octave, scale, keys }) {
  const iv = SCALES[scale] || SCALES.major;
  const base = 12 * (octave + 1) + root;
  const out = [];
  for (let i = 0; i < keys; i++) {
    out.push(base + 12 * Math.floor(i / iv.length) + iv[i % iv.length]);
  }
  return out;
}

/**
 * Arrange ascending notes the way a real kalimba is laid out:
 * the lowest note sits in the middle, the next one to its left,
 * the next to its right, and so on, alternating outwards.
 * Returns the notes from the far left to the far right.
 */
export function toVisualOrder(asc) {
  if (asc.length === 0) return [];
  const left = [];
  const right = [];
  for (let i = 1; i < asc.length; i++) (i % 2 === 1 ? left : right).push(asc[i]);
  return [...left.reverse(), asc[0], ...right];
}

/**
 * Pitch class that is "1" in the key numbers. Minor scales use their relative
 * major, so a kalimba in A minor reads 6 7 1 2 3 4 5 and never needs accidentals.
 */
export function numberReference(root, scale) {
  return scale === 'minor' || scale === 'pentMinor' ? mod12(root + 3) : mod12(root);
}

const DEGREE_LABELS = ['1', '♯1', '2', '♯2', '3', '4', '♯4', '5', '♯5', '6', '♯6', '7'];

/**
 * Full description of the keys, from left to right.
 * `tuning.custom`, when present, is a list of MIDI notes in left-to-right order.
 */
export function buildLayout(tuning, a4 = 440) {
  const visual =
    Array.isArray(tuning.custom) && tuning.custom.length > 0
      ? tuning.custom.slice()
      : toVisualOrder(generateAscending(tuning));

  const n = visual.length;
  const order = visual.map((midi, pos) => ({ midi, pos })).sort((a, b) => a.midi - b.midi || a.pos - b.pos);
  const rankOf = new Array(n);
  order.forEach((o, r) => (rankOf[o.pos] = r));

  const lowest = order[0] ? order[0].midi : 60;
  const highest = order[n - 1] ? order[n - 1].midi : 60;
  const ref = numberReference(tuning.root, tuning.scale);
  const baseRefMidi = lowest - mod12(lowest - ref); // highest "1" at or below the lowest key

  const keys = visual.map((midi, pos) => {
    const off = mod12(midi - ref);
    return {
      pos,
      midi,
      freq: midiToFreq(midi, a4),
      rank: rankOf[pos],
      deg: off, // semitones above "1", 0..11
      degLabel: DEGREE_LABELS[off],
      oct: Math.floor((midi - baseRefMidi) / 12), // dots above (+) or below (-) the number
      pc: mod12(midi),
      octave: Math.floor(midi / 12) - 1, // scientific pitch notation (C4 = middle C)
    };
  });

  return { n, keys, lowest, highest };
}

// ---- Note names ---------------------------------------------------------------

const SOLFEGE = {
  es: ['Do', 'Re', 'Mi', 'Fa', 'Sol', 'La', 'Si'],
  pt: ['Dó', 'Ré', 'Mi', 'Fá', 'Sol', 'Lá', 'Si'],
  fr: ['Do', 'Ré', 'Mi', 'Fa', 'Sol', 'La', 'Si'],
  en: ['Do', 'Re', 'Mi', 'Fa', 'Sol', 'La', 'Si'],
};
const NATURAL_INDEX = { 0: 0, 2: 1, 4: 2, 5: 3, 7: 4, 9: 5, 11: 6 };
const SHARP_BASE = { 1: 0, 3: 1, 6: 3, 8: 4, 10: 5 }; // natural note below the sharp
const FLAT_BASE = { 1: 1, 3: 2, 6: 4, 8: 5, 10: 6 }; // natural note above the flat
const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

/** Should accidentals of this key be written as flats? */
export function usesFlats(root, scale) {
  const minor = scale === 'minor' || scale === 'pentMinor';
  const flatKeys = minor ? [2, 7, 0, 5, 10, 3] : [5, 10, 3, 8, 1, 6];
  return flatKeys.includes(mod12(root));
}

/**
 * Name of a pitch class.
 * style: 'solfege' (Do Re Mi, localised by `lang`) or 'letters' (C D E; German uses H and B).
 */
export function noteName(pc, style = 'letters', flats = false, lang = 'en') {
  pc = mod12(pc);
  if (style === 'solfege') {
    const names = SOLFEGE[lang] || SOLFEGE.en;
    if (pc in NATURAL_INDEX) return names[NATURAL_INDEX[pc]];
    return flats ? names[FLAT_BASE[pc]] + '♭' : names[SHARP_BASE[pc]] + '♯';
  }
  const german = lang === 'de';
  if (pc in NATURAL_INDEX) {
    const letter = LETTERS[NATURAL_INDEX[pc]];
    return german && letter === 'B' ? 'H' : letter;
  }
  if (german && pc === 10) return 'B'; // B-flat is simply "B" in German
  return flats ? LETTERS[FLAT_BASE[pc]] + '♭' : LETTERS[SHARP_BASE[pc]] + '♯';
}
