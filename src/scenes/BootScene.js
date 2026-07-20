import Phaser from 'phaser';
import { TileArt } from '../systems/TileArt.js';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create() {
    TileArt.generate(this);
    this.scene.start('Menu');
  }
}
