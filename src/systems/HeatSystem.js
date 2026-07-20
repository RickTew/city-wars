/**
 * Grid Heat — the city notices you. Rises with noise, fights, and nights.
 * Creates pressure to keep moving instead of camping HQ forever.
 */
import { ZONE } from '../config/constants.js';

export class HeatSystem {
  constructor() {
    this.level = 8;
    this.maxSeen = 8;
    this._warned50 = false;
    this._warned75 = false;
    this._patrolSpawned = false;
  }

  get label() {
    if (this.level >= 85) return 'HOT';
    if (this.level >= 60) return 'WARM';
    if (this.level >= 35) return 'RISING';
    return 'LOW';
  }

  get color() {
    if (this.level >= 85) return '#ef4444';
    if (this.level >= 60) return '#f97316';
    if (this.level >= 35) return '#eab308';
    return '#64748b';
  }

  add(amount, reason) {
    if (amount <= 0) return;
    this.level = Math.min(100, this.level + amount);
    this.maxSeen = Math.max(this.maxSeen, this.level);
    return { level: this.level, reason };
  }

  /** Explore tick — zone drift and HQ cooldown. */
  update(dt, scene) {
    const atHome = scene.isAtHomeBase?.();
    const zone = scene.zones.getZone(scene.player.tx, scene.player.ty);
    const night = scene.dayNight.isNight;

    if (atHome && !night && scene.mode !== 'combat') {
      this.level = Math.max(0, this.level - dt * 1.2);
    } else if (zone === ZONE.OUTER || zone === ZONE.WALL) {
      this.level = Math.min(100, this.level + dt * 2.5);
    } else if (zone === ZONE.MID) {
      this.level = Math.min(100, this.level + dt * 0.8);
    }

    this.maxSeen = Math.max(this.maxSeen, this.level);

    if (this.level >= 50 && !this._warned50) {
      this._warned50 = true;
      scene.log('Grid scan rising. The Wall is listening.');
    }
    if (this.level >= 75 && !this._warned75) {
      this._warned75 = true;
      scene.log('GRID SWEEP active. Patrol inbound. Stay off main arteries.');
      scene.audio?.patrol?.();
      scene.vfx?.heatSweepFlash?.();
      if (!this._patrolSpawned) {
        this._patrolSpawned = true;
        scene.spawnHeatPatrol?.();
      }
    }
    if (this.level < 70) this._patrolSpawned = false;
  }

  onCombatWon() {
    return this.add(10, 'combat');
  }

  onNight() {
    return this.add(6, 'night');
  }

  onSpotted() {
    return this.add(4, 'spotted');
  }

  onNoise() {
    return this.add(2, 'noise');
  }

  blocksHomeSleep() {
    return this.level >= 88;
  }

  serialize() {
    return {
      level: this.level,
      maxSeen: this.maxSeen,
      warned50: this._warned50,
      warned75: this._warned75,
      patrolSpawned: this._patrolSpawned,
    };
  }

  load(data) {
    if (!data) return;
    this.level = data.level ?? this.level;
    this.maxSeen = data.maxSeen ?? this.maxSeen;
    this._warned50 = !!data.warned50;
    this._warned75 = !!data.warned75;
    this._patrolSpawned = !!data.patrolSpawned;
  }
}
