import Phaser from 'phaser';
import { DAY_LENGTH } from '../config/constants.js';
import { SaveSystem } from '../systems/SaveSystem.js';
import { Leaderboards } from '../systems/Leaderboards.js';
import { drawMenuBackdrop } from '../systems/MenuBackdrop.js';
import { AudioBus } from '../systems/AudioBus.js';
import { DomUi } from '../systems/DomUi.js';

/**
 * Title menu: Phaser = atmosphere only. All labels/buttons = DOM (crisp type).
 * See VISUAL-STYLE.md — never Phaser Text for player-facing UI.
 *
 * Day cycle buttons control how fast day → night progresses in the world.
 * They are NOT a run timer / timed loop. Escape the city at your pace; SAVE anytime.
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
    DomUi.clearAll();
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
    const legacy = Leaderboards.summaryLine();
    const mins = Math.round(DAY_LENGTH[dayKey] / 60);

    DomUi.clearAll();
    const root = DomUi.show('menu-ui');
    if (!root) return;

    const stack = DomUi.el('div', 'menu-stack');

    stack.appendChild(DomUi.el('div', 'title', 'CITY WARS'));
    stack.appendChild(DomUi.el('div', 'tagline', 'Escape the city. Night falls when it falls.'));
    stack.appendChild(DomUi.el('div', 'muted', legacy));

    const dayHead = DomUi.el('div', '');
    dayHead.appendChild(DomUi.el('div', 'section-label', 'Day / night speed'));
    dayHead.appendChild(
      DomUi.el(
        'div',
        'section-sub',
        'How fast the sun moves — not a run timer. No clock to beat.'
      )
    );
    stack.appendChild(dayHead);

    const dayRow = DomUi.el('div', 'day-row');
    // Cycle length only: short = night sooner, long = more daylight between nights
    const opts = [
      { key: 'short', label: 'FAST', sub: `night ~${Math.round((DAY_LENGTH.short * 0.55) / 60)}m` },
      { key: 'medium', label: 'NORMAL', sub: `night ~${Math.round((DAY_LENGTH.medium * 0.55) / 60)}m` },
      { key: 'long', label: 'SLOW', sub: `night ~${Math.round((DAY_LENGTH.long * 0.55) / 60)}m` },
    ];
    opts.forEach((o) => {
      const selected = dayKey === o.key;
      const btn = DomUi.button(`hit day-btn${selected ? ' selected' : ''}`, '', () => {
        this.startIntroAudio();
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
      const dayN = peek?.day?.day;
      const contLabel = when
        ? `CONTINUE · Day ${dayN || '?'} · ${when}`
        : 'CONTINUE';
      stack.appendChild(
        DomUi.button('hit cont-btn', contLabel, () => {
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
    help.appendChild(DomUi.el('div', '', 'Scavenge · craft Breach Kit · hit the Wall · escape'));
    help.appendChild(
      DomUi.el('div', 'line2', 'SAVE RUN anytime. Long crawls are the point. Autosave every ~90s.')
    );
    stack.appendChild(help);

    const row = DomUi.el('div', 'menu-secondary-row');
    row.appendChild(
      DomUi.button('hit cont-btn lab-link', 'LEADERBOARDS', () => {
        this.startIntroAudio();
        this.audio.uiClick();
        this.openLeaderboards();
      })
    );
    row.appendChild(
      DomUi.button('hit cont-btn lab-link', 'STYLE LAB', () => {
        this.startIntroAudio();
        this.audio.uiClick();
        this.audio.stopMenu();
        DomUi.clearAll();
        this.scene.start('StyleLab');
      })
    );
    stack.appendChild(row);

    root.appendChild(stack);
    root.appendChild(
      DomUi.el(
        'div',
        'footer',
        `Full day cycle ~${mins}m · not a countdown · Escape from NY grit, cyber grid`
      )
    );
  }

  openLeaderboards() {
    DomUi.clearModal();
    const board = Leaderboards.boardRows();
    const root = DomUi.show('boards-ui', 'modal');
    if (!root) return;

    root.addEventListener('pointerup', (e) => {
      if (e.target === root) this.closeLeaderboards();
    });

    const sheet = DomUi.el('div', 'sheet sheet-boards');
    sheet.appendChild(DomUi.el('div', 'sheet-title', 'BEST PLAYS'));
    sheet.appendChild(
      DomUi.el(
        'div',
        'boards-sub',
        `${board.totals.escapes} escape${board.totals.escapes === 1 ? '' : 's'} · ${board.totals.deaths} KIA · local only`
      )
    );

    const list = DomUi.el('div', 'boards-list');
    for (const row of board.rows) {
      const line = DomUi.el('div', 'boards-row');
      line.appendChild(DomUi.el('div', 'boards-label', row.label));
      const right = DomUi.el('div', 'boards-right');
      right.appendChild(DomUi.el('div', 'boards-value', row.value));
      if (row.runner) right.appendChild(DomUi.el('div', 'boards-runner', row.runner));
      line.appendChild(right);
      list.appendChild(line);
    }
    sheet.appendChild(list);

    if (board.recent?.length) {
      sheet.appendChild(DomUi.el('div', 'boards-recent-title', 'RECENT RUNS'));
      const recent = DomUi.el('div', 'boards-recent');
      for (const r of board.recent.slice(0, 6)) {
        const tag = r.won ? 'ESC' : 'KIA';
        const clock = r.durationMs != null ? ` · ${Leaderboards.formatMs(r.durationMs)}` : '';
        recent.appendChild(
          DomUi.el(
            'div',
            `boards-recent-line ${r.won ? 'won' : 'lost'}`,
            `${tag} · Day ${r.days} · ${r.kills} kills · ${r.crafts || 0} crafts${clock}${r.runner ? ` · ${r.runner}` : ''}`
          )
        );
      }
      sheet.appendChild(recent);
    }

    const actions = DomUi.el('div', 'sheet-actions');
    const close = DomUi.button('hit sheet-btn ghost', 'CLOSE', () => this.closeLeaderboards());
    close.style.background = DomUi.hexCss(0x334155);
    close.style.color = '#e2e8f0';
    actions.appendChild(close);
    sheet.appendChild(actions);
    root.appendChild(sheet);
  }

  closeLeaderboards() {
    DomUi.clearModal();
    // Redraw main menu under (modal only was cleared)
    this.draw();
  }
}
