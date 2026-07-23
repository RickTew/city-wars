/**
 * SFX + fallen-city ambience (Web Audio).
 *
 * Organic events use samples under /audio/ambient/ (Mixkit free SFX).
 * Playback varies distance, pitch ("dog size"), and occasional canyon echo
 * so the same file rarely reads the same way twice.
 *
 * World tone: city already fell. Sparse distant chaos (long gaps).
 */

const MUTE_KEY = 'city_wars_mute_v1';

/** Sample banks — files in public/audio/ambient/ */
const SAMPLE_BANKS = {
  dog: [
    'dog_1.mp3',
    'dog_2.mp3',
    'dog_3.mp3',
    'dog_4.mp3',
    'dog_5.mp3',
    'dog_6.mp3',
    'dog_7.mp3',
    'dog_8.mp3',
    'dog_9.mp3',
    'dog_10.mp3',
    'dog_11.mp3',
  ],
  howl: [
    'howl_1.mp3',
    'howl_2.mp3',
    'howl_3.mp3',
    'howl_4.mp3',
    'howl_5.mp3',
    'howl_6.mp3',
    'howl_7.mp3',
    'howl_8.mp3',
  ],
  gun: [
    'gun_1.mp3',
    'gun_2.mp3',
    'gun_3.mp3',
    'gun_4.mp3',
    'gun_5.mp3',
    'gun_6.mp3',
    'gun_7.mp3',
    'gun_8.mp3',
    'gun_9.mp3',
    'gun_10.mp3',
    'gun_11.mp3',
    'gun_12.mp3',
  ],
  explosion: [
    'explosion_1.mp3',
    'explosion_2.mp3',
    'explosion_3.mp3',
    'explosion_4.mp3',
    'explosion_5.mp3',
    'explosion_6.mp3',
    'explosion_7.mp3',
    'explosion_8.mp3',
    'explosion_9.mp3',
    'explosion_10.mp3',
    'explosion_11.mp3',
    'impact_1.mp3',
    'impact_2.mp3',
    'impact_3.mp3',
  ],
  scream: [
    'scream_1.mp3',
    'scream_2.mp3',
    'scream_3.mp3',
    'scream_4.mp3',
    'scream_5.mp3',
    'scream_7.mp3',
    'scream_8.mp3',
  ],
  // yell bank removed — Mixkit “yells” included cheer/clap crowd beds (wrong tone)
  cyber: [
    'cyber_1.mp3',
    'cyber_2.mp3',
    'cyber_3.mp3',
    'cyber_4.mp3',
    'cyber_5.mp3',
    'cyber_6.mp3',
    'cyber_7.mp3',
    'glitch_1.mp3',
    'glitch_3.mp3',
  ],
};

/** Distance profiles: gain + lowpass + slight rate damp for far. */
const DISTANCE = {
  near: { gainMul: 1.15, lowpass: 4200, rateJitter: 0.04 },
  mid: { gainMul: 0.72, lowpass: 1800, rateJitter: 0.06 },
  far: { gainMul: 0.38, lowpass: 900, rateJitter: 0.08 },
  distant: { gainMul: 0.22, lowpass: 550, rateJitter: 0.1 },
};

function pickDistance() {
  const r = Math.random();
  if (r < 0.12) return 'near';
  if (r < 0.4) return 'mid';
  if (r < 0.75) return 'far';
  return 'distant';
}

export class AudioBus {
  constructor() {
    this.ctx = null;
    this.on = true;
    this._menuNodes = [];
    this._menuTimer = null;
    this._ambTimer = null;
    /** @type {null | 'menu' | 'world'} */
    this._ambMode = null;
    this._ambZoneFn = null;
    this._ambNightFn = null;
    this._buffers = {};
    this._samplesReady = false;
    this._samplesLoading = null;
    /** @type {string[]} recent file keys to avoid immediate repeats */
    this._recent = [];
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
    if (muted) {
      this.stopMenu();
      this.stopWorldAmb();
    }
  }

  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  async loadSamples() {
    if (this._samplesReady) return true;
    if (this._samplesLoading) return this._samplesLoading;
    const ctx = this.ensure();
    if (!ctx) return false;

    this._samplesLoading = (async () => {
      const names = [...new Set(Object.values(SAMPLE_BANKS).flat())];
      await Promise.all(
        names.map(async (file) => {
          if (this._buffers[file]) return;
          try {
            const res = await fetch(`/audio/ambient/${file}`);
            if (!res.ok) throw new Error(String(res.status));
            const arr = await res.arrayBuffer();
            this._buffers[file] = await ctx.decodeAudioData(arr.slice(0));
          } catch (e) {
            console.warn('[AudioBus] sample load failed:', file, e);
          }
        })
      );
      this._samplesReady = Object.keys(this._buffers).length > 0;
      this._samplesLoading = null;
      return this._samplesReady;
    })();

    return this._samplesLoading;
  }

  /**
   * Prefer files not recently played.
   */
  pickFile(bank) {
    const files = SAMPLE_BANKS[bank];
    if (!files?.length) return null;
    const loaded = files.filter((f) => this._buffers[f]);
    if (!loaded.length) return null;

    const fresh = loaded.filter((f) => !this._recent.includes(f));
    const pool = fresh.length ? fresh : loaded;
    const file = pool[(Math.random() * pool.length) | 0];

    this._recent.push(file);
    // Remember more as libraries grow so we don't cycle tight
    const keep = Math.min(14, Math.max(6, Math.floor(loaded.length * 0.55)));
    while (this._recent.length > keep) this._recent.shift();
    return file;
  }

  /**
   * Play sample with distance + optional canyon echo.
   * @param {string} bank
   * @param {{
   *   baseGain?: number,
   *   rate?: number,
   *   distance?: keyof typeof DISTANCE,
   *   echo?: boolean | 'auto',
   * }} opts
   */
  playSample(bank, opts = {}) {
    if (!this.on) return false;
    const ctx = this.ensure();
    if (!ctx) return false;
    const file = this.pickFile(bank);
    if (!file) return false;
    const buf = this._buffers[file];
    if (!buf) return false;

    const distKey = opts.distance || pickDistance();
    const dist = DISTANCE[distKey] || DISTANCE.far;

    let rate = opts.rate ?? 1;
    rate *= 1 + (Math.random() * 2 - 1) * dist.rateJitter;
    rate = Math.max(0.55, Math.min(1.55, rate));

    const gain = (opts.baseGain ?? 0.24) * dist.gainMul * (0.85 + Math.random() * 0.3);
    const lowpass = dist.lowpass * (0.85 + Math.random() * 0.3);

    const wantEcho =
      opts.echo === true || (opts.echo === 'auto' && Math.random() < 0.4) || (opts.echo == null && Math.random() < 0.35);

    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lowpass;
    filter.Q.value = 0.55;

    const g = ctx.createGain();
    const t = ctx.currentTime;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.015);

    const dur = Math.min(buf.duration / rate, 5.5);
    if (dur > 0.35) {
      g.gain.setValueAtTime(gain, t + dur * 0.5);
      g.gain.linearRampToValueAtTime(0.0001, t + dur);
    }

    const pan = ctx.createStereoPanner?.();
    const panVal = (Math.random() * 2 - 1) * (distKey === 'near' ? 0.35 : 0.85);

    src.connect(filter);
    filter.connect(g);

    /** @type {AudioNode} */
    let tail = g;
    if (pan) {
      pan.pan.value = panVal;
      g.connect(pan);
      tail = pan;
    }

    if (wantEcho && ctx.createDelay) {
      // Simple canyon slap — delay + filtered feedback, wet only
      const delay = ctx.createDelay(1.2);
      delay.delayTime.value = 0.14 + Math.random() * 0.28; // 140–420ms
      const fb = ctx.createGain();
      fb.gain.value = 0.22 + Math.random() * 0.2;
      const wet = ctx.createGain();
      wet.gain.value = 0.28 + Math.random() * 0.25;
      const echoFilter = ctx.createBiquadFilter();
      echoFilter.type = 'lowpass';
      echoFilter.frequency.value = Math.min(1200, lowpass * 0.7);

      tail.connect(delay);
      delay.connect(echoFilter);
      echoFilter.connect(fb);
      fb.connect(delay);
      echoFilter.connect(wet);
      wet.connect(ctx.destination);
    }

    tail.connect(ctx.destination);
    src.start(t);
    src.stop(t + dur + (wantEcho ? 0.9 : 0.05));
    return true;
  }

  tone(f, d = 0.08, type = 'square', g = 0.04, slide = 0) {
    if (!this.on) return;
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const gain = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(Math.max(20, f), t);
    if (slide) o.frequency.linearRampToValueAtTime(Math.max(20, f + slide), t + d);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(g, t + 0.005);
    gain.gain.linearRampToValueAtTime(0.0001, t + d);
    o.connect(gain);
    gain.connect(ctx.destination);
    o.start(t);
    o.stop(t + d + 0.03);
  }

  noise(d = 0.08, g = 0.02, { lowpass = 900, band = 0 } = {}) {
    if (!this.on) return;
    const ctx = this.ensure();
    if (!ctx) return;
    const n = Math.max(1, Math.floor(ctx.sampleRate * d));
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < n; i++) {
      const env = Math.sin((i / n) * Math.PI);
      data[i] = (Math.random() * 2 - 1) * env;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    if (band > 0) {
      filter.type = 'bandpass';
      filter.frequency.value = band;
      filter.Q.value = 0.7;
    } else {
      filter.type = 'lowpass';
      filter.frequency.value = lowpass;
      filter.Q.value = 0.5;
    }
    const t = ctx.currentTime;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(g, t + 0.008);
    gain.gain.linearRampToValueAtTime(0.0001, t + d);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start();
  }

  uiClick() {
    this.ensure();
    this.tone(420, 0.04, 'triangle', 0.05);
    this.tone(620, 0.05, 'sine', 0.035, 40);
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
  pulse() {
    this.tone(520, 0.07, 'sine', 0.025, -80);
  }
  popup() {
    this.tone(280, 0.1, 'triangle', 0.035);
    setTimeout(() => this.tone(360, 0.12, 'sine', 0.03), 60);
  }

  // ── Distant events ────────────────────────────────────────────────

  /** Dogs: pitch = size (high rate = small, low = big), varied distance. */
  ambDog() {
    // small / medium / large-ish pack dogs
    const size = Math.random();
    let rate;
    if (size < 0.28) rate = 1.15 + Math.random() * 0.35; // small / yappy
    else if (size < 0.7) rate = 0.9 + Math.random() * 0.2; // medium
    else rate = 0.62 + Math.random() * 0.2; // big / deep
    this.playSample('dog', {
      baseGain: 0.22,
      rate,
      distance: pickDistance(),
      echo: Math.random() < 0.45 ? true : 'auto',
    });
  }

  ambHowl() {
    // Howls almost always far / distant + echo (alley / canyon)
    const dist = Math.random() < 0.55 ? 'distant' : 'far';
    this.playSample('howl', {
      baseGain: 0.2,
      rate: 0.85 + Math.random() * 0.3,
      distance: dist,
      echo: true,
    });
  }

  ambGun() {
    const dist = pickDistance();
    // Near-ish crack sometimes, usually mid/far
    this.playSample('gun', {
      baseGain: 0.3,
      rate: 0.92 + Math.random() * 0.16,
      distance: dist,
      echo: dist === 'far' || dist === 'distant' ? true : Math.random() < 0.25,
    });
  }

  ambExplosion() {
    // Booms prefer mid–distant; echo common
    const dist = Math.random() < 0.2 ? 'mid' : Math.random() < 0.55 ? 'far' : 'distant';
    this.playSample('explosion', {
      baseGain: 0.34,
      rate: 0.85 + Math.random() * 0.25,
      distance: dist,
      echo: Math.random() < 0.65,
    });
  }

  ambScream() {
    this.playSample('scream', {
      baseGain: 0.17,
      rate: 0.88 + Math.random() * 0.28,
      distance: Math.random() < 0.4 ? 'far' : pickDistance(),
      echo: Math.random() < 0.55,
    });
  }

  ambCyber() {
    this.playSample('cyber', {
      baseGain: 0.12,
      rate: 0.8 + Math.random() * 0.45,
      distance: pickDistance(),
      echo: Math.random() < 0.3,
    });
  }

  ambCrackle() {
    this.noise(0.2, 0.018, { lowpass: 1100 });
  }

  playDistantEvent() {
    if (!this.on || !this._ambMode) return;
    this.ensure();
    const roll = Math.random();
    // Outer/wall skew slightly toward violence when in world mode
    let gunBias = 0;
    if (this._ambMode === 'world') {
      const z = this._ambZoneFn?.() || 'home';
      if (z === 'green' || z === 'outer') gunBias = 0.05;
      if (z === 'blue') gunBias = 0.09;
      if (z === 'red' || z === 'wall') gunBias = 0.14;
    }

    // No cheer/clap “yells” — dogs, howls, guns, booms, screams, cyber only
    if (roll < 0.18) this.ambDog();
    else if (roll < 0.32) this.ambHowl();
    else if (roll < 0.52 + gunBias) this.ambGun();
    else if (roll < 0.68 + gunBias) this.ambExplosion();
    else if (roll < 0.82) this.ambScream();
    else if (roll < 0.94) this.ambCyber();
    else this.ambCrackle();

    // Occasional double-hit (gun then scream, dogs then howl) — rare
    if (Math.random() < 0.12) {
      setTimeout(() => {
        if (!this._ambMode || !this.on) return;
        const follow = Math.random();
        if (follow < 0.35) this.ambGun();
        else if (follow < 0.55) this.ambScream();
        else if (follow < 0.75) this.ambDog();
        else this.ambHowl();
      }, 400 + Math.random() * 900);
    }
  }

  _clearAmbTimers() {
    if (this._menuTimer) {
      clearInterval(this._menuTimer);
      this._menuTimer = null;
    }
    if (this._ambTimer) {
      clearTimeout(this._ambTimer);
      this._ambTimer = null;
    }
  }

  /**
   * Gap between events.
   * - menu: 2–10s (players leave title fast)
   * - world: 2–22s base, stretched in safe / compressed toward Wall
   *   Night slightly denser. Zone fn can be refined later (POIs, heat, etc.).
   */
  _nextGapMs() {
    if (this._ambMode === 'menu') {
      return 2000 + Math.random() * 8000; // 2–10s
    }

    // world — denser ambience as rings go Yellow → Red
    const zone = this._ambZoneFn?.() || 'home';
    const night = !!this._ambNightFn?.();
    let min = 3000;
    let max = 22000;
    if (zone === 'home' || zone === 'safe') {
      min = 8000;
      max = 28000;
    } else if (zone === 'yellow' || zone === 'mid') {
      min = 5000;
      max = 22000;
    } else if (zone === 'orange') {
      min = 4000;
      max = 18000;
    } else if (zone === 'green' || zone === 'outer') {
      min = 2800;
      max = 14000;
    } else if (zone === 'blue') {
      min = 2400;
      max = 12000;
    } else if (zone === 'red' || zone === 'wall') {
      min = 2000;
      max = 10000;
    }
    if (night) {
      min = Math.max(2000, min * 0.75);
      max = Math.max(min + 1000, max * 0.85);
    }
    return min + Math.random() * (max - min);
  }

  _scheduleNextAmb() {
    if (!this._ambMode) return;
    const wait = this._nextGapMs();
    this._ambTimer = setTimeout(() => {
      if (!this._ambMode || !this.on) return;
      this.playDistantEvent();
      this._scheduleNextAmb();
    }, wait);
  }

  menuIntro() {
    if (!this.on) return;
    const ctx = this.ensure();
    if (!ctx) return;

    this.loadSamples().catch(() => {});

    // Already on menu ambience — kick once after unlock
    if (this._ambMode === 'menu' && this._menuNodes.length) {
      if (ctx.state === 'running' && !this._kickedOnce) {
        this._kickedOnce = true;
        this.loadSamples().then((ok) => {
          if (ok && this._ambMode === 'menu') this.playDistantEvent();
        });
      }
      return;
    }

    // Switching from world → menu
    this.stopWorldAmb();

    this._ambMode = 'menu';
    this._ambZoneFn = null;
    this._ambNightFn = null;
    this._kickedOnce = false;
    const t0 = ctx.currentTime;

    const drone = ctx.createOscillator();
    const droneGain = ctx.createGain();
    const droneFilter = ctx.createBiquadFilter();
    drone.type = 'sine';
    drone.frequency.setValueAtTime(48, t0);
    droneFilter.type = 'lowpass';
    droneFilter.frequency.value = 120;
    droneGain.gain.setValueAtTime(0.0001, t0);
    droneGain.gain.linearRampToValueAtTime(0.03, t0 + 1.5);
    drone.connect(droneFilter);
    droneFilter.connect(droneGain);
    droneGain.connect(ctx.destination);
    drone.start(t0);
    this._menuNodes.push(drone, droneGain);

    const grit = ctx.createOscillator();
    const gritGain = ctx.createGain();
    grit.type = 'triangle';
    grit.frequency.setValueAtTime(72, t0);
    gritGain.gain.setValueAtTime(0.0001, t0);
    gritGain.gain.linearRampToValueAtTime(0.01, t0 + 2);
    grit.connect(gritGain);
    gritGain.connect(ctx.destination);
    grit.start(t0);
    this._menuNodes.push(grit, gritGain);

    const startAmb = () => {
      if (this._ambMode !== 'menu' || !this.on) return;
      this.playDistantEvent();
      this._scheduleNextAmb();
    };

    // Menu: first hit soon (title isn't a long sit)
    this.loadSamples().then(() => {
      if (this._ambMode !== 'menu') return;
      this._ambTimer = setTimeout(startAmb, 800 + Math.random() * 1200);
    });
    setTimeout(() => {
      if (this._ambMode === 'menu' && !this._ambTimer) {
        this._ambTimer = setTimeout(startAmb, 300);
      }
    }, 2500);
  }

  unlockAndMenu() {
    this.ensure();
    this.menuIntro();
  }

  /**
   * In-run ambience. Zone callback drives density (safe quiet → Wall loud).
   * @param {{ getZone?: () => string, isNight?: () => boolean }} opts
   */
  startWorldAmb(opts = {}) {
    if (!this.on) return;
    this.ensure();
    this.stopMenu(); // clears menu bed + timers
    this._ambMode = 'world';
    this._ambZoneFn = typeof opts.getZone === 'function' ? opts.getZone : null;
    this._ambNightFn = typeof opts.isNight === 'function' ? opts.isNight : null;

    const kick = () => {
      if (this._ambMode !== 'world' || !this.on) return;
      this.playDistantEvent();
      this._scheduleNextAmb();
    };

    this.loadSamples().then(() => {
      if (this._ambMode !== 'world') return;
      // First world hit after a short beat
      this._ambTimer = setTimeout(kick, 1500 + Math.random() * 2500);
    });
  }

  stopWorldAmb() {
    if (this._ambMode === 'world') this._ambMode = null;
    this._ambZoneFn = null;
    this._ambNightFn = null;
    this._clearAmbTimers();
  }

  stopMenu() {
    this._kickedOnce = false;
    if (this._ambMode === 'menu') this._ambMode = null;
    this._clearAmbTimers();
    const ctx = this.ctx;
    const nodes = this._menuNodes;
    this._menuNodes = [];
    if (!ctx || !nodes.length) return;
    const t = ctx.currentTime;
    nodes.forEach((n) => {
      try {
        if (n.gain) {
          n.gain.cancelScheduledValues(t);
          n.gain.linearRampToValueAtTime(0.0001, t + 0.35);
        }
        if (n.stop) n.stop(t + 0.4);
        else if (n.disconnect) setTimeout(() => n.disconnect(), 450);
      } catch (_) {
        /* ignore */
      }
    });
  }
}
