export class AudioBus {
  constructor() {
    this.ctx = null;
    this.on = true;
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
  move() {
    this.tone(180, 0.03, 'triangle', 0.025);
  }
  scavenge() {
    this.tone(400, 0.06, 'sine', 0.04, 120);
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
  hit() {
    this.tone(130, 0.09, 'sawtooth', 0.05, -30);
  }
  night() {
    this.tone(90, 0.3, 'sine', 0.03);
  }
  win() {
    [330, 392, 523].forEach((f, i) => setTimeout(() => this.tone(f, 0.12, 'square', 0.05), i * 90));
  }
}
