# City Wars — Grok project (handoff)

**Primary agent:** Grok  
**Path:** `~/Dev/City Wars` (absolute: `/Users/ricktew/Dev/City Wars`)  
**Stack:** Phaser **4.2+ only** (never Phaser 3), Vite 6, pure client, procedural tiles  
**Git:** local `main` only. **Do not push / Vercel deploy unless user asks.** Remote play = push when ready.

**Last session HEAD:** `77f49d9` (2026-07-13)  
**Working tree:** clean. City Wars audit + playtest shipped; session wrapped.

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
npm run playtest   # automated tutorial smoke (needs Chrome + dev server up)
```

Flow: **Day length** → **Choose Runner** → **ENTER THE GRID**.

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
| **Craft** | Pink blueprints → purple Street Rig → CRAFT. Bandage recipe free in tutorial. Browse anywhere; craft only at rig |
| **BAG** | Paper-doll: HEAD, BODY/armor, LEGS, WEAPON, QUICK1/2. Click or drag. Pauses time |
| **Guide** | 3 quests as **one-step** cards + yellow **pulse** on target / UI button |
| **Characters** | 9 runners (tight centered select grid). Narrator toggle after tutorial |
| **UI** | Full window. Combat log left. HQ arrow bottom-left. Bottom action bar (responsive gap). Popups pause |

### Tutorial path (must stay a hike, not a pile at feet)

| Step | What | Where |
|------|------|--------|
| 1a | Click **pulsing** gold crate | East ~12 tiles on road (`loot.guide`) |
| 1b | Walk onto **Street Stick** | South ~12 (`gearDrops` stick) |
| 1c | Walk onto **Neon Fedora** | West ~12 |
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
src/main.js                      Boot → Menu → CharacterSelect → Game
src/config/constants.js          TILE, T (incl. GEAR_DROP), SLOT, GEAR, BLUEPRINTS, DAY_LENGTH
src/config/characters.js         9 runners
src/systems/GuideDirector.js     One-step QUESTS + COACH; resolveTarget() for pulse
src/systems/EquipUI.js           BAG loadout UI (block map click on close)
src/systems/Inventory.js         equip slots, totalAtk/totalDef, craft; kits → free QUICK
src/systems/CityGenerator.js     HQ amenities + hike guide spots + world loot/bps
src/systems/StoryDirector.js     Intro / ambient / zone cards
src/systems/DayNight.js          Bar fill day / drain night
src/systems/AlertSystem.js       CLEAR / YELLOW / RED
src/entities/Actor.js            Player looks + dog silhouette
src/scenes/GameScene.js          ~2.9k lines — most gameplay (edge pan, mid pan, pulse, combat)
src/scenes/CharacterSelectScene.js  Tight 3×3 centered cards
src/scenes/BootScene.js          Tile textures incl. GEAR_DROP
src/scenes/MenuScene.js          Day length
scripts/playtest.mjs             Headless Chrome tutorial smoke via window.__CITY_WARS__
AGENTS.md                        This handoff
```

---

## Conventions (do not regress)

- **Phaser 4 only.** Never Phaser 3.
- **Mouse-first** UI.
- Player-facing copy: **no em/en dashes** (periods or hyphens).
- Popups / craft / legend / **bag** pause world (`isPaused`).
- Clear mouse paths on open/close popups, bag, craft, legend (no auto-walk after CLOSE / GOT IT).
- Guide targets are **hikes** (~12 tiles on roads), not clustered at spawn.
- Pulse current guide target; UI steps pulse BAG / CRAFT / SLEEP buttons.
- **Guide dog** must set `_isGuideDog` and must **not** be culled at dawn with night dogs.
- Combat damage must use `inv.totalDef` for the player (armor counts).
- HEAL must use bag **or** QUICK slots (`countItem` / `useConsumable`).
- Local git only until user says push for Vercel.
- Playtest API: `window.__CITY_WARS__` with `debugState()`, `debugWarp()`, `dismissPopup()`.

---

## Audit (2026-07-13) — shipped

| # | Issue | Fix |
|---|--------|-----|
| 1 | Guide dog destroyed at dawn → quest 2 soft-lock | `refreshNightSpawns(false)` keeps `_isGuideDog` / `guideDog` |
| 2 | Armor DEF ignored in combat | `resolveHit` uses `inv.totalDef` for player |
| 3 | HEAL only checked bag, not QUICK slots | `useBandage` uses `countItem` + `useConsumable` |
| 4 | `healBonus` (Doc Rue) unused on bandages | Applied after consumable heal |
| 5 | Hat / char `sneakBonus` unused | `playerSneakBonus()` for noise + spot range + ring |
| 6 | Char `visionBonus` unused in FOW | `playerVision()` for FOW + spotting |
| 7 | Kits always overwrote QUICK1 | Click-equip prefers free QUICK1 then QUICK2 |
| 8 | Craft/legend close could path-walk | clear path + uiBlock like bag |
| 9 | Quest 2 completed on any dog kill | Only guide dog sets `_guideDogDead` |
| 10 | No middle-mouse pan | Middle-drag free cam |
| 11 | Bottom bar fixed gap overflow | Responsive gap/btn width from window |
| 12 | Craft UI unclear away from rig | Proximity banner (browse vs craft) |
| 13 | No automated playtest | `npm run playtest` + `__CITY_WARS__` |

### Still open (next polish)

1. Split **GameScene.js** into modules (combat, sleep, craft, camera)
2. Right-click combat specials (design stub only)
3. Pixel art (PixelLab MCP when wanted)
4. Distinct stick vs hat world tile art (both use GEAR_DROP purple today)
5. Character bonuses still soft: craftBonus / explosiveBonus mostly unused
6. **GitHub push + Vercel** when user wants remote play — do not do unprompted

---

## Grok TUI status lights (user testing next session)

User feedback: purple accent always blinks, so working vs idle is unclear. **Intended:** pulse while working, still when stopped.

Global config (not in this repo):

| File | Change |
|------|--------|
| `~/.grok/pager.toml` | calmer animation (`fps=20`), dimmer finished accents (`dim_accent=0.35`), thinking animate still on |
| `~/.grok/config.toml` | `[ui.notifications]` always on turn_complete; title spinner/activity; **Pop.aiff** chime when a turn finishes |

**Test after new session:** run any short prompt → accents should pulse → when reply finishes, chime + accents should settle. If purple never stops, set `[scrollback.blocks.thinking] animate = false` in `pager.toml`.

---

## Recent commits (this arc)

| Hash | Summary |
|------|---------|
| `77f49d9` | Handoff pin after audit |
| `59bee61` | Audit fixes: combat DEF, guide dog dawn, heal/sneak/vision, mid-pan, playtest |
| `d71906d` | Tighter runner select + mouse edge camera pan |
| `a6ccb65` | Short hike guide, pulse, bag polish, bag-close auto-walk fix |
| `aa0686e` | 3-quest guide, equip UI, stick/hat gear drops |
| `5d91ad3` | Initial Phaser 4 vertical slice |

---

## User prefs (from Claude.md / session)

- VERIFY before saying “can’t / impossible” about their setup
- Exact product names; don’t invent dashboard paths
- Prefer local files + git until they ask for remote
- “Agent mode” = edit code; “ask mode” = read-only advice. They prefer you just implement when they want changes.
- TUI: working vs idle should be obvious (accents + chime); they will re-test in a new session

---

## Session wrap checklist

- [x] Code committed on `main` (`59bee61` + `77f49d9`)
- [x] AGENTS.md updated for wrap
- [ ] No remote push (by design)
- [ ] Dev: `npm run dev` → http://localhost:5173/ (restart if needed)
- [x] Playtest: `npm run playtest` PASS
- [x] Grok TUI config ready for user new-session test (`pager.toml` + notifications)
