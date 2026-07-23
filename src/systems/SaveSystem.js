/**
 * localStorage save / continue for City Wars.
 * Key versioned so we can break format cleanly later.
 */
import { ENEMY, T } from '../config/constants.js';
import { makeEnemy } from '../entities/Actor.js';
import { resyncInventoryUids } from './Inventory.js';

const KEY = 'city_wars_save_v1';

export class SaveSystem {
  static hasSave() {
    try {
      return !!localStorage.getItem(KEY);
    } catch {
      return false;
    }
  }

  static clear() {
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
  }

  static peek() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  /** Snapshot serializable state from a live GameScene. */
  static serialize(scene) {
    const inv = scene.inv;
    const equip = {};
    for (const [k, v] of Object.entries(inv.equip || {})) {
      equip[k] = v ? { ...v } : null;
    }
    return {
      v: 1,
      savedAt: Date.now(),
      characterId: scene.char?.id || scene.registry.get('characterId'),
      dayLength: scene.registry.get('dayLength') || 'medium',
      narratorOn: scene.story?.narratorOn !== false,
      tx: scene.player.tx,
      ty: scene.player.ty,
      hp: scene.player.hp,
      maxHp: scene.player.maxHp,
      baseAtk: scene.player.baseAtk,
      baseDef: scene.player.baseDef,
      day: {
        t: scene.dayNight.t,
        day: scene.dayNight.day,
        daySeconds: scene.dayNight.daySeconds,
      },
      mats: { ...inv.mats },
      items: inv.items.map((i) => ({ ...i })),
      equip,
      blueprints: [...inv.blueprints],
      guide: {
        quest: scene.guide?.quest ?? 0,
        done: !!scene.guide?.done,
        flags: { ...(scene.guide?.flags || {}) },
        _guideLooted: !!scene._guideLooted,
        _guideDogDead: !!scene._guideDogDead,
        _guideSlept: !!scene._guideSlept,
      },
      escape: {
        quest: scene.escape?.quest ?? 0,
        done: !!scene.escape?.done,
        flags: { ...(scene.escape?.flags || {}) },
        started: !!scene.escape?._started,
      },
      heat: scene.heat?.serialize?.() || null,
      runStats: {
        kills: 0,
        maxHeat: 0,
        crafts: 0,
        startedAt: Date.now(),
        ...(scene.runStats || {}),
      },
      firstLootDone: !!scene._firstLootDone,
      story: {
        guideDone: !!scene.story?.guideDone,
        seen: [...(scene.story?.seen || [])],
        crafts: [...(scene.story?.craftsDone || [])],
      },
      lootTaken: (scene.lootSpots || []).map((l) => !!l.taken),
      gearTaken: (scene.gearDrops || []).map((d) => !!d.taken),
      bpTaken: (scene.bpSpots || []).map((b) => !!b.taken),
      progression: scene.progression?.serialize?.() || { xp: 0, level: 1 },
      huntList: (scene.huntList || []).map((h) => ({ ...h, needs: { ...h.needs } })),
      enemies: (scene.enemies || [])
        .filter((e) => e.alive)
        .slice(0, 70)
        .map((e) => ({
          tx: e.tx,
          ty: e.ty,
          kind: e.kind,
          hp: e.hp,
          nightOnly: !!e.nightOnly,
          // Guide dog must survive save/load mid-tutorial (quest 1)
          isGuideDog: !!(e === scene.guideDog || e._isGuideDog),
        })),
    };
  }

  static save(scene) {
    try {
      const data = this.serialize(scene);
      localStorage.setItem(KEY, JSON.stringify(data));
      return true;
    } catch (e) {
      console.warn('Save failed', e);
      return false;
    }
  }

  /**
   * Apply save onto an already-created GameScene (after map + player exist).
   * @returns {boolean}
   */
  static apply(scene, data) {
    if (!data || data.v !== 1) return false;
    try {
      const inv = scene.inv;
      inv.mats = { ...(data.mats || {}) };
      inv.items = (data.items || []).map((i) => ({ ...i, qty: i.qty || 1 }));
      inv.blueprints = new Set(data.blueprints || []);
      inv.equip = {
        head: null,
        body: null,
        legs: null,
        weapon: null,
        quick1: null,
        quick2: null,
      };
      for (const k of Object.keys(inv.equip)) {
        if (data.equip?.[k]) inv.equip[k] = { ...data.equip[k], qty: data.equip[k].qty || 1 };
      }
      resyncInventoryUids(inv);

      scene.player.hp = data.hp ?? scene.player.hp;
      scene.player.maxHp = data.maxHp ?? scene.player.maxHp;
      scene.player.baseAtk = data.baseAtk ?? scene.player.baseAtk;
      scene.player.baseDef = data.baseDef ?? scene.player.baseDef;
      scene.player.setTile(data.tx, data.ty, false);

      if (data.day) {
        scene.dayNight.t = data.day.t ?? 0;
        scene.dayNight.day = data.day.day ?? 1;
        if (data.day.daySeconds) scene.dayNight.daySeconds = data.day.daySeconds;
      }

      if (scene.guide && data.guide) {
        scene.guide.quest = data.guide.quest ?? 0;
        scene.guide.done = !!data.guide.done;
        Object.assign(scene.guide.flags, data.guide.flags || {});
        scene._guideLooted = !!data.guide._guideLooted;
        scene._guideDogDead = !!data.guide._guideDogDead;
        scene._guideSlept = !!data.guide._guideSlept;
      }
      if (scene.escape && data.escape) {
        scene.escape.quest = data.escape.quest ?? 0;
        scene.escape.done = !!data.escape.done;
        Object.assign(scene.escape.flags, data.escape.flags || {});
        scene.escape._started = !!data.escape.started;
      }
      if (scene.heat && data.heat) scene.heat.load(data.heat);
      if (data.runStats) {
        scene.runStats = {
          kills: 0,
          maxHeat: 0,
          crafts: 0,
          startedAt: Date.now(),
          ...data.runStats,
        };
      }
      scene._firstLootDone = !!data.firstLootDone;
      if (scene.story && data.story) {
        scene.story.guideDone = !!data.story.guideDone;
        scene.story.seen = new Set(data.story.seen || []);
        scene.story.craftsDone = new Set(data.story.crafts || []);
        scene.story.narratorOn = data.narratorOn !== false;
        scene.story.persist();
      }

      const paintAlley = (x, y) => {
        scene.ground[y][x] = T.ALLEY;
        if (scene.gLayer) scene.gLayer.putTileAt(T.ALLEY, x, y);
      };

      (data.lootTaken || []).forEach((taken, i) => {
        if (scene.lootSpots[i] && taken) {
          scene.lootSpots[i].taken = true;
          paintAlley(scene.lootSpots[i].x, scene.lootSpots[i].y);
        }
      });
      (data.gearTaken || []).forEach((taken, i) => {
        if (scene.gearDrops[i] && taken) {
          scene.gearDrops[i].taken = true;
          paintAlley(scene.gearDrops[i].x, scene.gearDrops[i].y);
        }
      });
      (data.bpTaken || []).forEach((taken, i) => {
        if (scene.bpSpots[i] && taken) {
          scene.bpSpots[i].taken = true;
          paintAlley(scene.bpSpots[i].x, scene.bpSpots[i].y);
        }
      });

      scene.progression?.load?.(data.progression);
      scene.huntList = (data.huntList || []).map((h) => ({ ...h, needs: { ...h.needs } }));

      // enemies array present (even empty) is authoritative — never keep the fresh spawn pack
      if (Array.isArray(data.enemies)) {
        for (const e of scene.enemies) {
          try {
            e.destroy();
          } catch {
            /* */
          }
        }
        scene.enemies = [];
        scene.guideDog = null;
        for (const se of data.enemies) {
          const def = ENEMY[se.kind] || ENEMY.thug;
          const e = makeEnemy(scene, se.tx, se.ty, def, se.kind || 'thug');
          e.hp = se.hp ?? e.maxHp;
          e.nightOnly = !!se.nightOnly;
          e._dormant = !!se.nightOnly && !scene.dayNight.isNight;
          if (se.isGuideDog) {
            e._isGuideDog = true;
            e.nightOnly = false;
            e._dormant = false;
            scene.guideDog = e;
          }
          e.refreshHp();
          scene.enemies.push(e);
        }
      }

      // Mid-tutorial load: ensure quest-1 dog exists if not already restored
      if (
        scene.guide &&
        !scene.guide.done &&
        scene.guide.quest === 1 &&
        !scene._guideDogDead &&
        !scene.guideDog?.alive
      ) {
        scene.spawnGuideDog?.();
      }

      scene.snapCameraToPlayer?.();
      scene.updateObjective?.();
      scene.updateFow?.();
      scene.refreshHud?.();
      scene.refreshHuntHud?.();
      return true;
    } catch (e) {
      console.warn('Load apply failed', e);
      return false;
    }
  }
}
