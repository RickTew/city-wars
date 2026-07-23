/**
 * Shared visual palette — Escape-from-NY grit + neon bleed.
 *
 * Fonts: for player-facing UI use DomUi (DOM + Inter/system-ui). Phaser Text
 * under pixelArt:true looks chunky; see VISUAL-STYLE.md + TEXT-STRATEGY.md.
 * In-run HUD/craft/bag/combat are on DomUi; these font constants remain for
 * any residual Phaser world floaters / lab labels only.
 */
import { ZONE, ZONE_META } from './constants.js';

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

/** Soft screen veil per city ring (from ZONE_META). */
export const ZONE_TINT = Object.fromEntries(
  Object.values(ZONE).map((id) => [id, ZONE_META[id].tint])
);
// Legacy keys still referenced in old saves / story once-keys
ZONE_TINT.safe = ZONE_TINT[ZONE.HOME];
ZONE_TINT.mid = ZONE_TINT[ZONE.YELLOW];
ZONE_TINT.outer = ZONE_TINT[ZONE.GREEN];
ZONE_TINT.wall = ZONE_TINT[ZONE.RED];
