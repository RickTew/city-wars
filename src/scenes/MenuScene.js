import Phaser from 'phaser';
import { DAY_LENGTH } from '../config/constants.js';
import { SaveSystem } from '../systems/SaveSystem.js';
import { RunLegacy } from '../systems/RunLegacy.js';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super('Menu');
  }

  create() {
    // Default day length
    if (!this.registry.get('dayLength')) {
      this.registry.set('dayLength', 'medium');
    }
    this.draw();
    this.scale.on('resize', () => this.draw());
  }

  draw() {
    this.children.removeAll(true);
    const w = this.scale.width;
    const h = this.scale.height;
    const dayKey = this.registry.get('dayLength') || 'medium';
    const hasSave = SaveSystem.hasSave();
    const peek = hasSave ? SaveSystem.peek() : null;

    this.add.rectangle(w / 2, h / 2, w, h, 0x070b12);

    const g = this.add.graphics();
    for (let i = 0; i < Math.ceil(w / 50) + 2; i++) {
      const bx = i * 52;
      const bh = 50 + (i * 41) % 120;
      g.fillStyle(0x111827, 1);
      g.fillRect(bx, h * 0.55 - bh, 44, bh + 100);
      g.fillStyle(0xfbbf24, 0.3);
      for (let y = h * 0.55 - bh + 12; y < h - 30; y += 16) {
        if ((i + y) % 3) g.fillRect(bx + 10, y, 5, 5);
      }
    }

    this.add
      .text(w / 2, h * 0.12, 'CITY WARS', {
        fontFamily: 'system-ui',
        fontSize: Math.min(64, w * 0.055) + 'px',
        fontStyle: 'bold',
        color: '#f8fafc',
        stroke: '#0ea5e9',
        strokeThickness: 4,
      })
      .setOrigin(0.5);

    this.add
      .text(w / 2, h * 0.22, 'ESCAPE FROM THE GRID', {
        fontFamily: 'system-ui',
        fontSize: '18px',
        color: '#38bdf8',
      })
      .setOrigin(0.5);

    const legacy = RunLegacy.summaryLine();
    this.add
      .text(w / 2, h * 0.27, legacy, {
        fontFamily: 'system-ui',
        fontSize: '13px',
        color: '#64748b',
      })
      .setOrigin(0.5);

    this.add
      .text(w / 2, h * 0.32, 'Day length (how fast night comes)', {
        fontFamily: 'system-ui',
        fontSize: '15px',
        color: '#94a3b8',
      })
      .setOrigin(0.5);

    const opts = [
      { key: 'short', label: 'SHORT', sub: '~8 min cycle' },
      { key: 'medium', label: 'MEDIUM', sub: '~15 min cycle' },
      { key: 'long', label: 'LONG', sub: '~25 min cycle' },
    ];
    const gap = 140;
    const startX = w / 2 - gap;
    opts.forEach((o, i) => {
      const selected = dayKey === o.key;
      const bx = startX + i * gap;
      const by = h * 0.42;
      const bg = this.add
        .rectangle(bx, by, 120, 56, selected ? 0x0ea5e9 : 0x1e293b, 1)
        .setStrokeStyle(2, selected ? 0x7dd3fc : 0x475569)
        .setInteractive({ useHandCursor: true });
      this.add
        .text(bx, by - 8, o.label, {
          fontFamily: 'system-ui',
          fontSize: '16px',
          fontStyle: 'bold',
          color: selected ? '#0b1220' : '#e2e8f0',
        })
        .setOrigin(0.5);
      this.add
        .text(bx, by + 14, o.sub, {
          fontFamily: 'system-ui',
          fontSize: '11px',
          color: selected ? '#0f172a' : '#64748b',
        })
        .setOrigin(0.5);
      bg.on('pointerup', () => {
        this.registry.set('dayLength', o.key);
        this.draw();
      });
    });

    const startY = hasSave ? h * 0.55 : h * 0.58;
    const start = this.add
      .rectangle(w / 2, startY, 300, 64, 0x0ea5e9)
      .setStrokeStyle(3, 0x7dd3fc)
      .setInteractive({ useHandCursor: true });
    this.add
      .text(w / 2, startY, 'START RUN', {
        fontFamily: 'system-ui',
        fontSize: '26px',
        fontStyle: 'bold',
        color: '#0b1220',
      })
      .setOrigin(0.5);
    start.on('pointerup', () => {
      this.registry.set('loadSave', false);
      this.scene.start('CharacterSelect');
    });

    if (hasSave) {
      const cont = this.add
        .rectangle(w / 2, h * 0.66, 300, 52, 0x14532d)
        .setStrokeStyle(2, 0x4ade80)
        .setInteractive({ useHandCursor: true });
      const when = peek?.savedAt ? new Date(peek.savedAt).toLocaleString() : '';
      this.add
        .text(w / 2, h * 0.66, `CONTINUE${when ? `  ·  ${when}` : ''}`, {
          fontFamily: 'system-ui',
          fontSize: '18px',
          fontStyle: 'bold',
          color: '#ecfdf5',
        })
        .setOrigin(0.5);
      cont.on('pointerup', () => {
        this.registry.set('loadSave', true);
        if (peek?.dayLength) this.registry.set('dayLength', peek.dayLength);
        if (peek?.characterId) this.registry.set('characterId', peek.characterId);
        this.scene.start('Game');
      });
    }

    this.add
      .text(
        w / 2,
        h * 0.78,
        'Click/tap map to walk · loot / bench / enemy · buttons below\nCombat: SPEC or long-press for specials · MORE on phones',
        {
          fontFamily: 'system-ui',
          fontSize: '14px',
          color: '#64748b',
          align: 'center',
          lineSpacing: 5,
        }
      )
      .setOrigin(0.5);

    this.add
      .text(w / 2, h - 20, `Day cycle: ~${Math.round(DAY_LENGTH[dayKey] / 60)} min  ·  Phaser 4  ·  Grok`, {
        fontFamily: 'system-ui',
        fontSize: '12px',
        color: '#475569',
      })
      .setOrigin(0.5);
  }
}
