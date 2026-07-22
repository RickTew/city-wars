/**
 * Three quests as short one-step prompts.
 * Hikes spread targets so the player learns the map.
 * Scene pulses the current target tile / button (no extra gold triangle).
 */
import { CENTER_X, CENTER_Y } from '../config/constants.js';

/** Full quest banners (shown when a quest starts). Keep short. */
export const QUESTS = [
  {
    id: 'q1',
    title: 'QUEST 1',
    body: 'Follow the gold pulse.\nTap the gold crate EAST of HQ.',
    objective: 'Gold crate east (follow gold pulse)',
  },
  {
    id: 'q2',
    title: 'QUEST 2',
    body: 'A Grid Dog is near. Follow the gold pulse.\nTap the dog. Fight until it drops.',
    objective: 'Tap the pulsing Grid Dog',
  },
  {
    id: 'q3',
    title: 'QUEST 3',
    body: 'Back to HQ (blue pad).\nFollow gold. Press SLEEP.',
    objective: 'SLEEP at HQ',
  },
  {
    id: 'done',
    title: 'YOU ARE FREE',
    body: 'Gear. Fight. Sleep. You got it.\nBreach Kit is pink, north when ready.',
    objective: 'Find BREACH KIT (pink, north Wall)',
  },
];

/**
 * Micro-steps after each action.
 * Shown as sticky coach banner (not a blink toast).
 */
const COACH = {
  looted: {
    title: 'NEXT',
    body: 'Hike SOUTH. Walk onto the pulsing stick.',
  },
  stick: {
    title: 'NEXT',
    body: 'Hike WEST. Walk onto the pulsing hat.',
  },
  hat: {
    title: 'NEXT',
    body: 'Open BAG on the bottom bar (gold pulse).\nTap the stick, then the hat to equip.',
  },
  equipped: {
    title: 'NEXT',
    body: 'HQ workbench = purple U tile (Street Rig).\nStand next to it, open CRAFT, make Field Bandage.',
  },
};

export class GuideDirector {
  constructor(scene) {
    this.scene = scene;
    this.quest = 0;
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
    this._coached = new Set();
  }

  current() {
    return QUESTS[this.quest] || null;
  }

  /** Short top-bar line for the active micro-step only. */
  objectiveText() {
    if (this.done) return QUESTS[3].objective;
    const f = this.flags;
    if (this.quest === 0) {
      if (!f.looted) return '→ Gold crate EAST (follow gold pulse)';
      if (!f.stick) return '→ Stick SOUTH (follow gold pulse)';
      if (!f.hat) return '→ Hat WEST (follow gold pulse)';
      if (!f.equippedStick || !f.equippedHat) return '→ Open BAG. Equip stick, then hat';
      if (!f.bandage) return '→ Purple U workbench. CRAFT Field Bandage';
    }
    if (this.quest === 1) return '→ Tap the pulsing Grid Dog';
    if (this.quest === 2) return '→ HQ. Press SLEEP';
    return QUESTS[this.quest]?.objective || '';
  }

  /**
   * Current world/UI target for pulse + marker.
   * { x, y } tiles, or { ui: 'bag'|'craft'|'sleep' }, or actor with tx/ty.
   */
  resolveTarget() {
    if (this.done) {
      return this.scene.bpSpots?.find((b) => b.id === 'breach') || null;
    }
    const g = this.scene;
    const f = this.flags;
    if (this.quest === 0) {
      if (!f.looted) {
        return (
          g.lootSpots.find((l) => l.guide && !l.taken) ||
          g.lootSpots.find((l) => !l.taken)
        );
      }
      if (!f.stick) return g.gearDrops?.find((d) => d.id === 'stick' && !d.taken);
      if (!f.hat) return g.gearDrops?.find((d) => d.id === 'sexy_hat' && !d.taken);
      if (!f.equippedStick || !f.equippedHat) return { ui: 'bag' };
      if (!f.bandage) {
        // Pulse craft button AND world bench (prefer bench so they walk there)
        return g.nearestBench() || { ui: 'craft' };
      }
    }
    if (this.quest === 1) {
      return g.guideDog || g.enemies.find((e) => e.kind === 'dog' && e.alive) || null;
    }
    if (this.quest === 2) {
      // Prefer HQ tile pulse; if already home, pulse SLEEP button
      const atHome = g.isAtHomeBase?.();
      if (atHome) return { ui: 'sleep' };
      return { x: CENTER_X, y: CENTER_Y };
    }
    return null;
  }

  /** Quest 0 hand-hold: no random fights until bandage craft done. */
  isHandhold() {
    return !this.done && this.quest === 0;
  }

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

    if (this.quest === 0) {
      if (f.looted && f.stick && f.hat && f.equippedStick && f.equippedHat && f.bandage) {
        this.quest = 1;
        g.spawnGuideDog?.();
        return QUESTS[1];
      }
      return this._maybeCoach();
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
      return COACH[key] || null;
    }
    return null;
  }
}
