import { BLUEPRINTS, MAT, T } from '../config/constants.js';
import { HUD_FONT } from '../config/art.js';

/** Docked craft panel above the bottom bar — not a full-screen modal. */
export class CraftPanel {
  constructor(scene) {
    this.scene = scene;
    this.open = false;
    this.nodes = [];
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
    for (const n of this.nodes) n?.destroy?.();
    this.nodes = [];
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
    this.close();
    this.open = true;
    s.craftOpen = true;

    const w = s.scale.width;
    const h = s.scale.height;
    const d = s.craftModalDepth || 400;
    const near = this.isNearBench();
    const list = s.inv.sortedBlueprints();
    const rowH = 36;
    const maxRows = 5;
    const panelW = Math.min(400, w - 20);
    const panelH = Math.min(28 + maxRows * rowH + 36, h * 0.34);
    const barY = s.scale.height - (s.barMetrics?.().hudBottom ?? 58) + 6;
    const cx = w / 2;
    const cy = barY - panelH / 2 - 6;

    const scrollMax = Math.max(0, list.length - maxRows);
    this.scroll = Math.min(this.scroll || 0, scrollMax);

    const panel = s.add
      .rectangle(cx, cy, panelW, panelH, 0x0f172a, 0.96)
      .setStrokeStyle(2, near ? 0xa855f7 : 0x64748b)
      .setScrollFactor(0)
      .setDepth(d);
    this.nodes.push(panel);

    const title = s.add
      .text(cx - panelW / 2 + 12, cy - panelH / 2 + 10, near ? 'STREET RIG' : 'RECIPES', {
        fontFamily: HUD_FONT,
        fontSize: '13px',
        fontStyle: 'bold',
        color: '#e9d5ff',
      })
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(d + 1);

    const sub = s.add
      .text(cx - panelW / 2 + 12, cy - panelH / 2 + 26, near ? 'Keys 1-6 · tap row to craft' : 'Walk to purple bench to craft', {
        fontFamily: HUD_FONT,
        fontSize: '9px',
        color: near ? '#86efac' : '#fbbf24',
      })
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(d + 1);

    const xBtn = s.makeUiButton(cx + panelW / 2 - 28, cy - panelH / 2 + 22, 36, 28, '✕', 0x334155, () => {
      this.toggle(false);
    }, d + 2);
    this.nodes.push(title, sub, xBtn.bg, xBtn.label);

    if (!list.length) {
      const empty = s.add
        .text(cx, cy + 8, 'No blueprints yet.', {
          fontFamily: HUD_FONT,
          fontSize: '12px',
          color: '#64748b',
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(d + 1);
      this.nodes.push(empty);
      return;
    }

    if (scrollMax > 0) {
      const up = s.makeUiButton(cx + panelW / 2 - 50, cy - panelH / 2 + 22, 24, 24, '▲', 0x1e293b, () => {
        this.scroll = Math.max(0, this.scroll - 1);
        this.show();
      }, d + 2);
      const dn = s.makeUiButton(cx + panelW / 2 - 76, cy - panelH / 2 + 22, 24, 24, '▼', 0x1e293b, () => {
        this.scroll = Math.min(scrollMax, this.scroll + 1);
        this.show();
      }, d + 2);
      this.nodes.push(up.bg, up.label, dn.bg, dn.label);
    }

    const listTop = cy - panelH / 2 + 44;
    list.slice(this.scroll, this.scroll + maxRows).forEach((bpId, visIdx) => {
      const globalIdx = this.scroll + visIdx;
      const bp = BLUEPRINTS[bpId];
      if (!bp) return;
      const ready = near && s.inv.canCraft(bpId);
      const hotkey = globalIdx < 6 ? `${globalIdx + 1}` : '';
      const miss = s.inv.missingFor(bpId).join(', ');
      const rowY = listTop + visIdx * rowH;

      const row = s.add
        .rectangle(cx, rowY, panelW - 16, rowH - 4, ready ? 0x14532d : 0x1e293b, 1)
        .setStrokeStyle(1, ready ? 0x4ade80 : 0x475569)
        .setScrollFactor(0)
        .setDepth(d + 2)
        .setInteractive({ useHandCursor: ready });

      const label = ready
        ? `${hotkey ? `[${hotkey}] ` : ''}${bp.name}  ·  CRAFT`
        : `${hotkey ? `[${hotkey}] ` : ''}${bp.name}  ·  ${miss || 'need parts'}`;

      const rowText = s.add
        .text(cx - panelW / 2 + 20, rowY, label, {
          fontFamily: HUD_FONT,
          fontSize: '11px',
          color: ready ? '#bbf7d0' : '#94a3b8',
          wordWrap: { width: panelW - 40 },
        })
        .setOrigin(0, 0.5)
        .setScrollFactor(0)
        .setDepth(d + 3);

      if (ready) {
        row.on('pointerup', () => s.tryCraftId(bpId));
      }

      this.nodes.push(row, rowText);
    });
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
