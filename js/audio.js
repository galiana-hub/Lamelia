// Kalimba sound, synthesised with the Web Audio API (no sample files, instant start, works offline).

const MAX_VOICES = 24;

export class KalimbaAudio {
  constructor() {
    this.ctx = null;
    this.volume = 0.8;
    this.reverb = 0.25;
    this.voices = [];
    this.noise = null;
  }

  /** Create the audio graph the first time it is needed (must happen inside a user gesture). */
  ensure() {
    if (this.ctx) return this.ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    const ctx = new AC({ latencyHint: 'interactive' });

    this.master = ctx.createGain();
    this.master.gain.value = this.volume * this.volume;

    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.knee.value = 18;
    comp.ratio.value = 4;
    comp.attack.value = 0.003;
    comp.release.value = 0.2;

    this.dry = ctx.createGain();
    this.dry.connect(this.master);

    this.convolver = ctx.createConvolver();
    this.convolver.buffer = this._impulse(ctx, 1.8);
    this.wet = ctx.createGain();
    this.wet.gain.value = this.reverb * 0.7;
    this.convolver.connect(this.wet);
    this.wet.connect(this.master);

    this.bus = ctx.createGain(); // every voice goes here
    this.bus.connect(this.dry);
    this.bus.connect(this.convolver);

    this.master.connect(comp);
    comp.connect(ctx.destination);

    // A short burst of noise, shared by all notes, gives the "tick" of the thumb on the key.
    const len = Math.floor(ctx.sampleRate * 0.03);
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);

    this.ctx = ctx;
    return ctx;
  }

  resume() {
    const ctx = this.ensure();
    if (ctx && ctx.state !== 'running') return ctx.resume().catch(() => {});
    return Promise.resolve();
  }

  setVolume(v) {
    this.volume = v;
    if (this.ctx) this.master.gain.setTargetAtTime(v * v, this.ctx.currentTime, 0.02);
  }

  setReverb(v) {
    this.reverb = v;
    if (this.ctx) this.wet.gain.setTargetAtTime(v * 0.7, this.ctx.currentTime, 0.05);
  }

  _impulse(ctx, seconds) {
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
    }
    return buf;
  }

  /** Play one note. `freq` in Hz. */
  play(freq) {
    const ctx = this.ensure();
    if (!ctx) return;
    if (ctx.state !== 'running') ctx.resume().catch(() => {});

    const t0 = ctx.currentTime;
    const decay = Math.min(3.5, Math.max(0.8, 2.6 * Math.pow(261.63 / freq, 0.5)));
    const low = Math.min(1, Math.max(0, (400 - freq) / 200)); // phone speakers are weak below ~300 Hz
    const out = ctx.createGain();
    out.gain.setValueAtTime(0.0001, t0);
    out.gain.linearRampToValueAtTime(0.5, t0 + 0.003);
    out.gain.exponentialRampToValueAtTime(0.0001, t0 + decay);
    out.connect(this.bus);

    const nodes = [out];
    const partial = (ratio, gain, life, detune = 0) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq * ratio;
      osc.detune.value = detune;
      const g = ctx.createGain();
      g.gain.setValueAtTime(gain, t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + decay * life);
      osc.connect(g);
      g.connect(out);
      osc.start(t0);
      osc.stop(t0 + decay * life + 0.05);
      nodes.push(osc, g);
      return osc;
    };

    const main = partial(1, 1.0, 1.0); // fundamental (its end marks the end of the voice)
    partial(1, 0.35, 0.9, 4); // slightly detuned twin: the warm shimmer of a real tine
    partial(2, 0.16 + 0.3 * low, 0.5); // octave
    partial(5.4, 0.07, 0.07); // inharmonic metallic "ting"

    const click = ctx.createBufferSource();
    click.buffer = this.noise;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = Math.min(freq * 6, 7000);
    bp.Q.value = 1.2;
    const cg = ctx.createGain();
    cg.gain.value = 0.35;
    click.connect(bp);
    bp.connect(cg);
    cg.connect(out);
    click.start(t0);
    nodes.push(click, bp, cg);

    const voice = { out, nodes, end: t0 + decay + 0.1 };
    main.onended = () => this._release(voice);
    this.voices.push(voice);
    if (this.voices.length > MAX_VOICES) this._steal(this.voices[0]);
  }

  _steal(voice) {
    const ctx = this.ctx;
    try {
      voice.out.gain.cancelScheduledValues(ctx.currentTime);
      voice.out.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.015);
    } catch {
      /* already gone */
    }
    this._release(voice);
  }

  _release(voice) {
    const i = this.voices.indexOf(voice);
    if (i === -1) return;
    this.voices.splice(i, 1);
    setTimeout(() => {
      for (const n of voice.nodes) {
        try {
          n.disconnect();
        } catch {
          /* ignore */
        }
      }
    }, 300);
  }
}
