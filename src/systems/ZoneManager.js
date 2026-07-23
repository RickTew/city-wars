import {
  CENTER_X,
  CENTER_Y,
  MAP_H,
  MAP_W,
  ZONE,
  ZONE_ENTER,
  ZONE_LEGACY,
  ZONE_META,
  ZONE_R,
} from '../config/constants.js';

/**
 * Concentric city rings from HQ.
 * HOME (start) + 5 enterable levels: Yellow → Orange → Green → Blue → Red.
 */
export class ZoneManager {
  manhattan(tx, ty) {
    return Math.abs(tx - CENTER_X) + Math.abs(ty - CENTER_Y);
  }

  /** Normalize legacy zone ids if any save/story still uses them. */
  normalize(z) {
    if (!z) return ZONE.HOME;
    if (ZONE_META[z]) return z;
    return ZONE_LEGACY[z] || ZONE.HOME;
  }

  getZone(tx, ty) {
    const d = this.manhattan(tx, ty);
    if (d <= ZONE_R[ZONE.HOME]) return ZONE.HOME;
    if (d <= ZONE_R[ZONE.YELLOW]) return ZONE.YELLOW;
    if (d <= ZONE_R[ZONE.ORANGE]) return ZONE.ORANGE;
    if (d <= ZONE_R[ZONE.GREEN]) return ZONE.GREEN;
    if (d <= ZONE_R[ZONE.BLUE]) return ZONE.BLUE;
    return ZONE.RED;
  }

  meta(zOrTx, ty) {
    const z = ty === undefined ? this.normalize(zOrTx) : this.getZone(zOrTx, ty);
    return ZONE_META[z] || ZONE_META[ZONE.HOME];
  }

  /** 0 = home … 5 = red */
  level(tx, ty) {
    return this.meta(tx, ty).level;
  }

  label(z) {
    return ZONE_META[this.normalize(z)]?.name || String(z);
  }

  shortLabel(z) {
    return ZONE_META[this.normalize(z)]?.short || String(z);
  }

  css(z) {
    return ZONE_META[this.normalize(z)]?.css || '#94a3b8';
  }

  color(z) {
    return ZONE_META[this.normalize(z)]?.color || 0x94a3b8;
  }

  /** HUD line: "YEL · Lv 1" */
  hudLine(tx, ty) {
    const m = this.meta(tx, ty);
    if (m.level === 0) return 'HOME';
    return `${m.short} · Lv ${m.level}`;
  }

  danger(tx, ty, isNight) {
    let d = this.meta(tx, ty).danger;
    if (isNight) d = Math.min(1, d + 0.22);
    return d;
  }

  isHome(tx, ty) {
    return this.getZone(tx, ty) === ZONE.HOME;
  }

  isEnterable(z) {
    return !!ZONE_META[this.normalize(z)]?.enterable;
  }

  /** Ordered enterable zones for legend / UI. */
  enterableList() {
    return ZONE_ENTER.map((id) => ZONE_META[id]);
  }

  isEdge(tx, ty, m = 3) {
    return tx <= m || ty <= m || tx >= MAP_W - 1 - m || ty >= MAP_H - 1 - m;
  }
}
