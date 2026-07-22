import Phaser from 'phaser';
import { DAY_LENGTH } from '../config/constants.js';
import { SaveSystem } from '../systems/SaveSystem.js';
import { RunLegacy } from '../systems/RunLegacy.js';
import { drawMenuBackdrop } from '../systems/MenuBackdrop.js';
import { AudioBus } from '../systems/AudioBus.js';
import { DomUi } from '../systems/DomUi.js';

/**
 * Title menu: Phaser = atmosphere only. All labels/buttons = DOM (crisp type).
 * See VISUAL-STYLE.md — never Phaser Text for player-facing UI.
 */
export class MenuScene extends Phaser.Scene {
  constructor() {
    super('Menu');
  }

  create() {
    if (!this.registry.get('dayLength')) {
      this.registry.set('dayLength', 'medium');
    }
    this.audio = this.registry.get('audio') || new AudioBus();
    this.registry.set('audio', this.audio);
    this.audio.loadMute();

    this._backdrop = null;
    this.draw();
    this.scale.on('resize', () => this.draw());

    // Browsers suspend AudioContext until a real gesture. DOM buttons do not
    // fire Phaser pointerdown — unlock on canvas tap AND any menu click.
    this.input.on('pointerdown', () => this.startIntroAudio());
    this.time.delayedCall(100, () => this.startIntroAudio());
  }

  startIntroAudio() {
    // Safe to call repeatedly: unlocks ctx + starts bed once, kicks a cue after unlock
    this.audio.unlockAndMenu();
  }

  update(_t, dtMs) {
    const dt = (dtMs || 16) / 1000;
    this._backdrop?.tick?.(dt);
  }

  shutdown() {
    DomUi.clear();
  }

  draw() {
    this.children.removeAll(true);
    this._backdrop = null;

    const w = this.scale.width;
    const h = this.scale.height;
    this._backdrop = drawMenuBackdrop(this, w, h);

    const dayKey = this.registry.get('dayLength') || 'medium';
    const hasSave = SaveSystem.hasSave();
    const peek = hasSave ? SaveSystem.peek() : null;
    const legacy = RunLegacy.summaryLine();
    const mins = Math.round(DAY_LENGTH[dayKey] / 60);

    DomUi.clear();
    const root = DomUi.show('menu-ui');
    if (!root) return;

    const stack = DomUi.el('div', 'menu-stack');

    stack.appendChild(DomUi.el('div', 'title', 'CITY WARS'));
    stack.appendChild(DomUi.el('div', 'tagline', 'The city still burns. You should leave.'));
    stack.appendChild(DomUi.el('div', 'muted', legacy));

    const dayHead = DomUi.el('div', '');
    dayHead.appendChild(DomUi.el('div', 'section-label', 'Day length'));
    dayHead.appendChild(DomUi.el('div', 'section-sub', 'How fast the jokes get darker'));
    stack.appendChild(dayHead);

    const dayRow = DomUi.el('div', 'day-row');
    const opts = [
      { key: 'short', label: 'SHORT', sub: '~8m' },
      { key: 'medium', label: 'MEDIUM', sub: '~15m' },
      { key: 'long', label: 'LONG', sub: '~25m' },
    ];
    opts.forEach((o) => {
      const selected = dayKey === o.key;
      const btn = DomUi.button(`hit day-btn${selected ? ' selected' : ''}`, '', () => {
        this.startIntroAudio(); // unlock AudioContext on DOM click
        this.audio.uiClick();
        this.registry.set('dayLength', o.key);
        this.draw();
      });
      btn.appendChild(document.createTextNode(o.label));
      btn.appendChild(DomUi.el('span', 'sub', o.sub));
      dayRow.appendChild(btn);
    });
    stack.appendChild(dayRow);

    stack.appendChild(
      DomUi.button('hit start-btn', 'START RUN', () => {
        this.startIntroAudio();
        this.audio.uiClick();
        this.audio.stopMenu();
        this.registry.set('loadSave', false);
        DomUi.clear();
        this.scene.start('CharacterSelect');
      })
    );

    if (hasSave) {
      const when = peek?.savedAt ? new Date(peek.savedAt).toLocaleString() : '';
      stack.appendChild(
        DomUi.button('hit cont-btn', when ? `CONTINUE · ${when}` : 'CONTINUE', () => {
          this.startIntroAudio();
          this.audio.uiClick();
          this.audio.stopMenu();
          this.registry.set('loadSave', true);
          if (peek?.dayLength) this.registry.set('dayLength', peek.dayLength);
          if (peek?.characterId) this.registry.set('characterId', peek.characterId);
          DomUi.clear();
          this.scene.start('Game');
        })
      );
    }

    const help = DomUi.el('div', 'help-box');
    help.appendChild(DomUi.el('div', '', 'Tap map to walk · loot · craft · fight'));
    help.appendChild(DomUi.el('div', 'line2', 'Follow the gold pulse. Try not to die funny.'));
    stack.appendChild(help);

    root.appendChild(stack);
    root.appendChild(DomUi.el('div', 'footer', `~${mins} min cycle`));
  }
}
