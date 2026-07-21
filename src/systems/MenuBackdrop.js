/**
 * Ruined night city for title / character select.
 * Broken towers, neon bleed, fire, ash. Dark comedy grit.
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

  // Night gradient base (two stacked rects: deep navy → ash)
  const sky = scene.add.rectangle(w / 2, h / 2, w, h, 0x05080f);
  root.add(sky);
  const haze = scene.add.rectangle(w / 2, skylineY * 0.55, w, skylineY * 1.1, 0x1a0a08, 0.35);
  root.add(haze);

  // Distant Wall silhouette
  const wall = scene.add.graphics();
  wall.fillStyle(0x0a0e18, 1);
  wall.fillRect(0, skylineY - 28, w, 36);
  wall.fillStyle(0xef4444, 0.12);
  for (let x = 8; x < w; x += 48) {
    wall.fillRect(x, skylineY - 22, 6, 10);
  }
  root.add(wall);

  // Ruined buildings (jagged tops, missing chunks)
  const buildings = scene.add.graphics();
  const cols = Math.ceil(w / 46) + 2;
  for (let i = 0; i < cols; i++) {
    const bx = i * 48 - 8;
    const bh = 70 + Math.floor(hash01(i, 1) * 140);
    const bw = 36 + Math.floor(hash01(i, 2) * 14);
    const top = skylineY - bh;

    // Body
    buildings.fillStyle(i % 5 === 2 ? 0x121826 : 0x0d121c, 1);
    buildings.fillRect(bx, top, bw, bh + h - skylineY + 48);

    // Broken crown (missing teeth)
    const teeth = 2 + Math.floor(hash01(i, 3) * 4);
    for (let t = 0; t < teeth; t++) {
      const tw = 4 + Math.floor(hash01(i + t, 4) * 8);
      const th = 8 + Math.floor(hash01(i + t, 5) * 22);
      const tx = bx + 4 + t * ((bw - 8) / teeth);
      buildings.fillStyle(0x05080f, 1);
      buildings.fillRect(tx, top, tw, th);
    }

    // Scar / fire-blackened corner
    if (hash01(i, 6) > 0.55) {
      buildings.fillStyle(0x1c1010, 0.85);
      buildings.fillRect(bx + bw * 0.55, top + bh * 0.3, bw * 0.45, bh * 0.45);
    }

    // Sparse lit windows (some dead, some amber, some neon sick-green)
    for (let y = top + 14; y < h - 20; y += 16) {
      for (let wx = bx + 6; wx < bx + bw - 8; wx += 12) {
        const roll = hash01(i + Math.floor(y) + wx, 7);
        if (roll < 0.55) continue;
        let col = 0xfbbf24;
        let a = 0.18 + hash01(i + y, 8) * 0.35;
        if (roll > 0.88) {
          col = 0x22d3ee;
          a = 0.35;
        } else if (roll > 0.78) {
          col = 0x4ade80;
          a = 0.28;
        } else if (roll < 0.62) {
          col = 0xf97316;
          a = 0.4;
        }
        buildings.fillStyle(col, a);
        buildings.fillRect(wx, y, 5, 5);
      }
    }
  }
  root.add(buildings);

  // Neon sign wreckage (dark comedy)
  const signs = scene.add.graphics();
  const signY = skylineY - 90 - h * 0.04;
  signs.fillStyle(0xf472b6, 0.55);
  signs.fillRect(w * 0.12, signY, 72, 10);
  signs.fillStyle(0x22d3ee, 0.4);
  signs.fillRect(w * 0.12 + 8, signY + 14, 40, 6);
  // Fallen letter stub
  signs.fillStyle(0xfbbf24, 0.5);
  signs.fillRect(w * 0.72, skylineY - 40, 8, 28);
  signs.fillRect(w * 0.72 + 10, skylineY - 18, 22, 6);
  root.add(signs);

  const neonFlicker = scene.add
    .text(w * 0.12 + 36, signY + 5, 'OPEN', {
      fontFamily: 'system-ui',
      fontSize: '9px',
      fontStyle: 'bold',
      color: '#0b1220',
    })
    .setOrigin(0.5);
  root.add(neonFlicker);

  const joke = scene.add
    .text(w * 0.78, skylineY - 52, 'RENT DUE', {
      fontFamily: 'system-ui',
      fontSize: '10px',
      fontStyle: 'bold',
      color: '#fbbf24',
    })
    .setOrigin(0.5)
    .setAlpha(0.55)
    .setAngle(-8);
  root.add(joke);

  // Ground fire piles
  const fires = [];
  const fireGfx = scene.add.graphics();
  root.add(fireGfx);
  const fireSpots = [
    { x: w * 0.18, y: skylineY + 18, s: 1.1 },
    { x: w * 0.48, y: skylineY + 28, s: 1.4 },
    { x: w * 0.78, y: skylineY + 14, s: 0.9 },
    { x: w * 0.32, y: skylineY + 40, s: 0.7 },
  ];
  fireSpots.forEach((f) => {
    fires.push({ ...f, phase: Math.random() * Math.PI * 2 });
  });

  // Smoke plumes (soft ellipses)
  const smoke = scene.add.graphics();
  root.add(smoke);

  // Ash / ember particles
  const embers = [];
  for (let i = 0; i < 28; i++) {
    const e = scene.add.circle(
      Math.random() * w,
      skylineY + Math.random() * (h - skylineY),
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
    });
  }

  const state = { t: 0, fires, fireGfx, smoke, embers, neonFlicker, signs, w, h, skylineY };

  const tick = (dt) => {
    state.t += dt;
    const t = state.t;

    // Fire flicker
    fireGfx.clear();
    state.fires.forEach((f, i) => {
      const flicker = 0.75 + Math.sin(t * 9 + f.phase) * 0.2 + Math.sin(t * 17 + i) * 0.08;
      const s = f.s * flicker;
      fireGfx.fillStyle(0x7f1d1d, 0.55);
      fireGfx.fillEllipse(f.x, f.y + 6, 28 * s, 10 * s);
      fireGfx.fillStyle(0xea580c, 0.75);
      fireGfx.fillEllipse(f.x, f.y, 16 * s, 22 * s);
      fireGfx.fillStyle(0xfbbf24, 0.85);
      fireGfx.fillEllipse(f.x, f.y - 6 * s, 8 * s, 14 * s);
      fireGfx.fillStyle(0xfef08a, 0.9);
      fireGfx.fillEllipse(f.x + Math.sin(t * 11 + i) * 2, f.y - 12 * s, 3 * s, 6 * s);
    });

    // Smoke
    smoke.clear();
    state.fires.forEach((f, i) => {
      for (let k = 0; k < 3; k++) {
        const oy = -20 - k * 18 - ((t * 22 + i * 40 + k * 30) % 50);
        const ox = Math.sin(t * 1.2 + i + k) * (8 + k * 4);
        smoke.fillStyle(0x64748b, 0.08 + (2 - k) * 0.04);
        smoke.fillEllipse(f.x + ox, f.y + oy, 14 + k * 8, 10 + k * 5);
      }
    });

    // Neon blink
    if (neonFlicker) {
      const on = Math.sin(t * 3.2) > -0.7 || Math.sin(t * 41) > 0.92;
      neonFlicker.setAlpha(on ? 1 : 0.15);
      signs.clear();
      signs.fillStyle(0xf472b6, on ? 0.7 : 0.2);
      signs.fillRect(w * 0.12, skylineY - 90 - h * 0.04, 72, 10);
      signs.fillStyle(0x22d3ee, on ? 0.5 : 0.12);
      signs.fillRect(w * 0.12 + 8, skylineY - 76 - h * 0.04, 40, 6);
      signs.fillStyle(0xfbbf24, 0.45 + Math.sin(t * 2) * 0.15);
      signs.fillRect(w * 0.72, skylineY - 40, 8, 28);
      signs.fillRect(w * 0.72 + 10, skylineY - 18, 22, 6);
    }

    // Embers drift
    const dtSec = Math.min(0.05, dt);
    embers.forEach((e) => {
      e.life += dtSec * 0.35;
      e.spr.x += e.vx * dtSec;
      e.spr.y += e.vy * dtSec;
      e.spr.setAlpha(0.2 + (1 - (e.life % 1)) * 0.55);
      if (e.spr.y < skylineY - 80 || e.life > 1) {
        e.spr.x = Math.random() * w;
        e.spr.y = skylineY + 10 + Math.random() * 40;
        e.life = 0;
        e.vy = -18 - Math.random() * 40;
      }
    });
  };

  return { root, tick, skylineY };
}
