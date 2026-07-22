# City Wars — Text strategy (LOCKED)

> **User mandate (repeated, do not re-litigate):**  
> The **entire game** must have **nice-looking text** — crisp, clean, modern, readable.  
> Not chunky 1980 bitmap. Not fuzzy. **Everywhere** (menu, select, HUD, craft, bag, combat, end screen).

## Why Phaser Text looks bad here

`main.js` uses **`pixelArt: true`** so tiles/sprites stay nearest-neighbor.

That same setting forces **nearest-neighbor sampling on Phaser `Text` textures**.  
Result: system fonts and Inter both look like staircase / SNES UI.

Tried and **rejected**:

| Attempt | Result |
|---------|--------|
| Global `pixelArt: false` + antialias | Fuzzy overall / wrong for pixel props later |
| `setFilter(LINEAR)` on Phaser Text | Still stair-steps under pixelArt (same lesson as DungeonHole) |
| `setResolution(dpr)` + mono everywhere | Still mushy / not “nice” |

**Proven fix (DungeonHole / AstroHold / this repo menus):**  
**DOM overlays** with Inter/system-ui + browser anti-aliasing (`DomUi.js`).

## Split-brain (visual system)

| Layer | How |
|-------|-----|
| Map tiles, future pixel characters/crates | Phaser + `pixelArt: true` nearest |
| Floors/skyline/panels geometry | Procedural Graphics / CSS |
| **All readable text + buttons labels** | **DOM** (`src/systems/DomUi.js` + CSS in `index.html`) |

Reference: `VISUAL-STYLE.md`, DungeonHole `VISUAL-STYLE.md`, AstroHold `docs/VISUAL_STYLE.md`.

## Already migrated (crisp)

- Title menu (`MenuScene` + CSS `.menu-ui`)
- Character select (`CharacterSelectScene` + avatar chips)
- Story / tutorial modals (`GameScene.showPopup` → DOM `.popup-ui`)

## Still Phaser Text — MUST migrate next session (priority order)

These are what the user still sees as “bad text” (e.g. craft panel **STREET RIG**, objective strip, day bar, action buttons).

| Surface | Where in code | Notes |
|---------|----------------|-------|
| **Craft panel “STREET RIG” + recipes** | `systems/CraftPanel.js` | User screenshot 2026-07-22 |
| **Objective banner** (“Gold crate EAST…”) | `GameScene` guide/objective UI | Top of play view |
| **Day / heat / status strip** | `GameScene` HUD create (~1050+) | “Day 1 · DAY”, GRID HEAT |
| **Bottom action bar** (USE/SLEEP/…) | `makeUiButton` in `GameScene` | High traffic |
| **Run menu / legend / MORE** | `GameScene` | |
| **Equip / bag UI** | `systems/EquipUI.js` | Many labels |
| **Combat log / bars** | `GameScene` + `combatMixin.js` | |
| **Minimap labels** | `systems/Minimap.js` | |
| **Floating actor names** | `entities/Actor.js` | Optional; can stay small or DOM floaters |
| **Win/lose / end screen** | `GameScene` end UI | |

### Next-session implementation plan (do not half-fix)

1. Extend `DomUi` with layered HUD roots if needed (`#dom-hud`, `#dom-modal`) so menus/popups/HUD don’t clobber each other.
2. Migrate **CraftPanel** first (user-visible pain).
3. Migrate **objective + top status** second.
4. Migrate **makeUiButton** to DOM buttons (or hybrid: Phaser hit rect + DOM label — prefer full DOM hit targets).
5. EquipUI + combat + end screens.
6. Grep gate: **zero** `this.add.text` / `makeUiButton` Phaser labels for player-facing copy when done (debug-only exceptions allowed if marked).

### Acceptance test

Squint on a live screenshot of:

- Title, runner select, SIGNAL BOOT popup (**already pass**)
- In-run craft open, objective, day bar, bottom buttons (**must pass**)
- Bag/equip, combat, death/win

If any line looks pixel-chunky → it is still Phaser Text → migrate.

## Fonts

- Body/UI: **Inter** (loaded in `index.html`) + system-ui fallback  
- Title wordmark only: Share Tech Mono (display), still via DOM  
- **Never** pixel fonts for UI  

## Related locked tone

- No orphan neon props / joke signs on skyline  
- City already fell; ambience is samples + sparse gaps (see `AGENTS.md` audio)  
