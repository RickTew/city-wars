/**
 * Shared visual palette — Escape-from-NY grit + neon bleed.
 *
 * Fonts: for player-facing UI use DomUi (DOM + Inter/system-ui). Phaser Text
 * under pixelArt:true looks chunky; see VISUAL-STYLE.md + TEXT-STRATEGY.md.
 * In-run HUD/craft/bag/combat are on DomUi; these font constants remain for
 * any residual Phaser world floaters / lab labels only.
 */
export const HUD_FONT = 'Inter, system-ui, -apple-system, sans-serif';
export const UI_FONT = 'Inter, system-ui, -apple-system, sans-serif';
export const TITLE_FONT = '"Share Tech Mono", ui-monospace, monospace';

export const NEON = {
  cyan: 0x22d3ee,
  pink: 0xf472b6,
  gold: 0xfbbf24,
  red: 0xef4444,
  purple: 0xa855f7,
  green: 0x4ade80,
};

export const ZONE_TINT = {
  safe: { c: 0x000000, a: 0 },
  mid: { c: 0x0ea5e9, a: 0.045 },
  outer: { c: 0xf97316, a: 0.065 },
  wall: { c: 0xef4444, a: 0.085 },
};
