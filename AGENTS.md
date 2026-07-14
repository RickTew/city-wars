# City Wars — Grok project (handoff)

**Primary agent:** Grok  
**Path:** `~/Dev/City Wars` (absolute: `/Users/ricktew/Dev/City Wars`)  
**Stack:** Phaser **4.2+ only** (never Phaser 3), Vite 6, pure client, procedural tiles  

| Remote | URL |
|--------|-----|
| **GitHub** | https://github.com/RickTew/city-wars (`main`, public) |
| **Play (prod)** | **https://city-wars-rho.vercel.app** (stable alias only) |
| **Vercel project** | `ricktew/city-wars` · auto-deploys on push to `main` |

**Version:** 3.6.x + PWA + mobile tutorial pass  
**Last session HEAD:** `783533a` (2026-07-14) · working tree clean after wrap  

---

## Resume next session with

```
Continue City Wars in ~/Dev/City Wars per AGENTS.md
```

```bash
cd ~/Dev/City\ Wars
npm install          # if needed
npm run dev          # http://localhost:5173/
# hard refresh: Cmd+Shift+R
npm run playtest     # needs Chrome + dev server up
# prod:
#   https://city-wars-rho.vercel.app
```

Flow: **Day length** → **START RUN** or **CONTINUE** → **Choose Runner** → **ENTER THE GRID**.

---

## Session wrap (2026-07-14) — pause for design rethink

**Status:** Tech/tutorial/mobile bugs addressed and on `main`. User is **not getting what they want out of the game yet** and will think through solutions. Next work should wait on **design direction**, not more polish for its own sake.

### Shipped this session (all on `main`)

| Area | What |
|------|------|
| Tutorial findability | Hikes ~6 tiles; gold pulse + edge beacon; OBJ compass during guide; camera nudge after GOT IT |
| Popup stack | Single SIGNAL BOOT (no DISTRICT READ first); coach steps = log toasts; story quiet until boot dismiss |
| Phone SIGNAL BOOT | Compact copy; safe-area panel; panel not interactive (was eating GOT IT); fat button |
| Bottom bar | Narrow: MORE sheet (SNEAK/WALK/MENU/MAP). Combat: **SPEC** + long-press specials |
| BAG / LOADOUT | Stacked layout on narrow; side-by-side desktop with slot hints |
| Playtest | `npm run playtest` PASS after changes |

### Key commits

| Hash | Summary |
|------|---------|
| `783533a` | Phone bag layout + SIGNAL BOOT tap fix |
| `7d4917f` | Tutorial pulses, MORE bar, SPEC long-press |
| `7b14dc8` | PWA icons + manifest (prior) |

### User feedback (do not ignore)

- Gameplay / fantasy not landing yet — **solutions TBD by user**
- Prefer verifying live UI/code over guessing
- Push decent fixes when shipping; don’t force-push `main`

When resuming: **ask what “good” looks like** (loop, tension, fantasy, session length) before more systems.

---

## What the game is (current build)

Top-down **Escape-from-NY grit** city escape: scavenge, craft **Breach Kit**, leave via edge gold pads.

| System | Behavior |
|--------|----------|
| **Movement** | Click/tap path. WALK / RUN / SNEAK |
| **Camera** | Follow + mouse edge-pan + middle-mouse drag (desktop) |
| **Alert** | CLEAR / CAUTION (HIDE) / COMBAT |
| **Day-night** | Bar fills day, drains night. SHORT 8m / MED 15m / LONG 25m |
| **Sleep** | Free at HQ. Away needs Sleeping Kit |
| **Craft** | Pink BPs → purple Street Rig. Bandage free in tutorial |
| **BAG** | Paper-doll + bag. Responsive stack on phone. Pauses time |
| **HEAL** | Bandage → Stim → MRE. Else Street Charge |
| **Combat specials** | SPEC · long-press map · right-click desktop |
| **Save** | `localStorage` `city_wars_save_v1` |
| **Minimap** | Top-right + OBJ compass (also during tutorial) |
| **PWA** | Manifest + icons |

### Tutorial path

| Step | What |
|------|------|
| 1a–c | Gold crate east · stick south · hat west (~6 tiles, pulse + arrow) |
| 1d–e | BAG equip · CRAFT bandage at HQ |
| 2 | Guide dog (tap; `_isGuideDog` survives dawn) |
| 3 | SLEEP at HQ |
| Free | Breach BP pink near north Wall |

### Characters

`neon_val`, `pretty_boy`, `shade`, `brick`, `doc_rue`, `static`, `boom`, `forge`, `needle`

---

## Still open (when design direction returns)

1. **Fun / loop design** (highest priority when user is ready) — what the run *feels* like
2. Optional mobile: two-row HUD, pinch zoom, free-look drag
3. Pixel art (PixelLab) if wanted
4. GameScene further splits (craft UI, FOW)
5. Custom domain on Vercel if wanted

---

## Key files

```
src/main.js                         Boot → Menu → CharacterSelect → Game
src/config/constants.js             TILE, T, GEAR, BLUEPRINTS
src/config/characters.js            9 runners
src/scenes/GameScene.js             Explore + UI glue (large)
src/scenes/mixins/combatMixin.js    Combat, specials, XP
src/scenes/mixins/cameraMixin.js    Edge pan / free cam
src/scenes/mixins/sleepMixin.js     Sleep / ambush
src/systems/GuideDirector.js        Tutorial pulse / quests
src/systems/EquipUI.js              BAG (responsive)
src/systems/Inventory.js            craft + consumables
src/systems/CityGenerator.js        Map + ~6-tile hikes + BPs
src/systems/Minimap.js              Corner map + OBJ compass
src/systems/SaveSystem.js           localStorage
scripts/playtest.mjs                Tutorial smoke + math checks
AGENTS.md                           This handoff
```

---

## Conventions (do not regress)

- **Phaser 4 only.** Never Phaser 3.
- Player-facing copy: **no em/en dashes** (periods or hyphens).
- Popups / craft / legend / bag / menu / specials / MORE → `isPaused`.
- Clear mouse path on open/close modals.
- Guide hikes ~6 tiles; pulse + edge beacon; guide dog not culled at dawn.
- Combat: `inv.totalDef` for player; bat/ranged bonuses **live only**.
- Playtest API: `window.__CITY_WARS__` (`debugState`, `debugWarp`, `dismissPopup`, …).
- **Prod URL:** `https://city-wars-rho.vercel.app`
- Push to `main` deploys; do not force-push.

---

## Session wrap checklist

- [x] Tutorial / pulse / mobile bar / SPEC / bag fixes on `main`
- [x] Playtest PASS
- [x] Vercel auto-deploy from push
- [x] AGENTS.md updated for next session
- [ ] Design direction from user (paused — wait for them)
