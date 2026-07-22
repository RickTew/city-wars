# City Wars — Visual Style (studio contract)

Same split-brain rule as **DungeonHole** / **AstroHold**.  
Canonical text rule: **`TEXT-STRATEGY.md`** (read that first for HUD work).

## Direction: Modern-Procedural + Pixel Hybrid

Procedural geometry for the board and chrome. Pixel-art only for
**authored sprites** (characters, crates, props) when we add them.
We are **not** faking SNES-era UI text.

## Split-brain rule

| Layer | How |
|-------|-----|
| Floors, skyline, roads, panels, VFX shapes | Procedural (Phaser Graphics / CSS) |
| Characters, crates, pickups with personality | Pixel sprites, nearest-neighbor |
| **All readable text (menus, HUD, craft, combat, logs)** | **DOM** — Inter/system fonts, browser AA |

### Why text is DOM (LOCKED)

Phaser `pixelArt: true` nearest-neighbor-samples **every** texture, including
`Text`. That produces chunky “1980” glyphs. Global antialias makes things fuzzy.

DungeonHole: even `setFilter(LINEAR)` on Phaser Text fails under pixelArt.  
Fix: DOM overlays. City Wars menus + story popups already do this.

**User requirement:** nice text in the **entire** game, not only menus.  
In-run HUD/craft still Phaser as of 2026-07-22 — **next session priority** (see `TEXT-STRATEGY.md`).

**Never** ship player-facing copy via `this.add.text` under pixelArt.

Use `src/systems/DomUi.js`.

## Engine defaults

```js
// main.js
pixelArt: true,   // for tiles + future pixel sprites
// Do NOT set global antialias:true to “fix” text — use DOM instead.
```

- Tile atlas: `FilterMode.NEAREST` in `TileArt.generate`.
- Canvas: RESIZE 1:1; `image-rendering: pixelated` OK for canvas; **UI lives in DOM above it**.

## Typography

- NEVER pixelated fonts for UI.
- Body / buttons / help: Inter / system-ui.
- Optional display mono for title wordmark only — still **DOM**.
- Size with `clamp()` so big desktops stay readable.

## Menus

- Procedural / CSS panels (rounded, crisp 1px borders).
- DOM buttons and labels.
- Phaser only draws atmosphere backdrop (skyline, fire, embers).

## No orphan props (LOCKED)

Every decorative mark must **read as something in the world** or it is a bug.

| Fail | Why |
|------|-----|
| Random pink/yellow bars on façades | Leftover sign plates with no sign |
| “OPEN” on a skyscraper | Comedy that doesn’t land |

If you remove the text, **remove the plate too**.

Atmosphere = skyline mass, windows, fire, smoke, haze — not random HUD stickers.

## Squint pass before ship

1. Any shape that isn’t building / window / fire / smoke / real UI? → delete.  
2. Any text that looks chunky? → still Phaser → migrate to DOM.  
3. Would the player ask “what is that?” for a leftover doodle? → kill it.  
