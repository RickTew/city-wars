/**
 * Visual Style Lab — side-by-side boards.
 *
 * Left: City Wars procedural city (32px tiles, directional roads).
 * Right: DungeonHole-style hybrid (64px procedural board + 1:1 pixel miniatures).
 *
 * Goal: lock the split-brain rule before more art:
 *   procedural ground/roads/blocks + pixel characters/props on top.
 *
 * Open: menu → STYLE LAB, or ?lab=1
 */
import Phaser from 'phaser';
import { DomUi } from '../systems/DomUi.js';

const CW_TILE = 32;
const DH_TILE = 64;
const GRID = 10;

export class StyleLabScene extends Phaser.Scene {
  constructor() {
    super('StyleLab');
  }

  create() {
    DomUi.clearAll();
    this.cameras.main.setBackgroundColor(0x070b12);
    this.drawBoards();
    this.buildDom();
    this.scale.on('resize', () => {
      this.children.removeAll(true);
      this.drawBoards();
      this.buildDom();
    });
  }

  shutdown() {
    DomUi.clearAll();
  }

  buildDom() {
    DomUi.clearAll();
    const root = DomUi.show('lab-ui', 'ui');
    if (!root) return;

    const head = DomUi.el('div', 'lab-head');
    head.appendChild(DomUi.el('div', 'lab-title', 'STYLE LAB'));
    head.appendChild(
      DomUi.el(
        'div',
        'lab-sub',
        'DungeonHole model: procedural board · pixel miniatures at 1:1 · DOM text only'
      )
    );
    root.appendChild(head);

    const cols = DomUi.el('div', 'lab-cols');
    const left = DomUi.el('div', 'lab-card');
    left.appendChild(DomUi.el('div', 'lab-card-title', 'A · City Wars now'));
    left.appendChild(
      DomUi.el(
        'div',
        'lab-card-body',
        `Tile ${CW_TILE}px · full procedural (roads H/V/X, blocks).\nCharacters are also procedural blobs today.\nFeels smaller / denser — good for 96×96 map.`
      )
    );
    cols.appendChild(left);

    const right = DomUi.el('div', 'lab-card');
    right.appendChild(DomUi.el('div', 'lab-card-title', 'B · DungeonHole hybrid'));
    right.appendChild(
      DomUi.el(
        'div',
        'lab-card-body',
        `Tile ${DH_TILE}px · procedural floor grid + chalk lines.\nPixel runners drawn 1:1 (no scale stretch).\nBigger board cells → room for authored sprites later.`
      )
    );
    cols.appendChild(right);
    root.appendChild(cols);

    const notes = DomUi.el('div', 'lab-notes');
    notes.appendChild(
      DomUi.el(
        'div',
        '',
        'Look: E–W roads should only have horizontal dashes; N–S only vertical. Intersections are a soft cross. That is “reads as a city,” not a circuit stamp.'
      )
    );
    notes.appendChild(
      DomUi.el(
        'div',
        'lab-muted',
        'Next step if B feels right: keep 32px for map OR raise combat/street zoom, and put pixel runners/crates on top of procedural asphalt (same split as DungeonHole).'
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
      DomUi.button('hit lab-btn secondary', 'RESHUFFLE DEMO', () => {
        this.children.removeAll(true);
        this.drawBoards();
        this.buildDom();
      })
    );
    root.appendChild(row);
  }

  drawBoards() {
    const w = this.scale.width;
    const h = this.scale.height;
    const mid = w / 2;
    const top = Math.min(120, h * 0.16);
    const boardH = Math.min(h - top - 100, 420);
    const boardY = top + boardH / 2 + 20;

    // Divider
    const div = this.add.rectangle(mid, h / 2, 2, h, 0x334155, 0.8).setScrollFactor(0);

    // ── Left: City Wars 32px city slice ──
    const leftCx = mid * 0.5;
    this.drawCityBoard(leftCx, boardY, GRID, CW_TILE);

    // ── Right: DH-style 64px hybrid ──
    const rightCx = mid + mid * 0.5;
    this.drawDungeonStyleBoard(rightCx, boardY, 8, DH_TILE);

    void div;
  }

  /** Procedural city slice with directional roads (same rules as generator). */
  drawCityBoard(cx, cy, n, tile) {
    const half = (n * tile) / 2;
    const ox = cx - half;
    const oy = cy - half;

    // Panel chrome
    this.add
      .rectangle(cx, cy, n * tile + 16, n * tile + 16, 0x0f172a, 0.95)
      .setStrokeStyle(2, 0x475569)
      .setScrollFactor(0);

    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const px = ox + x * tile + tile / 2;
        const py = oy + y * tile + tile / 2;
        const ew = y === 4 || y === 5;
        const ns = x === 4 || x === 5;
        let kind = 'block';
        if (ew && ns) kind = 'x';
        else if (ew) kind = 'h';
        else if (ns) kind = 'v';
        else if ((x + y) % 5 === 0) kind = 'park';
        else if (x < 2 && y < 2) kind = 'hq';

        this.paintCityTile(px, py, tile, kind);
      }
    }

    // Procedural runner (current live style)
    this.drawBlobRunner(ox + 4.5 * tile, oy + 4.5 * tile, 0xea580c, 0.9);
    // Crate + stick stand-ins
    this.add.rectangle(ox + 7.5 * tile, oy + 4.5 * tile, 14, 12, 0xf59e0b).setScrollFactor(0);
    this.add.rectangle(ox + 4.5 * tile, oy + 7.5 * tile, 4, 16, 0xa8a29e).setAngle(25).setScrollFactor(0);
  }

  paintCityTile(px, py, tile, kind) {
    const g = this.add.graphics().setScrollFactor(0);
    const x = px - tile / 2;
    const y = py - tile / 2;
    if (kind === 'h' || kind === 'v' || kind === 'x') {
      g.fillStyle(0x3f3f46, 1);
      g.fillRect(x, y, tile, tile);
      g.fillStyle(0x27272a, 1);
      g.fillRect(x + 2, y + 2, tile - 4, tile - 4);
      g.fillStyle(0xfbbf24, 0.7);
      if (kind === 'h') g.fillRect(x + 8, y + 14, 16, 3);
      else if (kind === 'v') g.fillRect(x + 14, y + 8, 3, 16);
      else {
        g.fillStyle(0xfbbf24, 0.35);
        g.fillRect(x + 13, y + 10, 6, 12);
        g.fillRect(x + 10, y + 13, 12, 6);
      }
    } else if (kind === 'hq') {
      g.fillStyle(0x0c4a6e, 1);
      g.fillRect(x, y, tile, tile);
      g.lineStyle(1, 0x38bdf8, 0.5);
      for (let ly = 6; ly < 28; ly += 6) g.lineBetween(x + 4, y + ly, x + 28, y + ly);
    } else if (kind === 'park') {
      g.fillStyle(0x14532d, 1);
      g.fillRect(x, y, tile, tile);
      g.fillStyle(0x166534, 0.7);
      g.fillCircle(x + 12, y + 14, 5);
    } else {
      g.fillStyle(0x0f172a, 1);
      g.fillRect(x, y, tile, tile);
      g.fillStyle(0x22d3ee, 0.35);
      g.fillRect(x + 8, y + 8, 4, 4);
      g.fillStyle(0xf472b6, 0.35);
      g.fillRect(x + 18, y + 8, 4, 4);
      g.lineStyle(1, 0x334155, 0.8);
      g.strokeRect(x + 6, y + 6, 20, 20);
    }
  }

  drawBlobRunner(x, y, col, scale = 1) {
    const s = scale;
    this.add.ellipse(x, y + 10 * s, 14 * s, 5 * s, 0x000000, 0.35).setScrollFactor(0);
    this.add.rectangle(x, y + 4 * s, 10 * s, 10 * s, 0x1e3a5f).setScrollFactor(0);
    this.add.rectangle(x, y - 2 * s, 12 * s, 12 * s, col).setScrollFactor(0);
    this.add.circle(x, y - 12 * s, 5 * s, 0xfde68a).setScrollFactor(0);
  }

  /**
   * DungeonHole-style: larger procedural tiles + chunky pixel miniatures at scale 1.
   * Miniatures are drawn as 1px-step “sprite” blocks (stand-in for real PNG art).
   */
  drawDungeonStyleBoard(cx, cy, n, tile) {
    const half = (n * tile) / 2;
    const ox = cx - half;
    const oy = cy - half;

    this.add
      .rectangle(cx, cy, n * tile + 20, n * tile + 20, 0x111827, 0.98)
      .setStrokeStyle(2, 0x64748b)
      .setScrollFactor(0);

    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const px = ox + x * tile;
        const py = oy + y * tile;
        const g = this.add.graphics().setScrollFactor(0);
        // Smooth-ish board cell (procedural)
        const base = (x + y) % 2 === 0 ? 0x1e293b : 0x243044;
        g.fillStyle(base, 1);
        g.fillRect(px + 1, py + 1, tile - 2, tile - 2);
        g.lineStyle(1, 0x475569, 0.55);
        g.strokeRect(px + 0.5, py + 0.5, tile - 1, tile - 1);
        // Street-like corridors
        if (x === 3 || y === 3) {
          g.fillStyle(0x334155, 1);
          g.fillRect(px + 4, py + 4, tile - 8, tile - 8);
          g.fillStyle(0xfbbf24, 0.45);
          if (x === 3 && y !== 3) g.fillRect(px + tile / 2 - 1.5, py + 16, 3, tile - 32);
          if (y === 3 && x !== 3) g.fillRect(px + 16, py + tile / 2 - 1.5, tile - 32, 3);
          if (x === 3 && y === 3) {
            g.fillRect(px + tile / 2 - 3, py + 18, 6, tile - 36);
            g.fillRect(px + 18, py + tile / 2 - 3, tile - 36, 6);
          }
        }
      }
    }

    // Pixel miniatures at 1:1 (no setScale) — larger than 32px blobs
    this.drawPixelRunner(ox + 3 * tile + tile / 2, oy + 3 * tile + tile - 4, 0xea580c);
    this.drawPixelDog(ox + 5 * tile + tile / 2, oy + 3 * tile + tile - 6);
    this.drawPixelCrate(ox + 6 * tile + tile / 2, oy + 5 * tile + tile / 2);
    this.drawPixelHat(ox + 2 * tile + tile / 2, oy + 5 * tile + tile / 2);
  }

  /** Chunky pixel figure ~48px tall — would be a PNG at scale 1.0 in production. */
  drawPixelRunner(cx, bottomY, bodyCol) {
    const g = this.add.graphics().setScrollFactor(0);
    const p = (x, y, w, h, c) => {
      g.fillStyle(c, 1);
      g.fillRect(Math.round(cx + x), Math.round(bottomY + y), w, h);
    };
    // shadow
    p(-10, -4, 20, 4, 0x000000);
    // boots
    p(-8, -10, 7, 6, 0x1c1917);
    p(1, -10, 7, 6, 0x1c1917);
    // legs
    p(-6, -22, 5, 12, 0x1e3a5f);
    p(1, -22, 5, 12, 0x1e3a5f);
    // torso
    p(-9, -40, 18, 18, bodyCol);
    // arms
    p(-13, -38, 4, 14, bodyCol);
    p(9, -38, 4, 14, bodyCol);
    // head
    p(-7, -54, 14, 14, 0xfde68a);
    // hair
    p(-7, -58, 14, 6, 0x292524);
    // eye
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
    p(14, -38, 4, 6, 0x57534e);
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

  drawPixelHat(cx, cy) {
    const g = this.add.graphics().setScrollFactor(0);
    g.fillStyle(0xa21caf, 1);
    g.fillRect(cx - 16, cy + 2, 32, 6);
    g.fillRect(cx - 10, cy - 10, 20, 14);
    g.fillStyle(0xf0abfc, 1);
    g.fillRect(cx - 4, cy - 4, 8, 4);
  }
}
