# City Wars — Grok project (handoff)

**Primary agent:** Grok  
**Path:** `~/Dev/City Wars` (absolute: `/Users/ricktew/Dev/City Wars`)  
**Stack:** Phaser **4.2+ only** (never Phaser 3), Vite 6, pure client, procedural tiles  
**Git:** local `main` only. **Do not push / Vercel deploy unless user asks.** Remote play = push when ready.

**Version:** 3.5.0 (scan polish wave)  
**Last session HEAD:** `78a8315` (2026-07-13)  
**Working tree:** clean after commit.

---

## Resume next session with

```
Continue City Wars in ~/Dev/City Wars per AGENTS.md
```

```bash
cd ~/Dev/City\ Wars
npm install   # if needed
npm run dev   # http://localhost:5173/
# hard refresh: Cmd+Shift+R
npm run playtest   # automated smoke (needs Chrome + dev server up)
```

Flow: **Day length** → **Choose Runner** (bonuses on cards) → **ENTER THE GRID**.

---

## What the game is

Top-down **Escape-from-NY grit** city escape: scavenge, craft **Breach Kit**, leave via edge gold pads.

| System | Behavior |
|--------|----------|
| **Movement** | Click path. WALK / RUN / SNEAK. Left-click enemies to fight |
| **Camera** | Follow player + **mouse edge-pan** (~32px margin) + **middle-mouse drag pan**. Re-locks on walk or ~1.6s idle |
| **Alert** | CLEAR / CAUTION (HIDE) / COMBAT |
| **Day-night** | Bar fills day, drains night. SHORT 8m / MED 15m / LONG 25m |
| **Sleep** | Free at HQ. Away needs Sleeping Kit. Night away = ambush risk |
| **Craft** | Pink blueprints → purple Street Rig → CRAFT. Bandage free in tutorial. **craftBonus** may refund 1 mat |
| **BAG** | Paper-doll: HEAD, BODY/armor, LEGS, WEAPON, QUICK1/2. Click or drag. Pauses time |
| **HEAL** | Bandage → Stim → MRE Paste. Else **Street Charge** (Boom) blasts foes within 2 tiles |
| **MENU** | Mute sound, narrator toggle, NEW RUN, help blurb |
| **Guide** | 3 quests as **one-step** cards + yellow **pulse** on target / UI button |
| **Characters** | 9 runners. Select cards show ATK/HP/SNEAK/CRAFT/BOOM etc. |
| **UI** | Full window. Combat log left. HQ arrow bottom-left. Bottom action bar. Popups pause |

### Tutorial path (must stay a hike, not a pile at feet)

| Step | What | Where |
|------|------|--------|
| 1a | Click **pulsing** gold crate | East ~12 tiles on road (`loot.guide`) |
| 1b | Walk onto **Street Stick** (brown bat tile) | South ~12 (`GEAR_STICK`) |
| 1c | Walk onto **Neon Fedora** (purple hat tile) | West ~12 (`GEAR_HAT`) |
| 1d | **BAG** → equip stick WEAPON + hat HEAD | UI pulse on BAG |
| 1e | **CRAFT** Field Bandage at HQ purple rig | cloth×2 guaranteed from guide crate |
| 2 | Left-click **Grid Dog** | Spawns short hike away (`_isGuideDog` survives dawn) |
| 3 | **SLEEP** at HQ | Free rest |
| Free | Breach Kit blueprint | Pink near north Wall |

### Characters (ids)

`neon_val`, `pretty_boy`, `shade`, `brick`, `doc_rue`, `static`, `boom`, `forge`, `needle`

---

## Key files

```
src/main.js                      Boot → Menu → CharacterSelect → Game  (v3.5.0)
src/config/constants.js          TILE, T (GEAR_STICK/HAT), SLOT, GEAR, BLUEPRINTS
src/config/characters.js         9 runners + bonuses
src/systems/GuideDirector.js     One-step QUESTS + COACH; resolveTarget() for pulse
src/systems/EquipUI.js           BAG loadout UI
src/systems/Inventory.js         craft({craftBonus}), takeConsumable, equip
src/systems/CityGenerator.js     HQ + hike gear tiles + world BPs (incl rags/jacket/charge)
src/systems/StoryDirector.js     Intro matches guide path; ambient throttled
src/systems/VFX.js               floatText / slash / burst (combat + charge)
src/scenes/GameScene.js          ~3.1k lines — gameplay (still a god scene)
src/scenes/CharacterSelectScene.js  Bonuses on cards
src/scenes/BootScene.js          Stick + hat distinct tiles
scripts/playtest.mjs             Tutorial + DEF + heal + batBonus + craft + MRE
AGENTS.md                        This handoff
```

---

## Conventions (do not regress)

- **Phaser 4 only.** Never Phaser 3.
- **Mouse-first** UI.
- Player-facing copy: **no em/en dashes** (periods or hyphens).
- Popups / craft / legend / **bag** / **menu** pause world (`isPaused`).
- Clear mouse paths on open/close popups, bag, craft, legend, menu.
- Guide targets are **hikes** (~12 tiles on roads), not clustered at spawn.
- Pulse current guide target; UI steps pulse BAG / CRAFT / SLEEP buttons.
- **Guide dog** must set `_isGuideDog` and must **not** be culled at dawn with night dogs.
- Combat damage must use `inv.totalDef` for the player (armor counts).
- **batBonus / rangedBonus are LIVE only** — never bake into `gear.atk` on craft.
- HEAL: bag **or** QUICK; bandage → stim → mre; then Street Charge.
- Local git only until user says push for Vercel.
- Playtest API: `window.__CITY_WARS__` with `debugState()`, `debugWarp()`, `dismissPopup()`, `playerEffectiveAtk()`.

---

## Shipped this session (scan polish 3.5)

| # | Change |
|---|--------|
| 1 | batBonus no longer double-counted (no craft bake) |
| 2 | Story intro matches GuideDirector tutorial |
| 3 | Dead MORE menu removed; MENU mid-run (mute / narrator / restart) |
| 4 | Distinct stick / hat world tiles + legend |
| 5 | Character select shows mechanical bonuses |
| 6 | craftBonus refunds mats; rags / jacket / charge blueprints |
| 7 | Boom Street Charge (HEAL button fallback, +explosiveBonus) |
| 8 | MRE Paste as real consumable from loot |
| 9 | Combat VFX float damage + slash |
| 10 | Ambient narrator less spammy |
| 11 | Claude.md aligned with live game |

### Still open (next)

1. Split **GameScene.js** into modules (combat, sleep, craft, camera)
2. Right-click combat specials
3. Pixel art (PixelLab MCP when wanted)
4. Enemy silhouettes beyond dog (thug/drone/enforcer)
5. Minimap / breach compass after tutorial
6. Save / continue
7. GitHub push + Vercel when user wants remote play
8. XP on enemies still unused (no level system)

---

## User prefs

- VERIFY before saying “can’t / impossible”
- Exact product names; don’t invent dashboard paths
- Prefer local files + git until they ask for remote
- Prefer implement over ask-mode when they want changes

---

## Session wrap checklist

- [x] Code committed on `main` (`78a8315`)
- [x] AGENTS.md updated
- [ ] No remote push (by design)
- [x] Dev: `npm run dev` → http://localhost:5173/
- [x] Playtest: `npm run playtest` PASS
