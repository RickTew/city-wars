/**
 * Corner minimap + optional objective compass after tutorial.
 */
import { CENTER_X, CENTER_Y, MAP_H, MAP_W, T } from '../config/constants.js';

export class Minimap {
  constructor(scene) {
    this.scene = scene;
    this.size = 118;
    this.pad = 10;
    this.nodes = [];
    this.gfx = null;
    this.frame = null;
    this.label = null;
    this.compass = null;
    this.compassLabel = null;
  }

  create() {
    const s = this.scene;
    const d = 115;
    const w = s.scale.width;
    const x = w - this.pad - this.size / 2;
    const y = 78 + this.size / 2;

    this.frame = s.add
      .rectangle(x, y, this.size + 6, this.size + 6, 0x0f172a, 0.92)
      .setStrokeStyle(2, 0x334155)
      .setScrollFactor(0)
      .setDepth(d);
    this.gfx = s.add.graphics().setScrollFactor(0).setDepth(d + 1);
    this.label = s.add
      .text(x, y + this.size / 2 + 10, 'MAP', {
        fontFamily: 'system-ui',
        fontSize: '10px',
        fontStyle: 'bold',
        color: '#64748b',
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(d + 1);

    this.compass = s.add.graphics().setScrollFactor(0).setDepth(d + 2);
    this.compassLabel = s.add
      .text(40, 96, '', {
        fontFamily: 'system-ui',
        fontSize: '11px',
        fontStyle: 'bold',
        color: '#fbbf24',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(d + 2);

    this._cx = x;
    this._cy = y;
    this.nodes = [this.frame, this.gfx, this.label, this.compass, this.compassLabel];
  }

  onResize() {
    if (!this.frame) return;
    const w = this.scene.scale.width;
    const x = w - this.pad - this.size / 2;
    const y = 78 + this.size / 2;
    this._cx = x;
    this._cy = y;
    this.frame.setPosition(x, y);
    this.label.setPosition(x, y + this.size / 2 + 10);
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

    // coarse terrain sample
    const step = 2;
    for (let ty = 0; ty < MAP_H; ty += step) {
      for (let tx = 0; tx < MAP_W; tx += step) {
        const tile = s.ground?.[ty]?.[tx];
        if (tile == null) continue;
        let col = 0x1e293b;
        if (tile === T.ROAD || tile === T.HQ) col = 0x475569;
        else if (tile === T.ESCAPE) col = 0xf59e0b;
        else if (tile === T.LOOT) col = 0xa16207;
        else if (tile === T.LANDMARK) col = 0xdb2777;
        else if (tile === T.PARK) col = 0x166534;
        else if (s.walls?.[ty]?.[tx]) col = 0x0f172a;
        const px = cx - half + 2 + tx * scale;
        const py = cy - half + 2 + ty * scale;
        g.fillStyle(col, 1);
        g.fillRect(px, py, Math.max(1.2, scale * step), Math.max(1.2, scale * step));
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

    // objective
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

  /** After tutorial: point to breach BP / escape if objective is far */
  updateCompass() {
    const s = this.scene;
    const g = this.compass;
    const lab = this.compassLabel;
    if (!g || !lab) return;
    g.clear();

    // HQ arrow already bottom-left; this is secondary objective compass mid-left
    if (!s.guide?.done) {
      lab.setText('');
      return;
    }
    const t = s.objTarget;
    if (!t || t.ui) {
      lab.setText('');
      return;
    }
    const ox = t.tx ?? t.x;
    const oy = t.ty ?? t.y;
    if (ox == null) {
      lab.setText('');
      return;
    }
    const dx = ox - s.player.tx;
    const dy = oy - s.player.ty;
    const dist = Math.abs(dx) + Math.abs(dy);
    if (dist <= 8) {
      lab.setText('OBJ NEAR');
      lab.setColor('#4ade80');
      return;
    }
    const ang = Math.atan2(dy, dx);
    const bx = 40;
    const by = 108;
    g.lineStyle(2, 0xfbbf24, 1);
    g.fillStyle(0xfbbf24, 1);
    // arrow
    const len = 14;
    const ex = bx + Math.cos(ang) * len;
    const ey = by + Math.sin(ang) * len;
    g.lineBetween(bx, by, ex, ey);
    g.fillTriangle(
      ex,
      ey,
      ex - Math.cos(ang - 0.5) * 6,
      ey - Math.sin(ang - 0.5) * 6,
      ex - Math.cos(ang + 0.5) * 6,
      ey - Math.sin(ang + 0.5) * 6
    );
    lab.setPosition(bx, by + 16);
    lab.setColor('#fbbf24');
    lab.setText(`OBJ ${dist}`);
  }
}
