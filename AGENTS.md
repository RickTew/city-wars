# City Wars — Grok project (handoff)

**Primary agent:** Grok  
**Path:** `~/Dev/City Wars` (absolute: `/Users/ricktew/Dev/City Wars`)  
**Stack:** Phaser **4.2+ only** (never Phaser 3), Vite 6, pure client, procedural tiles  

| Remote | URL |
|--------|-----|
| **GitHub** | https://github.com/RickTew/city-wars (`main`, public) |
| **Play (prod)** | **https://city-wars-rho.vercel.app** (stable alias only) |
| **Vercel project** | `ricktew/city-wars` · auto-deploys on push to `main` |

**Version:** 3.7.x + heat / escape arc + mobile HUD pass  
**Last session HEAD:** `23742a1` (2026-07-20) · working tree clean after wrap  

---

## Resume next session with

```
Continue City Wars in ~/Dev/City Wars per AGENTS.md
```

```bash
cd ~/Dev/City\ Wars
npm install          # if needed
npm run dev          # http://localhost:5173/
# hard refresh: Cmd+Shift+R (phone: force-reload PWA / clear site data if stuck)
npm run playtest     # needs Chrome + dev server up
# prod:
#   https://city-wars-rho.vercel.app
```

Flow: **Day length** → **START RUN** or **CONTINUE** → **Choose Runner** → **ENTER THE GRID**.

---

## Session wrap (2026-07-20) — pause after systems + mobile UX

**Status:** Large audit → pressure → art/combat → craft/inventory → mobile HUD pass shipped on `main`. User will **playtest on phone tomorrow**, then continue. Prefer verifying live UI over guessing. Commit + push to `main` after each meaningful fix (user preference this session).

### Shipped this arc (all on `main`)

| Area | What |
|------|------|
| Grid heat | `HeatSystem` 0–100; patrol at 75%; HQ sleep blocked at 88%; vignette + GRID SWEEP |
| Escape arc | `EscapeDirector` 4 beats; Wall cache for breach mats; heat spike on Breach craft |
| Art / combat | Neon tiles, zone tints, cover, enemy specials, BAG GEAR\|MATS\|CRAFT tabs |
| Craft / inventory | Inline `CraftPanel`; keys 1–6; `STACKABLE` consumables; auto-equip Q1/Q2 |
| Mobile HUD | Two-row bar (no MORE on phones); pinch zoom; touch drag pan |
| Camera | **No auto-follow** — stays where you pan; snap only on start/load/warp |
| Mobile taps | BAG/MENU on separate rows; safe-area bottom pad; touchmove blocked |
| Menu / select | Bigger neon title; runner cards less truncated; day-length spacing |

### Key commits (2026-07-20)

| Hash | Summary |
|------|---------|
| `23742a1` | Camera no auto-follow + BAG safe-area / touch scroll fix |
| `9de4ee4` | Main menu breathing room |
| `5297ce7` | Mobile overlap + BAG/MENU mis-tap |
| `cd2424b` | Two-row mobile HUD + pinch / touch pan |
| `1c76f99` | HEAL×n, auto bench craft, heat feel, Wall cache |
| `1433236` | Inline craft panel + stackable consumables |
| `7f4d86b` | Neon art, tactical combat, BAG craft tabs |
| `d68329d` | Escape cinematic, run legacy, atmosphere |
| `bfff090` | Grid heat + staged escape arc |

### User feedback still live (do not ignore)

- Gameplay / fantasy still the big open question — user will judge after phone playtest
- **Text-on-text / icon-on-icon** still reported on Mini screenshots — some fixed, **verify on device tomorrow**
- BAG near home indicator was scrolling page (safe-area fix shipped; re-check Safari vs PWA)
- Prefer live UI/code over guessing; push decent fixes; no force-push `main`
- Do **not** Mini-only hacks — scale proportionally for all phones

When resuming: **ask what still feels broken after phone playtest**, then prioritize remaining overlaps / loop feel.

---

## What the game is (current build)

Top-down **Escape-from-NY grit** city escape: scavenge, craft **Breach Kit**, leave via edge gold pads.

| System | Behavior |
|--------|----------|
| **Movement** | Click/tap path. WALK / RUN / SNEAK |
| **Camera** | **Free look** (no auto-center on walk). Edge-pan (desktop), middle-mouse drag, touch drag + pinch zoom |
| **Alert** | CLEAR / CAUTION (HIDE) / COMBAT |
| **Heat** | GRID HEAT rises with noise/combat/outer zones; patrol + vignette at high heat |
| **Day-night** | Bar fills day, drains night. SHORT 8m / MED 15m / LONG 25m |
| **Sleep** | Free at HQ (blocked if heat ≥ 88). Away needs Sleeping Kit |
| **Craft** | Pink BPs → purple Street Rig. Inline docked panel; keys 1–6 at bench; auto-open near bench |
| **BAG** | Paper-doll + GEAR\|MATS\|CRAFT tabs. Stacked on phone. Pauses time |
| **HEAL** | Bandage → Stim → MRE (stackable). Button shows `HEAL×n`. Else Street Charge |
| **Combat specials** | SPEC · long-press map · right-click desktop |
| **Save** | `localStorage` `city_wars_save_v1` |
| **Legacy** | `city_wars_legacy_v1` escapes / KIA |
| **Minimap** | Top-right + OBJ compass (also during tutorial) |
| **PWA** | Manifest + icons + safe-area insets |

### Mobile bottom bar (phones: width &lt; 520 or height &lt; 700)

| Row | Buttons |
|-----|---------|
| Top | SNEAK · WALK · HEAL · MAP · **MENU** |
| Bottom | USE · SLEEP · HIDE · CRAFT · **BAG** |
| Combat | MAP → SPEC |

Tablet-narrow (520–700) may still use MORE sheet.

### Tutorial path

| Step | What |
|------|------|
| 1a–c | Gold crate east · stick south · hat west (~6 tiles, pulse + arrow) |
| 1d–e | BAG equip · CRAFT bandage at HQ |
| 2 | Guide dog (tap; `_isGuideDog` survives dawn) |
| 3 | SLEEP at HQ |
| Free | Breach BP pink near north Wall · Wall cache east for mats |

### Characters

`neon_val`, `pretty_boy`, `shade`, `brick`, `doc_rue`, `static`, `boom`, `forge`, `needle`

---

## Still open (next session)

1. **Phone playtest findings** (user) — confirm camera, BAG, text overlaps on Mini
2. Remaining **text-on-text** if still visible after `23742a1`
3. **Fun / loop design** — what a good 15-min run feels like (highest design priority)
4. Pixel art (PixelLab) if wanted
5. GameScene further splits (FOW, HUD modules)
6. Custom domain on Vercel if wanted

---

## Key files

```
src/main.js                         Boot → Menu → CharacterSelect → Game
src/config/constants.js             TILE, T, GEAR, BLUEPRINTS, STACKABLE
src/config/characters.js            9 runners
src/config/art.js                   HUD_FONT, ZONE_TINT
src/scenes/GameScene.js             Explore + UI glue (large)
src/scenes/MenuScene.js             Title / day length / START RUN
src/scenes/CharacterSelectScene.js  Runner grid
src/scenes/mixins/combatMixin.js    Combat, specials, XP
src/scenes/mixins/cameraMixin.js    Free cam (no auto-follow)
src/scenes/mixins/sleepMixin.js     Sleep / ambush
src/systems/GuideDirector.js        Tutorial pulse / quests
src/systems/EscapeDirector.js       Post-tutorial escape beats
src/systems/HeatSystem.js           Grid heat pressure
src/systems/CraftPanel.js           Inline bench craft UI
src/systems/EquipUI.js              BAG (responsive tabs)
src/systems/Inventory.js            craft + stackable consumables
src/systems/CityGenerator.js        Map + hikes + Wall cache + BPs
src/systems/Minimap.js              Corner map + OBJ compass
src/systems/SaveSystem.js           localStorage
src/systems/RunLegacy.js            Meta escapes / KIA
scripts/playtest.mjs                Tutorial smoke + math + mobile bar checks
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
- Camera: **do not reintroduce auto-follow on every step** unless user asks.
- Mobile: BAG and MENU on **separate rows**; respect safe-area bottom.
- Playtest API: `window.__CITY_WARS__` (`debugState`, `debugWarp`, `dismissPopup`, …).
- **Prod URL:** `https://city-wars-rho.vercel.app`
- Push to `main` deploys; do not force-push.
- Prefer commit + push after each meaningful fix when user is in ship mode.

---

## Session wrap checklist

- [x] Heat / escape / art / craft stacking / mobile HUD on `main`
- [x] Camera auto-follow off; BAG safe-area / touch scroll mitigations
- [x] Playtest PASS (`23742a1`)
- [x] Vercel auto-deploy from push
- [x] AGENTS.md updated for next session
- [ ] Phone playtest findings from user (tomorrow)
- [ ] Remaining text-overlap cleanup if still present
- [ ] Design direction / loop feel (when user is ready)
