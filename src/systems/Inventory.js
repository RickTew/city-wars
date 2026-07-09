import { MAT, GEAR, BLUEPRINTS } from '../config/constants.js';

export class Inventory {
  constructor() {
    this.mats = {}; // id -> count
    this.items = []; // gear instances {id, ...}
    this.weapon = null;
    this.armor = null;
    this.blueprints = new Set(); // known blueprint ids
    // Always know bandage as "street common sense"? No — find them.
  }

  addMat(id, n = 1) {
    this.mats[id] = (this.mats[id] || 0) + n;
  }

  count(id) {
    return this.mats[id] || 0;
  }

  learnBlueprint(id) {
    if (!BLUEPRINTS[id]) return false;
    if (this.blueprints.has(id)) return false;
    this.blueprints.add(id);
    return true;
  }

  hasBlueprint(id) {
    return this.blueprints.has(id);
  }

  /** alias */
  knowsBlueprint(id) {
    return this.hasBlueprint(id);
  }

  canCraft(bpId) {
    const bp = BLUEPRINTS[bpId];
    if (!bp || !this.blueprints.has(bpId)) return false;
    for (const [mat, need] of Object.entries(bp.needs)) {
      if (this.count(mat) < need) return false;
    }
    return true;
  }

  missingFor(bpId) {
    const bp = BLUEPRINTS[bpId];
    if (!bp) return [];
    const miss = [];
    for (const [mat, need] of Object.entries(bp.needs)) {
      const have = this.count(mat);
      if (have < need) {
        const name = MAT[mat]?.name || mat;
        miss.push(`${name} ${have}/${need}`);
      }
    }
    return miss;
  }

  craft(bpId) {
    if (!this.canCraft(bpId)) return null;
    const bp = BLUEPRINTS[bpId];
    for (const [mat, need] of Object.entries(bp.needs)) {
      this.mats[mat] -= need;
      if (this.mats[mat] <= 0) delete this.mats[mat];
    }
    const gear = { ...GEAR[bp.result] };
    if (gear.type === 'weapon') this.weapon = gear;
    else if (gear.type === 'armor') this.armor = gear;
    else this.items.push(gear);
    return gear;
  }

  hasBreach() {
    return this.items.some((i) => i.id === 'breach');
  }

  takeBreach() {
    const i = this.items.findIndex((x) => x.id === 'breach');
    if (i < 0) return false;
    this.items.splice(i, 1);
    return true;
  }

  useConsumable(id, player) {
    const idx = this.items.findIndex((x) => x.id === id);
    if (idx < 0) return null;
    const item = this.items[idx];
    if (item.type !== 'consumable') return null;
    this.items.splice(idx, 1);
    const healed = player ? player.heal(item.heal || 0) : 0;
    return { item, healed };
  }

  countItem(id) {
    return this.items.filter((x) => x.id === id).length;
  }

  /** Spend one stackable kit item (bedroll etc.) */
  spendItem(id) {
    const idx = this.items.findIndex((x) => x.id === id);
    if (idx < 0) return false;
    this.items.splice(idx, 1);
    return true;
  }

  matList() {
    return Object.entries(this.mats).map(([id, n]) => ({
      id,
      n,
      name: MAT[id]?.name || id,
    }));
  }

  summary() {
    const mats = this.matList()
      .map((m) => `${m.name}×${m.n}`)
      .join(' · ');
    const gear = [
      this.weapon?.name,
      this.armor?.name,
      ...this.items.map((i) => i.name),
    ]
      .filter(Boolean)
      .join(' · ');
    return { mats: mats || 'no scrap', gear: gear || 'fists' };
  }
}
