# City Wars — Grok project (handoff)

**Primary agent:** Grok  
**Path:** `~/Dev/City Wars` (absolute: `/Users/ricktew/Dev/City Wars`)  
**Stack:** Phaser **4.2+ only** (never Phaser 3), Vite 6, pure client, procedural tiles  

| Remote | URL |
|--------|-----|
| **GitHub** | https://github.com/RickTew/city-wars (`main`, public) |
| **Play (prod)** | **https://city-wars-rho.vercel.app** (stable alias only) |
| **Vercel project** | `ricktew/city-wars` · auto-deploys on push to `main` |

**Version:** 3.9.x (menu DOM, ambience samples, popup DOM)  
**HEAD:** `b45cc21` on `main` (2026-07-22) · auto-deploys to Vercel  

**Deploy preference (user):** after every major change/fix, **commit + push `main`** so testing is on **https://city-wars-rho.vercel.app** (not only localhost).

---

## ⛔ NEXT SESSION — DO THIS FIRST

**Text migration (HUD + craft + bag + menus) shipped.**  
Hard-refresh prod: **https://city-wars-rho.vercel.app** — if any *HUD* line is still chunky, it’s a regression.

| Doc | Purpose |
|-----|---------|
| **`TEXT-STRATEGY.md`** | Locked text architecture + layer map |
| **`VISUAL-STYLE.md`** | Split-brain procedural + pixel + DOM text |
| **`public/audio/CREDITS.md`** | Mixkit ambient samples |

### Resume prompt

```
Continue City Wars in ~/Dev/City Wars per AGENTS.md + TEXT-STRATEGY.md.
Verify full DomUi HUD on https://city-wars-rho.vercel.app (hard refresh).
Optional: Actor HP / VFX floatText stay Phaser (world floaters).
Next product: 15-min loop feel / gameplay polish if text looks good.
pixelArt:true stays. Do not "fix" text with antialias.
```

```bash
cd ~/Dev/City\ Wars
npm run dev   # http://localhost:5173/  — Cmd+Shift+R
```

---

## Visual + text contract (LOCKED)

- **Procedural** board/skyline/chrome  
- **Pixel** later for characters/crates (nearest)  
- **All player-facing text = DOM** (`DomUi.js` + `index.html` CSS)  
- Layers: `#dom-hud` · `#dom-ui` · `#dom-craft` · `#dom-modal`  
- `pixelArt: true` **stays** — never use it as an excuse for bad UI type  
- No orphan neon props / joke OPEN signs  

### Migrated (crisp DOM)

- Title menu, character select, story popups  
- In-run HUD (status, objective, day/heat, toast, action bar)  
- Craft **STREET RIG**, bag/loadout, run menu, MORE, legend, specials  
- Combat dock, minimap labels, end screen  

### Optional Phaser (world floaters only)

- Enemy HP digits (`Actor.js`), damage `floatText` (`VFX.js`)  

---

## World tone / audio (LOCKED)

City **already fell**. Gangs/vigilantes/dogs — **no police sirens**.

| Context | Gap |
|---------|-----|
| Title menu | **2–10s** |
| In run | Zone-scaled **~2–28s** (`startWorldAmb({ getZone, isNight })`) |

Samples: `public/audio/ambient/` (Mixkit free). Oscillators only for UI + light cyber.

---

## Session wrap (2026-07-22) — DOM HUD migration

**Status:** Full in-run DomUi migration. **Commit + push `main`** for Vercel.

### Shipped

| Area | What |
|------|------|
| DomUi layers | hud / ui / craft / modal |
| CraftPanel | STREET RIG + recipes DOM |
| GameScene HUD | objective, day/heat, bar buttons, toast, combat, end |
| EquipUI | full bag/loadout DOM |
| Minimap labels | MAP + compass DOM |

### Open after verify

1. Live screenshot pass on prod (hard refresh)  
2. Gameplay / 15-min loop feel  
3. Optional world floater DOM later  

### Rules that burned sessions (do not repeat)

- Do not flip `pixelArt` off to “fix” text  
- Do not leave decorative glows when removing joke signs  
- Do not claim “text is fixed” after menus only — user means **entire game**  
- Prefer live screenshots; hard refresh after DOM/CSS changes  

---

## Flow

**Day length** → **START RUN** / **CONTINUE** → **Choose Runner** → **ENTER THE GRID**.
