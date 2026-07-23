import { CENTER_X, CENTER_Y, MAP_H, MAP_W, T, ZONE } from '../config/constants.js';

/**
 * Pick road paint by real street axis.
 * Horizontal dashes only on E–W runs; vertical on N–S; intersection = cross pad.
 */
function roadTileAt(x, y) {
  const ew =
    roadLane(y) || y === CENTER_Y || y === CENTER_Y + 1;
  const ns =
    roadLane(x) || x === CENTER_X || x === CENTER_X + 1;
  if (ew && ns) return T.ROAD_X;
  if (ns) return T.ROAD_V;
  return T.ROAD; // E–W
}

export class CityGenerator {
  constructor(zones) {
    this.zones = zones;
    this.loot = [];
    this.benches = [];
    this.sleeps = [];
    this.blueprints = []; // world pickups {x,y,id}
    this.gearDrops = []; // {x,y,id,taken}
    this.escapePads = [];
  }

  generate() {
    const g = grid(MAP_W, MAP_H, T.ALLEY);
    const w = grid(MAP_W, MAP_H, 0);

    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        if (road(x, y)) {
          g[y][x] = roadTileAt(x, y);
          continue;
        }
        const z = this.zones.getZone(x, y);
        const h = hash(x, y);
        if (h % 5 === 0) g[y][x] = T.PARK;
        else if (z === ZONE.OUTER || z === ZONE.WALL) g[y][x] = h % 3 === 0 ? T.RUIN : T.ALLEY;
        else g[y][x] = T.SIDEWALK;

        if (!road(x, y) && distRoad(x, y) >= 2 && h % 100 < dens(z)) {
          w[y][x] = h % 9 === 0 ? T.BARRICADE : T.BUILDING;
        }
      }
    }

    // Clear 2-wide HQ arteries (cross streets through center)
    for (let i = 0; i < MAP_W; i++) {
      for (const cy of [CENTER_Y, CENTER_Y + 1]) {
        if (cy >= MAP_H) continue;
        w[cy][i] = 0;
        g[cy][i] = roadTileAt(i, cy);
      }
      for (const cx of [CENTER_X, CENTER_X + 1]) {
        if (cx >= MAP_W) continue;
        w[i][cx] = 0;
        g[i][cx] = roadTileAt(cx, i);
      }
    }

    // HQ
    carve(w, CENTER_X - 3, CENTER_Y - 3, 7, 7, 0);
    carve(g, CENTER_X - 3, CENTER_Y - 3, 7, 7, T.HQ);
    g[CENTER_Y][CENTER_X] = T.HQ;

    // Stamp Wall BEFORE interactables so breach / pads / loot never get buried
    this._stampNorthWall(g, w);

    // HQ amenities — keep OFF the east road (guide gold crate hikes that way)
    place(g, w, CENTER_X - 2, CENTER_Y - 2, T.BENCH, this.benches);
    place(g, w, CENTER_X - 2, CENTER_Y + 1, T.SLEEP, this.sleeps);

    // Quest 1 hikes: short enough to stay on-screen (phones ~390px ≈ 6 tiles half-width)
    // Keep on main roads so pathing is clean. ~6 tiles also sits inside day vision (9).
    const HIKE = 6;
    // 1) Gold crate EAST (clear path — no bench on this artery)
    const glX = CENTER_X + HIKE;
    const glY = CENTER_Y;
    w[glY][glX] = 0;
    g[glY][glX] = T.LOOT;
    this.loot.push({ x: glX, y: glY, taken: false, guide: true });

    // 2) Street Stick SOUTH
    const stickX = CENTER_X;
    const stickY = CENTER_Y + HIKE;
    w[stickY][stickX] = 0;
    g[stickY][stickX] = T.GEAR_STICK;
    this.gearDrops.push({ x: stickX, y: stickY, id: 'stick', taken: false, guide: true });

    // 3) Neon Fedora WEST
    const hatX = CENTER_X - HIKE;
    const hatY = CENTER_Y;
    w[hatY][hatX] = 0;
    g[hatY][hatX] = T.GEAR_HAT;
    this.gearDrops.push({ x: hatX, y: hatY, id: 'sexy_hat', taken: false, guide: true });

    // More world furniture — keep clear of HQ, guide hikes, and wall barricades
    for (let y = 4; y < MAP_H - 4; y += 5) {
      for (let x = 4; x < MAP_W - 4; x += 5) {
        if (w[y][x] || road(x, y)) continue;
        if (Math.abs(x - CENTER_X) + Math.abs(y - CENTER_Y) < 10) continue;
        // Don't bury guide targets
        if (Math.abs(x - glX) + Math.abs(y - glY) < 3) continue;
        if (Math.abs(x - stickX) + Math.abs(y - stickY) < 3) continue;
        if (Math.abs(x - hatX) + Math.abs(y - hatY) < 3) continue;
        const h = hash(x, y);
        if (h % 17 === 0) place(g, w, x, y, T.LOOT, this.loot);
        else if (h % 31 === 0) place(g, w, x, y, T.BENCH, this.benches);
        else if (h % 23 === 0) place(g, w, x, y, T.SLEEP, this.sleeps);
      }
    }

    // Blueprint drops (spread out — not under spawn)
    // Breach sits just SOUTH of the wall band (y=8+) so it is walkable but still "at the Wall"
    const bps = [
      { x: CENTER_X + 14, y: CENTER_Y - 8, id: 'bandage' },
      { x: CENTER_X + 8, y: CENTER_Y + 14, id: 'bedroll' },
      { x: CENTER_X - 8, y: CENTER_Y + 10, id: 'pipe' },
      { x: CENTER_X - 14, y: CENTER_Y - 6, id: 'stim' },
      { x: CENTER_X + 16, y: CENTER_Y - 12, id: 'zipgun' },
      { x: CENTER_X - 18, y: CENTER_Y + 14, id: 'vest' },
      { x: CENTER_X + 10, y: CENTER_Y + 8, id: 'rags' },
      { x: CENTER_X - 10, y: CENTER_Y - 10, id: 'jacket' },
      { x: CENTER_X + 12, y: CENTER_Y - 16, id: 'charge' },
      { x: CENTER_X + 4, y: 9, id: 'breach' }, // approach to north Wall — must stay walkable
    ];
    for (const b of bps) {
      const x = clamp(b.x, 2, MAP_W - 3);
      const y = clamp(b.y, 2, MAP_H - 3);
      w[y][x] = 0;
      g[y][x] = T.LANDMARK;
      this.blueprints.push({ x, y, id: b.id, taken: false });
    }

    // Escape cache near north Wall — guaranteed partial Breach Kit parts
    const cacheX = CENTER_X + 10;
    const cacheY = 10;
    w[cacheY][cacheX] = 0;
    g[cacheY][cacheX] = T.LOOT;
    this.loot.push({ x: cacheX, y: cacheY, taken: false, escapeCache: true });

    // Escape pads on edges — carved AFTER wall stamp so north pad is a real hole in the Wall
    const pads = [
      [CENTER_X, 3], // north Wall breach point (was buried at y=2 under barricade)
      [CENTER_X, MAP_H - 3],
      [2, CENTER_Y],
      [MAP_W - 3, CENTER_Y],
    ];
    for (const [x, y] of pads) {
      carve(w, x - 1, y - 1, 3, 3, 0);
      carve(g, x - 1, y - 1, 3, 3, T.ESCAPE);
      this.escapePads.push({ x, y });
    }

    // Final safety: every listed interactable must be wall-free
    this._assertClear(g, w);

    return {
      ground: g,
      walls: w,
      loot: this.loot,
      benches: this.benches,
      sleeps: this.sleeps,
      blueprints: this.blueprints,
      gearDrops: this.gearDrops,
      escapePads: this.escapePads,
    };
  }

  /** Visible Wall band across the north — impassable barricade strip. */
  _stampNorthWall(g, w) {
    for (let x = 2; x < MAP_W - 2; x++) {
      for (let y = 2; y < 8; y++) {
        if (this.zones.getZone(x, y) !== ZONE.WALL) continue;
        w[y][x] = T.BARRICADE;
        g[y][x] = y <= 4 ? T.GATE : T.RUIN;
      }
    }
  }

  /** Clear walls under any registered prop so pathing + USE always work. */
  _assertClear(g, w) {
    const pts = [
      ...this.loot,
      ...this.benches,
      ...this.sleeps,
      ...this.blueprints,
      ...this.gearDrops,
      ...this.escapePads,
    ];
    for (const p of pts) {
      if (!inB(p.x, p.y)) continue;
      w[p.y][p.x] = 0;
      // Keep prop paint if already set; escape pads may be a 3×3 carve
      if (g[p.y][p.x] === T.GATE || g[p.y][p.x] === T.RUIN || g[p.y][p.x] === T.BARRICADE) {
        g[p.y][p.x] = T.ALLEY;
      }
    }
    // Re-paint known props after any accidental wall paint wipe
    for (const l of this.loot) {
      if (!l.taken) g[l.y][l.x] = T.LOOT;
    }
    for (const b of this.benches) g[b.y][b.x] = T.BENCH;
    for (const s of this.sleeps) g[s.y][s.x] = T.SLEEP;
    for (const b of this.blueprints) {
      if (!b.taken) g[b.y][b.x] = T.LANDMARK;
    }
    for (const d of this.gearDrops) {
      if (d.taken) continue;
      if (d.id === 'stick') g[d.y][d.x] = T.GEAR_STICK;
      else if (d.id === 'sexy_hat') g[d.y][d.x] = T.GEAR_HAT;
      else g[d.y][d.x] = T.GEAR_DROP;
    }
    for (const p of this.escapePads) {
      // Keep the 3×3 pad clear of barricades
      carve(w, p.x - 1, p.y - 1, 3, 3, 0);
      carve(g, p.x - 1, p.y - 1, 3, 3, T.ESCAPE);
    }
  }
}

function dens(z) {
  // Slightly denser blocks so 2-wide roads still read as a packed city
  return { [ZONE.SAFE]: 36, [ZONE.MID]: 46, [ZONE.OUTER]: 52, [ZONE.WALL]: 55 }[z] || 40;
}

function grid(w, h, v) {
  return Array.from({ length: h }, () => new Array(w).fill(v));
}

/** True on the 2-tile road band that starts every 6 tiles. */
function roadLane(n) {
  const m = ((n % 6) + 6) % 6;
  return m === 0 || m === 1;
}

/** Streets are 2 tiles wide so the runner is not the width of the avenue. */
function road(x, y) {
  return (
    roadLane(x) ||
    roadLane(y) ||
    x === CENTER_X ||
    x === CENTER_X + 1 ||
    y === CENTER_Y ||
    y === CENTER_Y + 1
  );
}
function distRoad(x, y) {
  for (let d = 0; d < 5; d++) {
    if (road(x + d, y) || road(x - d, y) || road(x, y + d) || road(x, y - d)) return d;
  }
  return 5;
}
function hash(x, y) {
  let n = x * 374761393 + y * 668265263;
  n = (n ^ (n >> 13)) * 1274126177;
  return Math.abs(n ^ (n >> 16));
}
function inB(x, y) {
  return x >= 0 && y >= 0 && x < MAP_W && y < MAP_H;
}
function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}
function carve(grid, x, y, w, h, v) {
  for (let j = y; j < y + h; j++)
    for (let i = x; i < x + w; i++) if (inB(i, j)) grid[j][i] = v;
}
function place(g, w, x, y, tile, list) {
  if (!inB(x, y)) return;
  w[y][x] = 0;
  g[y][x] = tile;
  list.push({ x, y, taken: false });
}
