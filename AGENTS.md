# City Wars — Grok project (handoff)

**Primary agent:** Grok. Path: `~/Dev/City Wars`  
**Stack:** Phaser **4.2+ only** (never Phaser 3), Vite 6, pure client, procedural tiles.

## Run

```bash
cd ~/Dev/City\ Wars
npm install
npm run dev
# http://localhost:5173/
```

Flow: **Day length** → **Choose Runner** → **ENTER THE GRID**.

## What the game is now (not the old district prototype)

Real-time explore city escape with:

| System | Behavior |
|--------|----------|
| **Movement** | Click map (path). WALK / RUN / SNEAK. Left-click enemies to fight |
| **Alert** | CLEAR / CAUTION (HIDE) / COMBAT (left-click enemy) |
| **Day-night** | Bar fills day, drains night. SHORT 8m / MED 15m / LONG 25m cycles |
| **Sleep** | Free at HQ. Away needs Sleeping Kit. Night away = ambush risk |
| **Craft** | Blueprints (pink) → Street Rig (purple) → CRAFT. Track hunt list optional (default off) |
| **Guide** | Hard hand-hold through Bandage → Bedroll → Pipe, then “on your own” |
| **Characters** | 9 runners (stats + distinct sprites). Narrator optional after tutorial |
| **UI** | Full window. Combat log left. Hunt list right. HQ arrow bottom-left. Buttons bottom |

## Characters (ids)

`neon_val`, `pretty_boy`, `shade`, `brick`, `doc_rue`, `static`, `boom`, `forge`, `needle`

## Key files

```
src/main.js                 # scenes: Boot, Menu, CharacterSelect, Game
src/config/constants.js     # map, tiles, items, blueprints, day lengths
src/config/characters.js    # 9 runners
src/systems/GuideDirector.js  # step-by-step first three crafts
src/systems/StoryDirector.js  # story/narrator cards
src/systems/DayNight.js     # bar fill day / drain night
src/systems/AlertSystem.js
src/systems/Inventory.js
src/systems/CityGenerator.js
src/entities/Actor.js       # player looks + dog + combat actors
src/scenes/GameScene.js     # main (~2.5k lines) — most gameplay
src/scenes/MenuScene.js
src/scenes/CharacterSelectScene.js
```

## Conventions

- Phaser 4 latest. No Phaser 3.
- Prefer mouse-first UI.
- Player-facing copy: **no em dashes** (use periods or hyphens).
- Popups pause world time (`isPaused`).
- Clear click-paths when opening/closing popups (no auto-run after GOT IT).

## Known next polish (if continuing)

- Right-click combat specials (stubbed in design only)
- Split GameScene into smaller modules
- Persist narrator toggle in-run (BAG)
- Push remote git if not yet on GitHub

## Session note

Long Grok chats hit ~500K context. **Code lives in this folder**; update this file + git commit before starting a new chat. Reload with: “Continue City Wars in ~/Dev/City Wars per AGENTS.md”.
