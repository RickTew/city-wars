# City Wars — Grok project (handoff)

**Primary agent:** Grok  
**Path:** `~/Dev/City Wars` (absolute: `/Users/ricktew/Dev/City Wars`)  
**Stack:** Phaser **4.2+ only** (never Phaser 3), Vite 6, pure client, procedural tiles  

| Remote | URL |
|--------|-----|
| **GitHub** | https://github.com/RickTew/city-wars (`main`, public) |
| **Play (prod)** | **https://city-wars-rho.vercel.app** (stable alias only) |
| **Vercel project** | `ricktew/city-wars` · auto-deploys on push to `main` |

**Version:** 3.6.0 + PWA icons  
**Last session HEAD:** `7d4917f` (2026-07-14) · tutorial/mobile MORE+SPEC on main  

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
# prod after push:
#   https://city-wars-rho.vercel.app
```

Flow: **Day length** → **START RUN** or **CONTINUE** → **Choose Runner** → **ENTER THE GRID**.

---

## What the game is

Top-down **Escape-from-NY grit** city escape: scavenge, craft **Breach Kit**, leave via edge gold pads.

| System | Behavior |
|--------|----------|
| **Movement** | Click/tap path. WALK / RUN / SNEAK. Left-click/tap enemies to fight |
| **Camera** | Follow + mouse **edge-pan** + **middle-mouse drag** (desktop) |
| **Alert** | CLEAR / CAUTION (HIDE) / COMBAT |
| **Day-night** | Bar fills day, drains night. SHORT 8m / MED 15m / LONG 25m |
| **Sleep** | Free at HQ. Away needs Sleeping Kit. Night away = ambush risk |
| **Craft** | Pink BPs → purple Street Rig. Bandage free in tutorial. **craftBonus** may refund a mat |
| **BAG** | Paper-doll HEAD/BODY/LEGS/WEAPON/QUICK1/2. Pauses time |
| **HEAL** | Bandage → Stim → MRE. Else **Street Charge** (Boom AOE) |
| **MENU** | Mute, narrator, **SAVE RUN**, NEW RUN, help |
| **Combat specials** | **SPEC** button · **long-press** map · **right-click** (desktop): Power / Charge / Flee |
| **XP** | Kills → XP. Level: +4 max HP + heal; odd levels +1 ATK |
| **Save** | `localStorage` key `city_wars_save_v1`. Main menu **CONTINUE** |
| **Minimap** | Top-right. Post-tutorial **OBJ** compass left |
| **PWA** | Manifest + icons. Add to Home Screen from prod URL |

### Tutorial path (hikes, not pile at feet)

| Step | What |
|------|------|
| 1a–c | Gold crate east ~6 · stick south ~6 · hat west ~6 (pulse + OBJ arrow) |
| 1d–e | BAG equip · CRAFT bandage at HQ purple rig |
| 2 | Left-click guide dog (`_isGuideDog` survives dawn) |
| 3 | SLEEP at HQ |
| Free | Breach BP pink near north Wall |

### Characters

`neon_val`, `pretty_boy`, `shade`, `brick`, `doc_rue`, `static`, `boom`, `forge`, `needle`  
Select cards show mechanical bonuses (ATK/SNEAK/CRAFT/BOOM…).

---

## Shipped this arc (3.5 → 3.6 → PWA)

### 3.5 polish
- batBonus live only (no craft double-count)
- Story intro matches guide
- Stick/hat distinct tiles, legend, runner bonus cards
- craftBonus refunds; rags / jacket / charge crafts
- MRE consumable; Street Charge; combat VFX
- MENU mid-run

### 3.6 systems
- Mixins: `combatMixin`, `cameraMixin`, `sleepMixin`
- Right-click specials, enemy silhouettes, minimap, save/continue, XP

### Deploy + PWA
- GitHub `RickTew/city-wars` + Vercel prod alias
- Fun skyline **CW** icon set under `public/icons/`

---

## Still open (next session priorities)

1. **Mobile-friendly pass** (tutorial + MORE + SPEC shipped; further polish open)
   - Narrow bar uses MORE (SNEAK / WALK / MENU / MAP)
   - Combat: **SPEC** button + **long-press** map for specials (right-click still works)
   - Optional later: two-row HUD, pinch zoom
2. **Pixel art** (PixelLab) when wanted
3. Further **GameScene** splits (craft UI, FOW)
4. Custom domain on Vercel if wanted
5. Grok TUI idle purple (user: still blinks when idle — outside this repo)

---

## Key files

```
src/main.js                         Boot → Menu → CharacterSelect → Game  (v3.6.0)
src/config/constants.js             TILE, T (GEAR_STICK/HAT), GEAR, BLUEPRINTS
src/config/characters.js            9 runners
src/scenes/GameScene.js             Explore + UI glue (~2.6k)
src/scenes/mixins/combatMixin.js    Combat, specials, XP on kill
src/scenes/mixins/cameraMixin.js    Edge pan / free cam
src/scenes/mixins/sleepMixin.js     Sleep / ambush
src/systems/GuideDirector.js        Tutorial pulse / quests
src/systems/EquipUI.js              BAG
src/systems/Inventory.js            craft + craftBonus, consumables
src/systems/CityGenerator.js        Map + hikes + BPs
src/systems/SaveSystem.js           localStorage save/load
src/systems/Progression.js          XP / level
src/systems/Minimap.js              Corner map + OBJ compass
src/entities/Actor.js               Player + dog/thug/enforcer/drone
public/icons/                       PWA SVG + PNG 180/192/512
public/manifest.webmanifest
scripts/playtest.mjs                Tutorial smoke + math checks
scripts/render-icons.mjs            Re-rasterize icons (needs @resvg/resvg-js)
AGENTS.md                           This handoff
```

---

## Conventions (do not regress)

- **Phaser 4 only.** Never Phaser 3.
- Mouse-first (mobile pass is next).
- Player-facing copy: **no em/en dashes** (periods or hyphens).
- Popups / craft / legend / bag / menu / specials → `isPaused`.
- Clear mouse path on open/close modals.
- Guide hikes ~6 tiles (on-screen + in vision); pulse + edge beacon + OBJ compass during tutorial; guide dog `_isGuideDog` not culled at dawn.
- Tutorial boot: one SIGNAL BOOT card (no DISTRICT READ first); coach steps are toasts not modals.
- Combat uses `inv.totalDef` for player; bat/ranged bonuses **live only**.
- HEAL: bag or QUICK; bandage → stim → mre → charge.
- Save: `city_wars_save_v1`. CONTINUE → `registry.loadSave = true` → Game.
- Playtest API: `window.__CITY_WARS__` (`debugState`, `debugWarp`, `dismissPopup`, `playerEffectiveAtk`).
- **Prod URL for users:** `https://city-wars-rho.vercel.app` (not the `fm8r…` deploy hash URLs).
- Push to `main` deploys; do not force-push.

---

## Recent commits

| Hash | Summary |
|------|---------|
| `7b14dc8` | PWA icons + web manifest |
| `8ac483d` | Handoff GitHub + Vercel URL |
| `7b4788d` | 3.6 mixins, specials, XP, save, minimap |
| `78a8315` | 3.5 scan polish |

---

## Session wrap checklist

- [x] Code on `main` + pushed to GitHub
- [x] Vercel production live
- [x] PWA icons for Add to Home Screen
- [x] AGENTS.md updated for next session
- [x] Playtest was PASS on 3.6 (re-run after large mobile changes)
- [ ] Next: mobile UX pass (recommended first)
