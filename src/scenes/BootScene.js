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
    this.scene.start('Menu');
  }
}
