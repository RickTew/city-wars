# City Wars

Phaser 4 turn-based top-down city escape game (Escape from New York / early Rockstar grid vibe).

> **Grok is primary** for this repo. Canonical rules live in **`AGENTS.md`** and **`.grok/rules/`**. Keep this file aligned when conventions change.

## Always use latest packages

- **Phaser**: always latest stable major line (`npm install phaser@latest`). Currently **Phaser 4** — never Phaser 3.
- **Vite** and other tooling: keep current.
- Prefer Phaser 4 APIs: `TilemapLayer` / `TilemapGPULayer` (not legacy patterns), camera filters, etc.

## Run

```bash
npm install
npm run dev
```

## Spec (from design)

- **Tiles**: 32×32 px
- **Map**: 256×256 tiles (world ~8192×8192 px)
- **Zones**: concentric rings by **Manhattan distance** from city center
  1. Safe (center) — low danger, home base
  2. Mid-city — medium danger
  3. Outer chaos — high danger
  4. Perimeter escape — max danger + escape points
- **Blocks**: 8×8 grid of 32×32-tile flavor blocks
- **Gameplay**: turn-based grid movement, adjacent-tile combat, camera follow with soft limits
- **Systems**: `ZoneManager` drives enemy difficulty + spawn weight by zone

## Stack

- Phaser 4 (latest)
- Vite
- Procedural tileset (no external art required)
- No backend

## Layout

```
src/
  main.js
  config/constants.js
  systems/ZoneManager.js
  systems/CityGenerator.js
  systems/TurnController.js
  entities/Actor.js
  scenes/BootScene.js
  scenes/MenuScene.js
  scenes/GameScene.js
```

## Controls

- Arrow keys / WASD: move one tile (or attack if enemy adjacent in that direction)
- Click/tap adjacent tile: move or attack
- Space: wait / end turn
