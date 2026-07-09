# City Wars — Grok project (handoff)

**Primary agent:** Grok  
**Path:** `~/Dev/City Wars` (absolute: `/Users/ricktew/Dev/City Wars`)  
**Stack:** Phaser **4.2+ only** (never Phaser 3), Vite 6, pure client, procedural tiles  
**Git:** local `main` only. **Do not push / Vercel deploy unless user asks.** Remote play = push when ready.

**Last session HEAD:** `d71906d` (2026-07-09)  
**Working tree:** clean after handoff commit below.

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
```

Flow: **Day length** → **Choose Runner** → **ENTER THE GRID**.

---

## What the game is

Top-down **Escape-from-NY grit** city escape: scavenge, craft **Breach Kit**, leave via edge gold pads.

| System | Behavior |
|--------|----------|
| **Movement** | Click path. WALK / RUN / SNEAK. Left-click enemies to fight |
| **Camera** | Follow player + **mouse edge-pan** (~32px margin). Re-locks on walk or ~1.6s idle |
| **Alert** | CLEAR / CAUTION (HIDE) / COMBAT |
| **Day-night** | Bar fills day, drains night. SHORT 8m / MED 15m / LONG 25m |
| **Sleep** | Free at HQ. Away needs Sleeping Kit. Night away = ambush risk |
| **Craft** | Pink blueprints → purple Street Rig → CRAFT. Bandage recipe free in tutorial |
| **BAG** | Paper-doll: HEAD, BODY/armor, LEGS, WEAPON, QUICK1/2. Click or drag. Pauses time |
| **Guide** | 3 quests as **one-step** cards + yellow **pulse** on target / UI button |
| **Characters** | 9 runners (tight centered select grid). Narrator toggle after tutorial |
| **UI** | Full window. Combat log left. HQ arrow bottom-left. Bottom action bar. Popups pause |

### Tutorial path (must stay a hike, not a pile at feet)

| Step | What | Where |
|------|------|--------|
| 1a | Click **pulsing** gold crate | East ~12 tiles on road (`loot.guide`) |
| 1b | Walk onto **Street Stick** | South ~12 (`gearDrops` stick) |
| 1c | Walk onto **Neon Fedora** | West ~12 |
| 1d | **BAG** → equip stick WEAPON + hat HEAD | UI pulse on BAG |
| 1e | **CRAFT** Field Bandage at HQ purple rig | cloth×2 guaranteed from guide crate |
| 2 | Left-click **Grid Dog** | Spawns short hike away |
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
src/systems/Inventory.js         equip slots, totalAtk/totalDef, craft
src/systems/CityGenerator.js     HQ amenities + hike guide spots + world loot/bps
src/systems/StoryDirector.js     Intro / ambient / zone cards
src/systems/DayNight.js          Bar fill day / drain night
src/systems/AlertSystem.js       CLEAR / YELLOW / RED
src/entities/Actor.js            Player looks + dog silhouette
src/scenes/GameScene.js          ~2.7k lines — most gameplay (edge pan, pulse, combat)
src/scenes/CharacterSelectScene.js  Tight 3×3 centered cards
src/scenes/BootScene.js          Tile textures incl. GEAR_DROP
src/scenes/MenuScene.js          Day length
AGENTS.md                        This handoff
```

---

## Conventions (do not regress)

- **Phaser 4 only.** Never Phaser 3.
- **Mouse-first** UI.
- Player-facing copy: **no em/en dashes** (periods or hyphens).
- Popups / craft / legend / **bag** pause world (`isPaused`).
- Clear mouse paths on open/close popups and bag (no auto-walk after CLOSE / GOT IT).
- Guide targets are **hikes** (~12 tiles on roads), not clustered at spawn.
- Pulse current guide target; UI steps pulse BAG / CRAFT / SLEEP buttons.
- Local git only until user says push for Vercel.

---

## Recent commits (this arc)

| Hash | Summary |
|------|---------|
| `d71906d` | Tighter runner select + mouse edge camera pan |
| `a6ccb65` | Short hike guide, pulse, bag polish, bag-close auto-walk fix |
| `aa0686e` | 3-quest guide, equip UI, stick/hat gear drops |
| `5d91ad3` | Initial Phaser 4 vertical slice |

---

## Known issues / next polish (priority-ish)

1. **Playtest full tutorial** end-to-end after edge-pan (crate → stick → hat → bag → craft → dog → sleep)
2. Pulse / FOW: stick can still feel far until edge-pan or walk into vision — OK by design; tweak distance if too long
3. Split **GameScene.js** into modules (combat, sleep, craft, camera)
4. Right-click combat specials (design stub only)
5. Pixel art (PixelLab MCP available when wanted)
6. Middle-mouse drag pan (optional beside edge-pan)
7. **GitHub push + Vercel** when user wants remote play — do not do unprompted

---

## User prefs (from Claude.md / session)

- VERIFY before saying “can’t / impossible” about their setup
- Exact product names; don’t invent dashboard paths
- Prefer local files + git until they ask for remote
- “Agent mode” = edit code; “ask mode” = read-only advice. They prefer you just implement when they want changes.

---

## Session wrap checklist

- [x] Code committed on `main`
- [x] AGENTS.md updated
- [ ] No remote push (by design)
- [ ] Dev: `npm run dev` → http://localhost:5173/
