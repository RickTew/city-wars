import { DAY_LENGTH, NIGHT_START } from '../config/constants.js';

/**
 * Full cycle t: 0 → 1
 * Day: 0 → NIGHT_START  — bar fills left → right
 * Night: NIGHT_START → 1 — bar empties right → left
 */
export class DayNight {
  constructor(daySeconds = DAY_LENGTH.medium) {
    this.daySeconds = daySeconds;
    this.t = 0; // start of day — bar empty
    this.day = 1;
    this.listeners = [];
  }

  setDaySeconds(sec) {
    this.daySeconds = sec;
  }

  get isNight() {
    return this.t >= NIGHT_START;
  }

  get phase() {
    if (this.t < 0.15) return 'dawn';
    if (this.t < NIGHT_START) return 'day';
    if (this.t < 0.9) return 'night';
    return 'late';
  }

  get label() {
    const map = { dawn: 'Dawn', day: 'Day', night: 'Night', late: 'Dead Hours' };
    return `Day ${this.day} · ${map[this.phase]}`;
  }

  /** Raw 0..1 cycle position */
  get progress() {
    return this.t;
  }

  /**
   * Bar fill 0..1:
   * Day: climbs 0 → 1 as day progresses
   * Night: falls 1 → 0 as night progresses
   */
  get barFill() {
    if (!this.isNight) {
      // day portion
      return PhaserMathClamp(this.t / NIGHT_START, 0, 1);
    }
    // night portion — reverse
    const nightLen = 1 - NIGHT_START;
    const intoNight = (this.t - NIGHT_START) / nightLen;
    return PhaserMathClamp(1 - intoNight, 0, 1);
  }

  get light() {
    if (!this.isNight) return 1;
    return 0.35 + this.barFill * 0.25;
  }

  update(dtSec) {
    const before = this.isNight;
    this.t += dtSec / this.daySeconds;
    if (this.t >= 1) {
      this.t -= 1;
      this.day += 1;
      this.emit('newday', this.day);
    }
    if (before !== this.isNight) {
      this.emit(this.isNight ? 'night' : 'day');
    }
  }

  sleepToMorning() {
    if (this.t > 0.05) this.day += 1;
    this.t = 0; // full morning — bar empty again
    this.emit('slept');
    this.emit('day');
  }

  on(fn) {
    this.listeners.push(fn);
  }

  emit(ev, data) {
    this.listeners.forEach((fn) => fn(ev, data));
  }
}

function PhaserMathClamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}
