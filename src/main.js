import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene.js';
import { MenuScene } from './scenes/MenuScene.js';
import { CharacterSelectScene } from './scenes/CharacterSelectScene.js';
import { GameScene } from './scenes/GameScene.js';
import { StyleLabScene } from './scenes/StyleLabScene.js';

/**
 * pixelArt: true = nearest-neighbor for tile/sprite textures (studio default).
 * Player-facing text is DOM (see VISUAL-STYLE.md + DomUi.js) — never rely on
 * Phaser Text under this flag (chunky) or on global antialias:true (fuzzy).
 *
 * Style Lab (DungeonHole hybrid compare): ?lab=1 or menu → STYLE LAB
 */
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
  scene: [BootScene, MenuScene, CharacterSelectScene, GameScene, StyleLabScene],
  title: 'City Wars',
  version: '3.9.2',
};

// eslint-disable-next-line no-new
const game = new Phaser.Game(config);
if (typeof window !== 'undefined') window.__PHASER_GAME__ = game;
