/** City Wars - Escape-NY grit + Fallout scrap + cyberpunk-lite */

/** Board tile size in canvas px (DungeonHole-style hybrid target: 64). */
export const TILE = 64;
/** Source art / silhouette design scale (actors drawn for this, then scaled to TILE). */
export const TILE_DESIGN = 32;
export const MAP_W = 96;
export const MAP_H = 96;
export const WORLD_W = MAP_W * TILE;
export const WORLD_H = MAP_H * TILE;
export const CENTER_X = (MAP_W / 2) | 0;
export const CENTER_Y = (MAP_H / 2) | 0;

export const GAME_W = 1280;
export const GAME_H = 720;

export const T = {
  ROAD: 1, // east–west avenue (horizontal center dashes)
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
  GEAR_DROP: 16, // generic world gear (legacy / fallback)
  GEAR_STICK: 17, // Street Stick hike pickup
  GEAR_HAT: 18, // Neon Fedora hike pickup
  ROAD_V: 19, // north–south avenue (vertical center dashes)
  ROAD_X: 20, // intersection (no false single-axis dashes)
};

/** Any asphalt street tile (H / V / X). */
export const ROAD_TILES = new Set([T.ROAD, T.ROAD_V, T.ROAD_X]);

export const WALKABLE = new Set([
  T.ROAD,
  T.ROAD_V,
  T.ROAD_X,
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
  T.GEAR_DROP,
  T.GEAR_STICK,
  T.GEAR_HAT,
]);

export const BLOCKING = new Set([T.BUILDING, T.BARRICADE, T.WATER]);

export const ZONE = { SAFE: 'safe', MID: 'mid', OUTER: 'outer', WALL: 'wall' };
export const ZONE_R = { [ZONE.SAFE]: 14, [ZONE.MID]: 28, [ZONE.OUTER]: 40 };

export const ALERT = { GREEN: 'green', YELLOW: 'yellow', RED: 'red' };

export const DAY_LENGTH = {
  short: 8 * 60,
  medium: 15 * 60,
  long: 25 * 60,
};
export const NIGHT_START = 0.55;

export const PLAYER = {
  maxHp: 40,
  atk: 3,
  def: 0,
  visionDay: 9,
  visionNight: 5,
  moveMs: 140,
  noiseWalk: 0.15,
  noiseRun: 0.45,
  noiseCombat: 1,
};

export const MAT = {
  scrap: { id: 'scrap', name: 'Scrap', color: 0xa8a29e, desc: 'Twisted metal.' },
  wire: { id: 'wire', name: 'Wire', color: 0xfbbf24, desc: 'Copper guts of the old grid.' },
  battery: { id: 'battery', name: 'Battery', color: 0x22c55e, desc: 'Still holds a charge.' },
  cloth: { id: 'cloth', name: 'Cloth', color: 0x94a3b8, desc: 'Rags. Bandages. Bad curtains.' },
  chem: { id: 'chem', name: 'Chem', color: 0xa855f7, desc: 'Street pharmacy leftovers.' },
  circuit: { id: 'circuit', name: 'Circuit', color: 0x38bdf8, desc: 'Pre-war board.' },
  food: { id: 'food', name: 'MRE Paste', color: 0xd97706, desc: 'Tastes like regret.' },
};

/** Equipment slots */
export const SLOT = {
  HEAD: 'head',
  BODY: 'body',
  LEGS: 'legs',
  WEAPON: 'weapon',
  QUICK1: 'quick1',
  QUICK2: 'quick2',
};

/** Consumables that stack in bag / quick slots. */
export const STACKABLE = new Set(['bandage', 'stim', 'mre', 'charge', 'bedroll']);

export const GEAR = {
  stick: {
    id: 'stick',
    name: 'Street Stick',
    type: 'weapon',
    slot: SLOT.WEAPON,
    atk: 2,
    desc: 'Not a bat. Not yet. Better than fists.',
  },
  sexy_hat: {
    id: 'sexy_hat',
    name: 'Neon Fedora',
    type: 'head',
    slot: SLOT.HEAD,
    def: 0,
    sneakBonus: 1,
    desc: 'Looks illegal. Somehow helps you sneak.',
  },
  rags: {
    id: 'rags',
    name: 'Layer Rags',
    type: 'legs',
    slot: SLOT.LEGS,
    def: 0,
    sneakBonus: 0,
    desc: 'Bottom layer. Fashion is dead.',
  },
  jacket: {
    id: 'jacket',
    name: 'Scuffed Jacket',
    type: 'body',
    slot: SLOT.BODY,
    def: 1,
    desc: 'Top layer. Smells like rain and regret.',
  },
  bandage: {
    id: 'bandage',
    name: 'Field Bandage',
    type: 'consumable',
    slot: SLOT.QUICK1,
    heal: 12,
    desc: 'Stops the red from winning.',
  },
  stim: {
    id: 'stim',
    name: 'Stimshot',
    type: 'consumable',
    slot: SLOT.QUICK1,
    heal: 22,
    desc: 'Heart goes brr.',
  },
  mre: {
    id: 'mre',
    name: 'MRE Paste',
    type: 'consumable',
    slot: SLOT.QUICK1,
    heal: 6,
    desc: 'Tastes like regret. Still counts as food.',
  },
  pipe: {
    id: 'pipe',
    name: 'Pipe Club',
    type: 'weapon',
    slot: SLOT.WEAPON,
    atk: 3,
    desc: 'Diplomacy, District 9 style.',
  },
  zipgun: {
    id: 'zipgun',
    name: 'Zip Gun',
    type: 'weapon',
    slot: SLOT.WEAPON,
    atk: 4,
    ranged: true,
    range: 5,
    desc: 'Point away from face. Mostly.',
  },
  vest: {
    id: 'vest',
    name: 'Scrap Vest',
    type: 'armor',
    slot: SLOT.BODY,
    def: 2,
    desc: 'Road signs and hope.',
  },
  charge: {
    id: 'charge',
    name: 'Street Charge',
    type: 'consumable',
    slot: SLOT.QUICK1,
    explosive: true,
    power: 6,
    desc: 'Pin, run, boom. Loud on purpose.',
  },
  breach: {
    id: 'breach',
    name: 'Breach Kit',
    type: 'key',
    slot: null,
    desc: 'Cuts the wall. This is the way out.',
  },
  bedroll: {
    id: 'bedroll',
    name: 'Sleeping Kit',
    type: 'consumable',
    slot: SLOT.QUICK1,
    desc: 'Crash away from HQ. Risky after dark.',
  },
};

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
    desc: 'Medical grade, allegedly.',
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
    needs: { scrap: 3, wire: 2, battery: 1 },
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
    desc: 'THE escape tool.',
  },
  bedroll: {
    id: 'bedroll',
    name: 'Sleeping Kit',
    result: 'bedroll',
    needs: { cloth: 3, scrap: 1 },
    desc: 'Sleep away from home base.',
  },
  rags: {
    id: 'rags',
    name: 'Layer Rags',
    result: 'rags',
    needs: { cloth: 2 },
    desc: 'Something for the legs. Barely.',
  },
  jacket: {
    id: 'jacket',
    name: 'Scuffed Jacket',
    result: 'jacket',
    needs: { cloth: 2, scrap: 2 },
    desc: 'Light body armor from scrap and pride.',
  },
  charge: {
    id: 'charge',
    name: 'Street Charge',
    result: 'charge',
    needs: { scrap: 2, chem: 1, battery: 1 },
    desc: 'Boom Chi approved. Clears a crowd.',
  },
};

export const ENEMY = {
  dog: { name: 'Grid Dog', hp: 8, atk: 3, speed: 1, nightOnly: true, color: 0x78716c, xp: 4 },
  thug: { name: 'Gang Runner', hp: 12, atk: 3, speed: 1, color: 0xeab308, xp: 6 },
  enforcer: { name: 'Enforcer', hp: 20, atk: 5, speed: 1, color: 0xef4444, xp: 12 },
  drone: { name: 'Sec-Drone', hp: 10, atk: 4, speed: 1, ranged: true, range: 4, color: 0x38bdf8, xp: 10 },
};

export const HELP_DEFAULT = true;
