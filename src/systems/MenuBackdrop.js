/**
 * Ruined night city for title atmosphere.
 * Procedural only — no Phaser Text (signs/labels are DOM in MenuScene).
 * See VISUAL-STYLE.md.
 */

/** Seeded-ish hash so resize redraws stay stable for a given width. */
function hash01(i, salt = 0) {
  const n = ((i * 1103515245 + 12345 + salt * 7919) >>> 0) % 1000;
  return n / 1000;
}

/**
 * Draw layered skyline + fire + window lights into a scene.
 * Returns handles for flicker / ember loops (caller owns lifecycle).
 */
export function drawMenuBackdrop(scene, w, h) {
  const skylineY = h * 0.58;
  const root = scene.add.container(0, 0);

  // Scale building mass with width — fixed px columns become toothpicks on 2K+
  const s = Math.max(1, Math.min(2.2, w / 1000));
  const colPitch = 44 * s;
  const cols = Math.ceil(w / colPitch) + 3;
  const buildingMeta = [];

  const sky = scene.add.rectangle(w / 2, h / 2, w, h, 0x05080f);
  root.add(sky);
  const haze = scene.add.rectangle(w / 2, skylineY * 0.55, w, skylineY * 1.1, 0x1a0a08, 0.35);
  root.add(haze);

  const wall = scene.add.graphics();
  wall.fillStyle(0x0a0e18, 1);
  wall.fillRect(0, skylineY - 28 * s, w, 36 * s);
  wall.fillStyle(0xef4444, 0.12);
  for (let x = 8; x < w; x += 48 * s) {
    wall.fillRect(x, skylineY - 22 * s, 6 * s, 10 * s);
  }
  root.add(wall);

  const buildings = scene.add.graphics();
  for (let i = 0; i < cols; i++) {
    const bx = i * colPitch - 10 * s;
    const bh = (75 + Math.floor(hash01(i, 1) * 150)) * s;
    const bw = colPitch * (0.88 + hash01(i, 2) * 0.14);
    const top = skylineY - bh;
    const scarred = hash01(i, 6) > 0.55;
    const cx = bx + bw * 0.5;

    buildings.fillStyle(i % 5 === 2 ? 0x121826 : 0x0d121c, 1);
    buildings.fillRect(bx, top, bw, bh + h - skylineY + 48);

    const teeth = 2 + Math.floor(hash01(i, 3) * 4);
    for (let t = 0; t < teeth; t++) {
      const tw = (4 + Math.floor(hash01(i + t, 4) * 8)) * s;
      const th = (8 + Math.floor(hash01(i + t, 5) * 22)) * s;
      const tx = bx + 4 * s + t * ((bw - 8 * s) / teeth);
      buildings.fillStyle(0x05080f, 1);
      buildings.fillRect(tx, top, tw, th);
    }

    if (scarred) {
      buildings.fillStyle(0x1c1010, 0.85);
      buildings.fillRect(bx + bw * 0.55, top + bh * 0.3, bw * 0.45, bh * 0.45);
    }

    const litWindows = [];
    const winStepY = 14 * s;
    const winStepX = 11 * s;
    const winSize = Math.max(4, Math.round(5 * s));
    for (let wy = top + 12 * s; wy < h - 16; wy += winStepY) {
      for (let wx = bx + 5 * s; wx < bx + bw - 8 * s; wx += winStepX) {
        const roll = hash01(i + Math.floor(wy / s) + Math.floor(wx / s), 7);
        if (roll < 0.52) continue;
        let col = 0xfbbf24;
        let a = 0.18 + hash01(i + Math.floor(wy), 8) * 0.35;
        if (roll > 0.88) {
          col = 0x22d3ee;
          a = 0.35;
        } else if (roll > 0.78) {
          col = 0x4ade80;
          a = 0.28;
        } else if (roll < 0.6) {
          col = 0xf97316;
          a = 0.4;
        }
        buildings.fillStyle(col, a);
        buildings.fillRect(wx, wy, winSize, winSize);
        if (wy < skylineY - 20 * s) {
          litWindows.push({ x: wx + winSize / 2, y: wy + winSize / 2, wx, wy, winSize });
        }
      }
    }

    buildingMeta.push({ i, bx, bw, bh, top, cx, scarred, litWindows, s });
  }
  root.add(buildings);

  const fires = [];
  const fireGfx = scene.add.graphics();
  root.add(fireGfx);

  const usable = buildingMeta.filter((b) => b.bx > 8 && b.bx + b.bw < w - 8 && b.bh > 90 * s);
  const pick = (frac) => {
    if (!usable.length) return null;
    return usable[Math.min(usable.length - 1, Math.floor(frac * usable.length))];
  };

  const placements = [
    { b: pick(0.1), kind: 'roof', s: 1.0 },
    { b: pick(0.38), kind: 'roof', s: 0.8 },
    { b: pick(0.22), kind: 'window', s: 0.7, floorBias: 0.3 },
    { b: pick(0.68), kind: 'window', s: 0.85, floorBias: 0.5 },
    { b: pick(0.5), kind: 'facade', s: 0.95 },
    { b: pick(0.18), kind: 'street', s: 1.1 },
    { b: pick(0.82), kind: 'street', s: 0.85 },
  ];

  placements.forEach((p, pi) => {
    const b = p.b;
    if (!b) return;
    let x = b.cx;
    let y = skylineY + 12 * s;
    let fs = p.s * s;
    const kind = p.kind;

    if (kind === 'roof') {
      x = b.bx + b.bw * (0.28 + hash01(b.i, 20 + pi) * 0.44);
      y = b.top + 8 * s + hash01(b.i, 21) * 12 * s;
    } else if (kind === 'window' && b.litWindows.length) {
      const wi = Math.min(
        b.litWindows.length - 1,
        Math.floor((p.floorBias ?? 0.4) * b.litWindows.length)
      );
      const win = b.litWindows[Math.max(0, wi)];
      x = win.x;
      y = win.y;
      buildings.fillStyle(0x1a0804, 0.92);
      buildings.fillRect(win.wx - 1, win.wy - 1, win.winSize + 2, win.winSize + 2);
      buildings.fillStyle(0xea580c, 0.5);
      buildings.fillRect(win.wx, win.wy, win.winSize, win.winSize);
      fs *= 0.55;
    } else if (kind === 'facade') {
      const scar = usable.find((u) => u.scarred) || b;
      x = scar.bx + scar.bw * 0.7;
      y = scar.top + scar.bh * (0.38 + hash01(scar.i, 25) * 0.22);
    } else {
      x = b.cx + (hash01(b.i, 26) - 0.5) * b.bw * 0.2;
      y = skylineY + 10 * s + hash01(b.i, 27) * 16 * s;
    }

    fires.push({
      x,
      y,
      s: fs,
      kind,
      phase: hash01(b.i, 30 + pi) * Math.PI * 2,
    });
  });

  const smoke = scene.add.graphics();
  root.add(smoke);

  const embers = [];
  for (let i = 0; i < 28; i++) {
    const src = fires[i % Math.max(1, fires.length)] || { x: w * 0.5, y: skylineY };
    const e = scene.add.circle(
      src.x + (Math.random() - 0.5) * 36,
      src.y + Math.random() * 16,
      1 + Math.random() * 1.5,
      Math.random() > 0.5 ? 0xf97316 : 0xfbbf24,
      0.5 + Math.random() * 0.4
    );
    root.add(e);
    embers.push({
      spr: e,
      vx: (Math.random() - 0.5) * 12,
      vy: -18 - Math.random() * 40,
      life: Math.random(),
      srcX: src.x,
      srcY: src.y,
    });
  }

  const drawFire = (f, i, t) => {
    const flicker = 0.75 + Math.sin(t * 9 + f.phase) * 0.2 + Math.sin(t * 17 + i) * 0.08;
    const sc = f.s * flicker;
    const { x, y, kind } = f;

    if (kind === 'window') {
      fireGfx.fillStyle(0x7f1d1d, 0.5);
      fireGfx.fillEllipse(x, y + 2, 9 * sc, 4 * sc);
      fireGfx.fillStyle(0xea580c, 0.85);
      fireGfx.fillEllipse(x, y - 2 * sc, 6 * sc, 11 * sc);
      fireGfx.fillStyle(0xfbbf24, 0.9);
      fireGfx.fillEllipse(x + Math.sin(t * 12 + i), y - 7 * sc, 3 * sc, 6 * sc);
      return;
    }
    if (kind === 'facade') {
      fireGfx.fillStyle(0x7f1d1d, 0.45);
      fireGfx.fillEllipse(x, y + 4, 12 * sc, 7 * sc);
      fireGfx.fillStyle(0xea580c, 0.8);
      fireGfx.fillEllipse(x, y - 3 * sc, 9 * sc, 18 * sc);
      fireGfx.fillStyle(0xfbbf24, 0.88);
      fireGfx.fillEllipse(x + Math.sin(t * 10 + i) * 1.2, y - 11 * sc, 4 * sc, 10 * sc);
      return;
    }
    if (kind === 'roof') {
      fireGfx.fillStyle(0x7f1d1d, 0.5);
      fireGfx.fillEllipse(x, y + 3, 14 * sc, 6 * sc);
      fireGfx.fillStyle(0xea580c, 0.78);
      fireGfx.fillEllipse(x, y - 2 * sc, 10 * sc, 14 * sc);
      fireGfx.fillStyle(0xfbbf24, 0.88);
      fireGfx.fillEllipse(x + Math.sin(t * 11 + i) * 1.2, y - 8 * sc, 4 * sc, 9 * sc);
      return;
    }
    fireGfx.fillStyle(0x3f1f12, 0.7);
    fireGfx.fillEllipse(x, y + 7, 20 * sc, 7 * sc);
    fireGfx.fillStyle(0x7f1d1d, 0.55);
    fireGfx.fillEllipse(x, y + 4, 18 * sc, 8 * sc);
    fireGfx.fillStyle(0xea580c, 0.78);
    fireGfx.fillEllipse(x, y, 13 * sc, 16 * sc);
    fireGfx.fillStyle(0xfbbf24, 0.88);
    fireGfx.fillEllipse(x + Math.sin(t * 11 + i) * 1.5, y - 6 * sc, 6 * sc, 11 * sc);
    fireGfx.fillStyle(0xfef08a, 0.9);
    fireGfx.fillEllipse(x, y - 11 * sc, 2.5 * sc, 5 * sc);
  };

  const tick = (dt) => {
    const t = (tick._t = (tick._t || 0) + dt);

    fireGfx.clear();
    fires.forEach((f, i) => drawFire(f, i, t));

    smoke.clear();
    fires.forEach((f, i) => {
      const layers = f.kind === 'window' ? 2 : 3;
      for (let k = 0; k < layers; k++) {
        const oy = -12 - k * 14 - ((t * 22 + i * 40 + k * 30) % 48);
        const ox = Math.sin(t * 1.2 + i + k) * (6 + k * 3);
        smoke.fillStyle(0x64748b, f.kind === 'window' ? 0.05 : 0.08 + (2 - k) * 0.03);
        smoke.fillEllipse(f.x + ox, f.y + oy, 10 + k * 5, 8 + k * 3);
      }
    });

    const dtSec = Math.min(0.05, dt);
    embers.forEach((e, ei) => {
      e.life += dtSec * 0.35;
      e.spr.x += e.vx * dtSec;
      e.spr.y += e.vy * dtSec;
      e.spr.setAlpha(0.2 + (1 - (e.life % 1)) * 0.55);
      if (e.spr.y < e.srcY - 90 || e.life > 1) {
        const src = fires[ei % Math.max(1, fires.length)] || { x: w * 0.5, y: skylineY };
        e.srcX = src.x;
        e.srcY = src.y;
        e.spr.x = src.x + (Math.random() - 0.5) * 28;
        e.spr.y = src.y + Math.random() * 10;
        e.life = 0;
        e.vy = -18 - Math.random() * 40;
      }
    });
  };

  return { root, tick, skylineY };
}
