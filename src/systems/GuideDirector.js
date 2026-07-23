/**
 * Tutorial quests + coach — all copy is CENTRAL (HQ-NET AI).
 * Mechanical steps unchanged; voice is sarcastic helpful dispatch.
 */
import { CENTER_X, CENTER_Y } from '../config/constants.js';
import { hqTitle } from './HqVoice.js';

/** Full quest banners (shown when a quest starts). Keep short. */
export const QUESTS = [
  {
    id: 'q1',
    title: hqTitle('ITEM 1'),
    body:
      'Salvage cache. Gold pulse. EAST of drop.\n' +
      'Walk there before the city notices you thinking.',
    objective: 'Item 1: gold crate EAST (pulse)',
  },
  {
    id: 'q2',
    title: hqTitle('LIVE FIRE'),
    body:
      'A Grid Dog found you. How rare.\n' +
      'Follow the pulse. Tap it. Finish it. Try not to scream into the mic.',
    objective: 'Tap the pulsing Grid Dog',
  },
  {
    id: 'q3',
    title: hqTitle('SHUTDOWN'),
    body:
      'Back to HOME (blue pad). Press SLEEP.\n' +
      'Even meat needs a reboot. Allegedly.',
    objective: 'SLEEP at HQ',
  },
  {
    id: 'done',
    title: hqTitle('LIST OPEN'),
    body:
      'Training complete. Item 5 still unpaid: Breach Kit.\n' +
      'Pink print. North. RED. Then a gold escape pad.\n' +
      'I have already drafted your failure report. Edit it.',
    objective: 'Item 5: BREACH KIT (pink, RED / Wall)',
  },
];

/**
 * Micro-steps after each action — CENTRAL coach strip.
 */
const COACH = {
  looted: {
    title: hqTitle('ITEM 2'),
    body: 'Street Stick. SOUTH. Walk onto the pulse.\nYes, the brown bat-shaped insult to weapons.',
  },
  stick: {
    title: hqTitle('ITEM 3'),
    body: 'Neon Fedora. WEST. Walk onto it.\nFashion is dead. Sneak bonuses are not.',
  },
  hat: {
    title: hqTitle('EQUIP'),
    body: 'Open BAG (gold pulse on the bar).\nTap stick, then hat. Gear on the floor is cosplay.',
  },
  equipped: {
    title: hqTitle('ITEM 4'),
    body:
      'Field Bandage. Purple U = Street Rig.\n' +
      'Stand on it. CRAFT. Cloth×2. Even you can count to two.',
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
      if (!f.looted) return '→ CENTRAL: Item 1 · crate EAST (pulse)';
      if (!f.stick) return '→ CENTRAL: Item 2 · stick SOUTH (pulse)';
      if (!f.hat) return '→ CENTRAL: Item 3 · hat WEST (pulse)';
      if (!f.equippedStick || !f.equippedHat) return '→ CENTRAL: BAG · equip stick, then hat';
      if (!f.bandage) return '→ CENTRAL: Item 4 · CRAFT bandage at purple U';
    }
    if (this.quest === 1) return '→ CENTRAL: Grid Dog · tap it. Finish it.';
    if (this.quest === 2) return '→ CENTRAL: HOME · press SLEEP';
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
