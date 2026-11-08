import test from 'node:test';
import assert from 'node:assert/strict';
import { buildLayout, generateAscending, toVisualOrder, midiToFreq, noteName, usesFlats } from '../js/tunings.js';
import { DICT, LANGS } from '../js/i18n.js';
import { sanitize, DEFAULTS } from '../js/state.js';

const C17 = { root: 0, octave: 4, scale: 'major', keys: 17, custom: null };

test('17-key C major matches the strip printed on a real kalimba', () => {
  const layout = buildLayout(C17);
  assert.equal(layout.n, 17);
  const letters = layout.keys.map((k) => noteName(k.pc, 'letters')).join(' ');
  const numbers = layout.keys.map((k) => k.degLabel).join(' ');
  assert.equal(letters, 'D B G E C A F D C E G B D F A C E');
  assert.equal(numbers, '2 7 5 3 1 6 4 2 1 3 5 7 2 4 6 1 3');
});

test('range of the 17-key kalimba is C4 to E6', () => {
  const asc = generateAscending(C17);
  assert.equal(asc[0], 60); // C4
  assert.equal(asc[16], 88); // E6
});

test('lowest note sits in the middle and neighbours alternate outwards', () => {
  const asc = generateAscending(C17);
  const visual = toVisualOrder(asc);
  assert.equal(visual[8], asc[0]);
  assert.equal(visual[7], asc[1]);
  assert.equal(visual[9], asc[2]);
  assert.equal(visual[0], asc[15]);
  assert.equal(visual[16], asc[16]);
});

test('every layout has all the keys exactly once', () => {
  for (const keys of [5, 8, 10, 15, 17, 21, 24, 36]) {
    const asc = generateAscending({ ...C17, keys });
    const visual = toVisualOrder(asc);
    assert.equal(visual.length, keys);
    assert.deepEqual([...visual].sort((a, b) => a - b), asc);
  }
});

test('octave dots: C4 has none, C5 one, C6 two', () => {
  const byMidi = new Map(buildLayout(C17).keys.map((k) => [k.midi, k]));
  assert.equal(byMidi.get(60).oct, 0);
  assert.equal(byMidi.get(72).oct, 1);
  assert.equal(byMidi.get(84).oct, 2);
});

test('frequencies follow the reference pitch', () => {
  assert.equal(midiToFreq(69), 440);
  assert.ok(Math.abs(midiToFreq(60) - 261.6256) < 0.001);
  assert.ok(Math.abs(midiToFreq(69, 442) - 442) < 1e-9);
});

test('rank 0 is the lowest key and ranks cover every key', () => {
  const layout = buildLayout(C17);
  assert.equal(layout.keys[8].rank, 0);
  assert.deepEqual(layout.keys.map((k) => k.rank).sort((a, b) => a - b), [...Array(17).keys()]);
});

test('A minor reads 6 7 1 2 3 4 5 with no accidentals', () => {
  const layout = buildLayout({ root: 9, octave: 3, scale: 'minor', keys: 14, custom: null });
  assert.ok(layout.keys.every((k) => !/[♯♭]/.test(k.degLabel)));
  const lowest = layout.keys.find((k) => k.rank === 0);
  assert.equal(lowest.degLabel, '6');
  assert.equal(lowest.oct, 0);
});

test('G major uses sharps in its note names and relative numbers', () => {
  const g = buildLayout({ root: 7, octave: 4, scale: 'major', keys: 8, custom: null });
  const names = g.keys.map((k) => noteName(k.pc, 'letters', usesFlats(7, 'major')));
  assert.ok(names.includes('F♯'));
  assert.equal(g.keys.find((k) => k.rank === 0).degLabel, '1');
});

test('custom tunings are used exactly as given, left to right', () => {
  const custom = [64, 62, 60, 67, 65];
  const layout = buildLayout({ root: 0, octave: 4, scale: 'major', keys: 5, custom });
  assert.deepEqual(layout.keys.map((k) => k.midi), custom);
  assert.equal(layout.keys[2].rank, 0);
});

test('note names in each language', () => {
  assert.equal(noteName(0, 'solfege', false, 'es'), 'Do');
  assert.equal(noteName(0, 'solfege', false, 'pt'), 'Dó');
  assert.equal(noteName(2, 'solfege', false, 'fr'), 'Ré');
  assert.equal(noteName(11, 'letters', false, 'de'), 'H');
  assert.equal(noteName(10, 'letters', true, 'de'), 'B');
  assert.equal(noteName(11, 'letters', false, 'en'), 'B');
  assert.equal(noteName(10, 'letters', true, 'en'), 'B♭');
  assert.equal(noteName(1, 'solfege', false, 'es'), 'Do♯');
  assert.equal(noteName(3, 'solfege', true, 'es'), 'Mi♭');
});

test('all five languages have exactly the same keys as English', () => {
  assert.deepEqual(Object.keys(LANGS).sort(), ['de', 'en', 'es', 'fr', 'pt']);
  const reference = Object.keys(DICT.en).sort();
  for (const lang of Object.keys(LANGS)) {
    assert.deepEqual(Object.keys(DICT[lang]).sort(), reference, `missing or extra keys in ${lang}`);
    for (const [key, value] of Object.entries(DICT[lang])) {
      assert.ok(value.trim().length > 0, `${lang}:${key} is empty`);
      const placeholders = (s) => (s.match(/\{\w+\}/g) || []).sort().join();
      assert.equal(placeholders(value), placeholders(DICT.en[key]), `${lang}:${key} placeholders differ`);
    }
  }
});

test('settings validation repairs broken data', () => {
  const clean = sanitize({
    lang: 'xx', volume: 5, labels: 'nope', a4: 9999,
    tuning: { keys: 500, root: -3, scale: 'weird', custom: [1, 2, 3] },
  });
  assert.ok(clean.lang in LANGS);
  assert.equal(clean.volume, 1);
  assert.equal(clean.labels, DEFAULTS.labels);
  assert.equal(clean.a4, 480);
  assert.equal(clean.tuning.keys, 36);
  assert.equal(clean.tuning.root, 0);
  assert.equal(clean.tuning.scale, 'major');
  assert.equal(clean.tuning.custom, null);
  assert.deepEqual(sanitize(null).tuning, DEFAULTS.tuning);
});
