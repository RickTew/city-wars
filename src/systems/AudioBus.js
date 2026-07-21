/**
 * Procedural SFX + menu intro (Web Audio). No asset files required.
 * Mute persists in localStorage.
 */
const MUTE_KEY = 'city_wars_mute_v1';

export class AudioBus {
  constructor() {
    this.ctx = null;
    this.on = true;
    this._menuNodes = [];
    this._menuTimer = null;
  }

  loadMute() {
    try {
      const v = localStorage.getItem(MUTE_KEY);
      if (v === '1') this.on = false;
      if (v === '0') this.on = true;
    } catch (_) {
      /* ignore */
    }
  }

  setMuted(muted) {
    this.on = !muted;
    try {
      localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
    } catch (_) {
      /* ignore */
    }
    if (muted) this.stopMenu();
  }

  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }

  tone(f, d = 0.08, type = 'square', g = 0.04, slide = 0) {
    if (!this.on) return;
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const gain = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.linearRampToValueAtTime(f + slide, t + d);
    gain.gain.setValueAtTime(g, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + d);
    o.connect(gain);
    gain.connect(ctx.destination);
    o.start(t);
    o.stop(t + d + 0.02);
  }

  /** Soft noise burst (fire crackle / ash). */
  noise(d = 0.08, g = 0.02) {
    if (!this.on) return;
    const ctx = this.ensure();
    if (!ctx) return;
    const n = Math.max(1, Math.floor(ctx.sampleRate * d));
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 900;
    filter.Q.value = 0.6;
    gain.gain.setValueAtTime(g, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + d);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start();
  }

  uiClick() {
    this.tone(420, 0.04, 'triangle', 0.03);
    this.tone(620, 0.05, 'sine', 0.02, 40);
  }

  move() {
    this.tone(180, 0.03, 'triangle', 0.025);
  }
  scavenge() {
    this.tone(400, 0.06, 'sine', 0.04, 120);
    this.noise(0.05, 0.015);
  }
  craft() {
    this.tone(300, 0.08, 'square', 0.04);
    setTimeout(() => this.tone(500, 0.1, 'square', 0.04), 70);
  }
  yellow() {
    this.tone(240, 0.12, 'sawtooth', 0.04);
  }
  red() {
    this.tone(100, 0.2, 'sawtooth', 0.06, -40);
  }
  patrol() {
    this.tone(70, 0.35, 'sawtooth', 0.05, -25);
    setTimeout(() => this.tone(55, 0.25, 'square', 0.04), 120);
  }
  hit() {
    this.tone(130, 0.09, 'sawtooth', 0.05, -30);
    this.noise(0.06, 0.025);
  }
  night() {
    this.tone(90, 0.3, 'sine', 0.03);
  }
  win() {
    [330, 392, 523].forEach((f, i) => setTimeout(() => this.tone(f, 0.12, 'square', 0.05), i * 90));
  }
  /** Guide pulse cue */
  pulse() {
    this.tone(520, 0.07, 'sine', 0.025, -80);
  }
  popup() {
    this.tone(280, 0.1, 'triangle', 0.035);
    setTimeout(() => this.tone(360, 0.12, 'sine', 0.03), 60);
  }

  /**
   * Dark comedy intro: low drone + distant siren + fire crackle + sparse motif.
   * Loops until stopMenu().
   */
  menuIntro() {
    if (!this.on) return;
    const ctx = this.ensure();
    if (!ctx || this._menuNodes.length) return;
    const t0 = ctx.currentTime;

    // Bass drone
    const drone = ctx.createOscillator();
    const droneGain = ctx.createGain();
    drone.type = 'sine';
    drone.frequency.setValueAtTime(55, t0);
    droneGain.gain.setValueAtTime(0.0001, t0);
    droneGain.gain.linearRampToValueAtTime(0.035, t0 + 1.2);
    drone.connect(droneGain);
    droneGain.connect(ctx.destination);
    drone.start(t0);
    this._menuNodes.push(drone, droneGain);

    // Sub saw (grit)
    const grit = ctx.createOscillator();
    const gritGain = ctx.createGain();
    grit.type = 'sawtooth';
    grit.frequency.setValueAtTime(82.5, t0);
    gritGain.gain.setValueAtTime(0.0001, t0);
    gritGain.gain.linearRampToValueAtTime(0.012, t0 + 1.5);
    grit.connect(gritGain);
    gritGain.connect(ctx.destination);
    grit.start(t0);
    this._menuNodes.push(grit, gritGain);

    // Siren wail (LFO-ish via frequency ramp loop)
    const siren = ctx.createOscillator();
    const sirenGain = ctx.createGain();
    siren.type = 'sine';
    siren.frequency.setValueAtTime(420, t0);
    sirenGain.gain.setValueAtTime(0.0001, t0);
    sirenGain.gain.linearRampToValueAtTime(0.018, t0 + 2);
    siren.connect(sirenGain);
    sirenGain.connect(ctx.destination);
    siren.start(t0);
    this._menuNodes.push(siren, sirenGain);

    const swingSiren = () => {
      if (!this._menuNodes.length || !this.ctx) return;
      const t = this.ctx.currentTime;
      try {
        siren.frequency.cancelScheduledValues(t);
        siren.frequency.setValueAtTime(380, t);
        siren.frequency.linearRampToValueAtTime(620, t + 1.6);
        siren.frequency.linearRampToValueAtTime(380, t + 3.2);
      } catch (_) {
        /* ignore */
      }
    };
    swingSiren();
    this._sirenIv = setInterval(swingSiren, 3200);

    // Motif + crackle on a timer
    const motif = [196, 233, 220, 175, 0, 196, 156];
    let mi = 0;
    this._menuTimer = setInterval(() => {
      if (!this.on || !this._menuNodes.length) return;
      this.noise(0.12, 0.012);
      const f = motif[mi % motif.length];
      mi += 1;
      if (f) this.tone(f, 0.28, 'triangle', 0.022, -12);
    }, 900);
  }

  stopMenu() {
    if (this._menuTimer) {
      clearInterval(this._menuTimer);
      this._menuTimer = null;
    }
    if (this._sirenIv) {
      clearInterval(this._sirenIv);
      this._sirenIv = null;
    }
    const ctx = this.ctx;
    const nodes = this._menuNodes;
    this._menuNodes = [];
    if (!ctx || !nodes.length) return;
    const t = ctx.currentTime;
    nodes.forEach((n) => {
      try {
        if (n.gain) {
          n.gain.cancelScheduledValues(t);
          n.gain.linearRampToValueAtTime(0.0001, t + 0.4);
        }
        if (n.stop) n.stop(t + 0.45);
        else if (n.disconnect) setTimeout(() => n.disconnect(), 500);
      } catch (_) {
        /* ignore */
      }
    });
  }
}
