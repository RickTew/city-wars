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
- Story / tutorial modals (`GameScene.showPopup` → DOM `.popup-ui` on **modal** layer)
- **In-run HUD** (`#dom-hud`): status, objective, day/heat, toast, bottom action bar
- **Craft panel** (`#dom-craft`): STREET RIG / recipes
- **Bag / loadout** (`EquipUI` → `#dom-modal.bag-ui`)
- **Run menu / MORE / MAP legend / combat specials / end screen**
- **Combat dock** labels + log
- **Minimap “MAP” + compass labels** (DOM)

### DomUi layers (z-order)

| Layer | id | Use |
|-------|-----|-----|
| HUD | `#dom-hud` (15) | Always-on in-run UI |
| Menus | `#dom-ui` (20) | Title + runner select |
| Craft | `#dom-craft` (22) | Docked craft panel |
| Modal | `#dom-modal` (30) | Popups, bag, sheets, end |

## Optional Phaser Text (world floaters only)

| Surface | Where | Notes |
|---------|--------|-------|
| Enemy HP digits | `entities/Actor.js` | World-space; tiny |
| Damage popups | `systems/VFX.js` `floatText` | Ephemeral world floaters |

These are **not** HUD chrome. Do not “fix” them by flipping `pixelArt`.

### Grep gate

Player-facing UI copy must not use `this.add.text`. Remaining `makeUiButton` is a DOM adapter only.

### Acceptance test

Squint on a live screenshot of:

- Title, runner select, SIGNAL BOOT popup
- In-run craft open, objective, day bar, bottom buttons
- Bag/equip, combat, death/win

If any **HUD/menu** line looks pixel-chunky → still Phaser Text → migrate.

## Fonts

- Body/UI: **Inter** (loaded in `index.html`) + system-ui fallback  
- Title wordmark only: Share Tech Mono (display), still via DOM  
- **Never** pixel fonts for UI  

## Related locked tone

- No orphan neon props / joke signs on skyline  
- City already fell; ambience is samples + sparse gaps (see `AGENTS.md` audio)  
