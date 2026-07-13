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

## Spec (live)

- **Tiles**: 32×32 px
- **Map**: 96×96 tiles (see `MAP_W` / `MAP_H` in constants)
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
- Bottom bar: USE / SLEEP / HIDE / SNEAK / CRAFT / WALK|RUN / HEAL / MENU / BAG / MAP
- WASD / arrows still step one tile; camera edge-pan + middle-mouse drag
