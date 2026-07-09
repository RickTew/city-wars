import Phaser from 'phaser';
import { SLOT } from '../config/constants.js';

/**
 * Full bag + paper-doll equip UI with drag-and-drop.
 * Time paused by GameScene while open (bagOpen).
 *
 * Slots:
 *   HEAD  - headgear
 *   LEGS  - bottom layer clothing
 *   BODY  - top layer / armor
 *   WEAPON
 *   QUICK1 / QUICK2 - kits (bandage, stim, bedroll)
 */
export class EquipUI {
  constructor(scene) {
    this.scene = scene;
    this.open = false;
    this.nodes = [];
    this.drag = null;
  }

  isOpen() {
    return this.open;
  }

  toggle() {
    if (this.open) this.close();
    else this.show();
  }

  close() {
    this.nodes.forEach((n) => n?.destroy?.());
    this.nodes = [];
    this.open = false;
    this.scene.bagOpen = false;
    this.scene.clearMousePath?.();
    this.scene.refreshHud?.();
  }

  show() {
    this.close();
    this.open = true;
    this.scene.bagOpen = true;
    this.scene.clearMousePath?.();

    const s = this.scene;
    const w = Math.round(s.scale.width);
    const h = Math.round(s.scale.height);
    const cx = Math.round(w / 2);
    const cy = Math.round(h / 2);
    const d = 480;
    const inv = s.inv;
    const char = s.char;
    const p = s.player;

    const dim = s.add
      .rectangle(cx, cy, w, h, 0x020617, 0.8)
      .setScrollFactor(0)
      .setDepth(d)
      .setInteractive();
    dim.on('pointerup', () => {
      /* use CLOSE */
    });

    const panelW = Math.min(760, w - 40);
    const panelH = Math.min(500, h - 50);
    const panel = s.add
      .rectangle(cx, cy, panelW, panelH, 0x0f172a, 1)
      .setStrokeStyle(3, 0x38bdf8)
      .setScrollFactor(0)
      .setDepth(d + 1)
      .setInteractive();

    const title = s.add
      .text(cx, cy - panelH / 2 + 16, `${char?.name || 'Runner'}  ·  LOADOUT`, {
        fontFamily: 'system-ui',
        fontSize: '20px',
        fontStyle: 'bold',
        color: '#f8fafc',
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(d + 2);

    const atk = inv.totalAtk(p?.baseAtk || 3);
    const def = inv.totalDef(p?.baseDef || 0);
    const stats = s.add
      .text(cx, cy - panelH / 2 + 42, `Combat ATK ${atk}   DEF ${def}   (weapon + armor from slots below)`, {
        fontFamily: 'system-ui',
        fontSize: '12px',
        color: '#7dd3fc',
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(d + 2);

    // Paper doll center-left
    const dollX = cx - panelW * 0.24;
    const dollY = cy + 4;
    const doll = s.add.container(dollX, dollY).setScrollFactor(0).setDepth(d + 2);
    const bodyCol = char?.color || 0x38bdf8;
    const hair = char?.hair || 0xfde68a;
    doll.add([
      s.add.rectangle(0, 20, 28, 40, bodyCol),
      s.add.circle(0, -12, 14, 0xfde68a),
      s.add.ellipse(0, -18, 20, 10, hair),
      s.add.rectangle(0, 48, 20, 24, 0x1e3a5f),
    ]);
    // Show hat on doll if equipped
    if (inv.equip[SLOT.HEAD]) {
      doll.add(s.add.ellipse(0, -22, 22, 10, 0xc026d3));
    }
    // Stick silhouette if weapon
    if (inv.equip[SLOT.WEAPON]) {
      doll.add(s.add.rectangle(22, 10, 6, 28, 0xa8a29e).setAngle(25));
    }

    // Slots around doll
    const slotDefs = [
      { slot: SLOT.HEAD, label: 'HEAD (hat)', x: dollX, y: dollY - 96 },
      { slot: SLOT.BODY, label: 'BODY / ARMOR', x: dollX, y: dollY + 8 },
      { slot: SLOT.LEGS, label: 'LEGS (bottom)', x: dollX, y: dollY + 96 },
      { slot: SLOT.WEAPON, label: 'WEAPON', x: dollX - 110, y: dollY + 8 },
      { slot: SLOT.QUICK1, label: 'QUICK 1 (kit)', x: dollX + 110, y: dollY - 36 },
      { slot: SLOT.QUICK2, label: 'QUICK 2 (kit)', x: dollX + 110, y: dollY + 44 },
    ];

    const slotRects = {};
    for (const sd of slotDefs) {
      const eq = inv.equip[sd.slot];
      const stroke = eq ? 0x38bdf8 : 0x64748b;
      const r = s.add
        .rectangle(sd.x, sd.y, 96, 46, 0x1e293b, 1)
        .setStrokeStyle(2, stroke)
        .setScrollFactor(0)
        .setDepth(d + 2)
        .setInteractive({ dropZone: true, useHandCursor: true });
      r.setData('equipSlot', sd.slot);
      const lab = s.add
        .text(sd.x, sd.y - 30, sd.label, {
          fontFamily: 'system-ui',
          fontSize: '10px',
          color: '#94a3b8',
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(d + 3);
      const name = s.add
        .text(sd.x, sd.y, eq ? eq.name : '(empty)', {
          fontFamily: 'system-ui',
          fontSize: '11px',
          color: eq ? '#e2e8f0' : '#475569',
          wordWrap: { width: 88 },
          align: 'center',
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(d + 3);
      slotRects[sd.slot] = { r, name };
      this.nodes.push(r, lab, name);

      // Click equipped to unequip
      r.on('pointerup', () => {
        if (this.drag) return;
        if (inv.equip[sd.slot]) {
          inv.unequip(sd.slot);
          s.log(`Unequipped from ${sd.label}.`);
          this.show();
          s.checkGuide?.();
        }
      });
    }

    // Bag grid right side
    const bagX0 = cx + 30;
    const bagY0 = cy - panelH / 2 + 78;
    const bagTitle = s.add
      .text(bagX0, bagY0 - 22, 'BAG  (click item to equip, or drag onto a slot)', {
        fontFamily: 'system-ui',
        fontSize: '12px',
        color: '#94a3b8',
      })
      .setScrollFactor(0)
      .setDepth(d + 2);

    const bagItems = [...inv.items];
    bagItems.forEach((item, i) => {
      const col = i % 3;
      const row = (i / 3) | 0;
      const ix = bagX0 + col * 105 + 48;
      const iy = bagY0 + row * 50 + 18;
      const chip = s.add
        .rectangle(ix, iy, 98, 42, 0x334155, 1)
        .setStrokeStyle(2, 0x94a3b8)
        .setScrollFactor(0)
        .setDepth(d + 3)
        .setInteractive({ draggable: true, useHandCursor: true });
      const label = item.slot
        ? `${item.name}\n→ ${item.slot}`
        : item.name;
      const tx = s.add
        .text(ix, iy, label, {
          fontFamily: 'system-ui',
          fontSize: '11px',
          color: '#f8fafc',
          wordWrap: { width: 92 },
          align: 'center',
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(d + 4);
      chip.setData('uid', item.uid);
      chip.setData('itemId', item.id);

      s.input.setDraggable(chip);
      chip.on('drag', () => {
        const ptr = s.input.activePointer;
        chip.x = ptr.x;
        chip.y = ptr.y;
        tx.x = ptr.x;
        tx.y = ptr.y;
      });
      chip.on('dragstart', () => {
        this.drag = item.uid;
        chip.setDepth(d + 10);
        tx.setDepth(d + 11);
      });
      chip.on('dragend', (pointer) => {
        this.drag = null;
        let hit = null;
        for (const sd of slotDefs) {
          const sr = slotRects[sd.slot].r;
          const b = sr.getBounds();
          if (Phaser.Geom.Rectangle.Contains(b, pointer.x, pointer.y)) {
            hit = sd.slot;
            break;
          }
        }
        if (hit) {
          const res = inv.equipItem(item.uid, hit);
          if (res.ok) {
            s.log(`Equipped ${item.name} → ${hit}.`);
            s.checkGuide?.();
          } else {
            s.log(`Cannot equip there (${res.reason}).`);
          }
        }
        this.show();
      });

      // Click to auto-equip to default slot
      chip.on('pointerup', () => {
        if (s.input.activePointer.getDistance() > 8) return;
        const res = inv.equipItem(item.uid);
        if (res.ok) {
          s.log(`Equipped ${item.name}.`);
          s.checkGuide?.();
          this.show();
        } else {
          s.log(`Drag to a matching slot. (${res.reason})`);
        }
      });

      this.nodes.push(chip, tx);
    });

    if (!bagItems.length) {
      const empty = s.add
        .text(bagX0 + 100, bagY0 + 50, 'Bag empty.\nWalk east onto stick + hat.', {
          fontFamily: 'system-ui',
          fontSize: '13px',
          color: '#64748b',
          align: 'center',
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(d + 2);
      this.nodes.push(empty);
    }

    // Materials strip
    const mats = inv.matList();
    const matLine = mats.length
      ? 'Materials: ' + mats.map((m) => `${m.name}x${m.n}`).join(' · ')
      : 'Materials: none yet (loot gold crates)';
    const matText = s.add
      .text(cx, cy + panelH / 2 - 72, matLine, {
        fontFamily: 'system-ui',
        fontSize: '12px',
        color: '#a8a29e',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(d + 2);

    const hint = s.add
      .text(
        cx,
        cy + panelH / 2 - 52,
        'Head / Body / Legs add DEF. Weapon feeds ATK. Quick slots hold bandages, stims, sleeping kits.',
        {
          fontFamily: 'system-ui',
          fontSize: '11px',
          color: '#64748b',
        }
      )
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(d + 2);

    const close = s.add
      .rectangle(cx, cy + panelH / 2 - 22, 140, 36, 0x94a3b8)
      .setScrollFactor(0)
      .setDepth(d + 3)
      .setInteractive({ useHandCursor: true });
    const closeT = s.add
      .text(cx, cy + panelH / 2 - 22, 'CLOSE', {
        fontFamily: 'system-ui',
        fontSize: '14px',
        fontStyle: 'bold',
        color: '#0b1220',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(d + 4);
    close.on('pointerup', () => this.close());

    this.nodes.push(dim, panel, title, stats, doll, bagTitle, matText, hint, close, closeT);
  }
}
