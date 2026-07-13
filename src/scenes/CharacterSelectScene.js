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

    this.add
      .text(w / 2, Math.max(20, h * 0.06), 'CHOOSE YOUR RUNNER', {
        fontFamily: 'system-ui',
        fontSize: '26px',
        fontStyle: 'bold',
        color: '#f8fafc',
      })
      .setOrigin(0.5, 0);

    this.add
      .text(w / 2, Math.max(48, h * 0.06 + 28), '9 runners. Pick your scar.', {
        fontFamily: 'system-ui',
        fontSize: '13px',
        color: '#94a3b8',
      })
      .setOrigin(0.5, 0);

    // Tight fixed grid, centered (not stretched to screen edges)
    const cols = 3;
    const rows = 3;
    const cardW = Math.min(248, Math.floor((w - 80) / 3));
    const cardH = 128;
    const gapX = 14;
    const gapY = 12;
    const gridW = cols * cardW + (cols - 1) * gapX;
    const gridH = rows * cardH + (rows - 1) * gapY;
    const startX = w / 2 - gridW / 2 + cardW / 2;
    // Vertical: center pack between title and bottom controls
    const topLimit = Math.max(88, h * 0.06 + 60);
    const bottomLimit = h - 110;
    const midY = (topLimit + bottomLimit) / 2;
    const startY = midY - gridH / 2 + cardH / 2;

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

      this.add.circle(x - cardW * 0.34, y - 6, 14, c.color);
      this.add.circle(x - cardW * 0.34, y - 16, 7, c.hair || 0xfde68a);

      this.add
        .text(x + 10, y - 30, c.name, {
          fontFamily: 'system-ui',
          fontSize: '14px',
          fontStyle: 'bold',
          color: '#f8fafc',
        })
        .setOrigin(0.5, 0);
      this.add
        .text(x + 10, y - 12, c.title, {
          fontFamily: 'system-ui',
          fontSize: '11px',
          color: '#7dd3fc',
        })
        .setOrigin(0.5, 0);
      this.add
        .text(x, y + 8, c.blurb, {
          fontFamily: 'system-ui',
          fontSize: '9px',
          color: '#94a3b8',
          align: 'center',
          wordWrap: { width: cardW - 20 },
        })
        .setOrigin(0.5, 0);

      const bonusLine = formatBonuses(c.bonuses);
      this.add
        .text(x, y + cardH / 2 - 14, bonusLine, {
          fontFamily: 'system-ui',
          fontSize: '10px',
          fontStyle: 'bold',
          color: on ? '#fde68a' : '#64748b',
          align: 'center',
          wordWrap: { width: cardW - 16 },
        })
        .setOrigin(0.5, 0.5);

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

/** Short mechanical summary for runner cards */
function formatBonuses(b = {}) {
  const parts = [];
  if (b.atk) parts.push(`ATK${b.atk > 0 ? '+' : ''}${b.atk}`);
  if (b.def) parts.push(`DEF+${b.def}`);
  if (b.maxHp) parts.push(`HP${b.maxHp > 0 ? '+' : ''}${b.maxHp}`);
  if (b.moveBonus) parts.push(b.moveBonus > 0 ? 'FAST' : 'SLOW');
  if (b.sneakBonus) parts.push(b.sneakBonus > 0 ? `SNEAK+${b.sneakBonus}` : 'LOUD');
  if (b.visionDay) parts.push(`VISION+${b.visionDay}`);
  if (b.scavengeBonus) parts.push(`LOOT+${b.scavengeBonus}`);
  if (b.healBonus) parts.push(`HEAL+${b.healBonus}`);
  if (b.batBonus) parts.push(`CLUB+${b.batBonus}`);
  if (b.rangedBonus) parts.push(`GUN+${b.rangedBonus}`);
  if (b.craftBonus) parts.push(`CRAFT+${b.craftBonus}`);
  if (b.explosiveBonus) parts.push(`BOOM+${b.explosiveBonus}`);
  return parts.length ? parts.join(' · ') : 'balanced';
}
