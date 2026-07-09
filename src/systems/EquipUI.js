import Phaser from 'phaser';
import { SLOT } from '../config/constants.js';

/**
 * Bag + paper-doll loadout. Time paused while open (bagOpen).
 * Click or drag items onto slots. Closing must not trigger map path.
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

  /** Tear down nodes without treating it as a user close. */
  _destroyNodes() {
    this.nodes.forEach((n) => n?.destroy?.());
    this.nodes = [];
    this.drag = null;
  }

  close() {
    this._destroyNodes();
    this.open = false;
    this.scene.bagOpen = false;
    this.scene.clearMousePath?.();
    // Block map click from the same pointerup that hit CLOSE
    this.scene.uiBlockClick = true;
    this.scene.time?.delayedCall(150, () => {
      this.scene.uiBlockClick = false;
    });
    this.scene.refreshHud?.();
  }

  show() {
    this._destroyNodes();
    this.open = true;
    this.scene.bagOpen = true;
    this.scene.clearMousePath?.();
    this.scene.uiBlockClick = true;
    this.scene.time?.delayedCall(100, () => {
      if (this.open) this.scene.uiBlockClick = false;
    });

    const s = this.scene;
    const w = Math.round(s.scale.width);
    const h = Math.round(s.scale.height);
    const cx = Math.round(w / 2);
    const cy = Math.round(h / 2);
    const d = 480;
    const inv = s.inv;
    const char = s.char;
    const p = s.player;

    const blockMap = (pointer) => {
      pointer?.event?.stopPropagation?.();
      s.uiBlockClick = true;
      s.time.delayedCall(100, () => {
        if (this.open) s.uiBlockClick = false;
      });
    };

    // Full-screen dim (eats clicks)
    const dim = s.add
      .rectangle(cx, cy, w, h, 0x020617, 0.82)
      .setScrollFactor(0)
      .setDepth(d)
      .setInteractive();
    dim.on('pointerdown', blockMap);
    dim.on('pointerup', blockMap);

    const panelW = Math.min(780, w - 36);
    const panelH = Math.min(520, h - 40);

    // Outer frame + inner plate
    const panel = s.add
      .rectangle(cx, cy, panelW, panelH, 0x0b1220, 1)
      .setStrokeStyle(2, 0x38bdf8)
      .setScrollFactor(0)
      .setDepth(d + 1)
      .setInteractive();
    panel.on('pointerdown', blockMap);
    panel.on('pointerup', blockMap);

    const inset = s.add
      .rectangle(cx, cy + 8, panelW - 24, panelH - 56, 0x111827, 1)
      .setStrokeStyle(1, 0x1e293b)
      .setScrollFactor(0)
      .setDepth(d + 1);

    // Top bar
    const topBar = s.add
      .rectangle(cx, cy - panelH / 2 + 22, panelW - 4, 40, 0x0f172a, 1)
      .setScrollFactor(0)
      .setDepth(d + 2);

    const title = s.add
      .text(cx - panelW / 2 + 24, cy - panelH / 2 + 22, `${char?.name || 'Runner'}  ·  LOADOUT`, {
        fontFamily: 'system-ui',
        fontSize: '18px',
        fontStyle: 'bold',
        color: '#f8fafc',
      })
      .setOrigin(0, 0.5)
      .setScrollFactor(0)
      .setDepth(d + 3);

    const atk = inv.totalAtk(p?.baseAtk || 3);
    const def = inv.totalDef(p?.baseDef || 0);
    const stats = s.add
      .text(cx + panelW / 2 - 24, cy - panelH / 2 + 22, `ATK ${atk}   DEF ${def}`, {
        fontFamily: 'system-ui',
        fontSize: '14px',
        fontStyle: 'bold',
        color: '#7dd3fc',
      })
      .setOrigin(1, 0.5)
      .setScrollFactor(0)
      .setDepth(d + 3);

    // Left column: doll + slots
    const leftX = cx - panelW * 0.22;
    const dollY = cy + 10;

    // Doll pedestal
    const pedestal = s.add
      .ellipse(leftX, dollY + 58, 70, 18, 0x1e293b, 0.9)
      .setScrollFactor(0)
      .setDepth(d + 2);
    const ring = s.add
      .circle(leftX, dollY - 4, 52, 0x0f172a, 1)
      .setStrokeStyle(2, 0x334155)
      .setScrollFactor(0)
      .setDepth(d + 2);

    const doll = s.add.container(leftX, dollY - 8).setScrollFactor(0).setDepth(d + 3);
    const bodyCol = char?.color || 0x38bdf8;
    const hair = char?.hair || 0xfde68a;
    doll.add([
      s.add.rectangle(0, 22, 30, 42, bodyCol),
      s.add.circle(0, -14, 15, 0xfde68a),
      s.add.ellipse(0, -20, 22, 11, hair),
      s.add.rectangle(0, 50, 22, 26, 0x1e3a5f),
    ]);
    if (inv.equip[SLOT.HEAD]) {
      doll.add(s.add.ellipse(0, -24, 24, 11, 0xc026d3));
    }
    if (inv.equip[SLOT.WEAPON]) {
      doll.add(s.add.rectangle(24, 12, 7, 30, 0xa8a29e).setAngle(28));
    }
    if (inv.equip[SLOT.BODY]) {
      doll.add(s.add.rectangle(0, 18, 34, 20, 0x64748b, 0.55));
    }

    const col = {
      head: 0xc026d3,
      body: 0x64748b,
      legs: 0x475569,
      weapon: 0xf59e0b,
      quick1: 0x22c55e,
      quick2: 0x22c55e,
    };

    const slotDefs = [
      { slot: SLOT.HEAD, label: 'HEAD', sub: 'hat', x: leftX, y: dollY - 100, w: 100 },
      { slot: SLOT.BODY, label: 'BODY', sub: 'armor', x: leftX, y: dollY + 14, w: 100 },
      { slot: SLOT.LEGS, label: 'LEGS', sub: 'bottom', x: leftX, y: dollY + 100, w: 100 },
      { slot: SLOT.WEAPON, label: 'WEAPON', sub: 'hand', x: leftX - 118, y: dollY + 14, w: 100 },
      { slot: SLOT.QUICK1, label: 'QUICK 1', sub: 'kit', x: leftX + 118, y: dollY - 30, w: 100 },
      { slot: SLOT.QUICK2, label: 'QUICK 2', sub: 'kit', x: leftX + 118, y: dollY + 50, w: 100 },
    ];

    const slotRects = {};
    for (const sd of slotDefs) {
      const eq = inv.equip[sd.slot];
      const stroke = eq ? col[sd.slot] || 0x38bdf8 : 0x334155;
      const bg = eq ? 0x1e293b : 0x0f172a;
      const r = s.add
        .rectangle(sd.x, sd.y, sd.w, 50, bg, 1)
        .setStrokeStyle(2, stroke)
        .setScrollFactor(0)
        .setDepth(d + 3)
        .setInteractive({ dropZone: true, useHandCursor: true });
      r.setData('equipSlot', sd.slot);
      r.on('pointerdown', blockMap);

      const lab = s.add
        .text(sd.x, sd.y - 32, sd.label, {
          fontFamily: 'system-ui',
          fontSize: '10px',
          fontStyle: 'bold',
          color: eq ? '#e2e8f0' : '#64748b',
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(d + 4);

      const name = s.add
        .text(sd.x, sd.y + 2, eq ? eq.name : sd.sub, {
          fontFamily: 'system-ui',
          fontSize: eq ? '12px' : '11px',
          color: eq ? '#f8fafc' : '#334155',
          wordWrap: { width: sd.w - 10 },
          align: 'center',
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(d + 4);

      // Tiny corner accent
      const accent = s.add
        .rectangle(sd.x - sd.w / 2 + 4, sd.y - 21, 8, 8, stroke, eq ? 1 : 0.35)
        .setScrollFactor(0)
        .setDepth(d + 4);

      slotRects[sd.slot] = { r, name };
      this.nodes.push(r, lab, name, accent);

      r.on('pointerup', (pointer) => {
        blockMap(pointer);
        if (this.drag) return;
        if (inv.equip[sd.slot]) {
          inv.unequip(sd.slot);
          s.log(`Unequipped ${sd.label}.`);
          this.show();
          s.checkGuide?.();
        }
      });
    }

    // Right column: bag grid in framed panel
    const bagPanelX = cx + panelW * 0.22;
    const bagPanelY = cy + 8;
    const bagFrame = s.add
      .rectangle(bagPanelX, bagPanelY, 280, 340, 0x0f172a, 1)
      .setStrokeStyle(1, 0x334155)
      .setScrollFactor(0)
      .setDepth(d + 2);

    const bagTitle = s.add
      .text(bagPanelX, bagPanelY - 150, 'BAG', {
        fontFamily: 'system-ui',
        fontSize: '13px',
        fontStyle: 'bold',
        color: '#94a3b8',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(d + 3);

    const bagHint = s.add
      .text(bagPanelX, bagPanelY - 128, 'Click to equip  ·  or drag to slot', {
        fontFamily: 'system-ui',
        fontSize: '11px',
        color: '#475569',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(d + 3);

    const bagItems = [...inv.items];
    const bagX0 = bagPanelX - 90;
    const bagY0 = bagPanelY - 90;

    bagItems.forEach((item, i) => {
      const colN = i % 2;
      const row = (i / 2) | 0;
      const ix = bagX0 + colN * 120;
      const iy = bagY0 + row * 56;
      const border =
        item.slot === SLOT.WEAPON
          ? 0xf59e0b
          : item.slot === SLOT.HEAD
            ? 0xc026d3
            : item.type === 'consumable'
              ? 0x22c55e
              : 0x64748b;

      const chip = s.add
        .rectangle(ix, iy, 108, 48, 0x1e293b, 1)
        .setStrokeStyle(2, border)
        .setScrollFactor(0)
        .setDepth(d + 3)
        .setInteractive({ draggable: true, useHandCursor: true });
      chip.on('pointerdown', blockMap);

      const tx = s.add
        .text(ix, iy, item.name, {
          fontFamily: 'system-ui',
          fontSize: '12px',
          fontStyle: 'bold',
          color: '#f8fafc',
          wordWrap: { width: 98 },
          align: 'center',
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(d + 4);

      chip.setData('uid', item.uid);
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
        chip.setDepth(d + 20);
        tx.setDepth(d + 21);
        s.uiBlockClick = true;
      });
      chip.on('dragend', (pointer) => {
        this.drag = null;
        let hit = null;
        for (const sd of slotDefs) {
          const b = slotRects[sd.slot].r.getBounds();
          if (Phaser.Geom.Rectangle.Contains(b, pointer.x, pointer.y)) {
            hit = sd.slot;
            break;
          }
        }
        if (hit) {
          const res = inv.equipItem(item.uid, hit);
          if (res.ok) {
            s.log(`Equipped ${item.name}.`);
            s.checkGuide?.();
          } else {
            s.log(`Wrong slot (${res.reason}).`);
          }
        }
        s.time.delayedCall(80, () => {
          s.uiBlockClick = false;
        });
        this.show();
      });

      chip.on('pointerup', (pointer) => {
        blockMap(pointer);
        if (s.input.activePointer.getDistance() > 8) return;
        const res = inv.equipItem(item.uid);
        if (res.ok) {
          s.log(`Equipped ${item.name}.`);
          s.checkGuide?.();
          this.show();
        } else {
          s.log(`Drag to a matching slot.`);
        }
      });

      this.nodes.push(chip, tx);
    });

    if (!bagItems.length) {
      const empty = s.add
        .text(bagPanelX, bagPanelY, 'Empty.\nFind gear in the city.', {
          fontFamily: 'system-ui',
          fontSize: '13px',
          color: '#475569',
          align: 'center',
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(d + 3);
      this.nodes.push(empty);
    }

    // Materials footer strip
    const mats = inv.matList();
    const matLine = mats.length
      ? mats.map((m) => `${m.name}×${m.n}`).join('  ·  ')
      : 'No materials yet';
    const matBg = s.add
      .rectangle(cx, cy + panelH / 2 - 58, panelW - 48, 28, 0x0f172a, 1)
      .setStrokeStyle(1, 0x1e293b)
      .setScrollFactor(0)
      .setDepth(d + 2);
    const matText = s.add
      .text(cx, cy + panelH / 2 - 58, matLine, {
        fontFamily: 'system-ui',
        fontSize: '12px',
        color: '#a8a29e',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(d + 3);

    // Close
    const close = s.add
      .rectangle(cx, cy + panelH / 2 - 24, 150, 38, 0x38bdf8)
      .setScrollFactor(0)
      .setDepth(d + 3)
      .setInteractive({ useHandCursor: true });
    const closeT = s.add
      .text(cx, cy + panelH / 2 - 24, 'CLOSE', {
        fontFamily: 'system-ui',
        fontSize: '14px',
        fontStyle: 'bold',
        color: '#0b1220',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(d + 4);

    close.on('pointerdown', (pointer) => {
      blockMap(pointer);
    });
    close.on('pointerup', (pointer) => {
      blockMap(pointer);
      this.close();
    });

    this.nodes.push(
      dim,
      panel,
      inset,
      topBar,
      title,
      stats,
      pedestal,
      ring,
      doll,
      bagFrame,
      bagTitle,
      bagHint,
      matBg,
      matText,
      close,
      closeT
    );
  }
}
