import Phaser from 'phaser';
import { CHARACTERS } from '../config/characters.js';
import { AudioBus } from '../systems/AudioBus.js';
import { DomUi } from '../systems/DomUi.js';

function hexColor(n) {
  return `#${(n >>> 0).toString(16).padStart(6, '0')}`;
}

/**
 * Runner pick. Solid dark Phaser base; all labels/cards = DOM (crisp type).
 * Procedural avatar chips stand in until pixel runner sprites land.
 * See VISUAL-STYLE.md.
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
    this.audio.ensure();
  }

  shutdown() {
    DomUi.clearAll();
  }

  draw() {
    this.children.removeAll(true);
    const w = this.scale.width;
    const h = this.scale.height;

    this.add.rectangle(w / 2, h / 2, w, h, 0x0b1220, 1);

    DomUi.clearAll();
    const root = DomUi.show('char-ui');
    if (!root) return;

    root.appendChild(DomUi.el('h1', '', 'CHOOSE YOUR RUNNER'));
    root.appendChild(DomUi.el('div', 'subhead', '9 runners. Pick your scar.'));

    const list = DomUi.el('div', 'char-list');
    CHARACTERS.forEach((c) => {
      const on = this.selected === c.id;
      const card = DomUi.button(`hit char-card${on ? ' selected' : ''}`, '', () => {
        this.selected = c.id;
        this.registry.set('characterId', c.id);
        this.audio?.uiClick?.();
        this.draw();
      });

      // Procedural portrait chip (body + hair) until pixel sprites exist
      const avatar = DomUi.el('div', 'avatar');
      const body = DomUi.el('div', 'body');
      body.style.background = hexColor(c.color);
      const hair = DomUi.el('div', 'hair');
      hair.style.background = hexColor(c.hair || 0xfde68a);
      avatar.appendChild(body);
      avatar.appendChild(hair);
      card.appendChild(avatar);

      const meta = DomUi.el('div', 'meta');
      meta.appendChild(DomUi.el('div', 'name', c.name));
      meta.appendChild(DomUi.el('div', 'role', c.title));
      meta.appendChild(DomUi.el('div', 'blurb', c.blurb));
      meta.appendChild(DomUi.el('div', 'stats', formatBonuses(c.bonuses)));
      card.appendChild(meta);

      list.appendChild(card);
    });
    root.appendChild(list);

    const narr = this.registry.get('narratorOn') !== false;
    const narrRow = DomUi.el('div', 'muted');
    narrRow.style.pointerEvents = 'auto';
    narrRow.style.margin = '8px 0';
    narrRow.style.cursor = 'pointer';
    narrRow.textContent = narr
      ? '☑ Keep story cards after the tutorial'
      : '☐ Keep story cards after the tutorial';
    narrRow.addEventListener('pointerup', (e) => {
      e.stopPropagation();
      this.registry.set('narratorOn', !narr);
      this.draw();
    });
    root.appendChild(narrRow);

    root.appendChild(
      DomUi.button('hit char-enter', 'ENTER THE GRID', () => {
        this.audio?.uiClick?.();
        this.audio?.stopMenu?.();
        this.registry.set('characterId', this.selected);
        DomUi.clear();
        this.scene.start('Game');
      })
    );
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
