/**
 * DOM UI layer — browser-native anti-aliased text.
 *
 * Studio rule (DungeonHole / AstroHold / VISUAL-STYLE.md):
 * Phaser pixelArt:true nearest-neighbor-samples Text textures → chunky or mushy
 * glyphs. All player-facing labels go through this layer instead.
 */

const ROOT_ID = 'dom-ui';

function ensureParentRelative() {
  const parent = document.getElementById('game-container');
  if (!parent) return null;
  if (getComputedStyle(parent).position === 'static') {
    parent.style.position = 'relative';
  }
  return parent;
}

export const DomUi = {
  /** Root overlay (pointer-events none; children opt-in). */
  root() {
    const parent = ensureParentRelative();
    if (!parent) return null;
    let el = document.getElementById(ROOT_ID);
    if (!el) {
      el = document.createElement('div');
      el.id = ROOT_ID;
      parent.appendChild(el);
    }
    return el;
  },

  clear() {
    const el = document.getElementById(ROOT_ID);
    if (!el) return;
    el.innerHTML = '';
    el.className = '';
    el.style.display = 'none';
  },

  show(className = '') {
    const el = this.root();
    if (!el) return null;
    el.className = className;
    // Clear inline display so CSS classes (flex layouts) win — never force block
    el.style.display = '';
    return el;
  },

  el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  },

  /** Button with click; stops canvas from also receiving the event. */
  button(className, text, onClick) {
    const btn = this.el('button', className, text);
    btn.type = 'button';
    btn.addEventListener('pointerup', (e) => {
      e.preventDefault();
      e.stopPropagation();
      onClick?.(e);
    });
    return btn;
  },
};
