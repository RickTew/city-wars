import Phaser from 'phaser';
import { TILE, T } from '../config/constants.js';
import { NEON } from '../config/art.js';

/**
 * Procedural cyberpunk tileset — scales with TILE (32 design → 64 live).
 * Road dashes follow street axis (H / V / X).
 */
export class TileArt {
  static generate(scene) {
    const max = Math.max(...Object.values(T));
    const g = scene.make.graphics({ add: false });
    const S = TILE / 32; // design was 32px
    const r = (n) => Math.max(1, Math.round(n * S));

    const pal = {
      [T.ROAD]: 0x27272a,
      [T.ROAD_V]: 0x27272a,
      [T.ROAD_X]: 0x2a2a2e,
      [T.SIDEWALK]: 0x3f3f46,
      [T.PARK]: 0x14532d,
      [T.BUILDING]: 0x0f172a,
      [T.ALLEY]: 0x292524,
      [T.RUIN]: 0x451a03,
      [T.BARRICADE]: 0x7f1d1d,
      [T.ESCAPE]: 0xf59e0b,
      [T.HQ]: 0x0c4a6e,
      [T.WATER]: 0x0c1929,
      [T.LOOT]: 0x854d0e,
      [T.BENCH]: 0x6d28d9,
      [T.SLEEP]: 0x0f766e,
      [T.LANDMARK]: 0xbe185d,
      [T.GATE]: 0xdc2626,
      [T.GEAR_DROP]: 0xc026d3,
      [T.GEAR_STICK]: 0x92400e,
      [T.GEAR_HAT]: 0xa21caf,
    };

    for (let i = 1; i <= max; i++) {
      const x = (i - 1) * TILE;
      const base = pal[i] || 0x222;
      g.fillStyle(base, 1);
      g.fillRect(x, 0, TILE, TILE);

      g.fillStyle(0x000000, 0.08);
      for (let n = 0; n < 6; n++) {
        const gx = x + ((n * 7 + i * 3) % Math.max(8, TILE - 4));
        const gy = (n * 5 + i) % Math.max(8, TILE - 4);
        g.fillRect(gx, gy, r(2), r(2));
      }

      g.lineStyle(1, 0x000000, 0.45);
      g.strokeRect(x + 0.5, 0.5, TILE - 1, TILE - 1);

      // Asphalt base shared by all road orientations
      if (i === T.ROAD || i === T.ROAD_V || i === T.ROAD_X) {
        g.fillStyle(0x3f3f46, 1);
        g.fillRect(x, 0, TILE, TILE);
        g.fillStyle(0x27272a, 1);
        g.fillRect(x + r(2), r(2), TILE - r(4), TILE - r(4));
        g.fillStyle(0x71717a, 0.5);
        g.fillRect(x, 0, TILE, r(2));
        g.fillRect(x, TILE - r(2), TILE, r(2));
        g.fillRect(x, 0, r(2), TILE);
        g.fillRect(x + TILE - r(2), 0, r(2), TILE);
      }
      if (i === T.ROAD) {
        // E–W: single center dash only (less busy)
        g.fillStyle(0xfbbf24, 0.65);
        g.fillRect(x + r(8), r(14), r(16), r(3));
      }
      if (i === T.ROAD_V) {
        // N–S: single center dash only
        g.fillStyle(0xfbbf24, 0.65);
        g.fillRect(x + r(14), r(8), r(3), r(16));
      }
      if (i === T.ROAD_X) {
        // Cross: simple + without corner clutter
        g.fillStyle(0xfbbf24, 0.4);
        g.fillRect(x + r(14), r(10), r(3), r(12));
        g.fillRect(x + r(10), r(14), r(12), r(3));
      }
      if (i === T.SIDEWALK) {
        // Flat concrete + thin edge (no checker noise)
        g.fillStyle(0x6b7280, 1);
        g.fillRect(x, 0, TILE, TILE);
        g.fillStyle(0x9ca3af, 0.22);
        g.fillRect(x + r(3), r(3), TILE - r(6), TILE - r(6));
        g.lineStyle(1, 0x4b5563, 0.55);
        g.strokeRect(x + 0.5, 0.5, TILE - 1, TILE - 1);
      }
      if (i === T.ALLEY) {
        g.fillStyle(0x1c1917, 0.75);
        g.fillRect(x + r(2), r(24), TILE - r(4), r(6));
        g.fillStyle(0x44403c, 0.35);
        g.fillRect(x + r(4), r(4), r(8), r(8));
      }
      if (i === T.PARK) {
        // Grass — bold green base (not dark “block with dots”)
        g.fillStyle(0x15803d, 1);
        g.fillRect(x, 0, TILE, TILE);
        g.fillStyle(0x22c55e, 0.55);
        g.fillCircle(x + r(10), r(12), r(8));
        g.fillCircle(x + r(22), r(20), r(9));
        g.fillStyle(0x4ade80, 0.35);
        g.fillCircle(x + r(16), r(16), r(6));
        g.fillStyle(0x14532d, 0.4);
        g.fillRect(x + r(2), r(26), TILE - r(4), r(4));
      }
      if (i === T.BUILDING) {
        g.fillStyle(0x0f172a, 1);
        g.fillRect(x, 0, TILE, TILE);
        g.fillStyle(0x1e293b, 1);
        g.fillRect(x + r(4), r(4), TILE - r(8), TILE - r(8));
        const wins = [
          [r(8), r(8), NEON.cyan],
          [r(18), r(8), NEON.pink],
          [r(8), r(18), 0x020617],
          [r(18), r(18), NEON.gold],
        ];
        for (const [wx, wy, c] of wins) {
          g.fillStyle(c, wy > r(14) ? 0.2 : 0.65);
          g.fillRect(x + wx, wy, r(6), r(6));
        }
        g.lineStyle(Math.max(1, r(1)), 0x64748b, 0.9);
        g.strokeRect(x + r(4), r(4), TILE - r(8), TILE - r(8));
      }
      if (i === T.RUIN) {
        g.fillStyle(0x78350f, 1);
        g.fillRect(x, 0, TILE, TILE);
        g.fillStyle(0xa16207, 0.7);
        g.fillRect(x + r(4), r(14), r(10), r(8));
        g.fillRect(x + r(18), r(6), r(8), r(12));
        g.lineStyle(r(2), 0xa8a29e, 0.5);
        g.lineBetween(x + r(6), r(28), x + r(26), r(10));
      }
      if (i === T.BARRICADE) {
        // High-contrast red block + X so it never reads as “another building”
        g.fillStyle(0x991b1b, 1);
        g.fillRect(x, 0, TILE, TILE);
        g.fillStyle(0x450a0a, 1);
        g.fillRect(x + r(3), r(6), r(26), r(20));
        g.lineStyle(r(3), 0xfca5a5, 0.95);
        g.lineBetween(x + r(6), r(8), x + r(26), r(24));
        g.lineBetween(x + r(26), r(8), x + r(6), r(24));
        g.lineStyle(1, 0xef4444, 0.8);
        g.strokeRect(x + r(2), r(2), TILE - r(4), TILE - r(4));
      }
      if (i === T.HQ) {
        g.fillStyle(NEON.cyan, 0.15);
        g.fillRect(x + r(2), r(2), TILE - r(4), TILE - r(4));
        g.lineStyle(1, NEON.cyan, 0.5);
        for (let ly = r(6); ly < TILE - r(4); ly += r(6)) {
          g.lineBetween(x + r(4), ly, x + TILE - r(4), ly);
        }
      }
      if (i === T.LOOT) {
        g.fillStyle(0x422006, 1);
        g.fillRect(x + r(6), r(12), r(20), r(14));
        g.fillStyle(NEON.gold, 1);
        g.fillRect(x + r(10), r(8), r(12), r(8));
        g.lineStyle(1, 0xfef08a, 0.8);
        g.strokeRect(x + r(10), r(8), r(12), r(8));
      }
      if (i === T.BENCH) {
        g.fillStyle(NEON.purple, 0.35);
        g.fillRect(x + r(2), r(2), TILE - r(4), TILE - r(4));
        g.fillStyle(0xe9d5ff, 1);
        g.fillRect(x + r(6), r(18), r(20), r(6));
        g.fillRect(x + r(8), r(10), r(4), r(10));
        g.fillRect(x + r(20), r(10), r(4), r(10));
      }
      if (i === T.SLEEP) {
        g.fillStyle(0x134e4a, 0.5);
        g.fillRect(x + r(4), r(14), r(24), r(12));
        g.fillStyle(0x99f6e4, 0.85);
        g.fillEllipse(x + r(16), r(18), r(18), r(10));
      }
      if (i === T.LANDMARK) {
        g.fillStyle(0x500724, 0.6);
        g.fillRect(x + r(2), r(2), TILE - r(4), TILE - r(4));
        g.fillStyle(NEON.pink, 1);
        g.fillCircle(x + r(16), r(16), r(7));
        g.lineStyle(r(2), 0xfbcfe8, 0.9);
        g.strokeCircle(x + r(16), r(16), r(10));
      }
      if (i === T.GEAR_STICK) {
        g.lineStyle(r(4), 0xd97706, 1);
        g.lineBetween(x + r(8), r(24), x + r(24), r(8));
        g.fillStyle(NEON.gold, 1);
        g.fillCircle(x + r(24), r(8), r(3));
      }
      if (i === T.GEAR_HAT) {
        g.fillStyle(0xe879f9, 1);
        g.fillEllipse(x + r(16), r(14), r(18), r(10));
        g.fillStyle(0xc026d3, 1);
        g.fillRect(x + r(6), r(16), r(20), r(4));
        g.fillStyle(0xf0abfc, 1);
        g.fillCircle(x + r(16), r(12), r(3));
      }
      if (i === T.ESCAPE) {
        g.fillStyle(0x422006, 0.5);
        g.fillRect(x + r(4), r(4), r(24), r(24));
        g.lineStyle(r(3), NEON.gold, 1);
        g.strokeRect(x + r(6), r(6), r(20), r(20));
        g.fillStyle(NEON.gold, 0.35);
        g.fillRect(x + r(14), r(2), r(4), r(28));
        g.fillRect(x + r(2), r(14), r(28), r(4));
      }
      if (i === T.GATE) {
        g.fillStyle(0x1e1b4b, 1);
        g.fillRect(x + r(8), r(4), r(16), r(24));
        g.lineStyle(r(2), NEON.red, 0.8);
        g.strokeRect(x + r(8), r(4), r(16), r(24));
      }
      if (i === T.WATER) {
        g.fillStyle(0x0c1929, 1);
        g.fillRect(x, 0, TILE, TILE);
        g.fillStyle(0x0ea5e9, 0.2);
        g.fillRect(x + r(4), r(10), r(24), r(4));
        g.fillRect(x + r(8), r(20), r(16), r(3));
      }
    }

    g.generateTexture('tiles', max * TILE, TILE);
    g.destroy();

    const tex = scene.textures.get('tiles');
    if (tex?.setFilter) {
      tex.setFilter(Phaser.Textures.FilterMode.NEAREST);
    }
  }
}
