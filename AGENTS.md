# City Wars — Grok project (handoff)

**Primary agent:** Grok. Path: `~/Dev/City Wars`  
**Stack:** Phaser **4.2+ only** (never Phaser 3), Vite 6, pure client, procedural tiles.  
**Git:** local only for now. User will push to GitHub when ready for Vercel remote play. Do not push unless asked.

## Run

```bash
cd ~/Dev/City\ Wars
npm install
npm run dev
# http://localhost:5173/
```

Flow: **Day length** → **Choose Runner** → **ENTER THE GRID**.

## What the game is now

Real-time explore city escape with:

| System | Behavior |
|--------|----------|
| **Movement** | Click map (path). WALK / RUN / SNEAK. Left-click enemies to fight |
| **Alert** | CLEAR / CAUTION (HIDE) / COMBAT (left-click enemy) |
| **Day-night** | Bar fills day, drains night. SHORT 8m / MED 15m / LONG 25m cycles |
| **Sleep** | Free at HQ. Away needs Sleeping Kit. Night away = ambush risk |
| **Craft** | Blueprints (pink) → Street Rig (purple) → CRAFT. Bandage recipe free for tutorial |
| **BAG / Equip** | Paper-doll: HEAD, BODY/armor, LEGS, WEAPON, QUICK1/2. Click or drag items |
| **Guide** | 3 quests hand-hold: gear+equip+bandage → kill dog → sleep HQ. Micro-coach cards between steps |
| **Characters** | 9 runners. Narrator optional after tutorial |
| **UI** | Full window. Combat log left. HQ arrow bottom-left. Buttons bottom. Popups pause time |

## Tutorial path (first three quests)

1. **Gear up (east of spawn)**  
   - Gold crate → cloth×2 guaranteed first loot  
   - Walk-on **Street Stick** + **Neon Fedora** (magenta gear tiles)  
   - Open **BAG** → equip stick WEAPON + hat HEAD  
   - Craft **Field Bandage** at purple rig  
2. **First blood** — Grid Dog spawns nearby; left-click fight  
3. **Lights out** — SLEEP at HQ (free)  
Then free play: Breach Kit blueprint north Wall.

## Characters (ids)

`neon_val`, `pretty_boy`, `shade`, `brick`, `doc_rue`, `static`, `boom`, `forge`, `needle`

## Key files

```
src/main.js
src/config/constants.js       # T.GEAR_DROP, SLOT, GEAR (stick, sexy_hat, …)
src/config/characters.js
src/systems/GuideDirector.js  # 3 quests + micro-coach
src/systems/EquipUI.js        # BAG paper-doll drag/click
src/systems/Inventory.js      # equip slots, totalAtk/totalDef
src/systems/CityGenerator.js  # gearDrops east of HQ
src/systems/StoryDirector.js
src/systems/DayNight.js
src/entities/Actor.js
src/scenes/GameScene.js       # main gameplay wiring
src/scenes/BootScene.js       # GEAR_DROP tile art
src/scenes/MenuScene.js
src/scenes/CharacterSelectScene.js
```

## Conventions

- Phaser 4 latest. No Phaser 3.
- Prefer mouse-first UI.
- Player-facing copy: **no em dashes** (use periods or hyphens).
- Popups pause world time (`isPaused` includes `bagOpen`).
- Clear click-paths when opening/closing popups (no auto-run after GOT IT).
- Do not push GitHub / deploy Vercel unless user asks.

## Known next polish

- Right-click combat specials
- Split GameScene into smaller modules
- Pixel art via PixelLab later
- Push remote when ready for Vercel

## Session note

Long chats hit context limits. **Code lives in this folder**; update this file + git commit before a new chat. Reload with: “Continue City Wars in ~/Dev/City Wars per AGENTS.md”.
