import { ALERT } from '../config/constants.js';

/**
 * GREEN = free roam
 * YELLOW = noise heard — investigation check; hide or get spotted
 * RED = combat / fully spotted
 */
export class AlertSystem {
  constructor() {
    this.state = ALERT.GREEN;
    this.yellowTimer = 0;
    this.investigateFrom = null; // {x,y} noise source
    this.cooldown = 0;
  }

  get isCombat() {
    return this.state === ALERT.RED;
  }

  get label() {
    return {
      [ALERT.GREEN]: 'CLEAR',
      [ALERT.YELLOW]: 'CAUTION',
      [ALERT.RED]: 'HOSTILE',
    }[this.state];
  }

  get color() {
    return {
      [ALERT.GREEN]: '#22c55e',
      [ALERT.YELLOW]: '#eab308',
      [ALERT.RED]: '#ef4444',
    }[this.state];
  }

  makeNoise(amount, tx, ty, nearbyEnemies, rng = Math.random) {
    if (this.state === ALERT.RED) return { result: 'already_red' };
    if (this.cooldown > 0) return { result: 'cooldown' };

    // Who can hear?
    const hearers = nearbyEnemies.filter((e) => {
      if (!e.alive) return false;
      const d = Math.abs(e.tx - tx) + Math.abs(e.ty - ty);
      const range = e.hearRange || 6;
      return d <= range * (0.5 + amount);
    });

    if (!hearers.length) return { result: 'unheard' };

    // YELLOW check
    if (this.state === ALERT.GREEN) {
      this.state = ALERT.YELLOW;
      this.yellowTimer = 2.8;
      this.investigateFrom = { x: tx, y: ty };
      // chance escalate immediately if loud + close
      const close = hearers.some((e) => Math.abs(e.tx - tx) + Math.abs(e.ty - ty) <= 3);
      if (close && amount > 0.5 && rng() < 0.35) {
        this.spot();
        return { result: 'spotted', hearers };
      }
      return { result: 'yellow', hearers };
    }

    // Already yellow — noise more likely spots
    if (rng() < 0.25 + amount * 0.5) {
      this.spot();
      return { result: 'spotted', hearers };
    }
    this.yellowTimer = Math.max(this.yellowTimer, 2);
    return { result: 'yellow_refresh', hearers };
  }

  /** Enemy LOS / contact */
  spot() {
    this.state = ALERT.RED;
    this.yellowTimer = 0;
  }

  /** Player starts fight */
  engage() {
    this.state = ALERT.RED;
  }

  /** Hide during yellow — chance to go clear */
  tryHide(rng = Math.random) {
    if (this.state !== ALERT.YELLOW) return { ok: false, reason: 'not_yellow' };
    if (rng() < 0.65) {
      this.state = ALERT.GREEN;
      this.yellowTimer = 0;
      this.cooldown = 1.2;
      return { ok: true, cleared: true };
    }
    this.spot();
    return { ok: true, cleared: false };
  }

  /** Tick real-time seconds */
  update(dt, playerHidden) {
    if (this.cooldown > 0) this.cooldown -= dt;

    if (this.state === ALERT.YELLOW) {
      this.yellowTimer -= dt;
      if (playerHidden && this.yellowTimer < 1.5) {
        // lingering hide helps
      }
      if (this.yellowTimer <= 0) {
        // failed to resolve — 40% spot else clear
        if (Math.random() < 0.4) this.spot();
        else {
          this.state = ALERT.GREEN;
          this.cooldown = 0.8;
        }
      }
    }
  }

  /** After combat won */
  clearCombat() {
    this.state = ALERT.GREEN;
    this.yellowTimer = 0;
    this.cooldown = 2;
  }
}
