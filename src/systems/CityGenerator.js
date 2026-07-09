import { CENTER_X, CENTER_Y, MAP_H, MAP_W, T, ZONE } from '../config/constants.js';

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
          g[y][x] = T.ROAD;
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

    // Clear arteries
    for (let i = 0; i < MAP_W; i++) {
      w[CENTER_Y][i] = 0;
      w[i][CENTER_X] = 0;
      g[CENTER_Y][i] = T.ROAD;
      g[i][CENTER_X] = T.ROAD;
    }

    // HQ
    carve(w, CENTER_X - 3, CENTER_Y - 3, 7, 7, 0);
    carve(g, CENTER_X - 3, CENTER_Y - 3, 7, 7, T.HQ);
    g[CENTER_Y][CENTER_X] = T.HQ;

    // HQ amenities only (no tutorial pile at your feet)
    place(g, w, CENTER_X + 2, CENTER_Y, T.BENCH, this.benches);
    place(g, w, CENTER_X - 2, CENTER_Y + 1, T.SLEEP, this.sleeps);

    // Quest 1 hikes: targets on main roads so pathing is clean
    // 1) Gold crate EAST ~12 tiles
    const glX = CENTER_X + 12;
    const glY = CENTER_Y;
    w[glY][glX] = 0;
    g[glY][glX] = T.LOOT;
    this.loot.push({ x: glX, y: glY, taken: false, guide: true });

    // 2) Street Stick SOUTH ~12 tiles
    const stickX = CENTER_X;
    const stickY = CENTER_Y + 12;
    w[stickY][stickX] = 0;
    g[stickY][stickX] = T.GEAR_DROP;
    this.gearDrops.push({ x: stickX, y: stickY, id: 'stick', taken: false, guide: true });

    // 3) Neon Fedora WEST ~12 tiles
    const hatX = CENTER_X - 12;
    const hatY = CENTER_Y;
    w[hatY][hatX] = 0;
    g[hatY][hatX] = T.GEAR_DROP;
    this.gearDrops.push({ x: hatX, y: hatY, id: 'sexy_hat', taken: false, guide: true });

    // More world furniture  -  keep clear of HQ and guide hike spots
    for (let y = 4; y < MAP_H - 4; y += 5) {
      for (let x = 4; x < MAP_W - 4; x += 5) {
        if (w[y][x] || road(x, y)) continue;
        if (Math.abs(x - CENTER_X) + Math.abs(y - CENTER_Y) < 14) continue;
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

    // Blueprint drops (spread out  -  not under spawn)
    const bps = [
      { x: CENTER_X + 14, y: CENTER_Y - 8, id: 'bandage' },
      { x: CENTER_X + 8, y: CENTER_Y + 14, id: 'bedroll' },
      { x: CENTER_X - 8, y: CENTER_Y + 10, id: 'pipe' },
      { x: CENTER_X - 14, y: CENTER_Y - 6, id: 'stim' },
      { x: CENTER_X + 16, y: CENTER_Y - 12, id: 'zipgun' },
      { x: CENTER_X - 18, y: CENTER_Y + 14, id: 'vest' },
      { x: CENTER_X + 6, y: 5, id: 'breach' }, // north wall  -  the big prize
    ];
    for (const b of bps) {
      const x = clamp(b.x, 2, MAP_W - 3);
      const y = clamp(b.y, 2, MAP_H - 3);
      w[y][x] = 0;
      g[y][x] = T.LANDMARK;
      this.blueprints.push({ x, y, id: b.id, taken: false });
    }

    // Escape pads on edges
    const pads = [
      [CENTER_X, 2],
      [CENTER_X, MAP_H - 3],
      [2, CENTER_Y],
      [MAP_W - 3, CENTER_Y],
    ];
    for (const [x, y] of pads) {
      carve(w, x - 1, y - 1, 3, 3, 0);
      carve(g, x - 1, y - 1, 3, 3, T.ESCAPE);
      this.escapePads.push({ x, y });
    }

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
}

function dens(z) {
  return { [ZONE.SAFE]: 28, [ZONE.MID]: 38, [ZONE.OUTER]: 45, [ZONE.WALL]: 50 }[z] || 35;
}

function grid(w, h, v) {
  return Array.from({ length: h }, () => new Array(w).fill(v));
}
function road(x, y) {
  return x % 6 === 0 || y % 6 === 0 || x === CENTER_X || y === CENTER_Y;
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
