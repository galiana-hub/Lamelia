// The settings sheet. Everyday options first; tuning lives under "Advanced options".

import { t, LANGS } from './i18n.js';
import { DEFAULTS, resolveNoteStyle } from './state.js';
import { SCALE_IDS, MIN_KEYS, MAX_KEYS, noteName, buildLayout } from './tunings.js';

/** Tiny element builder: h('div', {class: 'x', onclick: fn}, child, child...) */
function h(tag, props = {}, ...kids) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else if (k in node) node[k] = v;
    else node.setAttribute(k, v === true ? '' : v);
  }
  node.append(...kids.flat().filter((x) => x !== null && x !== undefined && x !== false));
  return node;
}

function selectEl(options, value, onchange, props = {}) {
  const sel = h(
    'select',
    { ...props, onchange: (e) => onchange(e.target.value) },
    options.map(([val, label]) => h('option', { value: String(val), text: label })),
  );
  sel.value = String(value);
  return sel;
}

const row = (label, control) => h('label', { class: 'row' }, h('span', { text: label }), control);

function rangeRow(label, value, onInput, props = {}) {
  const pct = Math.round(value * 100);
  const out = h('output', { text: `${pct}%` });
  const input = h('input', {
    ...props,
    type: 'range',
    min: 0,
    max: 100,
    step: 1,
    value: pct,
    oninput: (e) => {
      out.textContent = `${e.target.value}%`;
      onInput(Number(e.target.value) / 100);
    },
  });
  return h('label', { class: 'row col' }, h('span', { class: 'top' }, h('span', { text: label }), out), input);
}

/**
 * @param {object} deps
 * @param {HTMLElement} deps.panel        the <aside> that holds the sheet
 * @param {() => object} deps.getState
 * @param {(mutator: (s: object) => void) => void} deps.update  change settings (validated and saved by the caller)
 * @param {object} deps.install           { isStandalone(), canPrompt(), prompt() }
 */
export function createSettings({ panel, getState, update, install }) {
  let isOpen = false;
  let advancedOpen = false;
  let opener = null;

  function build() {
    const s = getState();
    const style = resolveNoteStyle(s);
    const custom = Array.isArray(s.tuning.custom);
    const rootName = (pc) => noteName(pc, style, [1, 3, 8, 10].includes(pc), s.lang);
    const sharpName = (pc) => noteName(pc, style, false, s.lang);

    const head = h(
      'div',
      { class: 'sheet-head' },
      h('h2', { id: 'settingsTitle', text: t('settings.title') }),
      h(
        'button',
        { class: 'icon-btn', type: 'button', 'data-id': 'close', 'aria-label': t('settings.close'), onclick: close },
        h('span', { 'aria-hidden': 'true', text: '✕', style: 'font-size:20px' }),
      ),
    );

    const language = h(
      'section',
      { class: 'group' },
      row(
        t('settings.language'),
        selectEl(Object.entries(LANGS), s.lang, (v) => { update((st) => (st.lang = v)); render(); }, { 'data-id': 'lang' }),
      ),
    );

    const sound = h(
      'section',
      { class: 'group' },
      h('h3', { text: t('settings.sound') }),
      rangeRow(t('settings.volume'), s.volume, (v) => update((st) => (st.volume = v))),
      rangeRow(t('settings.reverb'), s.reverb, (v) => update((st) => (st.reverb = v))),
    );

    const display = h(
      'section',
      { class: 'group' },
      h('h3', { text: t('settings.display') }),
      row(
        t('settings.labels'),
        selectEl(
          [['both', t('labels.both')], ['numbers', t('labels.numbers')], ['names', t('labels.names')]],
          s.labels,
          (v) => update((st) => (st.labels = v)),
        ),
      ),
      row(
        t('settings.noteNames'),
        selectEl(
          [['auto', t('noteNames.auto')], ['solfege', t('noteNames.solfege')], ['letters', t('noteNames.letters')]],
          s.noteNames,
          (v) => update((st) => (st.noteNames = v)),
        ),
      ),
      row(
        t('settings.palette'),
        selectEl(
          [['normal', t('palette.normal')], ['cb', t('palette.cb')], ['shapes', t('palette.shapes')]],
          s.palette,
          (v) => update((st) => (st.palette = v)),
        ),
      ),
      h('p', { class: 'hint', text: t('palette.hint') }),
      row(
        t('settings.keepAwake'),
        h('input', { type: 'checkbox', checked: s.keepAwake, onchange: (e) => update((st) => (st.keepAwake = e.target.checked)) }),
      ),
    );

    let installGroup = null;
    if (!install.isStandalone()) {
      installGroup = h(
        'section',
        { class: 'group' },
        h('h3', { text: t('settings.install') }),
        install.canPrompt()
          ? h('button', { class: 'btn full', type: 'button', text: t('install.button'), onclick: async () => { await install.prompt(); render(); } })
          : h('p', { class: 'hint', text: t('install.hint') }),
      );
    }

    const presetControls = [
      row(
        t('tuning.keys'),
        h('input', {
          type: 'number', min: MIN_KEYS, max: MAX_KEYS, step: 1, value: s.tuning.keys, disabled: custom, inputMode: 'numeric', 'data-id': 'keys',
          onchange: (e) => { const v = Math.round(Number(e.target.value)); update((st) => (st.tuning.keys = v)); render(); },
        }),
      ),
      row(
        t('tuning.root'),
        selectEl(
          [...Array(12).keys()].map((pc) => [pc, rootName(pc)]),
          s.tuning.root,
          (v) => update((st) => (st.tuning.root = Number(v))),
          { disabled: custom },
        ),
      ),
      row(
        t('tuning.scale'),
        selectEl(
          SCALE_IDS.map((id) => [id, t(`scale.${id}`)]),
          s.tuning.scale,
          (v) => update((st) => (st.tuning.scale = v)),
          { disabled: custom },
        ),
      ),
      row(
        t('tuning.octave'),
        selectEl(
          [1, 2, 3, 4, 5, 6].map((o) => [o, String(o)]),
          s.tuning.octave,
          (v) => update((st) => (st.tuning.octave = Number(v))),
          { disabled: custom },
        ),
      ),
    ];

    const customToggle = row(
      t('tuning.custom'),
      h('input', {
        type: 'checkbox', checked: custom, 'data-id': 'custom',
        onchange: (e) => {
          update((st) => {
            st.tuning.custom = e.target.checked ? buildLayout(st.tuning, st.a4).keys.map((k) => k.midi) : null;
          });
          render();
        },
      }),
    );

    let customList = null;
    if (custom) {
      customList = h(
        'div',
        {},
        h('p', { class: 'hint', text: t('tuning.customHint') }),
        h(
          'div',
          { class: 'ckeys' },
          s.tuning.custom.map((midi, i) => {
            const pcSel = selectEl([...Array(12).keys()].map((pc) => [pc, sharpName(pc)]), ((midi % 12) + 12) % 12, apply, { 'aria-label': `${t('tuning.key', { n: i + 1 })}: ${t('tuning.note')}` });
            const ocSel = selectEl([1, 2, 3, 4, 5, 6, 7].map((o) => [o, String(o)]), Math.floor(midi / 12) - 1, apply, { 'aria-label': `${t('tuning.key', { n: i + 1 })}: ${t('tuning.octaveShort')}` });
            function apply() {
              const value = 12 * (Number(ocSel.value) + 1) + Number(pcSel.value);
              update((st) => { if (st.tuning.custom) st.tuning.custom[i] = value; });
            }
            return h('div', { class: 'ckey' }, h('span', { class: 'n', text: t('tuning.key', { n: i + 1 }) }), pcSel, ocSel);
          }),
        ),
      );
    }

    const advanced = h(
      'details',
      { class: 'advanced', open: advancedOpen, ontoggle: (e) => (advancedOpen = e.target.open) },
      h('summary', { text: t('settings.advanced') }),
      h('p', { class: 'hint', text: t('advanced.hint') }),
      h('h3', { text: t('tuning.title'), style: 'margin-top:16px' }),
      ...presetControls,
      row(
        t('tuning.a4'),
        h('input', {
          type: 'number', min: 400, max: 480, step: 0.5, value: s.a4, inputMode: 'decimal',
          onchange: (e) => { update((st) => (st.a4 = Number(e.target.value))); render(); },
        }),
      ),
      custom ? h('p', { class: 'hint', text: t('tuning.lockedHint') }) : null,
      customToggle,
      customList,
      h('button', {
        class: 'btn ghost full', type: 'button', 'data-id': 'reset', text: t('tuning.reset'),
        onclick: () => { update((st) => { st.tuning = { ...DEFAULTS.tuning }; st.a4 = DEFAULTS.a4; }); render(); },
      }),
    );

    return h('div', { class: 'sheet-inner' }, head, language, sound, display, installGroup, advanced);
  }

  /** Rebuild the sheet, keeping scroll position and keyboard focus. */
  function render() {
    const top = panel.scrollTop;
    const focusId = document.activeElement && panel.contains(document.activeElement) ? document.activeElement.dataset.id : null;
    panel.replaceChildren(build());
    panel.scrollTop = top;
    if (focusId) {
      const again = panel.querySelector(`[data-id="${focusId}"]`);
      if (again) again.focus({ preventScroll: true });
    }
  }

  function show() {
    isOpen = true;
    panel.inert = false;
    panel.classList.add('open');
  }

  function hide() {
    isOpen = false;
    panel.classList.remove('open');
    panel.inert = true;
    if (opener && opener.focus) opener.focus({ preventScroll: true });
  }

  function open(from) {
    if (isOpen) return;
    opener = from || null;
    render();
    panel.scrollTop = 0;
    show();
    history.pushState({ lamelia: 'settings' }, ''); // so the Android back button closes the sheet instead of the app
    const closeBtn = panel.querySelector('[data-id="close"]');
    if (closeBtn) closeBtn.focus({ preventScroll: true });
  }

  function close() {
    if (!isOpen) return;
    if (history.state && history.state.lamelia === 'settings') history.back();
    else hide();
  }

  window.addEventListener('popstate', () => {
    if (isOpen) hide();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpen) close();
  });

  return { open, close, render, isOpen: () => isOpen };
}
