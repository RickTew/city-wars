import { MAT, GEAR, BLUEPRINTS, SLOT } from '../config/constants.js';

let _uid = 1;
function uid() {
  return `it_${_uid++}`;
}

export class Inventory {
  constructor() {
    this.mats = {};
    /** Bag items: { uid, id, ...gear fields } */
    this.items = [];
    /** Equipped by slot */
    this.equip = {
      [SLOT.HEAD]: null,
      [SLOT.BODY]: null,
      [SLOT.LEGS]: null,
      [SLOT.WEAPON]: null,
      [SLOT.QUICK1]: null,
      [SLOT.QUICK2]: null,
    };
    this.blueprints = new Set();
  }

  /** Back-compat */
  get weapon() {
    return this.equip[SLOT.WEAPON];
  }
  get armor() {
    return this.equip[SLOT.BODY];
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

  addItem(gearIdOrObj) {
    const base = typeof gearIdOrObj === 'string' ? GEAR[gearIdOrObj] : gearIdOrObj;
    if (!base) return null;
    const item = { ...base, uid: uid() };
    this.items.push(item);
    return item;
  }

  findByUid(u) {
    return this.items.find((i) => i.uid === u) || Object.values(this.equip).find((i) => i?.uid === u);
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
      if (have < need) miss.push(`${MAT[mat]?.name || mat} ${have}/${need}`);
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
    const gear = this.addItem(bp.result);
    return gear;
  }

  hasBreach() {
    return this.items.some((i) => i.id === 'breach') || false;
  }

  takeBreach() {
    const i = this.items.findIndex((x) => x.id === 'breach');
    if (i < 0) return false;
    this.items.splice(i, 1);
    return true;
  }

  countItem(id) {
    let n = this.items.filter((x) => x.id === id).length;
    for (const s of Object.values(this.equip)) {
      if (s?.id === id) n += 1;
    }
    return n;
  }

  spendItem(id) {
    // Prefer bag, then quick slots
    const idx = this.items.findIndex((x) => x.id === id);
    if (idx >= 0) {
      this.items.splice(idx, 1);
      return true;
    }
    for (const slot of [SLOT.QUICK1, SLOT.QUICK2]) {
      if (this.equip[slot]?.id === id) {
        this.equip[slot] = null;
        return true;
      }
    }
    return false;
  }

  useConsumable(id, player) {
    // From bag or quick slots
    let item = null;
    let from = null;
    const idx = this.items.findIndex((x) => x.id === id);
    if (idx >= 0) {
      item = this.items[idx];
      from = 'bag';
    } else {
      for (const slot of [SLOT.QUICK1, SLOT.QUICK2]) {
        if (this.equip[slot]?.id === id) {
          item = this.equip[slot];
          from = slot;
          break;
        }
      }
    }
    if (!item || item.type !== 'consumable' || !item.heal) return null;
    if (from === 'bag') this.items.splice(this.items.findIndex((x) => x.uid === item.uid), 1);
    else this.equip[from] = null;
    const healed = player ? player.heal(item.heal || 0) : 0;
    return { item, healed };
  }

  /**
   * Equip item by uid into its natural slot, or explicit slot.
   * Unequips previous into bag.
   * Consumables / bedroll: click-equip prefers an empty QUICK1/QUICK2.
   */
  equipItem(uid, slotOverride = null) {
    const bagIdx = this.items.findIndex((i) => i.uid === uid);
    let item = bagIdx >= 0 ? this.items[bagIdx] : null;
    let fromSlot = null;
    if (!item) {
      for (const [slot, it] of Object.entries(this.equip)) {
        if (it?.uid === uid) {
          item = it;
          fromSlot = slot;
          break;
        }
      }
    }
    if (!item) return { ok: false, reason: 'missing' };

    let slot = slotOverride || item.slot;
    // Kits: auto-pick free quick slot when not dragging to a specific one
    const isKit = item.type === 'consumable' || item.id === 'bedroll';
    if (isKit && !slotOverride) {
      if (!this.equip[SLOT.QUICK1]) slot = SLOT.QUICK1;
      else if (!this.equip[SLOT.QUICK2]) slot = SLOT.QUICK2;
      else slot = SLOT.QUICK1; // both full → swap QUICK1
    }
    if (!slot || !Object.prototype.hasOwnProperty.call(this.equip, slot)) {
      return { ok: false, reason: 'no_slot' };
    }
    // Quick slots accept consumables / bedroll
    if ((slot === SLOT.QUICK1 || slot === SLOT.QUICK2) && !isKit) {
      return { ok: false, reason: 'quick_only_kits' };
    }
    // Slot type checks (skip for kits going to quick)
    if (slot === SLOT.WEAPON && item.slot !== SLOT.WEAPON) return { ok: false, reason: 'not_weapon' };
    if (slot === SLOT.HEAD && item.slot !== SLOT.HEAD) return { ok: false, reason: 'not_head' };
    if (slot === SLOT.BODY && item.slot !== SLOT.BODY) return { ok: false, reason: 'not_body' };
    if (slot === SLOT.LEGS && item.slot !== SLOT.LEGS) return { ok: false, reason: 'not_legs' };

    // Remove from current place
    if (bagIdx >= 0) this.items.splice(bagIdx, 1);
    if (fromSlot) this.equip[fromSlot] = null;

    // Swap previous out to bag
    const prev = this.equip[slot];
    if (prev) this.items.push(prev);
    this.equip[slot] = item;
    return { ok: true, item, prev };
  }

  unequip(slot) {
    const item = this.equip[slot];
    if (!item) return null;
    this.equip[slot] = null;
    this.items.push(item);
    return item;
  }

  totalAtk(base) {
    let a = base;
    if (this.equip[SLOT.WEAPON]) a += this.equip[SLOT.WEAPON].atk || 0;
    return a;
  }

  totalDef(base) {
    let d = base;
    for (const s of [SLOT.HEAD, SLOT.BODY, SLOT.LEGS]) {
      if (this.equip[s]) d += this.equip[s].def || 0;
    }
    return d;
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
      .map((m) => `${m.name}x${m.n}`)
      .join(' · ');
    const gear = [
      this.equip[SLOT.WEAPON]?.name,
      this.equip[SLOT.HEAD]?.name,
      this.equip[SLOT.BODY]?.name,
      ...this.items.map((i) => i.name),
    ]
      .filter(Boolean)
      .join(' · ');
    return { mats: mats || 'no scrap', gear: gear || 'fists' };
  }
}
