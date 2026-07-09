import { CENTER_X, CENTER_Y, MAP_H, MAP_W, ZONE, ZONE_R } from '../config/constants.js';

export class ZoneManager {
  manhattan(tx, ty) {
    return Math.abs(tx - CENTER_X) + Math.abs(ty - CENTER_Y);
  }

  getZone(tx, ty) {
    const d = this.manhattan(tx, ty);
    if (d <= ZONE_R[ZONE.SAFE]) return ZONE.SAFE;
    if (d <= ZONE_R[ZONE.MID]) return ZONE.MID;
    if (d <= ZONE_R[ZONE.OUTER]) return ZONE.OUTER;
    return ZONE.WALL;
  }

  label(z) {
    return (
      {
        [ZONE.SAFE]: 'Inner Blocks',
        [ZONE.MID]: 'Mid Sprawl',
        [ZONE.OUTER]: 'Outer Chaos',
        [ZONE.WALL]: 'The Wall',
      }[z] || z
    );
  }

  danger(tx, ty, isNight) {
    const z = this.getZone(tx, ty);
    let d = { [ZONE.SAFE]: 0.2, [ZONE.MID]: 0.5, [ZONE.OUTER]: 0.8, [ZONE.WALL]: 1 }[z];
    if (isNight) d = Math.min(1, d + 0.25);
    return d;
  }

  isEdge(tx, ty, m = 3) {
    return tx <= m || ty <= m || tx >= MAP_W - 1 - m || ty >= MAP_H - 1 - m;
  }
}
