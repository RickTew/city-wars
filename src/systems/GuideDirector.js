/**
 * Three quests, full hand-holding with directional guidance.
 * Q1 Gear up (loot stick+hat, equip in BAG, craft bandage)
 * Q2 Fight one dog (with stick equipped)
 * Q3 Sleep at HQ
 */
import { CENTER_X, CENTER_Y } from '../config/constants.js';

export const QUESTS = [
  {
    id: 'q1',
    title: 'QUEST 1: GEAR UP',
    body:
      'Look EAST of you (right on the map).\n\n' +
      'You will see:\n' +
      '- Gold crate (loot)\n' +
      '- Purple-pink boxes (Street Stick + Neon Fedora)\n' +
      '- Purple Street Rig (craft table)\n\n' +
      'Do this in order:\n' +
      '1) Click the gold crate for cloth.\n' +
      '2) Walk onto the stick, then the hat.\n' +
      '3) Open BAG. Click stick (WEAPON) and hat (HEAD).\n' +
      '4) Craft Field Bandage at the purple rig.\n\n' +
      'Top bar shows the next micro-step. I will keep talking until you finish.',
    objective: 'QUEST 1: Loot east, pick up stick + hat, equip in BAG, craft bandage',
  },
  {
    id: 'q2',
    title: 'QUEST 2: FIRST BLOOD',
    body:
      'Nice kit. Stick is equipped. Hat is on. Bandage is in the bag.\n\n' +
      'A Grid Dog just padded in near you (west/south).\n' +
      'Walk next to it. LEFT-CLICK the dog to fight.\n' +
      'Keep clicking until it drops. Stick hits harder than fists.\n\n' +
      'Win this and you earn a nap.',
    objective: 'QUEST 2: Kill the Grid Dog (left-click to fight)',
  },
  {
    id: 'q3',
    title: 'QUEST 3: LIGHTS OUT',
    body:
      'You lived. Barely counts, but I will take it.\n\n' +
      'Go HOME (yellow HQ arrow bottom-left if you wandered).\n' +
      'Stand in the blue HQ courtyard. Press SLEEP.\n' +
      'Free rest here. No Sleeping Kit needed at base.\n\n' +
      'After that, you graduate. Breach Kit still waits north later.',
    objective: 'QUEST 3: Return to HQ and SLEEP',
  },
  {
    id: 'done',
    title: 'YOU ARE ON YOUR OWN',
    body:
      'Three quests down: gear, fight, sleep.\n' +
      'You know BAG, CRAFT, combat clicks, and HQ rest.\n\n' +
      'Narrator cards can keep whispering if you left that on.\n' +
      'Breach Kit blueprint is still pink near the north Wall.\n\n' +
      'Try not to die funny.',
    objective: 'OBJECTIVE: Find BREACH KIT blueprint (pink, north Wall) when ready',
  },
];

/** Micro coach lines when a sub-step completes (so narration never goes quiet). */
const COACH = {
  looted:
    'Crate stripped. Good.\n\n' +
    'Now walk EAST onto the purple-pink STREET STICK box.\n' +
    'Stand on it to pick it up.',
  stick:
    'Street Stick is in your bag.\n\n' +
    'Next: walk onto the NEON FEDORA (one tile further east/south).\n' +
    'Same deal. Stand on it.',
  hat:
    'Hat secured. Style points: illegal.\n\n' +
    'Open BAG (bottom bar).\n' +
    'Click the Street Stick (auto-equips WEAPON).\n' +
    'Click the Neon Fedora (auto-equips HEAD).\n' +
    'Or drag them onto the paper-doll slots.',
  equipped:
    'Loadout locked. ATK should be up from the stick.\n\n' +
    'Stand on the purple STREET RIG (craft table).\n' +
    'Click CRAFT. Make Field Bandage (you already know the recipe).\n' +
    'Need cloth from the crate. You should have enough.',
  bandage: null, // advances to Q2 card instead
  dogDead: null,
  slept: null,
};

export class GuideDirector {
  constructor(scene) {
    this.scene = scene;
    this.quest = 0; // 0,1,2 active; 3 = done card
    this.done = false;
    this.flags = {
      looted: false,
      stick: false,
      hat: false,
      equippedStick: false,
      equippedHat: false,
      bandage: false,
      dogDead: false,
      slept: false,
    };
    /** Last coach key we already showed (avoid spam). */
    this._coached = new Set();
    this._lastObj = '';
  }

  current() {
    return QUESTS[this.quest] || null;
  }

  objectiveText() {
    if (this.done) return QUESTS[3].objective;
    const q = this.current();
    if (!q || q.id === 'done') return QUESTS[3].objective;
    // Sub-progress hints
    if (this.quest === 0) {
      const f = this.flags;
      if (!f.looted) return 'QUEST 1a: Click gold crate EAST of you';
      if (!f.stick) return 'QUEST 1b: Walk EAST onto the Street Stick';
      if (!f.hat) return 'QUEST 1c: Walk onto the Neon Fedora (east)';
      if (!f.equippedStick || !f.equippedHat) {
        return 'QUEST 1d: Open BAG. Equip stick (WEAPON) + hat (HEAD)';
      }
      if (!f.bandage) return 'QUEST 1e: Stand on purple rig. CRAFT Field Bandage';
    }
    if (this.quest === 1) return 'QUEST 2: Left-click the Grid Dog. Fight until it dies';
    if (this.quest === 2) return 'QUEST 3: Stand at HQ (blue). Press SLEEP';
    return q.objective;
  }

  resolveTarget() {
    if (this.done) {
      return this.scene.bpSpots?.find((b) => b.id === 'breach') || null;
    }
    const g = this.scene;
    const f = this.flags;
    if (this.quest === 0) {
      if (!f.looted) {
        return (
          g.lootSpots.find((l) => !l.taken && Math.abs(l.x - CENTER_X) + Math.abs(l.y - CENTER_Y) < 8) ||
          g.lootSpots.find((l) => !l.taken)
        );
      }
      if (!f.stick) return g.gearDrops?.find((d) => d.id === 'stick' && !d.taken);
      if (!f.hat) return g.gearDrops?.find((d) => d.id === 'sexy_hat' && !d.taken);
      if (!f.equippedStick || !f.equippedHat) return { x: g.player.tx, y: g.player.ty };
      if (!f.bandage) return g.nearestBench();
    }
    if (this.quest === 1) {
      return g.guideDog || g.enemies.find((e) => e.kind === 'dog' && e.alive) || null;
    }
    if (this.quest === 2) {
      return { x: CENTER_X, y: CENTER_Y };
    }
    return null;
  }

  /**
   * Recompute flags from world, advance quests, return next popup card or null.
   * Returns either a full QUEST card or a micro COACH card { title, body }.
   */
  tick() {
    if (this.done) return null;
    const g = this.scene;
    const inv = g.inv;
    const f = this.flags;

    f.looted = !!g._guideLooted;
    f.stick = inv.countItem('stick') > 0 || inv.equip?.weapon?.id === 'stick';
    f.hat = inv.countItem('sexy_hat') > 0 || inv.equip?.head?.id === 'sexy_hat';
    f.equippedStick = inv.equip?.weapon?.id === 'stick' || inv.equip?.weapon?.id === 'pipe';
    f.equippedHat = inv.equip?.head?.id === 'sexy_hat';
    f.bandage = inv.countItem('bandage') > 0;
    f.dogDead = !!g._guideDogDead;
    f.slept = !!g._guideSlept;

    // Quest 1 complete?
    if (this.quest === 0) {
      if (f.looted && f.stick && f.hat && f.equippedStick && f.equippedHat && f.bandage) {
        this.quest = 1;
        g.spawnGuideDog?.();
        return QUESTS[1];
      }
      // Micro-coach for each completed sub-step
      const coach = this._maybeCoach();
      if (coach) return coach;
      return null;
    }

    if (this.quest === 1) {
      if (f.dogDead) {
        this.quest = 2;
        return QUESTS[2];
      }
      return null;
    }

    if (this.quest === 2) {
      if (f.slept) {
        this.quest = 3;
        this.done = true;
        g.story.guideDone = true;
        g.story.persist();
        return QUESTS[3];
      }
      return null;
    }

    return null;
  }

  _maybeCoach() {
    const f = this.flags;
    // Order matters: coach the latest completed step once
    const steps = [
      ['looted', f.looted && !f.stick],
      ['stick', f.stick && !f.hat],
      ['hat', f.hat && (!f.equippedStick || !f.equippedHat)],
      ['equipped', f.equippedStick && f.equippedHat && !f.bandage],
    ];
    for (const [key, active] of steps) {
      if (!active) continue;
      if (this._coached.has(key)) return null;
      this._coached.add(key);
      const body = COACH[key];
      if (!body) return null;
      return { title: 'GUIDE', body };
    }
    return null;
  }
}
