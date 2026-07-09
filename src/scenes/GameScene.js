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
import { EquipUI } from '../systems/EquipUI.js';

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
    // New run: reset guide progress
    this.registry.set('storySeen', []);
    this.registry.set('storyCrafts', []);
    this.registry.set('guideDone', false);
    this.story = new StoryDirector(this.registry);
    this.guide = new GuideDirector(this);
    this._guideLooted = false;
    this._guideDogDead = false;
    this._guideSlept = false;
    this.guideDog = null;
    this.bagOpen = false;
    this.equipUI = null;

    this.buildMap();
    this.player = makePlayer(this, CENTER_X, CENTER_Y, this.char);
    this.spawnEnemies();

    this.setupCamera();
    this.setupHud();
    this.setupMouseBar();
    this.setupInput();
    this.setupSneakRing();
    this.equipUI = new EquipUI(this);
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

    this.updateObjective();
    this.updateFow();
    this.refreshHud();
    this.cameras.main.fadeIn(400);
    // Full hand-hold: character intro, then Quest 1 card
    this.time.delayedCall(400, () => {
      const intro = this.story.introCard(this.char);
      this.showPopup(intro.title, intro.body, () => {
        const step = this.guide.current();
        if (step) this.showPopup(step.title, step.body);
        this.updateObjective();
        this.refreshHud();
      });
    });
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
    const r = (PLAYER.visionNight + (this.player.sneakBonus || 0) + 1) * TILE;
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
    if (next) {
      this.time.delayedCall(120, () => {
        this.showPopup(next.title, next.body);
      });
    }
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
    if (this.objText) this.objText.setPosition(w / 2, 6);
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
    if (this.actionButtons?.length) {
      const gap = 88;
      const startX = w / 2 - ((this.actionButtons.length - 1) * gap) / 2;
      const y = h - 58;
      this.actionButtons.forEach((b, i) => {
        b.bg.setPosition(startX + i * gap, y);
        b.label.setPosition(startX + i * gap, y);
      });
    }
    if (this.homeArrow) this.homeArrow.setPosition(40, h - 96);
    if (this.homeArrowLabel) this.homeArrowLabel.setPosition(40, h - 74);
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
      // spawn a few dogs near player ring
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
      this.enemies = this.enemies.filter((e) => {
        if (e.kind === 'dog') {
          e.destroy();
          return false;
        }
        return true;
      });
    }
  }

  // ─── CAMERA / HUD ────────────────────────────────────
  setupCamera() {
    const cam = this.cameras.main;
    cam.setBounds(0, 0, WORLD_W, WORLD_H);
    cam.startFollow(this.player.asFollowTarget(), true, 0.15, 0.15);
    cam.setDeadzone(this.scale.width * 0.2, this.scale.height * 0.18);
    cam.setRoundPixels(true);
    cam.setZoom(1);
  }

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

  /** Bottom action bar  -  primary mouse UI */
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

    const gap = 88;
    const labels = [
      ['USE', 0x0ea5e9, () => this.useTile()],
      ['SLEEP', 0x0f766e, () => this.doSleep()],
      ['HIDE', 0xeab308, () => this.tryHide()],
      ['SNEAK', 0x64748b, () => this.toggleSneak()],
      ['CRAFT', 0xa855f7, () => this.toggleCraft()],
      ['WALK', 0x475569, () => {
        this.running = !this.running;
        if (this.running) this.sneaking = false;
        this.syncMoveModeButtons();
        this.log(
          this.running
            ? 'RUN ON  -  faster but louder (easier to get spotted).'
            : 'WALK  -  normal pace.'
        );
      }],
      ['HEAL', 0x22c55e, () => this.useBandage()],
      ['?', 0x0369a1, () => this.openHelpPanel()],
      ['BAG', 0x57534e, () => this.openBagPanel()],
      ['MAP', 0x0f766e, () => this.toggleLegend()],
    ];
    const startX = w / 2 - ((labels.length - 1) * gap) / 2;
    this.actionButtons = [];
    labels.forEach(([label, color, fn], i) => {
      const b = this.makeUiButton(startX + i * gap, barY, 80, 40, label, color, fn, d + 1);
      this.actionButtons.push(b);
      if (label === 'USE') this.btnUse = b;
      if (label === 'SLEEP') this.btnSleep = b;
      if (label === 'HIDE') this.btnHide = b;
      if (label === 'SNEAK') this.btnSneak = b;
      if (label === 'CRAFT') this.btnCraft = b;
      if (label === 'WALK') this.btnRun = b;
      if (label === 'HEAL') this.btnHeal = b;
      if (label === '?') this.btnHelp = b;
      if (label === 'BAG') this.btnBag = b;
      if (label === 'MAP') this.btnLegend = b;
    });

    this.moreOpen = false;
    this.moreMenu = [];

    // Home compass  -  graphics chevron pointing +X; rotation = atan2 toward HQ
    this.homeArrow = this.add.graphics().setScrollFactor(0).setDepth(d + 2);
    this.homeArrow.setPosition(40, h - 96);
    this.drawHomeChevron();
    this.homeArrowLabel = this.add
      .text(40, h - 74, 'HQ', {
        fontFamily: 'system-ui',
        fontSize: '11px',
        fontStyle: 'bold',
        color: '#fbbf24',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(d + 2);
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

  openHelpPanel() {
    this.showPopup(
      'HELP',
      'WHO: You are the Runner.\nWHAT: Scavenge, craft Breach Kit, escape.\nWHEN: Day safer. Night dogs.\nWHERE: HQ center. Wall at edges.\nHOW: Click map. USE / SLEEP / CRAFT.\n\nSleep free at HQ. Away needs Sleeping Kit.\nTime pauses on popups.\nLeft-click enemies to attack.'
    );
  }

  openBagPanel() {
    // Full equip screen (drag/click)
    this.equipUI?.toggle();
    if (this.bagOpen) {
      this.log('BAG open. Drag items onto HEAD / BODY / LEGS / WEAPON / QUICK slots.');
    }
  }

  toggleLegend() {
    if (this.legendOpen) {
      this.closeLegend();
      return;
    }
    this.legendOpen = true;
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
      .rectangle(cx, cy, 480, 420, 0x0f172a, 0.98)
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
      .text(cx, cy - 185, 'MAP LEGEND', {
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
      ['Purple “U” bench', 'Street Rig  -  craft here'],
      ['Teal oval', 'Sleep spot  -  rest until morning'],
      ['Pink + white dot', 'Blueprint  -  walk on to learn recipe'],
      ['Amber / gold edge', 'ESCAPE pad  -  needs Breach Kit'],
      ['Yellow ▲ marker', 'Current objective'],
      ['You (small figure)', 'The Runner  -  click map to walk'],
    ];

    const body = lines
      .map(([a, b]) => `• ${a}   -   ${b}`)
      .join('\n');
    const text = this.add
      .text(cx - 210, cy - 150, body, {
        fontFamily: 'system-ui',
        fontSize: '13px',
        color: '#cbd5e1',
        lineSpacing: 6,
      })
      .setScrollFactor(0)
      .setDepth(d + 2);

    const close = this.makeUiButton(cx, cy + 180, 140, 40, 'CLOSE', 0x94a3b8, () => this.closeLegend(), d + 3);
    this.legendUi = [dim, panel, title, text, close.bg, close.label];
  }

  closeLegend() {
    this.legendOpen = false;
    for (const o of this.legendUi || []) o?.destroy?.();
    this.legendUi = [];
  }

  toggleMoreMenu() {
    if (this.moreOpen) {
      this.closeMoreMenu();
      return;
    }
    this.moreOpen = true;
    this.closeLegend();
    const d = 130;
    const bx = this.btnMore.bg.x;
    const by = this.btnMore.bg.y - 50;
    const items = [
      {
        label: 'HELP ON/OFF',
        color: 0x38bdf8,
        fn: () => {
          const on = this.help.toggle();
          this.log(on ? 'Help ON  -  click tip text for next.' : 'Help OFF.');
          this.refreshHud();
          this.closeMoreMenu();
        },
      },
      {
        label: 'NEXT TIP',
        color: 0x0369a1,
        fn: () => {
          if (this.help.enabled) this.help.next();
          this.refreshHud();
          this.closeMoreMenu();
        },
      },
      {
        label: 'STOP WALK',
        color: 0x64748b,
        fn: () => {
          this.clearMousePath();
          this.log('Stopped.');
          this.closeMoreMenu();
        },
      },
    ];
    items.forEach((it, i) => {
      const b = this.makeUiButton(bx, by - i * 46, 120, 40, it.label, it.color, it.fn, d);
      this.moreMenu.push(b.bg, b.label);
    });
  }

  closeMoreMenu() {
    this.moreOpen = false;
    for (const o of this.moreMenu) o.destroy();
    this.moreMenu = [];
  }

  /**
   * HUD button  -  always scrollFactor 0, high depth, reliable clicks.
   */
  makeUiButton(x, y, w, h, label, color, onClick, depth = 121) {
    const bg = this.add
      .rectangle(x, y, w, h, color, 1)
      .setStrokeStyle(2, 0xf8fafc, 0.4)
      .setScrollFactor(0)
      .setDepth(depth)
      .setInteractive({ useHandCursor: true });
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

    bg.on('pointerover', () => bg.setAlpha(0.88));
    bg.on('pointerout', () => bg.setAlpha(1));
    bg.on('pointerdown', (pointer) => {
      if (pointer.event?.stopPropagation) pointer.event.stopPropagation();
      this.uiBlockClick = true;
    });
    bg.on('pointerup', (pointer) => {
      if (pointer.event?.stopPropagation) pointer.event.stopPropagation();
      onClick();
      this.time.delayedCall(80, () => {
        this.uiBlockClick = false;
      });
    });
    return { bg, label: text };
  }

  refreshHud() {
    const p = this.player;
    const atk = this.inv.totalAtk(p.baseAtk) + (this.player.batBonus && this.inv.weapon?.id === 'pipe' ? this.player.batBonus : 0);
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

    this.statText.setText(
      `HP ${p.hp}/${p.maxHp}  ATK ${atk}  DEF ${def}  ·  ${zone}${this.hiding ? '  · HIDING' : ''}`
    );

    const s = this.inv.summary();
    this.invText.setText(`${s.mats}\n${s.gear}\nBP ${[...this.inv.blueprints].length}`);

    this.syncMoveModeButtons();
    if (this.btnSleep) {
      const kits = this.countBedrolls();
      this.btnSleep.label.setText(kits > 0 ? `SLEEP×${kits}` : 'SLEEP');
    }
    this.updateDayBar();
    this.updateCombatHud();
    this.updateHomeArrow();
    this.updateSneakRing();
    if (this.objText) this.objText.setText(this.objective || '');
    if (this.objMarker && this.objTarget) {
      // Spots use {x,y} tiles; actors use {tx,ty}
      const ox = this.objTarget.tx ?? this.objTarget.x;
      const oy = this.objTarget.ty ?? this.objTarget.y;
      if (ox != null && oy != null) {
        this.objMarker.setPosition(ox * TILE + 16, oy * TILE - 4);
        this.objMarker.setVisible(this.mode !== 'combat');
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
    this.playerBarLabel.setText(`YOU  ${p.hp}/${p.maxHp}  (${this.inv.weapon?.name || 'Fists'})`);

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
    return !!(this.popupOpen || this.craftOpen || this.legendOpen || this.bagOpen);
  }

  spawnGuideDog() {
    if (this.guideDog?.alive) return;
    // Spawn just west of player so they can see it
    const spots = [
      [this.player.tx - 2, this.player.ty],
      [this.player.tx - 1, this.player.ty + 1],
      [this.player.tx - 1, this.player.ty - 1],
      [this.player.tx, this.player.ty - 2],
    ];
    for (const [x, y] of spots) {
      if (this.walkable(x, y) && !this.actorAt(x, y)) {
        const dog = makeEnemy(this, x, y, ENEMY.dog, 'dog');
        dog.nightOnly = false;
        dog._dormant = false;
        this.enemies.push(dog);
        this.guideDog = dog;
        this.log('A Grid Dog pads into the street. Left-click it.');
        return;
      }
    }
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

    const d = 500;
    const w = Math.round(this.scale.width);
    const h = Math.round(this.scale.height);
    const cx = Math.round(w / 2);
    const hasCheck = !!opts.checkboxLabel;
    const panelW = Math.min(560, w - 48);

    // Measure body first so panel fits and button sits below text
    const probe = this.add
      .text(0, 0, body, {
        fontFamily: 'system-ui',
        fontSize: '15px',
        align: 'center',
        wordWrap: { width: panelW - 56 },
        lineSpacing: 8,
      })
      .setVisible(false);
    const bodyH = Math.ceil(probe.height);
    probe.destroy();

    const titleH = 36;
    const padTop = 24;
    const gapTitleBody = 20;
    const gapBodyCheck = hasCheck ? 28 : 16;
    const checkH = hasCheck ? 28 : 0;
    const gapCheckBtn = 24;
    const btnH = 48;
    const padBot = 24;
    const panelH = Math.min(
      h - 40,
      padTop + titleH + gapTitleBody + bodyH + gapBodyCheck + checkH + gapCheckBtn + btnH + padBot
    );
    const cy = Math.round(h / 2);
    const panelTop = Math.round(cy - panelH / 2);

    const dim = this.add
      .rectangle(cx, cy, w, h, 0x020617, 0.78)
      .setScrollFactor(0)
      .setDepth(d)
      .setInteractive();

    const panel = this.add
      .rectangle(cx, cy, panelW, panelH, 0x0f172a, 1)
      .setStrokeStyle(3, 0x38bdf8)
      .setScrollFactor(0)
      .setDepth(d + 1)
      .setInteractive();

    const t1 = this.add
      .text(cx, panelTop + padTop, title, {
        fontFamily: 'system-ui',
        fontSize: '24px',
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
        fontSize: '15px',
        color: '#cbd5e1',
        align: 'center',
        wordWrap: { width: panelW - 56 },
        lineSpacing: 8,
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(d + 2);

    // Default OFF for track checkbox
    let checked = opts.checkboxDefault === true;
    const ui = [dim, panel, t1, t2];

    if (hasCheck) {
      const boxY = Math.round(bodyY + bodyH + gapBodyCheck + 10);
      const box = this.add
        .rectangle(cx - 170, boxY, 22, 22, checked ? 0x0ea5e9 : 0x1e293b, 1)
        .setStrokeStyle(2, 0x94a3b8)
        .setScrollFactor(0)
        .setDepth(d + 3)
        .setInteractive({ useHandCursor: true });
      const mark = this.add
        .text(cx - 170, boxY, checked ? 'Y' : '', {
          fontFamily: 'system-ui',
          fontSize: '14px',
          fontStyle: 'bold',
          color: '#0b1220',
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(d + 4);
      const lab = this.add
        .text(cx - 150, boxY, opts.checkboxLabel, {
          fontFamily: 'system-ui',
          fontSize: '14px',
          color: '#e2e8f0',
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

    const finish = (fromOk) => {
      ui.forEach((o) => o?.destroy?.());
      ok.bg.destroy();
      ok.label.destroy();
      this.popupOpen = false;
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

    const ok = this.makeUiButton(cx, btnY, 168, btnH, 'GOT IT', 0x0ea5e9, () => finish(true), d + 5);
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
    const needs = Object.entries(bp.needs)
      .map(([m, n]) => `${MAT[m]?.name || m} ×${n}`)
      .join('\n');
    const body =
      `You found the blueprint: ${bp.name}.\n\n` +
      `Needs:\n${needs}\n\n` +
      `Craft at a purple Street Rig when you have the parts.\n` +
      `(Time is paused while this is open.)`;

    this.showPopup('BLUEPRINT', body, null, {
      checkboxLabel: 'Track materials (show hunt list on screen)',
      checkboxDefault: false,
      onConfirm: (checked) => {
        if (checked) this.addHunt(bpId);
        else this.log(`Learned ${bp.name}. Open CRAFT at a purple bench when ready.`);
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

  // ─── INPUT (mouse-first; keyboard still works) ───────
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
      if (this.ended || this.uiBlockClick) return;

      // Craft modal handles its own UI; dimmer closes on outside click
      if (this.craftOpen) return;

      // Ignore top HUD / bottom action bar
      if (p.y < 56 || p.y > this.scale.height - 90) return;
      if (this.legendOpen) return;

      // Close MORE menu if open and click elsewhere
      if (this.moreOpen) {
        this.closeMoreMenu();
      }

      const wpt = this.cameras.main.getWorldPoint(p.x, p.y);
      const tx = (wpt.x / TILE) | 0;
      const ty = (wpt.y / TILE) | 0;
      this.handleWorldClick(tx, ty, p.rightButtonReleased() || p.button === 2);
    });

    this.input.mouse?.disableContextMenu();
  }

  handleWorldClick(tx, ty, rightClick = false) {
    if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) return;

    // Combat mode: click enemy to attack (or step adjacent), click empty tile to step once
    if (this.mode === 'combat') {
      if (this.combatTurn !== 'player' || this.popupOpen) {
        this.log('Wait  -  enemy turn / popup.');
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

    // Left-click enemy = open combat / first shot (you initiate)
    // Later: right-click could open special actions menu
    const enemy = this.actorAt(tx, ty, this.player);
    if (enemy && !enemy.isPlayer && !enemy._dormant) {
      this.clearMousePath();
      this.startCombat(enemy, true);
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
      g === T.GEAR_DROP
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

  useBandage() {
    if (this.inv.items.some((i) => i.id === 'bandage')) {
      const r = this.inv.useConsumable('bandage', this.player);
      if (r) {
        this.log(`Bandage: +${r.healed} HP.`);
        this.refreshHud();
        return;
      }
    }
    if (this.inv.items.some((i) => i.id === 'stim')) {
      const r = this.inv.useConsumable('stim', this.player);
      if (r) {
        this.log(`Stim: +${r.healed} HP.`);
        this.refreshHud();
        return;
      }
    }
    this.log('No bandage or stim. Craft one or scavenge.');
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
      return;
    }

    if (this.mode === 'combat') {
      this.updateCombat(dt);
      this.refreshHud();
      return;
    }

    // Explore real-time
    this.dayNight.update(dt);
    this.nightVeil.setAlpha(this.dayNight.isNight ? 0.45 : 0.05);
    this.alert.update(dt, this.hiding);
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

    // Occasional ambient narrator (only if enabled and free)
    if (!this.popupOpen && this.story?.narratorOn) {
      this._ambT = (this._ambT || 0) + dt;
      if (this._ambT > 12) {
        this._ambT = 0;
        const amb = this.story.ambientChance();
        if (amb) this.showPopup(amb.title, amb.body);
      }
    }

    // Zone story once when entering
    const zNow = this.zones.getZone(this.player.tx, this.player.ty);
    if (zNow !== this._lastStoryZone) {
      this._lastStoryZone = zNow;
      const zc = this.story.onZone(zNow);
      if (zc) this.time.delayedCall(200, () => this.showPopup(zc.title, zc.body));
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
    this.audio.move();
    this.hiding = false;
    const isRun = (this.running || shiftRun) && !this.sneaking;
    const isSneak = this.sneaking && !isRun;
    const moveMul = 1 - (this.player.moveBonus || 0) * 0.12;
    let baseMs = PLAYER.moveMs * Math.max(0.7, moveMul);
    if (isSneak) baseMs *= 1.45 - (this.player.sneakBonus || 0) * 0.05;
    if (isRun) baseMs *= 0.65;
    this.moveCd = baseMs;

    const noise = isRun ? PLAYER.noiseRun : isSneak ? PLAYER.noiseWalk * 0.35 : PLAYER.noiseWalk;
    const res = this.alert.makeNoise(
      noise,
      nx,
      ny,
      this.enemies.filter((e) => e.alive && !e._dormant)
    );
    if (res.result === 'yellow') {
      this.audio.yellow();
      this.help.once(
        'yellow',
        'CAUTION: Something heard you. Click HIDE, or sneak (RUN off). More noise → HOSTILE.'
      );
      this.log('Footsteps echo. Yellow alert  -  click HIDE or stay quiet.');
    } else if (res.result === 'spotted') {
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
      this.time.delayedCall(50, () => this.checkGuide());
    }

    if (g === T.ESCAPE) this.tryEscape();
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
    this.useBandage();
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

    // roll mats  -  during Quest 1, first crate always yields enough cloth for bandage
    const table = ['scrap', 'scrap', 'wire', 'cloth', 'battery', 'chem', 'circuit', 'food', 'scrap'];
    const z = this.zones.getZone(tx, ty);
    const rolls = 2 + (z === ZONE.OUTER || z === ZONE.WALL ? 1 : 0) + (this.player.scavengeBonus || 0);
    const got = [];
    const guideQ1 = this.guide && !this.guide.done && this.guide.quest === 0 && !this._guideLooted;
    if (guideQ1) {
      this.inv.addMat('cloth', 2);
      this.inv.addMat('scrap', 1);
      got.push(MAT.cloth.name, MAT.cloth.name, MAT.scrap.name);
    } else {
      for (let i = 0; i < rolls; i++) {
        let id = table[(Math.random() * table.length) | 0];
        if (this.dayNight.isNight && Math.random() < 0.15) id = 'circuit';
        this.inv.addMat(id, 1);
        got.push(MAT[id].name);
      }
    }
    // food auto nibble option
    if (got.includes('MRE Paste') && Math.random() < 0.5) {
      this.player.heal(4);
    }
    this.audio.scavenge();
    this.alert.makeNoise(0.35, tx, ty, this.enemies.filter((e) => e.alive && !e._dormant));
    this._guideLooted = true;
    this.updateObjective();
    this.refreshHuntHud();
    this.log(`Scavenged: ${got.join(', ')}.`);
    this.checkGuide();
  }

  /** HQ courtyard = free rest. Away from base needs Sleeping Kit. */
  isAtHomeBase() {
    return this.zones.manhattan(this.player.tx, this.player.ty) <= 6;
  }

  countBedrolls() {
    return this.inv.countItem('bedroll');
  }

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
  }

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
    const panel = this.add
      .rectangle(cx, cy, 580, 460, 0x0f172a, 0.98)
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

    const title = this.add
      .text(cx, cy - 200, 'STREET RIG  -  click a recipe', {
        fontFamily: 'system-ui',
        fontSize: '20px',
        fontStyle: 'bold',
        color: '#e9d5ff',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(d + 2);

    // X close (top-right of panel)
    const xBtn = this.makeUiButton(cx + 250, cy - 200, 44, 36, '✕', 0xef4444, () => {
      this.toggleCraft(false);
    }, d + 5);

    // CLOSE button (bottom center)  -  guaranteed scene-level
    const closeBtn = this.makeUiButton(cx, cy + 195, 160, 44, 'CLOSE', 0x94a3b8, () => {
      this.toggleCraft(false);
    }, d + 5);

    this.craftUi.push(dim, panel, title, xBtn.bg, xBtn.label, closeBtn.bg, closeBtn.label);

    const list = [...this.inv.blueprints];
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

    list.forEach((id, i) => {
      const bp = BLUEPRINTS[id];
      const need = Object.entries(bp.needs)
        .map(([m, n]) => `${MAT[m]?.name || m}×${n} (have ${this.inv.count(m)})`)
        .join(', ');
      const ready = this.inv.canCraft(id);
      const rowY = cy - 140 + i * 56;

      const row = this.add
        .rectangle(cx, rowY, 520, 50, ready ? 0x14532d : 0x1e293b, 1)
        .setStrokeStyle(2, ready ? 0x4ade80 : 0x475569)
        .setScrollFactor(0)
        .setDepth(d + 3)
        .setInteractive({ useHandCursor: true });

      const rowText = this.add
        .text(cx - 250, rowY, `${bp.name}   ${ready ? '✓  CLICK TO CRAFT' : '… need parts'}\n${need}`, {
          fontFamily: 'system-ui',
          fontSize: '13px',
          color: '#f1f5f9',
          lineSpacing: 3,
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
    const gear = this.inv.craft(id);
    // Neon Val bat bonus when crafting/equipping pipe
    if (gear.id === 'pipe' && this.player.batBonus) {
      gear.atk = (gear.atk || 0) + this.player.batBonus;
    }
    if (gear.id === 'zipgun' && this.player.rangedBonus) {
      gear.atk = (gear.atk || 0) + this.player.rangedBonus;
    }
    this.audio.craft();
    this.log(`Crafted ${gear.name}. ${gear.desc}`);
    this.huntList = this.huntList.filter((h) => BLUEPRINTS[h.bpId]?.result !== gear.id);
    this.refreshHuntHud();
    this.buildCraftModal();
    this.updateObjective();
    this.refreshHud();
    this.checkGuide();
    const card = this.story.onCraft(gear.id, gear.name);
    // Prefer guide card over story craft card during tutorial
    if (this.guide && !this.guide.done) {
      // checkGuide already queues next step popup
    } else if (card) {
      this.time.delayedCall(80, () => this.showPopup(card.title, card.body));
    }
  }

  // ─── STEALTH / SPOT ──────────────────────────────────
  checkSpotting() {
    if (this.alert.state === ALERT.RED) return;
    const vis = this.dayNight.isNight ? PLAYER.visionNight : PLAYER.visionDay;
    for (const e of this.enemies) {
      if (!e.alive || e._dormant) continue;
      const d = Math.abs(e.tx - this.player.tx) + Math.abs(e.ty - this.player.ty);
      const theirVis = this.dayNight.isNight ? 5 : 7;
      if (d <= Math.min(vis, theirVis) && this.hasLos(e.tx, e.ty, this.player.tx, this.player.ty)) {
        // spotted if close LOS
        // Sneak = harder to spot; must be closer
        const spotRange = this.sneaking ? 3 : 5;
        if (d <= spotRange && !this.hiding) {
          this.sneaking = false;
          this.syncMoveModeButtons();
          this.updateSneakRing();
          this.alert.spot();
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

  // ─── COMBAT ──────────────────────────────────────────
  startCombat(enemy, playerInitiated) {
    if (this.ended) return;
    if (!enemy || !enemy.alive) return;
    if (this.mode === 'combat') {
      // Already fighting  -  attack this target instead of no-op
      this.combatAttackTarget(enemy);
      return;
    }
    if (playerInitiated) this.alert.engage();
    else this.alert.spot();

    this.mode = 'combat';
    this.clearMousePath();
    this.destroyCraftModal();
    this.closeMoreMenu();
    this.closeLegend();
    this.combatFocus = enemy;
    this.combatTurn = 'player';
    this.combatLogLines = [];
    this.audio.red();
    this.cameras.main.flash(120, 180, 40, 40);

    const rangeHint = enemy.ranged
      ? `${enemy.name} can shoot from a distance.`
      : `${enemy.name} is melee  -  they must step next to you to bite/hit. You need to be next to them too (unless you craft a Zip Gun).`;

    const begin = () => {
      this.combatLog(' -  fight start  - ');
      this.combatLog(
        playerInitiated
          ? `You jump ${enemy.name}.`
          : `${enemy.name} engages!`
      );
      this.combatLog(rangeHint);
      this.combatLog('Your turn  -  click the enemy to attack.');
      this.logText.setText('Combat log on the left. Click the enemy to hit.');
      this.refreshHud();
    };

    if (!this.seenCombatHelp) {
      this.seenCombatHelp = true;
      this.showPopup(
        'FIRST FIGHT',
        'Left panel: your HP, enemy HP, and a live combat log.\n\n• Left-click the enemy to attack\n• Click an adjacent empty tile to step\n• Melee foes must be next to you\n• Sneak first for a better chance to strike first\n• Later: right-click may open special actions\n• Craft a Zip Gun for ranged attacks',
        begin
      );
    } else {
      begin();
    }
  }

  updateCombat() {
    if (this.popupOpen) return;
    if (this.combatTurn !== 'player') return;

    // Auto-end if everyone nearby is dead
    if (!this.livingThreats().length) {
      this.endCombat(true);
      return;
    }

    // No FIGHT hotkey  -  click the enemy (left click)
    let dx = 0;
    let dy = 0;
    if (Phaser.Input.Keyboard.JustDown(this.cursors.left) || Phaser.Input.Keyboard.JustDown(this.keys.a))
      dx = -1;
    else if (Phaser.Input.Keyboard.JustDown(this.cursors.right) || Phaser.Input.Keyboard.JustDown(this.keys.d))
      dx = 1;
    else if (Phaser.Input.Keyboard.JustDown(this.cursors.up) || Phaser.Input.Keyboard.JustDown(this.keys.w))
      dy = -1;
    else if (Phaser.Input.Keyboard.JustDown(this.cursors.down) || Phaser.Input.Keyboard.JustDown(this.keys.s))
      dy = 1;
    if (dx || dy) this.playerCombatStep(dx, dy);
  }

  livingThreats() {
    return this.enemies.filter((e) => {
      if (!e.alive || e._dormant) return false;
      return Math.abs(e.tx - this.player.tx) + Math.abs(e.ty - this.player.ty) <= 12;
    });
  }

  combatStepToward(tx, ty) {
    let best = null;
    let bd = Math.abs(this.player.tx - tx) + Math.abs(this.player.ty - ty);
    for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
      const nx = this.player.tx + dx;
      const ny = this.player.ty + dy;
      if (!this.walkable(nx, ny)) continue;
      const occ = this.actorAt(nx, ny, this.player);
      if (occ && !occ.isPlayer) {
        this.combatAttackTarget(occ);
        return;
      }
      if (occ) continue;
      const nd = Math.abs(nx - tx) + Math.abs(ny - ty);
      if (nd < bd) {
        bd = nd;
        best = { dx, dy };
      }
    }
    if (best) this.playerCombatStep(best.dx, best.dy);
    else this.log('Blocked.');
  }

  combatAttackTarget(foe) {
    if (!foe?.alive) {
      this.checkCombatEnd();
      return;
    }
    const d = Math.abs(foe.tx - this.player.tx) + Math.abs(foe.ty - this.player.ty);
    const range = this.inv.weapon?.ranged ? this.inv.weapon.range || 5 : 1;
    if (d <= range && this.hasLos(this.player.tx, this.player.ty, foe.tx, foe.ty)) {
      this.resolveHit(this.player, foe, d > 1);
      this.afterPlayerCombat();
    } else if (d > 1) {
      this.combatStepToward(foe.tx, foe.ty);
    } else {
      this.log('No line of sight.');
    }
  }

  playerCombatStep(dx, dy) {
    const nx = this.player.tx + dx;
    const ny = this.player.ty + dy;
    const foe = this.actorAt(nx, ny, this.player);
    if (foe && !foe.isPlayer) {
      this.resolveHit(this.player, foe);
      this.afterPlayerCombat();
      return;
    }
    if (!this.walkable(nx, ny)) return;
    this.player.setTile(nx, ny, true);
    this.afterPlayerCombat();
  }

  playerCombatAttack() {
    let best = this.combatFocus?.alive ? this.combatFocus : null;
    let bd = best
      ? Math.abs(best.tx - this.player.tx) + Math.abs(best.ty - this.player.ty)
      : 99;
    const range = this.inv.weapon?.ranged ? this.inv.weapon.range || 5 : 1;
    for (const e of this.enemies) {
      if (!e.alive || e._dormant) continue;
      const d = Math.abs(e.tx - this.player.tx) + Math.abs(e.ty - this.player.ty);
      if (d <= range && d < bd && this.hasLos(this.player.tx, this.player.ty, e.tx, e.ty)) {
        bd = d;
        best = e;
      }
    }
    if (!best) {
      // step toward any nearby threat
      const threats = this.livingThreats();
      if (!threats.length) {
        this.endCombat(true);
        return;
      }
      threats.sort(
        (a, b) =>
          Math.abs(a.tx - this.player.tx) +
          Math.abs(a.ty - this.player.ty) -
          (Math.abs(b.tx - this.player.tx) + Math.abs(b.ty - this.player.ty))
      );
      this.log(`Too far  -  stepping toward ${threats[0].name}.`);
      this.combatStepToward(threats[0].tx, threats[0].ty);
      return;
    }
    this.combatAttackTarget(best);
  }

  resolveHit(att, def, ranged = false) {
    if (!def?.alive) return;
    let bonus = 0;
    if (att.isPlayer) {
      bonus = (this.inv.weapon?.atk || 0);
      if (this.player.batBonus && (this.inv.weapon?.id === 'pipe' || this.inv.weapon?.id === 'stick')) {
        bonus += this.player.batBonus;
      }
      if (this.player.rangedBonus && this.inv.weapon?.ranged) bonus += this.player.rangedBonus;
    }
    const raw = att.baseAtk + ((Math.random() * 3) | 0);
    const { dmg, killed } = def.takeDamage(raw, bonus);
    this.audio.hit();
    const verb = ranged
      ? att.kind === 'drone'
        ? 'zaps'
        : 'shoots'
      : att.kind === 'dog'
        ? 'bites'
        : 'hits';
    const line = `${att.name} ${verb} ${def.name} for ${dmg}${killed ? '  -  DOWN!' : `  (${def.hp} HP left)`}`;
    this.combatLog(line);
    this.logText.setText(line);
    this.updateCombatHud();

    if (killed && def.isPlayer) {
      this.combatLog('You drop. Run over.');
      this.lose();
      return;
    }
    if (killed && !def.isPlayer) {
      if (this.combatFocus === def) this.combatFocus = null;
      if (def === this.guideDog || def.kind === 'dog') this._guideDogDead = true;
      this.combatLog(`${def.name} is out.`);
      try {
        def.destroy();
      } catch (_) {
        /* already gone */
      }
      this.enemies = this.enemies.filter((e) => e !== def && e.alive);
      if (Math.random() < 0.6) {
        this.inv.addMat('scrap', 1 + ((Math.random() * 2) | 0));
        this.combatLog('Looted scrap.');
      }
      this.checkGuide();
    }
  }

  checkCombatEnd() {
    if (this.mode !== 'combat') return;
    if (!this.livingThreats().length) this.endCombat(true);
  }

  afterPlayerCombat() {
    if (this.ended) return;
    this.enemies = this.enemies.filter((e) => e.alive);
    if (!this.livingThreats().length) {
      this.endCombat(true);
      return;
    }
    this.combatTurn = 'enemy';
    this.combatLog(' -  enemy turn  - ');
    this.logText.setText('Enemy turn…');
    this.refreshHud();
    const near = this.livingThreats();
    // Stagger enemy actions so the log is readable
    let i = 0;
    const step = () => {
      if (this.ended || this.mode !== 'combat') return;
      if (i >= near.length || !this.player.alive) {
        this.enemies = this.enemies.filter((e) => e.alive);
        if (!this.livingThreats().length || !this.player.alive) {
          if (this.player.alive) this.endCombat(true);
          return;
        }
        this.combatTurn = 'player';
        this.combatLog(' -  your turn  - ');
        this.logText.setText('Your move  -  click the enemy to attack.');
        this.refreshHud();
        return;
      }
      const e = near[i++];
      if (e.alive) this.enemyCombatAct(e);
      this.refreshHud();
      this.time.delayedCall(280, step);
    };
    this.time.delayedCall(200, step);
  }

  enemyCombatAct(e) {
    if (!e.alive) return;
    const p = this.player;
    const d = Math.abs(e.tx - p.tx) + Math.abs(e.ty - p.ty);
    const range = e.ranged ? e.range || 4 : 1;
    if (d <= range && this.hasLos(e.tx, e.ty, p.tx, p.ty)) {
      this.resolveHit(e, p, d > 1 || e.ranged);
      return;
    }
    const ox = e.tx;
    const oy = e.ty;
    this.stepEnemyToward(e, p.tx, p.ty);
    if (e.tx !== ox || e.ty !== oy) {
      this.combatLog(`${e.name} moves closer…`);
    } else {
      this.combatLog(`${e.name} is blocked.`);
    }
  }

  endCombat(won) {
    this.mode = 'explore';
    this.combatTurn = 'player';
    this.combatFocus = null;
    this.clearMousePath();
    this.alert.clearCombat();
    this.combatLog(won ? ' -  fight over  - ' : ' - ');
    this.logText.setText(won ? 'Fight over. CLEAR  -  for now.' : '…');
    if (this.combatHud) this.combatHud.setVisible(false);
    this.refreshHud();
  }

  // ─── FOW ─────────────────────────────────────────────
  isVisibleTile(tx, ty) {
    const vis = this.dayNight.isNight ? PLAYER.visionNight : PLAYER.visionDay;
    const d = Math.abs(tx - this.player.tx) + Math.abs(ty - this.player.ty);
    if (d > vis) return false;
    return this.hasLos(this.player.tx, this.player.ty, tx, ty);
  }

  updateFow() {
    this.fow.clear();
    const cam = this.cameras.main;
    const l = ((cam.worldView.x / TILE) | 0) - 1;
    const r = (((cam.worldView.x + cam.worldView.width) / TILE) | 0) + 1;
    const t = ((cam.worldView.y / TILE) | 0) - 1;
    const b = (((cam.worldView.y + cam.worldView.height) / TILE) | 0) + 1;
    const vis = this.dayNight.isNight ? PLAYER.visionNight : PLAYER.visionDay;

    for (let y = Math.max(0, t); y < Math.min(MAP_H, b); y++) {
      for (let x = Math.max(0, l); x < Math.min(MAP_W, r); x++) {
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
    this.inv.takeBreach();
    this.win();
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
    this.add
      .rectangle(this.scale.width / 2, this.scale.height / 2, this.scale.width, this.scale.height, 0x020617, 0.82)
      .setScrollFactor(0)
      .setDepth(200);
    this.add
      .text(this.scale.width / 2, this.scale.height * 0.35, won ? 'YOU ESCAPED' : 'KIA', {
        fontFamily: 'system-ui',
        fontSize: '48px',
        fontStyle: 'bold',
        color: won ? '#38bdf8' : '#fb7185',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(201);
    this.add
      .text(this.scale.width / 2, this.scale.height * 0.48, msg, {
        fontFamily: 'system-ui',
        fontSize: '16px',
        color: '#cbd5e1',
        align: 'center',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(201);
    const btn = this.add
      .rectangle(this.scale.width / 2, this.scale.height * 0.62, 220, 56, won ? 0x0ea5e9 : 0xe11d48)
      .setScrollFactor(0)
      .setDepth(201)
      .setInteractive({ useHandCursor: true });
    this.add
      .text(this.scale.width / 2, this.scale.height * 0.62, 'NEW RUN', {
        fontFamily: 'system-ui',
        fontSize: '22px',
        fontStyle: 'bold',
        color: '#fff',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(202);
    btn.on('pointerup', () => this.scene.restart());
  }
}

function hash(x, y) {
  let n = x * 374761393 + y * 668265263;
  n = (n ^ (n >> 13)) * 1274126177;
  return Math.abs(n ^ (n >> 16));
}
