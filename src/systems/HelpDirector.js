/**
 * Explains Who / What / When / Where / Why / How until player turns Help off.
 */
export class HelpDirector {
  constructor(enabled = true) {
    this.enabled = enabled;
    this.seen = new Set();
    this.line = '';
    this.queue = [];
  }

  toggle() {
    this.enabled = !this.enabled;
    return this.enabled;
  }

  /** Fire once per key */
  once(key, text) {
    if (!this.enabled) return;
    if (this.seen.has(key)) return;
    this.seen.add(key);
    this.push(text);
  }

  push(text) {
    if (!this.enabled) return;
    this.queue.push(text);
    if (!this.line) this.line = this.queue.shift();
  }

  /** Core 5W1H intro */
  intro() {
    if (!this.enabled) return;
    this.push(
      'WHO: You’re the Runner. Last courier dumb enough to try the Wall.'
    );
    this.push(
      'WHAT: Scavenge junk. Find blueprints. Craft a Breach Kit. Escape.'
    );
    this.push(
      'WHEN: Day is safer. Night brings dogs & gangs. Sleep before you’re meat.'
    );
    this.push(
      'WHERE: HOME → Yellow → Orange → Green → Blue → Red (Wall). Gold pulse = goal.'
    );
    this.push(
      'WHY: Stay and the city eats you. One clean breach and you’re a ghost story.'
    );
    this.push(
      'HOW: Click map to move · click loot/bed/bench to use · click enemy to fight · bottom buttons for HIDE / CRAFT / HELP'
    );
  }

  tick(dt) {
    // auto-advance long tips slowly? keep manual — show current line
  }

  next() {
    if (this.queue.length) this.line = this.queue.shift();
  }

  set(text) {
    if (!this.enabled) return;
    this.line = text;
  }
}
