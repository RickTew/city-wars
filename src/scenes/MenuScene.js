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
    const narrow = w < 520;

    this.add.rectangle(w / 2, h / 2, w, h, 0x070b12);

    const skylineY = h * 0.64;
    const g = this.add.graphics();
    for (let i = 0; i < Math.ceil(w / 50) + 2; i++) {
      const bx = i * 52;
      const bh = 50 + (i * 41) % 120;
      g.fillStyle(0x111827, 1);
      g.fillRect(bx, skylineY - bh, 44, bh + h - skylineY + 40);
      g.fillStyle(0xfbbf24, 0.22);
      for (let y = skylineY - bh + 12; y < h - 24; y += 18) {
        if ((i + y) % 3) g.fillRect(bx + 10, y, 5, 5);
      }
    }

    const titleSize = Math.round(Math.min(76, Math.max(44, w * 0.11, h * 0.048)));
    const tagSize = Math.min(18, Math.max(13, w * 0.034));
    const btnW = Math.min(108, Math.max(96, (w - 56) / 3 - 10));
    const dayBtnH = 58;
    const startH = 60;
    const contH = hasSave ? 50 : 0;
    const helpH = 56;
    const gap = narrow ? 18 : 22;

    const blockH =
      titleSize * 1.1 +
      tagSize +
      14 +
      16 +
      gap +
      18 +
      gap +
      dayBtnH +
      gap +
      startH +
      (hasSave ? gap + contH : 0) +
      gap +
      helpH;

    let y = Math.max(48, (skylineY - blockH) / 2 + titleSize * 0.5);

    // Title glow + main
    this.add
      .text(w / 2, y, 'CITY WARS', {
        fontFamily: HUD_FONT,
        fontSize: titleSize + 'px',
        fontStyle: 'bold',
        color: '#0ea5e9',
      })
      .setOrigin(0.5)
      .setAlpha(0.35)
      .setScale(1.06);

    this.add
      .text(w / 2, y, 'CITY WARS', {
        fontFamily: HUD_FONT,
        fontSize: titleSize + 'px',
        fontStyle: 'bold',
        color: '#f8fafc',
        stroke: '#0ea5e9',
        strokeThickness: Math.max(3, Math.round(titleSize * 0.06)),
        shadow: { offsetX: 0, offsetY: 0, color: '#38bdf8', blur: 16, fill: true },
      })
      .setOrigin(0.5);

    y += titleSize * 0.55 + gap * 0.5;

    this.add
      .text(w / 2, y, 'ESCAPE FROM THE GRID', {
        fontFamily: HUD_FONT,
        fontSize: tagSize + 'px',
        color: '#38bdf8',
        letterSpacing: 2,
      })
      .setOrigin(0.5);

    y += tagSize + 14;

    const legacy = RunLegacy.summaryLine();
    this.add
      .text(w / 2, y, legacy, {
        fontFamily: 'system-ui',
        fontSize: '12px',
        color: '#64748b',
      })
      .setOrigin(0.5);

    y += 16 + gap;

    this.add
      .text(w / 2, y, 'Day length', {
        fontFamily: 'system-ui',
        fontSize: narrow ? '13px' : '15px',
        color: '#94a3b8',
      })
      .setOrigin(0.5);
    this.add
      .text(w / 2, y + (narrow ? 14 : 16), 'How fast night comes', {
        fontFamily: 'system-ui',
        fontSize: '11px',
        color: '#475569',
      })
      .setOrigin(0.5);

    y += (narrow ? 32 : 36) + gap + 8;

    const opts = [
      { key: 'short', label: 'SHORT', sub: '~8m' },
      { key: 'medium', label: 'MEDIUM', sub: '~15m' },
      { key: 'long', label: 'LONG', sub: '~25m' },
    ];
    const dayGap = btnW + (narrow ? 10 : 14);
    const dayStartX = w / 2 - dayGap;
    opts.forEach((o, i) => {
      const selected = dayKey === o.key;
      const bx = dayStartX + i * dayGap;
      const bg = this.add
        .rectangle(bx, y, btnW, dayBtnH, selected ? 0x0ea5e9 : 0x1e293b, 1)
        .setStrokeStyle(2, selected ? 0x7dd3fc : 0x475569)
        .setInteractive({ useHandCursor: true });
      this.add
        .text(bx, y - 10, o.label, {
          fontFamily: 'system-ui',
          fontSize: narrow ? '14px' : '15px',
          fontStyle: 'bold',
          color: selected ? '#0b1220' : '#e2e8f0',
        })
        .setOrigin(0.5);
      this.add
        .text(bx, y + 12, o.sub, {
          fontFamily: 'system-ui',
          fontSize: '10px',
          color: selected ? '#0f172a' : '#64748b',
        })
        .setOrigin(0.5);
      bg.on('pointerup', () => {
        this.registry.set('dayLength', o.key);
        this.draw();
      });
    });

    y += dayBtnH / 2 + gap + startH / 2;

    const startW = Math.min(280, w - 48);
    const start = this.add
      .rectangle(w / 2, y, startW, startH, 0x0ea5e9, 1)
      .setStrokeStyle(3, 0x7dd3fc)
      .setInteractive({ useHandCursor: true });
    this.add
      .text(w / 2, y, 'START RUN', {
        fontFamily: 'system-ui',
        fontSize: narrow ? '22px' : '26px',
        fontStyle: 'bold',
        color: '#0b1220',
      })
      .setOrigin(0.5);
    start.on('pointerup', () => {
      this.registry.set('loadSave', false);
      this.scene.start('CharacterSelect');
    });

    if (hasSave) {
      y += startH / 2 + gap + contH / 2;
      const cont = this.add
        .rectangle(w / 2, y, startW, contH, 0x14532d, 1)
        .setStrokeStyle(2, 0x4ade80)
        .setInteractive({ useHandCursor: true });
      const when = peek?.savedAt ? new Date(peek.savedAt).toLocaleString() : '';
      this.add
        .text(w / 2, y, when ? `CONTINUE · ${when}` : 'CONTINUE', {
          fontFamily: 'system-ui',
          fontSize: narrow ? '15px' : '17px',
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

    y += (hasSave ? contH / 2 : startH / 2) + gap + helpH / 2;
    const helpW = Math.min(320, w - 32);
    this.add
      .rectangle(w / 2, y, helpW, helpH, 0x0f172a, 0.94)
      .setStrokeStyle(1, 0x334155);
    this.add
      .text(w / 2, y - 8, 'Tap map to walk · loot / bench / fight', {
        fontFamily: 'system-ui',
        fontSize: '11px',
        color: '#94a3b8',
        align: 'center',
      })
      .setOrigin(0.5);
    this.add
      .text(w / 2, y + 10, 'Combat: SPEC or long-press map', {
        fontFamily: 'system-ui',
        fontSize: '11px',
        color: '#64748b',
        align: 'center',
      })
      .setOrigin(0.5);

    this.add
      .text(w / 2, h - 16, `~${Math.round(DAY_LENGTH[dayKey] / 60)} min cycle  ·  Phaser 4`, {
        fontFamily: 'system-ui',
        fontSize: '11px',
        color: '#475569',
      })
      .setOrigin(0.5);
  }
}
