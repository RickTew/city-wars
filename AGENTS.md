# City Wars — Grok project (handoff)

**Primary agent:** Grok  
**Path:** `~/Dev/City Wars` (absolute: `/Users/ricktew/Dev/City Wars`)  
**Stack:** Phaser **4.2+ only** (never Phaser 3), Vite 6, pure client, procedural tiles  

| Remote | URL |
|--------|-----|
| **GitHub** | https://github.com/RickTew/city-wars (`main`, public) |
| **Play (prod)** | **https://city-wars-rho.vercel.app** (stable alias only) |
| **Vercel project** | `ricktew/city-wars` · auto-deploys on push to `main` |

**Version:** 3.8.x + menu atmosphere + 2-wide streets + readability pass  
**Last session HEAD:** `8b59252` (2026-07-21) · working tree clean after wrap  

---

## Resume next session with

```
Continue City Wars in ~/Dev/City Wars per AGENTS.md
```

```bash
cd ~/Dev/City\ Wars
npm install          # if needed
npm run dev          # http://localhost:5173/
# hard refresh: Cmd+Shift+R (phone PWA: clear site data / reinstall if stuck on old bundle)
npm run playtest     # needs Chrome + dev server up (menu click coords may need refresh)
# prod:
#   https://city-wars-rho.vercel.app
```

Flow: **Day length** → **START RUN** or **CONTINUE** → **Choose Runner** → **ENTER THE GRID**.

---

## Session wrap (2026-07-21) — atmosphere, streets, readability

**Status:** Phone playtest feedback landed. Menu felt flat; tutorial hard to see on phones; streets 1-wide made the runner fill the lane. Shipped atmosphere + audio + 2-wide roads, then a **readability hotfix** after user screenshots showed text-on-text again (runner select skyline bleed, log under action bar, speckled road art). Prefer live UI over guessing. Commit + push to `main` after each meaningful fix.

### Shipped this session (on `main`)

| Area | What |
|------|------|
| Title menu | Ruined skyline + fire/embers (`MenuBackdrop`); dark comedy tagline; amber CTAs |
| Audio | Procedural `AudioBus` menu intro (drone/siren/crackle); mute persists; `window.__PHASER_GAME__` for playtests |
| Mobile tutorial | Objective banner strip; soft cam hold to first loot; bigger beacons; Tap copy; guide toast above bar |
| Streets | **2-tile-wide** avenues (`CityGenerator` road bands); denser blocks |
| Readability hotfix | Solid runner select (no skyline under cards); larger contrast type; asphalt road tiles; guide toast depth above buttons |

### Key commits (2026-07-21)

| Hash | Summary |
|------|---------|
| `8b59252` | Fix text-on-text: readable runner select, raised guide toast, real asphalt roads |
| `a631db8` | Menu atmosphere, mobile tutorial fixes, and 2-wide streets |

### User feedback still live (do not ignore)

- **Verify on phone after PWA clear** that runner select + guide toast + roads look right on Mini
- Gameplay / fantasy / **15-min loop feel** still the big open design question
- Official `npm run playtest` menu click coords may miss new layout (boot via `__PHASER_GAME__` works)
- Prefer live screenshots over guessing; push decent fixes; no force-push `main`
- Do **not** Mini-only hacks — scale proportionally for all phones
- **Never** put busy backdrop art behind small UI text (lesson from this session)

When resuming: **ask what still feels broken after the readability deploy**, then prioritize loop feel / remaining overlaps.

---

## What the game is (current build)

Top-down **Escape-from-NY grit** city escape: scavenge, craft **Breach Kit**, leave via edge gold pads.

| System | Behavior |
|--------|----------|
| **Movement** | Click/tap path. WALK / RUN / SNEAK |
| **Camera** | **Free look** (no auto-center on walk). Edge-pan (desktop), middle-mouse drag, touch drag + pinch zoom |
| **Streets** | **2 tiles wide** every 6 tiles (+ HQ cross). Asphalt + curb art |
| **Alert** | CLEAR / CAUTION (HIDE) / COMBAT |
| **Heat** | GRID HEAT rises with noise/combat/outer zones; patrol + vignette at high heat |
| **Day-night** | Bar fills day, drains night. SHORT 8m / MED 15m / LONG 25m |
| **Sleep** | Free at HQ (blocked if heat ≥ 88). Away needs Sleeping Kit |
| **Craft** | Pink BPs → purple Street Rig. Inline docked panel; keys 1–6 at bench; auto-open near bench |
| **BAG** | Paper-doll + GEAR\|MATS\|CRAFT tabs. Stacked on phone. Pauses time |
| **HEAL** | Bandage → Stim → MRE (stackable). Button shows `HEAL×n`. Else Street Charge |
| **Combat specials** | SPEC · long-press map · right-click desktop |
| **Tutorial** | SIGNAL BOOT modal + gold pulse; micro-steps via **guide toast** above action bar |
| **Save** | `localStorage` `city_wars_save_v1` |
| **Legacy** | `city_wars_legacy_v1` escapes / KIA |
| **Minimap** | Top-right + OBJ compass (also during tutorial) |
| **PWA** | Manifest + icons + safe-area insets. **Clear site data** after deploys if stuck |

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
| Boot | SIGNAL BOOT popup → guide toast QUEST 1 |
| 1a–c | Gold crate east · stick south · hat west (~6 tiles, pulse + arrow) |
| 1d–e | BAG equip · CRAFT bandage at HQ (toast each step) |
| 2 | Guide dog (tap; `_isGuideDog` survives dawn) |
| 3 | SLEEP at HQ |
| Free | Breach BP pink near north Wall · Wall cache east for mats |

### Characters

`neon_val`, `pretty_boy`, `shade`, `brick`, `doc_rue`, `static`, `boom`, `forge`, `needle`

---

## Still open (next session)

1. Confirm readability + roads on phone after PWA clear (`8b59252`)
2. **Fun / loop design** — what a good 15-min run feels like (highest design priority)
3. Fix / refresh `scripts/playtest.mjs` menu click path for new layout
4. Pixel art (PixelLab) if wanted
5. GameScene further splits (FOW, HUD modules)
6. Custom domain on Vercel if wanted

---

## Key files

```
src/main.js                         Boot → Menu → CharacterSelect → Game (__PHASER_GAME__)
src/config/constants.js             TILE, T, GEAR, BLUEPRINTS, STACKABLE
src/config/characters.js            9 runners
src/config/art.js                   HUD_FONT, ZONE_TINT
src/scenes/GameScene.js             Explore + UI glue (large); showGuideToast
src/scenes/MenuScene.js             Title / day length / START RUN + intro audio
src/scenes/CharacterSelectScene.js  Runner grid (solid dark, high contrast)
src/scenes/mixins/combatMixin.js    Combat, specials, XP
src/scenes/mixins/cameraMixin.js    Free cam (no auto-follow)
src/scenes/mixins/sleepMixin.js     Sleep / ambush
src/systems/MenuBackdrop.js         Title-only ruined city / fire backdrop
src/systems/AudioBus.js             Procedural SFX + menu intro
src/systems/GuideDirector.js        Tutorial pulse / quests
src/systems/EscapeDirector.js       Post-tutorial escape beats
src/systems/HeatSystem.js           Grid heat pressure
src/systems/CraftPanel.js           Inline bench craft UI
src/systems/EquipUI.js              BAG (responsive tabs)
src/systems/Inventory.js            craft + stackable consumables
src/systems/CityGenerator.js        Map + 2-wide roads + hikes + Wall cache + BPs
src/systems/TileArt.js              Asphalt roads, sidewalks, neon tiles
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
- Streets stay **2-wide**; do not shrink back to 1-tile lanes without asking.
- UI text: solid opaque plates behind copy; **no busy backdrop under small type**.
- Guide / log toasts: depth **above** action bar (200+), not under buttons.
- Playtest API: `window.__CITY_WARS__` + `window.__PHASER_GAME__`.
- **Prod URL:** `https://city-wars-rho.vercel.app`
- Push to `main` deploys; do not force-push.
- Prefer commit + push after each meaningful fix when user is in ship mode.

---

## Session wrap checklist

- [x] Menu atmosphere + intro audio on `main`
- [x] 2-wide streets + denser blocks
- [x] Mobile tutorial visibility (banner / soft cam / toast)
- [x] Readability hotfix (runner select + asphalt + toast depth)
- [x] Pushed `8b59252` · Vercel auto-deploy
- [x] AGENTS.md updated for next session
- [ ] User confirms phone/PWA after hard clear
- [ ] Loop feel / fantasy pass (when user is ready)
