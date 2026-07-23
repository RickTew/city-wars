/**
 * City map — no corner postage-stamp minimap.
 * MAP button opens a paused overlay: uncovered FOW + zone colors + key pins.
 */
import {
  CENTER_X,
  CENTER_Y,
  MAP_H,
  MAP_W,
  ROAD_TILES,
  T,
  ZONE,
  ZONE_ENTER,
  ZONE_META,
  ZONE_R,
} from '../config/constants.js';
import { DomUi } from './DomUi.js';

export class CityMap {
  constructor(scene) {
    this.scene = scene;
    this.open = false;
    /** null = whole city; zone id = filter to that ring */
    this.filterZone = null;
    this._canvas = null;
    this._root = null;
  }

  /** No always-on corner mini-map — only layout the tiny MAP chip if present. */
  create() {
    const s = this.scene;
    if (s.domMapLabel) {
      s.domMapLabel.textContent = 'MAP';
      s.domMapLabel.classList.add('hud-map-chip');
      s.domMapLabel.style.cursor = 'pointer';
      s.domMapLabel.title = 'Open city map';
      s.domMapLabel.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.toggle();
      };
    }
  }

  onResize() {
    if (this.open) this.show();
    else this._layoutChip();
  }

  _layoutChip() {
    const s = this.scene;
    if (!s.domMapLabel) return;
    const yTop = s.isMobileHud?.() ? 108 : 78;
    s.domMapLabel.style.top = `${yTop}px`;
    s.domMapLabel.style.right = '12px';
    s.domMapLabel.style.width = 'auto';
    s.domMapLabel.style.minWidth = '52px';
    s.domMapLabel.textContent = 'MAP';
  }

  update() {
    // Corner mini-map removed — compass label only
    this.updateCompass();
  }

  updateCompass() {
    const s = this.scene;
    const lab = s.domCompassLabel;
    if (!lab) return;
    const t = s.objTarget;
    const bx = 40;
    const by = Math.min(120, (s.isMobileHud?.() ? 118 : 64) + (s.scale.height < 700 ? 8 : 20));
    lab.style.left = `${bx}px`;
    lab.style.top = `${by}px`;
    if (!t) {
      lab.textContent = '';
      return;
    }
    if (t.ui) {
      lab.style.color = '#fbbf24';
      lab.textContent = `→ ${String(t.ui).toUpperCase()}`;
      return;
    }
    const ox = t.tx ?? t.x;
    const oy = t.ty ?? t.y;
    if (ox == null) {
      lab.textContent = '';
      return;
    }
    const dist = Math.abs(ox - s.player.tx) + Math.abs(oy - s.player.ty);
    if (dist <= 2) {
      lab.style.color = '#4ade80';
      lab.textContent = 'OBJ HERE';
    } else {
      lab.style.color = dist <= 6 ? '#4ade80' : '#fbbf24';
      lab.textContent = `OBJ ${dist}`;
    }
  }

  toggle() {
    if (this.open) this.close();
    else this.show();
  }

  close() {
    this.open = false;
    this.scene.mapOpen = false;
    this._root = null;
    this._canvas = null;
    DomUi.clearModal();
    this.scene.uiBlockClick = true;
    this.scene.time?.delayedCall(80, () => {
      this.scene.uiBlockClick = false;
    });
  }

  show() {
    const s = this.scene;
    s.closeRunMenu?.();
    s.closeMoreMenu?.();
    s.craftPanel?.toggle?.(false);
    if (s.bagOpen) s.equipUI?.toggle?.();
    s.clearMousePath?.();

    this.open = true;
    s.mapOpen = true;
    this.filterZone = this.filterZone || null;

    DomUi.clearModal();
    const root = DomUi.show('city-map-ui', 'modal');
    this._root = root;
    if (!root) return;

    root.addEventListener('pointerup', (e) => {
      if (e.target === root) this.close();
    });

    const panel = DomUi.el('div', 'city-map-panel');
    const head = DomUi.el('div', 'city-map-head');
    head.appendChild(DomUi.el('div', 'city-map-title', 'CITY MAP'));
    head.appendChild(
      DomUi.el(
        'div',
        'city-map-sub',
        this.filterZone
          ? `${ZONE_META[this.filterZone]?.name || this.filterZone} · uncovered only`
          : 'Uncovered streets · click a ring chip to focus'
      )
    );
    head.appendChild(
      DomUi.button('hit city-map-x', '✕', () => this.close())
    );
    panel.appendChild(head);

    // Zone filter chips
    const chips = DomUi.el('div', 'city-map-chips');
    const addChip = (id, label, css) => {
      const on = this.filterZone === id || (id === null && !this.filterZone);
      const btn = DomUi.button(
        `hit city-map-chip${on ? ' on' : ''}`,
        label,
        () => {
          this.filterZone = id;
          this.show();
        }
      );
      if (css) btn.style.borderColor = css;
      if (on && css) {
        btn.style.background = css;
        btn.style.color = id === ZONE.HOME || id === ZONE.YELLOW ? '#0b1220' : '#fff';
      }
      chips.appendChild(btn);
    };
    addChip(null, 'WHOLE CITY', '#64748b');
    addChip(ZONE.HOME, 'HOME', ZONE_META[ZONE.HOME].css);
    for (const z of ZONE_ENTER) {
      addChip(z, ZONE_META[z].short, ZONE_META[z].css);
    }
    panel.appendChild(chips);

    const wrap = DomUi.el('div', 'city-map-canvas-wrap');
    const canvas = document.createElement('canvas');
    canvas.className = 'city-map-canvas';
    canvas.width = 520;
    canvas.height = 520;
    wrap.appendChild(canvas);
    panel.appendChild(wrap);
    this._canvas = canvas;

    // Key / legend
    const key = DomUi.el('div', 'city-map-key');
    key.appendChild(DomUi.el('div', 'city-map-key-title', 'KEY POINTS'));
    for (const pin of this.keyPins()) {
      if (this.filterZone && pin.zone && pin.zone !== this.filterZone) continue;
      const line = DomUi.el('div', 'city-map-key-line');
      const dot = DomUi.el('span', 'city-map-dot');
      dot.style.background = pin.color;
      line.appendChild(dot);
      line.appendChild(document.createTextNode(` ${pin.label}`));
      key.appendChild(line);
    }
    panel.appendChild(key);

    const actions = DomUi.el('div', 'sheet-actions');
    const close = DomUi.button('hit sheet-btn ghost', 'CLOSE', () => this.close());
    close.style.background = DomUi.hexCss(0x334155);
    close.style.color = '#e2e8f0';
    actions.appendChild(close);
    panel.appendChild(actions);

    root.appendChild(panel);
    this.drawCanvas(canvas);
  }

  /** Pins for current run state (tutorial + escape). */
  keyPins() {
    const s = this.scene;
    const pins = [
      {
        x: CENTER_X,
        y: CENTER_Y,
        label: 'HQ / you start here',
        color: '#38bdf8',
        zone: ZONE.HOME,
        kind: 'hq',
      },
    ];
    const guideLoot = s.lootSpots?.find((l) => l.guide && !l.taken);
    if (guideLoot) {
      pins.push({
        x: guideLoot.x,
        y: guideLoot.y,
        label: 'Gold crate (learn scavenge)',
        color: '#fbbf24',
        zone: ZONE.HOME,
        kind: 'loot',
      });
    }
    const stick = s.gearDrops?.find((d) => d.id === 'stick' && !d.taken);
    if (stick) {
      pins.push({
        x: stick.x,
        y: stick.y,
        label: 'Street Stick (weapon)',
        color: '#d97706',
        zone: ZONE.HOME,
        kind: 'gear',
      });
    }
    const hat = s.gearDrops?.find((d) => d.id === 'sexy_hat' && !d.taken);
    if (hat) {
      pins.push({
        x: hat.x,
        y: hat.y,
        label: 'Neon Fedora (sneak)',
        color: '#c026d3',
        zone: ZONE.HOME,
        kind: 'gear',
      });
    }
    const bench = s.benches?.[0];
    if (bench) {
      pins.push({
        x: bench.x,
        y: bench.y,
        label: 'Street Rig (CRAFT)',
        color: '#a855f7',
        zone: s.zones.getZone(bench.x, bench.y),
        kind: 'bench',
      });
    }
    const sleep = s.sleeps?.[0];
    if (sleep) {
      pins.push({
        x: sleep.x,
        y: sleep.y,
        label: 'Sleep pad',
        color: '#2dd4bf',
        zone: s.zones.getZone(sleep.x, sleep.y),
        kind: 'sleep',
      });
    }
    if (s.guide?.done) {
      const breach = s.bpSpots?.find((b) => b.id === 'breach' && !b.taken);
      if (breach) {
        pins.push({
          x: breach.x,
          y: breach.y,
          label: 'Breach blueprint (RED)',
          color: '#f472b6',
          zone: ZONE.RED,
          kind: 'bp',
        });
      }
      const pad = s.nearestEscapePad?.() || s.escapePads?.[0];
      if (pad) {
        pins.push({
          x: pad.x,
          y: pad.y,
          label: 'Escape pad',
          color: '#f59e0b',
          zone: ZONE.RED,
          kind: 'escape',
        });
      }
    }
    // Live player
    if (s.player) {
      pins.push({
        x: s.player.tx,
        y: s.player.ty,
        label: 'You',
        color: '#7dd3fc',
        zone: s.zones.getZone(s.player.tx, s.player.ty),
        kind: 'player',
      });
    }
    return pins;
  }

  drawCanvas(canvas) {
    const s = this.scene;
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;
    ctx.fillStyle = '#020617';
    ctx.fillRect(0, 0, W, H);

    // Bounds for filter
    let x0 = 0;
    let y0 = 0;
    let x1 = MAP_W;
    let y1 = MAP_H;
    if (this.filterZone) {
      // Approximate ring band for crop
      const inner =
        this.filterZone === ZONE.HOME
          ? 0
          : this.filterZone === ZONE.YELLOW
            ? ZONE_R[ZONE.HOME]
            : this.filterZone === ZONE.ORANGE
              ? ZONE_R[ZONE.YELLOW]
              : this.filterZone === ZONE.GREEN
                ? ZONE_R[ZONE.ORANGE]
                : this.filterZone === ZONE.BLUE
                  ? ZONE_R[ZONE.GREEN]
                  : ZONE_R[ZONE.BLUE];
      const outer =
        this.filterZone === ZONE.RED
          ? Math.max(MAP_W, MAP_H)
          : ZONE_R[this.filterZone] ?? Math.max(MAP_W, MAP_H);
      // Bounding box of diamond ring (loose square)
      const pad = 2;
      x0 = Math.max(0, CENTER_X - outer - pad);
      y0 = Math.max(0, CENTER_Y - outer - pad);
      x1 = Math.min(MAP_W, CENTER_X + outer + pad + 1);
      y1 = Math.min(MAP_H, CENTER_Y + outer + pad + 1);
      void inner;
    }

    const tw = x1 - x0;
    const th = y1 - y0;
    const cell = Math.min(W / tw, H / th);
    const ox = (W - tw * cell) / 2;
    const oy = (H - th * cell) / 2;
    const explored = s.explored;

    for (let ty = y0; ty < y1; ty++) {
      for (let tx = x0; tx < x1; tx++) {
        if (this.filterZone && s.zones.getZone(tx, ty) !== this.filterZone) {
          // dim outside selected ring when filtered
          continue;
        }
        const key = tx + ty * MAP_W;
        const known = !explored || explored.has(key);
        const px = ox + (tx - x0) * cell;
        const py = oy + (ty - y0) * cell;

        if (!known) {
          ctx.fillStyle = '#0b1220';
          ctx.fillRect(px, py, cell + 0.5, cell + 0.5);
          continue;
        }

        const tile = s.ground?.[ty]?.[tx];
        const wall = s.walls?.[ty]?.[tx];
        const z = s.zones.getZone(tx, ty);
        let col = '#1e293b';
        if (wall) col = '#0f172a';
        else if (ROAD_TILES.has(tile)) col = '#475569';
        else if (tile === T.HQ) col = '#0ea5e9';
        else if (tile === T.ESCAPE) col = '#f59e0b';
        else if (tile === T.LOOT) col = '#a16207';
        else if (tile === T.LANDMARK) col = '#db2777';
        else if (tile === T.BENCH) col = '#7c3aed';
        else if (tile === T.SLEEP) col = '#0f766e';
        else if (tile === T.PARK) col = '#15803d';
        else if (tile === T.SIDEWALK) col = '#64748b';
        else {
          // Soft zone wash on open ground
          const zc = ZONE_META[z]?.css || '#334155';
          col = z === ZONE.HOME ? '#334155' : zc;
        }
        ctx.fillStyle = col;
        ctx.globalAlpha = z === ZONE.HOME || ROAD_TILES.has(tile) || wall ? 1 : 0.55;
        ctx.fillRect(px, py, cell + 0.5, cell + 0.5);
        ctx.globalAlpha = 1;
      }
    }

    // Zone ring outlines (whole city view)
    if (!this.filterZone) {
      ctx.lineWidth = Math.max(1, cell * 0.35);
      for (const z of ZONE_ENTER) {
        const R = ZONE_R[z];
        if (!R) continue;
        ctx.strokeStyle = ZONE_META[z].css;
        ctx.globalAlpha = 0.45;
        // Diamond outline samples
        ctx.beginPath();
        for (let i = 0; i <= 64; i++) {
          const a = (i / 64) * Math.PI * 2;
          // manhattan circle: |x|+|y|=R
          const dx = Math.round(R * Math.cos(a));
          const dy = Math.round(R * Math.sin(a));
          // project to diamond
          const man = Math.abs(dx) + Math.abs(dy) || 1;
          const sx = CENTER_X + Math.round((dx / man) * R);
          const sy = CENTER_Y + Math.round((dy / man) * R);
          const px = ox + (sx - x0) * cell + cell / 2;
          const py = oy + (sy - y0) * cell + cell / 2;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    // Pins
    for (const pin of this.keyPins()) {
      if (this.filterZone && pin.zone !== this.filterZone) continue;
      if (pin.x < x0 || pin.x >= x1 || pin.y < y0 || pin.y >= y1) continue;
      const key = pin.x + pin.y * MAP_W;
      if (explored && !explored.has(key) && pin.kind !== 'player' && pin.kind !== 'hq') {
        // Tutorial pins in HOME: reveal if guide not done
        if (!(s.guide && !s.guide.done && pin.zone === ZONE.HOME)) continue;
      }
      const px = ox + (pin.x - x0) * cell + cell / 2;
      const py = oy + (pin.y - y0) * cell + cell / 2;
      const r = Math.max(3, cell * 0.9);
      ctx.fillStyle = pin.color;
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#0b1220';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      if (pin.kind === 'player') {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(px, py, r + 2, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }
}
