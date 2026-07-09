import { MAP_H, MAP_W } from '../config/constants.js';

/**
 * Lightweight A* for 4-way grid. isWalkable(tx,ty) provided by caller.
 */
export function findPath(sx, sy, gx, gy, isWalkable, maxNodes = 800) {
  if (sx === gx && sy === gy) return [];
  if (!isWalkable(gx, gy)) return null;

  const key = (x, y) => y * MAP_W + x;
  const open = new MinHeap();
  const came = new Map();
  const gScore = new Map();
  const startK = key(sx, sy);
  gScore.set(startK, 0);
  open.push(startK, manhattan(sx, sy, gx, gy));

  const closed = new Set();
  let expanded = 0;

  while (!open.empty() && expanded < maxNodes) {
    const current = open.pop();
    expanded++;
    const cx = current % MAP_W;
    const cy = (current / MAP_W) | 0;

    if (cx === gx && cy === gy) {
      return reconstruct(came, current, key);
    }
    closed.add(current);

    for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= MAP_W || ny >= MAP_H) continue;
      if (!isWalkable(nx, ny) && !(nx === gx && ny === gy)) continue;
      const nk = key(nx, ny);
      if (closed.has(nk)) continue;
      const tentative = (gScore.get(current) ?? 1e9) + 1;
      if (tentative >= (gScore.get(nk) ?? 1e9)) continue;
      came.set(nk, current);
      gScore.set(nk, tentative);
      open.push(nk, tentative + manhattan(nx, ny, gx, gy));
    }
  }
  return null;
}

function manhattan(ax, ay, bx, by) {
  return Math.abs(ax - bx) + Math.abs(ay - by);
}

function reconstruct(came, current, keyFn) {
  const path = [];
  while (came.has(current)) {
    const x = current % MAP_W;
    const y = (current / MAP_W) | 0;
    path.push({ x, y });
    current = came.get(current);
  }
  path.reverse();
  return path;
}

class MinHeap {
  constructor() {
    this.a = [];
  }
  empty() {
    return this.a.length === 0;
  }
  push(k, f) {
    this.a.push({ k, f });
    this.bubbleUp(this.a.length - 1);
  }
  pop() {
    const top = this.a[0];
    const last = this.a.pop();
    if (this.a.length) {
      this.a[0] = last;
      this.sink(0);
    }
    return top.k;
  }
  bubbleUp(i) {
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.a[p].f <= this.a[i].f) break;
      [this.a[p], this.a[i]] = [this.a[i], this.a[p]];
      i = p;
    }
  }
  sink(i) {
    const n = this.a.length;
    while (true) {
      let s = i;
      const l = i * 2 + 1;
      const r = l + 1;
      if (l < n && this.a[l].f < this.a[s].f) s = l;
      if (r < n && this.a[r].f < this.a[s].f) s = r;
      if (s === i) break;
      [this.a[s], this.a[i]] = [this.a[i], this.a[s]];
      i = s;
    }
  }
}
