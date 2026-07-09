export class TurnController {
  constructor({ onLog, onTurnEnd }) {
    this.phase = 'player';
    this.turn = 1;
    this.onLog = onLog || (() => {});
    this.onTurnEnd = onTurnEnd || (() => {});
  }

  get canPlayerAct() {
    return this.phase === 'player';
  }

  lock() {
    this.phase = 'busy';
  }

  unlockPlayer() {
    if (this.phase !== 'gameover') this.phase = 'player';
  }

  beginEnemy() {
    this.phase = 'enemy';
  }

  nextTurn() {
    this.turn += 1;
    this.phase = 'player';
    this.onTurnEnd(this.turn);
  }

  gameOver() {
    this.phase = 'gameover';
  }
}
