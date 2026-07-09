import Phaser from 'phaser';
import { CHARACTERS } from '../config/characters.js';

export class CharacterSelectScene extends Phaser.Scene {
  constructor() {
    super('CharacterSelect');
  }

  create() {
    if (!this.registry.get('dayLength')) this.registry.set('dayLength', 'medium');
    if (this.registry.get('narratorOn') === undefined) this.registry.set('narratorOn', true);
    this.selected = this.registry.get('characterId') || CHARACTERS[0].id;
    this.draw();
    this.scale.on('resize', () => this.draw());
  }

  draw() {
    this.children.removeAll(true);
    const w = this.scale.width;
    const h = this.scale.height;

    this.add.rectangle(w / 2, h / 2, w, h, 0x070b12);

    // Title well above the grid
    this.add
      .text(w / 2, 28, 'CHOOSE YOUR RUNNER', {
        fontFamily: 'system-ui',
        fontSize: '26px',
        fontStyle: 'bold',
        color: '#f8fafc',
      })
      .setOrigin(0.5, 0);

    this.add
      .text(w / 2, 58, '9 runners. Pick your scar.', {
        fontFamily: 'system-ui',
        fontSize: '13px',
        color: '#94a3b8',
      })
      .setOrigin(0.5, 0);

    const cols = 3;
    const rows = 3;
    const marginX = 24;
    const topGrid = 88;
    const bottomReserve = 130;
    const gridH = h - topGrid - bottomReserve;
    const gridW = w - marginX * 2;
    const cardW = Math.min(220, (gridW - 16 * 2) / cols);
    const cardH = Math.min(120, (gridH - 12 * 2) / rows);
    const gapX = (gridW - cardW * cols) / (cols - 1);
    const gapY = (gridH - cardH * rows) / (rows - 1);
    const startX = marginX + cardW / 2;
    const startY = topGrid + cardH / 2;

    CHARACTERS.forEach((c, i) => {
      const col = i % cols;
      const row = (i / cols) | 0;
      const x = startX + col * (cardW + gapX);
      const y = startY + row * (cardH + gapY);
      const on = this.selected === c.id;

      const bg = this.add
        .rectangle(x, y, cardW, cardH, on ? 0x0c4a6e : 0x1e293b, 1)
        .setStrokeStyle(3, on ? c.color : 0x475569)
        .setInteractive({ useHandCursor: true });

      // Mini portrait (not overlapping title)
      this.add.circle(x - cardW * 0.32, y - 8, 14, c.color);
      this.add.circle(x - cardW * 0.32, y - 18, 7, c.hair || 0xfde68a);

      this.add
        .text(x + 8, y - 28, c.name, {
          fontFamily: 'system-ui',
          fontSize: '14px',
          fontStyle: 'bold',
          color: '#f8fafc',
        })
        .setOrigin(0.5, 0);
      this.add
        .text(x + 8, y - 10, c.title, {
          fontFamily: 'system-ui',
          fontSize: '11px',
          color: '#7dd3fc',
        })
        .setOrigin(0.5, 0);
      this.add
        .text(x, y + 12, c.blurb, {
          fontFamily: 'system-ui',
          fontSize: '10px',
          color: '#94a3b8',
          align: 'center',
          wordWrap: { width: cardW - 16 },
        })
        .setOrigin(0.5, 0);

      bg.on('pointerup', () => {
        this.selected = c.id;
        this.registry.set('characterId', c.id);
        this.draw();
      });
    });

    const narr = this.registry.get('narratorOn') !== false;
    const ny = h - 88;
    const box = this.add
      .rectangle(w / 2 - 200, ny, 20, 20, narr ? 0x0ea5e9 : 0x1e293b)
      .setStrokeStyle(2, 0x94a3b8)
      .setInteractive({ useHandCursor: true });
    this.add
      .text(w / 2 - 200, ny, narr ? 'Y' : '', {
        fontFamily: 'system-ui',
        fontSize: '12px',
        fontStyle: 'bold',
        color: '#0b1220',
      })
      .setOrigin(0.5);
    const nlab = this.add
      .text(w / 2 - 182, ny, 'Keep story cards after the tutorial', {
        fontFamily: 'system-ui',
        fontSize: '13px',
        color: '#e2e8f0',
      })
      .setOrigin(0, 0.5)
      .setInteractive({ useHandCursor: true });
    const toggleN = () => {
      this.registry.set('narratorOn', !(this.registry.get('narratorOn') !== false));
      this.draw();
    };
    box.on('pointerup', toggleN);
    nlab.on('pointerup', toggleN);

    const go = this.add
      .rectangle(w / 2, h - 40, 260, 48, 0x0ea5e9)
      .setStrokeStyle(2, 0x7dd3fc)
      .setInteractive({ useHandCursor: true });
    this.add
      .text(w / 2, h - 40, 'ENTER THE GRID', {
        fontFamily: 'system-ui',
        fontSize: '18px',
        fontStyle: 'bold',
        color: '#0b1220',
      })
      .setOrigin(0.5);
    go.on('pointerup', () => {
      this.registry.set('characterId', this.selected);
      this.scene.start('Game');
    });
  }
}
