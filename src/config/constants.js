/** City Wars — Escape-NY grit + Fallout scrap + cyberpunk-lite */

export const TILE = 32;
export const MAP_W = 96; // vertical slice map (full 256 later)
export const MAP_H = 96;
export const WORLD_W = MAP_W * TILE;
export const WORLD_H = MAP_H * TILE;
export const CENTER_X = (MAP_W / 2) | 0;
export const CENTER_Y = (MAP_H / 2) | 0;

export const GAME_W = 1280;
export const GAME_H = 720;

/** Tiles */
export const T = {
  ROAD: 1,
  SIDEWALK: 2,
  PARK: 3,
  BUILDING: 4,
  ALLEY: 5,
  RUIN: 6,
  BARRICADE: 7,
  ESCAPE: 8,
  HQ: 9,
  WATER: 10,
  LOOT: 11,
  BENCH: 12,
  SLEEP: 13,
  LANDMARK: 14,
  GATE: 15,
};

export const WALKABLE = new Set([
  T.ROAD,
  T.SIDEWALK,
  T.PARK,
  T.ALLEY,
  T.RUIN,
  T.ESCAPE,
  T.HQ,
  T.LOOT,
  T.BENCH,
  T.SLEEP,
  T.LANDMARK,
  T.GATE,
]);

export const BLOCKING = new Set([T.BUILDING, T.BARRICADE, T.WATER]);

export const ZONE = { SAFE: 'safe', MID: 'mid', OUTER: 'outer', WALL: 'wall' };
export const ZONE_R = { [ZONE.SAFE]: 14, [ZONE.MID]: 28, [ZONE.OUTER]: 40 };

/** Alert */
export const ALERT = { GREEN: 'green', YELLOW: 'yellow', RED: 'red' };

/** Day length presets (full day+night cycle in real seconds) */
export const DAY_LENGTH = {
  short: 8 * 60, // 8 minutes
  medium: 15 * 60, // 15 minutes
  long: 25 * 60, // 25 minutes
};
export const NIGHT_START = 0.55; // fraction of cycle when night begins

/** Player */
export const PLAYER = {
  maxHp: 40,
  atk: 3,
  def: 0,
  visionDay: 9,
  visionNight: 5,
  moveMs: 140, // real-time step interval
  noiseWalk: 0.15,
  noiseRun: 0.45,
  noiseCombat: 1,
};

/** Junk / materials */
export const MAT = {
  scrap: { id: 'scrap', name: 'Scrap', color: 0xa8a29e, desc: 'Twisted metal. Everything starts here.' },
  wire: { id: 'wire', name: 'Wire', color: 0xfbbf24, desc: 'Copper guts of the old grid.' },
  battery: { id: 'battery', name: 'Battery', color: 0x22c55e, desc: 'Still holds a mean charge.' },
  cloth: { id: 'cloth', name: 'Cloth', color: 0x94a3b8, desc: 'Rags. Bandages. Bad curtains.' },
  chem: { id: 'chem', name: 'Chem', color: 0xa855f7, desc: 'Street pharmacy leftovers.' },
  circuit: { id: 'circuit', name: 'Circuit', color: 0x38bdf8, desc: 'Pre-war board. Mostly not on fire.' },
  food: { id: 'food', name: 'MRE Paste', color: 0xd97706, desc: 'Tastes like regret. Heals a little.' },
};

/** Crafted / gear */
export const GEAR = {
  bandage: { id: 'bandage', name: 'Field Bandage', type: 'consumable', heal: 12, desc: 'Stops the red from winning.' },
  stim: { id: 'stim', name: 'Stimshot', type: 'consumable', heal: 22, desc: 'Heart goes brr. Side effects: everything.' },
  pipe: { id: 'pipe', name: 'Pipe Club', type: 'weapon', atk: 3, desc: 'Diplomacy, District 9 style.' },
  zipgun: { id: 'zipgun', name: 'Zip Gun', type: 'weapon', atk: 4, ranged: true, range: 5, desc: 'One bang away from a lawsuit.' },
  vest: { id: 'vest', name: 'Scrap Vest', type: 'armor', def: 2, desc: 'Road signs and hope.' },
  breach: { id: 'breach', name: 'Breach Kit', type: 'key', desc: 'Cuts the wall. This is the way out.' },
  bedroll: {
    id: 'bedroll',
    name: 'Sleeping Kit',
    type: 'consumable',
    desc: 'Crash away from HQ. Risky after dark.',
  },
};

/**
 * Blueprints — always show exact recipe.
 * Escape requires breach kit.
 */
export const BLUEPRINTS = {
  bandage: {
    id: 'bandage',
    name: 'Field Bandage',
    result: 'bandage',
    needs: { cloth: 2 },
    desc: 'Wrap it. Ignore the smell.',
  },
  stim: {
    id: 'stim',
    name: 'Stimshot',
    result: 'stim',
    needs: { chem: 1, cloth: 1 },
    desc: 'Medical grade… allegedly.',
  },
  pipe: {
    id: 'pipe',
    name: 'Pipe Club',
    result: 'pipe',
    needs: { scrap: 3 },
    desc: 'When words fail, metallurgy.',
  },
  zipgun: {
    id: 'zipgun',
    name: 'Zip Gun',
    result: 'zipgun',
    needs: { scrap: 2, pipe: 0, wire: 1, battery: 1 },
    // pipe is crafted gear not mat - fix: use scrap only path
    desc: 'Point away from face. Mostly.',
  },
  vest: {
    id: 'vest',
    name: 'Scrap Vest',
    result: 'vest',
    needs: { scrap: 4, cloth: 2 },
    desc: 'Fashion is dead. You might not be.',
  },
  breach: {
    id: 'breach',
    name: 'Breach Kit',
    result: 'breach',
    needs: { scrap: 5, wire: 2, battery: 2, circuit: 1 },
    desc: 'THE escape tool. Wall says no. You say boom.',
  },
  bedroll: {
    id: 'bedroll',
    name: 'Sleeping Kit',
    result: 'bedroll',
    needs: { cloth: 3, scrap: 1 },
    desc: 'Sleep away from home base. Craft a few.',
  },
};

// Fix zipgun recipe to materials only
BLUEPRINTS.zipgun.needs = { scrap: 3, wire: 2, battery: 1 };

export const ENEMY = {
  dog: { name: 'Grid Dog', hp: 8, atk: 3, speed: 1, nightOnly: true, color: 0x78716c, xp: 4 },
  thug: { name: 'Gang Runner', hp: 12, atk: 3, speed: 1, color: 0xeab308, xp: 6 },
  enforcer: { name: 'Enforcer', hp: 20, atk: 5, speed: 1, color: 0xef4444, xp: 12 },
  drone: { name: 'Sec-Drone', hp: 10, atk: 4, speed: 1, ranged: true, range: 4, color: 0x38bdf8, xp: 10 },
};

export const HELP_DEFAULT = true;
