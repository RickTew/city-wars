# City Wars — Grok project (handoff)

**Primary agent:** Grok  
**Path:** `~/Dev/City Wars` (absolute: `/Users/ricktew/Dev/City Wars`)  
**Stack:** Phaser **4.2+ only** (never Phaser 3), Vite 6, pure client, procedural tiles  
**Git:** local `main` only. **Do not push / Vercel deploy unless user asks.**

**Version:** 3.6.0  
**Last session HEAD:** see git log  
**Working tree:** commit after wrap.

---

## Resume

```bash
cd ~/Dev/City\ Wars
npm run dev        # http://localhost:5173/
npm run playtest   # Chrome + dev server
```

Flow: **Day length** → **START RUN** or **CONTINUE** → runners → game.

---

## What shipped in 3.6

| Feature | Notes |
|---------|--------|
| **GameScene split** | Mixins: `combatMixin`, `cameraMixin`, `sleepMixin` under `src/scenes/mixins/` |
| **Right-click specials** | Combat: Power Strike (+50%), Street Charge, Flee 60% |
| **Enemy silhouettes** | Thug / Enforcer / Drone / Dog (not colored squares) |
| **Minimap** | Top-right. Post-tutorial OBJ compass left |
| **Save / Continue** | MENU → SAVE RUN. Main menu CONTINUE via `localStorage` (`city_wars_save_v1`) |
| **XP / levels** | Kills grant XP. Level: +4 max HP, heal 4; odd levels +1 ATK |

### Still open

1. Pixel art (PixelLab) when wanted  
2. Push + Vercel only when user asks  
3. Further GameScene splits (craft UI, FOW)  
4. TUI idle purple (user: last config did not work — revisit outside game)

---

## Architecture (key files)

```
src/scenes/GameScene.js           Glue + explore / UI (~2.6k after split)
src/scenes/mixins/combatMixin.js  Combat + specials + XP on kill
src/scenes/mixins/cameraMixin.js  Edge pan / free cam
src/scenes/mixins/sleepMixin.js   Sleep / ambush / isAtHomeBase
src/systems/Progression.js        XP / level
src/systems/SaveSystem.js         serialize / apply localStorage
src/systems/Minimap.js            Corner map + OBJ compass
src/entities/Actor.js             Player + dog/thug/enforcer/drone looks
```

---

## Conventions (do not regress)

- Phaser 4 only. Mouse-first. No em/en dashes in player copy.
- Popups / craft / legend / bag / menu / **specials** pause (`isPaused`).
- Guide dog `_isGuideDog` survives dawn cull.
- batBonus / rangedBonus **live only** (never bake into gear.atk).
- Save key: `city_wars_save_v1`. CONTINUE sets `registry.loadSave = true` → Game.
- Playtest: `window.__CITY_WARS__` (`debugState`, `debugWarp`, `dismissPopup`, `playerEffectiveAtk`).

---

## Session wrap checklist

- [ ] Commit on `main`
- [ ] AGENTS.md updated
- [ ] No remote push
- [ ] `npm run playtest` PASS
