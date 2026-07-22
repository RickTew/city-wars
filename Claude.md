# City Wars

Phaser 4 turn-based top-down city escape game (Escape from New York / early Rockstar grid vibe).

> **Grok is primary** for this repo. Canonical rules live in **`AGENTS.md`**, **`TEXT-STRATEGY.md`**, **`VISUAL-STYLE.md`**, and **`.grok/MEMORY.md`**. Keep this file aligned when conventions change.

## Text (LOCKED — user repeated)

**Entire game** needs crisp DOM text (`DomUi.js`). Phaser Text under `pixelArt: true` looks chunky. Menus/popups migrated; **HUD/craft/buttons still Phaser — next session priority.** Do not flip pixelArt off to “fix” type.

## Always use latest packages

- **Phaser**: always latest stable major line (`npm install phaser@latest`). Currently **Phaser 4** — never Phaser 3.
- **Vite** and other tooling: keep current.
- Prefer Phaser 4 APIs: `TilemapLayer` / `TilemapGPULayer` (not legacy patterns), camera filters, etc.

## Run

```bash
npm install
npm run dev
```

## Spec (live)

- **Tiles**: 32×32 px
- **Map**: 96×96 tiles (see `MAP_W` / `MAP_H` in constants)
- **Streets**: 2 tiles wide (avenues every 6 tiles)
- **Zones**: concentric rings by Manhattan distance from HQ center
- **Gameplay**: real-time explore (click path), turn combat, day/night, craft Breach Kit, escape
- **Canonical rules**: `AGENTS.md` (Grok is primary)

## Stack

- Phaser 4 (latest)
- Vite
- Procedural tileset (no external art required)
- No backend

## Controls

- Click map to path-walk; left-click enemies to fight
- Bottom bar (desktop): USE / SLEEP / HIDE / SNEAK / CRAFT / WALK|RUN / HEAL / MENU / BAG / MAP
- Bottom bar (phone): two rows — SNEAK/WALK/HEAL/MAP/MENU then USE/SLEEP/HIDE/CRAFT/BAG
- WASD / arrows still step one tile
- Camera: **no auto-follow**. Edge-pan + middle-mouse drag (desktop); touch drag + pinch zoom (phone)
