# City Wars — Grok project (handoff)

**Primary agent:** Grok  
**Path:** `~/Dev/City Wars` (absolute: `/Users/ricktew/Dev/City Wars`)  
**Stack:** Phaser **4.2+ only** (never Phaser 3), Vite 6, pure client, procedural tiles  

| Remote | URL |
|--------|-----|
| **GitHub** | https://github.com/RickTew/city-wars (`main`, public) |
| **Play (prod)** | **https://city-wars-rho.vercel.app** (stable alias only) |
| **Vercel project** | `ricktew/city-wars` · auto-deploys on push to `main` |

**Version:** 3.9.2 (audit fixes: wall softlock, save guide dog, default zoom)  
**HEAD:** `b144a14` on `main` · auto-deploys to Vercel  

**Workflow (user locked):** fix → **commit + push `main`** → **`npm run playtest`** → next item.  
**Deploy:** testing on **https://city-wars-rho.vercel.app** (not only localhost).

---

## ⛔ NEXT SESSION — DO THIS FIRST

**Visual direction locked (user):** DungeonHole hybrid — procedural board + pixel miniatures 1:1 later. Live **`TILE = 64`**. DomUi for all HUD text.

| Doc | Purpose |
|-----|---------|
| **`TEXT-STRATEGY.md`** | DOM text layers |
| **`VISUAL-STYLE.md`** | Procedural + pixel hybrid; TILE 64 |
| **`public/audio/CREDITS.md`** | Mixkit ambient (no cheer/clap yells) |

### Resume prompt

```
Continue City Wars in ~/Dev/City Wars per AGENTS.md + VISUAL-STYLE.md.
HEAD 8509771. TILE=64. Style Lab: ?lab=1 or menu STYLE LAB.
Priority: pixel props (crate/workbench/runner), optional smaller city sizes,
leaderboards already local. Day/night is sun speed only — not a timed loop.
pixelArt:true stays. DomUi for UI text. Do not flip pixelArt off for type.
```

```bash
cd ~/Dev/City\ Wars
npm run dev   # http://localhost:5173/  — Cmd+Shift+R
# Style Lab: http://localhost:5173/?lab=1
```

---

## Visual + text contract (LOCKED)

- **Procedural** board (roads H/V/X, grass, barricade, buildings…)  
- **Pixel 1:1 later** for characters/crates (DungeonHole model)  
- **All player-facing text = DOM** (`DomUi` layers: hud / ui / craft / modal)  
- **`TILE = 64`** (actors scaled from 32 design base)  
- `pixelArt: true` **stays**  
- Roads: dashes **follow street axis** (not circuit-stamp)  
- No orphan neon / joke signs  

### Style Lab

- Menu → **STYLE LAB** or `?lab=1`  
- Full terrain vocabulary + hybrid miniature stand-ins  

---

## Controls (camera)

| Input | Action |
|-------|--------|
| Wheel | Zoom 0.4–1.75 (gentle steps) |
| Pinch | Same zoom range |
| **Right-drag** | Pan map |
| Middle-drag | Pan map |
| Edge pan | Still works |
| Short right-click (combat) | Specials (if not dragged) |

---

## World tone / audio (LOCKED)

City **already fell**. No police sirens. **No cheer/clap yell samples** (removed).

| Context | Gap |
|---------|-----|
| Title menu | **2–10s** |
| In run | Zone-scaled gaps |

Samples: dogs, howls, guns, explosions, screams, cyber only.

---

## Session wrap (2026-07-22) — visual + tutorial + camera

**Status:** Clean tree, pushed `main` @ `8509771`.

### Shipped this arc

| Area | What |
|------|------|
| DomUi | Full in-run HUD/craft/bag/menus/end |
| Roads | ROAD / ROAD_V / ROAD_X directional dashes |
| TILE | 64px live; TileArt scales paints |
| Style Lab | Side-by-side + full tile legend |
| Tutorial | Map-first boot ~1.5s; compact coach + CLOSE; no double toast; no early fights/craft |
| Camera | Wheel/pinch zoom; right-drag pan; clearer minimap |
| Audio | Yell/cheer bank removed |

### Open next session

1. **Pixel art path** — runner/dog/crate sprites at 1:1 on 64px board (`game-asset-core` / character skills)  
2. Default camera zoom so more city fits at 64px  
3. Further tile readability if needed  
4. Pacing: optional smaller city map for shorter crawls (not a countdown)  
5. Optional: world floaters (HP/dmg) still Phaser  

### Rules that burned sessions (do not repeat)

- Do not flip `pixelArt` off to “fix” text  
- Do not claim text fixed after menus only  
- Do not put horizontal dashes on N–S roads  
- Do not stack coach + log toast  
- Hard refresh after DOM/CSS/deploy  
- Keep questions/options at **end** of replies (user request)  

---

## Flow

**Day length** → **START RUN** / **CONTINUE** → **Choose Runner** → **ENTER THE GRID**.  
**STYLE LAB** from menu for visual compare.
