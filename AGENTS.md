# City Wars — Grok project (handoff)

**Primary agent:** Grok  
**Path:** `~/Dev/City Wars` (absolute: `/Users/ricktew/Dev/City Wars`)  
**Stack:** Phaser **4.2+ only** (never Phaser 3), Vite 6, pure client, procedural tiles  

| Remote | URL |
|--------|-----|
| **GitHub** | https://github.com/RickTew/city-wars (`main`, public) |
| **Play (prod)** | **https://city-wars-rho.vercel.app** (stable alias only) |
| **Vercel project** | `ricktew/city-wars` · auto-deploys on push to `main` |

**Version:** 3.12.0 (CENTRAL voice + five-item mission · city rings · map overlay)  
**HEAD:** `2c553ec` on `main` · auto-deploys to Vercel  

**Workflow (user locked):** fix → **commit + push `main`** → **`npm run playtest`** (and `node scripts/deep-probe.mjs` after systems changes) → next item.  
**Deploy:** test on **https://city-wars-rho.vercel.app** (not only localhost). Hard refresh after DOM/CSS.

---

## ⛔ NEXT SESSION — DO THIS FIRST

**Visual direction locked:** DungeonHole hybrid — procedural board + **pixel miniatures 1:1** next. Live **`TILE = 64`**. DomUi for all HUD text. `pixelArt: true` stays.

| Doc | Purpose |
|-----|---------|
| **`TEXT-STRATEGY.md`** | DOM text layers |
| **`VISUAL-STYLE.md`** | Procedural + pixel hybrid; TILE 64 |
| **`public/audio/CREDITS.md`** | Mixkit ambient (no cheer/clap yells) |
| **`src/systems/HqVoice.js`** | CENTRAL AI voice + MISSION_FIVE list |

### Resume prompt

```
Continue City Wars in ~/Dev/City Wars per AGENTS.md + VISUAL-STYLE.md.
HEAD 2c553ec. TILE=64. CENTRAL = sarcastic HQ AI; five-item recovery mission.
HOME = tutorial (no combat packs). Rings: YEL→ORG→GRN→BLU→RED.
MAP chip opens paused FOW city map (not corner minimap).
Priority: (A) pixel props 1:1 — crate / workbench / runner / dog
(B) polish CENTRAL copy on more surfaces
(C) optional smaller city size preset
(D) Style Lab hybrid previews for new sprites
pixelArt:true stays. DomUi for UI text. Do not flip pixelArt off for type.
After fixes: commit + push main + npm run playtest.
```

```bash
cd ~/Dev/City\ Wars
npm run dev          # http://localhost:5173/  — Cmd+Shift+R
npm run playtest     # smoke
node scripts/deep-probe.mjs   # rings / paths / save softlocks
# Style Lab: http://localhost:5173/?lab=1
```

---

## Story / mission (LOCKED this arc)

- **CENTRAL // HQ-NET** — sarcastic, helpful, dark humor; low faith in humans.  
- Player is **dropped** to recover **five items**:  
  1. Salvage Cache (gold crate E)  
  2. Street Stick (S)  
  3. Neon Fedora (W)  
  4. Field Bandage (craft at purple U)  
  5. Breach Kit (RED / Wall → escape)  
- Boot card, coach, objectives, zone cards, escape arc use this voice (`HqVoice.js`, `StoryDirector`, `GuideDirector`, `EscapeDirector`).

---

## City rings (LOCKED)

| Zone | Level | Role |
|------|-------|------|
| **HOME** | 0 | Tutorial drop pad — **not** a combat color ring; no pack spawns |
| **YELLOW** | 1 | First enterable streets |
| **ORANGE** | 2 | Mid crawl |
| **GREEN** | 3 | Drones |
| **BLUE** | 4 | Enforcers / heat |
| **RED** | 5 | Wall, Breach, escape pads |

- Spawns are **budgeted per ring** (not scan-order fill from north).  
- Day/night = **sun speed only**, not a run timer.  
- Shorter crawls later = **smaller map**, not a countdown.

---

## Visual + text contract (LOCKED)

- **Procedural** board (roads H/V/X center dash only, calmer sidewalks, buildings…)  
- **Pixel 1:1 later** for characters/crates/props (DungeonHole model)  
- **All player-facing text = DOM** (`DomUi`)  
- **`TILE = 64`** · `pixelArt: true` **stays**  
- Thugs = dusty olive (**not** zone yellow)  
- No orphan neon / joke signs  

### MAP

- Corner mini-map **removed**.  
- **MAP** chip / bar → paused overlay: **uncovered FOW** + zone chips + key pins.  
- Explored tiles persist in save.

### Style Lab

- Menu → **STYLE LAB** or `?lab=1`  

---

## Controls (camera)

| Input | Action |
|-------|--------|
| Wheel | Zoom 0.4–1.75 (`DEFAULT_ZOOM` ≈ 0.58) |
| Pinch | Same zoom range |
| **Right-drag** | Pan map |
| Middle-drag | Pan map |
| Edge pan | Still works |
| Short right-click (combat) | Specials (if not dragged) |

---

## World tone / audio (LOCKED)

City **already fell**. No police sirens. **No cheer/clap yell samples**.

| Context | Gap |
|---------|-----|
| Title menu | **2–10s** |
| In run | Zone-scaled gaps |

Samples: dogs, howls, guns, explosions, screams, cyber only.

---

## Meta systems

- **Save / CONTINUE** + **autosave** (~90s, craft, combat, dawn/night).  
- **Leaderboards** (local): kills, crafts, fastest escape (days/clock), survival, heat — menu **LEADERBOARDS**.  
- **Playtest:** `scripts/playtest.mjs` · **Deep probe:** `scripts/deep-probe.mjs`.

---

## Session wrap (2026-07-23) — rings, map, CENTRAL

**Status:** Clean tree, pushed `main` @ `2c553ec`.

### Shipped this arc

| Area | What |
|------|------|
| Softlocks | Wall corridor to north escape; Breach walkable; guide dog save/load |
| Rings | HOME + Y/O/G/B/R levels; per-ring spawn budgets |
| Tiles | Center-line roads; flat sidewalks |
| Enemies | Thugs recolored; HOME no combat packs |
| Map | MAP overlay (FOW + zones + pins); no corner minimap |
| Meta | Leaderboards + autosave + day/night = sun speed only |
| Story | CENTRAL voice + five-item recovery mission |
| Zoom | Default ~0.58 |

### Open next session

1. **Pixel art path** — runner / dog / crate / workbench at 1:1 on 64px board  
2. Wire pixel sprites into game + Style Lab  
3. Optional: smaller city size preset  
4. Optional: more CENTRAL lines (combat, death, win)  
5. World floaters (HP/dmg) may stay Phaser  

### Rules that burned sessions (do not repeat)

- Do not flip `pixelArt` off to “fix” text  
- Do not claim text fixed after menus only  
- Do not put horizontal dashes on N–S roads  
- Do not stack coach + log toast  
- Do not fill enemy cap from map scan order (use ring budgets)  
- Hard refresh after DOM/CSS/deploy  
- Commit + push + playtest after major fixes  
- Keep questions/options at **end** of replies  

---

## Flow

**Day/night speed** → **START RUN** / **CONTINUE** → **Choose Runner** → **ENTER THE GRID**.  
**STYLE LAB** · **LEADERBOARDS** from menu.  
**MAP** in-run (chip or bar).
