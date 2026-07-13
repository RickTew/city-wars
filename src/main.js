import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene.js';
import { MenuScene } from './scenes/MenuScene.js';
import { CharacterSelectScene } from './scenes/CharacterSelectScene.js';
import { GameScene } from './scenes/GameScene.js';

const config = {
  type: Phaser.AUTO,
  parent: 'game-container',
  backgroundColor: '#070b12',
  pixelArt: true,
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: window.innerWidth,
    height: window.innerHeight,
  },
  input: {
    mouse: { preventDefaultWheel: true },
  },
  scene: [BootScene, MenuScene, CharacterSelectScene, GameScene],
  title: 'City Wars',
  version: '3.6.0',
};

// eslint-disable-next-line no-new
new Phaser.Game(config);
