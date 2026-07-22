import Phaser from 'phaser';
import { TileArt } from '../systems/TileArt.js';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create() {
    TileArt.generate(this);
    if (typeof document !== 'undefined') {
      document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
    }
    // Visual lab: http://localhost:5173/?lab=1
    const lab =
      typeof location !== 'undefined' &&
      /(?:^|[?&])lab=1(?:&|$)/.test(location.search || '');
    this.scene.start(lab ? 'StyleLab' : 'Menu');
  }
}
