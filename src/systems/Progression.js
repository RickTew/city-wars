/**
 * XP / level. Levels grant max HP and occasional ATK.
 * xp from ENEMY definitions; applied on kill.
 */
export class Progression {
  constructor() {
    this.xp = 0;
    this.level = 1;
  }

  xpToNext() {
    return 10 + this.level * 8;
  }

  /**
   * @returns {{ leveled: boolean, levelsGained: number, notes: string[] }}
   */
  gain(amount, player) {
    if (!amount || amount <= 0) return { leveled: false, levelsGained: 0, notes: [] };
    this.xp += amount;
    let levelsGained = 0;
    const notes = [];
    while (this.xp >= this.xpToNext()) {
      this.xp -= this.xpToNext();
      this.level += 1;
      levelsGained += 1;
      // +4 max HP, heal 4, +1 base ATK every odd level after 1
      if (player) {
        player.maxHp += 4;
        const healed = player.heal(4);
        notes.push(`+4 max HP (healed ${healed})`);
        if (this.level % 2 === 1) {
          player.baseAtk += 1;
          notes.push('+1 ATK');
        }
      }
    }
    return { leveled: levelsGained > 0, levelsGained, notes };
  }

  summary() {
    return `Lv ${this.level}  XP ${this.xp}/${this.xpToNext()}`;
  }

  serialize() {
    return { xp: this.xp, level: this.level };
  }

  load(data) {
    if (!data) return;
    this.xp = data.xp | 0;
    this.level = Math.max(1, data.level | 0);
  }
}
