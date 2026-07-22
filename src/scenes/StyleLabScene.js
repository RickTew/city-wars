/**
 * Visual Style Lab — full city tile vocabulary at live TILE size + hybrid miniatures.
 *
 * Direction (user 1B + 2C): live map → 64px tiles; lab shows every terrain type
 * (grass, barricade, roads H/V/X, buildings…) so B is not a blank chessboard.
 *
 * Open: menu → STYLE LAB, or ?lab=1
 */
import Phaser from 'phaser';
import { TILE, T } from '../config/constants.js';
import { DomUi } from '../systems/DomUi.js';
import { NEON } from '../config/art.js';

const LAB_N = 12; // demo grid size

/** Legend order for the strip under the boards */
const LEGEND = [
  { id: T.ROAD, label: 'Road E–W' },
  { id: T.ROAD_V, label: 'Road N–S' },
  { id: T.ROAD_X, label: 'Cross' },
  { id: T.SIDEWALK, label: 'Sidewalk' },
  { id: T.PARK, label: 'Grass' },
  { id: T.BUILDING, label: 'Building' },
  { id: T.BARRICADE, label: 'Barricade' },
  { id: T.ALLEY, label: 'Alley' },
  { id: T.RUIN, label: 'Ruin' },
  { id: T.HQ, label: 'HQ' },
  { id: T.LOOT, label: 'Loot' },
  { id: T.BENCH, label: 'Workbench' },
  { id: T.SLEEP, label: 'Sleep' },
  { id: T.LANDMARK, label: 'Blueprint' },
  { id: T.ESCAPE, label: 'Escape' },
  { id: T.GEAR_STICK, label: 'Stick' },
  { id: T.GEAR_HAT, label: 'Hat' },
];

export class StyleLabScene extends Phaser.Scene {
  constructor() {
    super('StyleLab');
  }

  create() {
    DomUi.clearAll();
    this.cameras.main.setBackgroundColor(0x070b12);
    // Atlas already generated in Boot — redraw boards from tile index paints
    this.drawAll();
    this.scale.on('resize', () => this.drawAll());
  }

  shutdown() {
    DomUi.clearAll();
  }

  drawAll() {
    this.children.removeAll(true);
    DomUi.clearAll();
    this.drawBoards();
    this.buildDom();
  }

  buildDom() {
    const root = DomUi.show('lab-ui', 'ui');
    if (!root) return;

    const head = DomUi.el('div', 'lab-head');
    head.appendChild(DomUi.el('div', 'lab-title', 'STYLE LAB'));
    head.appendChild(
      DomUi.el(
        'div',
        'lab-sub',
        `Live TILE = ${TILE}px · full terrain set · pixel miniatures 1:1 on the right`
      )
    );
    root.appendChild(head);

    const cols = DomUi.el('div', 'lab-cols');
    const left = DomUi.el('div', 'lab-card');
    left.appendChild(DomUi.el('div', 'lab-card-title', 'A · Full city tiles'));
    left.appendChild(
      DomUi.el(
        'div',
        'lab-card-body',
        'Same paints as the live map: roads (H/V/X), grass, buildings, barricades, loot, workbench, etc.\nNot a blank grid — each square means something.'
      )
    );
    cols.appendChild(left);

    const right = DomUi.el('div', 'lab-card');
    right.appendChild(DomUi.el('div', 'lab-card-title', 'B · Hybrid (board + miniatures)'));
    right.appendChild(
      DomUi.el(
        'div',
        'lab-card-body',
        'Same terrain language, larger read · chunky pixel runner/dog/crate on top (DungeonHole model).\nAuthored PNGs later replace these stand-ins at scale 1.0.'
      )
    );
    cols.appendChild(right);
    root.appendChild(cols);

    const notes = DomUi.el('div', 'lab-notes');
    notes.appendChild(
      DomUi.el(
        'div',
        '',
        'E–W roads = horizontal gold dashes only. N–S = vertical only. Grass is green. Barricade is red X-block. That is the city, not a circuit board.'
      )
    );
    root.appendChild(notes);

    const row = DomUi.el('div', 'lab-actions');
    row.appendChild(
      DomUi.button('hit lab-btn', 'BACK TO MENU', () => {
        DomUi.clearAll();
        this.scene.start('Menu');
      })
    );
    row.appendChild(
      DomUi.button('hit lab-btn secondary', 'RESHUFFLE DEMO', () => this.drawAll())
    );
    root.appendChild(row);
  }

  drawBoards() {
    const w = this.scale.width;
    const h = this.scale.height;
    const mid = w / 2;
    const top = Math.min(130, h * 0.18);
    // Fit boards under DOM cards
    const maxBoard = Math.min(h - top - 90, 380);
    const cellA = Math.floor(maxBoard / LAB_N);
    const nB = 8;
    const cellB = Math.floor(maxBoard / nB);

    this.add.rectangle(mid, h / 2, 2, h, 0x334155, 0.8).setScrollFactor(0);

    // Left board center
    const leftCx = mid * 0.48;
    const boardY = top + maxBoard / 2 + 8;
    this.drawTerrainCity(leftCx, boardY, LAB_N, cellA, false);
    this.drawLegendStrip(leftCx, boardY + (LAB_N * cellA) / 2 + 28, cellA * 0.55);

    // Right hybrid
    const rightCx = mid + mid * 0.52;
    this.drawTerrainCity(rightCx, boardY, nB, cellB, true);
  }

  /** Demo city using full tile vocabulary at arbitrary cell size. */
  drawTerrainCity(cx, cy, n, cell, hybridMinis) {
    const half = (n * cell) / 2;
    const ox = cx - half;
    const oy = cy - half;

    this.add
      .rectangle(cx, cy, n * cell + 14, n * cell + 14, 0x0b1220, 0.96)
      .setStrokeStyle(2, 0x64748b)
      .setScrollFactor(0);

    const map = this.buildDemoMap(n);

    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const px = ox + x * cell;
        const py = oy + y * cell;
        this.paintTile(px, py, cell, map[y][x]);
      }
    }

    if (hybridMinis) {
      // 1:1 pixel-ish miniatures (size independent of cell a bit — sit on tile)
      const mid = Math.floor(n / 2);
      this.drawPixelRunner(ox + mid * cell + cell / 2, oy + mid * cell + cell - 4);
      this.drawPixelDog(ox + (mid + 2) * cell + cell / 2, oy + mid * cell + cell - 6);
      this.drawPixelCrate(ox + (mid + 1) * cell + cell / 2, oy + (mid + 2) * cell + cell / 2);
    } else {
      // Current live-style blob scaled to cell
      const s = cell / 32;
      const mid = Math.floor(n / 2);
      this.drawBlobRunner(ox + mid * cell + cell / 2, oy + mid * cell + cell / 2, 0xea580c, s);
    }
  }

  buildDemoMap(n) {
    const m = Array.from({ length: n }, () => new Array(n).fill(T.ALLEY));
    const mid = Math.floor(n / 2);
    for (let i = 0; i < n; i++) {
      for (const band of [mid - 1, mid]) {
        if (band < 0 || band >= n) continue;
        // E–W
        m[band][i] = i === mid || i === mid - 1 ? T.ROAD_X : T.ROAD;
        // N–S
        m[i][band] = i === mid || i === mid - 1 ? T.ROAD_X : T.ROAD_V;
      }
    }
    // HQ corner
    for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) m[y][x] = T.HQ;
    // Place distinct terrain
    const spots = [
      [2, 2, T.PARK],
      [2, 3, T.PARK],
      [n - 3, 2, T.BUILDING],
      [n - 2, 2, T.BUILDING],
      [n - 2, 3, T.BARRICADE],
      [2, n - 3, T.RUIN],
      [3, n - 2, T.SIDEWALK],
      [mid + 2, mid, T.LOOT],
      [mid, mid + 2, T.GEAR_STICK],
      [mid - 3, mid, T.GEAR_HAT],
      [mid - 2, mid - 2, T.BENCH],
      [1, mid + 2, T.SLEEP],
      [n - 2, mid + 2, T.LANDMARK],
      [n - 2, n - 2, T.ESCAPE],
    ];
    for (const [x, y, t] of spots) {
      if (x >= 0 && y >= 0 && x < n && y < n) m[y][x] = t;
    }
    return m;
  }

  /** Paint one terrain type into a cell (matches live TileArt language). */
  paintTile(px, py, cell, type) {
    const g = this.add.graphics().setScrollFactor(0);
    const S = cell / 32;
    const r = (n) => Math.max(1, Math.round(n * S));
    const x = px;
    const y = py;

    const fillBase = (c) => {
      g.fillStyle(c, 1);
      g.fillRect(x, y, cell, cell);
    };

    if (type === T.ROAD || type === T.ROAD_V || type === T.ROAD_X) {
      fillBase(0x3f3f46);
      g.fillStyle(0x27272a, 1);
      g.fillRect(x + r(2), y + r(2), cell - r(4), cell - r(4));
      g.fillStyle(0xfbbf24, 0.7);
      if (type === T.ROAD) g.fillRect(x + r(8), y + r(14), r(16), r(3));
      else if (type === T.ROAD_V) g.fillRect(x + r(14), y + r(8), r(3), r(16));
      else {
        g.fillStyle(0xfbbf24, 0.35);
        g.fillRect(x + r(13), y + r(10), r(6), r(12));
        g.fillRect(x + r(10), y + r(13), r(12), r(6));
      }
      return;
    }
    if (type === T.PARK) {
      fillBase(0x14532d);
      g.fillStyle(0x22c55e, 0.45);
      g.fillCircle(x + r(12), y + r(14), r(7));
      g.fillCircle(x + r(22), y + r(20), r(6));
      return;
    }
    if (type === T.BUILDING) {
      fillBase(0x0f172a);
      g.fillStyle(NEON.cyan, 0.5);
      g.fillRect(x + r(8), y + r(8), r(5), r(5));
      g.fillStyle(NEON.pink, 0.5);
      g.fillRect(x + r(18), y + r(8), r(5), r(5));
      g.lineStyle(1, 0x334155, 0.9);
      g.strokeRect(x + r(6), y + r(6), r(20), r(20));
      return;
    }
    if (type === T.BARRICADE) {
      fillBase(0x7f1d1d);
      g.fillStyle(0x450a0a, 1);
      g.fillRect(x + r(4), y + r(8), r(24), r(16));
      g.lineStyle(r(2), NEON.red, 0.9);
      g.lineBetween(x + r(6), y + r(10), x + r(26), y + r(22));
      g.lineBetween(x + r(26), y + r(10), x + r(6), y + r(22));
      return;
    }
    if (type === T.SIDEWALK) {
      fillBase(0x52525b);
      g.fillStyle(0x737373, 0.35);
      g.fillRect(x + r(2), y + r(2), r(12), r(12));
      g.fillRect(x + r(16), y + r(16), r(12), r(12));
      return;
    }
    if (type === T.ALLEY) {
      fillBase(0x292524);
      g.fillStyle(0x1c1917, 0.6);
      g.fillRect(x + r(2), y + r(24), cell - r(4), r(6));
      return;
    }
    if (type === T.RUIN) {
      fillBase(0x451a03);
      g.fillStyle(0x78350f, 0.8);
      g.fillRect(x + r(4), y + r(14), r(10), r(8));
      return;
    }
    if (type === T.HQ) {
      fillBase(0x0c4a6e);
      g.lineStyle(1, NEON.cyan, 0.5);
      for (let ly = r(6); ly < cell - r(4); ly += r(6)) {
        g.lineBetween(x + r(4), y + ly, x + cell - r(4), y + ly);
      }
      return;
    }
    if (type === T.LOOT) {
      fillBase(0x854d0e);
      g.fillStyle(0x422006, 1);
      g.fillRect(x + r(6), y + r(12), r(20), r(14));
      g.fillStyle(NEON.gold, 1);
      g.fillRect(x + r(10), y + r(8), r(12), r(8));
      return;
    }
    if (type === T.BENCH) {
      fillBase(0x6d28d9);
      g.fillStyle(0xe9d5ff, 1);
      g.fillRect(x + r(6), y + r(18), r(20), r(6));
      g.fillRect(x + r(8), y + r(10), r(4), r(10));
      g.fillRect(x + r(20), y + r(10), r(4), r(10));
      return;
    }
    if (type === T.SLEEP) {
      fillBase(0x0f766e);
      g.fillStyle(0x99f6e4, 0.9);
      g.fillEllipse(x + r(16), y + r(18), r(18), r(10));
      return;
    }
    if (type === T.LANDMARK) {
      fillBase(0xbe185d);
      g.fillStyle(NEON.pink, 1);
      g.fillCircle(x + r(16), y + r(16), r(7));
      return;
    }
    if (type === T.ESCAPE) {
      fillBase(0xf59e0b);
      g.lineStyle(r(2), 0xfef3c7, 1);
      g.strokeRect(x + r(6), y + r(6), r(20), r(20));
      return;
    }
    if (type === T.GEAR_STICK) {
      fillBase(0x92400e);
      g.lineStyle(r(4), 0xd97706, 1);
      g.lineBetween(x + r(8), y + r(24), x + r(24), y + r(8));
      return;
    }
    if (type === T.GEAR_HAT) {
      fillBase(0xa21caf);
      g.fillStyle(0xe879f9, 1);
      g.fillEllipse(x + r(16), y + r(14), r(18), r(10));
      g.fillStyle(0xc026d3, 1);
      g.fillRect(x + r(6), y + r(16), r(20), r(4));
      return;
    }
    fillBase(0x222);
  }

  drawLegendStrip(cx, y, cell) {
    const n = LEGEND.length;
    const gap = 4;
    const totalW = n * (cell + gap);
    let x = cx - totalW / 2;
    for (const item of LEGEND) {
      this.paintTile(x, y - cell / 2, cell, item.id);
      x += cell + gap;
    }
  }

  drawBlobRunner(x, y, col, scale = 1) {
    const s = scale;
    this.add.ellipse(x, y + 10 * s, 14 * s, 5 * s, 0x000000, 0.35).setScrollFactor(0);
    this.add.rectangle(x, y + 4 * s, 10 * s, 10 * s, 0x1e3a5f).setScrollFactor(0);
    this.add.rectangle(x, y - 2 * s, 12 * s, 12 * s, col).setScrollFactor(0);
    this.add.circle(x, y - 12 * s, 5 * s, 0xfde68a).setScrollFactor(0);
  }

  drawPixelRunner(cx, bottomY) {
    const g = this.add.graphics().setScrollFactor(0);
    const p = (x, y, w, h, c) => {
      g.fillStyle(c, 1);
      g.fillRect(Math.round(cx + x), Math.round(bottomY + y), w, h);
    };
    p(-10, -4, 20, 4, 0x000000);
    p(-8, -10, 7, 6, 0x1c1917);
    p(1, -10, 7, 6, 0x1c1917);
    p(-6, -22, 5, 12, 0x1e3a5f);
    p(1, -22, 5, 12, 0x1e3a5f);
    p(-9, -40, 18, 18, 0xea580c);
    p(-13, -38, 4, 14, 0xea580c);
    p(9, -38, 4, 14, 0xea580c);
    p(-7, -54, 14, 14, 0xfde68a);
    p(-7, -58, 14, 6, 0x292524);
    p(2, -48, 3, 2, 0x0f172a);
  }

  drawPixelDog(cx, bottomY) {
    const g = this.add.graphics().setScrollFactor(0);
    const p = (x, y, w, h, c) => {
      g.fillStyle(c, 1);
      g.fillRect(Math.round(cx + x), Math.round(bottomY + y), w, h);
    };
    p(-14, -4, 28, 4, 0x000000);
    p(-12, -14, 6, 10, 0x292524);
    p(4, -14, 6, 10, 0x292524);
    p(-16, -28, 28, 16, 0x57534e);
    p(10, -32, 14, 12, 0x78716c);
    p(20, -28, 10, 6, 0xa8a29e);
    p(8, -40, 5, 8, 0x44403c);
    p(16, -30, 3, 3, 0xfbbf24);
    p(-22, -30, 8, 3, 0x57534e);
  }

  drawPixelCrate(cx, cy) {
    const g = this.add.graphics().setScrollFactor(0);
    g.fillStyle(0x92400e, 1);
    g.fillRect(cx - 14, cy - 12, 28, 24);
    g.fillStyle(0xf59e0b, 1);
    g.fillRect(cx - 12, cy - 10, 24, 6);
    g.lineStyle(2, 0xfde68a, 0.9);
    g.strokeRect(cx - 14, cy - 12, 28, 24);
  }
}
