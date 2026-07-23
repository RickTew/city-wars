# City Wars — cross-session memory (agent)

## Hard user requirements

1. **ENTIRE game = nice looking text.** DomUi (not Phaser Text under pixelArt).
2. Do **NOT** disable pixelArt or use global antialias to “fix” type.
3. City already fell — no police sirens; sample ambience; sparse gaps; no cheer/clap yells.
4. No orphan props (random neon / joke signs).
5. **Workflow:** commit + push `main` + playtest after major work.
6. **CENTRAL** = HQ AI voice (sarcastic, helpful, low faith). Five-item recovery mission.
7. **HOME** = tutorial only (not a colored combat ring). Combat rings: Yel→Red.
8. Day/night = sun cycle speed only — **not** a timed run loop.

## Canonical docs

- `AGENTS.md` — handoff / resume / session wrap  
- `TEXT-STRATEGY.md` — DOM text  
- `VISUAL-STYLE.md` — split-brain visual  
- `src/systems/HqVoice.js` — CENTRAL + MISSION_FIVE  

## Next session start

Pixel prop path first: crate closed/open, Street Rig workbench, runner idle, dog — then wire on TILE=64 board + Style Lab. Keep CENTRAL voice when adding copy.
