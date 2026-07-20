import Phaser from 'phaser';
import {
  ALERT,
  BLOCKING,
  BLUEPRINTS,
  CENTER_X,
  CENTER_Y,
  DAY_LENGTH,
  ENEMY,
  HELP_DEFAULT,
  MAP_H,
  MAP_W,
  MAT,
  NIGHT_START,
  PLAYER,
  T,
  TILE,
  WALKABLE,
  WORLD_H,
  WORLD_W,
  ZONE,
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
import { Minimap } from '../systems/Minimap.js';

export class GameScene extends Phaser.Scene {
  constructor() {
    super('Game');
  }

  create() {
    this.zones = new ZoneManager();
    const dayKey = this.registry.get('dayLength') || 'medium';
    this.dayNight = new DayNight(DAY_LENGTH[dayKey] || DAY_LENGTH.medium);
    this.alert = new AlertSystem();
    this.inv = new Inventory();
    this.help = new HelpDirector(HELP_DEFAULT);
    this.audio = new AudioBus();
    this.audio.ensure();

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
    this.runStats = { kills: 0, maxHeat: 0 };
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
    this.minimap = new Minimap(this);
    this.minimap.create();
    this.questPulseWorld = this.add.graphics().setDepth(27);
    this.questPulseUi = this.add.graphics().setScrollFactor(0).setDepth(140);
    this._pulseT = 0;
    this.scale.on('resize', (gameSize) => this.onResize(gameSize));

    // Quest 1 always knows how to craft a bandage (no blueprint hunt for tutorial)
    this.inv.learnBlueprint('bandage');

    this.cameras.main.setZoom(1);
    this.input.on('wheel', (_p, _o, _dx, dy) => {
      void dy;
    });

    this.dayNight.on((ev) => {
      if (ev === 'night') {
        this.audio.night();
        this.heat?.onNight();
        this.log('Night crawls in. Something howls like a broken siren.');
        this.refreshNightSpawns(true);
        const card = this.story.onNight();
        if (card) this.time.delayedCall(120, () => this.showPopup(card.title, card.body));
      }
      if (ev === 'day') {
        this.log('Dawn. Even the graffiti looks tired.');
        this.refreshNightSpawns(false);
      }
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
      } else {
        this.time.delayedCall(400, () => this.showTutorialBoot());
      }
    } else {
      this.updateObjective();
      this.updateFow();
      this.refreshHud();
      this.cameras.main.fadeIn(400);
      // Single boot card (intro + quest 1 merged). No second modal.
      this.time.delayedCall(400, () => this.showTutorialBoot());
    }

    // Dev / playtest harness (console + automated smoke)
    if (typeof window !== 'undefined') {
      window.__CITY_WARS__ = this;
    }
  }

  /** One intro modal for a new run. Unlocks story + nudges camera to the gold target. */
  showTutorialBoot() {
    const intro = this.story.introCard(this.char, { compact: true });
    this.showPopup(intro.title, intro.body, () => {
      this._storyQuiet = false;
      this.updateObjective();
      this.refreshHud();
      this.nudgeCameraTowardGuide();
    });
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
   * Relocks after a short peek.
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
    // Blend player + target so both stay in frame when possible
    const cx = px * 0.45 + tx * 0.55;
    const cy = py * 0.45 + ty * 0.55;

    this.beginFreeCam?.();
    cam.centerOn(cx, cy);
    this.clampCamScroll?.();
    this._edgePanIdle = 0;
    // Longer peek on small screens
    const peekMs = this.scale.width < 600 ? 2200 : 1600;
    this.time.delayedCall(peekMs, () => {
      if (!this.ended) this.relockCameraToPlayer?.();
    });
  }

  /** Dismiss current modal if open (playtest helper + keyboard escape path). */
  dismissPopup() {
    if (!this.popupOpen) return false;
    // Prefer the registered closer (runs onClose: story quiet, camera nudge, etc.)
    if (typeof this._popupFinish === 'function') {
      this._popupFinish(true);
      return true;
    }
    const kids = this.children.list.filter((c) => c.depth >= 500);
    kids.forEach((c) => {
      try {
        c.destroy?.();
      } catch (_) {
        /* ignore */
      }
    });
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
      equip: Object.fromEntries(
        Object.entries(this.inv?.equip || {}).map(([k, v]) => [k, v?.id || null])
      ),
      blueprints: [...(this.inv?.blueprints || [])],
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

  /** Teleport for playtests (keeps path clear). */
  debugWarp(tx, ty) {
    if (!this.walkable(tx, ty) && !this.isInteractiveTile(tx, ty)) return false;
    this.clearMousePath();
    this.player.setTile(tx, ty, false);
    this.relockCameraToPlayer();
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

    // Micro-coach steps: toast only (no full modal stack)
    if (!next.id) {
      this.log(String(next.body || '').replace(/\n/g, ' '));
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

  onResize(gameSize) {
    const w = gameSize.width;
    const h = gameSize.height;
    this.cameras.main.setSize(w, h);
    this.cameras.main.setZoom(1);
    this.cameras.main.setDeadzone(w * 0.2, h * 0.18);

    if (this.topBar) {
      this.topBar.setSize(w, 52);
      this.topBar.setPosition(0, 0);
    }
    if (this.objText) {
      this.objText.setPosition(w / 2, 6);
      this.objText.setWordWrapWidth?.(Math.min(420, w * 0.42));
    }
    if (this.invText) this.invText.setPosition(w - 14, 10);
    if (this.dayBarBg) this.dayBarBg.setPosition(w / 2, 42);
    if (this.dayBarFill) this.dayBarFill.setPosition(w / 2 - 100, 42);
    if (this.dayBarLabel) this.dayBarLabel.setPosition(w / 2, 42);
    if (this.logText) this.logText.setPosition(w / 2, h - 100);
    if (this.combatHud?.visible) this.combatHud.setPosition(12, 64);
    if (this.bottomBar) {
      this.bottomBar.setPosition(w / 2, h - 58);
      this.bottomBar.setSize(w, 52);
    }
    // Rebuild bar so MORE / SPEC slots match new width + combat state
    if (this.actionButtons) this.rebuildActionBar();
    if (this.moreOpen) {
      this.closeMoreMenu();
    }
    if (this.homeArrow) this.homeArrow.setPosition(36, h - 96);
    if (this.homeArrowLabel) this.homeArrowLabel.setPosition(36, h - 74);
    this.minimap?.onResize?.();
  }

  /** True when the bottom bar should collapse secondary actions into MORE. */
  isNarrowBar(w = this.scale.width) {
    return w < 700;
  }

  /** Fit visible action buttons into any width. */
  layoutActionBar(w = this.scale.width, h = this.scale.height, n = 0) {
    const count = n || this.actionButtons?.length || 8;
    const narrow = this.isNarrowBar(w);
    const pad = narrow ? 8 : 48;
    const usable = Math.max(160, w - pad * 2);
    const gap = usable / count;
    const btnW = Math.min(80, Math.max(narrow ? 34 : 48, gap - (narrow ? 2 : 6)));
    const btnH = narrow ? 36 : 40;
    const fontSize = narrow ? (btnW < 42 ? '9px' : '11px') : '13px';
    const startX = w / 2 - ((count - 1) * gap) / 2;
    return { n: count, pad, usable, gap, btnW, btnH, fontSize, startX, y: h - 58 };
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
   * Visible bottom-bar slots for current width + combat mode.
   * Narrow phones: primary + MORE. Combat always exposes SPEC.
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
    return ['use', 'sleep', 'hide', 'craft', 'heal', 'bag', 'more'];
  }

  /** Secondary actions shown inside the MORE sheet. */
  getMoreMenuIds() {
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
        b.bg?.destroy?.();
        b.label?.destroy?.();
      } catch (_) {
        /* ignore */
      }
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

  /** Rebuild bottom bar for width / combat (destroys + recreates buttons). */
  rebuildActionBar() {
    const d = 120;
    const w = this.scale.width;
    const h = this.scale.height;
    if (!this.bottomBar) return;

    this.clearActionButtons();
    const catalog = this.barActionCatalog();
    const ids = this.getVisibleBarIds();
    const layout = this.layoutActionBar(w, h, ids.length);

    ids.forEach((id, i) => {
      const def = catalog[id];
      if (!def) return;
      const x = layout.startX + i * layout.gap;
      const b = this.makeUiButton(x, layout.y, layout.btnW, layout.btnH, def.label, def.color, def.fn, d + 1);
      if (b.label?.setFontSize) b.label.setFontSize(layout.fontSize);
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
    this.syncMoveModeButtons();
    // Refresh sleep kit count label if present
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
  spawnEnemies() {
    const max = 55;
    let n = 0;
    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        if (n >= max) return;
        if (!this.walkable(x, y)) continue;
        if (this.zones.getZone(x, y) === ZONE.SAFE && hash(x, y) % 20 !== 0) continue;
        if (Math.abs(x - CENTER_X) + Math.abs(y - CENTER_Y) < 6) continue;
        const r = hash(x, y) % 100;
        const z = this.zones.getZone(x, y);
        let kind = null;
        if (z === ZONE.WALL && r < 8) kind = 'enforcer';
        else if (z === ZONE.OUTER && r < 10) kind = r < 3 ? 'drone' : 'thug';
        else if (z === ZONE.MID && r < 7) kind = 'thug';
        else if (r < 2) kind = 'thug';
        if (!kind) continue;
        this.enemies.push(makeEnemy(this, x, y, ENEMY[kind], kind));
        n++;
      }
    }
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
      // spawn a few dogs near player ring (never over the guide dog)
      let dogs = 0;
      for (let i = 0; i < 40 && dogs < 6; i++) {
        const a = Math.random() * Math.PI * 2;
        const d = 8 + Math.random() * 10;
        const x = (this.player.tx + Math.cos(a) * d) | 0;
        const y = (this.player.ty + Math.sin(a) * d) | 0;
        if (!this.walkable(x, y) || this.actorAt(x, y)) continue;
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
    for (let i = 0; i < 30; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = 10 + Math.random() * 8;
      const x = (this.player.tx + Math.cos(a) * d) | 0;
      const y = (this.player.ty + Math.sin(a) * d) | 0;
      if (!this.walkable(x, y) || this.actorAt(x, y)) continue;
      const e = makeEnemy(this, x, y, ENEMY.enforcer, 'enforcer');
      e._heatPatrol = true;
      this.enemies.push(e);
      this.log('Grid patrol inbound. Enforcer on your vector.');
      this.vfx?.burst(x * TILE + 16, y * TILE + 16, 0xef4444, 8);
      return;
    }
  }

  // ─── CAMERA methods in cameraMixin ───

  setupHud() {
    const d = 100;
    const w = this.scale.width;
    const h = this.scale.height;

    // Top bar  -  three clean columns, no stacked text
    this.topBar = this.add
      .rectangle(0, 0, w, 56, 0x020617, 0.92)
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(d);

    // LEFT: status + HP only
    this.alertText = this.add
      .text(14, 8, 'CLEAR', { fontFamily: 'system-ui', fontSize: '18px', fontStyle: 'bold', color: '#22c55e' })
      .setScrollFactor(0)
      .setDepth(d + 1);
    this.statText = this.add
      .text(14, 32, '', { fontFamily: 'system-ui', fontSize: '12px', color: '#cbd5e1' })
      .setScrollFactor(0)
      .setDepth(d + 1);

    // CENTER: objective + day bar
    this.objText = this.add
      .text(w / 2, 6, '', {
        fontFamily: 'system-ui',
        fontSize: '13px',
        fontStyle: 'bold',
        color: '#fbbf24',
        wordWrap: { width: Math.min(420, w * 0.4) },
        align: 'center',
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(d + 1);

    this.dayBarBg = this.add
      .rectangle(w / 2, 42, 200, 12, 0x1e293b, 1)
      .setStrokeStyle(1, 0x475569)
      .setScrollFactor(0)
      .setDepth(d + 1);
    this.dayBarFill = this.add
      .rectangle(w / 2 - 100, 42, 2, 10, 0xfbbf24, 1)
      .setOrigin(0, 0.5)
      .setScrollFactor(0)
      .setDepth(d + 2);
    this.dayBarLabel = this.add
      .text(w / 2, 42, 'DAY 1', {
        fontFamily: 'system-ui',
        fontSize: '10px',
        fontStyle: 'bold',
        color: '#0f172a',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(d + 3);

    this.heatText = this.add
      .text(w / 2, 54, 'HEAT 0', {
        fontFamily: 'system-ui',
        fontSize: '9px',
        fontStyle: 'bold',
        color: '#64748b',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(d + 3);

    // RIGHT: inventory only (no second status word overlapping)
    this.invText = this.add
      .text(w - 14, 10, '', {
        fontFamily: 'system-ui',
        fontSize: '12px',
        color: '#94a3b8',
        align: 'right',
      })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(d + 1);

    // Hidden legacy (mode folded into alertText)
    this.modeText = this.add.text(0, 0, '').setVisible(false);
    this.timeText = this.add.text(0, 0, '').setVisible(false);

    // Bottom toast (short)  -  combat uses dedicated log panel
    this.logText = this.add
      .text(w / 2, h - 100, '', {
        fontFamily: 'system-ui',
        fontSize: '13px',
        color: '#e2e8f0',
        backgroundColor: '#020617ee',
        padding: { x: 12, y: 5 },
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(d + 1);

    // Legacy help strip removed  -  use ? button instead
    this.helpText = this.add.text(0, 0, '').setVisible(false);

    // Combat HUD (shown only in combat)
    this.combatLogLines = [];
    this.combatHud = this.add.container(0, 0).setScrollFactor(0).setDepth(150).setVisible(false);
    this.combatPanelBg = this.add
      .rectangle(0, 0, 280, 220, 0x0f172a, 0.92)
      .setStrokeStyle(2, 0xef4444)
      .setOrigin(0, 0);
    this.combatTitle = this.add.text(12, 8, 'COMBAT LOG', {
      fontFamily: 'system-ui',
      fontSize: '13px',
      fontStyle: 'bold',
      color: '#fca5a5',
    });
    this.playerBarLabel = this.add.text(12, 32, 'YOU', {
      fontFamily: 'system-ui',
      fontSize: '11px',
      color: '#7dd3fc',
    });
    this.playerBarBg = this.add.rectangle(12, 50, 250, 12, 0x1e293b).setOrigin(0, 0.5);
    this.playerBarFill = this.add.rectangle(12, 50, 250, 10, 0x22c55e).setOrigin(0, 0.5);
    this.enemyBarLabel = this.add.text(12, 68, 'ENEMY', {
      fontFamily: 'system-ui',
      fontSize: '11px',
      color: '#fca5a5',
    });
    this.enemyBarBg = this.add.rectangle(12, 86, 250, 12, 0x1e293b).setOrigin(0, 0.5);
    this.enemyBarFill = this.add.rectangle(12, 86, 250, 10, 0xef4444).setOrigin(0, 0.5);
    this.combatLogText = this.add.text(12, 104, '', {
      fontFamily: 'system-ui',
      fontSize: '11px',
      color: '#e2e8f0',
      lineSpacing: 3,
      wordWrap: { width: 256 },
    });
    this.combatHud.add([
      this.combatPanelBg,
      this.combatTitle,
      this.playerBarLabel,
      this.playerBarBg,
      this.playerBarFill,
      this.enemyBarLabel,
      this.enemyBarBg,
      this.enemyBarFill,
      this.combatLogText,
    ]);

    this.craftOpen = false;
    this.craftUi = [];
    this.craftModalDepth = 400;
    this.legendOpen = false;
    this.legendUi = [];

    this.objMarker = this.add.triangle(0, 0, 0, 12, 9, 0, 18, 12, 0xfbbf24).setDepth(28);
    this.pathGfx = this.add.graphics().setDepth(12);
  }

  /** Bottom action bar  -  primary mouse UI (MORE on narrow; SPEC in combat) */
  setupMouseBar() {
    const d = 120;
    const w = this.scale.width;
    const h = this.scale.height;
    const barY = h - 58;
    this.bottomBar = this.add
      .rectangle(w / 2, barY, w, 52, 0x020617, 0.94)
      .setScrollFactor(0)
      .setDepth(d)
      .setStrokeStyle(1, 0x334155);

    this.actionButtons = [];
    this.rebuildActionBar();

    // Home compass  -  graphics chevron pointing +X; rotation = atan2 toward HQ
    this.homeArrow = this.add.graphics().setScrollFactor(0).setDepth(d + 2);
    this.homeArrow.setPosition(36, h - 96);
    this.drawHomeChevron();
    this.homeArrowLabel = this.add
      .text(36, h - 74, 'HQ', {
        fontFamily: 'system-ui',
        fontSize: '11px',
        fontStyle: 'bold',
        color: '#fbbf24',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(d + 2);
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
    const d = 350;
    const w = this.scale.width;
    const h = this.scale.height;
    const ids = this.getMoreMenuIds();
    const catalog = this.barActionCatalog();
    const rowH = 48;
    const panelH = 56 + ids.length * rowH + 16;
    const panelW = Math.min(300, w - 32);
    const cx = w / 2;
    const cy = h - 58 - panelH / 2 - 12;

    this.moreUi = [];
    const dim = this.add
      .rectangle(cx, h / 2, w, h, 0x020617, 0.45)
      .setScrollFactor(0)
      .setDepth(d)
      .setInteractive();
    dim.on('pointerup', () => this.closeMoreMenu());

    const panel = this.add
      .rectangle(cx, cy, panelW, panelH, 0x0f172a, 0.98)
      .setStrokeStyle(2, 0x64748b)
      .setScrollFactor(0)
      .setDepth(d + 1);

    const title = this.add
      .text(cx, cy - panelH / 2 + 22, 'MORE', {
        fontFamily: 'system-ui',
        fontSize: '15px',
        fontStyle: 'bold',
        color: '#e2e8f0',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(d + 2);

    this.moreUi.push(dim, panel, title);

    ids.forEach((id, i) => {
      const def = catalog[id];
      if (!def) return;
      const y = cy - panelH / 2 + 52 + i * rowH;
      const b = this.makeUiButton(cx, y, panelW - 36, 40, def.label, def.color, () => {
        def.fn();
        // keep MORE open for sneak/walk toggle so player sees state; close for menu/map
        if (id === 'menu' || id === 'map') this.closeMoreMenu();
        else this.syncMoveModeButtons();
      }, d + 3);
      this.moreUi.push(b.bg, b.label);
      // Stash refs so syncMoveModeButtons can update labels inside MORE
      if (id === 'sneak') this.btnSneak = b;
      if (id === 'walk') this.btnRun = b;
    });
    this.syncMoveModeButtons();
    this.time.delayedCall(80, () => {
      if (this.moreOpen) this.uiBlockClick = false;
    });
  }

  closeMoreMenu() {
    if (!this.moreOpen && !(this.moreUi || []).length) return;
    this.moreOpen = false;
    for (const o of this.moreUi || []) {
      try {
        o?.destroy?.();
      } catch (_) {
        /* ignore */
      }
    }
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
    this.menuOpen = true;
    this.clearMousePath();
    this.uiBlockClick = true;

    const d = 460;
    const w = this.scale.width;
    const h = this.scale.height;
    const cx = w / 2;
    const cy = h / 2 - 10;
    this.menuUi = [];

    const dim = this.add
      .rectangle(cx, h / 2, w, h, 0x020617, 0.78)
      .setScrollFactor(0)
      .setDepth(d)
      .setInteractive();
    dim.on('pointerup', () => this.closeRunMenu());

    const panel = this.add
      .rectangle(cx, cy, 520, 440, 0x0f172a, 0.98)
      .setStrokeStyle(3, 0x38bdf8)
      .setScrollFactor(0)
      .setDepth(d + 1)
      .setInteractive();
    panel.on('pointerup', (p) => {
      p.event?.stopPropagation?.();
      this.uiBlockClick = true;
      this.time.delayedCall(80, () => {
        this.uiBlockClick = false;
      });
    });

    const title = this.add
      .text(cx, cy - 190, 'RUN MENU', {
        fontFamily: 'system-ui',
        fontSize: '22px',
        fontStyle: 'bold',
        color: '#f8fafc',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(d + 2);

    const help =
      'WHO: Runner  ·  WHAT: Breach Kit, escape\n' +
      'WHEN: Day safer · Night dogs  ·  WHERE: HQ center, Wall edges\n' +
      'HOW: Click map · BAG equip · CRAFT at purple rig · HEAL kits\n' +
      'Street Charge (Boom craft): detonates near foes. Loud.\n' +
      'Camera: edge-pan or middle-mouse drag.';
    const body = this.add
      .text(cx, cy - 100, help, {
        fontFamily: 'system-ui',
        fontSize: '13px',
        color: '#cbd5e1',
        align: 'center',
        lineSpacing: 5,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(d + 2);

    const soundOn = this.audio?.on !== false;
    const narr = this.story?.narratorOn !== false;

    const mk = (y, label, color, fn) => {
      const b = this.makeUiButton(cx, y, 220, 40, label, color, fn, d + 3);
      this.menuUi.push(b.bg, b.label);
      return b;
    };

    mk(cy + 20, soundOn ? 'SOUND: ON' : 'SOUND: OFF', soundOn ? 0x22c55e : 0x64748b, () => {
      this.audio.on = !this.audio.on;
      this.closeRunMenu();
      this.openRunMenu();
      this.log(this.audio.on ? 'Sound ON.' : 'Sound muted.');
    });
    mk(cy + 70, narr ? 'NARRATOR: ON' : 'NARRATOR: OFF', narr ? 0x7c3aed : 0x64748b, () => {
      this.story.narratorOn = !this.story.narratorOn;
      this.story.persist();
      this.closeRunMenu();
      this.openRunMenu();
      this.log(this.story.narratorOn ? 'Narrator ON.' : 'Narrator OFF.');
    });
    mk(cy + 110, 'SAVE RUN', 0x0ea5e9, () => {
      const ok = SaveSystem.save(this);
      this.log(ok ? 'Run saved. CONTINUE from main menu later.' : 'Save failed.');
      this.closeRunMenu();
    });
    mk(cy + 155, 'NEW RUN (menu)', 0xe11d48, () => {
      this.closeRunMenu();
      this.scene.start('Menu');
    });
    mk(cy + 200, 'CLOSE', 0x94a3b8, () => this.closeRunMenu());

    this.menuUi.push(dim, panel, title, body);
    this.time.delayedCall(100, () => {
      if (this.menuOpen) this.uiBlockClick = false;
    });
  }

  closeRunMenu() {
    this.menuOpen = false;
    for (const o of this.menuUi || []) o?.destroy?.();
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
    this.clearMousePath();
    this.equipUI?.toggle();
    if (this.bagOpen) {
      this.log('BAG open. Click an item to equip, or drag onto a slot.');
    }
  }

  toggleLegend() {
    if (this.legendOpen) {
      this.closeLegend();
      return;
    }
    this.legendOpen = true;
    this.closeRunMenu();
    this.closeMoreMenu();
    const d = 350;
    const w = this.scale.width;
    const h = this.scale.height;
    const cx = w / 2;
    const cy = h / 2 - 10;

    const dim = this.add
      .rectangle(cx, h / 2, w, h, 0x020617, 0.65)
      .setScrollFactor(0)
      .setDepth(d)
      .setInteractive();
    dim.on('pointerup', () => this.closeLegend());

    const panel = this.add
      .rectangle(cx, cy, 500, 480, 0x0f172a, 0.98)
      .setStrokeStyle(2, 0x38bdf8)
      .setScrollFactor(0)
      .setDepth(d + 1)
      .setInteractive();
    panel.on('pointerup', (p) => {
      this.uiBlockClick = true;
      this.time.delayedCall(80, () => {
        this.uiBlockClick = false;
      });
    });

    const title = this.add
      .text(cx, cy - 215, 'MAP LEGEND', {
        fontFamily: 'system-ui',
        fontSize: '20px',
        fontStyle: 'bold',
        color: '#e2e8f0',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(d + 2);

    const lines = [
      ['Blue pad (HQ)', 'Safe starting courtyard'],
      ['Gray + white dashes', 'Road  -  main streets'],
      ['Brown / tan ground', 'Alley / sidewalk / ruin'],
      ['Green', 'Park / open green'],
      ['Dark + yellow dots', 'Building (blocked  -  walk around)'],
      ['Red-brown solid', 'Barricade (blocked)'],
      ['Gold square', 'Loot crate  -  click to scavenge scrap'],
      ['Brown bat shape', 'Street Stick gear pickup'],
      ['Purple hat shape', 'Neon Fedora gear pickup'],
      ['Purple “U” bench', 'Street Rig  -  craft here'],
      ['Teal oval', 'Sleep spot  -  rest until morning'],
      ['Pink + white dot', 'Blueprint  -  walk on to learn recipe'],
      ['Amber / gold edge', 'ESCAPE pad  -  needs Breach Kit'],
      ['Gold pulse / ▲', 'Current guide objective'],
      ['You (small figure)', 'The Runner  -  click map to walk'],
    ];

    const body = lines
      .map(([a, b]) => `• ${a}   -   ${b}`)
      .join('\n');
    const text = this.add
      .text(cx - 220, cy - 185, body, {
        fontFamily: 'system-ui',
        fontSize: '12px',
        color: '#cbd5e1',
        lineSpacing: 5,
      })
      .setScrollFactor(0)
      .setDepth(d + 2);

    const close = this.makeUiButton(cx, cy + 210, 140, 40, 'CLOSE', 0x94a3b8, () => this.closeLegend(), d + 3);
    this.legendUi = [dim, panel, title, text, close.bg, close.label];
  }

  closeLegend() {
    this.legendOpen = false;
    for (const o of this.legendUi || []) o?.destroy?.();
    this.legendUi = [];
    this.clearMousePath();
    this.uiBlockClick = true;
    this.time.delayedCall(120, () => {
      this.uiBlockClick = false;
    });
  }

  /**
   * HUD button  -  always scrollFactor 0, high depth, reliable clicks.
   * Larger hit pad on touch-sized buttons; fires on pointerup with down-guard.
   */
  makeUiButton(x, y, w, h, label, color, onClick, depth = 121) {
    const bg = this.add
      .rectangle(x, y, w, h, color, 1)
      .setStrokeStyle(2, 0xf8fafc, 0.4)
      .setScrollFactor(0)
      .setDepth(depth);
    // Extra hit padding so finger slides still count (fatter for large modal buttons)
    const pad = w >= 160 ? 14 : w < 48 ? 6 : 4;
    bg.setInteractive({
      useHandCursor: true,
      hitArea: new Phaser.Geom.Rectangle(-w / 2 - pad, -h / 2 - pad, w + pad * 2, h + pad * 2),
      hitAreaCallback: Phaser.Geom.Rectangle.Contains,
    });
    const text = this.add
      .text(x, y, label, {
        fontFamily: 'system-ui',
        fontSize: '13px',
        fontStyle: 'bold',
        color: '#0b1220',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(depth + 1);
    // Text must not steal clicks
    text.disableInteractive?.();

    let pressed = false;
    bg.on('pointerover', () => bg.setAlpha(0.88));
    bg.on('pointerout', () => {
      bg.setAlpha(1);
      pressed = false;
    });
    bg.on('pointerdown', (pointer) => {
      if (pointer.event?.stopPropagation) pointer.event.stopPropagation();
      pressed = true;
      this.uiBlockClick = true;
    });
    bg.on('pointerup', (pointer) => {
      if (pointer.event?.stopPropagation) pointer.event.stopPropagation();
      if (!pressed) {
        // Still accept if released on button (mobile often skips clean down/up pairing)
      }
      pressed = false;
      onClick();
      this.time.delayedCall(80, () => {
        this.uiBlockClick = false;
      });
    });
    return { bg, label: text };
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
    const atk = this.playerEffectiveAtk();
    const def = this.inv.totalDef(p.baseDef);
    const zone = this.zones.label(this.zones.getZone(p.tx, p.ty));

    // One status only (left). Never put HOSTILE under inventory.
    if (this.mode === 'combat') {
      this.alertText.setText('⚔ COMBAT');
      this.alertText.setColor('#ef4444');
    } else {
      this.alertText.setText(this.alert.label);
      this.alertText.setColor(this.alert.color);
    }

    const prog = this.progression?.summary?.() || '';
    this.statText.setText(
      `HP ${p.hp}/${p.maxHp}  ATK ${atk}  DEF ${def}  ·  ${prog}  ·  ${zone}${this.hiding ? '  · HIDING' : ''}`
    );

    const s = this.inv.summary();
    this.invText.setText(`${s.mats}\n${s.gear}\nBP ${[...this.inv.blueprints].length}`);

    this.syncMoveModeButtons();
    if (this.btnSleep) {
      const kits = this.countBedrolls();
      this.btnSleep.label.setText(kits > 0 ? `SLEEP×${kits}` : 'SLEEP');
    }
    this.updateDayBar();
    if (this.heat && this.heatText) {
      const h = Math.round(this.heat.level);
      this.heatText.setText(`GRID HEAT ${h}`);
      this.heatText.setColor(this.heat.color);
      this.runStats.maxHeat = Math.max(this.runStats.maxHeat || 0, h);
    }
    this.updateCombatHud();
    this.updateHomeArrow();
    this.updateSneakRing();
    if (this.objText) this.objText.setText(this.objective || '');
    if (this.objMarker && this.objTarget && !this.objTarget.ui) {
      // Spots use {x,y} tiles; actors use {tx,ty}
      const ox = this.objTarget.tx ?? this.objTarget.x;
      const oy = this.objTarget.ty ?? this.objTarget.y;
      if (ox != null && oy != null) {
        this.objMarker.setPosition(ox * TILE + 16, oy * TILE - 4);
        this.objMarker.setVisible(this.mode !== 'combat' && !this.bagOpen);
      } else {
        this.objMarker.setVisible(false);
      }
    } else if (this.objMarker) {
      this.objMarker.setVisible(false);
    }
  }

  log(msg) {
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
    if (!this.combatHud) return;
    const show = this.mode === 'combat';
    this.combatHud.setVisible(show);
    if (!show) return;

    const w = this.scale.width;
    // Dock left under top bar
    this.combatHud.setPosition(12, 64);

    const p = this.player;
    const pPct = Math.max(0, p.hp / p.maxHp);
    this.playerBarFill.width = 250 * pPct;
    this.playerBarFill.setFillStyle(pPct > 0.5 ? 0x22c55e : pPct > 0.25 ? 0xeab308 : 0xef4444);
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
      this.enemyBarFill.width = 250 * ePct;
      this.enemyBarFill.setFillStyle(0xef4444);
      const rangeNote = foe.ranged ? 'ranged' : 'melee';
      this.enemyBarLabel.setText(`${foe.name}  ${foe.hp}/${foe.maxHp}  (${rangeNote})`);
    } else {
      this.enemyBarFill.width = 0;
      this.enemyBarLabel.setText('No target');
    }
    void w;
  }

  /** True while any modal is open  -  freezes world time & AI */
  isPaused() {
    return !!(
      this.popupOpen ||
      this.craftOpen ||
      this.legendOpen ||
      this.bagOpen ||
      this.menuOpen ||
      this.specialOpen ||
      this.moreOpen
    );
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
    ]) {
      candidates.push([this.player.tx + dx, this.player.ty + dy]);
    }
    // Also try absolute near HQ ring
    candidates.push([CENTER_X + 5, CENTER_Y - 5], [CENTER_X - 4, CENTER_Y + 4]);
    for (const [x, y] of candidates) {
      if (this.walkable(x, y) && !this.actorAt(x, y)) {
        const dog = makeEnemy(this, x, y, ENEMY.dog, 'dog');
        dog.nightOnly = false;
        dog._dormant = false;
        dog._isGuideDog = true; // survives dawn dog cull
        this.enemies.push(dog);
        this.guideDog = dog;
        this.log('A Grid Dog pads in. Follow the pulse. Left-click it.');
        return;
      }
    }
  }

  /** Pulse ring on the current guide target (tile or UI button). */
  updateQuestPulse(dt = 0) {
    this._pulseT = (this._pulseT || 0) + dt;
    const world = this.questPulseWorld;
    const ui = this.questPulseUi;
    world?.clear();
    ui?.clear();
    if (this.mode === 'combat') return;
    if (this.bagOpen || this.craftOpen || this.menuOpen || this.legendOpen) return;

    let target = null;
    if (this.guide && !this.guide.done) target = this.guide.resolveTarget();
    else if (this.escape?.active()) target = this.escape.resolveTarget();
    if (!target) return;

    const phase = (Math.sin(this._pulseT * 5.5) + 1) / 2;
    const a = 0.45 + phase * 0.55;
    const r = 14 + phase * 16;
    // Sit above modal dimmer (500) so edge beacons stay visible while reading GOT IT
    if (ui) ui.setDepth(this.popupOpen ? 520 : 140);

    if (target.ui) {
      // UI pulses only when not under a full modal
      if (this.popupOpen) return;
      const btn =
        target.ui === 'bag'
          ? this.btnBag
          : target.ui === 'craft'
            ? this.btnCraft
            : target.ui === 'sleep'
              ? this.btnSleep
              : null;
      if (!btn?.bg) return;
      const bx = btn.bg.x;
      const by = btn.bg.y;
      const hw = (btn.bg.width || 80) / 2 + 6;
      const hh = (btn.bg.height || 40) / 2 + 6;
      const pad = phase * 5;
      ui.lineStyle(3, 0xfbbf24, a);
      ui.strokeRect(bx - hw - pad, by - hh - pad, hw * 2 + pad * 2, hh * 2 + pad * 2);
      ui.lineStyle(2, 0xfde68a, a * 0.7);
      ui.strokeRect(
        bx - hw - pad * 1.4 - 4,
        by - hh - pad * 1.4 - 4,
        hw * 2 + pad * 2.8 + 8,
        hh * 2 + pad * 2.8 + 8
      );
      return;
    }

    const ox = target.tx ?? target.x;
    const oy = target.ty ?? target.y;
    if (ox == null || oy == null) return;
    const wx = ox * TILE + TILE / 2;
    const wy = oy * TILE + TILE / 2;

    // World pulse only when world is visible (not under a modal)
    if (!this.popupOpen && world) {
      world.lineStyle(4, 0xfbbf24, a);
      world.strokeCircle(wx, wy, r);
      world.lineStyle(2, 0xfef08a, a * 0.75);
      world.strokeCircle(wx, wy, r + 8 + phase * 6);
      world.fillStyle(0xfbbf24, 0.1 + phase * 0.12);
      world.fillCircle(wx, wy, r * 0.85);
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
    // Keep clear of center modal + HUD when forced
    const margin = force ? 36 : 28;
    const left = margin;
    const right = cam.width - margin;
    const top = force ? 72 : 64;
    const bot = cam.height - (force ? 110 : 100);
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
    const pulse = 10 + phase * 8;

    ui.lineStyle(3, 0xfbbf24, a);
    ui.strokeCircle(cx, cy, pulse);
    ui.fillStyle(0xfbbf24, 0.35 + phase * 0.25);
    ui.fillCircle(cx, cy, 6 + phase * 2);
    const len = 16;
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
    if (!this.dayBarFill || !this.dayBarLabel) return;
    const fill = this.dayNight.barFill; // day fills → night drains
    const maxW = 200;
    this.dayBarFill.width = Math.max(2, maxW * fill);
    let col = 0xfbbf24; // day gold
    if (this.dayNight.isNight) col = 0x6366f1; // night indigo
    else if (fill > 0.85) col = 0xf97316; // late day / dusk
    this.dayBarFill.setFillStyle(col, 1);
    const phase = this.dayNight.isNight ? 'NIGHT' : fill > 0.85 ? 'DUSK' : 'DAY';
    this.dayBarLabel.setText(`Day ${this.dayNight.day} · ${phase}`);
    this.dayBarLabel.setColor(this.dayNight.isNight ? '#e2e8f0' : '#0f172a');
  }

  /**
   * Stable modal (no shake): fixed integer positions, no per-frame rebuild.
   * Time frozen while open.
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

    // Depth above guide edge-beacon (520) so GOT IT is always tappable on phones
    const d = 560;
    const w = Math.round(this.scale.width);
    const h = Math.round(this.scale.height);
    const cx = Math.round(w / 2);
    const hasCheck = !!opts.checkboxLabel;
    const narrow = w < 520 || h < 700;
    // Keep clear of top status + bottom action bar / home indicator
    const safeTop = narrow ? 52 : 24;
    const safeBot = narrow ? 100 : 40;
    const maxPanelH = h - safeTop - safeBot;
    const panelW = Math.min(560, w - (narrow ? 20 : 48));
    const bodyFont = narrow ? '13px' : '15px';
    const titleFont = narrow ? '20px' : '24px';
    const lineSp = narrow ? 5 : 8;
    const wrapW = panelW - (narrow ? 36 : 56);

    // Measure body; clamp so button never gets pushed off-screen
    const probe = this.add
      .text(0, 0, body, {
        fontFamily: 'system-ui',
        fontSize: bodyFont,
        align: 'center',
        wordWrap: { width: wrapW },
        lineSpacing: lineSp,
      })
      .setVisible(false);
    let bodyH = Math.ceil(probe.height);
    probe.destroy();

    const titleH = narrow ? 28 : 36;
    const padTop = narrow ? 16 : 24;
    const gapTitleBody = narrow ? 12 : 20;
    const gapBodyCheck = hasCheck ? 24 : 12;
    const checkH = hasCheck ? 28 : 0;
    const gapCheckBtn = narrow ? 16 : 24;
    const btnH = narrow ? 52 : 48;
    const padBot = narrow ? 16 : 24;
    const chrome =
      padTop + titleH + gapTitleBody + gapBodyCheck + checkH + gapCheckBtn + btnH + padBot;
    const maxBodyH = Math.max(80, maxPanelH - chrome);
    if (bodyH > maxBodyH) bodyH = maxBodyH;

    const panelH = Math.min(maxPanelH, chrome + bodyH);
    // Prefer sitting above the bottom bar on phones
    const cy = narrow
      ? Math.round(safeTop + panelH / 2 + 4)
      : Math.round(h / 2);
    const panelTop = Math.round(cy - panelH / 2);

    const dim = this.add
      .rectangle(w / 2, h / 2, w, h, 0x020617, 0.82)
      .setScrollFactor(0)
      .setDepth(d)
      .setInteractive();

    const panel = this.add
      .rectangle(cx, cy, panelW, panelH, 0x0f172a, 1)
      .setStrokeStyle(3, 0x38bdf8)
      .setScrollFactor(0)
      .setDepth(d + 1);
    // Panel is visual only  -  do NOT setInteractive (it was eating taps meant for GOT IT)

    const t1 = this.add
      .text(cx, panelTop + padTop, title, {
        fontFamily: 'system-ui',
        fontSize: titleFont,
        fontStyle: 'bold',
        color: '#f8fafc',
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(d + 2);

    const bodyY = panelTop + padTop + titleH + gapTitleBody;
    const t2 = this.add
      .text(cx, bodyY, body, {
        fontFamily: 'system-ui',
        fontSize: bodyFont,
        color: '#cbd5e1',
        align: 'center',
        wordWrap: { width: wrapW },
        lineSpacing: lineSp,
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(d + 2);
    // Clip long body so it cannot cover the button
    if (t2.height > maxBodyH) {
      t2.setCrop(0, 0, wrapW + 8, maxBodyH);
    }

    // Default OFF for track checkbox
    let checked = opts.checkboxDefault === true;
    const ui = [dim, panel, t1, t2];

    if (hasCheck) {
      const boxY = Math.round(Math.min(bodyY + bodyH, panelTop + panelH - padBot - btnH - 36));
      const box = this.add
        .rectangle(cx - Math.min(150, panelW / 2 - 40), boxY, 22, 22, checked ? 0x0ea5e9 : 0x1e293b, 1)
        .setStrokeStyle(2, 0x94a3b8)
        .setScrollFactor(0)
        .setDepth(d + 3)
        .setInteractive({ useHandCursor: true });
      const mark = this.add
        .text(box.x, boxY, checked ? 'Y' : '', {
          fontFamily: 'system-ui',
          fontSize: '14px',
          fontStyle: 'bold',
          color: '#0b1220',
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(d + 4);
      const lab = this.add
        .text(box.x + 20, boxY, opts.checkboxLabel, {
          fontFamily: 'system-ui',
          fontSize: narrow ? '12px' : '14px',
          color: '#e2e8f0',
          wordWrap: { width: panelW - 80 },
        })
        .setOrigin(0, 0.5)
        .setScrollFactor(0)
        .setDepth(d + 3)
        .setInteractive({ useHandCursor: true });
      const toggle = () => {
        checked = !checked;
        box.setFillStyle(checked ? 0x0ea5e9 : 0x1e293b);
        mark.setText(checked ? 'Y' : '');
      };
      box.on('pointerup', (p) => {
        p.event?.stopPropagation?.();
        toggle();
      });
      lab.on('pointerup', (p) => {
        p.event?.stopPropagation?.();
        toggle();
      });
      ui.push(box, mark, lab);
    }

    const btnY = Math.round(panelTop + panelH - padBot - btnH / 2);
    const btnW = Math.min(240, panelW - 32);

    const finish = (fromOk) => {
      if (!this.popupOpen) return;
      ui.forEach((o) => o?.destroy?.());
      ok.bg.destroy();
      ok.label.destroy();
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

    // Slightly oversized so thumbs hit reliably (makeUiButton already pads hit area)
    const ok = this.makeUiButton(cx, btnY, btnW, Math.max(btnH, 52), 'GOT IT', 0x0ea5e9, () => finish(true), d + 10);
    // Only close on dimmer when no checkbox (avoid misclicks)
    if (!hasCheck) {
      dim.on('pointerup', () => finish(true));
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
    if (this.huntHudParts) {
      this.huntHudParts.forEach((o) => o?.destroy?.());
      this.huntHudParts = null;
    }
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

    if (!this.huntList.length) return;

    const d = 110;
    const w = this.scale.width;
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

    const body = this.add
      .text(w - 20, 78, lines.join('\n'), {
        fontFamily: 'system-ui',
        fontSize: '12px',
        color: '#fde68a',
        lineSpacing: 3,
        align: 'left',
      })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(d + 1);

    const pad = 12;
    const bw = body.width + pad * 2;
    const bh = body.height + pad * 2 + 28;
    // Proper rect (no setSize after stroke  -  that caused the diagonal line)
    const bg = this.add
      .rectangle(w - 12 - bw / 2, 70 + bh / 2, bw, bh, 0x0f172a, 0.92)
      .setStrokeStyle(2, 0xfbbf24)
      .setScrollFactor(0)
      .setDepth(d);

    body.setPosition(w - 12 - pad, 70 + pad);

    const clearBtn = this.add
      .text(w - 12 - pad, 70 + bh - 18, '✕ clear hunts', {
        fontFamily: 'system-ui',
        fontSize: '11px',
        color: '#f87171',
      })
      .setOrigin(1, 0.5)
      .setScrollFactor(0)
      .setDepth(d + 1)
      .setInteractive({ useHandCursor: true });
    clearBtn.on('pointerup', () => {
      this.huntList = [];
      this.refreshHuntHud();
      this.log('Hunt list cleared.');
    });

    this.huntHudParts = [bg, body, clearBtn];
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
      this.objTarget = bp || { x: CENTER_X, y: 5 };
    } else if (!this.inv.canCraft('breach') && !this.inv.hasBreach() && !this.inv.items.some((i) => i.id === 'breach')) {
      const miss = this.inv.missingFor('breach').join(', ') || 'materials';
      this.objective = `OBJECTIVE: Scavenge for Breach Kit (need ${miss})`;
      this.objTarget = this.nearestLoot() || this.benches[0];
    } else if (!this.inv.items.some((i) => i.id === 'breach')) {
      this.objective = 'OBJECTIVE: Craft BREACH KIT at purple bench (CRAFT)';
      this.objTarget = this.nearestBench();
    } else {
      this.objective = 'OBJECTIVE: Click gold ESCAPE pad on the edge (need Breach Kit)';
      this.objTarget = this.escapePads[0];
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
      // End middle-mouse free pan
      if (p.button === 1 || this._midDrag) {
        this._midDrag = null;
        this._edgePanIdle = 0;
        this.cancelLongPress();
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
      if (p.y < 56 || p.y > this.scale.height - 90) return;

      const wpt = this.cameras.main.getWorldPoint(p.x, p.y);
      const tx = (wpt.x / TILE) | 0;
      const ty = (wpt.y / TILE) | 0;
      this.handleWorldClick(tx, ty, p.rightButtonReleased() || p.button === 2);
    });

    this.input.on('pointerdown', (p) => {
      // Middle-mouse drag pan
      if (p.button === 1) {
        if (this.ended || this.isPaused() || this.mode === 'combat') return;
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

      // Primary press: arm long-press for combat specials (touch + mouse hold)
      if (p.button !== 0 && p.button != null) return;
      if (this.ended || this.uiBlockClick || this.isPaused()) return;
      if (p.y < 56 || p.y > this.scale.height - 90) return;

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
      // Cancel long-press if finger/mouse slides too far
      if (this._longPress && !this._longPress.fired) {
        const dx = p.x - this._longPress.x;
        const dy = p.y - this._longPress.y;
        if (dx * dx + dy * dy > 22 * 22) this.cancelLongPress();
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
    this.pathGfx.fillCircle(last.x * TILE + TILE / 2, last.y * TILE + TILE / 2, 8);
  }

  /** HEAL button: bandages / stim / MRE, or Street Charge in combat. */
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
      this.minimap?.update?.();
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
    this.dayNight.update(dt);
    this.nightVeil.setAlpha(this.dayNight.isNight ? 0.45 : 0.05);
    this.alert.update(dt, this.hiding);
    this.heat?.update(dt, this);
    if (this.alert.state === ALERT.RED && this.mode !== 'combat') {
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
        if (zc) this.time.delayedCall(200, () => this.showPopup(zc.title, zc.body));
      }
    }

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
    this.minimap?.update?.();
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
        if (use) this.useTile();
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
    this.relockCameraToPlayer();
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

    // Gear drops (stick, hat, etc.)
    const drop = this.gearDrops?.find(
      (d) => !d.taken && d.x === this.player.tx && d.y === this.player.ty
    );
    if (drop) {
      drop.taken = true;
      const item = this.inv.addItem(drop.id);
      this.ground[this.player.ty][this.player.tx] = T.ALLEY;
      this.gLayer.putTileAt(T.ALLEY, this.player.tx, this.player.ty);
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

    // auto-pickup blueprint when walking on landmark
    const bp = this.bpSpots.find((b) => !b.taken && b.x === this.player.tx && b.y === this.player.ty);
    if (bp) {
      bp.taken = true;
      this.inv.learnBlueprint(bp.id);
      this.audio.scavenge();
      this.ground[this.player.ty][this.player.tx] = T.ALLEY;
      this.gLayer.putTileAt(T.ALLEY, this.player.tx, this.player.ty);
      this.showBlueprintPopup(bp.id);
      this.time.delayedCall(50, () => {
        this.checkGuide();
        this.checkEscape();
      });
    }

    if (g === T.ESCAPE) this.tryEscape();
    this.checkEscape();
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
    const rolls = 2 + (z === ZONE.OUTER || z === ZONE.WALL ? 1 : 0) + (this.player.scavengeBonus || 0);
    const got = [];
    const isGuideCrate = !!spot?.guide;
    if (isGuideCrate) {
      this.inv.addMat('cloth', 2);
      this.inv.addMat('scrap', 1);
      got.push(MAT.cloth.name, MAT.cloth.name, MAT.scrap.name);
      this._guideLooted = true;
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

  // ─── CRAFT MODAL (full-screen overlay, click CLOSE or dimmer) ───
  toggleCraft(forceOpen) {
    if (forceOpen === true) this.craftOpen = true;
    else if (forceOpen === false) this.craftOpen = false;
    else this.craftOpen = !this.craftOpen;

    if (this.craftOpen) {
      this.closeRunMenu();
      this.closeMoreMenu();
      this.buildCraftModal();
    } else {
      this.destroyCraftModal();
    }
  }

  destroyCraftModal() {
    for (const o of this.craftUi || []) {
      o?.destroy?.();
    }
    this.craftUi = [];
    this.craftOpen = false;
    this.clearMousePath();
    this.uiBlockClick = true;
    this.time?.delayedCall(120, () => {
      this.uiBlockClick = false;
    });
  }

  buildCraftModal() {
    this.destroyCraftModal();
    this.craftOpen = true;
    const d = this.craftModalDepth;
    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2 - 20;

    // Dimmer  -  click to close
    const dim = this.add
      .rectangle(cx, this.scale.height / 2, this.scale.width, this.scale.height, 0x020617, 0.72)
      .setScrollFactor(0)
      .setDepth(d)
      .setInteractive();
    dim.on('pointerup', () => {
      this.uiBlockClick = true;
      this.toggleCraft(false);
      this.time.delayedCall(80, () => {
        this.uiBlockClick = false;
      });
    });

    // Panel (does not close when clicked  -  stopPropagation via uiBlock)
    const list = [...this.inv.blueprints];
    const rowH = list.length > 8 ? 40 : list.length > 6 ? 44 : 50;
    const panelH = Math.min(this.scale.height - 40, Math.max(460, 160 + list.length * rowH + 80));

    const panel = this.add
      .rectangle(cx, cy, 580, panelH, 0x0f172a, 0.98)
      .setStrokeStyle(3, 0xa855f7)
      .setScrollFactor(0)
      .setDepth(d + 1)
      .setInteractive();
    panel.on('pointerup', (p) => {
      // swallow  -  don't close when clicking panel body
      if (p.event?.stopPropagation) p.event.stopPropagation();
      this.uiBlockClick = true;
      this.time.delayedCall(80, () => {
        this.uiBlockClick = false;
      });
    });

    const nearBench = this.benches.some(
      (b) => Math.abs(b.x - this.player.tx) + Math.abs(b.y - this.player.ty) <= 1
    ) || this.ground[this.player.ty][this.player.tx] === T.BENCH;

    const titleY = cy - panelH / 2 + 28;
    const title = this.add
      .text(cx, titleY, nearBench ? 'STREET RIG  -  click a recipe' : 'RECIPES (browse)', {
        fontFamily: 'system-ui',
        fontSize: '20px',
        fontStyle: 'bold',
        color: '#e9d5ff',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(d + 2);

    const prox = this.add
      .text(
        cx,
        titleY + 28,
        nearBench
          ? 'At a purple rig. Green rows are ready. Craft+ may refund a mat.'
          : 'Walk onto a purple Street Rig to craft. You can browse recipes anywhere.',
        {
          fontFamily: 'system-ui',
          fontSize: '12px',
          color: nearBench ? '#86efac' : '#fbbf24',
        }
      )
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(d + 2);

    // X close (top-right of panel)
    const xBtn = this.makeUiButton(cx + 250, titleY, 44, 36, '✕', 0xef4444, () => {
      this.toggleCraft(false);
    }, d + 5);

    // CLOSE button (bottom center)  -  guaranteed scene-level
    const closeBtn = this.makeUiButton(cx, cy + panelH / 2 - 28, 160, 44, 'CLOSE', 0x94a3b8, () => {
      this.toggleCraft(false);
    }, d + 5);

    this.craftUi.push(dim, panel, title, prox, xBtn.bg, xBtn.label, closeBtn.bg, closeBtn.label);

    if (!list.length) {
      const empty = this.add
        .text(cx, cy, 'No blueprints yet.\nClick pink landmarks on the map,\nthen come back.', {
          fontFamily: 'system-ui',
          fontSize: '16px',
          color: '#94a3b8',
          align: 'center',
          lineSpacing: 6,
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(d + 2);
      this.craftUi.push(empty);
      return;
    }

    const listTop = titleY + 56;
    list.forEach((id, i) => {
      const bp = BLUEPRINTS[id];
      const need = Object.entries(bp.needs)
        .map(([m, n]) => `${MAT[m]?.name || m}×${n} (have ${this.inv.count(m)})`)
        .join(', ');
      const ready = this.inv.canCraft(id);
      const rowY = listTop + i * rowH;

      const row = this.add
        .rectangle(cx, rowY, 520, rowH - 4, ready ? 0x14532d : 0x1e293b, 1)
        .setStrokeStyle(2, ready ? 0x4ade80 : 0x475569)
        .setScrollFactor(0)
        .setDepth(d + 3)
        .setInteractive({ useHandCursor: true });

      const rowText = this.add
        .text(cx - 250, rowY, `${bp.name}   ${ready ? '✓  CLICK TO CRAFT' : '… need parts'}\n${need}`, {
          fontFamily: 'system-ui',
          fontSize: rowH < 45 ? '11px' : '13px',
          color: '#f1f5f9',
          lineSpacing: 2,
        })
        .setOrigin(0, 0.5)
        .setScrollFactor(0)
        .setDepth(d + 4);

      row.on('pointerover', () => row.setAlpha(0.9));
      row.on('pointerout', () => row.setAlpha(1));
      row.on('pointerup', () => {
        this.uiBlockClick = true;
        this.tryCraftId(id);
        this.time.delayedCall(80, () => {
          this.uiBlockClick = false;
        });
      });

      this.craftUi.push(row, rowText);
    });
  }

  tryCraftKey(index) {
    if (!this.craftOpen) return;
    const list = [...this.inv.blueprints];
    const id = list[index];
    if (id) this.tryCraftId(id);
  }

  tryCraftId(id) {
    const nearBench = this.benches.some(
      (b) => Math.abs(b.x - this.player.tx) + Math.abs(b.y - this.player.ty) <= 1
    );
    if (!nearBench && this.ground[this.player.ty][this.player.tx] !== T.BENCH) {
      this.log('Stand on / next to a purple Street Rig, then craft.');
      return;
    }
    if (!this.inv.canCraft(id)) {
      this.log(`Missing: ${this.inv.missingFor(id).join(', ')}`);
      // rebuild list so counts stay fresh
      this.buildCraftModal();
      return;
    }
    const result = this.inv.craft(id, { craftBonus: this.player.craftBonus || 0 });
    if (!result?.gear) {
      this.log('Craft failed.');
      this.buildCraftModal();
      return;
    }
    const gear = result.gear;
    // batBonus / rangedBonus apply at combat time only (never bake into gear.atk)
    this.audio.craft();
    let msg = `Crafted ${gear.name}. ${gear.desc}`;
    if (result.refunded) {
      msg += ` (${this.char?.name || 'You'} salvaged 1 ${MAT[result.refunded]?.name || result.refunded}.)`;
    }
    this.log(msg);
    this.huntList = this.huntList.filter((h) => BLUEPRINTS[h.bpId]?.result !== gear.id);
    this.refreshHuntHud();
    this.buildCraftModal();
    this.updateObjective();
    this.refreshHud();
    this.checkGuide();
    this.checkEscape();
    const card = this.story.onCraft(gear.id, gear.name);
    // Prefer guide card over story craft card during tutorial
    if (this.guide && !this.guide.done) {
      // checkGuide already queues next step popup
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
  tryEscape() {
    if (!this.inv.items.some((i) => i.id === 'breach')) {
      this.log('Gold pad dead without a Breach Kit. Craft one. Steal the ending.');
      this.help.once('escape_need', 'WHAT: Escape pads need a Breach Kit in your pack.');
      return;
    }
    if (this._escaping) return;
    this._escaping = true;
    this.clearMousePath();
    const pad = this.escapePads?.[0];
    if (pad) {
      const wx = pad.x * TILE + TILE / 2;
      const wy = pad.y * TILE + TILE / 2;
      this.beginFreeCam?.();
      this.cameras.main.centerOn(wx, wy);
      this.clampCamScroll?.();
    }
    this.showPopup(
      'BREACH ARMED',
      'Kit sparks alive. Wall sensors stutter.\n\nOne step onto the pad and you are out.\nThe grid will not forget you.',
      () => {
        this.inv.takeBreach();
        this.escape?.markEscaped?.();
        this.win();
      }
    );
  }

  win() {
    if (this.ended) return;
    this.ended = true;
    this.audio.win();
    this.showEnd(true, 'The Wall blinks. You don’t. CITY BROKEN.');
  }

  lose() {
    if (this.ended) return;
    this.ended = true;
    this.showEnd(false, 'The grid keeps what it kills. Retry, Runner.');
  }

  showEnd(won, msg) {
    const w = this.scale.width;
    const h = this.scale.height;
    const days = this.dayNight?.day || 1;
    const kills = this.runStats?.kills || 0;
    const heat = Math.round(this.runStats?.maxHeat || this.heat?.maxSeen || 0);
    const lvl = this.progression?.level || 1;
    const stats =
      `Days survived: ${days}\nKills: ${kills}  ·  Level: ${lvl}\nPeak grid heat: ${heat}`;

    this.add
      .rectangle(w / 2, h / 2, w, h, 0x020617, 0.82)
      .setScrollFactor(0)
      .setDepth(200);
    this.add
      .text(w / 2, h * 0.28, won ? 'YOU ESCAPED' : 'KIA', {
        fontFamily: 'system-ui',
        fontSize: '48px',
        fontStyle: 'bold',
        color: won ? '#38bdf8' : '#fb7185',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(201);
    this.add
      .text(w / 2, h * 0.42, msg, {
        fontFamily: 'system-ui',
        fontSize: '16px',
        color: '#cbd5e1',
        align: 'center',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(201);
    this.add
      .text(w / 2, h * 0.52, stats, {
        fontFamily: 'system-ui',
        fontSize: '13px',
        color: '#94a3b8',
        align: 'center',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(201);

    const mkBtn = (y, label, color, fn) => {
      const btn = this.add
        .rectangle(w / 2, y, 220, 48, color)
        .setScrollFactor(0)
        .setDepth(201)
        .setInteractive({ useHandCursor: true });
      this.add
        .text(w / 2, y, label, {
          fontFamily: 'system-ui',
          fontSize: '18px',
          fontStyle: 'bold',
          color: '#fff',
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(202);
      btn.on('pointerup', fn);
    };

    mkBtn(h * 0.64, 'NEW RUN', won ? 0x0ea5e9 : 0xe11d48, () => this.scene.restart());
    mkBtn(h * 0.74, 'MAIN MENU', 0x334155, () => {
      SaveSystem.clear();
      this.scene.start('Menu');
    });
  }
}

Object.assign(GameScene.prototype, combatMixin, cameraMixin, sleepMixin);

function hash(x, y) {
  let n = x * 374761393 + y * 668265263;
  n = (n ^ (n >> 13)) * 1274126177;
  return Math.abs(n ^ (n >> 16));
}
