/**
 * DOM UI layer — browser-native anti-aliased text.
 *
 * Studio rule (DungeonHole / AstroHold / VISUAL-STYLE.md):
 * Phaser pixelArt:true nearest-neighbor-samples Text textures → chunky or mushy
 * glyphs. All player-facing labels go through this layer instead.
 *
 * Layers (z-order):
 *   #dom-hud   (15) — in-run status, action bar, toast
 *   #dom-ui    (20) — title / character select
 *   #dom-craft (22) — docked craft panel
 *   #dom-modal (30) — popups, bag, run menu, legend, end screen
 */

const LAYERS = {
  hud: { id: 'dom-hud', z: 15 },
  ui: { id: 'dom-ui', z: 20 },
  craft: { id: 'dom-craft', z: 22 },
  modal: { id: 'dom-modal', z: 30 },
};

function ensureParentRelative() {
  const parent = document.getElementById('game-container');
  if (!parent) return null;
  if (getComputedStyle(parent).position === 'static') {
    parent.style.position = 'relative';
  }
  return parent;
}

function ensureLayer(name) {
  const def = LAYERS[name] || LAYERS.ui;
  const parent = ensureParentRelative();
  if (!parent) return null;
  let el = document.getElementById(def.id);
  if (!el) {
    el = document.createElement('div');
    el.id = def.id;
    el.style.zIndex = String(def.z);
    parent.appendChild(el);
  }
  return el;
}

function clearLayer(name) {
  const def = LAYERS[name] || LAYERS.ui;
  const el = document.getElementById(def.id);
  if (!el) return;
  el.innerHTML = '';
  el.className = '';
  el.style.display = 'none';
  el.style.pointerEvents = '';
}

/** Phaser 0xRRGGBB → #rrggbb */
export function hexCss(n) {
  if (typeof n === 'string') return n.startsWith('#') ? n : `#${n}`;
  return `#${(n >>> 0).toString(16).padStart(6, '0')}`;
}

/**
 * Adapter so existing code can do btn.label.setText / btn.bg.setFillStyle.
 */
export function btnAdapter(btnEl) {
  const api = {
    el: btnEl,
    label: {
      get text() {
        return btnEl.textContent || '';
      },
      setText(t) {
        btnEl.textContent = t;
      },
      setFontSize(size) {
        if (size != null) btnEl.style.fontSize = typeof size === 'number' ? `${size}px` : size;
      },
      destroy() {
        /* label lives on button */
      },
    },
    bg: {
      setFillStyle(hex, alpha) {
        btnEl.style.background = hexCss(hex);
        if (alpha != null) btnEl.style.opacity = String(alpha);
      },
      setAlpha(a) {
        btnEl.style.opacity = String(a);
      },
      destroy() {
        btnEl.remove();
      },
    },
    destroy() {
      btnEl.remove();
    },
  };
  return api;
}

export const DomUi = {
  layer(name = 'ui') {
    return ensureLayer(name);
  },

  /** Title / character select root (legacy). */
  root() {
    return ensureLayer('ui');
  },

  hud() {
    return ensureLayer('hud');
  },

  craft() {
    return ensureLayer('craft');
  },

  modal() {
    return ensureLayer('modal');
  },

  clear(name = 'ui') {
    clearLayer(name);
  },

  clearHud() {
    clearLayer('hud');
  },

  clearCraft() {
    clearLayer('craft');
  },

  clearModal() {
    clearLayer('modal');
  },

  clearAll() {
    for (const name of Object.keys(LAYERS)) clearLayer(name);
  },

  /**
   * Show a layer with optional className. name: 'ui' | 'hud' | 'craft' | 'modal'
   */
  show(className = '', name = 'ui') {
    const el = ensureLayer(name);
    if (!el) return null;
    el.className = className || '';
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
    // Also block pointerdown so map path doesn't start under the button
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
    return btn;
  },

  hexCss,

  btnAdapter,

  /**
   * Absolute-positioned HUD button (center x/y in CSS pixels).
   * Returns { bg, label, el, destroy } adapter.
   */
  absButton(parent, x, y, w, h, label, color, onClick, extraClass = '') {
    const btn = this.button(`hit hud-btn ${extraClass}`.trim(), label, onClick);
    btn.style.position = 'absolute';
    btn.style.left = `${Math.round(x - w / 2)}px`;
    btn.style.top = `${Math.round(y - h / 2)}px`;
    btn.style.width = `${Math.round(w)}px`;
    btn.style.height = `${Math.round(h)}px`;
    btn.style.background = hexCss(color);
    parent.appendChild(btn);
    return btnAdapter(btn);
  },
};
