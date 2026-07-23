/**
 * Corner minimap + objective compass (active during tutorial too).
 * Labels are DOM (scene.domCompassLabel / domMapLabel) for crisp type.
 */
import {
  CENTER_X,
  CENTER_Y,
  MAP_H,
  MAP_W,
  ROAD_TILES,
  T,
  ZONE_META,
} from '../config/constants.js';

export class Minimap {
  constructor(scene) {
    this.scene = scene;
    this.size = 118;
    this.pad = 10;
    this.nodes = [];
    this.gfx = null;
    this.frame = null;
    this.compass = null;
  }

  create() {
    const s = this.scene;
    const d = 115;
    const w = s.scale.width;
    // On narrow screens, shrink minimap so it does not own the top-right
    this.size = w < 520 ? 88 : 118;
    const x = w - this.pad - this.size / 2;
    // Sit below mobile objective banner (top ~102) so MAP does not cover QUEST text
    const yTop = s.isMobileHud?.() ? 108 : 78;
    const y = yTop + this.size / 2;

    this.frame = s.add
      .rectangle(x, y, this.size + 6, this.size + 6, 0x0f172a, 0.92)
      .setStrokeStyle(2, 0x334155)
      .setScrollFactor(0)
      .setDepth(d);
    this.gfx = s.add.graphics().setScrollFactor(0).setDepth(d + 1);
    this.compass = s.add.graphics().setScrollFactor(0).setDepth(d + 2);

    this._cx = x;
    this._cy = y;
    this.nodes = [this.frame, this.gfx, this.compass];
    this._layoutMapLabel();
  }

  _layoutMapLabel() {
    const s = this.scene;
    if (!s.domMapLabel) return;
    const w = s.scale.width;
    this.size = w < 520 ? 88 : 118;
    const yTop = s.isMobileHud?.() ? 108 : 78;
    s.domMapLabel.style.top = `${yTop + this.size + 4}px`;
    s.domMapLabel.style.width = `${this.size}px`;
    s.domMapLabel.style.right = `${this.pad}px`;
    s.domMapLabel.textContent = 'MAP';
  }

  onResize() {
    if (!this.frame) return;
    const s = this.scene;
    const w = s.scale.width;
    this.size = w < 520 ? 88 : 118;
    const x = w - this.pad - this.size / 2;
    // Sit below mobile objective banner (top ~102) so MAP does not cover QUEST text
    const yTop = s.isMobileHud?.() ? 108 : 78;
    const y = yTop + this.size / 2;
    this._cx = x;
    this._cy = y;
    this.frame.setPosition(x, y);
    this.frame.setSize(this.size + 6, this.size + 6);
    this._layoutMapLabel();
  }

  update() {
    const s = this.scene;
    if (!this.gfx || !s.player) return;
    const g = this.gfx;
    g.clear();
    const cx = this._cx;
    const cy = this._cy;
    const half = this.size / 2 - 2;
    const scale = (this.size - 8) / Math.max(MAP_W, MAP_H);

    // background
    g.fillStyle(0x020617, 0.95);
    g.fillRect(cx - half, cy - half, half * 2, half * 2);

    // Coarse sample — emphasize roads/HQ so mini map isn't a solid wall mesh
    const step = 2;
    const pix = Math.max(1.4, scale * step);
    for (let ty = 0; ty < MAP_H; ty += step) {
      for (let tx = 0; tx < MAP_W; tx += step) {
        const tile = s.ground?.[ty]?.[tx];
        if (tile == null) continue;
        const wall = s.walls?.[ty]?.[tx];
        let col = 0x1e293b;
        if (ROAD_TILES.has(tile)) col = 0x64748b;
        else if (tile === T.HQ) col = 0x0ea5e9;
        else if (tile === T.ESCAPE) col = 0xf59e0b;
        else if (tile === T.LOOT) col = 0xa16207;
        else if (tile === T.LANDMARK) col = 0xdb2777;
        else if (tile === T.PARK) col = 0x16a34a;
        else if (tile === T.SIDEWALK) col = 0x475569;
        else if (wall) col = 0x0b1220; // buildings almost black, roads read as grid
        else {
          // Soft ring tint so minimap reads as Yellow→Red bands
          const z = s.zones?.getZone?.(tx, ty);
          col = ZONE_META[z]?.color ? blendZone(ZONE_META[z].color) : 0x334155;
        }
        const px = cx - half + 2 + tx * scale;
        const py = cy - half + 2 + ty * scale;
        g.fillStyle(col, 1);
        g.fillRect(px, py, pix, pix);
      }
    }

    // HQ
    g.fillStyle(0x38bdf8, 1);
    g.fillCircle(cx - half + 2 + CENTER_X * scale, cy - half + 2 + CENTER_Y * scale, 2.5);

    // enemies (visible only)
    for (const e of s.enemies || []) {
      if (!e.alive || e._dormant) continue;
      if (!s.isVisibleTile?.(e.tx, e.ty)) continue;
      g.fillStyle(0xef4444, 0.9);
      g.fillCircle(cx - half + 2 + e.tx * scale, cy - half + 2 + e.ty * scale, 1.6);
    }

    // objective / guide target on minimap
    const t = s.objTarget;
    if (t && !t.ui) {
      const ox = t.tx ?? t.x;
      const oy = t.ty ?? t.y;
      if (ox != null) {
        g.fillStyle(0xfbbf24, 1);
        g.fillCircle(cx - half + 2 + ox * scale, cy - half + 2 + oy * scale, 2.2);
      }
    }

    // player
    g.fillStyle(0x7dd3fc, 1);
    g.fillCircle(cx - half + 2 + s.player.tx * scale, cy - half + 2 + s.player.ty * scale, 2.8);
    g.lineStyle(1, 0xf8fafc, 0.8);
    g.strokeCircle(cx - half + 2 + s.player.tx * scale, cy - half + 2 + s.player.ty * scale, 3.2);

    this.updateCompass();
  }

  /**
   * Point at current objective always (tutorial + post-guide).
   * UI targets (BAG / CRAFT / SLEEP) show a short label instead of an arrow.
   */
  updateCompass() {
    const s = this.scene;
    const g = this.compass;
    const lab = s.domCompassLabel;
    if (!g) return;
    g.clear();

    const t = s.objTarget;
    if (!t) {
      if (lab) lab.textContent = '';
      return;
    }

    // Mid-left under top bar (HQ arrow is bottom-left)
    const bx = 40;
    const by = Math.min(120, (s.isMobileHud?.() ? 118 : 64) + (s.scale.height < 700 ? 8 : 20));
    if (lab) {
      lab.style.left = `${bx}px`;
      lab.style.top = `${by}px`;
    }

    if (t.ui) {
      const name = String(t.ui).toUpperCase();
      if (lab) {
        lab.style.color = '#fbbf24';
        lab.textContent = `→ ${name}`;
      }
      return;
    }

    const ox = t.tx ?? t.x;
    const oy = t.ty ?? t.y;
    if (ox == null || oy == null) {
      if (lab) lab.textContent = '';
      return;
    }
    const dx = ox - s.player.tx;
    const dy = oy - s.player.ty;
    const dist = Math.abs(dx) + Math.abs(dy);
    if (dist <= 2) {
      if (lab) {
        lab.style.color = '#4ade80';
        lab.textContent = 'OBJ HERE';
      }
      return;
    }
    // Distance only — world gold pulse is the main cue (no second gold arrow)
    if (lab) {
      lab.style.top = `${by}px`;
      lab.style.color = dist <= 6 ? '#4ade80' : '#fbbf24';
      lab.textContent = `OBJ ${dist}`;
    }
  }
}

/** Darken zone brand color so minimap stays readable. */
function blendZone(hex) {
  const r = ((hex >> 16) & 0xff) * 0.28;
  const g = ((hex >> 8) & 0xff) * 0.28;
  const b = (hex & 0xff) * 0.28;
  return ((r | 0) << 16) | ((g | 0) << 8) | (b | 0);
}
