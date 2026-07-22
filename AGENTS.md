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

**User pain (repeated):** in-run text is still ugly (craft panel “STREET RIG”, objective, day bar, buttons).  
They want the **ENTIRE game** to have **nice looking text**, not only menus.

| Doc | Purpose |
|-----|---------|
| **`TEXT-STRATEGY.md`** | Locked text architecture + migration checklist |
| **`VISUAL-STYLE.md`** | Split-brain procedural + pixel + DOM text |
| **`public/audio/CREDITS.md`** | Mixkit ambient samples |

### Resume prompt

```
Continue City Wars in ~/Dev/City Wars per AGENTS.md + TEXT-STRATEGY.md.
PRIORITY: migrate ALL remaining Phaser Text / makeUiButton labels to DomUi
(craft panel, objective, day/heat, bottom bar, bag, combat, end screen).
pixelArt:true stays for tiles. Do not "fix" text with antialias.
Verify with screenshots: no chunky 1980-style UI type.
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
- `pixelArt: true` **stays** — never use it as an excuse for bad UI type  
- No orphan neon props / joke OPEN signs  

### Migrated this session (crisp)

- Title menu (DOM)  
- Character select + avatar chips (DOM)  
- Story/tutorial popups `showPopup` (DOM)  

### NOT migrated (still Phaser Text = still looks bad)

- CraftPanel **STREET RIG** / recipes  
- Objective banner, day/heat HUD  
- Bottom action bar (`makeUiButton`)  
- EquipUI / bag, combat log, minimap labels, end screen  

---

## World tone / audio (LOCKED)

City **already fell**. Gangs/vigilantes/dogs — **no police sirens**.

| Context | Gap |
|---------|-----|
| Title menu | **2–10s** |
| In run | Zone-scaled **~2–28s** (`startWorldAmb({ getZone, isNight })`) |

Samples: `public/audio/ambient/` (Mixkit free). Oscillators only for UI + light cyber.

---

## Session wrap (2026-07-22) — this session

**Status:** Local working tree has large uncommitted improvements. **Commit + push** when resuming if still dirty.

### Shipped locally (this session)

| Area | What |
|------|------|
| Title visuals | Dense skyline, building-anchored fires, centered DOM menu card |
| Text architecture | DomUi; menus + runner select + showPopup on DOM |
| Orphan props | Removed OPEN/RENT DUE and leftover neon lines |
| Audio | Sample ambience (dogs/guns/howls/explosions/cyber); menu 2–10s; world zone density |
| World copy | No siren lore |

### User still blocked on

1. **In-game HUD text still Phaser / chunky** (screenshot: STREET RIG craft UI) — **#1 next**  
2. Full DOM HUD migration per `TEXT-STRATEGY.md`  
3. Gameplay / 15-min loop feel (older open question)  
4. Commit/push this session’s work  

### Rules that burned sessions (do not repeat)

- Do not flip `pixelArt` off to “fix” text  
- Do not leave decorative glows when removing joke signs  
- Do not claim “text is fixed” after menus only — user means **entire game**  
- Prefer live screenshots; hard refresh after DOM/CSS changes  

---

## Flow

**Day length** → **START RUN** / **CONTINUE** → **Choose Runner** → **ENTER THE GRID**.
