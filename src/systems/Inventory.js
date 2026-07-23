import { MAT, GEAR, BLUEPRINTS, SLOT, STACKABLE } from '../config/constants.js';

let _uid = 1;
function newUid() {
  return `it_${_uid++}`;
}

/** Keep module uid counter above any loaded item uids (prevents equip/find collisions). */
export function resyncInventoryUids(inv) {
  let max = 0;
  const consider = (it) => {
    if (!it?.uid) return;
    const m = /^it_(\d+)$/.exec(it.uid);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  };
  for (const i of inv?.items || []) consider(i);
  for (const s of Object.values(inv?.equip || {})) consider(s);
  if (max >= _uid) _uid = max + 1;
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
    if (STACKABLE.has(base.id)) {
      const existing = this.items.find((i) => i.id === base.id);
      if (existing) {
        existing.qty = (existing.qty || 1) + 1;
        return existing;
      }
      const item = { ...base, uid: newUid(), qty: 1 };
      this.items.push(item);
      return item;
    }
    const item = { ...base, uid: newUid() };
    this.items.push(item);
    return item;
  }

  itemQty(item) {
    return item?.qty || 1;
  }

  /** After craft: slide consumables into empty / matching quick slots. */
  autoEquipConsumable(id) {
    const def = GEAR[id];
    if (!def) return;
    const isKit = def.type === 'consumable' || id === 'bedroll';
    if (!isKit) return;

    for (const slot of [SLOT.QUICK1, SLOT.QUICK2]) {
      const eq = this.equip[slot];
      if (eq?.id === id) {
        eq.qty = (eq.qty || 1) + 1;
        this._consumeOneFromBag(id);
        return;
      }
    }

    for (const slot of [SLOT.QUICK1, SLOT.QUICK2]) {
      if (this.equip[slot]) continue;
      const bagIdx = this.items.findIndex((i) => i.id === id);
      if (bagIdx < 0) return;
      const stack = this.items[bagIdx];
      if ((stack.qty || 1) <= 1) {
        this.items.splice(bagIdx, 1);
        this.equip[slot] = { ...stack, qty: 1 };
      } else {
        stack.qty--;
        this.equip[slot] = { ...def, uid: newUid(), qty: 1 };
      }
      return;
    }
  }

  _consumeOneFromBag(id) {
    const idx = this.items.findIndex((i) => i.id === id);
    if (idx < 0) return;
    const stack = this.items[idx];
    if ((stack.qty || 1) <= 1) this.items.splice(idx, 1);
    else stack.qty--;
  }

  _splitOneFromBag(id) {
    const idx = this.items.findIndex((i) => i.id === id);
    if (idx < 0) return null;
    const stack = this.items[idx];
    if ((stack.qty || 1) <= 1) {
      this.items.splice(idx, 1);
      return { ...stack, qty: 1 };
    }
    stack.qty--;
    return { ...GEAR[id], uid: newUid(), qty: 1 };
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

  /**
   * @param {string} bpId
   * @param {{ craftBonus?: number }} [opts] craftBonus = chance per point to refund 1 spent mat
   */
  craft(bpId, opts = {}) {
    if (!this.canCraft(bpId)) return null;
    const bp = BLUEPRINTS[bpId];
    const spent = [];
    for (const [mat, need] of Object.entries(bp.needs)) {
      this.mats[mat] -= need;
      if (this.mats[mat] <= 0) delete this.mats[mat];
      for (let i = 0; i < need; i++) spent.push(mat);
    }
    // Scrapwright / Static / Needle: refund a spent mat sometimes
    const bonus = opts.craftBonus || 0;
    let refunded = null;
    if (bonus > 0 && spent.length) {
      for (let i = 0; i < bonus; i++) {
        if (Math.random() < 0.45) {
          const mat = spent[(Math.random() * spent.length) | 0];
          this.addMat(mat, 1);
          refunded = mat;
        }
      }
    }
    const gear = this.addItem(bp.result);
    if (STACKABLE.has(bp.result)) this.autoEquipConsumable(bp.result);
    return { gear, refunded };
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
    let n = 0;
    for (const i of this.items) {
      if (i.id === id) n += i.qty || 1;
    }
    for (const s of Object.values(this.equip)) {
      if (s?.id === id) n += s.qty || 1;
    }
    return n;
  }

  spendItem(id) {
    const idx = this.items.findIndex((x) => x.id === id);
    if (idx >= 0) {
      const stack = this.items[idx];
      if ((stack.qty || 1) <= 1) this.items.splice(idx, 1);
      else stack.qty--;
      return true;
    }
    for (const slot of [SLOT.QUICK1, SLOT.QUICK2]) {
      const eq = this.equip[slot];
      if (eq?.id === id) {
        if ((eq.qty || 1) <= 1) this.equip[slot] = null;
        else eq.qty--;
        return true;
      }
    }
    return false;
  }

  /**
   * Pull a consumable by id from bag or quick slots (does not apply effects).
   * @returns {{ item: object, from: string } | null}
   */
  takeConsumable(id) {
    const idx = this.items.findIndex((x) => x.id === id);
    if (idx >= 0) {
      const stack = this.items[idx];
      let item;
      if ((stack.qty || 1) <= 1) {
        item = stack;
        this.items.splice(idx, 1);
      } else {
        stack.qty--;
        item = { ...stack, uid: newUid(), qty: 1 };
      }
      return { item, from: 'bag' };
    }
    for (const slot of [SLOT.QUICK1, SLOT.QUICK2]) {
      const eq = this.equip[slot];
      if (eq?.id === id) {
        let item;
        if ((eq.qty || 1) <= 1) {
          item = eq;
          this.equip[slot] = null;
        } else {
          eq.qty--;
          item = { ...eq, uid: newUid(), qty: 1 };
        }
        return { item, from: slot };
      }
    }
    return null;
  }

  useConsumable(id, player) {
    // From bag or quick slots. Heal kits only (charges use takeConsumable).
    const pulled = this.takeConsumable(id);
    if (!pulled) return null;
    const { item } = pulled;
    if (item.type !== 'consumable' || !item.heal) {
      // put back if not a heal kit
      if (pulled.from === 'bag') this.items.push(item);
      else this.equip[pulled.from] = item;
      return null;
    }
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
    if (bagIdx >= 0) {
      const stack = this.items[bagIdx];
      if (STACKABLE.has(stack.id) && (stack.qty || 1) > 1 && isKit) {
        stack.qty--;
        item = { ...stack, uid: newUid(), qty: 1 };
      } else {
        this.items.splice(bagIdx, 1);
      }
    }
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

  /** Ready recipes first; Breach Kit pinned near top. */
  sortedBlueprints() {
    return [...this.blueprints].sort((a, b) => {
      const ra = this.canCraft(a) ? 0 : 1;
      const rb = this.canCraft(b) ? 0 : 1;
      if (ra !== rb) return ra - rb;
      if (a === 'breach') return -1;
      if (b === 'breach') return 1;
      return (BLUEPRINTS[a]?.name || a).localeCompare(BLUEPRINTS[b]?.name || b);
    });
  }

  /** Per-material progress for a blueprint (craft UI + hunt panel). */
  matProgress(bpId) {
    const bp = BLUEPRINTS[bpId];
    if (!bp) return [];
    return Object.entries(bp.needs).map(([m, need]) => ({
      id: m,
      name: MAT[m]?.name || m,
      have: this.count(m),
      need,
      color: MAT[m]?.color || 0x94a3b8,
    }));
  }
}
