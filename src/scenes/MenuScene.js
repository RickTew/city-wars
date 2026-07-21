import Phaser from 'phaser';
import { DAY_LENGTH } from '../config/constants.js';
import { HUD_FONT } from '../config/art.js';
import { SaveSystem } from '../systems/SaveSystem.js';
import { RunLegacy } from '../systems/RunLegacy.js';
import { drawMenuBackdrop } from '../systems/MenuBackdrop.js';
import { AudioBus } from '../systems/AudioBus.js';

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
    this._uiLock = false;
    this.draw();
    this.scale.on('resize', () => this.draw());

    // Unlock audio + start intro on first tap (iOS), or after a short beat
    this.input.once('pointerdown', () => this.startIntroAudio());
    this.time.delayedCall(80, () => this.startIntroAudio());
  }

  startIntroAudio() {
    if (this._introStarted) return;
    this._introStarted = true;
    this.audio.ensure();
    this.audio.menuIntro();
  }

  update(_t, dtMs) {
    const dt = (dtMs || 16) / 1000;
    this._backdrop?.tick?.(dt);
  }

  draw() {
    this.children.removeAll(true);
    this._backdrop = null;

    const w = this.scale.width;
    const h = this.scale.height;
    const dayKey = this.registry.get('dayLength') || 'medium';
    const hasSave = SaveSystem.hasSave();
    const peek = hasSave ? SaveSystem.peek() : null;
    const narrow = w < 520;

    this._backdrop = drawMenuBackdrop(this, w, h);
    const skylineY = this._backdrop.skylineY;

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

    // Title: amber fire ghost + white stroke (ruin neon, not clean cyan)
    this.add
      .text(w / 2, y, 'CITY WARS', {
        fontFamily: HUD_FONT,
        fontSize: titleSize + 'px',
        fontStyle: 'bold',
        color: '#ea580c',
      })
      .setOrigin(0.5)
      .setAlpha(0.4)
      .setScale(1.06);

    this.add
      .text(w / 2, y, 'CITY WARS', {
        fontFamily: HUD_FONT,
        fontSize: titleSize + 'px',
        fontStyle: 'bold',
        color: '#f8fafc',
        stroke: '#f97316',
        strokeThickness: Math.max(3, Math.round(titleSize * 0.06)),
        shadow: { offsetX: 0, offsetY: 0, color: '#fbbf24', blur: 18, fill: true },
      })
      .setOrigin(0.5);

    y += titleSize * 0.55 + gap * 0.5;

    this.add
      .text(w / 2, y, 'THE CITY STILL BURNS. YOU SHOULD LEAVE.', {
        fontFamily: HUD_FONT,
        fontSize: tagSize + 'px',
        color: '#fdba74',
        letterSpacing: 1,
      })
      .setOrigin(0.5);

    y += tagSize + 14;

    const legacy = RunLegacy.summaryLine();
    this.add
      .text(w / 2, y, legacy, {
        fontFamily: 'system-ui',
        fontSize: '12px',
        color: '#94a3b8',
      })
      .setOrigin(0.5);

    y += 16 + gap;

    this.add
      .text(w / 2, y, 'Day length', {
        fontFamily: 'system-ui',
        fontSize: narrow ? '13px' : '15px',
        color: '#cbd5e1',
      })
      .setOrigin(0.5);
    this.add
      .text(w / 2, y + (narrow ? 14 : 16), 'How fast the jokes get darker', {
        fontFamily: 'system-ui',
        fontSize: '11px',
        color: '#64748b',
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
        .rectangle(bx, y, btnW, dayBtnH, selected ? 0xea580c : 0x1e293b, 1)
        .setStrokeStyle(2, selected ? 0xfbbf24 : 0x475569)
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
        this.startIntroAudio();
        this.audio.uiClick();
        this.registry.set('dayLength', o.key);
        this.draw();
      });
    });

    y += dayBtnH / 2 + gap + startH / 2;

    const startW = Math.min(280, w - 48);
    const start = this.add
      .rectangle(w / 2, y, startW, startH, 0xea580c, 1)
      .setStrokeStyle(3, 0xfbbf24)
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
      this.startIntroAudio();
      this.audio.uiClick();
      this.audio.stopMenu();
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
        this.startIntroAudio();
        this.audio.uiClick();
        this.audio.stopMenu();
        this.registry.set('loadSave', true);
        if (peek?.dayLength) this.registry.set('dayLength', peek.dayLength);
        if (peek?.characterId) this.registry.set('characterId', peek.characterId);
        this.scene.start('Game');
      });
    }

    y += (hasSave ? contH / 2 : startH / 2) + gap + helpH / 2;
    const helpW = Math.min(320, w - 32);
    this.add
      .rectangle(w / 2, y, helpW, helpH, 0x0f172a, 0.88)
      .setStrokeStyle(1, 0x475569);
    this.add
      .text(w / 2, y - 8, 'Tap map to walk · loot · craft · fight', {
        fontFamily: 'system-ui',
        fontSize: '11px',
        color: '#cbd5e1',
        align: 'center',
      })
      .setOrigin(0.5);
    this.add
      .text(w / 2, y + 10, 'Follow the gold pulse. Try not to die funny.', {
        fontFamily: 'system-ui',
        fontSize: '11px',
        color: '#94a3b8',
        align: 'center',
      })
      .setOrigin(0.5);

    this.add
      .text(w / 2, h - 16, `~${Math.round(DAY_LENGTH[dayKey] / 60)} min cycle  ·  Phaser 4`, {
        fontFamily: 'system-ui',
        fontSize: '11px',
        color: '#64748b',
      })
      .setOrigin(0.5);
  }
}
