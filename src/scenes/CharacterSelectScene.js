import Phaser from 'phaser';
import { CHARACTERS } from '../config/characters.js';
import { HUD_FONT } from '../config/art.js';
import { AudioBus } from '../systems/AudioBus.js';

/**
 * Runner pick. Solid dark panel. High-contrast cards.
 * No busy skyline behind text (that caused text-on-text).
 */
export class CharacterSelectScene extends Phaser.Scene {
  constructor() {
    super('CharacterSelect');
  }

  create() {
    if (!this.registry.get('dayLength')) this.registry.set('dayLength', 'medium');
    if (this.registry.get('narratorOn') === undefined) this.registry.set('narratorOn', true);
    this.selected = this.registry.get('characterId') || CHARACTERS[0].id;
    this.audio = this.registry.get('audio') || new AudioBus();
    this.registry.set('audio', this.audio);
    this.draw();
    this.scale.on('resize', () => this.draw());
  }

  draw() {
    this.children.removeAll(true);
    const w = this.scale.width;
    const h = this.scale.height;
    const narrow = w < 520;

    // Solid readable base. No window-dot skyline behind cards.
    this.add.rectangle(w / 2, h / 2, w, h, 0x0b1220, 1);
    this.add.rectangle(w / 2, h * 0.72, w, h * 0.56, 0x020617, 1);

    const titleSize = Math.min(30, Math.max(22, w * 0.06));
    const headerY = Math.max(14, h * 0.02);
    this.add
      .text(w / 2, headerY, 'CHOOSE YOUR RUNNER', {
        fontFamily: HUD_FONT,
        fontSize: titleSize + 'px',
        fontStyle: 'bold',
        color: '#f8fafc',
        stroke: '#ea580c',
        strokeThickness: 3,
      })
      .setOrigin(0.5, 0);

    this.add
      .text(w / 2, headerY + titleSize + 2, '9 runners. Pick your scar.', {
        fontFamily: 'system-ui',
        fontSize: narrow ? '13px' : '14px',
        color: '#fdba74',
      })
      .setOrigin(0.5, 0);

    const cols = 3;
    const rows = 3;
    const gapX = narrow ? 8 : 12;
    const gapY = narrow ? 8 : 10;
    const topLimit = headerY + titleSize + 28;
    const bottomLimit = h - 100;
    const cardW = Math.floor((w - 24 - gapX * (cols - 1)) / cols);
    const cardH = Math.min(148, Math.floor((bottomLimit - topLimit - gapY * (rows - 1)) / rows));
    const gridW = cols * cardW + (cols - 1) * gapX;
    const startX = w / 2 - gridW / 2 + cardW / 2;
    const startY = topLimit + cardH / 2;

    CHARACTERS.forEach((c, i) => {
      const col = i % cols;
      const row = (i / cols) | 0;
      const x = startX + col * (cardW + gapX);
      const y = startY + row * (cardH + gapY);
      const on = this.selected === c.id;
      const left = x - cardW / 2 + 8;

      // Fully opaque card plate
      this.add
        .rectangle(x, y, cardW, cardH, on ? 0x0c4a6e : 0x1e293b, 1)
        .setStrokeStyle(3, on ? c.color : 0x64748b)
        .setInteractive({ useHandCursor: true })
        .on('pointerup', () => {
          this.selected = c.id;
          this.registry.set('characterId', c.id);
          this.draw();
        });

      this.add.circle(left + 10, y - cardH / 2 + 20, 9, c.color);
      this.add.circle(left + 10, y - cardH / 2 + 15, 4, c.hair || 0xfde68a);

      this.add
        .text(left + 24, y - cardH / 2 + 8, c.name, {
          fontFamily: 'system-ui',
          fontSize: narrow ? '13px' : '14px',
          fontStyle: 'bold',
          color: '#f8fafc',
        })
        .setOrigin(0, 0);

      this.add
        .text(left + 24, y - cardH / 2 + 26, c.title, {
          fontFamily: 'system-ui',
          fontSize: narrow ? '11px' : '12px',
          color: '#7dd3fc',
        })
        .setOrigin(0, 0);

      if (cardH >= 110) {
        this.add
          .text(x, y - cardH / 2 + 46, c.blurb, {
            fontFamily: 'system-ui',
            fontSize: narrow ? '11px' : '12px',
            color: '#e2e8f0',
            align: 'center',
            wordWrap: { width: cardW - 14 },
          })
          .setOrigin(0.5, 0);
      }

      this.add
        .text(x, y + cardH / 2 - 10, formatBonuses(c.bonuses), {
          fontFamily: 'system-ui',
          fontSize: narrow ? '11px' : '12px',
          fontStyle: 'bold',
          color: on ? '#fde68a' : '#cbd5e1',
          align: 'center',
          wordWrap: { width: cardW - 12 },
        })
        .setOrigin(0.5, 1);
    });

    // Solid footer strip so checkbox + CTA never sit on skyline noise
    this.add.rectangle(w / 2, h - 50, w, 100, 0x020617, 1);

    const narr = this.registry.get('narratorOn') !== false;
    const ny = h - 72;
    const box = this.add
      .rectangle(w / 2 - (narrow ? 150 : 200), ny, 22, 22, narr ? 0x0ea5e9 : 0x334155, 1)
      .setStrokeStyle(2, 0xe2e8f0)
      .setInteractive({ useHandCursor: true });
    this.add
      .text(w / 2 - (narrow ? 150 : 200), ny, narr ? 'Y' : '', {
        fontFamily: 'system-ui',
        fontSize: '13px',
        fontStyle: 'bold',
        color: '#0b1220',
      })
      .setOrigin(0.5);
    const nlab = this.add
      .text(w / 2 - (narrow ? 132 : 182), ny, 'Keep story cards after the tutorial', {
        fontFamily: 'system-ui',
        fontSize: narrow ? '13px' : '14px',
        color: '#f1f5f9',
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
      .rectangle(w / 2, h - 32, Math.min(280, w - 32), 48, 0xea580c, 1)
      .setStrokeStyle(2, 0xfbbf24)
      .setInteractive({ useHandCursor: true });
    this.add
      .text(w / 2, h - 32, 'ENTER THE GRID', {
        fontFamily: 'system-ui',
        fontSize: '18px',
        fontStyle: 'bold',
        color: '#0b1220',
      })
      .setOrigin(0.5);
    go.on('pointerup', () => {
      this.audio?.uiClick?.();
      this.audio?.stopMenu?.();
      this.registry.set('characterId', this.selected);
      this.scene.start('Game');
    });
  }
}

function formatBonuses(b = {}) {
  const parts = [];
  if (b.atk) parts.push(`ATK${b.atk > 0 ? '+' : ''}${b.atk}`);
  if (b.def) parts.push(`DEF+${b.def}`);
  if (b.maxHp) parts.push(`HP${b.maxHp > 0 ? '+' : ''}${b.maxHp}`);
  if (b.moveBonus) parts.push(b.moveBonus > 0 ? 'FAST' : 'SLOW');
  if (b.sneakBonus) parts.push(b.sneakBonus > 0 ? `SNK+${b.sneakBonus}` : 'LOUD');
  if (b.visionDay) parts.push(`VIS+${b.visionDay}`);
  if (b.scavengeBonus) parts.push(`LOOT+${b.scavengeBonus}`);
  if (b.healBonus) parts.push(`HEAL+${b.healBonus}`);
  if (b.batBonus) parts.push(`CLUB+${b.batBonus}`);
  if (b.rangedBonus) parts.push(`GUN+${b.rangedBonus}`);
  if (b.craftBonus) parts.push(`CRF+${b.craftBonus}`);
  if (b.explosiveBonus) parts.push(`BOOM+${b.explosiveBonus}`);
  return parts.length ? parts.join(' · ') : 'balanced';
}
