import Phaser from 'phaser';
import { BLUEPRINTS, MAT, SLOT } from '../config/constants.js';
import { HUD_FONT } from '../config/art.js';

/**
 * Bag + paper-doll loadout. Time paused while open (bagOpen).
 * Wide: doll left + bag right. Narrow phone: stacked, full-width bag.
 * Click or drag items onto slots. Closing must not trigger map path.
 */
export class EquipUI {
  constructor(scene) {
    this.scene = scene;
    this.open = false;
    this.nodes = [];
    this.drag = null;
    this.tab = 'gear';
    this._bagScroll = 0;
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
    const narrow = w < 640;

    const blockMap = (pointer) => {
      pointer?.event?.stopPropagation?.();
      s.uiBlockClick = true;
      s.time.delayedCall(100, () => {
        if (this.open) s.uiBlockClick = false;
      });
    };

    // Full-screen dim (eats clicks)
    const dim = s.add
      .rectangle(cx, cy, w, h, 0x020617, 0.85)
      .setScrollFactor(0)
      .setDepth(d)
      .setInteractive();
    dim.on('pointerdown', blockMap);
    dim.on('pointerup', blockMap);

    // Fit inside safe margins (phone status bar + bottom action bar)
    const hudInset = s.barMetrics?.().hudBottom ?? 58;
    const panelW = Math.min(narrow ? w - 16 : 820, w - (narrow ? 12 : 36));
    const panelH = Math.min(narrow ? h - hudInset - 20 : 540, h - (narrow ? hudInset : 40));
    const panelTop = cy - panelH / 2;
    const panelLeft = cx - panelW / 2;

    const panel = s.add
      .rectangle(cx, cy, panelW, panelH, 0x0b1220, 1)
      .setStrokeStyle(2, 0x38bdf8)
      .setScrollFactor(0)
      .setDepth(d + 1)
      .setInteractive();
    panel.on('pointerdown', blockMap);
    panel.on('pointerup', blockMap);

    const topH = narrow ? 36 : 42;
    const topBar = s.add
      .rectangle(cx, panelTop + topH / 2, panelW - 4, topH, 0x0f172a, 1)
      .setScrollFactor(0)
      .setDepth(d + 2);

    const titleStr = narrow ? 'LOADOUT' : `${char?.name || 'Runner'} · LOADOUT`;
    const title = s.add
      .text(panelLeft + 14, panelTop + topH / 2, titleStr, {
        fontFamily: 'system-ui',
        fontSize: narrow ? '14px' : '18px',
        fontStyle: 'bold',
        color: '#f8fafc',
      })
      .setOrigin(0, 0.5)
      .setScrollFactor(0)
      .setDepth(d + 3);

    const atk = s.playerEffectiveAtk?.() ?? inv.totalAtk(p?.baseAtk || 3);
    const def = inv.totalDef(p?.baseDef || 0);
    const stats = s.add
      .text(panelLeft + panelW - 14, panelTop + topH / 2, `ATK ${atk}  DEF ${def}`, {
        fontFamily: 'system-ui',
        fontSize: narrow ? '12px' : '14px',
        fontStyle: 'bold',
        color: '#7dd3fc',
      })
      .setOrigin(1, 0.5)
      .setScrollFactor(0)
      .setDepth(d + 3);

    this.nodes.push(dim, panel, topBar, title, stats);

    const tabY = panelTop + topH + 14;
    const tabs = [
      { id: 'gear', label: 'GEAR' },
      { id: 'mats', label: 'MATS' },
      { id: 'craft', label: 'CRAFT' },
    ];
    const tabW = narrow ? 72 : 88;
    tabs.forEach((t, i) => {
      const tx = cx - tabW + i * (tabW + 6);
      const active = this.tab === t.id;
      const bg = s.add
        .rectangle(tx, tabY, tabW, 28, active ? 0x0ea5e9 : 0x1e293b, 1)
        .setStrokeStyle(1, active ? 0x7dd3fc : 0x334155)
        .setScrollFactor(0)
        .setDepth(d + 4)
        .setInteractive({ useHandCursor: true });
      bg.on('pointerup', () => {
        this.tab = t.id;
        this._bagScroll = 0;
        this.show();
      });
      const lab = s.add
        .text(tx, tabY, t.label, {
          fontFamily: HUD_FONT,
          fontSize: '10px',
          fontStyle: 'bold',
          color: active ? '#0b1220' : '#94a3b8',
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(d + 5);
      this.nodes.push(bg, lab);
    });

    const col = {
      head: 0xc026d3,
      body: 0x64748b,
      legs: 0x475569,
      weapon: 0xf59e0b,
      quick1: 0x22c55e,
      quick2: 0x22c55e,
    };

    const footerH = narrow ? 72 : 78;
    const contentTop = panelTop + topH + 36;
    const contentBot = cy + panelH / 2 - footerH;
    const contentH = contentBot - contentTop;

    if (this.tab === 'mats') {
      this._drawMatsPanel(s, cx, contentTop, contentH, panelW - 24, d, narrow);
      this._drawFooter(s, cx, cy, panelW, panelH, footerH, inv, d, narrow, blockMap);
      return;
    }
    if (this.tab === 'craft') {
      this._drawCraftPanel(s, cx, contentTop, contentH, panelW - 24, d, narrow);
      this._drawFooter(s, cx, cy, panelW, panelH, footerH, inv, d, narrow, blockMap);
      return;
    }

    let slotDefs;
    let bagArea; // { x, y, w, h } center + size

    if (narrow) {
      // ── Mobile: compact doll row on top, bag list fills rest ──
      const dollBandH = Math.min(188, Math.floor(contentH * 0.4));
      const dollCy = contentTop + dollBandH / 2;
      const slotW = Math.min(82, Math.floor((panelW - 56) / 3.2));
      const slotH = 38;
      const leftX = cx;

      // Soft band behind doll
      const dollBand = s.add
        .rectangle(cx, dollCy, panelW - 20, dollBandH - 4, 0x111827, 1)
        .setStrokeStyle(1, 0x1e293b)
        .setScrollFactor(0)
        .setDepth(d + 2);
      this.nodes.push(dollBand);

      this._drawDoll(s, leftX, dollCy - 8, d, char, inv, 0.8);

      slotDefs = [
        { slot: SLOT.HEAD, label: 'HEAD', sub: 'hat', x: leftX, y: dollCy - 68, w: slotW, h: slotH },
        { slot: SLOT.WEAPON, label: 'WPN', sub: 'hand', x: leftX - slotW - 12, y: dollCy + 2, w: slotW, h: slotH },
        { slot: SLOT.BODY, label: 'BODY', sub: 'armor', x: leftX, y: dollCy + 22, w: slotW, h: slotH },
        { slot: SLOT.QUICK1, label: 'Q1', sub: 'kit', x: leftX + slotW + 12, y: dollCy - 22, w: slotW, h: slotH },
        { slot: SLOT.QUICK2, label: 'Q2', sub: 'kit', x: leftX + slotW + 12, y: dollCy + 32, w: slotW, h: slotH },
        { slot: SLOT.LEGS, label: 'LEGS', sub: 'bottom', x: leftX, y: dollCy + 72, w: slotW, h: slotH },
      ];

      const bagTop = contentTop + dollBandH + 6;
      const bagH = contentBot - bagTop - 4;
      bagArea = {
        x: cx,
        y: bagTop + bagH / 2,
        w: panelW - 24,
        h: bagH,
        cols: 2,
      };
    } else {
      // ── Desktop / tablet: doll left, bag right ──
      const leftX = cx - panelW * 0.24;
      const dollY = contentTop + contentH * 0.42;
      const slotW = 108;
      const slotH = 52;

      const inset = s.add
        .rectangle(cx, contentTop + contentH / 2, panelW - 28, contentH, 0x111827, 1)
        .setStrokeStyle(1, 0x1e293b)
        .setScrollFactor(0)
        .setDepth(d + 1);
      this.nodes.push(inset);

      this._drawDoll(s, leftX, dollY, d, char, inv, 1);

      slotDefs = [
        { slot: SLOT.HEAD, label: 'HEAD', sub: 'hat', x: leftX, y: dollY - 108, w: slotW, h: slotH },
        { slot: SLOT.BODY, label: 'BODY', sub: 'armor', x: leftX, y: dollY + 18, w: slotW, h: slotH },
        { slot: SLOT.LEGS, label: 'LEGS', sub: 'bottom', x: leftX, y: dollY + 108, w: slotW, h: slotH },
        { slot: SLOT.WEAPON, label: 'WEAPON', sub: 'hand', x: leftX - 126, y: dollY + 18, w: slotW, h: slotH },
        { slot: SLOT.QUICK1, label: 'QUICK 1', sub: 'kit', x: leftX + 126, y: dollY - 28, w: slotW, h: slotH },
        { slot: SLOT.QUICK2, label: 'QUICK 2', sub: 'kit', x: leftX + 126, y: dollY + 52, w: slotW, h: slotH },
      ];

      const bagW = Math.min(300, panelW * 0.42);
      const bagH = contentH - 12;
      bagArea = {
        x: cx + panelW * 0.24,
        y: contentTop + contentH / 2,
        w: bagW,
        h: bagH,
        cols: 2,
      };
    }

    const slotRects = {};
    for (const sd of slotDefs) {
      const eq = inv.equip[sd.slot];
      const stroke = eq ? col[sd.slot] || 0x38bdf8 : 0x334155;
      const bg = eq ? 0x1e293b : 0x0f172a;
      const r = s.add
        .rectangle(sd.x, sd.y, sd.w, sd.h, bg, 1)
        .setStrokeStyle(2, stroke)
        .setScrollFactor(0)
        .setDepth(d + 3)
        .setInteractive({ dropZone: true, useHandCursor: true });
      r.setData('equipSlot', sd.slot);
      r.on('pointerdown', blockMap);

      const lab = s.add
        .text(sd.x, sd.y - sd.h / 2 - (narrow ? 9 : 12), sd.label, {
          fontFamily: 'system-ui',
          fontSize: narrow ? '9px' : '10px',
          fontStyle: 'bold',
          color: eq ? '#e2e8f0' : '#64748b',
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(d + 4);

      const eqLabel = eq
        ? `${narrow && eq.name.length > 11 ? `${eq.name.slice(0, 10)}…` : eq.name}${(eq.qty || 1) > 1 ? ` ×${eq.qty}` : ''}`
        : sd.sub;
      const name = s.add
        .text(sd.x, sd.y + (narrow ? 0 : 1), eqLabel, {
          fontFamily: 'system-ui',
          fontSize: eq ? (narrow ? '9px' : '12px') : narrow ? '9px' : '11px',
          color: eq ? '#f8fafc' : '#475569',
          wordWrap: { width: sd.w - 8 },
          align: 'center',
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(d + 4);

      const accent = s.add
        .rectangle(sd.x - sd.w / 2 + 4, sd.y - sd.h / 2 + 4, 7, 7, stroke, eq ? 1 : 0.35)
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

    // Bag panel frame
    const bagFrame = s.add
      .rectangle(bagArea.x, bagArea.y, bagArea.w, bagArea.h, 0x0f172a, 1)
      .setStrokeStyle(1, 0x334155)
      .setScrollFactor(0)
      .setDepth(d + 2);

    const bagTitleY = bagArea.y - bagArea.h / 2 + (narrow ? 14 : 18);
    const bagTitle = s.add
      .text(bagArea.x, bagTitleY, 'BAG', {
        fontFamily: 'system-ui',
        fontSize: narrow ? '12px' : '13px',
        fontStyle: 'bold',
        color: '#94a3b8',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(d + 3);

    const bagHint = s.add
      .text(bagArea.x, bagTitleY + (narrow ? 14 : 16), narrow ? 'Tap to equip' : 'Tap to equip  ·  or drag to slot', {
        fontFamily: 'system-ui',
        fontSize: narrow ? '10px' : '11px',
        color: '#64748b',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(d + 3);

    this.nodes.push(bagFrame, bagTitle, bagHint);

    const bagItems = [...inv.items];
    const cols = bagArea.cols || 2;
    const padX = 10;
    const chipGap = 8;
    const chipW = Math.floor((bagArea.w - padX * 2 - chipGap * (cols - 1)) / cols);
    const chipH = narrow ? 44 : 50;
    const gridTop = bagTitleY + (narrow ? 28 : 36);
    const startX = bagArea.x - bagArea.w / 2 + padX + chipW / 2;
    const maxRows = Math.max(1, Math.floor((bagArea.h - 40) / (chipH + chipGap)));
    const maxVisible = maxRows * cols;
    const scrollMax = Math.max(0, Math.ceil(bagItems.length / cols) - maxRows);
    this._bagScroll = Phaser.Math.Clamp(this._bagScroll || 0, 0, scrollMax);

    if (scrollMax > 0) {
      const up = s.add
        .text(bagArea.x + bagArea.w / 2 - 20, bagArea.y - bagArea.h / 2 + 8, '▲', {
          fontFamily: HUD_FONT,
          fontSize: '14px',
          color: '#94a3b8',
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(d + 4)
        .setInteractive({ useHandCursor: true });
      up.on('pointerup', () => {
        this._bagScroll = Math.max(0, this._bagScroll - 1);
        this.show();
      });
      const dn = s.add
        .text(bagArea.x + bagArea.w / 2 + 20, bagArea.y - bagArea.h / 2 + 8, '▼', {
          fontFamily: HUD_FONT,
          fontSize: '14px',
          color: '#94a3b8',
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(d + 4)
        .setInteractive({ useHandCursor: true });
      dn.on('pointerup', () => {
        this._bagScroll = Math.min(scrollMax, this._bagScroll + 1);
        this.show();
      });
      this.nodes.push(up, dn);
    }

    bagItems.forEach((item, i) => {
      const colN = i % cols;
      const row = (i / cols) | 0;
      const visRow = row - this._bagScroll;
      if (visRow < 0 || visRow >= maxRows) return;
      const ix = startX + colN * (chipW + chipGap);
      const iy = gridTop + visRow * (chipH + chipGap) + chipH / 2;

      const border =
        item.slot === SLOT.WEAPON
          ? 0xf59e0b
          : item.slot === SLOT.HEAD
            ? 0xc026d3
            : item.type === 'consumable'
              ? 0x22c55e
              : 0x64748b;

      const chip = s.add
        .rectangle(ix, iy, chipW, chipH, 0x1e293b, 1)
        .setStrokeStyle(2, border)
        .setScrollFactor(0)
        .setDepth(d + 3)
        .setInteractive({ draggable: true, useHandCursor: true });
      chip.on('pointerdown', blockMap);

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

      const tx = s.add
        .text(ix, iy - (slotHint ? 6 : 0), (item.qty || 1) > 1 ? `${item.name} ×${item.qty}` : item.name, {
          fontFamily: 'system-ui',
          fontSize: narrow ? '11px' : '12px',
          fontStyle: 'bold',
          color: '#f8fafc',
          wordWrap: { width: chipW - 10 },
          align: 'center',
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(d + 4);

      let hintNode = null;
      if (slotHint) {
        hintNode = s.add
          .text(ix, iy + 12, slotHint, {
            fontFamily: 'system-ui',
            fontSize: '9px',
            color: '#94a3b8',
          })
          .setOrigin(0.5)
          .setScrollFactor(0)
          .setDepth(d + 4);
        this.nodes.push(hintNode);
      }

      chip.setData('uid', item.uid);
      s.input.setDraggable(chip);

      chip.on('drag', () => {
        const ptr = s.input.activePointer;
        chip.x = ptr.x;
        chip.y = ptr.y;
        tx.x = ptr.x;
        tx.y = ptr.y - (slotHint ? 6 : 0);
        if (hintNode) {
          hintNode.x = ptr.x;
          hintNode.y = ptr.y + 12;
        }
      });
      chip.on('dragstart', () => {
        this.drag = item.uid;
        chip.setDepth(d + 20);
        tx.setDepth(d + 21);
        if (hintNode) hintNode.setDepth(d + 21);
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
          s.log(narrow ? 'Tap a matching slot, or drag.' : 'Drag to a matching slot.');
        }
      });

      this.nodes.push(chip, tx);
    });

    if (!bagItems.length) {
      const empty = s.add
        .text(bagArea.x, bagArea.y + 8, 'Empty.\nFind gear in the city.', {
          fontFamily: 'system-ui',
          fontSize: narrow ? '12px' : '13px',
          color: '#475569',
          align: 'center',
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(d + 3);
      this.nodes.push(empty);
    }

    this._drawFooter(s, cx, cy, panelW, panelH, footerH, inv, d, narrow, blockMap);
  }

  _drawFooter(s, cx, cy, panelW, panelH, footerH, inv, d, narrow, blockMap) {
    const matY = cy + panelH / 2 - footerH + 16;
    const mats = inv.matList();
    const matLine = mats.length
      ? mats.map((m) => `${m.name}×${m.n}`).join('  ·  ')
      : 'No materials yet';
    const matBg = s.add
      .rectangle(cx, matY, panelW - 28, 26, 0x0f172a, 1)
      .setStrokeStyle(1, 0x1e293b)
      .setScrollFactor(0)
      .setDepth(d + 2);
    const matText = s.add
      .text(cx, matY, matLine, {
        fontFamily: HUD_FONT,
        fontSize: narrow ? '10px' : '11px',
        color: '#a8a29e',
        wordWrap: { width: panelW - 48 },
        align: 'center',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(d + 3);

    const closeY = cy + panelH / 2 - 22;
    const closeW = narrow ? Math.min(200, panelW - 40) : 160;
    const close = s.add
      .rectangle(cx, closeY, closeW, 40, 0x38bdf8)
      .setScrollFactor(0)
      .setDepth(d + 5)
      .setInteractive({
        useHandCursor: true,
        hitArea: new Phaser.Geom.Rectangle(-closeW / 2 - 8, -28, closeW + 16, 56),
        hitAreaCallback: Phaser.Geom.Rectangle.Contains,
      });
    const closeT = s.add
      .text(cx, closeY, 'CLOSE', {
        fontFamily: HUD_FONT,
        fontSize: '14px',
        fontStyle: 'bold',
        color: '#0b1220',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(d + 6);

    close.on('pointerdown', blockMap);
    close.on('pointerup', () => this.close());
    this.nodes.push(matBg, matText, close, closeT);
  }

  _drawMatsPanel(s, cx, top, h, w, d, narrow) {
    const inv = s.inv;
    const mats = inv.matList();
    const frame = s.add
      .rectangle(cx, top + h / 2, w, h, 0x111827, 1)
      .setStrokeStyle(1, 0x334155)
      .setScrollFactor(0)
      .setDepth(d + 2);
    this.nodes.push(frame);
    if (!mats.length) {
      const t = s.add
        .text(cx, top + h / 2, 'No materials.\nScavenge gold crates.', {
          fontFamily: HUD_FONT,
          fontSize: '13px',
          color: '#64748b',
          align: 'center',
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(d + 3);
      this.nodes.push(t);
      return;
    }
    const cols = narrow ? 2 : 3;
    const chipW = Math.floor((w - 24) / cols) - 8;
    mats.forEach((m, i) => {
      const col = i % cols;
      const row = (i / cols) | 0;
      const x = cx - w / 2 + 16 + col * (chipW + 12) + chipW / 2;
      const y = top + 24 + row * 52;
      const color = MAT[m.id]?.color || 0x94a3b8;
      const chip = s.add
        .rectangle(x, y, chipW, 44, 0x1e293b, 1)
        .setStrokeStyle(2, color)
        .setScrollFactor(0)
        .setDepth(d + 3);
      const dot = s.add.circle(x - chipW / 2 + 10, y, 5, color).setScrollFactor(0).setDepth(d + 4);
      const lab = s.add
        .text(x + 4, y - 6, m.name, {
          fontFamily: HUD_FONT,
          fontSize: '11px',
          color: '#f8fafc',
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(d + 4);
      const cnt = s.add
        .text(x + 4, y + 10, `×${m.n}`, {
          fontFamily: HUD_FONT,
          fontSize: '12px',
          fontStyle: 'bold',
          color: '#7dd3fc',
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(d + 4);
      this.nodes.push(chip, dot, lab, cnt);
    });
  }

  _drawCraftPanel(s, cx, top, h, w, d, narrow) {
    const inv = s.inv;
    const frame = s.add
      .rectangle(cx, top + h / 2, w, h, 0x111827, 1)
      .setStrokeStyle(1, 0xa855f7)
      .setScrollFactor(0)
      .setDepth(d + 2);
    this.nodes.push(frame);

    const bps = inv.sortedBlueprints();
    if (!bps.length) {
      const t = s.add
        .text(cx, top + h / 2, 'No blueprints.\nFind pink landmarks.', {
          fontFamily: HUD_FONT,
          fontSize: '13px',
          color: '#64748b',
          align: 'center',
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(d + 3);
      this.nodes.push(t);
      return;
    }

    let y = top + 20;
    bps.slice(0, narrow ? 5 : 7).forEach((bpId) => {
      const bp = BLUEPRINTS[bpId];
      if (!bp) return;
      const ready = inv.canCraft(bpId);
      const row = s.add
        .rectangle(cx, y, w - 16, narrow ? 52 : 58, ready ? 0x14532d : 0x1e293b, 1)
        .setStrokeStyle(1, ready ? 0x4ade80 : 0x475569)
        .setScrollFactor(0)
        .setDepth(d + 3);
      const title = s.add
        .text(cx - w / 2 + 20, y - (narrow ? 10 : 12), bp.name, {
          fontFamily: HUD_FONT,
          fontSize: '12px',
          fontStyle: 'bold',
          color: ready ? '#86efac' : '#e2e8f0',
        })
        .setOrigin(0, 0.5)
        .setScrollFactor(0)
        .setDepth(d + 4);

      const parts = inv.matProgress(bpId);
      parts.forEach((p, pi) => {
        const pct = Math.min(1, p.have / p.need);
        const bx = cx - w / 2 + 20 + pi * (narrow ? 88 : 96);
        const by = y + (narrow ? 12 : 14);
        if (bx > cx + w / 2 - 40) return;
        s.add
          .rectangle(bx, by, 72, 6, 0x0f172a, 1)
          .setOrigin(0, 0.5)
          .setScrollFactor(0)
          .setDepth(d + 4);
        const fill = s.add
          .rectangle(bx, by, 72 * pct, 5, p.color, 1)
          .setOrigin(0, 0.5)
          .setScrollFactor(0)
          .setDepth(d + 5);
        const lbl = s.add
          .text(bx, by + 10, `${p.name} ${p.have}/${p.need}`, {
            fontFamily: HUD_FONT,
            fontSize: '8px',
            color: '#94a3b8',
          })
          .setOrigin(0, 0.5)
          .setScrollFactor(0)
          .setDepth(d + 5);
        this.nodes.push(fill, lbl);
      });

      if (ready) {
        row.setInteractive({ useHandCursor: true });
        row.on('pointerup', () => {
          s.toggleCraft(true);
          s.tryCraftId(bpId);
          this.show();
        });
      }

      this.nodes.push(row, title);
      y += narrow ? 58 : 64;
    });

    const hint = s.add
      .text(cx, top + h - 16, 'Green = ready at purple bench. Open CRAFT on bar.', {
        fontFamily: HUD_FONT,
        fontSize: '9px',
        color: '#64748b',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(d + 3);
    this.nodes.push(hint);
  }

  _drawDoll(s, x, y, d, char, inv, scale = 1) {
    const sc = scale;
    const pedestal = s.add
      .ellipse(x, y + 58 * sc, 70 * sc, 18 * sc, 0x1e293b, 0.9)
      .setScrollFactor(0)
      .setDepth(d + 2);
    const ring = s.add
      .circle(x, y - 4 * sc, 52 * sc, 0x0f172a, 1)
      .setStrokeStyle(2, 0x334155)
      .setScrollFactor(0)
      .setDepth(d + 2);

    const doll = s.add.container(x, y - 8 * sc).setScrollFactor(0).setDepth(d + 3);
    const bodyCol = char?.color || 0x38bdf8;
    const hair = char?.hair || 0xfde68a;
    doll.add([
      s.add.rectangle(0, 22 * sc, 30 * sc, 42 * sc, bodyCol),
      s.add.circle(0, -14 * sc, 15 * sc, 0xfde68a),
      s.add.ellipse(0, -20 * sc, 22 * sc, 11 * sc, hair),
      s.add.rectangle(0, 50 * sc, 22 * sc, 26 * sc, 0x1e3a5f),
    ]);
    if (inv.equip[SLOT.HEAD]) {
      doll.add(s.add.ellipse(0, -24 * sc, 24 * sc, 11 * sc, 0xc026d3));
    }
    if (inv.equip[SLOT.WEAPON]) {
      doll.add(s.add.rectangle(24 * sc, 12 * sc, 7 * sc, 30 * sc, 0xa8a29e).setAngle(28));
    }
    if (inv.equip[SLOT.BODY]) {
      doll.add(s.add.rectangle(0, 18 * sc, 34 * sc, 20 * sc, 0x64748b, 0.55));
    }
    this.nodes.push(pedestal, ring, doll);
  }
}
