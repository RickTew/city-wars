import Phaser from 'phaser';
import { DAY_LENGTH } from '../config/constants.js';
import { HUD_FONT } from '../config/art.js';
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

    const titleY = h * 0.11;
    const titleSize = Math.round(Math.min(76, Math.max(44, w * 0.11, h * 0.052)));

    // Soft glow behind title
    this.add
      .text(w / 2, titleY, 'CITY WARS', {
        fontFamily: HUD_FONT,
        fontSize: titleSize + 'px',
        fontStyle: 'bold',
        color: '#0ea5e9',
      })
      .setOrigin(0.5)
      .setAlpha(0.35)
      .setScale(1.06);

    this.add
      .text(w / 2, titleY, 'CITY WARS', {
        fontFamily: HUD_FONT,
        fontSize: titleSize + 'px',
        fontStyle: 'bold',
        color: '#f8fafc',
        stroke: '#0ea5e9',
        strokeThickness: Math.max(3, Math.round(titleSize * 0.06)),
        shadow: { offsetX: 0, offsetY: 0, color: '#38bdf8', blur: 16, fill: true },
      })
      .setOrigin(0.5);

    this.add
      .text(w / 2, titleY + titleSize * 0.62, 'ESCAPE FROM THE GRID', {
        fontFamily: HUD_FONT,
        fontSize: Math.min(20, Math.max(14, w * 0.038)) + 'px',
        color: '#38bdf8',
        letterSpacing: 2,
      })
      .setOrigin(0.5);

    const legacy = RunLegacy.summaryLine();
    this.add
      .text(w / 2, titleY + titleSize * 0.62 + 28, legacy, {
        fontFamily: 'system-ui',
        fontSize: '13px',
        color: '#64748b',
      })
      .setOrigin(0.5);

    this.add
      .text(w / 2, titleY + titleSize * 0.62 + 48, 'Day length (how fast night comes)', {
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
    const btnW = Math.min(120, Math.max(88, (w - 48) / 3 - 8));
    const gap = btnW + 12;
    const startX = w / 2 - gap;
    const by = titleY + titleSize * 0.62 + 88;
    opts.forEach((o, i) => {
      const selected = dayKey === o.key;
      const bx = startX + i * gap;
      const bg = this.add
        .rectangle(bx, by, btnW, 56, selected ? 0x0ea5e9 : 0x1e293b, 1)
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

    const startY = hasSave ? by + 88 : by + 72;
    const start = this.add
      .rectangle(w / 2, startY, Math.min(300, w - 40), 64, 0x0ea5e9)
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
        .rectangle(w / 2, startY + 72, Math.min(300, w - 40), 52, 0x14532d)
        .setStrokeStyle(2, 0x4ade80)
        .setInteractive({ useHandCursor: true });
      const when = peek?.savedAt ? new Date(peek.savedAt).toLocaleString() : '';
      this.add
        .text(w / 2, startY + 72, `CONTINUE${when ? `  ·  ${when}` : ''}`, {
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

    const helpY = hasSave ? startY + 148 : startY + 96;
    const helpBg = this.add
      .rectangle(w / 2, helpY, Math.min(340, w - 24), 52, 0x0f172a, 0.92)
      .setStrokeStyle(1, 0x334155);
    this.add
      .text(
        w / 2,
        helpY,
        'Tap map to walk · loot / bench / enemy\nCombat: SPEC or long-press · two-row bar on phone',
        {
          fontFamily: 'system-ui',
          fontSize: '12px',
          color: '#94a3b8',
          align: 'center',
          lineSpacing: 4,
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
