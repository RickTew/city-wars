import { BLOCKING, T } from '../config/constants.js';

/** +1 DEF when hugging cover (barricade / building wall). */
export function coverBonus(scene, tx, ty) {
  const dirs = [
    [0, -1],
    [0, 1],
    [-1, 0],
    [1, 0],
  ];
  for (const [dx, dy] of dirs) {
    const x = tx + dx;
    const y = ty + dy;
    if (x < 0 || y < 0 || x >= scene.walls[0].length || y >= scene.walls.length) continue;
    const w = scene.walls[y][x];
    const g = scene.ground[y][x];
    if ((w && BLOCKING.has(w)) || g === T.BARRICADE || g === T.BUILDING) return 1;
  }
  return 0;
}

/** Enemy ability hooks — keep combat logic readable in the mixin. */
export function enemyAttackMultiplier(att, round) {
  if (att.kind === 'enforcer' && round > 0 && round % 3 === 0) {
    return { mult: 1.55, tag: 'CRUSH' };
  }
  if (att.kind === 'dog') {
    const pack = att.scene.enemies.filter(
      (e) => e.alive && e.kind === 'dog' && Math.abs(e.tx - att.tx) + Math.abs(e.ty - att.ty) <= 2
    ).length;
    if (pack >= 2) return { mult: 1.2, tag: 'PACK' };
  }
  return { mult: 1, tag: null };
}

export function onEnemyHitPlayer(att, scene) {
  const effects = [];
  if (att.kind === 'drone' && Math.random() < 0.45) {
    scene._marked = 2;
    effects.push('MARKED');
  }
  if (att.kind === 'thug' && Math.random() < 0.22) {
    scene._bleed = Math.max(scene._bleed || 0, 2);
    effects.push('BLEED');
  }
  return effects;
}

export function tickPlayerStatuses(scene) {
  const notes = [];
  if (scene._bleed > 0) {
    const cut = Math.min(scene._bleed, 2);
    scene.player.hp = Math.max(0, scene.player.hp - cut);
    scene.player.refreshHp();
    scene._bleed -= cut;
    notes.push(`Bleed -${cut}`);
    if (scene.player.hp <= 0) scene.lose();
  }
  if (scene._suppressed > 0) scene._suppressed -= 1;
  return notes;
}

export function markedBonus(scene) {
  if (scene._marked > 0) {
    scene._marked -= 1;
    return 2;
  }
  return 0;
}
