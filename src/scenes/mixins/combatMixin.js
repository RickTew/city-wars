/** Combat methods extracted from GameScene (mixin). */
export const combatMixin = {
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
    this.closeRunMenu();
    this.closeLegend();
    this.closeMoreMenu?.();
    this.combatFocus = enemy;
    this.combatTurn = 'player';
    this.combatLogLines = [];
    this.audio.red();
    this.cameras.main.flash(120, 180, 40, 40);
    // Show SPEC on the bottom bar (touch-friendly)
    this.rebuildActionBar?.();

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
      this.combatLog('Your turn  -  tap enemy. SPEC / long-press for specials.');
      this.logText.setText('Combat: tap foe. SPEC or long-press for specials.');
      this.refreshHud();
    };

    if (!this.seenCombatHelp) {
      this.seenCombatHelp = true;
      this.showPopup(
        'FIRST FIGHT',
        'Left panel: your HP, enemy HP, and a live combat log.\n\n' +
          '• Tap the enemy to attack\n' +
          '• Tap SPEC (or long-press the map) for specials\n' +
          '  Power Strike / Street Charge / Flee\n' +
          '• Desktop: right-click also opens specials\n' +
          '• Tap an adjacent empty tile to step\n' +
          '• HEAL uses bandages, stims, or MRE Paste\n' +
          '• Craft a Zip Gun for ranged attacks',
        begin
      );
    } else {
      begin();
    }
  },

  /** Right-click combat menu: Power strike, Street Charge, Flee */
  openCombatSpecials() {
    if (this.mode !== 'combat' || this.combatTurn !== 'player' || this.specialOpen) return;
    this.closeCombatSpecials();
    this.specialOpen = true;
    this.uiBlockClick = true;
    const d = 420;
    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2;
    this.specialUi = [];

    const dim = this.add
      .rectangle(cx, cy, this.scale.width, this.scale.height, 0x020617, 0.55)
      .setScrollFactor(0)
      .setDepth(d)
      .setInteractive();
    dim.on('pointerup', () => this.closeCombatSpecials());

    const panel = this.add
      .rectangle(cx, cy, 280, 220, 0x0f172a, 0.98)
      .setStrokeStyle(2, 0xf97316)
      .setScrollFactor(0)
      .setDepth(d + 1);

    const title = this.add
      .text(cx, cy - 88, 'SPECIALS', {
        fontFamily: 'system-ui',
        fontSize: '16px',
        fontStyle: 'bold',
        color: '#fdba74',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(d + 2);

    const mk = (y, label, color, fn) => {
      const b = this.makeUiButton(cx, y, 220, 36, label, color, () => {
        this.closeCombatSpecials();
        fn();
      }, d + 3);
      this.specialUi.push(b.bg, b.label);
    };

    mk(cy - 40, 'POWER STRIKE (+50% dmg)', 0xea580c, () => {
      this._powerNext = true;
      this.log('Power strike ready. Tap a foe.');
    });
    mk(cy + 5, this.inv.countItem('charge') > 0 ? 'STREET CHARGE' : 'CHARGE (none)', 0xdc2626, () => {
      if (!this.useStreetCharge()) this.log('No Street Charge equipped or in bag.');
    });
    mk(cy + 50, 'FLEE (60% clear)', 0x64748b, () => this.tryCombatFlee());
    mk(cy + 95, 'CANCEL', 0x334155, () => {});

    this.specialUi.push(dim, panel, title);
    this.time.delayedCall(80, () => {
      if (this.specialOpen) this.uiBlockClick = false;
    });
  },

  closeCombatSpecials() {
    this.specialOpen = false;
    for (const o of this.specialUi || []) o?.destroy?.();
    this.specialUi = [];
    this.uiBlockClick = true;
    this.time?.delayedCall(80, () => {
      this.uiBlockClick = false;
    });
  },

  tryCombatFlee() {
    if (this.mode !== 'combat') return;
    if (Math.random() < 0.6) {
      this.combatLog('You break contact. Fled.');
      this.log('Fled combat. CLEAR for now.');
      this.endCombat(true);
    } else {
      this.combatLog('Flee fails. They cut you off.');
      this.log('Flee failed.');
      this.afterPlayerCombat();
    }
  },

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
  },

  livingThreats() {
    return this.enemies.filter((e) => {
      if (!e.alive || e._dormant) return false;
      return Math.abs(e.tx - this.player.tx) + Math.abs(e.ty - this.player.ty) <= 12;
    });
  },

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
  },

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
  },

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
  },

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
  },

  resolveHit(att, def, ranged = false) {
    if (!def?.alive) return;
    let atkBonus = 0;
    if (att.isPlayer) {
      atkBonus = this.inv.weapon?.atk || 0;
      // Live bonuses only (not baked into weapon.atk on craft)
      if (this.player.batBonus && (this.inv.weapon?.id === 'pipe' || this.inv.weapon?.id === 'stick')) {
        atkBonus += this.player.batBonus;
      }
      if (this.player.rangedBonus && this.inv.weapon?.ranged) atkBonus += this.player.rangedBonus;
    }
    // Player DEF from armor / hat / legs must count (Actor.def is base only)
    let armorDef = def.def || 0;
    if (def.isPlayer) {
      armorDef = this.inv.totalDef(def.baseDef || 0);
    }
    let raw = att.baseAtk + ((Math.random() * 3) | 0);
    let dmg = Math.max(1, raw + atkBonus - armorDef);
    // Power strike special (player only, one hit)
    if (att.isPlayer && this._powerNext) {
      dmg = Math.max(1, Math.ceil(dmg * 1.5));
      this._powerNext = false;
      this.combatLog('POWER STRIKE!');
    }
    def.hp = Math.max(0, def.hp - dmg);
    def.refreshHp();
    // Flash
    this.tweens.killTweensOf(def.flash);
    def.flash.setAlpha(1);
    this.tweens.add({
      targets: def.flash,
      alpha: 0.25,
      yoyo: true,
      duration: 50,
      repeat: 1,
      onComplete: () => def.flash.setAlpha(1),
    });
    // Floating damage + slash
    this.vfx?.floatText(def.x, def.y - 10, `-${dmg}`, att.isPlayer ? '#7dd3fc' : '#fca5a5', 17);
    this.vfx?.slash(att.x, att.y, def.x, def.y, att.isPlayer ? 0x38bdf8 : 0xef4444);
    if (dmg >= 6) this.vfx?.burst(def.x, def.y, 0xfbbf24, 5);

    const killed = def.hp <= 0;
    if (killed) {
      def.alive = false;
      def.root.setAlpha(0.4);
    }
    this.audio.hit();
    if (def.isPlayer && dmg >= 4) this.vfx?.screenShake(0.005 + dmg * 0.0008, 90);
    else if (killed && att.isPlayer) this.vfx?.screenShake(0.008, 110);
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
      // Only count the guide dog for quest 2 (not random night dogs)
      if (def === this.guideDog || def._isGuideDog) this._guideDogDead = true;
      this.combatLog(`${def.name} is out.`);
      try {
        def.destroy();
      } catch (_) {
        /* already gone */
      }
      this.enemies = this.enemies.filter((e) => e !== def && e.alive);
      if (att.isPlayer) this.runStats.kills = (this.runStats?.kills || 0) + 1;
      if (Math.random() < 0.6) {
        this.inv.addMat('scrap', 1 + ((Math.random() * 2) | 0));
        this.combatLog('Looted scrap.');
      }
      // XP / level
      const xpGain = def.xp || 4;
      if (this.progression && att.isPlayer) {
        const res = this.progression.gain(xpGain, this.player);
        this.combatLog(`+${xpGain} XP`);
        if (res.leveled) {
          this.combatLog(`LEVEL ${this.progression.level}! ${res.notes.join(', ')}`);
          this.log(`Level ${this.progression.level}. ${res.notes.join('. ')}`);
          this.vfx?.burst(this.player.x, this.player.y, 0xfbbf24, 12);
        }
      }
      this.checkGuide();
    }
  },

  checkCombatEnd() {
    if (this.mode !== 'combat') return;
    if (!this.livingThreats().length) this.endCombat(true);
  },

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
  },

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
  },

  endCombat(won) {
    this.mode = 'explore';
    this.combatTurn = 'player';
    this.combatFocus = null;
    this._powerNext = false;
    this.closeCombatSpecials?.();
    this.closeMoreMenu?.();
    this.clearMousePath();
    this.alert.clearCombat();
    if (won) this.heat?.onCombatWon();
    this.combatLog(won ? ' -  fight over  - ' : ' - ');
    this.logText.setText(won ? 'Fight over. CLEAR  -  for now.' : '…');
    if (this.combatHud) this.combatHud.setVisible(false);
    // Hide SPEC, restore explore bar
    this.rebuildActionBar?.();
    this.refreshHud();
  },
};
