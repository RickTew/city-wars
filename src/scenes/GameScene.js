import Phaser from 'phaser';
import {
  ALERT,
  BLOCKING,
  BLUEPRINTS,
  CENTER_X,
  CENTER_Y,
  DAY_LENGTH,
  DEFAULT_ZOOM,
  ENEMY,
  HELP_DEFAULT,
  MAP_H,
  MAP_W,
  MAT,
  NIGHT_START,
  PLAYER,
  STACKABLE,
  T,
  TILE,
  WALKABLE,
  WORLD_H,
  WORLD_W,
} from '../config/constants.js';
import { makeEnemy, makePlayer } from '../entities/Actor.js';
import { AlertSystem } from '../systems/AlertSystem.js';
import { AudioBus } from '../systems/AudioBus.js';
import { CityGenerator } from '../systems/CityGenerator.js';
import { DayNight } from '../systems/DayNight.js';
import { HelpDirector } from '../systems/HelpDirector.js';
import { Inventory } from '../systems/Inventory.js';
import { findPath } from '../systems/Pathfinding.js';
import { ZoneManager } from '../systems/ZoneManager.js';
import { getCharacter } from '../config/characters.js';
import { StoryDirector } from '../systems/StoryDirector.js';
import { GuideDirector } from '../systems/GuideDirector.js';
import { EscapeDirector } from '../systems/EscapeDirector.js';
import { HeatSystem } from '../systems/HeatSystem.js';
import { EquipUI } from '../systems/EquipUI.js';
import { VFX } from '../systems/VFX.js';
import { combatMixin } from './mixins/combatMixin.js';
import { cameraMixin } from './mixins/cameraMixin.js';
import { sleepMixin } from './mixins/sleepMixin.js';
import { Progression } from '../systems/Progression.js';
import { SaveSystem } from '../systems/SaveSystem.js';
import { CityMap } from '../systems/CityMap.js';
import { CraftPanel } from '../systems/CraftPanel.js';
import { Leaderboards } from '../systems/Leaderboards.js';
import { ZONE_TINT } from '../config/art.js';
import { DomUi } from '../systems/DomUi.js';

export class GameScene extends Phaser.Scene {
  constructor() {
    super('Game');
  }

  create() {
    // Wipe title/char DOM; build layered in-run HUD (hud / craft / modal)
    DomUi.clearAll();

    this.zones = new ZoneManager();
    const dayKey = this.registry.get('dayLength') || 'medium';
    this.dayNight = new DayNight(DAY_LENGTH[dayKey] || DAY_LENGTH.medium);
    this.alert = new AlertSystem();
    this.inv = new Inventory();
    this.help = new HelpDirector(HELP_DEFAULT);
    this.audio = this.registry.get('audio') || new AudioBus();
    this.registry.set('audio', this.audio);
    this.audio.loadMute();
    this.audio.ensure();
    this.audio.stopMenu?.();
    // World ambience: 2–22s base, denser toward outer/wall + night (see AudioBus)
    this.audio.startWorldAmb?.({
      getZone: () => this.zones.getZone(this.player?.tx ?? 0, this.player?.ty ?? 0),
      isNight: () => !!this.dayNight?.isNight,
    });
    this._guideCamSoftFollow = false;

    this.enemies = [];
    this.mode = 'explore'; // explore | combat
    this.combatQueue = [];
    this.moveCd = 0;
    this.running = false; // walk by default  -  RUN button is optional
    this.sneaking = false; // quieter/slower than walk
    this.hiding = false;
    this.craftOpen = false;
    this.ended = false;
    this.objTarget = null;
    this.movePath = [];
    this.moveGoal = null;
    this.autoUseOnArrive = false;
    this.pathGfx = null;
    this.uiBlockClick = false;
    this.combatTurn = 'player';
    this.seenCombatHelp = false;
    this.popupQueue = [];
    this.popupOpen = false;
    /** @type {{ bpId: string, name: string, needs: Record<string, number> }[]} */
    this.huntList = [];
    this.huntHud = null;
    this.char = getCharacter(this.registry.get('characterId'));
    this.bagOpen = false;
    this.equipUI = null;
    this.menuOpen = false;
    this.vfx = new VFX(this);
    this.progression = new Progression();
    this.specialOpen = false;
    this._powerNext = false;
    this.moreOpen = false;
    this.moreUi = [];
    this._longPress = null;
    // Block zone/ambient story until tutorial boot card is dismissed
    this._storyQuiet = true;
    this._lastStoryZone = null;

    const loading = !!this.registry.get('loadSave');
    if (loading) {
      const peek = SaveSystem.peek();
      if (peek?.characterId) {
        this.registry.set('characterId', peek.characterId);
        this.char = getCharacter(peek.characterId);
      }
      // Restore story flags into registry before StoryDirector reads them
      if (peek?.story) {
        this.registry.set('guideDone', !!peek.story.guideDone);
        this.registry.set('storySeen', peek.story.seen || []);
        this.registry.set('storyCrafts', peek.story.crafts || []);
        this.registry.set('narratorOn', peek.narratorOn !== false);
      }
    } else {
      this.registry.set('storySeen', []);
      this.registry.set('storyCrafts', []);
      this.registry.set('guideDone', false);
    }

    this.story = new StoryDirector(this.registry);
    this.guide = new GuideDirector(this);
    this.escape = new EscapeDirector(this);
    this.heat = new HeatSystem();
    this.runStats = {
      kills: 0,
      maxHeat: 0,
      crafts: 0,
      startedAt: Date.now(),
    };
    this._autosaveAcc = 0;
    this._firstLootDone = false;
    this._guideLooted = false;
    this._guideDogDead = false;
    this._guideSlept = false;
    this.guideDog = null;

    this.buildMap();
    this.player = makePlayer(this, CENTER_X, CENTER_Y, this.char);
    this.spawnEnemies();

    this.setupCamera();
    this.setupHud();
    this.setupMouseBar();
    this.setupInput();
    this.setupSneakRing();
    this.equipUI = new EquipUI(this);
    this.craftPanel = new CraftPanel(this);
    this._benchAutoCraft = false;
    this._benchCraftDismissed = false;
    this.explored = new Set();
    this.mapOpen = false;
    this.cityMap = new CityMap(this);
    this.cityMap.create();
    // Seed FOW around spawn so map isn't blank
    this.markExploredAround(CENTER_X, CENTER_Y, 10);
    this.questPulseWorld = this.add.graphics().setDepth(27);
    this.questPulseUi = this.add.graphics().setScrollFactor(0).setDepth(140);
    this._pulseT = 0;
    this.scale.on('resize', (gameSize) => this.onResize(gameSize));

    // Quest 1 always knows how to craft a bandage (no blueprint hunt for tutorial)
    this.inv.learnBlueprint('bandage');

    this.cameras.main.setZoom(DEFAULT_ZOOM);
    // Mouse wheel zoom (out for more city, in for streets) — zoom toward cursor
    this.input.on('wheel', (pointer, _over, _dx, dy) => {
      if (this.ended || this.isPaused?.()) return;
      const cam = this.cameras.main;
      const oldZ = cam.zoom;
      // dy > 0 = scroll down = zoom out (gentle steps)
      const next = Phaser.Math.Clamp(oldZ * (dy > 0 ? 0.96 : 1.04), 0.4, 1.75);
      if (Math.abs(next - oldZ) < 0.001) return;
      // Keep world point under cursor stable
      const wx = cam.scrollX + pointer.x / oldZ;
      const wy = cam.scrollY + pointer.y / oldZ;
      cam.setZoom(next);
      cam.scrollX = wx - pointer.x / next;
      cam.scrollY = wy - pointer.y / next;
      this.clampCamScroll?.();
      this.beginFreeCam?.();
    });

    this.dayNight.on((ev) => {
      if (ev === 'night') {
        this.audio.night();
        this.heat?.onNight();
        this.log('Night crawls in. Dogs take the street. Far off, something cracks.');
        this.refreshNightSpawns(true);
        const card = this.story.onNight();
        if (card) this.time.delayedCall(120, () => this.showPopup(card.title, card.body));
        this.autosave?.('night');
      }
      if (ev === 'day') {
        this.log('Dawn. Even the graffiti looks tired.');
        this.refreshNightSpawns(false);
        this.autosave?.('dawn');
      }
      if (ev === 'newday') this.autosave?.('newday');
      if (ev === 'slept') this.autosave?.('sleep');
    });

    // Seed current district so first-zone story does not steal the tutorial intro
    this._lastStoryZone = this.zones.getZone(this.player.tx, this.player.ty);

    if (loading) {
      const data = SaveSystem.peek();
      const ok = data && SaveSystem.apply(this, data);
      this.registry.set('loadSave', false);
      this.updateObjective();
      this.updateFow();
      this.refreshHud();
      this.cameras.main.fadeIn(400);
      this.log(ok ? 'Save loaded. Welcome back.' : 'Save corrupt. Fresh run.');
      if (ok) {
        // Resume mid-run: allow story cards again
        this._storyQuiet = false;
        this._lastStoryZone = this.zones.getZone(this.player.tx, this.player.ty);
        // Mid-tutorial save: re-surface gold pulse so phones do not feel "no tutorial"
        if (this.guide && !this.guide.done) {
          this.time.delayedCall(500, () => {
            this.updateObjective();
            this.refreshHud();
            this.log(this.guide.objectiveText() || 'Follow the gold pulse.');
            this.nudgeCameraTowardGuide();
            this._guideCamSoftFollow = this.isMobileHud();
          });
        }
      } else {
        this.cameras.main.fadeIn(600);
        // Map breathes ~1.5s, then SIGNAL BOOT fades in (user choice 3B)
        this.time.delayedCall(1500, () => this.showTutorialBoot({ slowIn: true }));
      }
    } else {
      this.updateObjective();
      this.updateFow();
      this.refreshHud();
      this.cameras.main.fadeIn(600);
      // Map first so gold pulse is on-screen, then soft card
      this.time.delayedCall(1500, () => this.showTutorialBoot({ slowIn: true }));
    }

    // Dev / playtest harness (console + automated smoke)
    if (typeof window !== 'undefined') {
      window.__CITY_WARS__ = this;
    }
  }

  /** One intro modal for a new run. Unlocks story + nudges camera to the gold target. */
  showTutorialBoot(opts = {}) {
    const mobile = this.isMobileHud();
    const intro = this.story.introCard(this.char, { compact: true });
    // Keep craft closed under the boot card
    this.craftPanel?.toggle?.(false);
    this.nudgeCameraTowardGuide();
    this.audio?.popup?.();
    this.showPopup(
      intro.title,
      intro.body,
      () => {
        this._storyQuiet = false;
        this.updateObjective();
        this.refreshHud();
        this.nudgeCameraTowardGuide();
        this._guideCamSoftFollow = mobile;
        // No second giant "QUEST 1" toast — top objective + gold pulse already say it
        this.log(this.guide?.objectiveText() || 'Follow the gold pulse east.');
      },
      { slowIn: !!opts.slowIn }
    );
  }

  /** Advance escape arc after tutorial. */
  checkEscape() {
    if (!this.escape?.active()) return;
    const next = this.escape.tick();
    this.updateObjective();
    this.refreshHud();
    if (!next) return;
    this.time.delayedCall(120, () => {
      this.showPopup(next.title, next.body, () => this.nudgeCameraTowardGuide());
    });
  }

  /**
   * Briefly free-look toward the current guide target so the gold pulse is on-screen.
   * On phones, soft-follow keeps the hike target framed until first loot / UI step.
   */
  nudgeCameraTowardGuide() {
    if (!this.player) return;
    let t = null;
    if (this.guide && !this.guide.done) t = this.guide.resolveTarget();
    else if (this.escape?.active()) t = this.escape.resolveTarget();
    if (!t) return;
    if (!t || t.ui) return;
    const ox = t.tx ?? t.x;
    const oy = t.ty ?? t.y;
    if (ox == null || oy == null) return;

    const cam = this.cameras.main;
    const px = this.player.x;
    const py = this.player.y;
    const tx = ox * TILE + TILE / 2;
    const ty = oy * TILE + TILE / 2;
    // Bias toward target on phones so the gold crate is not under the HUD
    const mobile = this.isMobileHud();
    const blend = mobile ? 0.32 : 0.45;
    const cx = px * blend + tx * (1 - blend);
    const cy = py * blend + ty * (1 - blend);

    this.beginFreeCam?.();
    cam.centerOn(cx, cy);
    this.clampCamScroll?.();
    this._edgePanIdle = 0;
    this.audio?.pulse?.();
  }

  /** Soft camera assist during early tutorial on phones (not full auto-follow). */
  updateGuideCamSoftFollow(dt) {
    if (!this._guideCamSoftFollow || !this.player || this.popupOpen) return;
    if (this._midDrag || this._touchDrag) return;
    if (!this.guide || this.guide.done) {
      this._guideCamSoftFollow = false;
      return;
    }
    // Stop after first loot, or when target becomes a UI button
    if (this.guide.flags?.looted || this._guideLooted) {
      this._guideCamSoftFollow = false;
      return;
    }
    const t = this.guide.resolveTarget();
    if (!t || t.ui) {
      this._guideCamSoftFollow = false;
      return;
    }
    const ox = t.tx ?? t.x;
    const oy = t.ty ?? t.y;
    if (ox == null || oy == null) return;

    const cam = this.cameras.main;
    const px = this.player.x;
    const py = this.player.y;
    const tx = ox * TILE + TILE / 2;
    const ty = oy * TILE + TILE / 2;
    const wantX = px * 0.35 + tx * 0.65;
    const wantY = py * 0.35 + ty * 0.65;
    const curX = cam.scrollX + cam.width / 2;
    const curY = cam.scrollY + cam.height / 2;
    const k = Math.min(1, (dt || 0.016) * 2.2);
    cam.centerOn(curX + (wantX - curX) * k, curY + (wantY - curY) * k);
    this.clampCamScroll?.();
  }

  /** Dismiss current modal if open (playtest helper + keyboard escape path). */
  dismissPopup() {
    if (!this.popupOpen) return false;
    // Prefer the registered closer (runs onClose: story quiet, camera nudge, etc.)
    if (typeof this._popupFinish === 'function') {
      this._popupFinish(true);
      return true;
    }
    DomUi.clearModal();
    this.popupOpen = false;
    this._popupFinish = null;
    this.clearMousePath();
    if (this.popupQueue.length) {
      const n = this.popupQueue.shift();
      this.time.delayedCall(30, () => {
        this.showPopup(n.title, n.body, n.onClose, n.opts || {});
      });
    }
    return true;
  }

  /** Snapshot for automated playtests (JSON-safe only). */
  debugState() {
    const raw = this.guide?.resolveTarget?.() || null;
    let target = null;
    if (raw) {
      if (raw.ui) target = { ui: raw.ui };
      else if (raw.tx != null || raw.ty != null)
        target = { x: raw.tx ?? raw.x, y: raw.ty ?? raw.y, kind: raw.kind || null };
      else if (raw.x != null) target = { x: raw.x, y: raw.y, id: raw.id || null };
    }
    return {
      scene: 'Game',
      ended: !!this.ended,
      mode: this.mode,
      paused: !!this.isPaused(),
      popupOpen: !!this.popupOpen,
      craftOpen: !!this.craftOpen,
      bagOpen: !!this.bagOpen,
      tx: this.player?.tx ?? null,
      ty: this.player?.ty ?? null,
      hp: this.player?.hp ?? null,
      maxHp: this.player?.maxHp ?? null,
      atk: this.playerEffectiveAtk?.() ?? this.inv?.totalAtk(this.player?.baseAtk || 0) ?? null,
      def: this.inv?.totalDef(this.player?.baseDef || 0) ?? null,
      vision: this.playerVision?.() ?? null,
      sneak: this.playerSneakBonus?.() ?? null,
      level: this.progression?.level ?? 1,
      xp: this.progression?.xp ?? 0,
      mats: { ...(this.inv?.mats || {}) },
      items: (this.inv?.items || []).map((i) => i.id),
      itemQty: ['bandage', 'stim', 'mre', 'charge', 'bedroll'].reduce((acc, id) => {
        const n = this.inv?.countItem?.(id) || 0;
        if (n > 0) acc[id] = n;
        return acc;
      }, {}),
      equip: Object.fromEntries(
        Object.entries(this.inv?.equip || {}).map(([k, v]) => [k, v?.id || null])
      ),
      blueprints: [...(this.inv?.blueprints || [])],
      heat: Math.round(this.heat?.level || 0),
      healLabel: this.healButtonLabel?.() || 'HEAL',
      mobileHud: this.isMobileHud(),
      twoRowBar: this.barMetrics().twoRow,
      guide: {
        quest: this.guide?.quest ?? null,
        done: !!this.guide?.done,
        flags: { ...(this.guide?.flags || {}) },
        objective: this.guide?.objectiveText?.() || this.objective || '',
        target,
      },
      guideDogAlive: !!(this.guideDog?.alive),
      night: !!this.dayNight?.isNight,
      alert: this.alert?.label || null,
    };
  }

  /** Playtest helpers — save/load without UI. */
  debugSave() {
    return SaveSystem.save(this);
  }

  debugLoad() {
    const data = SaveSystem.peek();
    return data ? SaveSystem.apply(this, data) : false;
  }

  /**
   * Silent save for long runs. Skips if ended / mid-combat / no progress yet.
   * @param {string} [reason]
   */
  autosave(reason = '') {
    if (this.ended || this.mode === 'combat') return false;
    if (this.isGuideHandhold?.() && !this._guideLooted) return false;
    const ok = SaveSystem.save(this);
    if (ok && reason === 'manual') {
      /* caller logs */
    }
    return ok;
  }

  /** Wall-clock ms this run (for fastest-escape board). */
  runDurationMs() {
    const start = this.runStats?.startedAt || Date.now();
    return Math.max(0, Date.now() - start);
  }

  /** Teleport for playtests (keeps path clear). */
  debugWarp(tx, ty) {
    if (!this.walkable(tx, ty) && !this.isInteractiveTile(tx, ty)) return false;
    this.clearMousePath();
    this.player.setTile(tx, ty, false);
    this.snapCameraToPlayer();
    this.onStepTile();
    this.updateFow();
    this.refreshHud();
    this.checkGuide();
    return true;
  }

  setupSneakRing() {
    // Soft circle "detector" around player while sneaking
    this.sneakRing = this.add.graphics().setDepth(18);
    this.sneakRingVisible = false;
  }

  updateSneakRing() {
    if (!this.sneakRing) return;
    if (!this.sneaking || this.mode === 'combat' || this.alert.state === ALERT.RED) {
      this.sneakRing.clear();
      this.sneakRingVisible = false;
      return;
    }
    this.sneakRingVisible = true;
    // Quiet zone radius: night vision baseline + sneak gear
    const r = (PLAYER.visionNight + this.playerSneakBonus() + 1) * TILE;
    const x = this.player.x;
    const y = this.player.y;
    this.sneakRing.clear();
    this.sneakRing.lineStyle(2, 0x22c55e, 0.55);
    this.sneakRing.strokeCircle(x, y, r);
    this.sneakRing.fillStyle(0x22c55e, 0.06);
    this.sneakRing.fillCircle(x, y, r);
    // pulse ticks
    this.sneakRing.lineStyle(1, 0x86efac, 0.35);
    this.sneakRing.strokeCircle(x, y, r * 0.65);
  }

  /** Advance hand-hold tutorial when conditions met */
  checkGuide() {
    if (!this.guide || this.guide.done) return;
    const next = this.guide.tick();
    this.updateObjective();
    this.refreshHud();
    if (!next) return;

    // Micro-coach: readable banner above the bar (never buried under buttons)
    if (!next.id) {
      this.showGuideToast(next.title || 'NEXT', next.body || '');
      this.time.delayedCall(80, () => this.nudgeCameraTowardGuide());
      return;
    }

    // Full quest banners still use a modal
    this.time.delayedCall(120, () => {
      this.showPopup(next.title, next.body, () => {
        this.nudgeCameraTowardGuide();
        if (next.id === 'done') this.time.delayedCall(200, () => this.checkEscape());
      });
    });
  }

  /**
   * Compact coach card (one box only — no duplicate bottom toast).
   * Dismiss with CLOSE or after a long timeout.
   */
  isGuideToastOpen() {
    return !!(this.domGuideToast && !this.domGuideToast.classList.contains('hidden'));
  }

  showGuideToast(title, body) {
    const bodyText = String(body || '').trim();
    const el = this.domGuideToast;
    if (!el) return;

    // One box only — clear/hide the bottom log toast while coach is up
    if (this.domToast) {
      this.domToast.textContent = '';
      this.domToast.classList.add('hidden');
    }

    el.innerHTML = '';
    el.classList.remove('hidden');

    const titleEl = document.createElement('div');
    titleEl.className = 'guide-toast-title';
    titleEl.textContent = title || 'NEXT';
    el.appendChild(titleEl);

    const bodyEl = document.createElement('div');
    bodyEl.className = 'guide-toast-body';
    bodyEl.textContent = bodyText;
    el.appendChild(bodyEl);

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'hit guide-toast-close';
    close.textContent = 'CLOSE';
    close.addEventListener('pointerup', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.hideGuideToast();
    });
    el.appendChild(close);

    if (this._guideToastClear) this._guideToastClear.remove?.(false);
    this._guideToastClear = this.time.delayedCall(20000, () => this.hideGuideToast());
  }

  hideGuideToast() {
    this.domGuideToast?.classList.add('hidden');
    if (this._guideToastClear) {
      this._guideToastClear.remove?.(false);
      this._guideToastClear = null;
    }
    // Allow normal log toasts again
    this.domToast?.classList.remove('hidden');
  }

  /** Sync DOM HUD layout classes (mobile strip vs desktop). */
  layoutTopHud(w = this.scale.width, h = this.scale.height) {
    const mobile = this.isMobileHud(w, h);
    if (this.domHudRoot) {
      this.domHudRoot.classList.toggle('hud-mobile', mobile);
    }
    this.syncDomBarMetrics(w, h);
  }

  /** Push bar metrics into DOM toast / home / map label positions. */
  syncDomBarMetrics(w = this.scale.width, h = this.scale.height) {
    const m = this.barMetrics(w, h);
    if (this.domToast) {
      this.domToast.style.bottom = `${m.hudBottom + 14}px`;
    }
    if (this.domGuideToast) {
      this.domGuideToast.style.bottom = `${m.hudBottom + 22}px`;
    }
    if (this.domHomeLabel) {
      this.domHomeLabel.style.bottom = `${m.homeY - 22}px`;
      // homeY is from top in Phaser coords; convert: bottom = h - (homeY+22)
      this.domHomeLabel.style.bottom = `${Math.max(8, h - (m.homeY + 22))}px`;
    }
    if (this.domBar) {
      // bar height handled by content; ensure craft dock knows metrics
    }
    if (this.domMapLabel) {
      this.cityMap?._layoutChip?.();
    }
    if (this.domCompassLabel) {
      const by = Math.min(120, (this.isMobileHud(w, h) ? 118 : 64) + (h < 700 ? 8 : 20));
      this.domCompassLabel.style.top = `${by}px`;
    }
    if (this.domHunt) {
      this.domHunt.style.top = `${this.isMobileHud(w, h) ? 118 : 78}px`;
    }
  }

  onResize(gameSize) {
    const w = gameSize.width;
    const h = gameSize.height;
    const m = this.barMetrics(w, h);
    // Preserve player zoom — never snap back to 1 on window resize
    const keepZ = this.cameras.main.zoom || DEFAULT_ZOOM;
    this.cameras.main.setSize(w, h);
    this.cameras.main.setZoom(keepZ);
    this.cameras.main.setDeadzone(w * 0.2, h * 0.18);
    this.clampCamScroll?.();

    this.layoutTopHud(w, h);
    // Rebuild bar so MORE / SPEC slots match new width + combat state
    if (this.actionButtons) this.rebuildActionBar();
    if (this.moreOpen) {
      this.closeMoreMenu();
    }
    if (this.homeArrow) this.homeArrow.setPosition(36, m.homeY);
    this.cityMap?.onResize?.();
    this.craftPanel?.refresh?.();
  }

  isNearBench() {
    return this.craftPanel?.isNearBench?.() ?? false;
  }

  /** Phone / short viewport — two-row bottom bar. */
  isMobileHud(w = this.scale.width, h = this.scale.height) {
    return w < 520 || h < 700;
  }

  /** True when the bottom bar should collapse secondary actions into MORE. */
  isNarrowBar(w = this.scale.width) {
    return w < 700;
  }

  /** Bottom inset from iOS home bar / notch (CSS safe-area). */
  safeAreaBottom() {
    if (typeof document === 'undefined') return 0;
    const el = document.getElementById('game-container');
    if (!el) return 0;
    const pad = parseFloat(getComputedStyle(el).paddingBottom) || 0;
    return Math.max(0, pad);
  }

  /** Shared layout numbers for bottom HUD, craft panel, and input hit zones. */
  barMetrics(w = this.scale.width, h = this.scale.height) {
    const mobile = this.isMobileHud(w, h);
    const narrow = this.isNarrowBar(w);
    const twoRow = mobile;
    const rowH = mobile ? 36 : narrow ? 36 : 40;
    const rowGap = mobile ? 6 : 0;
    const safeBot = this.safeAreaBottom();
    const padBot = (mobile ? 18 : 10) + safeBot;
    const barH = twoRow ? rowH * 2 + rowGap + 8 : 52;
    const bottomY = h - padBot - barH / 2;
    const primaryY = twoRow ? h - padBot - rowH / 2 : h - 58;
    const secondaryY = twoRow ? h - padBot - rowH - rowGap - rowH / 2 : null;
    const hudBottom = padBot + barH + 4;
    // Toast sits clearly ABOVE the action bar (not under buttons)
    const logY = h - hudBottom - 22;
    const homeY = h - hudBottom - 36;
    return { mobile, narrow, twoRow, rowH, rowGap, barH, bottomY, primaryY, secondaryY, hudBottom, logY, homeY };
  }

  /** Pointer is over top or bottom HUD strips (not the map). */
  hudPointerZone(p) {
    const m = this.barMetrics();
    const topHud = this.isMobileHud() ? 102 : 56;
    return p.y < topHud || p.y > this.scale.height - m.hudBottom;
  }

  isTouchInput() {
    return !!this.sys.game.device.input.touch;
  }

  /** Fit visible action buttons into one bar row. */
  layoutActionBarRow(w, rowY, n, narrow) {
    const mobile = this.isMobileHud(w);
    const pad = mobile ? 6 : narrow ? 8 : 48;
    const usable = Math.max(160, w - pad * 2);
    const gap = usable / Math.max(1, n);
    const btnW = Math.min(
      mobile ? 72 : 80,
      Math.max(mobile ? 34 : narrow ? 34 : 48, gap - (mobile ? 2 : narrow ? 2 : 6))
    );
    const btnH = mobile ? 34 : narrow ? 36 : 40;
    const fontSize = mobile
      ? btnW < 42
        ? '9px'
        : '10px'
      : narrow
        ? btnW < 42
          ? '9px'
          : '11px'
        : '13px';
    const startX = w / 2 - ((n - 1) * gap) / 2;
    const hitPad = Math.max(2, Math.min(mobile ? 4 : 8, Math.floor((gap - btnW) / 2)));
    return { gap, btnW, btnH, fontSize, startX, y: rowY, hitPad };
  }

  /** Catalog of bottom-bar actions. */
  barActionCatalog() {
    return {
      use: { id: 'use', label: 'USE', color: 0x0ea5e9, fn: () => this.useTile() },
      sleep: { id: 'sleep', label: 'SLEEP', color: 0x0f766e, fn: () => this.doSleep() },
      hide: { id: 'hide', label: 'HIDE', color: 0xeab308, fn: () => this.tryHide() },
      sneak: {
        id: 'sneak',
        label: 'SNEAK',
        color: 0x64748b,
        fn: () => {
          this.closeMoreMenu();
          this.toggleSneak();
        },
      },
      craft: { id: 'craft', label: 'CRAFT', color: 0xa855f7, fn: () => this.toggleCraft() },
      walk: {
        id: 'walk',
        label: 'WALK',
        color: 0x475569,
        fn: () => {
          this.closeMoreMenu();
          this.running = !this.running;
          if (this.running) this.sneaking = false;
          this.syncMoveModeButtons();
          this.log(
            this.running
              ? 'RUN ON  -  faster but louder (easier to get spotted).'
              : 'WALK  -  normal pace.'
          );
        },
      },
      heal: { id: 'heal', label: 'HEAL', color: 0x22c55e, fn: () => this.useQuickKit() },
      menu: {
        id: 'menu',
        label: 'MENU',
        color: 0x0369a1,
        fn: () => {
          this.closeMoreMenu();
          this.openRunMenu();
        },
      },
      bag: { id: 'bag', label: 'BAG', color: 0x57534e, fn: () => this.openBagPanel() },
      map: {
        id: 'map',
        label: 'MAP',
        color: 0x0f766e,
        fn: () => {
          this.closeMoreMenu();
          this.toggleLegend();
        },
      },
      specials: {
        id: 'specials',
        label: 'SPEC',
        color: 0xea580c,
        fn: () => {
          this.closeMoreMenu();
          this.openCombatSpecials();
        },
      },
      more: {
        id: 'more',
        label: 'MORE',
        color: 0x475569,
        fn: () => this.toggleMoreMenu(),
      },
    };
  }

  /**
   * Bottom-bar rows for current width + combat mode.
   * Mobile uses two rows so HEAL / SNEAK / MAP stay visible without MORE.
   */
  getVisibleBarRows() {
    const combat = this.mode === 'combat';
    if (!this.isMobileHud()) {
      return { twoRow: false, rows: [this.getVisibleBarIds()] };
    }
    if (combat) {
      return {
        twoRow: true,
        rows: [
          ['sneak', 'walk', 'heal', 'specials', 'menu'],
          ['use', 'sleep', 'hide', 'craft', 'bag'],
        ],
      };
    }
    return {
      twoRow: true,
      rows: [
        ['sneak', 'walk', 'heal', 'map', 'menu'],
        ['use', 'sleep', 'hide', 'craft', 'bag'],
      ],
    };
  }

  /**
   * Visible bottom-bar slots for current width + combat mode.
   * Tablet-narrow keeps MORE; phones use {@link getVisibleBarRows} instead.
   */
  getVisibleBarIds() {
    const combat = this.mode === 'combat';
    if (!this.isNarrowBar()) {
      if (combat) {
        return ['use', 'sleep', 'hide', 'sneak', 'craft', 'walk', 'heal', 'specials', 'bag', 'menu'];
      }
      return ['use', 'sleep', 'hide', 'sneak', 'craft', 'walk', 'heal', 'menu', 'bag', 'map'];
    }
    // Narrow: fewer primary buttons
    if (combat) {
      return ['use', 'sleep', 'hide', 'craft', 'heal', 'specials', 'bag', 'more'];
    }
    return ['use', 'sleep', 'hide', 'sneak', 'craft', 'bag', 'map', 'more'];
  }

  /** Secondary actions shown inside the MORE sheet (tablet-narrow only). */
  getMoreMenuIds() {
    if (this.isMobileHud()) return [];
    if (this.isNarrowBar() && this.mode !== 'combat') {
      return ['walk', 'heal', 'menu'];
    }
    const ids = ['sneak', 'walk', 'menu', 'map'];
    // Wide combat already has SPEC on the bar; narrow combat too. Keep MAP always in MORE.
    if (this.mode === 'combat' && !ids.includes('specials')) {
      // SPEC is primary; optional duplicate not needed
    }
    return ids;
  }

  clearActionButtons() {
    for (const b of this.actionButtons || []) {
      try {
        b.destroy?.();
      } catch (_) {
        /* ignore */
      }
    }
    if (this.domBarRows) {
      for (const row of this.domBarRows) row.innerHTML = '';
    }
    this.actionButtons = [];
    this.btnUse = null;
    this.btnSleep = null;
    this.btnHide = null;
    this.btnSneak = null;
    this.btnCraft = null;
    this.btnRun = null;
    this.btnHeal = null;
    this.btnMenu = null;
    this.btnBag = null;
    this.btnLegend = null;
    this.btnSpecials = null;
    this.btnMore = null;
  }

  /** Rebuild bottom bar for width / combat (DOM buttons). */
  rebuildActionBar() {
    const w = this.scale.width;
    const h = this.scale.height;
    if (!this.domBar) return;

    this.clearActionButtons();
    const catalog = this.barActionCatalog();
    const metrics = this.barMetrics(w, h);
    this.syncDomBarMetrics(w, h);

    const { rows } = this.getVisibleBarRows();
    // Ensure we have enough row containers
    while (this.domBarRows.length < rows.length) {
      const r = DomUi.el('div', 'hud-bar-row');
      this.domBar.appendChild(r);
      this.domBarRows.push(r);
    }
    this.domBarRows.forEach((r, i) => {
      r.style.display = i < rows.length ? 'flex' : 'none';
      r.innerHTML = '';
    });

    rows.forEach((ids, rowIdx) => {
      const rowEl = this.domBarRows[rowIdx];
      const layout = this.layoutActionBarRow(w, 0, ids.length, metrics.narrow);
      ids.forEach((id) => {
        const def = catalog[id];
        if (!def) return;
        const btn = DomUi.button('hit hud-btn', def.label, () => {
          this.uiBlockClick = true;
          def.fn();
          this.time.delayedCall(80, () => {
            this.uiBlockClick = false;
          });
        });
        btn.style.background = DomUi.hexCss(def.color);
        btn.style.fontSize = layout.fontSize;
        btn.style.maxWidth = `${layout.btnW + 16}px`;
        btn.style.height = `${layout.btnH}px`;
        rowEl.appendChild(btn);
        const b = DomUi.btnAdapter(btn);
        this.actionButtons.push(b);
        if (id === 'use') this.btnUse = b;
        if (id === 'sleep') this.btnSleep = b;
        if (id === 'hide') this.btnHide = b;
        if (id === 'sneak') this.btnSneak = b;
        if (id === 'craft') this.btnCraft = b;
        if (id === 'walk') this.btnRun = b;
        if (id === 'heal') this.btnHeal = b;
        if (id === 'menu') this.btnMenu = b;
        if (id === 'bag') this.btnBag = b;
        if (id === 'map') this.btnLegend = b;
        if (id === 'specials') this.btnSpecials = b;
        if (id === 'more') this.btnMore = b;
      });
    });
    this.syncMoveModeButtons();
    if (this.btnSleep) {
      const kits = this.countBedrolls?.() || 0;
      this.btnSleep.label.setText(kits > 0 ? `SLEEP×${kits}` : 'SLEEP');
    }
  }

  // ─── MAP ─────────────────────────────────────────────
  buildMap() {
    const data = new CityGenerator(this.zones).generate();
    this.ground = data.ground;
    this.walls = data.walls;
    this.lootSpots = data.loot;
    this.benches = data.benches;
    this.sleeps = data.sleeps;
    this.bpSpots = data.blueprints;
    this.gearDrops = data.gearDrops || [];
    this.escapePads = data.escapePads;

    const map = this.make.tilemap({
      tileWidth: TILE,
      tileHeight: TILE,
      width: MAP_W,
      height: MAP_H,
    });
    const ts = map.addTilesetImage('city', 'tiles', TILE, TILE, 0, 0, 1);
    this.gLayer = map.createBlankLayer('g', ts, 0, 0, MAP_W, MAP_H, TILE, TILE);
    this.wLayer = map.createBlankLayer('w', ts, 0, 0, MAP_W, MAP_H, TILE, TILE);
    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        this.gLayer.putTileAt(this.ground[y][x], x, y);
        if (this.walls[y][x]) this.wLayer.putTileAt(this.walls[y][x], x, y);
      }
    }
    this.wLayer.setDepth(5);
    this.fow = this.add.graphics().setDepth(14);
    this.nightVeil = this.add.rectangle(WORLD_W / 2, WORLD_H / 2, WORLD_W, WORLD_H, 0x020617, 0)
      .setDepth(13);
    this.zoneVeil = this.add
      .rectangle(WORLD_W / 2, WORLD_H / 2, WORLD_W, WORLD_H, 0x000000, 0)
      .setDepth(12);
    this.wallGfx = this.add.graphics().setDepth(11);
    this._zoneTint = { a: 0, c: 0 };
  }

  blocked(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) return true;
    const w = this.walls[ty][tx];
    return !!(w && BLOCKING.has(w));
  }

  walkable(tx, ty) {
    if (this.blocked(tx, ty)) return false;
    return WALKABLE.has(this.ground[ty][tx]);
  }

  actorAt(tx, ty, ign = null) {
    if (this.player.alive && this.player.tx === tx && this.player.ty === ty && ign !== this.player)
      return this.player;
    for (const e of this.enemies) {
      if (!e.alive || e._dormant) continue;
      if (e !== ign && e.tx === tx && e.ty === ty) return e;
    }
    return null;
  }

  // ─── SPAWN ───────────────────────────────────────────
  /** Interactive world props must stay free so pathing / USE never fight an actor. */
  isSpawnBlockedTile(x, y) {
    if (this.isInteractiveTile?.(x, y)) return true;
    const g = this.ground?.[y]?.[x];
    if (
      g === T.LOOT ||
      g === T.BENCH ||
      g === T.SLEEP ||
      g === T.LANDMARK ||
      g === T.ESCAPE ||
      g === T.GEAR_DROP ||
      g === T.GEAR_STICK ||
      g === T.GEAR_HAT ||
      g === T.HQ
    )
      return true;
    // HOME ring is tutorial space — never spawn combat packs here
    if (this.zones?.getZone?.(x, y) === 'home') return true;
    return false;
  }

  /**
   * Spawn by ring budget so Yellow→Blue actually host fights.
   * Old left-to-right scan filled the cap from north RED first (~54 red, 0 mid).
   */
  spawnEnemies() {
    // Level 0=HOME … 5=RED — totals ~57. HOME empty so tutorial stays quiet.
    const budget = { 0: 0, 1: 9, 2: 11, 3: 12, 4: 12, 5: 13 };
    /** @type {Record<number, {x:number,y:number}[]>} */
    const pools = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [] };

    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        if (!this.walkable(x, y)) continue;
        if (this.isSpawnBlockedTile(x, y)) continue;
        const lvl = this.zones.level(x, y);
        if (pools[lvl]) pools[lvl].push({ x, y });
      }
    }

    for (let lvl = 0; lvl <= 5; lvl++) {
      const pool = pools[lvl] || [];
      // Spread across ring: sort by hash, then stride through the pool
      pool.sort((a, b) => hash(a.x * 3, a.y * 7) - hash(b.x * 3, b.y * 7));
      const want = budget[lvl] || 0;
      if (!pool.length || want <= 0) continue;
      const stride = Math.max(1, Math.floor(pool.length / want));
      let placed = 0;
      for (let i = 0; i < pool.length && placed < want; i += stride) {
        const { x, y } = pool[i];
        // Keep a little spacing so two don't share a tile neighborhood when possible
        if (
          this.enemies.some(
            (e) => Math.abs(e.tx - x) + Math.abs(e.ty - y) < (lvl <= 2 ? 3 : 2)
          )
        ) {
          continue;
        }
        const kind = this.enemyKindForRing(lvl, hash(x, y) % 100);
        this.enemies.push(makeEnemy(this, x, y, ENEMY[kind], kind));
        placed++;
      }
      // Fill remainder if spacing skipped too many
      for (let i = 0; i < pool.length && placed < want; i++) {
        const { x, y } = pool[i];
        if (this.actorAt(x, y)) continue;
        const kind = this.enemyKindForRing(lvl, hash(x, y) % 100);
        this.enemies.push(makeEnemy(this, x, y, ENEMY[kind], kind));
        placed++;
      }
    }
  }

  /** Ring composition: thugs early, drones mid, enforcers outer. */
  enemyKindForRing(lvl, r) {
    if (lvl <= 0) return 'thug'; // HOME — rare lone runner
    if (lvl === 1) return 'thug'; // Yellow — teach melee
    if (lvl === 2) return r < 85 ? 'thug' : 'drone'; // Orange
    if (lvl === 3) return r < 55 ? 'thug' : r < 90 ? 'drone' : 'enforcer'; // Green
    if (lvl === 4) return r < 35 ? 'thug' : r < 70 ? 'drone' : 'enforcer'; // Blue
    // Red — Wall crew
    return r < 25 ? 'thug' : r < 55 ? 'drone' : 'enforcer';
  }

  refreshNightSpawns(night) {
    // toggle nightOnly visibility / presence
    for (const e of this.enemies) {
      if (e.nightOnly) {
        e.setVisible(night && this.isVisibleTile(e.tx, e.ty));
        // if day, dogs "sleep" off map effectively
        e._dormant = !night;
      }
    }
    if (night) {
      // No night packs during quest-0 hand-hold (they stole the BAG step)
      if (this.isGuideHandhold()) return;
      // spawn a few dogs near player ring (never over the guide dog)
      let dogs = 0;
      for (let i = 0; i < 40 && dogs < 6; i++) {
        const a = Math.random() * Math.PI * 2;
        const d = 8 + Math.random() * 10;
        const x = (this.player.tx + Math.cos(a) * d) | 0;
        const y = (this.player.ty + Math.sin(a) * d) | 0;
        if (!this.walkable(x, y) || this.actorAt(x, y) || this.isSpawnBlockedTile(x, y)) continue;
        const dog = makeEnemy(this, x, y, ENEMY.dog, 'dog');
        dog.nightOnly = true;
        this.enemies.push(dog);
        dogs++;
      }
    } else {
      // Dawn: clear night pack dogs only. Keep the guide dog (quest 2) alive.
      this.enemies = this.enemies.filter((e) => {
        if (e.kind !== 'dog') return true;
        if (e === this.guideDog || e._isGuideDog) return true;
        e.destroy();
        return false;
      });
    }
  }

  /** Heat spike spawns a patrol enforcer near the player. */
  spawnHeatPatrol() {
    if (this.mode === 'combat' || this.ended) return;
    if (this.isGuideHandhold()) return;
    for (let i = 0; i < 30; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = 10 + Math.random() * 8;
      const x = (this.player.tx + Math.cos(a) * d) | 0;
      const y = (this.player.ty + Math.sin(a) * d) | 0;
      if (!this.walkable(x, y) || this.actorAt(x, y) || this.isSpawnBlockedTile(x, y)) continue;
      const e = makeEnemy(this, x, y, ENEMY.enforcer, 'enforcer');
      e._heatPatrol = true;
      this.enemies.push(e);
      this.log('Grid patrol inbound. Enforcer on your vector.');
      this.audio.patrol?.();
      this.vfx?.burst(x * TILE + TILE / 2, y * TILE + TILE / 2, 0xef4444, 8);
      return;
    }
  }

  // ─── CAMERA methods in cameraMixin ───

  setupHud() {
    const w = this.scale.width;
    const h = this.scale.height;
    const d = 100;

    DomUi.clearHud();
    const root = DomUi.show('hud-ui', 'hud');
    this.domHudRoot = root;

    // Top status strip
    const top = DomUi.el('div', 'hud-top');
    const left = DomUi.el('div', 'hud-left');
    this.domAlert = DomUi.el('div', 'hud-alert', 'CLEAR');
    this.domStat = DomUi.el('div', 'hud-stat', '');
    left.appendChild(this.domAlert);
    left.appendChild(this.domStat);

    const center = DomUi.el('div', 'hud-center');
    this.domObj = DomUi.el('div', 'hud-obj', '');
    const dayWrap = DomUi.el('div', 'hud-day-wrap');
    const dayTrack = DomUi.el('div', 'hud-day-track');
    this.domDayFill = DomUi.el('div', 'hud-day-fill');
    this.domDayLabel = DomUi.el('div', 'hud-day-label', 'DAY 1');
    dayTrack.appendChild(this.domDayFill);
    dayWrap.appendChild(dayTrack);
    dayWrap.appendChild(this.domDayLabel);
    this.domHeatLabel = DomUi.el('div', 'hud-heat-label', 'GRID HEAT 0');
    const heatTrack = DomUi.el('div', 'hud-heat-track');
    this.domHeatFill = DomUi.el('div', 'hud-heat-fill');
    heatTrack.appendChild(this.domHeatFill);
    center.appendChild(this.domObj);
    center.appendChild(dayWrap);
    center.appendChild(this.domHeatLabel);
    center.appendChild(heatTrack);

    this.domInv = DomUi.el('div', 'hud-right', '');
    top.appendChild(left);
    top.appendChild(center);
    top.appendChild(this.domInv);
    root.appendChild(top);

    // Combat dock
    this.domCombat = DomUi.el('div', 'hud-combat hidden');
    this.domCombat.appendChild(DomUi.el('div', 'hud-combat-title', 'COMBAT LOG'));
    this.domPlayerBarLabel = DomUi.el('div', 'hud-combat-label', 'YOU');
    this.domCombat.appendChild(this.domPlayerBarLabel);
    const pTrack = DomUi.el('div', 'hud-bar-track');
    this.domPlayerBarFill = DomUi.el('div', 'hud-bar-fill');
    pTrack.appendChild(this.domPlayerBarFill);
    this.domCombat.appendChild(pTrack);
    this.domEnemyBarLabel = DomUi.el('div', 'hud-combat-label enemy', 'ENEMY');
    this.domCombat.appendChild(this.domEnemyBarLabel);
    const eTrack = DomUi.el('div', 'hud-bar-track');
    this.domEnemyBarFill = DomUi.el('div', 'hud-bar-fill enemy');
    eTrack.appendChild(this.domEnemyBarFill);
    this.domCombat.appendChild(eTrack);
    this.domCombatLog = DomUi.el('div', 'hud-combat-log', '');
    this.domCombat.appendChild(this.domCombatLog);
    root.appendChild(this.domCombat);

    // Floating labels
    this.domCompassLabel = DomUi.el('div', 'hud-compass-label', '');
    this.domHomeLabel = DomUi.el('div', 'hud-home-label', 'HQ');
    this.domMapLabel = DomUi.el('div', 'hud-map-label', 'MAP');
    root.appendChild(this.domCompassLabel);
    root.appendChild(this.domHomeLabel);
    root.appendChild(this.domMapLabel);

    // Toasts
    this.domToast = DomUi.el('div', 'hud-toast', '');
    this.domGuideToast = DomUi.el('div', 'hud-guide-toast hidden', '');
    root.appendChild(this.domToast);
    root.appendChild(this.domGuideToast);

    // Hunt list
    this.domHunt = DomUi.el('div', 'hud-hunt hidden', '');
    root.appendChild(this.domHunt);

    // Bottom action bar shell
    this.domBar = DomUi.el('div', 'hud-bar');
    this.domBarRows = [DomUi.el('div', 'hud-bar-row'), DomUi.el('div', 'hud-bar-row')];
    this.domBarRows.forEach((r) => this.domBar.appendChild(r));
    root.appendChild(this.domBar);

    // Thin adapters so older code paths can call .setText / .setColor
    this.alertText = this._domTextProxy(this.domAlert);
    this.statText = this._domTextProxy(this.domStat);
    this.objText = this._domTextProxy(this.domObj);
    this.dayBarLabel = this._domTextProxy(this.domDayLabel);
    this.heatText = this._domTextProxy(this.domHeatLabel);
    this.invText = this._domTextProxy(this.domInv);
    this.logText = this._domTextProxy(this.domToast);
    this.homeArrowLabel = this._domTextProxy(this.domHomeLabel);
    this.playerBarLabel = this._domTextProxy(this.domPlayerBarLabel);
    this.enemyBarLabel = this._domTextProxy(this.domEnemyBarLabel);
    this.combatLogText = this._domTextProxy(this.domCombatLog);
    this.helpText = this._domTextProxy(DomUi.el('div', '', '')); // legacy no-op
    this.modeText = this._domTextProxy(DomUi.el('div', '', ''));
    this.timeText = this._domTextProxy(DomUi.el('div', '', ''));

    // Phaser-only chrome (no text)
    this.heatVignette = this.add.graphics().setScrollFactor(0).setDepth(d + 8).setAlpha(0);
    this.combatLogLines = [];
    this.combatHud = { setVisible: (v) => this.domCombat?.classList.toggle('hidden', !v), setPosition: () => {}, visible: false };

    this.craftOpen = false;
    this.craftUi = [];
    this.craftModalDepth = 400;
    this.legendOpen = false;
    this.legendUi = [];

    // Legacy marker kept invisible — gold pulse is the only world objective cue
    this.objMarker = this.add
      .triangle(0, 0, 0, 12, 9, 0, 18, 12, 0xfbbf24)
      .setDepth(28)
      .setVisible(false);
    this.pathGfx = this.add.graphics().setDepth(12);
    // Markers for day/heat fill width updates
    this.dayBarFill = { width: 2, setFillStyle: (col) => {
      if (this.domDayFill) this.domDayFill.style.background = DomUi.hexCss(col);
    } };
    this.heatBarFill = { width: 1, setFillStyle: (col) => {
      if (this.domHeatFill) this.domHeatFill.style.background = DomUi.hexCss(col);
    } };
    this.playerBarFill = { width: 250, setFillStyle: (col) => {
      if (this.domPlayerBarFill) this.domPlayerBarFill.style.background = DomUi.hexCss(col);
    } };
    this.enemyBarFill = { width: 0, setFillStyle: (col) => {
      if (this.domEnemyBarFill) this.domEnemyBarFill.style.background = DomUi.hexCss(col);
    } };

    this.layoutTopHud(w, h);
  }

  /** Minimal text proxy for DOM nodes (setText / setColor / setFontSize). */
  _domTextProxy(el) {
    return {
      el,
      setText(t) {
        if (el) el.textContent = t == null ? '' : String(t);
        return this;
      },
      setColor(c) {
        if (el && c != null) el.style.color = c;
        return this;
      },
      setFontSize(s) {
        if (el && s != null) el.style.fontSize = typeof s === 'number' ? `${s}px` : s;
        return this;
      },
      setVisible(v) {
        if (el) el.style.display = v ? '' : 'none';
        return this;
      },
      setPosition() {
        return this;
      },
      setWordWrapWidth() {
        return this;
      },
      setOrigin() {
        return this;
      },
      setScrollFactor() {
        return this;
      },
      setDepth() {
        return this;
      },
      get text() {
        return el?.textContent || '';
      },
    };
  }

  /** Bottom action bar  -  primary mouse UI (MORE on narrow; SPEC in combat) */
  setupMouseBar() {
    const d = 120;
    const m = this.barMetrics();
    // bottomBar flag so rebuildActionBar knows HUD exists (DOM)
    this.bottomBar = true;
    this.actionButtons = [];
    this.rebuildActionBar();

    // Home compass chevron — graphics only; label is DOM
    this.homeArrow = this.add.graphics().setScrollFactor(0).setDepth(d + 2);
    this.homeArrow.setPosition(36, m.homeY);
    this.drawHomeChevron();
  }

  toggleMoreMenu() {
    if (this.moreOpen) this.closeMoreMenu();
    else this.openMoreMenu();
  }

  openMoreMenu() {
    if (this.moreOpen) return;
    this.closeRunMenu?.();
    this.moreOpen = true;
    this.clearMousePath();
    this.uiBlockClick = true;
    const ids = this.getMoreMenuIds();
    const catalog = this.barActionCatalog();
    const m = this.barMetrics();

    DomUi.clearModal();
    const root = DomUi.show('more-ui', 'modal');
    root.addEventListener('pointerup', (e) => {
      if (e.target === root) this.closeMoreMenu();
    });

    const panel = DomUi.el('div', 'more-panel');
    panel.style.bottom = `${m.hudBottom + 16}px`;
    panel.appendChild(DomUi.el('div', 'sheet-title', 'MORE'));
    const actions = DomUi.el('div', 'sheet-actions');

    ids.forEach((id) => {
      const def = catalog[id];
      if (!def) return;
      const btn = DomUi.button('hit sheet-btn', def.label, () => {
        def.fn();
        if (id === 'menu' || id === 'map') this.closeMoreMenu();
        else {
          // Rebuild MORE so sneak/walk labels match toggled state
          this.moreOpen = false;
          this.openMoreMenu();
        }
      });
      btn.style.background = DomUi.hexCss(def.color);
      actions.appendChild(btn);
      const b = DomUi.btnAdapter(btn);
      if (id === 'sneak') this.btnSneak = b;
      if (id === 'walk') this.btnRun = b;
    });
    panel.appendChild(actions);
    root.appendChild(panel);
    this.moreUi = [root];
    this.syncMoveModeButtons();
    this.time.delayedCall(80, () => {
      if (this.moreOpen) this.uiBlockClick = false;
    });
  }

  closeMoreMenu() {
    if (!this.moreOpen && !(this.moreUi || []).length) return;
    this.moreOpen = false;
    DomUi.clearModal();
    this.moreUi = [];
    // Sneak/walk buttons may have lived only in MORE; clear dangling refs if not on main bar
    if (!this.actionButtons?.some((b) => b === this.btnSneak)) this.btnSneak = null;
    if (!this.actionButtons?.some((b) => b === this.btnRun)) this.btnRun = null;
    // Re-bind sneak/walk if they exist on the main bar
    this.actionButtons?.forEach((b) => {
      const t = b.label?.text || '';
      if (t.startsWith('SNEAK')) this.btnSneak = b;
      if (t.startsWith('WALK') || t.startsWith('RUN')) this.btnRun = b;
    });
    this.clearMousePath();
    this.uiBlockClick = true;
    this.time.delayedCall(80, () => {
      this.uiBlockClick = false;
    });
  }

  /** Draw a right-pointing arrow in local space (rotation 0 = east) */
  drawHomeChevron() {
    const g = this.homeArrow;
    g.clear();
    g.fillStyle(0xfbbf24, 1);
    // Shaft
    g.fillTriangle(8, -5, 8, 5, 18, 0);
    g.fillRect(-10, -3, 18, 6);
    g.lineStyle(1, 0xfef3c7, 0.9);
    g.strokeTriangle(8, -5, 8, 5, 18, 0);
  }

  toggleSneak() {
    this.sneaking = !this.sneaking;
    if (this.sneaking) this.running = false;
    this.syncMoveModeButtons();
    this.updateSneakRing();
    this.log(
      this.sneaking
        ? 'SNEAK ON: green detector ring = your quiet zone. Breaks if spotted.'
        : 'SNEAK off: normal walk.'
    );
  }

  syncMoveModeButtons() {
    if (this.btnRun) {
      this.btnRun.label.setText(this.running ? 'RUN ✓' : 'WALK');
      this.btnRun.bg.setFillStyle(this.running ? 0xf97316 : 0x475569);
    }
    if (this.btnSneak) {
      this.btnSneak.label.setText(this.sneaking ? 'SNEAK ✓' : 'SNEAK');
      this.btnSneak.bg.setFillStyle(this.sneaking ? 0x22c55e : 0x64748b);
    }
  }

  /** Mid-run menu: help blurb, mute, narrator, restart. Pauses world. */
  openRunMenu() {
    if (this.menuOpen) {
      this.closeRunMenu();
      return;
    }
    if (this.bagOpen) this.equipUI?.close();
    if (this.craftOpen) this.craftPanel?.toggle(false);
    this.menuOpen = true;
    this.clearMousePath();
    this.uiBlockClick = true;
    this.moreOpen = false;
    this.legendOpen = false;
    this.specialOpen = false;

    DomUi.clearModal();
    const root = DomUi.show('modal-ui', 'modal');
    root.addEventListener('pointerup', (e) => {
      if (e.target === root) this.closeRunMenu();
    });

    const sheet = DomUi.el('div', 'sheet');
    sheet.appendChild(DomUi.el('div', 'sheet-title', 'RUN MENU'));
    sheet.appendChild(
      DomUi.el(
        'div',
        'sheet-body',
        'WHO: Runner  ·  WHAT: Breach Kit, escape\n' +
          'WHEN: Day safer · Night dogs  ·  WHERE: HQ center, Wall edges\n' +
          'HOW: Click map · BAG equip · CRAFT at purple rig · HEAL kits\n' +
          'Street Charge (Boom craft): detonates near foes. Loud.\n' +
          'Camera: edge-pan or middle-mouse drag.'
      )
    );

    const soundOn = this.audio?.on !== false;
    const narr = this.story?.narratorOn !== false;
    const actions = DomUi.el('div', 'sheet-actions');
    const mk = (label, color, fn, ghost) => {
      const btn = DomUi.button(`hit sheet-btn${ghost ? ' ghost' : ''}`, label, fn);
      btn.style.background = DomUi.hexCss(color);
      if (ghost) btn.style.color = '#e2e8f0';
      actions.appendChild(btn);
    };

    mk(soundOn ? 'SOUND: ON' : 'SOUND: OFF', soundOn ? 0x22c55e : 0x64748b, () => {
      const next = !this.audio.on;
      if (this.audio.setMuted) this.audio.setMuted(!next);
      else this.audio.on = next;
      this.closeRunMenu();
      this.openRunMenu();
      this.log(this.audio.on ? 'Sound ON.' : 'Sound muted.');
    });
    mk(narr ? 'NARRATOR: ON' : 'NARRATOR: OFF', narr ? 0x7c3aed : 0x64748b, () => {
      this.story.narratorOn = !this.story.narratorOn;
      this.story.persist();
      this.closeRunMenu();
      this.openRunMenu();
      this.log(this.story.narratorOn ? 'Narrator ON.' : 'Narrator OFF.');
    });
    mk('SAVE RUN', 0x0ea5e9, () => {
      const ok = this.autosave('manual') || SaveSystem.save(this);
      this.log(
        ok
          ? 'Run saved. CONTINUE from main menu anytime (long runs welcome).'
          : 'Save failed.'
      );
      this.closeRunMenu();
    });
    mk('NEW RUN (menu)', 0xe11d48, () => {
      this.closeRunMenu();
      this.audio.stopWorldAmb?.();
      DomUi.clearAll();
      this.scene.start('Menu');
    });
    mk('CLOSE', 0x94a3b8, () => this.closeRunMenu(), true);

    sheet.appendChild(actions);
    root.appendChild(sheet);
    this.menuUi = [root];
    this.time.delayedCall(100, () => {
      if (this.menuOpen) this.uiBlockClick = false;
    });
  }

  closeRunMenu() {
    this.menuOpen = false;
    DomUi.clearModal();
    this.menuUi = [];
    this.clearMousePath();
    this.uiBlockClick = true;
    this.time.delayedCall(120, () => {
      this.uiBlockClick = false;
    });
  }

  openHelpPanel() {
    this.openRunMenu();
  }

  openBagPanel() {
    this.closeMoreMenu();
    this.closeRunMenu();
    this.clearMousePath();
    this.equipUI?.toggle();
    if (this.bagOpen) {
      // Coach banner done its job once BAG is open
      this.hideGuideToast?.();
      this.log('BAG open. Tap an item to equip, or tap a slot to unequip.');
    }
  }

  /** MAP button → full city map (paused). */
  toggleLegend() {
    this.cityMap?.toggle?.();
  }

  closeLegend() {
    this.cityMap?.close?.();
    this.legendOpen = false;
    DomUi.clearModal();
    this.legendUi = [];
    this.clearMousePath();
    this.uiBlockClick = true;
    this.time.delayedCall(120, () => {
      this.uiBlockClick = false;
    });
  }

  /**
   * DOM HUD button adapter (absolute position on modal layer).
   * Prefer bar rebuild / sheet builders for new UI.
   */
  makeUiButton(x, y, w, h, label, color, onClick, _depth = 121, _hitPad) {
    const parent = DomUi.modal() || DomUi.hud();
    const b = DomUi.absButton(parent, x, y, w, h, label, color, () => {
      this.uiBlockClick = true;
      onClick?.();
      this.time.delayedCall(80, () => {
        this.uiBlockClick = false;
      });
    });
    return b;
  }

  /** ATK shown on HUD / combat: base + weapon + live char bonuses (never baked into gear). */
  playerEffectiveAtk() {
    let a = this.inv.totalAtk(this.player.baseAtk);
    const w = this.inv.weapon;
    if (w && this.player.batBonus && (w.id === 'pipe' || w.id === 'stick')) a += this.player.batBonus;
    if (w?.ranged && this.player.rangedBonus) a += this.player.rangedBonus;
    return a;
  }

  refreshHud() {
    const p = this.player;
    if (!p) return;
    const atk = this.playerEffectiveAtk();
    const def = this.inv.totalDef(p.baseDef);
    const zId = this.zones.getZone(p.tx, p.ty);
    const zoneHud = this.zones.hudLine(p.tx, p.ty);
    const zoneCss = this.zones.css(zId);

    // One status only (left). Never put HOSTILE under inventory.
    if (this.mode === 'combat') {
      this.alertText.setText('⚔ COMBAT');
      this.alertText.setColor('#ef4444');
    } else {
      this.alertText.setText(this.alert.label);
      this.alertText.setColor(this.alert.color);
    }

    const prog = this.progression?.summary?.() || '';
    if (this.isMobileHud()) {
      this.statText.setFontSize('10px');
      this.statText.setText(
        `HP ${p.hp}/${p.maxHp}  ATK ${atk}  DEF ${def}  ·  ${zoneHud}${this.hiding ? '  · HIDING' : ''}`
      );
    } else {
      this.statText.setFontSize('12px');
      this.statText.setText(
        `HP ${p.hp}/${p.maxHp}  ATK ${atk}  DEF ${def}  ·  ${prog}  ·  ${zoneHud}${this.hiding ? '  · HIDING' : ''}`
      );
    }
    // Color the status strip zone token (whole line is fine — ring color is the tell)
    if (this.domStat && this.mode !== 'combat') {
      this.domStat.style.borderLeft = `3px solid ${zoneCss}`;
      this.domStat.style.paddingLeft = '6px';
    }

    const s = this.inv.summary();
    this.invText.setText(`${s.mats}\n${s.gear}\nBP ${[...this.inv.blueprints].length}`);

    this.syncMoveModeButtons();
    if (this.btnSleep) {
      const kits = this.countBedrolls();
      this.btnSleep.label.setText(kits > 0 ? `SLEEP×${kits}` : 'SLEEP');
    }
    if (this.btnHeal) {
      this.btnHeal.label.setText(this.healButtonLabel());
    }
    this.updateDayBar();
    if (this.heat && this.heatText) {
      const h = Math.round(this.heat.level);
      this.heatText.setText(`GRID HEAT ${h}`);
      this.heatText.setColor(this.heat.color);
      this.runStats.maxHeat = Math.max(this.runStats.maxHeat || 0, h);
      if (this.domHeatFill) {
        this.domHeatFill.style.width = `${Math.max(1, this.heat.level)}%`;
        this.domHeatFill.style.background = this.heat.color;
      }
    }
    this.updateCombatHud();
    this.updateHomeArrow();
    this.updateSneakRing();
    if (this.objText) this.objText.setText(this.objective || '');
    // Gold pulse is enough — no floating ▲ triangle over the target
    if (this.objMarker) this.objMarker.setVisible(false);
  }

  /** Quest 0 hand-hold: suppress random fights / night packs until bandage step done. */
  isGuideHandhold() {
    return !!(this.guide && !this.guide.done && this.guide.isHandhold?.());
  }

  log(msg) {
    // While coach card is open, don't stack a second gold bar underneath
    if (this.isGuideToastOpen?.()) {
      if (this.mode === 'combat') this.combatLog(msg);
      return;
    }
    this.domToast?.classList.remove('hidden');
    this.logText.setText(msg);
    // Always mirror into combat log during fights
    if (this.mode === 'combat') this.combatLog(msg);
  }

  combatLog(msg) {
    if (!msg) return;
    this.combatLogLines.push(msg);
    if (this.combatLogLines.length > 8) this.combatLogLines.shift();
    if (this.combatLogText) {
      this.combatLogText.setText(this.combatLogLines.join('\n'));
    }
  }

  updateCombatHud() {
    if (!this.domCombat) return;
    const show = this.mode === 'combat';
    this.domCombat.classList.toggle('hidden', !show);
    this.combatHud.visible = show;
    if (!show) return;

    const p = this.player;
    const pPct = Math.max(0, p.hp / p.maxHp);
    if (this.domPlayerBarFill) {
      this.domPlayerBarFill.style.width = `${Math.round(pPct * 100)}%`;
      this.domPlayerBarFill.style.background = DomUi.hexCss(
        pPct > 0.5 ? 0x22c55e : pPct > 0.25 ? 0xeab308 : 0xef4444
      );
    }
    this.playerBarLabel.setText(
      `YOU  ${p.hp}/${p.maxHp}  (${this.inv.weapon?.name || 'Fists'} ATK ${this.playerEffectiveAtk()})`
    );

    let foe = this.combatFocus?.alive ? this.combatFocus : null;
    if (!foe) {
      const t = this.livingThreats();
      foe = t[0] || null;
      this.combatFocus = foe;
    }
    if (foe) {
      const ePct = Math.max(0, foe.hp / foe.maxHp);
      if (this.domEnemyBarFill) {
        this.domEnemyBarFill.style.width = `${Math.round(ePct * 100)}%`;
        this.domEnemyBarFill.style.background = DomUi.hexCss(0xef4444);
      }
      const rangeNote = foe.ranged ? 'ranged' : 'melee';
      this.enemyBarLabel.setText(`${foe.name}  ${foe.hp}/${foe.maxHp}  (${rangeNote})`);
    } else {
      if (this.domEnemyBarFill) this.domEnemyBarFill.style.width = '0%';
      this.enemyBarLabel.setText('No target');
    }
  }

  /** True while any modal is open  -  freezes world time & AI */
  isPaused() {
    return !!(
      this.popupOpen ||
      this.craftOpen ||
      this.legendOpen ||
      this.mapOpen ||
      this.bagOpen ||
      this.menuOpen ||
      this.specialOpen ||
      this.moreOpen
    );
  }

  /** Mark FOW tiles known for the city map overlay. */
  markExploredAround(cx, cy, radius) {
    if (!this.explored) this.explored = new Set();
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (Math.abs(dx) + Math.abs(dy) > radius) continue;
        const x = cx + dx;
        const y = cy + dy;
        if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) continue;
        this.explored.add(x + y * MAP_W);
      }
    }
  }

  spawnGuideDog() {
    if (this.guideDog?.alive) return;
    // A short hike away (not at their feet)
    const candidates = [];
    for (const [dx, dy] of [
      [0, -6],
      [5, 0],
      [-5, 0],
      [0, 5],
      [4, -4],
      [-4, -4],
      [3, 3],
      [0, -8],
      [7, 0],
      [-7, 0],
      [0, 7],
      [6, 6],
      [-6, 6],
    ]) {
      candidates.push([this.player.tx + dx, this.player.ty + dy]);
    }
    // Also try absolute near HQ ring
    candidates.push(
      [CENTER_X + 5, CENTER_Y - 5],
      [CENTER_X - 4, CENTER_Y + 4],
      [CENTER_X + 8, CENTER_Y],
      [CENTER_X, CENTER_Y + 8]
    );
    // Spiral fallback so quest 2 never softlocks
    for (let r = 3; r <= 14; r++) {
      for (let a = 0; a < 8; a++) {
        const ang = (a / 8) * Math.PI * 2;
        candidates.push([
          (this.player.tx + Math.cos(ang) * r) | 0,
          (this.player.ty + Math.sin(ang) * r) | 0,
        ]);
      }
    }
    for (const [x, y] of candidates) {
      if (this.walkable(x, y) && !this.actorAt(x, y) && !this.isSpawnBlockedTile?.(x, y)) {
        const dog = makeEnemy(this, x, y, ENEMY.dog, 'dog');
        dog.nightOnly = false;
        dog._dormant = false;
        dog._isGuideDog = true; // survives dawn dog cull
        this.enemies.push(dog);
        this.guideDog = dog;
        this.log('A Grid Dog pads in. Follow the pulse. Tap it.');
        return;
      }
    }
    // Absolute last resort: any walkable free tile in mid ring
    for (let y = 10; y < MAP_H - 10; y++) {
      for (let x = 10; x < MAP_W - 10; x++) {
        if (!this.walkable(x, y) || this.actorAt(x, y)) continue;
        const dog = makeEnemy(this, x, y, ENEMY.dog, 'dog');
        dog.nightOnly = false;
        dog._dormant = false;
        dog._isGuideDog = true;
        this.enemies.push(dog);
        this.guideDog = dog;
        this.log('A Grid Dog pads in. Follow the pulse. Tap it.');
        return;
      }
    }
  }

  /** Clear gold CSS pulse from bottom-bar buttons. */
  clearDomBtnPulses() {
    for (const b of this.actionButtons || []) {
      b.el?.classList?.remove('hud-btn-pulse');
    }
    this.btnBag?.el?.classList?.remove('hud-btn-pulse');
    this.btnCraft?.el?.classList?.remove('hud-btn-pulse');
    this.btnSleep?.el?.classList?.remove('hud-btn-pulse');
  }

  /** Pulse ring on the current guide target (tile or DOM UI button). */
  updateQuestPulse(dt = 0) {
    this._pulseT = (this._pulseT || 0) + dt;
    const world = this.questPulseWorld;
    const ui = this.questPulseUi;
    world?.clear();
    ui?.clear();
    this.clearDomBtnPulses();
    if (this.mode === 'combat') return;
    if (this.bagOpen || this.craftOpen || this.menuOpen || this.legendOpen || this.mapOpen) return;

    let target = null;
    if (this.guide && !this.guide.done) target = this.guide.resolveTarget();
    else if (this.escape?.active()) target = this.escape.resolveTarget();
    if (!target) return;

    const phase = (Math.sin(this._pulseT * 5.5) + 1) / 2;
    const a = 0.45 + phase * 0.55;
    const mobile = this.isMobileHud();
    // Pulse frames the whole tile — big enough to match HUD type weight
    const base = Math.max(28, TILE * 0.72);
    const r = base + phase * (mobile ? TILE * 0.35 : TILE * 0.28);
    // Sit above modal dimmer (500) so edge beacons stay visible while reading GOT IT
    if (ui) ui.setDepth(this.popupOpen ? 520 : 140);

    if (target.ui) {
      // DOM bar buttons — CSS pulse (Phaser hit-rect pulse is dead after DomUi bar)
      if (this.popupOpen) return;
      const btn =
        target.ui === 'bag'
          ? this.btnBag
          : target.ui === 'craft'
            ? this.btnCraft
            : target.ui === 'sleep'
              ? this.btnSleep
              : null;
      if (btn?.el) btn.el.classList.add('hud-btn-pulse');
      return;
    }

    const ox = target.tx ?? target.x;
    const oy = target.ty ?? target.y;
    if (ox == null || oy == null) return;
    const wx = ox * TILE + TILE / 2;
    const wy = oy * TILE + TILE / 2;

    // World pulse only when world is visible (not under a modal)
    if (!this.popupOpen && world) {
      const outer = r + Math.max(10, TILE * 0.18) + phase * Math.max(8, TILE * 0.12);
      world.lineStyle(Math.max(3, TILE * 0.08), 0xfbbf24, a);
      world.strokeCircle(wx, wy, r);
      world.lineStyle(Math.max(2, TILE * 0.05), 0xfef08a, a * 0.8);
      world.strokeCircle(wx, wy, outer);
      // Soft square “box” so it reads like a target frame around the tile
      const half = TILE * 0.48 + phase * TILE * 0.06;
      world.lineStyle(Math.max(2, TILE * 0.05), 0xfbbf24, a * 0.85);
      world.strokeRect(wx - half, wy - half, half * 2, half * 2);
      world.fillStyle(0xfbbf24, 0.08 + phase * 0.1);
      world.fillCircle(wx, wy, r * 0.9);
    }

    // When pulsing the HQ workbench, also light CRAFT on the bar
    if (
      this.guide &&
      !this.guide.done &&
      this.guide.quest === 0 &&
      this.guide.flags?.equippedStick &&
      this.guide.flags?.equippedHat &&
      !this.guide.flags?.bandage &&
      this.btnCraft?.el &&
      !this.popupOpen
    ) {
      this.btnCraft.el.classList.add('hud-btn-pulse');
    }

    // Screen-edge beacon when off-screen, or always under a modal (world hidden by dimmer)
    this.drawOffscreenGuideBeacon(ui, wx, wy, phase, a, !!this.popupOpen);
  }

  /**
   * Draw a gold chevron on the screen edge pointing at a world target when off-screen.
   * force=true: always show (used under modals so "follow the pulse" is visible).
   */
  drawOffscreenGuideBeacon(ui, worldX, worldY, phase, a, force = false) {
    if (!ui || !this.cameras?.main) return;
    const cam = this.cameras.main;
    const sx = (worldX - cam.worldView.x) * cam.zoom;
    const sy = (worldY - cam.worldView.y) * cam.zoom;
    const mobile = this.isMobileHud();
    const m = this.barMetrics();
    // Keep clear of center modal + HUD when forced
    const margin = force ? 36 : 28;
    const left = margin;
    const right = cam.width - margin;
    const top = force ? (mobile ? 112 : 72) : mobile ? 108 : 64;
    const bot = cam.height - Math.max(force ? 110 : 100, m.hudBottom + 8);
    const onScreen = sx >= left && sx <= right && sy >= top && sy <= bot;
    if (onScreen && !force) return;

    // When forced and target is "on screen", still park beacon on the nearest edge
    // so it is not buried under the center panel.
    let cx;
    let cy;
    if (force) {
      const midX = cam.width / 2;
      const midY = cam.height / 2;
      const dx = sx - midX;
      const dy = sy - midY;
      // Project onto screen rectangle edge from center toward target
      const scaleX = dx === 0 ? Infinity : (dx > 0 ? right - midX : midX - left) / Math.abs(dx);
      const scaleY = dy === 0 ? Infinity : (dy > 0 ? bot - midY : midY - top) / Math.abs(dy);
      const s = Math.min(scaleX, scaleY);
      cx = midX + dx * s;
      cy = midY + dy * s;
      cx = Phaser.Math.Clamp(cx, left, right);
      cy = Phaser.Math.Clamp(cy, top, bot);
    } else {
      cx = Phaser.Math.Clamp(sx, left, right);
      cy = Phaser.Math.Clamp(sy, top, bot);
    }

    const ang = Math.atan2(sy - cy, sx - cx) || Math.atan2(sy - cam.height / 2, sx - cam.width / 2);
    const pulse = (mobile ? 14 : 10) + phase * (mobile ? 10 : 8);

    ui.lineStyle(mobile ? 4 : 3, 0xfbbf24, a);
    ui.strokeCircle(cx, cy, pulse);
    ui.fillStyle(0xfbbf24, 0.35 + phase * 0.25);
    ui.fillCircle(cx, cy, (mobile ? 8 : 6) + phase * 2);
    const len = mobile ? 20 : 16;
    const ex = cx + Math.cos(ang) * len;
    const ey = cy + Math.sin(ang) * len;
    ui.lineStyle(3, 0xfef08a, a);
    ui.lineBetween(cx, cy, ex, ey);
    ui.fillStyle(0xfef08a, a);
    ui.fillTriangle(
      ex,
      ey,
      ex - Math.cos(ang - 0.5) * 8,
      ey - Math.sin(ang - 0.5) * 8,
      ex - Math.cos(ang + 0.5) * 8,
      ey - Math.sin(ang + 0.5) * 8
    );
  }

  updateDayBar() {
    if (!this.domDayFill || !this.dayBarLabel) return;
    const fill = this.dayNight.barFill; // day fills → night drains
    this.domDayFill.style.width = `${Math.max(2, fill * 100)}%`;
    let col = 0xfbbf24; // day gold
    if (this.dayNight.isNight) col = 0x6366f1; // night indigo
    else if (fill > 0.85) col = 0xf97316; // late day / dusk
    this.domDayFill.style.background = DomUi.hexCss(col);
    const phase = this.dayNight.isNight ? 'NIGHT' : fill > 0.85 ? 'DUSK' : 'DAY';
    this.dayBarLabel.setText(`Day ${this.dayNight.day} · ${phase}`);
    this.dayBarLabel.setColor('#f8fafc');
  }

  /**
   * Story / tutorial modal — DOM text (crisp Inter), not Phaser Text.
   * Uses modal layer so in-run HUD stays mounted. See VISUAL-STYLE.md.
   */
  showPopup(title, body, onClose, opts = {}) {
    if (typeof onClose === 'object' && onClose !== null) {
      opts = onClose;
      onClose = opts.onClose;
    }
    if (this.popupOpen) {
      this.popupQueue.push({ title, body, onClose, opts });
      return;
    }
    this.popupOpen = true;
    this.clearMousePath();
    this.movePath = [];

    const hasCheck = !!opts.checkboxLabel;
    let checked = opts.checkboxDefault === true;

    DomUi.clearModal();
    const root = DomUi.show(opts.slowIn ? 'popup-ui popup-enter' : 'popup-ui', 'modal');
    if (!root) {
      this.popupOpen = false;
      return;
    }
    // Slow fade-in when requested (tutorial boot after map breathe)
    if (opts.slowIn) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => root.classList.add('popup-visible'));
      });
    }

    const panel = DomUi.el('div', 'popup-panel');
    panel.appendChild(DomUi.el('div', 'popup-title', title));
    panel.appendChild(DomUi.el('div', 'popup-body', body));

    let checkInput = null;
    if (hasCheck) {
      const row = DomUi.el('label', 'popup-check');
      checkInput = document.createElement('input');
      checkInput.type = 'checkbox';
      checkInput.checked = checked;
      checkInput.addEventListener('change', () => {
        checked = !!checkInput.checked;
      });
      row.appendChild(checkInput);
      row.appendChild(document.createTextNode(opts.checkboxLabel));
      panel.appendChild(row);
    }

    const finish = (fromOk) => {
      if (!this.popupOpen) return;
      if (checkInput) checked = !!checkInput.checked;
      DomUi.clearModal();
      this.popupOpen = false;
      this._popupFinish = null;
      this.clearMousePath();
      if (fromOk && opts.onConfirm) opts.onConfirm(checked);
      if (typeof onClose === 'function') onClose(checked);
      if (this.popupQueue.length) {
        const n = this.popupQueue.shift();
        this.time.delayedCall(50, () => {
          this.showPopup(n.title, n.body, n.onClose, n.opts || {});
        });
      }
    };
    this._popupFinish = finish;

    panel.appendChild(DomUi.button('hit popup-ok', 'GOT IT', () => finish(true)));
    root.appendChild(panel);

    // Dimmer click closes only when there is no checkbox (avoid mis-taps)
    if (!hasCheck) {
      root.addEventListener('pointerup', (e) => {
        if (e.target === root) finish(true);
      });
    }
  }

  explainPickup(kind, detail) {
    const key = `pick_${kind}`;
    if (kind !== 'blueprint' && this.help.seen.has(key)) {
      this.log(detail);
      return;
    }
    this.help.seen.add(key);
    const titles = {
      loot: 'LOOT CRATE',
      blueprint: 'BLUEPRINT',
      sleep: 'SLEEP SPOT',
      bench: 'STREET RIG',
      escape: 'ESCAPE PAD',
    };
    this.showPopup(titles[kind] || 'FOUND', detail);
  }

  /** Blueprint-specific modal with hunt-list checkbox (time frozen) */
  showBlueprintPopup(bpId) {
    const bp = BLUEPRINTS[bpId];
    if (!bp) return;
    const storyCard = this.story.onBlueprint(bpId, bp.name);
    const needs = Object.entries(bp.needs)
      .map(([m, n]) => `${MAT[m]?.name || m} ×${n}`)
      .join('\n');
    const body = storyCard
      ? `${storyCard.body}\n\nNeeds:\n${needs}\n\nCraft at a purple Street Rig when ready.`
      : `You found the blueprint: ${bp.name}.\n\n` +
        `Needs:\n${needs}\n\n` +
        `Craft at a purple Street Rig when you have the parts.\n` +
        `(Time is paused while this is open.)`;

    this.showPopup(storyCard?.title || 'BLUEPRINT', body, null, {
      checkboxLabel: 'Track materials (show hunt list on screen)',
      checkboxDefault: false,
      onConfirm: (checked) => {
        if (checked) this.addHunt(bpId);
        else this.log(`Learned ${bp.name}. Open CRAFT at a purple bench when ready.`);
        this.checkEscape();
      },
    });
  }

  addHunt(bpId) {
    const bp = BLUEPRINTS[bpId];
    if (!bp) return;
    // replace if already hunting same
    this.huntList = this.huntList.filter((h) => h.bpId !== bpId);
    this.huntList.push({
      bpId,
      name: bp.name,
      needs: { ...bp.needs },
    });
    this.log(`Hunting materials for ${bp.name}.`);
    this.refreshHuntHud();
  }

  clearHunt(bpId) {
    this.huntList = this.huntList.filter((h) => h.bpId !== bpId);
    this.refreshHuntHud();
  }

  refreshHuntHud() {
    this.huntList = this.huntList.filter((h) => {
      const result = BLUEPRINTS[h.bpId]?.result;
      if (result && this.inv.items.some((i) => i.id === result)) return false;
      if (result === 'pipe' && this.inv.weapon?.id === 'pipe') return false;
      if (result === 'zipgun' && this.inv.weapon?.id === 'zipgun') return false;
      if (result === 'vest' && this.inv.armor?.id === 'vest') return false;
      if (result === 'bedroll' && this.inv.countItem('bedroll') > 0 && this.inv.canCraft('bedroll')) {
        // keep hunting until they craft more if they want
      }
      return true;
    });

    if (!this.domHunt) return;
    if (!this.huntList.length) {
      this.domHunt.classList.add('hidden');
      this.domHunt.innerHTML = '';
      return;
    }

    const lines = ['HUNT LIST', ''];
    for (const h of this.huntList) {
      lines.push(`▸ ${h.name}`);
      for (const [m, need] of Object.entries(h.needs)) {
        const have = this.inv.count(m);
        const ok = have >= need;
        lines.push(`  ${ok ? '✓' : '○'} ${MAT[m]?.name || m} ${have}/${need}`);
      }
      lines.push('');
    }
    this.domHunt.classList.remove('hidden');
    this.domHunt.textContent = lines.join('\n').trimEnd();
    const clear = DomUi.button('hit hunt-clear', '✕ clear hunts', () => {
      this.huntList = [];
      this.refreshHuntHud();
      this.log('Hunt list cleared.');
    });
    this.domHunt.appendChild(clear);
  }

  updateObjective() {
    if (this.guide && !this.guide.done) {
      const gObj = this.guide.objectiveText();
      if (gObj) this.objective = gObj;
      this.objTarget = this.guide.resolveTarget();
      return;
    }
    if (this.escape?.active()) {
      const eObj = this.escape.objectiveText();
      if (eObj) this.objective = `OBJECTIVE: ${eObj.replace(/^→\s*/, '')}`;
      this.objTarget = this.escape.resolveTarget();
      return;
    }
    if (!this.inv.hasBlueprint('breach')) {
      const bp = this.bpSpots.find((b) => b.id === 'breach' && !b.taken);
      this.objective = 'OBJECTIVE: Find the BREACH KIT blueprint (pink, near north Wall)';
      this.objTarget = bp || { x: CENTER_X + 4, y: 9 };
    } else if (!this.inv.canCraft('breach') && !this.inv.hasBreach() && !this.inv.items.some((i) => i.id === 'breach')) {
      const miss = this.inv.missingFor('breach').join(', ') || 'materials';
      this.objective = `OBJECTIVE: Scavenge for Breach Kit (need ${miss})`;
      this.objTarget = this.nearestLoot() || this.benches[0];
    } else if (!this.inv.items.some((i) => i.id === 'breach')) {
      this.objective = 'OBJECTIVE: Craft BREACH KIT at purple bench (CRAFT)';
      this.objTarget = this.nearestBench();
    } else {
      this.objective = 'OBJECTIVE: Click gold ESCAPE pad on the edge (need Breach Kit)';
      this.objTarget = this.nearestEscapePad() || this.escapePads[0];
    }
  }

  nearestLoot() {
    let best = null;
    let bd = 1e9;
    for (const l of this.lootSpots) {
      if (l.taken) continue;
      const d = Math.abs(l.x - this.player.tx) + Math.abs(l.y - this.player.ty);
      if (d < bd) {
        bd = d;
        best = l;
      }
    }
    return best;
  }

  /** Prefer a walkable escape pad (north may still be a wall hole after stamp). */
  nearestEscapePad() {
    let best = null;
    let bd = 1e9;
    for (const p of this.escapePads || []) {
      if (this.blocked?.(p.x, p.y)) continue;
      if (this.ground?.[p.y]?.[p.x] !== T.ESCAPE) continue;
      const d =
        Math.abs(p.x - this.player.tx) + Math.abs(p.y - this.player.ty);
      if (d < bd) {
        bd = d;
        best = p;
      }
    }
    return best || this.escapePads?.[0] || null;
  }

  nearestBench() {
    let best = this.benches[0];
    let bd = 1e9;
    for (const b of this.benches) {
      const d = Math.abs(b.x - this.player.tx) + Math.abs(b.y - this.player.ty);
      if (d < bd) {
        bd = d;
        best = b;
      }
    }
    return best;
  }

  // ─── INPUT (mouse-first; touch long-press specials; keyboard still works) ───────
  setupInput() {
    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys({
      w: Phaser.Input.Keyboard.KeyCodes.W,
      a: Phaser.Input.Keyboard.KeyCodes.A,
      s: Phaser.Input.Keyboard.KeyCodes.S,
      d: Phaser.Input.Keyboard.KeyCodes.D,
      e: Phaser.Input.Keyboard.KeyCodes.E,
      c: Phaser.Input.Keyboard.KeyCodes.C,
      g: Phaser.Input.Keyboard.KeyCodes.G,
      f: Phaser.Input.Keyboard.KeyCodes.F,
      h: Phaser.Input.Keyboard.KeyCodes.H,
      space: Phaser.Input.Keyboard.KeyCodes.SPACE,
      shift: Phaser.Input.Keyboard.KeyCodes.SHIFT,
      one: Phaser.Input.Keyboard.KeyCodes.ONE,
      two: Phaser.Input.Keyboard.KeyCodes.TWO,
      three: Phaser.Input.Keyboard.KeyCodes.THREE,
      four: Phaser.Input.Keyboard.KeyCodes.FOUR,
      five: Phaser.Input.Keyboard.KeyCodes.FIVE,
      six: Phaser.Input.Keyboard.KeyCodes.SIX,
    });

    this.input.on('pointerup', (p) => {
      // End middle-mouse / right-drag / touch free-pan
      if (p.button === 1 || this._midDrag || this._touchDrag) {
        this._midDrag = null;
        this._touchDrag = null;
        this._pinchStart = null;
        this._edgePanIdle = 0;
        this.cancelLongPress();
        return;
      }

      // Right-click: pan if dragged; else combat specials (short click)
      if (p.button === 2 || this._rightDrag) {
        const dragged = !!this._rightDrag?.moved;
        this._rightDrag = null;
        this._edgePanIdle = 0;
        this.cancelLongPress();
        if (!dragged && this.mode === 'combat' && !this.isPaused() && !this.ended) {
          this.openCombatSpecials?.();
        }
        return;
      }

      const longFired = !!this._longPress?.fired;
      this.cancelLongPress();
      if (longFired) {
        // Long-press already opened specials; do not also walk/attack
        return;
      }

      if (this.ended || this.uiBlockClick) return;
      // Never path while any modal is open (bag close was causing auto-walk)
      if (
        this.popupOpen ||
        this.craftOpen ||
        this.legendOpen ||
        this.bagOpen ||
        this.menuOpen ||
        this.moreOpen ||
        this.specialOpen
      ) {
        return;
      }
      if (this.isPaused()) return;

      // Ignore top HUD / bottom action bar
      if (this.hudPointerZone(p)) return;

      const wpt = this.cameras.main.getWorldPoint(p.x, p.y);
      const tx = (wpt.x / TILE) | 0;
      const ty = (wpt.y / TILE) | 0;
      this.handleWorldClick(tx, ty, false);
    });

    this.input.on('pointerdown', (p) => {
      // Middle-mouse drag pan
      if (p.button === 1) {
        if (this.ended || this.isPaused()) return;
        this.beginFreeCam();
        this._midDrag = {
          x: p.x,
          y: p.y,
          scrollX: this.cameras.main.scrollX,
          scrollY: this.cameras.main.scrollY,
        };
        this._edgePanIdle = 0;
        return;
      }

      // Right-click drag pan (grab map). Short click in combat still opens specials.
      if (p.button === 2) {
        if (this.ended || this.isPaused()) return;
        if (this.hudPointerZone(p)) return;
        this.beginFreeCam();
        this._rightDrag = {
          x: p.x,
          y: p.y,
          scrollX: this.cameras.main.scrollX,
          scrollY: this.cameras.main.scrollY,
          moved: false,
        };
        this._edgePanIdle = 0;
        return;
      }

      // Primary press: arm long-press for combat specials (touch + mouse hold)
      if (p.button !== 0 && p.button != null) return;
      if (this.ended || this.uiBlockClick || this.isPaused()) return;
      if (this.hudPointerZone(p)) return;

      this.cancelLongPress();
      this._longPress = {
        x: p.x,
        y: p.y,
        fired: false,
        timer: this.time.delayedCall(480, () => {
          if (!this._longPress) return;
          this._longPress.fired = true;
          this.onLongPressMap();
        }),
      };
    });

    this.input.on('pointermove', (p) => {
      // Pinch zoom (two fingers on touch devices)
      if (this.isTouchInput() && this.mode !== 'combat' && !this.isPaused()) {
        const p1 = this.input.pointer1;
        const p2 = this.input.pointer2;
        if (p1?.isDown && p2?.isDown) {
          const dist = Phaser.Math.Distance.Between(p1.x, p1.y, p2.x, p2.y);
          if (!this._pinchStart) {
            this._pinchStart = { dist, zoom: this.cameras.main.zoom };
            this._touchDrag = null;
            this.cancelLongPress();
            this.beginFreeCam();
          } else if (dist > 0) {
            const cam = this.cameras.main;
            const z = Phaser.Math.Clamp(
              this._pinchStart.zoom * (dist / this._pinchStart.dist),
              0.4,
              1.75
            );
            cam.setZoom(z);
            this.clampCamScroll();
          }
          this._edgePanIdle = 0;
          return;
        }
        if (this._pinchStart && (!p1?.isDown || !p2?.isDown)) {
          this._pinchStart = null;
        }
      }

      // Cancel long-press if finger/mouse slides too far; start touch drag on phones
      if (this._longPress && !this._longPress.fired && p.isDown) {
        const dx = p.x - this._longPress.x;
        const dy = p.y - this._longPress.y;
        if (dx * dx + dy * dy > 18 * 18) {
          if (
            this.isTouchInput() &&
            !this.hudPointerZone(p) &&
            this.mode !== 'combat' &&
            !this.isPaused()
          ) {
            this.cancelLongPress();
            this.beginFreeCam();
            this._touchDrag = {
              x: p.x,
              y: p.y,
              scrollX: this.cameras.main.scrollX,
              scrollY: this.cameras.main.scrollY,
            };
          } else {
            this.cancelLongPress();
          }
        }
      }

      if (this._touchDrag && p.isDown && !this._pinchStart) {
        const cam = this.cameras.main;
        cam.scrollX = this._touchDrag.scrollX - (p.x - this._touchDrag.x) / cam.zoom;
        cam.scrollY = this._touchDrag.scrollY - (p.y - this._touchDrag.y) / cam.zoom;
        this.clampCamScroll();
        this._edgePanIdle = 0;
        return;
      }

      // Right-button grab-pan
      if (this._rightDrag && p.isDown) {
        const cam = this.cameras.main;
        const dx = p.x - this._rightDrag.x;
        const dy = p.y - this._rightDrag.y;
        if (dx * dx + dy * dy > 9) this._rightDrag.moved = true;
        cam.scrollX = this._rightDrag.scrollX - dx / cam.zoom;
        cam.scrollY = this._rightDrag.scrollY - dy / cam.zoom;
        this.clampCamScroll();
        this._edgePanIdle = 0;
        return;
      }

      if (!this._midDrag || !p.isDown) return;
      const cam = this.cameras.main;
      const dx = p.x - this._midDrag.x;
      const dy = p.y - this._midDrag.y;
      cam.scrollX = this._midDrag.scrollX - dx / cam.zoom;
      cam.scrollY = this._midDrag.scrollY - dy / cam.zoom;
      this.clampCamScroll();
      this._edgePanIdle = 0;
    });

    this.input.mouse?.disableContextMenu();
  }

  cancelLongPress() {
    if (this._longPress?.timer) {
      try {
        this._longPress.timer.remove?.(false);
      } catch (_) {
        /* ignore */
      }
    }
    this._longPress = null;
  }

  /** Long-press map during combat → specials (mobile substitute for right-click). */
  onLongPressMap() {
    if (this.ended || this.popupOpen || this.specialOpen) return;
    if (this.mode === 'combat' && this.combatTurn === 'player') {
      this.uiBlockClick = true;
      this.openCombatSpecials();
      this.log('Specials (long-press). Or tap SPEC on the bar.');
      this.time.delayedCall(100, () => {
        this.uiBlockClick = false;
      });
    }
  }

  handleWorldClick(tx, ty, rightClick = false) {
    if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) return;

    // Combat mode: left-click attack, right-click specials
    if (this.mode === 'combat') {
      if (this.combatTurn !== 'player' || this.popupOpen) {
        this.log('Wait  -  enemy turn / popup.');
        return;
      }
      if (rightClick) {
        this.openCombatSpecials();
        return;
      }
      const foe = this.actorAt(tx, ty, this.player);
      if (foe && !foe.isPlayer && foe.alive) {
        this.combatAttackTarget(foe);
        return;
      }
      const dist = Math.abs(tx - this.player.tx) + Math.abs(ty - this.player.ty);
      if (dist === 1 && this.walkable(tx, ty) && !this.actorAt(tx, ty, this.player)) {
        this.playerCombatStep(tx - this.player.tx, ty - this.player.ty);
      } else if (dist > 1) {
        // step one tile toward click (no free-path spam in combat)
        this.combatStepToward(tx, ty);
      }
      return;
    }

    // Left-click enemy = fight. Right-click enemy = fight then specials menu.
    const enemy = this.actorAt(tx, ty, this.player);
    if (enemy && !enemy.isPlayer && !enemy._dormant) {
      this.clearMousePath();
      this.startCombat(enemy, true);
      if (rightClick) {
        this.time.delayedCall(50, () => this.openCombatSpecials());
      }
      return;
    }

    // Same tile or interactable: use
    const interactive = this.isInteractiveTile(tx, ty);
    if (tx === this.player.tx && ty === this.player.ty) {
      this.useTile();
      return;
    }

    if (rightClick && interactive) {
      this.setMousePath(tx, ty, true);
      return;
    }

    if (interactive) {
      // Path to tile then auto-use
      const d = Math.abs(tx - this.player.tx) + Math.abs(ty - this.player.ty);
      if (d <= 1 && this.walkable(tx, ty)) {
        // step on then use
        this.setMousePath(tx, ty, true);
      } else if (d <= 1) {
        // adjacent blocked? try use if standing on related - else path next to
        this.setMousePath(tx, ty, true);
      } else {
        this.setMousePath(tx, ty, true);
      }
      return;
    }

    // Walkable ground
    if (this.walkable(tx, ty)) {
      this.setMousePath(tx, ty, false);
      return;
    }

    this.log('Can’t go there.');
  }

  isInteractiveTile(tx, ty) {
    const g = this.ground[ty]?.[tx];
    if (
      g === T.LOOT ||
      g === T.SLEEP ||
      g === T.BENCH ||
      g === T.ESCAPE ||
      g === T.LANDMARK ||
      g === T.GEAR_DROP ||
      g === T.GEAR_STICK ||
      g === T.GEAR_HAT
    )
      return true;
    if (this.lootSpots.some((l) => l.x === tx && l.y === ty && !l.taken)) return true;
    if (this.sleeps.some((s) => s.x === tx && s.y === ty)) return true;
    if (this.benches.some((b) => b.x === tx && b.y === ty)) return true;
    if (this.bpSpots.some((b) => b.x === tx && b.y === ty && !b.taken)) return true;
    return false;
  }

  setMousePath(tx, ty, autoUse) {
    // Allow pathing onto interactive even if "blocked" by nothing  -  interactives are walkable
    const walkFn = (x, y) => {
      if (x === tx && y === ty) return !this.blocked(x, y) || this.isInteractiveTile(x, y);
      if (this.actorAt(x, y, this.player)) return false;
      return this.walkable(x, y);
    };

    // If target not walkable but interactive, path to nearest adjacent walkable
    let gx = tx;
    let gy = ty;
    if (!this.walkable(tx, ty) && this.isInteractiveTile(tx, ty)) {
      // still walkable for loot etc usually
    }
    if (!walkFn(gx, gy) && !(gx === this.player.tx && gy === this.player.ty)) {
      // find adjacent walkable
      let found = null;
      for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
        const nx = tx + dx;
        const ny = ty + dy;
        if (this.walkable(nx, ny) && !this.actorAt(nx, ny, this.player)) {
          found = { x: nx, y: ny };
          break;
        }
      }
      if (!found) {
        this.log('No path.');
        return;
      }
      gx = found.x;
      gy = found.y;
      autoUse = true; // still want to use the original? store original
      this.moveGoalInteract = { x: tx, y: ty };
    } else {
      this.moveGoalInteract = autoUse ? { x: tx, y: ty } : null;
    }

    const path = findPath(this.player.tx, this.player.ty, gx, gy, walkFn, 1200);
    if (!path || !path.length) {
      if (gx === this.player.tx && gy === this.player.ty) {
        if (autoUse) this.useTile();
        return;
      }
      this.log('No path  -  walls or fog of geometry.');
      return;
    }
    this.movePath = path;
    this.moveGoal = { x: gx, y: gy };
    this.autoUseOnArrive = !!autoUse;
    this.drawPathPreview();
  }

  clearMousePath() {
    this.movePath = [];
    this.moveGoal = null;
    this.autoUseOnArrive = false;
    this.moveGoalInteract = null;
    this.pathGfx?.clear();
  }

  drawPathPreview() {
    this.pathGfx.clear();
    if (!this.movePath.length) return;
    this.pathGfx.lineStyle(2, 0x38bdf8, 0.55);
    let px = this.player.tx * TILE + TILE / 2;
    let py = this.player.ty * TILE + TILE / 2;
    this.pathGfx.beginPath();
    this.pathGfx.moveTo(px, py);
    for (const s of this.movePath) {
      this.pathGfx.lineTo(s.x * TILE + TILE / 2, s.y * TILE + TILE / 2);
    }
    this.pathGfx.strokePath();
    const last = this.movePath[this.movePath.length - 1];
    this.pathGfx.fillStyle(0x38bdf8, 0.35);
    this.pathGfx.fillCircle(last.x * TILE + TILE / 2, last.y * TILE + TILE / 2, Math.max(6, TILE / 5));
  }

  /** HEAL button: bandages / stim / MRE, or Street Charge in combat. */
  healButtonLabel() {
    const heals =
      this.inv.countItem('bandage') + this.inv.countItem('stim') + this.inv.countItem('mre');
    if (heals > 1) return `HEAL×${heals}`;
    if (heals === 1) return 'HEAL';
    const charges = this.inv.countItem('charge');
    if (charges > 1) return `CHRG×${charges}`;
    if (charges === 1) return 'CHRG';
    return 'HEAL';
  }

  useQuickKit() {
    if (this.useBandage()) return;
    if (this.useStreetCharge()) return;
    this.log('No heal kit or Street Charge. Craft one or put it in QUICK 1/2.');
  }

  useBandage() {
    // Prefer bandage, then stim, then MRE. Bag or QUICK slots.
    const tryHeal = (id, label) => {
      if (this.inv.countItem(id) <= 0) return false;
      const r = this.inv.useConsumable(id, this.player);
      if (!r) return false;
      // Character healBonus (e.g. Doc Rue) stacks after base heal (not on tiny MRE)
      let bonus = 0;
      if (this.player.healBonus && id !== 'mre') {
        bonus = this.player.heal(this.player.healBonus);
      }
      const total = (r.healed || 0) + bonus;
      this.log(`${label}: +${total} HP.`);
      this.refreshHud();
      return true;
    };
    if (tryHeal('bandage', 'Bandage')) return true;
    if (tryHeal('stim', 'Stim')) return true;
    if (tryHeal('mre', 'MRE Paste')) return true;
    return false;
  }

  /**
   * Boom Chi fantasy: detonate Street Charge.
   * Hits all living enemies within 2 tiles. Power + explosiveBonus.
   */
  useStreetCharge() {
    if (this.inv.countItem('charge') <= 0) return false;
    const pulled = this.inv.takeConsumable('charge');
    if (!pulled?.item) return false;

    const power = (pulled.item.power || 6) + (this.player.explosiveBonus || 0);
    const px = this.player.tx;
    const py = this.player.ty;
    const hits = [];
    for (const e of [...this.enemies]) {
      if (!e.alive || e._dormant) continue;
      const d = Math.abs(e.tx - px) + Math.abs(e.ty - py);
      if (d <= 2) hits.push(e);
    }

    this.audio.red();
    this.vfx?.burst(this.player.x, this.player.y, 0xf97316, 14);
    this.vfx?.pulseRing(this.player.x, this.player.y, 0xef4444);
    this.alert.makeNoise(
      1,
      px,
      py,
      this.enemies.filter((e) => e.alive && !e._dormant)
    );

    if (!hits.length) {
      this.log(`Street Charge boom (+${power} max). Nobody close enough.`);
      this.refreshHud();
      return true;
    }

    const wasCombat = this.mode === 'combat';
    for (const e of hits) {
      if (!e.alive) continue;
      const dmg = Math.max(1, power - (e.def || 0) + ((Math.random() * 2) | 0));
      e.hp = Math.max(0, e.hp - dmg);
      e.refreshHp();
      this.vfx?.floatText(e.x, e.y - 8, `-${dmg}`, '#fbbf24', 18);
      this.vfx?.burst(e.x, e.y, 0xef4444, 6);
      const line = `Charge hits ${e.name} for ${dmg}${e.hp <= 0 ? '  -  DOWN!' : ''}`;
      if (wasCombat) this.combatLog(line);
      this.log(line);
      if (e.hp <= 0) {
        e.alive = false;
        if (e === this.guideDog || e._isGuideDog) this._guideDogDead = true;
        const xpGain = e.xp || 4;
        if (this.progression) {
          const res = this.progression.gain(xpGain, this.player);
          this.log(`+${xpGain} XP${res.leveled ? `  ·  Level ${this.progression.level}!` : ''}`);
        }
        try {
          e.destroy();
        } catch (_) {
          /* gone */
        }
        this.enemies = this.enemies.filter((x) => x !== e && x.alive);
      }
    }
    this.checkGuide();
    this.refreshHud();

    // If used as combat action, spend the turn. Else engage survivors only.
    if (wasCombat) {
      this.checkCombatEnd();
      if (this.mode === 'combat' && this.player.alive) this.afterPlayerCombat();
    } else {
      const live = hits.find((e) => e.alive);
      if (live) this.startCombat(live, true);
    }
    return true;
  }

  update(_t, dtMs) {
    if (this.ended) return;
    const dt = dtMs / 1000;

    if (this.help.enabled) this.helpText.setText(this.help.line || '');

    // Keys that work anytime
    if (Phaser.Input.Keyboard.JustDown(this.keys.h)) {
      const on = this.help.toggle();
      this.log(on ? 'Help ON  -  the city still hates you, but now with captions.' : 'Help OFF. Fly blind, legend.');
      this.refreshHud();
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.space)) {
      if (this.help.enabled) {
        this.help.next();
        this.refreshHud();
      }
    }

    // Pause world when any modal is open (freeze camera + no HUD thrash)
    if (this.isPaused()) {
      if (this.cameras?.main) {
        this.cameras.main.setScroll(
          Math.round(this.cameras.main.scrollX),
          Math.round(this.cameras.main.scrollY)
        );
      }
      // Keep screen-edge / UI guide beacon visible under popups so "follow the pulse" is real
      this.updateObjective();
      this.questPulseWorld?.clear();
      this.updateQuestPulse(dt);
      this.cityMap?.update?.();
      return;
    }

    if (this.mode === 'combat') {
      this.updateCombat(dt);
      this.refreshHud();
      this.questPulseWorld?.clear();
      this.questPulseUi?.clear();
      return;
    }

    // Explore real-time
    this.updateCameraEdgePan(dt);
    this.updateGuideCamSoftFollow(dt);
    this.dayNight.update(dt);
    this.nightVeil.setAlpha(this.dayNight.isNight ? 0.45 : 0.05);
    this.alert.update(dt, this.hiding);
    this.heat?.update(dt, this);
    // Autosave every ~90s so long escape runs survive browser closes
    this._autosaveAcc = (this._autosaveAcc || 0) + dt;
    if (this._autosaveAcc >= 90) {
      this._autosaveAcc = 0;
      this.autosave('tick');
    }
    if (this.alert.state === ALERT.RED && this.mode !== 'combat' && !this.isGuideHandhold()) {
      const near = this.enemies.find(
        (e) => e.alive && !e._dormant && Math.abs(e.tx - this.player.tx) + Math.abs(e.ty - this.player.ty) <= 8
      );
      if (near) this.startCombat(near, false);
    }

    this.moveCd = Math.max(0, this.moveCd - dtMs);
    const shiftRun = this.keys.shift.isDown;

    this.handleExploreMove(shiftRun);
    this.handleMousePathStep(shiftRun);
    this.enemyExploreAI(dt);

    // Occasional ambient narrator (only if enabled and free). Longer cooldown.
    // Quiet during tutorial boot + early guide so popups do not stack on the hand-hold.
    if (!this.popupOpen && !this._storyQuiet && this.story?.narratorOn && this.guide?.done) {
      this._ambT = (this._ambT || 0) + dt;
      if (this._ambT > 28) {
        this._ambT = 0;
        const amb = this.story.ambientChance();
        if (amb) this.showPopup(amb.title, amb.body);
      }
    }

    // Zone story once when entering (skipped until boot card dismissed)
    if (!this._storyQuiet) {
      const zNow = this.zones.getZone(this.player.tx, this.player.ty);
      if (zNow !== this._lastStoryZone) {
        this._lastStoryZone = zNow;
        const zc = this.story.onZone(zNow);
        if (zc) {
          if (this.guide?.done) {
            this.log(`${zc.title}: ${zc.body.split('\n')[0]}`);
          } else {
            this.time.delayedCall(200, () => this.showPopup(zc.title, zc.body));
          }
        }
      }
    }

    this.updateZoneAtmosphere(dt);
    this.updateWallBeacon(dt);
    this.updateHeatVignette(dt);

    if (Phaser.Input.Keyboard.JustDown(this.keys.e)) this.useTile();
    if (Phaser.Input.Keyboard.JustDown(this.keys.c)) this.toggleCraft();
    if (Phaser.Input.Keyboard.JustDown(this.keys.g)) this.tryHide();
    if (Phaser.Input.Keyboard.JustDown(this.keys.f)) this.toggleSneak();
    if (Phaser.Input.Keyboard.JustDown(this.keys.one)) this.tryCraftKey(0);
    if (Phaser.Input.Keyboard.JustDown(this.keys.two)) this.tryCraftKey(1);
    if (Phaser.Input.Keyboard.JustDown(this.keys.three)) this.tryCraftKey(2);
    if (Phaser.Input.Keyboard.JustDown(this.keys.four)) this.tryCraftKey(3);
    if (Phaser.Input.Keyboard.JustDown(this.keys.five)) this.tryCraftKey(4);
    if (Phaser.Input.Keyboard.JustDown(this.keys.six)) this.tryCraftKey(5);

    // LOS spot check vs nearby enemies
    this.checkSpotting();

    this.updateFow();
    this.updateObjective();
    this.updateQuestPulse(dt);
    this.cityMap?.update?.();
    this.refreshHud();
  }

  handleExploreMove(shiftRun = false) {
    if (this.moveCd > 0 || this.popupOpen) return;
    let dx = 0;
    let dy = 0;
    if (this.cursors.left.isDown || this.keys.a.isDown) dx = -1;
    else if (this.cursors.right.isDown || this.keys.d.isDown) dx = 1;
    else if (this.cursors.up.isDown || this.keys.w.isDown) dy = -1;
    else if (this.cursors.down.isDown || this.keys.s.isDown) dy = 1;
    if (!dx && !dy) return;
    this.clearMousePath();
    this.tryStep(dx, dy, shiftRun);
  }

  handleMousePathStep(shiftRun = false) {
    if (this.moveCd > 0 || !this.movePath.length || this.popupOpen) return;
    const next = this.movePath[0];
    const dx = next.x - this.player.tx;
    const dy = next.y - this.player.ty;
    if (Math.abs(dx) + Math.abs(dy) !== 1) {
      if (this.moveGoal) this.setMousePath(this.moveGoal.x, this.moveGoal.y, this.autoUseOnArrive);
      return;
    }
    const ok = this.tryStep(dx, dy, shiftRun);
    if (ok) {
      this.movePath.shift();
      this.drawPathPreview();
      if (!this.movePath.length) {
        const use = this.autoUseOnArrive;
        this.clearMousePath();
        // Gear/loot/blueprints already auto-picked on step. Only auto-USE if the
        // tile still wants an action (bench craft, sleep, escape) — never fall
        // through into "no heal kit" spam.
        if (use && this.isInteractiveTile(this.player.tx, this.player.ty)) {
          this.useTile();
        }
      }
    } else {
      this.clearMousePath();
    }
  }

  /** @returns {boolean} moved */
  tryStep(dx, dy, shiftRun = false) {
    const nx = this.player.tx + dx;
    const ny = this.player.ty + dy;
    const foe = this.actorAt(nx, ny, this.player);
    if (foe && !foe.isPlayer && !foe._dormant) {
      this.clearMousePath();
      this.startCombat(foe, true);
      return false;
    }
    if (!this.walkable(nx, ny)) return false;

    this.player.setTile(nx, ny, true);
    this.audio.move();
    this.hiding = false;
    const isRun = (this.running || shiftRun) && !this.sneaking;
    const isSneak = this.sneaking && !isRun;
    const moveMul = 1 - (this.player.moveBonus || 0) * 0.12;
    let baseMs = PLAYER.moveMs * Math.max(0.7, moveMul);
    if (isSneak) baseMs *= 1.45 - (this.player.sneakBonus || 0) * 0.05;
    if (isRun) baseMs *= 0.65;
    this.moveCd = baseMs;

    // Hat + character sneakBonus quiet you further while sneaking
    const sneakGear = this.playerSneakBonus();
    let noise = isRun ? PLAYER.noiseRun : isSneak ? PLAYER.noiseWalk * 0.35 : PLAYER.noiseWalk;
    if (isSneak && sneakGear > 0) noise *= Math.max(0.15, 1 - sneakGear * 0.12);
    const res = this.alert.makeNoise(
      noise,
      nx,
      ny,
      this.enemies.filter((e) => e.alive && !e._dormant)
    );
    if (res.result === 'yellow') {
      this.heat?.onNoise();
      this.audio.yellow();
      this.help.once(
        'yellow',
        'CAUTION: Something heard you. Click HIDE, or sneak (RUN off). More noise → HOSTILE.'
      );
      this.log('Footsteps echo. Yellow alert  -  click HIDE or stay quiet.');
    } else if (res.result === 'spotted') {
      this.heat?.onSpotted();
      this.audio.red();
      this.log('Spotted! The street just became a war crime.');
      const near = res.hearers?.[0];
      if (near) this.startCombat(near, false);
    }

    this.onStepTile();
    return true;
  }

  onStepTile() {
    const g = this.ground[this.player.ty][this.player.tx];
    const { tx, ty } = this.player;

    // Gear drops (stick, hat, etc.)
    const drop = this.gearDrops?.find((d) => !d.taken && d.x === tx && d.y === ty);
    if (drop) {
      drop.taken = true;
      const item = this.inv.addItem(drop.id);
      this.ground[ty][tx] = T.ALLEY;
      this.gLayer.putTileAt(T.ALLEY, tx, ty);
      this.log(`Picked up ${item?.name || drop.id}.`);
      // Guide coach cards handle the hand-hold; avoid stacking a second popup
      if (!this.guide || this.guide.done || this.guide.quest > 0) {
        this.showPopup(
          'GEAR PICKUP',
          `You grabbed: ${item?.name || drop.id}.\n\n${item?.desc || ''}\n\nOpen BAG. Click or drag onto the matching slot.`
        );
      }
      this.checkGuide();
    }

    // Gold crates: auto-scavenge on step (same as gear/blueprints — USE still works)
    const openLoot = this.lootSpots?.find((l) => !l.taken && l.x === tx && l.y === ty);
    if (openLoot || g === T.LOOT) {
      this.scavenge(tx, ty);
    }

    // auto-pickup blueprint when walking on landmark
    const bp = this.bpSpots.find((b) => !b.taken && b.x === tx && b.y === ty);
    if (bp) {
      bp.taken = true;
      this.inv.learnBlueprint(bp.id);
      this.audio.scavenge();
      this.ground[ty][tx] = T.ALLEY;
      this.gLayer.putTileAt(T.ALLEY, tx, ty);
      this.showBlueprintPopup(bp.id);
      this.time.delayedCall(50, () => {
        this.checkGuide();
        this.checkEscape();
      });
    }

    if (g === T.ESCAPE || this.ground[ty][tx] === T.ESCAPE) this.tryEscape();
    this.checkEscape();
    this.syncBenchCraftPanel();
  }

  /** Auto-open craft panel at bench; close when walking away. */
  syncBenchCraftPanel() {
    if (this.mode === 'combat' || this.bagOpen || this.popupOpen || this.ended) return;
    // Early guide: don't pop RECIPES over the loot hike (only after stick+hat equipped)
    if (this.isGuideHandhold()) {
      const f = this.guide?.flags;
      if (!f?.equippedStick || !f?.equippedHat) {
        if (this.craftOpen && this._benchAutoCraft) {
          this._benchAutoCraft = false;
          this.craftPanel?.toggle(false);
        }
        return;
      }
    }
    const near = this.isNearBench();
    if (!near) {
      this._benchCraftDismissed = false;
      if (this._benchAutoCraft && this.craftOpen) {
        this._benchAutoCraft = false;
        this.craftPanel.toggle(false);
      }
      return;
    }
    if (this._benchCraftDismissed || this.craftOpen) return;
    this._benchAutoCraft = true;
    this.craftPanel.toggle(true);
  }

  updateHeatVignette(dt) {
    void dt;
    if (!this.heatVignette || this.mode === 'combat') return;
    const level = this.heat?.level || 0;
    if (level < 60) {
      this.heatVignette.clear();
      this.heatVignette.setAlpha(0);
      return;
    }
    const pulse = 0.65 + 0.35 * Math.sin(this.time.now / 1000 * 4);
    this.vfx?.heatVignette?.(level, pulse);
  }

  useTile() {
    const { tx, ty } = this.player;
    const g = this.ground[ty][tx];

    if (g === T.LOOT || this.lootSpots.some((l) => l.x === tx && l.y === ty && !l.taken)) {
      this.scavenge(tx, ty);
      return;
    }
    if (g === T.SLEEP || this.sleeps.some((s) => s.x === tx && s.y === ty)) {
      // Standing on a bed tile still uses full sleep rules
      this.doSleep();
      return;
    }
    if (g === T.BENCH || this.benches.some((b) => b.x === tx && b.y === ty)) {
      this.explainPickup(
        'bench',
        'Street Rig  -  your craft table.\n\nClick CRAFT (or wait  -  opening now). Recipes list exact parts. Green row = ready to make.'
      );
      this.toggleCraft(true);
      return;
    }
    if (g === T.ESCAPE) {
      this.tryEscape();
      return;
    }
    this.useQuickKit();
  }

  scavenge(tx, ty) {
    const spot = this.lootSpots.find((l) => l.x === tx && l.y === ty);
    if (spot?.taken) {
      this.log('Already stripped clean.');
      return;
    }
    if (spot) spot.taken = true;
    if (this.ground[ty][tx] === T.LOOT) {
      this.ground[ty][tx] = T.ALLEY;
      this.gLayer.putTileAt(T.ALLEY, tx, ty);
    }

    // roll mats  -  guide crate always yields enough cloth for bandage
    // food mat rolls become MRE Paste items (real consumable)
    const table = ['scrap', 'scrap', 'wire', 'cloth', 'battery', 'chem', 'circuit', 'mre', 'scrap'];
    const z = this.zones.getZone(tx, ty);
    const lootBonus = this.zones.meta(tx, ty).lootBonus || 0;
    const rolls = 2 + lootBonus + (this.player.scavengeBonus || 0);
    const got = [];
    const isGuideCrate = !!spot?.guide;
    const isEscapeCache = !!spot?.escapeCache;
    if (isGuideCrate) {
      this.inv.addMat('cloth', 2);
      this.inv.addMat('scrap', 1);
      got.push(MAT.cloth.name, MAT.cloth.name, MAT.scrap.name);
      this._guideLooted = true;
    } else if (isEscapeCache) {
      this.inv.addMat('scrap', 4);
      this.inv.addMat('wire', 2);
      this.inv.addMat('battery', 1);
      got.push(MAT.scrap.name, MAT.scrap.name, MAT.scrap.name, MAT.scrap.name, MAT.wire.name, MAT.wire.name, MAT.battery.name);
      this.log('Wall cache cracked. Half a Breach Kit worth of parts.');
    } else {
      for (let i = 0; i < rolls; i++) {
        let id = table[(Math.random() * table.length) | 0];
        if (this.dayNight.isNight && Math.random() < 0.15) id = 'circuit';
        if (id === 'mre') {
          this.inv.addItem('mre');
          got.push('MRE Paste');
        } else {
          this.inv.addMat(id, 1);
          got.push(MAT[id]?.name || id);
        }
      }
    }
    this.audio.scavenge();
    this.alert.makeNoise(0.35, tx, ty, this.enemies.filter((e) => e.alive && !e._dormant));
    if (!isGuideCrate && !this._firstLootDone) {
      this._firstLootDone = true;
      const card = this.story.onLoot(true);
      if (card) this.time.delayedCall(200, () => this.showPopup(card.title, card.body));
    }
    this.updateObjective();
    this.refreshHuntHud();
    this.log(`Scavenged: ${got.join(', ')}.`);
    this.checkGuide();
    this.checkEscape();
  }

  updateHomeArrow() {
    if (!this.homeArrow || !this.homeArrowLabel) return;
    // Direction from player to HQ in world space (y grows downward  -  matches Phaser)
    const dx = CENTER_X - this.player.tx;
    const dy = CENTER_Y - this.player.ty;
    const dist = Math.abs(dx) + Math.abs(dy);
    if (dist <= 6) {
      this.homeArrow.setVisible(false);
      this.homeArrowLabel.setText('HOME');
      this.homeArrowLabel.setColor('#4ade80');
      return;
    }
    this.homeArrow.setVisible(true);
    this.homeArrowLabel.setColor('#fbbf24');
    // Graphics drawn pointing +X (east). Phaser rotation: +clockwise.
    // atan2(dy,dx) with y-down matches screen direction to HQ.
    const ang = Math.atan2(dy, dx);
    this.homeArrow.setRotation(ang);
    this.homeArrowLabel.setText(`HQ ${dist}`);
  }

  tryHide() {
    if (this.alert.state !== ALERT.YELLOW) {
      this.log('Hide when CAUTION is yellow. Right now you’re either fine or already screwed.');
      return;
    }
    this.hiding = true;
    const r = this.alert.tryHide();
    if (r.cleared) {
      this.log('You freeze in a doorway. The street forgets you. CLEAR.');
      this.help.once('hide', 'HOW: Hide works on CAUTION. On HOSTILE, only guns and bad decisions work.');
    } else {
      this.audio.red();
      this.log('Bad hide. Eyes on you. HOSTILE!');
      const near = this.enemies.find(
        (e) => e.alive && Math.abs(e.tx - this.player.tx) + Math.abs(e.ty - this.player.ty) < 10
      );
      if (near) this.startCombat(near, false);
    }
  }

  // Combat attacks are click-enemy only (FIGHT button removed)

  // ─── CRAFT (inline bench panel) ───
  toggleCraft(forceOpen) {
    this.craftPanel.toggle(forceOpen);
  }

  destroyCraftModal() {
    this.craftPanel.close();
  }

  buildCraftModal() {
    this.craftPanel.refresh();
  }

  tryCraftKey(index) {
    if (this.craftOpen || this.isNearBench()) this.craftPanel.tryHotkey(index);
  }

  tryCraftId(id) {
    if (!this.isNearBench()) {
      this.log('Stand on / next to a purple Street Rig, then craft.');
      return;
    }
    if (!this.inv.canCraft(id)) {
      this.log(`Missing: ${this.inv.missingFor(id).join(', ')}`);
      this.craftPanel.refresh();
      return;
    }
    const result = this.inv.craft(id, { craftBonus: this.player.craftBonus || 0 });
    if (!result?.gear) {
      this.log('Craft failed.');
      this.craftPanel.refresh();
      return;
    }
    const gear = result.gear;
    this.runStats.crafts = (this.runStats.crafts || 0) + 1;
    this.audio.craft();
    if (id === 'breach') {
      this.heat?.add(14, 'breach_craft');
      this.log('Grid scan spikes. They felt that weld.');
      this.vfx?.heatSweepFlash?.();
    }
    this.autosave?.('craft');
    let msg = `Crafted ${gear.name}. ${gear.desc}`;
    if (result.refunded) {
      msg += ` (${this.char?.name || 'You'} salvaged 1 ${MAT[result.refunded]?.name || result.refunded}.)`;
    }
    const q = this.inv.countItem(gear.id);
    if (STACKABLE.has(gear.id) && q > 0) msg += ` (${q} ready)`;
    this.log(msg);
    this.huntList = this.huntList.filter((h) => BLUEPRINTS[h.bpId]?.result !== gear.id);
    this.refreshHuntHud();
    this.craftPanel.refresh();
    this.updateObjective();
    this.refreshHud();
    this.checkGuide();
    this.checkEscape();
    const card = this.story.onCraft(gear.id, gear.name);
    if (this.guide && !this.guide.done) {
      /* checkGuide handles tutorial */
    } else if (card) {
      this.time.delayedCall(80, () => this.showPopup(card.title, card.body));
    }
  }

  /** Character sneak + equipped hat sneakBonus */
  playerSneakBonus() {
    let s = this.player.sneakBonus || 0;
    const hat = this.inv.equip?.head;
    if (hat?.sneakBonus) s += hat.sneakBonus;
    return s;
  }

  /** Day/night vision radius including character visionBonus */
  playerVision() {
    const base = this.dayNight.isNight ? PLAYER.visionNight : PLAYER.visionDay;
    return base + (this.player.visionBonus || 0);
  }

  // ─── STEALTH / SPOT ──────────────────────────────────
  checkSpotting() {
    if (this.alert.state === ALERT.RED) return;
    // Hand-hold: finish loot → equip → bandage before any street fight
    if (this.isGuideHandhold()) return;
    const vis = this.playerVision();
    const sneak = this.playerSneakBonus();
    for (const e of this.enemies) {
      if (!e.alive || e._dormant) continue;
      const d = Math.abs(e.tx - this.player.tx) + Math.abs(e.ty - this.player.ty);
      const theirVis = this.dayNight.isNight ? 5 : 7;
      if (d <= Math.min(vis, theirVis) && this.hasLos(e.tx, e.ty, this.player.tx, this.player.ty)) {
        // Sneak + gear = harder to spot; must be closer
        const spotRange = this.sneaking ? Math.max(1, 3 - Math.floor(sneak / 2)) : 5;
        if (d <= spotRange && !this.hiding) {
          this.sneaking = false;
          this.syncMoveModeButtons();
          this.updateSneakRing();
          this.alert.spot();
          this.heat?.onSpotted();
          this.audio.red();
          this.log(`${e.name} locks eyes. Sneak broken. HOSTILE.`);
          this.startCombat(e, false);
          return;
        }
      }
    }
  }

  hasLos(x0, y0, x1, y1) {
    let x = x0;
    let y = y0;
    const steps = Math.abs(x1 - x0) + Math.abs(y1 - y0);
    for (let i = 0; i < steps; i++) {
      if (Math.abs(x1 - x) >= Math.abs(y1 - y)) x += Math.sign(x1 - x);
      else y += Math.sign(y1 - y);
      if (x === x1 && y === y1) return true;
      if (this.blocked(x, y)) return false;
    }
    return true;
  }

  // ─── ENEMY EXPLORE AI ────────────────────────────────
  enemyExploreAI(dt) {
    this._aiAcc = (this._aiAcc || 0) + dt;
    if (this._aiAcc < 0.45) return;
    this._aiAcc = 0;

    const p = this.player;
    for (const e of this.enemies) {
      if (!e.alive || e._dormant) continue;
      const d = Math.abs(e.tx - p.tx) + Math.abs(e.ty - p.ty);
      if (d > 14) continue;

      // yellow: move toward noise
      if (this.alert.state === ALERT.YELLOW && this.alert.investigateFrom) {
        const t = this.alert.investigateFrom;
        this.stepEnemyToward(e, t.x, t.y);
        continue;
      }
      // patrol random
      if (Math.random() < 0.4) {
        const [dx, dy] = [[0, 1], [0, -1], [1, 0], [-1, 0]][(Math.random() * 4) | 0];
        const nx = e.tx + dx;
        const ny = e.ty + dy;
        if (this.walkable(nx, ny) && !this.actorAt(nx, ny, e)) e.setTile(nx, ny, true);
      }
    }
  }

  stepEnemyToward(e, tx, ty) {
    let best = null;
    let bd = Math.abs(e.tx - tx) + Math.abs(e.ty - ty);
    for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
      const nx = e.tx + dx;
      const ny = e.ty + dy;
      if (!this.walkable(nx, ny) || this.actorAt(nx, ny, e)) continue;
      const nd = Math.abs(nx - tx) + Math.abs(ny - ty);
      if (nd < bd) {
        bd = nd;
        best = { nx, ny };
      }
    }
    if (best) e.setTile(best.nx, best.ny, true);
  }

  // ─── FOW ─────────────────────────────────────────────
  isVisibleTile(tx, ty) {
    const vis = this.playerVision();
    const d = Math.abs(tx - this.player.tx) + Math.abs(ty - this.player.ty);
    if (d > vis) return false;
    return this.hasLos(this.player.tx, this.player.ty, tx, ty);
  }

  /** Active guide world tile (if any) — stay lit so the pulse/crate is readable. */
  guideRevealTile() {
    if (!this.guide || this.guide.done) return null;
    const t = this.guide.resolveTarget();
    if (!t || t.ui) return null;
    const x = t.tx ?? t.x;
    const y = t.ty ?? t.y;
    if (x == null || y == null) return null;
    return { x, y };
  }

  updateFow() {
    this.fow.clear();
    const cam = this.cameras.main;
    const l = ((cam.worldView.x / TILE) | 0) - 1;
    const r = (((cam.worldView.x + cam.worldView.width) / TILE) | 0) + 1;
    const t = ((cam.worldView.y / TILE) | 0) - 1;
    const b = (((cam.worldView.y + cam.worldView.height) / TILE) | 0) + 1;
    const vis = this.playerVision();
    const reveal = this.guideRevealTile();
    // Persist vision for city map (uncovered)
    this.markExploredAround(this.player.tx, this.player.ty, vis);
    if (reveal) this.markExploredAround(reveal.x, reveal.y, 2);

    for (let y = Math.max(0, t); y < Math.min(MAP_H, b); y++) {
      for (let x = Math.max(0, l); x < Math.min(MAP_W, r); x++) {
        // Keep current guide objective unfogged (and a 1-tile ring) so the gold pulse is obvious
        if (
          reveal &&
          Math.abs(x - reveal.x) <= 1 &&
          Math.abs(y - reveal.y) <= 1
        ) {
          continue;
        }
        const d = Math.abs(x - this.player.tx) + Math.abs(y - this.player.ty);
        if (d > vis + 2) {
          this.fow.fillStyle(0x020617, 0.88);
          this.fow.fillRect(x * TILE, y * TILE, TILE, TILE);
        } else if (d > vis || !this.hasLos(this.player.tx, this.player.ty, x, y)) {
          this.fow.fillStyle(0x020617, 0.5);
          this.fow.fillRect(x * TILE, y * TILE, TILE, TILE);
        }
      }
    }

    for (const e of this.enemies) {
      if (!e.alive) continue;
      if (e._dormant) {
        e.setVisible(false);
        continue;
      }
      e.setVisible(this.isVisibleTile(e.tx, e.ty));
    }
  }

  // ─── ESCAPE / END ────────────────────────────────────
  updateZoneAtmosphere(dt) {
    if (!this.zoneVeil) return;
    const z = this.zones.getZone(this.player.tx, this.player.ty);
    const t = ZONE_TINT[z] || ZONE_TINT.home || { c: 0x000000, a: 0 };
    if (!this._zoneTint) this._zoneTint = { a: 0, c: 0 };
    this._zoneTint.a += (t.a - this._zoneTint.a) * Math.min(1, dt * 2.2);
    this.zoneVeil.setFillStyle(t.c, this._zoneTint.a);
  }

  /** North Wall scan + breach landmark glow once tutorial ends. */
  updateWallBeacon(dt) {
    if (!this.wallGfx || !this.guide?.done) return;
    this._wallPulse = (this._wallPulse || 0) + dt;
    this.wallGfx.clear();
    const heat = this.heat?.level || 0;
    const pulse = 0.12 + Math.sin(this._wallPulse * 2.2) * 0.07 + heat * 0.0015;
    this.wallGfx.lineStyle(2, 0x38bdf8, pulse);
    for (let x = 2; x < MAP_W - 2; x += 3) {
      const wx = x * TILE + TILE / 2;
      const wobble = Math.sin(this._wallPulse * 1.8 + x * 0.25) * 5;
      this.wallGfx.lineBetween(wx, 6, wx, 22 + wobble);
    }
    if (!this.inv?.hasBlueprint('breach')) {
      const breach = this.bpSpots?.find((b) => b.id === 'breach');
      const bx = (breach?.x ?? CENTER_X) * TILE + TILE / 2;
      const by = (breach?.y ?? 5) * TILE + TILE / 2;
      const glow = 0.18 + Math.sin(this._wallPulse * 3) * 0.12;
      this.wallGfx.fillStyle(0xf472b6, glow);
      this.wallGfx.fillCircle(bx, by, 18 + Math.sin(this._wallPulse * 2.5) * 6);
    }
  }

  tryEscape() {
    if (!this.inv.items.some((i) => i.id === 'breach')) {
      this.log('Gold pad dead without a Breach Kit. Craft one. Steal the ending.');
      this.help.once('escape_need', 'WHAT: Escape pads need a Breach Kit in your pack.');
      return;
    }
    if (this._escaping) return;
    this._escaping = true;
    this.clearMousePath();

    // Prefer the pad you're on, else nearest walkable pad
    const onPad =
      this.ground[this.player.ty]?.[this.player.tx] === T.ESCAPE
        ? { x: this.player.tx, y: this.player.ty }
        : null;
    const pad = onPad || this.nearestEscapePad() || this.escapePads?.[0];
    const px = pad ? pad.x * TILE + TILE / 2 : this.player.x;
    const py = pad ? pad.y * TILE + TILE / 2 : this.player.y;

    const finishEscape = () => {
      this.inv.takeBreach();
      this.escape?.markEscaped?.();
      this.win();
    };

    const stepRun = () => {
      this.beginFreeCam?.();
      this.cameras.main.pan(px, py, 900, 'Cubic.easeInOut', true);
      this.time.delayedCall(950, () => {
        this.vfx.escapeFlash(px, py);
        this.showPopup(
          'RUN',
          'The pad lights. Step through.\n\nThe city loses you for one perfect second.',
          finishEscape
        );
      });
    };

    const stepBreach = () => {
      this.vfx.wallScan(40);
      this.vfx.screenShake(0.009, 200);
      this.showPopup(
        'BREACH ARMED',
        'Kit sparks alive. Wall sensors stutter.\nSensors hunt the wrong ghost.\n\nHold steady.',
        stepRun
      );
    };

    this.beginFreeCam?.();
    // Look at the north Wall band (y≈3 tiles), scaled for live TILE
    this.cameras.main.pan(CENTER_X * TILE + TILE / 2, 3 * TILE, 650, 'Sine.easeInOut', true);
    this.vfx.wallScan(56);
    this.time.delayedCall(700, stepBreach);
  }

  win() {
    if (this.ended) return;
    this.ended = true;
    this.audio.win();
    Leaderboards.recordEscape({
      days: this.dayNight?.day || 1,
      kills: this.runStats?.kills || 0,
      crafts: this.runStats?.crafts || 0,
      heat: Math.round(this.runStats?.maxHeat || this.heat?.maxSeen || 0),
      runner: this.char?.name || '',
      durationMs: this.runDurationMs(),
    });
    this.showEnd(true, 'The Wall blinks. You don’t. CITY BROKEN.');
  }

  lose() {
    if (this.ended) return;
    this.ended = true;
    Leaderboards.recordDeath({
      days: this.dayNight?.day || 1,
      kills: this.runStats?.kills || 0,
      crafts: this.runStats?.crafts || 0,
      runner: this.char?.name || '',
      durationMs: this.runDurationMs(),
    });
    this.showEnd(false, 'The grid keeps what it kills. Retry, Runner.');
  }

  showEnd(won, msg) {
    const days = this.dayNight?.day || 1;
    const kills = this.runStats?.kills || 0;
    const crafts = this.runStats?.crafts || 0;
    const heat = Math.round(this.runStats?.maxHeat || this.heat?.maxSeen || 0);
    const lvl = this.progression?.level || 1;
    const clock = Leaderboards.formatMs(this.runDurationMs());
    const stats =
      `Days survived: ${days}  ·  Clock: ${clock}\n` +
      `Kills: ${kills}  ·  Crafts: ${crafts}  ·  Level: ${lvl}\n` +
      `Peak grid heat: ${heat}`;
    const legacy = Leaderboards.summaryLine();

    DomUi.clearCraft();
    DomUi.clearModal();
    const root = DomUi.show('end-ui', 'modal');
    root.appendChild(
      DomUi.el('div', `end-title ${won ? 'win' : 'lose'}`, won ? 'YOU ESCAPED' : 'KIA')
    );
    root.appendChild(DomUi.el('div', 'end-msg', msg));
    root.appendChild(DomUi.el('div', 'end-stats', stats));
    root.appendChild(DomUi.el('div', 'end-legacy', legacy));

    const actions = DomUi.el('div', 'sheet-actions');
    const newRun = DomUi.button('hit sheet-btn', 'NEW RUN', () => {
      SaveSystem.clear();
      DomUi.clearAll();
      this.scene.restart();
    });
    newRun.style.background = DomUi.hexCss(won ? 0x0ea5e9 : 0xe11d48);
    newRun.style.color = '#fff';
    const menu = DomUi.button('hit sheet-btn ghost', 'MAIN MENU', () => {
      SaveSystem.clear();
      this.audio.stopWorldAmb?.();
      DomUi.clearAll();
      this.scene.start('Menu');
    });
    menu.style.background = DomUi.hexCss(0x334155);
    menu.style.color = '#fff';
    actions.appendChild(newRun);
    actions.appendChild(menu);
    root.appendChild(actions);
  }
}

Object.assign(GameScene.prototype, combatMixin, cameraMixin, sleepMixin);

function hash(x, y) {
  let n = x * 374761393 + y * 668265263;
  n = (n ^ (n >> 13)) * 1274126177;
  return Math.abs(n ^ (n >> 16));
}
