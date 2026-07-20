/** Sleep / ambush (mixin). */
import { ALERT, ENEMY, NIGHT_START, ZONE } from '../../config/constants.js';
import { makeEnemy } from '../../entities/Actor.js';

export const sleepMixin = {
/** HQ courtyard = free rest. Away from base needs Sleeping Kit. */
  isAtHomeBase() {
    return this.zones.manhattan(this.player.tx, this.player.ty) <= 6;
  },

  countBedrolls() {
    return this.inv.countItem('bedroll');
  },

/**
   * SLEEP button / sleep tile.
   * - Day at HQ: short rest (heal, no full day skip)
   * - Night at HQ: sleep to morning free
   * - Away: need Sleeping Kit; night has ambush risk by zone
   */
  doSleep() {
    if (this.mode === 'combat' || this.alert.state === ALERT.RED) {
      this.log("Can't sleep mid-gunfight. Bold strategy. Terrible.");
      return;
    }

    const atHome = this.isAtHomeBase();
    const night = this.dayNight.isNight;
    const kits = this.countBedrolls();

    if (atHome && this.heat?.blocksHomeSleep?.()) {
      this.showPopup(
        'PATROLS ON YOUR BLOCK',
        'Grid heat is too high to sleep at HQ.\n\nPush into the sprawl and let it cool, or stay awake and fight.'
      );
      return;
    }

    if (!atHome) {
      if (kits <= 0) {
        this.showPopup(
          'NO SLEEPING KIT',
          'You’re away from home base.\n\nCraft a Sleeping Kit (cloth×3 + scrap×1) at a Street Rig, or walk back to HQ (follow the home arrow, bottom-left).'
        );
        return;
      }
    }

    // Night outdoors: ambush chance
    if (night && !atHome) {
      const zone = this.zones.getZone(this.player.tx, this.player.ty);
      let risk = 0.1;
      if (zone === ZONE.MID) risk = 0.18;
      if (zone === ZONE.OUTER) risk = 0.28;
      if (zone === ZONE.WALL) risk = 0.4;
      if (Math.random() < risk) {
        if (!atHome) this.inv.spendItem('bedroll');
        this.log('Something sniffs your bedroll… ambush!');
        this.spawnAmbushNearPlayer();
        return;
      }
    }

    if (!atHome) {
      this.inv.spendItem('bedroll');
    }

    let healed = 0;
    let msg = '';
    if (night || atHome) {
      // Full sleep → morning
      this.dayNight.sleepToMorning();
      healed = this.player.heal(
        (atHome ? 14 : 10) + ((Math.random() * 6) | 0) + (this.player.healBonus || 0)
      );
      this.alert.state = ALERT.GREEN;
      const left = this.countBedrolls();
      msg = atHome
        ? `Home base rest.\n\n+${healed} HP. Morning again.\nSafe walls. No kit used.`
        : `Bedroll night under the open grid.\n\n+${healed} HP. Morning.\nSleeping kits left: ${left}`;
    } else {
      // Day rest  -  heal only, small time skip forward but not full night
      healed = this.player.heal(6 + ((Math.random() * 5) | 0));
      this.dayNight.t = Math.min(NIGHT_START - 0.02, this.dayNight.t + 0.08);
      const left = this.countBedrolls();
      msg = atHome
        ? `Day rest at HQ.\n\n+${healed} HP. No kit used.\n(Full sleep to morning works best at night.)`
        : `Day rest on a kit.\n\n+${healed} HP.\nSleeping kits left: ${left}`;
    }

    this.audio.scavenge();
    if (this.isAtHomeBase()) this._guideSlept = true;
    this.refreshHud();
    // Sleep result first; guide Q3 complete card queues behind it
    this.showPopup(night ? 'NIGHT SLEEP' : 'DAY REST', msg, () => {
      this.checkGuide();
    });
  },

  spawnAmbushNearPlayer() {
    const spots = [];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1]]) {
      const x = this.player.tx + dx;
      const y = this.player.ty + dy;
      if (this.walkable(x, y) && !this.actorAt(x, y)) spots.push({ x, y });
    }
    if (!spots.length) {
      this.startCombat(
        this.enemies.find((e) => e.alive && !e._dormant) || makeEnemy(this, this.player.tx + 1, this.player.ty, ENEMY.dog, 'dog'),
        false
      );
      return;
    }
    const s = spots[(Math.random() * spots.length) | 0];
    const kind = this.dayNight.isNight && Math.random() < 0.6 ? 'dog' : 'thug';
    const foe = makeEnemy(this, s.x, s.y, ENEMY[kind], kind);
    this.enemies.push(foe);
    this.startCombat(foe, false);
  },
};
