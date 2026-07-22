import { BLUEPRINTS, T } from '../config/constants.js';
import { DomUi } from './DomUi.js';

/** Docked craft panel above the bottom bar — DOM text (crisp under pixelArt). */
export class CraftPanel {
  constructor(scene) {
    this.scene = scene;
    this.open = false;
    this.scroll = 0;
  }

  isNearBench() {
    const s = this.scene;
    if (!s.player) return false;
    return (
      s.benches?.some(
        (b) => Math.abs(b.x - s.player.tx) + Math.abs(b.y - s.player.ty) <= 1
      ) || s.ground[s.player.ty][s.player.tx] === T.BENCH
    );
  }

  toggle(forceOpen) {
    if (forceOpen === true) this.open = true;
    else if (forceOpen === false) this.open = false;
    else this.open = !this.open;

    if (this.open) {
      this.scene.closeRunMenu?.();
      this.scene.closeMoreMenu?.();
      this.show();
    } else {
      this.close();
    }
  }

  close() {
    DomUi.clearCraft();
    this.open = false;
    this.scene.craftOpen = false;
    this.scene._benchAutoCraft = false;
    this.scene._benchCraftDismissed = true;
    this.scene.clearMousePath?.();
    this.scene.uiBlockClick = true;
    this.scene.time?.delayedCall(80, () => {
      this.scene.uiBlockClick = false;
    });
  }

  refresh() {
    if (this.open) this.show();
  }

  show() {
    const s = this.scene;
    this.open = true;
    s.craftOpen = true;

    const near = this.isNearBench();
    const list = s.inv.sortedBlueprints();
    const maxRows = 5;
    const scrollMax = Math.max(0, list.length - maxRows);
    this.scroll = Math.min(this.scroll || 0, scrollMax);

    const m = s.barMetrics?.() || { hudBottom: 58 };
    const bottom = Math.max(64, m.hudBottom + 8);

    DomUi.clearCraft();
    const root = DomUi.show('craft-ui', 'craft');
    if (!root) return;

    const panel = DomUi.el('div', `craft-panel${near ? ' near' : ''}`);
    panel.style.bottom = `${bottom}px`;

    const head = DomUi.el('div', 'craft-head');
    const titles = DomUi.el('div', 'craft-titles');
    titles.appendChild(DomUi.el('div', 'craft-title', near ? 'STREET RIG' : 'RECIPES'));
    titles.appendChild(
      DomUi.el(
        'div',
        `craft-sub${near ? ' ready' : ''}`,
        near ? 'Keys 1-6 · tap row to craft' : 'Walk to purple bench to craft'
      )
    );
    head.appendChild(titles);

    if (scrollMax > 0) {
      const scrolls = DomUi.el('div', 'craft-scroll-btns');
      scrolls.appendChild(
        DomUi.button('hit craft-icon-btn', '▲', () => {
          this.scroll = Math.max(0, this.scroll - 1);
          this.show();
        })
      );
      scrolls.appendChild(
        DomUi.button('hit craft-icon-btn', '▼', () => {
          this.scroll = Math.min(scrollMax, this.scroll + 1);
          this.show();
        })
      );
      head.appendChild(scrolls);
    }

    head.appendChild(
      DomUi.button('hit craft-x', '✕', () => {
        this.toggle(false);
      })
    );
    panel.appendChild(head);

    const listEl = DomUi.el('div', 'craft-list');
    if (!list.length) {
      listEl.appendChild(DomUi.el('div', 'craft-empty', 'No blueprints yet.'));
    } else {
      list.slice(this.scroll, this.scroll + maxRows).forEach((bpId, visIdx) => {
        const globalIdx = this.scroll + visIdx;
        const bp = BLUEPRINTS[bpId];
        if (!bp) return;
        const ready = near && s.inv.canCraft(bpId);
        const hotkey = globalIdx < 6 ? `${globalIdx + 1}` : '';
        const miss = s.inv.missingFor(bpId).join(', ');
        const label = ready
          ? `${hotkey ? `[${hotkey}] ` : ''}${bp.name}  ·  CRAFT`
          : `${hotkey ? `[${hotkey}] ` : ''}${bp.name}  ·  ${miss || 'need parts'}`;

        if (ready) {
          const row = DomUi.button('hit craft-row ready', label, () => s.tryCraftId(bpId));
          listEl.appendChild(row);
        } else {
          listEl.appendChild(DomUi.el('div', 'craft-row', label));
        }
      });
    }
    panel.appendChild(listEl);
    root.appendChild(panel);
  }

  /** Hotkey craft: index 0-5 into sorted blueprint list. */
  tryHotkey(index) {
    const s = this.scene;
    if (!this.isNearBench()) {
      s.log('Stand on a purple Street Rig to quick-craft.');
      return;
    }
    const list = s.inv.sortedBlueprints();
    const id = list[index];
    if (id) s.tryCraftId(id);
    else s.log(`No recipe in slot ${index + 1}.`);
  }
}
