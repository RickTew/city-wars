import Phaser from 'phaser';
import { TILE, T } from '../config/constants.js';
import { NEON } from '../config/art.js';

/** Procedural cyberpunk tileset — no external art required. */
export class TileArt {
  static generate(scene) {
    const max = Math.max(...Object.values(T));
    const g = scene.make.graphics({ add: false });
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
        const gx = x + ((n * 7 + i * 3) % 28);
        const gy = (n * 5 + i) % 28;
        g.fillRect(gx, gy, 2, 2);
      }

      g.lineStyle(1, 0x000000, 0.45);
      g.strokeRect(x + 0.5, 0.5, TILE - 1, TILE - 1);

      // Asphalt base shared by all road orientations
      if (i === T.ROAD || i === T.ROAD_V || i === T.ROAD_X) {
        g.fillStyle(0x3f3f46, 1);
        g.fillRect(x, 0, TILE, TILE);
        g.fillStyle(0x27272a, 1);
        g.fillRect(x + 2, 2, TILE - 4, TILE - 4);
        // Curb lips
        g.fillStyle(0x71717a, 0.5);
        g.fillRect(x, 0, TILE, 2);
        g.fillRect(x, TILE - 2, TILE, 2);
        g.fillRect(x, 0, 2, TILE);
        g.fillRect(x + TILE - 2, 0, 2, TILE);
      }
      if (i === T.ROAD) {
        // E–W street: dashes run horizontally (along the road)
        g.fillStyle(0xfbbf24, 0.7);
        g.fillRect(x + 8, 14, 16, 3);
        g.fillStyle(0xa1a1aa, 0.3);
        g.fillRect(x + 4, 24, 10, 2);
        g.fillRect(x + 18, 8, 10, 2);
      }
      if (i === T.ROAD_V) {
        // N–S street: dashes run vertically (along the road)
        g.fillStyle(0xfbbf24, 0.7);
        g.fillRect(x + 14, 8, 3, 16);
        g.fillStyle(0xa1a1aa, 0.3);
        g.fillRect(x + 8, 4, 2, 10);
        g.fillRect(x + 22, 18, 2, 10);
      }
      if (i === T.ROAD_X) {
        // Intersection: soft cross, not a single-axis dash stamp
        g.fillStyle(0xfbbf24, 0.35);
        g.fillRect(x + 13, 10, 6, 12);
        g.fillRect(x + 10, 13, 12, 6);
        g.fillStyle(0x52525b, 0.4);
        g.fillRect(x + 6, 6, 4, 4);
        g.fillRect(x + 22, 6, 4, 4);
        g.fillRect(x + 6, 22, 4, 4);
        g.fillRect(x + 22, 22, 4, 4);
      }
      if (i === T.SIDEWALK) {
        g.fillStyle(0x52525b, 1);
        g.fillRect(x, 0, TILE, TILE);
        g.fillStyle(0x737373, 0.35);
        g.fillRect(x + 2, 2, 12, 12);
        g.fillRect(x + 16, 16, 12, 12);
        g.lineStyle(1, 0x27272a, 0.5);
        g.strokeRect(x + 1, 1, TILE - 2, TILE - 2);
      }
      if (i === T.ALLEY) {
        g.fillStyle(0x1c1917, 0.6);
        g.fillRect(x + 2, 24, TILE - 4, 6);
      }
      if (i === T.PARK) {
        g.fillStyle(0x166534, 0.5);
        g.fillCircle(x + 10, 12, 4);
        g.fillCircle(x + 22, 20, 5);
      }
      if (i === T.BUILDING) {
        const wins = [
          [8, 8, NEON.cyan],
          [18, 8, NEON.pink],
          [8, 18, 0x000000],
          [18, 18, NEON.gold],
        ];
        for (const [wx, wy, c] of wins) {
          g.fillStyle(c, wy > 14 ? 0.15 : 0.55);
          g.fillRect(x + wx, wy, 4, 4);
        }
        g.lineStyle(1, 0x334155, 0.8);
        g.strokeRect(x + 6, 6, 20, 20);
      }
      if (i === T.RUIN) {
        g.fillStyle(0x78350f, 0.7);
        g.fillRect(x + 4, 14, 10, 8);
        g.fillRect(x + 18, 6, 8, 12);
        g.lineStyle(2, 0xa8a29e, 0.4);
        g.lineBetween(x + 6, 28, x + 26, 10);
      }
      if (i === T.BARRICADE) {
        g.fillStyle(0x450a0a, 1);
        g.fillRect(x + 4, 8, 24, 16);
        g.lineStyle(2, NEON.red, 0.7);
        g.lineBetween(x + 6, 10, x + 26, 22);
        g.lineBetween(x + 26, 10, x + 6, 22);
      }
      if (i === T.HQ) {
        g.fillStyle(NEON.cyan, 0.15);
        g.fillRect(x + 2, 2, TILE - 4, TILE - 4);
        g.lineStyle(1, NEON.cyan, 0.5);
        for (let ly = 6; ly < 28; ly += 6) {
          g.lineBetween(x + 4, ly, x + 28, ly);
        }
      }
      if (i === T.LOOT) {
        g.fillStyle(0x422006, 1);
        g.fillRect(x + 6, 12, 20, 14);
        g.fillStyle(NEON.gold, 1);
        g.fillRect(x + 10, 8, 12, 8);
        g.lineStyle(1, 0xfef08a, 0.8);
        g.strokeRect(x + 10, 8, 12, 8);
      }
      if (i === T.BENCH) {
        g.fillStyle(NEON.purple, 0.35);
        g.fillRect(x + 2, 2, TILE - 4, TILE - 4);
        g.fillStyle(0xe9d5ff, 1);
        g.fillRect(x + 6, 18, 20, 6);
        g.fillRect(x + 8, 10, 4, 10);
        g.fillRect(x + 20, 10, 4, 10);
      }
      if (i === T.SLEEP) {
        g.fillStyle(0x134e4a, 0.5);
        g.fillRect(x + 4, 14, 24, 12);
        g.fillStyle(0x99f6e4, 0.85);
        g.fillEllipse(x + 16, 18, 18, 10);
      }
      if (i === T.LANDMARK) {
        g.fillStyle(0x500724, 0.6);
        g.fillRect(x + 2, 2, TILE - 4, TILE - 4);
        g.fillStyle(NEON.pink, 1);
        g.fillCircle(x + 16, 16, 7);
        g.lineStyle(2, 0xfbcfe8, 0.9);
        g.strokeCircle(x + 16, 16, 10);
      }
      if (i === T.GEAR_STICK) {
        g.lineStyle(4, 0xd97706, 1);
        g.lineBetween(x + 8, 24, x + 24, 8);
        g.fillStyle(NEON.gold, 1);
        g.fillCircle(x + 24, 8, 3);
      }
      if (i === T.GEAR_HAT) {
        g.fillStyle(0xe879f9, 1);
        g.fillEllipse(x + 16, 14, 18, 10);
        g.fillStyle(0xc026d3, 1);
        g.fillRect(x + 6, 16, 20, 4);
        g.fillStyle(0xf0abfc, 1);
        g.fillCircle(x + 16, 12, 3);
      }
      if (i === T.ESCAPE) {
        g.fillStyle(0x422006, 0.5);
        g.fillRect(x + 4, 4, 24, 24);
        g.lineStyle(3, NEON.gold, 1);
        g.strokeRect(x + 6, 6, 20, 20);
        g.fillStyle(NEON.gold, 0.35);
        g.fillRect(x + 14, 2, 4, 28);
        g.fillRect(x + 2, 14, 28, 4);
      }
      if (i === T.GATE) {
        g.fillStyle(0x1e1b4b, 1);
        g.fillRect(x + 8, 4, 16, 24);
        g.lineStyle(2, NEON.red, 0.8);
        g.strokeRect(x + 8, 4, 16, 24);
      }
    }

    g.generateTexture('tiles', max * TILE, TILE);
    g.destroy();

    // World tiles stay blocky; UI text must stay LINEAR (see main.js — no global pixelArt).
    const tex = scene.textures.get('tiles');
    if (tex?.setFilter) {
      tex.setFilter(Phaser.Textures.FilterMode.NEAREST);
    }
  }
}
