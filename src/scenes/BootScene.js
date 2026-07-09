import Phaser from 'phaser';
import { TILE, T } from '../config/constants.js';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create() {
    const max = Math.max(...Object.values(T));
    const g = this.make.graphics({ add: false });
    const pal = {
      [T.ROAD]: 0x3f3f46,
      [T.SIDEWALK]: 0x57534e,
      [T.PARK]: 0x166534,
      [T.BUILDING]: 0x1e293b,
      [T.ALLEY]: 0x44403c,
      [T.RUIN]: 0x78350f,
      [T.BARRICADE]: 0x7f1d1d,
      [T.ESCAPE]: 0xf59e0b,
      [T.HQ]: 0x0369a1,
      [T.WATER]: 0x1e3a5f,
      [T.LOOT]: 0xa16207,
      [T.BENCH]: 0x7c3aed,
      [T.SLEEP]: 0x0f766e,
      [T.LANDMARK]: 0xdb2777,
      [T.GATE]: 0xb91c1c,
      [T.GEAR_DROP]: 0xc026d3,
    };
    for (let i = 1; i <= max; i++) {
      const x = (i - 1) * TILE;
      g.fillStyle(pal[i] || 0x222, 1);
      g.fillRect(x, 0, TILE, TILE);
      g.lineStyle(1, 0x000, 0.4);
      g.strokeRect(x + 0.5, 0.5, TILE - 1, TILE - 1);
      if (i === T.ROAD) {
        g.lineStyle(2, 0xa1a1aa, 0.4);
        g.lineBetween(x + 4, 16, x + 28, 16);
      }
      if (i === T.LOOT) {
        g.fillStyle(0xfde68a, 1);
        g.fillRect(x + 10, 10, 12, 12);
      }
      if (i === T.BENCH) {
        g.fillStyle(0xe9d5ff, 1);
        g.fillRect(x + 6, 18, 20, 6);
        g.fillRect(x + 8, 10, 4, 10);
        g.fillRect(x + 20, 10, 4, 10);
      }
      if (i === T.SLEEP) {
        g.fillStyle(0x99f6e4, 0.8);
        g.fillEllipse(x + 16, 18, 18, 10);
      }
      if (i === T.LANDMARK) {
        g.fillStyle(0xfce7f3, 1);
        g.fillCircle(x + 16, 16, 6);
      }
      if (i === T.GEAR_DROP) {
        g.fillStyle(0xf5d0fe, 1);
        g.fillRect(x + 8, 8, 16, 16);
        g.lineStyle(2, 0xffffff, 0.9);
        g.strokeRect(x + 8, 8, 16, 16);
      }
      if (i === T.ESCAPE) {
        g.lineStyle(3, 0xfff, 1);
        g.strokeRect(x + 6, 6, 20, 20);
      }
      if (i === T.BUILDING) {
        g.fillStyle(0xfbbf24, 0.45);
        g.fillRect(x + 8, 8, 4, 4);
        g.fillRect(x + 18, 8, 4, 4);
        g.fillRect(x + 8, 18, 4, 4);
      }
    }
    g.generateTexture('tiles', max * TILE, TILE);
    g.destroy();
    this.scene.start('Menu');
  }
}
