/**
 * Post-tutorial escape arc — staged beats so the run has shape after the guide ends.
 */
import { CENTER_X, CENTER_Y, ZONE } from '../config/constants.js';

export const ESCAPE_QUESTS = [
  {
    id: 'e0',
    title: 'LEAVE THE BUBBLE',
    body: 'HQ is a cage with good Wi-Fi.\nPush into Mid Sprawl. The Wall does not sleep.',
    objective: 'Reach MID SPRAWL (leave the safe ring)',
  },
  {
    id: 'e1',
    title: 'WALL SCHEMATIC',
    body: 'Pink landmark north. That print is your ticket.\nFollow the pulse. Grab the Breach blueprint.',
    objective: 'Find BREACH KIT blueprint (pink, north Wall)',
  },
  {
    id: 'e2',
    title: 'BUILD THE KEY',
    body: 'Scavenge gold crates. Purple bench. Craft the Breach Kit.\nHeat rises while you work.',
    objective: 'Craft BREACH KIT at purple bench',
  },
  {
    id: 'e3',
    title: 'BREAK OUT',
    body: 'Gold pad on the map edge. Kit in bag. One click and you are gone.',
    objective: 'Reach gold ESCAPE pad with Breach Kit',
  },
];

export class EscapeDirector {
  constructor(scene) {
    this.scene = scene;
    this.quest = 0;
    this.done = false;
    this.flags = {
      leftSafe: false,
      breachBp: false,
      breachCrafted: false,
    };
  }

  active() {
    const g = this.scene.guide;
    return g?.done && !this.done;
  }

  current() {
    return ESCAPE_QUESTS[this.quest] || null;
  }

  objectiveText() {
    if (this.done) return '';
    const f = this.flags;
    if (this.quest === 0 && !f.leftSafe) return '→ Leave HQ safe ring into MID SPRAWL';
    if (this.quest === 1 && !f.breachBp) return '→ Find BREACH blueprint (pink, north Wall)';
    if (this.quest === 2 && !f.breachCrafted) {
      const miss = this.scene.inv.missingFor('breach').join(', ');
      if (miss) return `→ Scavenge for Breach Kit (${miss})`;
      return '→ Craft BREACH KIT at purple bench';
    }
    if (this.quest === 3) return '→ Gold ESCAPE pad on map edge';
    return ESCAPE_QUESTS[this.quest]?.objective || '';
  }

  resolveTarget() {
    const g = this.scene;
    const f = this.flags;
    if (this.quest === 0 && !f.leftSafe) {
      return { x: CENTER_X, y: Math.max(4, CENTER_Y - 20) };
    }
    if (this.quest === 1 && !f.breachBp) {
      return g.bpSpots?.find((b) => b.id === 'breach' && !b.taken) || { x: CENTER_X, y: 5 };
    }
    if (this.quest === 2 && !f.breachCrafted) {
      if (!g.inv.canCraft('breach') && !g.inv.hasBreach()) {
        return g.nearestLoot() || g.nearestBench();
      }
      return g.nearestBench() || { ui: 'craft' };
    }
    if (this.quest === 3) {
      return g.escapePads?.[0] || null;
    }
    return null;
  }

  tick() {
    if (this.done || !this.scene.guide?.done) return null;
    if (!this._started) {
      this._started = true;
      return ESCAPE_QUESTS[0];
    }
    const g = this.scene;
    const inv = g.inv;
    const f = this.flags;
    const zone = g.zones.getZone(g.player.tx, g.player.ty);

    f.leftSafe = f.leftSafe || zone !== ZONE.SAFE;
    f.breachBp = f.breachBp || inv.hasBlueprint('breach');
    f.breachCrafted =
      f.breachCrafted || inv.hasBreach() || inv.items.some((i) => i.id === 'breach');

    if (this.quest === 0 && f.leftSafe) {
      this.quest = 1;
      return ESCAPE_QUESTS[1];
    }
    if (this.quest === 1 && f.breachBp) {
      this.quest = 2;
      return ESCAPE_QUESTS[2];
    }
    if (this.quest === 2 && f.breachCrafted) {
      this.quest = 3;
      return ESCAPE_QUESTS[3];
    }
    if (this.quest === 3 && f.breachCrafted) {
      // Stay on quest 3 until escape; mark done when player wins (scene handles)
    }
    return null;
  }

  markEscaped() {
    this.done = true;
    this.quest = ESCAPE_QUESTS.length;
  }
}
