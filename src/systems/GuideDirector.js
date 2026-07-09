/**
 * Hard hand-holding for first three crafts: bandage, bedroll, pipe.
 * Steps set objective text + target tile + story punchlines.
 */
import { CENTER_X, CENTER_Y } from '../config/constants.js';

export const GUIDE_ORDER = [
  {
    id: 'loot1',
    title: 'STEP 1: LOOT',
    body: 'See that gold crate near you?\nClick it. Scavenge. Do not argue with free junk.\n\nI will wait. I am very patient. For now.',
    objective: 'GUIDE: Click the gold LOOT crate near HQ',
    target: 'loot_near',
  },
  {
    id: 'bp_bandage',
    title: 'STEP 2: READ THE CITY',
    body: 'Good. You can follow orders. You might survive the night.\n\nPink tile with a white dot is a BLUEPRINT.\nWalk onto it. Learn Field Bandage.',
    objective: 'GUIDE: Walk onto the pink Bandage blueprint',
    target: 'bp_bandage',
  },
  {
    id: 'cloth',
    title: 'STEP 3: HUNT CLOTH',
    body: 'Bandage needs Cloth x2.\nOpen more gold crates until the hunt list is happy.\n\nOr track it if you checked the box. Either way: cloth.',
    objective: 'GUIDE: Scavenge until you have Cloth x2',
    target: 'need_cloth',
    need: { cloth: 2 },
  },
  {
    id: 'craft_bandage',
    title: 'STEP 4: CRAFT BANDAGE',
    body: 'Purple Street Rig. Click it (or stand on it and hit CRAFT).\nMake Field Bandage.\n\nGreen row means ready. Click it.',
    objective: 'GUIDE: Craft Field Bandage at the purple rig',
    target: 'craft_bandage',
    craft: 'bandage',
  },
  {
    id: 'bp_bedroll',
    title: 'STEP 5: BEDROLL PRINT',
    body: 'Away from HQ you will freeze without a kit.\nFind the Sleeping Kit blueprint (pink near HQ).\nWalk on it.',
    objective: 'GUIDE: Get Sleeping Kit blueprint (pink near HQ)',
    target: 'bp_bedroll',
  },
  {
    id: 'craft_bedroll',
    title: 'STEP 6: MAKE A BEDROLL',
    body: 'Sleeping Kit: Cloth x3 + Scrap x1.\nLoot if you need parts, then CRAFT at the purple rig.\nCarry at least one before you wander.',
    objective: 'GUIDE: Craft Sleeping Kit (cloth x3, scrap x1)',
    target: 'craft_bedroll',
    craft: 'bedroll',
    need: { cloth: 3, scrap: 1 },
  },
  {
    id: 'bp_pipe',
    title: 'STEP 7: GET ANGRY',
    body: 'Fists are cute. Pipe Club is policy.\nFind the Pipe Club blueprint. Walk on pink.',
    objective: 'GUIDE: Get Pipe Club blueprint',
    target: 'bp_pipe',
  },
  {
    id: 'craft_pipe',
    title: 'STEP 8: CRAFT PIPE',
    body: 'Pipe needs Scrap x3.\nCraft it. Feel slightly more employed as a survivor.',
    objective: 'GUIDE: Craft Pipe Club (scrap x3)',
    target: 'craft_pipe',
    craft: 'pipe',
    need: { scrap: 3 },
  },
  {
    id: 'done',
    title: 'YOU ARE ON YOUR OWN',
    body: 'Bandage. Bedroll. Pipe.\nYou can loot, rest, and hit things without me holding your hand.\n\nBreach Kit still waits near the Wall when you are ready.\nNarrator noise continues if you left that box checked.\n\nTry not to die funny.',
    objective: 'OBJECTIVE: Find the BREACH KIT blueprint (pink, near north Wall)',
    target: null,
  },
];

export class GuideDirector {
  constructor(scene) {
    this.scene = scene;
    this.step = 0;
    this.done = false;
  }

  current() {
    return GUIDE_ORDER[this.step] || null;
  }

  /** Call after key actions to advance */
  tick() {
    if (this.done) return null;
    const s = this.current();
    if (!s || s.id === 'done') return null;

    const g = this.scene;
    let advance = false;

    if (s.target === 'loot_near') {
      // any loot scavenged
      if (g._guideLooted) advance = true;
    } else if (s.target === 'bp_bandage') {
      if (g.inv.hasBlueprint('bandage')) advance = true;
    } else if (s.target === 'need_cloth') {
      if (g.inv.count('cloth') >= 2) advance = true;
    } else if (s.target === 'craft_bandage') {
      if (g.inv.countItem('bandage') > 0) advance = true;
    } else if (s.target === 'bp_bedroll') {
      if (g.inv.hasBlueprint('bedroll')) advance = true;
    } else if (s.target === 'craft_bedroll') {
      if (g.inv.countItem('bedroll') > 0) advance = true;
    } else if (s.target === 'bp_pipe') {
      if (g.inv.hasBlueprint('pipe')) advance = true;
    } else if (s.target === 'craft_pipe') {
      if (g.inv.weapon?.id === 'pipe' || g.inv.items.some((i) => i.id === 'pipe')) advance = true;
    }

    if (!advance) return null;

    this.step += 1;
    const next = this.current();
    if (next?.id === 'done') {
      this.done = true;
      g.story.guideDone = true;
      g.story.persist();
    }
    return next;
  }

  resolveTarget() {
    const s = this.current();
    if (!s || !s.target) return null;
    const g = this.scene;
    if (s.target === 'loot_near') {
      return g.lootSpots.find((l) => !l.taken && Math.abs(l.x - CENTER_X) + Math.abs(l.y - CENTER_Y) < 10) || g.nearestLoot();
    }
    if (s.target === 'bp_bandage') return g.bpSpots.find((b) => b.id === 'bandage' && !b.taken) || g.bpSpots.find((b) => b.id === 'bandage');
    if (s.target === 'bp_bedroll') return g.bpSpots.find((b) => b.id === 'bedroll' && !b.taken) || g.bpSpots.find((b) => b.id === 'bedroll');
    if (s.target === 'bp_pipe') return g.bpSpots.find((b) => b.id === 'pipe' && !b.taken) || g.bpSpots.find((b) => b.id === 'pipe');
    if (s.target?.startsWith('craft')) return g.nearestBench();
    if (s.need) return g.nearestLoot();
    return null;
  }

  objectiveText() {
    return this.current()?.objective || null;
  }
}
