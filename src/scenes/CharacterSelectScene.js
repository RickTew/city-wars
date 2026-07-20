import Phaser from 'phaser';
import { CHARACTERS } from '../config/characters.js';
import { HUD_FONT } from '../config/art.js';

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
    const narrow = w < 520;

    this.add.rectangle(w / 2, h / 2, w, h, 0x070b12);

    const titleSize = Math.min(28, Math.max(20, w * 0.058));
    const headerH = titleSize + 36;
    this.add
      .text(w / 2, Math.max(16, h * 0.03), 'CHOOSE YOUR RUNNER', {
        fontFamily: HUD_FONT,
        fontSize: titleSize + 'px',
        fontStyle: 'bold',
        color: '#f8fafc',
        stroke: '#0ea5e9',
        strokeThickness: 2,
      })
      .setOrigin(0.5, 0);

    this.add
      .text(w / 2, Math.max(16, h * 0.03) + titleSize + 4, '9 runners. Pick your scar.', {
        fontFamily: 'system-ui',
        fontSize: '12px',
        color: '#94a3b8',
      })
      .setOrigin(0.5, 0);

    const cols = 3;
    const rows = 3;
    const gapX = narrow ? 8 : 10;
    const gapY = narrow ? 8 : 10;
    const topLimit = Math.max(72, h * 0.03 + headerH);
    const bottomLimit = h - 96;
    const cardW = Math.floor((w - 24 - gapX * (cols - 1)) / cols);
    const cardH = Math.min(152, Math.floor((bottomLimit - topLimit - gapY * (rows - 1)) / rows));
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

      const bg = this.add
        .rectangle(x, y, cardW, cardH, on ? 0x0c4a6e : 0x1e293b, 1)
        .setStrokeStyle(3, on ? c.color : 0x475569)
        .setInteractive({ useHandCursor: true });

      this.add.circle(left + 10, y - cardH / 2 + 22, 10, c.color);
      this.add.circle(left + 10, y - cardH / 2 + 16, 5, c.hair || 0xfde68a);

      this.add
        .text(left + 24, y - cardH / 2 + 10, c.name, {
          fontFamily: 'system-ui',
          fontSize: narrow ? '11px' : '12px',
          fontStyle: 'bold',
          color: '#f8fafc',
        })
        .setOrigin(0, 0);
      this.add
        .text(left + 24, y - cardH / 2 + 24, c.title, {
          fontFamily: 'system-ui',
          fontSize: '9px',
          color: '#7dd3fc',
        })
        .setOrigin(0, 0);

      const bonusLine = formatBonuses(c.bonuses);
      const showBlurb = cardH >= 118;
      if (showBlurb) {
        this.add
          .text(x, y - cardH / 2 + 44, c.blurb, {
            fontFamily: 'system-ui',
            fontSize: '8px',
            color: '#94a3b8',
            align: 'center',
            wordWrap: { width: cardW - 12 },
          })
          .setOrigin(0.5, 0);
      }

      this.add
        .text(x, y + cardH / 2 - 8, bonusLine, {
          fontFamily: 'system-ui',
          fontSize: '8px',
          fontStyle: 'bold',
          color: on ? '#fde68a' : '#64748b',
          align: 'center',
          wordWrap: { width: cardW - 10 },
        })
        .setOrigin(0.5, 1);

      bg.on('pointerup', () => {
        this.selected = c.id;
        this.registry.set('characterId', c.id);
        this.draw();
      });
    });

    const narr = this.registry.get('narratorOn') !== false;
    const ny = h - 72;
    const box = this.add
      .rectangle(w / 2 - (narrow ? 150 : 200), ny, 20, 20, narr ? 0x0ea5e9 : 0x1e293b)
      .setStrokeStyle(2, 0x94a3b8)
      .setInteractive({ useHandCursor: true });
    this.add
      .text(w / 2 - (narrow ? 150 : 200), ny, narr ? 'Y' : '', {
        fontFamily: 'system-ui',
        fontSize: '12px',
        fontStyle: 'bold',
        color: '#0b1220',
      })
      .setOrigin(0.5);
    const nlab = this.add
      .text(w / 2 - (narrow ? 132 : 182), ny, 'Keep story cards after the tutorial', {
        fontFamily: 'system-ui',
        fontSize: narrow ? '11px' : '13px',
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
      .rectangle(w / 2, h - 36, Math.min(260, w - 32), 46, 0x0ea5e9)
      .setStrokeStyle(2, 0x7dd3fc)
      .setInteractive({ useHandCursor: true });
    this.add
      .text(w / 2, h - 36, 'ENTER THE GRID', {
        fontFamily: 'system-ui',
        fontSize: '17px',
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

/** Short mechanical summary for runner cards */
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
