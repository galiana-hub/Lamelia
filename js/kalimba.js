// The playable kalimba: renders the keys and turns touches into notes.

import { t } from './i18n.js';
import { noteName } from './tunings.js';

const OKABE_ITO = ['#E69F00', '#56B4E9', '#009E73', '#F0E442', '#0072B2', '#D55E00', '#CC79A7'];
const SHAPES = ['●', '■', '▲', '◆', '★', '✚', '▼'];
const MAJOR_INDEX = { 0: 0, 2: 1, 4: 2, 5: 3, 7: 4, 9: 5, 11: 6 };

/** Colour and shape of a key, depending on its position in the scale and the chosen palette. */
function markFor(deg, palette) {
  const idx = MAJOR_INDEX[deg];
  const shape = idx === undefined ? '○' : SHAPES[idx];
  if (palette === 'cb') return { shape, color: idx === undefined ? '#e0e0e0' : OKABE_ITO[idx], showShape: true };
  if (palette === 'shapes') return { shape, color: '#f2e9d8', showShape: true };
  return { shape, color: `hsl(${deg * 30} 90% 62%)`, showShape: false };
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export class Kalimba {
  /**
   * @param {HTMLElement} root     where the kalimba is drawn
   * @param {object} options
   * @param {import('./audio.js').KalimbaAudio} options.audio
   * @param {(note: object) => void} [options.onNote]  called every time a key is played
   */
  constructor(root, { audio, onNote } = {}) {
    this.root = root;
    this.audio = audio;
    this.onNote = onNote || (() => {});
    this.layout = null;
    this.view = null;
    this.tineEls = [];
    this.ringTimers = new Map();
    this.pointers = new Map(); // pointerId -> index of the key under the finger (or null)

    this.board = el('div', 'board');
    this.board.setAttribute('role', 'group');
    this.tinesWrap = el('div', 'tines-wrap');
    this.tines = el('div', 'tines');
    this.railTop = el('div', 'rail rail-top');
    this.railMid = el('div', 'rail rail-mid');
    this.tinesWrap.append(this.tines, this.railTop, this.railMid);

    this.lower = el('div', 'lower');
    this.lower.append(el('div', 'hole'), el('div', 'engraving', 'Lamelia'));
    this.board.append(this.tinesWrap, this.lower);
    root.replaceChildren(this.board);

    this.tines.addEventListener('pointerdown', (e) => this._down(e));
    this.tines.addEventListener('pointermove', (e) => this._move(e));
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
      this.tines.addEventListener(type, (e) => this.pointers.delete(e.pointerId));
    }
    this.tines.addEventListener('contextmenu', (e) => e.preventDefault());
    this.tines.addEventListener('keydown', (e) => this._key(e));

    if (typeof ResizeObserver !== 'undefined') {
      new ResizeObserver(() => this._measure()).observe(this.tines);
    }
  }

  /** Redraw the keys. `view` holds the display options. */
  setLayout(layout, view) {
    this.layout = layout;
    this.view = view;
    this.board.setAttribute('aria-label', t('kalimba.aria'));
    this.board.dataset.labels = view.labels;
    this.board.dataset.palette = view.palette;

    const n = layout.n;
    const tines = layout.keys.map((key) => {
      const mark = markFor(key.deg, view.palette);
      const name = noteName(key.pc, view.noteStyle, view.flats, view.lang);

      const tine = el('div', 'tine');
      tine.dataset.i = String(key.pos);
      tine.tabIndex = 0;
      tine.setAttribute('role', 'button');
      tine.setAttribute('aria-label', t('tine.aria', { name: `${name}${key.octave}` }));
      tine.style.setProperty('--h', `${100 - 38 * (n > 1 ? key.rank / (n - 1) : 0)}%`);
      tine.style.setProperty('--c', view.palette === 'normal' ? mark.color : '#f2e9d8');

      const metal = el('span', 'metal');
      const label = el('span', 'label');

      const chip = el('span', 'chip', mark.showShape ? mark.shape : '');
      chip.style.setProperty('--mc', mark.color);
      chip.classList.toggle('shape', mark.showShape);

      const num = el('span', 'num');
      if (key.oct > 0) num.append(el('i', 'dots up', '•'.repeat(Math.min(key.oct, 3))));
      num.append(el('b', '', key.degLabel));
      if (key.oct < 0) num.append(el('i', 'dots down', '•'.repeat(Math.min(-key.oct, 3))));

      const nm = el('span', 'nm', name);
      const oc = el('span', 'oc', String(key.octave));

      label.append(chip, num, nm, oc);
      metal.append(label);
      tine.append(metal);
      return tine;
    });

    this.tineEls = tines;
    this.tines.replaceChildren(...tines);
    this.tines.style.setProperty('--n', String(n));
    this._measure();
  }

  _measure() {
    const w = this.tines.clientWidth;
    if (w > 0 && this.layout) this.board.style.setProperty('--kw', `${w / this.layout.n}px`);
  }

  _keyAt(x, y) {
    const node = document.elementFromPoint(x, y);
    const tine = node && node.closest ? node.closest('.tine') : null;
    return tine && this.tines.contains(tine) ? Number(tine.dataset.i) : null;
  }

  _down(e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    this.audio.resume();
    try {
      this.tines.setPointerCapture(e.pointerId);
    } catch {
      /* capture is a nicety, not a requirement */
    }
    const i = this._keyAt(e.clientX, e.clientY);
    this.pointers.set(e.pointerId, i);
    if (i !== null) this.trigger(i);
  }

  _move(e) {
    if (!this.pointers.has(e.pointerId)) return;
    const i = this._keyAt(e.clientX, e.clientY);
    if (i === this.pointers.get(e.pointerId)) return;
    this.pointers.set(e.pointerId, i);
    if (i !== null) this.trigger(i); // sliding a finger across the keys plays them one after another
  }

  _key(e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const tine = e.target.closest ? e.target.closest('.tine') : null;
    if (!tine) return;
    e.preventDefault();
    this.audio.resume();
    this.trigger(Number(tine.dataset.i));
  }

  /** Play the key at visual position `i` and animate it. */
  trigger(i) {
    const key = this.layout && this.layout.keys[i];
    if (!key) return;
    this.audio.play(key.freq);
    this.ring(i);
    this.onNote({ ...key, time: performance.now() });
  }

  ring(i) {
    const tine = this.tineEls[i];
    if (!tine) return;
    tine.classList.remove('ring');
    void tine.offsetWidth; // restart the animation if the key is struck again
    tine.classList.add('ring');
    clearTimeout(this.ringTimers.get(i));
    this.ringTimers.set(i, setTimeout(() => tine.classList.remove('ring'), 600));
  }
}
