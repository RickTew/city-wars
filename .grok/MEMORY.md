# City Wars — cross-session memory (agent)

## Hard user requirements

1. **ENTIRE game = nice looking text.** Not menus only. HUD, craft (STREET RIG), objective, buttons, bag, combat all count.
2. **Cause:** Phaser Text + `pixelArt: true` = chunky type. **Fix:** DOM via `DomUi.js` (DungeonHole/AstroHold same).
3. **Do NOT** disable pixelArt globally or antialias to fix text.
4. City already fell — no police sirens; sample ambience; sparse gaps.
5. No orphan props (random neon lines / OPEN on skyscrapers).

## Canonical docs

- `TEXT-STRATEGY.md` — text migration checklist (NEXT SESSION #1)
- `VISUAL-STYLE.md` — split-brain visual
- `AGENTS.md` — handoff / resume prompt

## Next session start

DomUi HUD/craft/bag done. Priority: pixel prop overlays on procedural board
(crates, workbench, junk piles, characters) per VISUAL-STYLE hybrid model;
default zoom + tile readability polish; 15-min loop feel.
