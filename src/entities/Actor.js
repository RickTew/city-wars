import { TILE, PLAYER } from '../config/constants.js';

/** Player or enemy — clear silhouette, no ghost trails */
export class Actor {
  constructor(scene, opts) {
    this.scene = scene;
    this.tx = opts.tx;
    this.ty = opts.ty;
    this.isPlayer = !!opts.isPlayer;
    this.name = opts.name || 'Unit';
    this.maxHp = opts.maxHp;
    this.hp = opts.maxHp;
    this.baseAtk = opts.atk || 1;
    this.baseDef = opts.def || 0;
    this.alive = true;
    this.ranged = !!opts.ranged;
    this.range = opts.range || 1;
    this.hearRange = opts.hearRange || 6;
    this.kind = opts.kind || 'thug';
    this.nightOnly = !!opts.nightOnly;
    this.xp = opts.xp || 0;

    const px = this.tx * TILE + TILE / 2;
    const py = this.ty * TILE + TILE / 2;
    const col = opts.color || 0xffffff;

    // Use a single parent container; never leave orphan graphics
    this.root = scene.add.container(px, py).setDepth(this.isPlayer ? 25 : 22);

    this.shadow = scene.add.ellipse(0, 12, this.isPlayer ? 18 : 14, 6, 0x000000, 0.35);
    this.root.add(this.shadow);

    if (this.isPlayer) {
      this.buildPlayerLook(scene, opts);
    } else if (this.kind === 'dog') {
      this.buildDogLook(scene);
    } else if (this.kind === 'drone') {
      this.buildDroneLook(scene, col);
    } else if (this.kind === 'enforcer') {
      this.buildEnforcerLook(scene, col);
    } else {
      // thug / default gang runner
      this.buildThugLook(scene, col);
    }

    this.hpText = scene.add
      .text(0, 16, '', {
        fontFamily: 'system-ui',
        fontSize: '11px',
        fontStyle: 'bold',
        color: '#fff',
        stroke: '#000',
        strokeThickness: 3,
      })
      .setOrigin(0.5);
    this.root.add(this.hpText);
    this.refreshHp();
  }

  buildDogLook(scene) {
    // Larger, clearer silhouette — must read as a dog at tile scale (not a brown blob)
    const shadow = scene.add.ellipse(0, 11, 26, 8, 0x000000, 0.35);
    const torso = scene.add.ellipse(-1, 1, 26, 14, 0x57534e);
    const belly = scene.add.ellipse(2, 4, 16, 8, 0x78716c, 0.55);
    const rump = scene.add.circle(-12, 1, 7, 0x44403c);
    const neck = scene.add.ellipse(8, -1, 10, 9, 0x57534e);
    const head = scene.add.ellipse(14, -2, 13, 11, 0x78716c);
    const snout = scene.add.ellipse(22, 0, 10, 6, 0xa8a29e);
    const nose = scene.add.circle(26, 0, 2, 0x1c1917);
    const earL = scene.add.triangle(10, -10, 0, 2, 8, 4, 3, -12, 0x44403c);
    const earR = scene.add.triangle(16, -9, 0, 2, 7, 3, 2, -11, 0x57534e);
    const leg1 = scene.add.rectangle(-8, 10, 4, 8, 0x292524);
    const leg2 = scene.add.rectangle(-2, 10, 4, 8, 0x1c1917);
    const leg3 = scene.add.rectangle(6, 10, 4, 8, 0x292524);
    const leg4 = scene.add.rectangle(12, 10, 4, 8, 0x1c1917);
    const tail = scene.add.rectangle(-18, -4, 12, 3, 0x57534e).setAngle(-35);
    const eye = scene.add.circle(16, -3, 2.2, 0xfbbf24);
    const eyeDot = scene.add.circle(16.5, -3, 0.9, 0x0f172a);
    this.root.add([
      shadow,
      tail,
      leg1,
      leg2,
      leg3,
      leg4,
      rump,
      torso,
      belly,
      neck,
      head,
      snout,
      nose,
      earL,
      earR,
      eye,
      eyeDot,
    ]);
    this.flash = torso;
  }

  buildThugLook(scene, col) {
    const pants = scene.add.rectangle(0, 8, 11, 10, 0x292524);
    const torso = scene.add.rectangle(0, 0, 14, 14, col);
    const head = scene.add.circle(0, -11, 5, 0xfde68a);
    const hair = scene.add.ellipse(0, -15, 10, 5, 0x1c1917);
    const bat = scene.add.rectangle(10, 2, 4, 16, 0xa8a29e).setAngle(25);
    const eye = scene.add.rectangle(2, -11, 3, 1.5, 0xf87171);
    this.root.add([pants, torso, head, hair, bat, eye]);
    this.flash = torso;
  }

  buildEnforcerLook(scene, col) {
    const boots = scene.add.rectangle(0, 10, 14, 8, 0x1c1917);
    const legs = scene.add.rectangle(0, 5, 13, 10, 0x44403c);
    const torso = scene.add.rectangle(0, -2, 18, 16, col);
    const pad = scene.add.rectangle(0, -4, 20, 8, 0x7f1d1d, 0.7);
    const head = scene.add.circle(0, -14, 6, 0xe7e5e4);
    const helm = scene.add.rectangle(0, -16, 14, 6, 0x450a0a);
    const visor = scene.add.rectangle(0, -13, 10, 3, 0xfbbf24);
    this.root.add([boots, legs, torso, pad, head, helm, visor]);
    this.flash = torso;
  }

  buildDroneLook(scene, col) {
    const body = scene.add.ellipse(0, 0, 18, 12, col);
    const core = scene.add.circle(0, 0, 4, 0xf0f9ff);
    const eye = scene.add.circle(0, 0, 2, 0xef4444);
    const wingL = scene.add.rectangle(-12, -2, 8, 3, 0x0ea5e9, 0.85).setAngle(-20);
    const wingR = scene.add.rectangle(12, -2, 8, 3, 0x0ea5e9, 0.85).setAngle(20);
    const ant = scene.add.rectangle(0, -10, 2, 8, 0x94a3b8);
    const tip = scene.add.circle(0, -14, 2, 0xfbbf24);
    this.root.add([wingL, wingR, body, core, eye, ant, tip]);
    this.flash = body;
  }

  /** Distinct look per character id/style */
  buildPlayerLook(scene, opts) {
    const col = opts.color || 0x38bdf8;
    const hair = opts.hair || 0xfde68a;
    const style = opts.style || 'default';
    const skin = 0xfde68a;
    const pants = style === 'tank' ? 0x44403c : 0x1e3a5f;

    const legs = scene.add.rectangle(0, 7, style === 'tank' ? 12 : 10, 10, pants);
    const torso = scene.add.rectangle(0, -1, style === 'tank' ? 16 : style === 'slim' ? 12 : 14, 14, col);
    const head = scene.add.circle(0, -12, style === 'tank' ? 6 : 5, skin);
    const hairG = scene.add.ellipse(0, -16, style === 'glam' ? 12 : 10, style === 'hood' ? 8 : 6, hair);

    const bits = [legs, torso, head, hairG];

    if (style === 'hood' || style === 'ninja') {
      bits.push(scene.add.rectangle(0, -14, 14, 6, 0x1e1b4b, 0.9));
      bits.push(scene.add.rectangle(2, -12, 6, 2, 0xa78bfa));
    } else if (style === 'glam') {
      bits.push(scene.add.rectangle(2, -12, 6, 2, 0xf9a8d4));
      bits.push(scene.add.circle(5, -8, 1.5, 0xfbbf24));
    } else if (style === 'medic') {
      bits.push(scene.add.rectangle(0, -2, 4, 10, 0xffffff));
      bits.push(scene.add.rectangle(0, -2, 10, 4, 0xffffff));
    } else if (style === 'tech' || style === 'wire') {
      bits.push(scene.add.rectangle(2, -12, 7, 2, 0x22d3ee));
      bits.push(scene.add.rectangle(-4, 0, 3, 6, 0x0ea5e9));
    } else if (style === 'demo') {
      bits.push(scene.add.rectangle(0, -14, 12, 4, 0xfbbf24));
      bits.push(scene.add.circle(6, 2, 3, 0xdc2626));
    } else if (style === 'forge') {
      bits.push(scene.add.rectangle(0, -14, 12, 3, 0x78350f));
      bits.push(scene.add.rectangle(5, 1, 4, 8, 0xa8a29e));
    } else if (style === 'slim') {
      bits.push(scene.add.rectangle(2, -12, 5, 2, 0x7dd3fc));
    } else {
      bits.push(scene.add.rectangle(2, -12, 6, 2, 0x0ea5e9));
    }

    this.root.add(bits);
    this.flash = torso;
  }

  /** Back-compat for camera follow */
  get body() {
    return this.root;
  }

  get x() {
    return this.root.x;
  }
  get y() {
    return this.root.y;
  }

  get atk() {
    return this.baseAtk;
  }
  get def() {
    return this.baseDef;
  }

  asFollowTarget() {
    return this.root;
  }

  setTile(tx, ty, animate = true) {
    this.tx = tx;
    this.ty = ty;
    const px = tx * TILE + TILE / 2;
    const py = ty * TILE + TILE / 2;
    // Kill old tweens so nothing ghosts / stacks
    this.scene.tweens.killTweensOf(this.root);
    if (animate) {
      this.scene.tweens.add({
        targets: this.root,
        x: px,
        y: py,
        duration: 90,
        ease: 'Sine.easeOut',
      });
    } else {
      this.root.setPosition(px, py);
    }
  }

  refreshHp() {
    this.hpText.setText(this.isPlayer ? '' : String(Math.max(0, this.hp)));
  }

  heal(n) {
    const b = this.hp;
    this.hp = Math.min(this.maxHp, this.hp + n);
    this.refreshHp();
    return this.hp - b;
  }

  takeDamage(raw, attackerAtkBonus = 0) {
    const dmg = Math.max(1, raw + attackerAtkBonus - this.def);
    this.hp = Math.max(0, this.hp - dmg);
    this.refreshHp();
    this.scene.tweens.killTweensOf(this.flash);
    this.flash.setAlpha(1);
    this.scene.tweens.add({
      targets: this.flash,
      alpha: 0.25,
      yoyo: true,
      duration: 50,
      repeat: 1,
      onComplete: () => this.flash.setAlpha(1),
    });
    if (this.hp <= 0) {
      this.alive = false;
      this.root.setAlpha(0.4);
    }
    return { dmg, killed: !this.alive };
  }

  setVisible(v) {
    this.root.setVisible(v);
  }

  destroy() {
    this.scene.tweens.killTweensOf(this.root);
    this.scene.tweens.killTweensOf(this.flash);
    this.root.destroy(true);
  }
}

export function makePlayer(scene, tx, ty, char = null) {
  const b = char?.bonuses || {};
  const p = new Actor(scene, {
    tx,
    ty,
    isPlayer: true,
    name: char?.name || 'Runner',
    maxHp: PLAYER.maxHp + (b.maxHp || 0),
    atk: Math.max(1, PLAYER.atk + (b.atk || 0)),
    def: Math.max(0, PLAYER.def + (b.def || 0)),
    color: char?.color || 0x38bdf8,
    hair: char?.hair,
    style: char?.style || 'default',
  });
  p.charId = char?.id || 'neon_val';
  p.visionBonus = b.visionDay || 0;
  p.moveBonus = b.moveBonus || 0;
  p.sneakBonus = b.sneakBonus || 0;
  p.scavengeBonus = b.scavengeBonus || 0;
  p.batBonus = b.batBonus || 0;
  p.rangedBonus = b.rangedBonus || 0;
  p.healBonus = b.healBonus || 0;
  p.explosiveBonus = b.explosiveBonus || 0;
  p.craftBonus = b.craftBonus || 0;
  return p;
}

export function makeEnemy(scene, tx, ty, def, kind) {
  return new Actor(scene, {
    tx,
    ty,
    name: def.name,
    maxHp: def.hp,
    atk: def.atk,
    color: def.color,
    ranged: def.ranged,
    range: def.range,
    nightOnly: def.nightOnly,
    kind,
    xp: def.xp,
    hearRange: kind === 'dog' ? 8 : kind === 'drone' ? 7 : 6,
  });
}
