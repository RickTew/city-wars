import { BLUEPRINTS, MAT, SLOT } from '../config/constants.js';
import { DomUi, hexCss } from './DomUi.js';

/**
 * Bag + paper-doll loadout — full DOM (crisp type under pixelArt).
 * Time paused while open (bagOpen). Tap items / slots to equip / unequip.
 */
export class EquipUI {
  constructor(scene) {
    this.scene = scene;
    this.open = false;
    this.tab = 'gear';
  }

  isOpen() {
    return this.open;
  }

  toggle() {
    if (this.open) this.close();
    else this.show();
  }

  close() {
    DomUi.clearModal();
    this.open = false;
    this.scene.bagOpen = false;
    this.scene.clearMousePath?.();
    this.scene.uiBlockClick = true;
    this.scene.time?.delayedCall(150, () => {
      this.scene.uiBlockClick = false;
    });
    this.scene.refreshHud?.();
  }

  show() {
    const s = this.scene;
    s.closeRunMenu?.();
    s.closeMoreMenu?.();
    s.closeLegend?.();
    s.closeCombatSpecials?.();
    if (s.craftOpen) s.craftPanel?.toggle(false);

    this.open = true;
    s.bagOpen = true;
    s.clearMousePath?.();
    s.uiBlockClick = true;
    s.time?.delayedCall(100, () => {
      if (this.open) s.uiBlockClick = false;
    });
    const inv = s.inv;
    const char = s.char;
    const p = s.player;
    const narrow = s.scale.width < 640;

    DomUi.clearModal();
    const root = DomUi.show('bag-ui', 'modal');
    if (!root) return;

    // Dim click closes? Keep bag until CLOSE — match prior behavior (dim ate clicks only).
    root.addEventListener(
      'pointerdown',
      (e) => {
        if (e.target === root) {
          e.preventDefault();
          e.stopPropagation();
          s.uiBlockClick = true;
          s.time.delayedCall(100, () => {
            if (this.open) s.uiBlockClick = false;
          });
        }
      },
      { once: false }
    );

    const panel = DomUi.el('div', 'bag-panel');

    const top = DomUi.el('div', 'bag-top');
    top.appendChild(
      DomUi.el('div', 'bag-title', narrow ? 'LOADOUT' : `${char?.name || 'Runner'} · LOADOUT`)
    );
    const atk = s.playerEffectiveAtk?.() ?? inv.totalAtk(p?.baseAtk || 3);
    const def = inv.totalDef(p?.baseDef || 0);
    top.appendChild(DomUi.el('div', 'bag-stats', `ATK ${atk}  DEF ${def}`));
    panel.appendChild(top);

    const tabs = DomUi.el('div', 'bag-tabs');
    for (const t of [
      { id: 'gear', label: 'GEAR' },
      { id: 'mats', label: 'MATS' },
      { id: 'craft', label: 'CRAFT' },
    ]) {
      const active = this.tab === t.id;
      tabs.appendChild(
        DomUi.button(`hit bag-tab${active ? ' active' : ''}`, t.label, () => {
          this.tab = t.id;
          this.show();
        })
      );
    }
    panel.appendChild(tabs);

    const body = DomUi.el('div', 'bag-body');
    if (this.tab === 'mats') this._drawMats(body, inv);
    else if (this.tab === 'craft') this._drawCraft(body, s, inv);
    else this._drawGear(body, s, inv, char, narrow);
    panel.appendChild(body);

    const footer = DomUi.el('div', 'bag-footer');
    const mats = inv.matList();
    const matLine = mats.length
      ? mats.map((m) => `${m.name}×${m.n}`).join('  ·  ')
      : 'No materials yet';
    footer.appendChild(DomUi.el('div', 'bag-mats-line', matLine));
    footer.appendChild(DomUi.button('hit bag-close', 'CLOSE', () => this.close()));
    panel.appendChild(footer);

    root.appendChild(panel);
  }

  _drawGear(body, s, inv, char, narrow) {
    const gear = DomUi.el('div', 'bag-gear');

    const dollCol = DomUi.el('div', 'bag-doll-col');
    const avatar = DomUi.el('div', 'bag-avatar');
    const bodyEl = DomUi.el('div', 'body');
    bodyEl.style.background = hexCss(char?.color ?? 0x38bdf8);
    const hair = DomUi.el('div', 'hair');
    hair.style.background = hexCss(char?.hair ?? 0xfde68a);
    avatar.appendChild(bodyEl);
    avatar.appendChild(hair);
    dollCol.appendChild(avatar);

    const slots = DomUi.el('div', 'bag-slots');
    const slotDefs = [
      { slot: SLOT.HEAD, label: 'HEAD', sub: 'hat' },
      { slot: SLOT.WEAPON, label: narrow ? 'WPN' : 'WEAPON', sub: 'hand' },
      { slot: SLOT.BODY, label: 'BODY', sub: 'armor' },
      { slot: SLOT.LEGS, label: 'LEGS', sub: 'bottom' },
      { slot: SLOT.QUICK1, label: narrow ? 'Q1' : 'QUICK 1', sub: 'kit' },
      { slot: SLOT.QUICK2, label: narrow ? 'Q2' : 'QUICK 2', sub: 'kit' },
    ];
    for (const sd of slotDefs) {
      const eq = inv.equip[sd.slot];
      const btn = DomUi.button(`hit bag-slot${eq ? ' filled' : ''}`, '', () => {
        if (eq) {
          inv.unequip(sd.slot);
          s.log(`Unequipped ${sd.label}.`);
          this.show();
          s.checkGuide?.();
        }
      });
      const lab = DomUi.el('span', 'slot-lab', sd.label);
      const name = DomUi.el(
        'span',
        'slot-name',
        eq
          ? `${narrow && eq.name.length > 11 ? `${eq.name.slice(0, 10)}…` : eq.name}${
              (eq.qty || 1) > 1 ? ` ×${eq.qty}` : ''
            }`
          : sd.sub
      );
      btn.appendChild(lab);
      btn.appendChild(name);
      if (eq) {
        const accent =
          sd.slot === SLOT.WEAPON
            ? '#f59e0b'
            : sd.slot === SLOT.HEAD
              ? '#c026d3'
              : sd.slot === SLOT.BODY
                ? '#64748b'
                : '#22c55e';
        btn.style.borderColor = accent;
      }
      slots.appendChild(btn);
    }
    dollCol.appendChild(slots);
    gear.appendChild(dollCol);

    const listCol = DomUi.el('div', 'bag-list-col');
    listCol.appendChild(DomUi.el('div', 'bag-list-title', 'BAG'));
    listCol.appendChild(
      DomUi.el('div', 'bag-list-hint', narrow ? 'Tap to equip' : 'Tap an item to equip')
    );
    const chips = DomUi.el('div', 'bag-chips');
    const bagItems = [...inv.items];
    if (!bagItems.length) {
      chips.appendChild(DomUi.el('div', 'bag-empty', 'Empty.\nFind gear in the city.'));
    } else {
      for (const item of bagItems) {
        const border =
          item.slot === SLOT.WEAPON
            ? '#f59e0b'
            : item.slot === SLOT.HEAD
              ? '#c026d3'
              : item.type === 'consumable'
                ? '#22c55e'
                : '#64748b';
        const slotHint =
          item.slot === SLOT.WEAPON
            ? 'weapon'
            : item.slot === SLOT.HEAD
              ? 'head'
              : item.slot === SLOT.BODY
                ? 'body'
                : item.slot === SLOT.LEGS
                  ? 'legs'
                  : item.type === 'consumable'
                    ? 'quick'
                    : '';
        const chip = DomUi.button('hit bag-chip', '', () => {
          const res = inv.equipItem(item.uid);
          if (res.ok) {
            s.log(`Equipped ${item.name}.`);
            s.checkGuide?.();
            this.show();
          } else {
            s.log(narrow ? 'Tap a matching empty slot first.' : 'Wrong slot for that item.');
          }
        });
        chip.style.borderColor = border;
        chip.appendChild(
          document.createTextNode(
            (item.qty || 1) > 1 ? `${item.name} ×${item.qty}` : item.name
          )
        );
        if (slotHint) chip.appendChild(DomUi.el('span', 'hint', slotHint));
        chips.appendChild(chip);
      }
    }
    listCol.appendChild(chips);
    gear.appendChild(listCol);
    body.appendChild(gear);
  }

  _drawMats(body, inv) {
    const mats = inv.matList();
    if (!mats.length) {
      body.appendChild(DomUi.el('div', 'bag-empty', 'No materials.\nScavenge gold crates.'));
      return;
    }
    const grid = DomUi.el('div', 'bag-mats-grid');
    for (const m of mats) {
      const color = MAT[m.id]?.color;
      const chip = DomUi.el('div', 'bag-mat-chip');
      if (color != null) chip.style.borderColor = hexCss(color);
      chip.appendChild(DomUi.el('div', 'name', m.name));
      chip.appendChild(DomUi.el('div', 'cnt', `×${m.n}`));
      grid.appendChild(chip);
    }
    body.appendChild(grid);
  }

  _drawCraft(body, s, inv) {
    const bps = inv.sortedBlueprints();
    if (!bps.length) {
      body.appendChild(DomUi.el('div', 'bag-empty', 'No blueprints.\nFind pink landmarks.'));
      return;
    }
    const rows = DomUi.el('div', 'bag-craft-rows');
    for (const bpId of bps) {
      const bp = BLUEPRINTS[bpId];
      if (!bp) continue;
      const ready = inv.canCraft(bpId);
      const row = DomUi.el('div', `bag-craft-row${ready ? ' ready' : ''}`);
      if (ready) {
        row.classList.add('hit');
        row.style.cursor = 'pointer';
        row.style.pointerEvents = 'auto';
        row.addEventListener('pointerup', (e) => {
          e.preventDefault();
          e.stopPropagation();
          s.toggleCraft?.(true);
          s.tryCraftId?.(bpId);
          this.show();
        });
      }
      row.appendChild(DomUi.el('div', 'name', bp.name));
      const parts = inv.matProgress(bpId);
      row.appendChild(
        DomUi.el(
          'div',
          'parts',
          parts.map((p) => `${p.name} ${p.have}/${p.need}`).join('  ·  ') || '—'
        )
      );
      rows.appendChild(row);
    }
    rows.appendChild(
      DomUi.el(
        'div',
        'bag-list-hint',
        'Green = ready at purple bench. Open CRAFT on bar.'
      )
    );
    body.appendChild(rows);
  }
}
