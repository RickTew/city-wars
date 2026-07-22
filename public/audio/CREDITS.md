# Ambient SFX credits

Samples under `ambient/` are free Mixkit sound-effect previews used under the
[Mixkit Free License](https://mixkit.co/license/#sfxFree) (free for commercial
and non-commercial use; no attribution required, still credited here for clarity).

Banks: dogs, howls, guns, explosions/impacts, screams, cyber/glitch.  
(Cheer/clap “yell” samples removed — wrong tone for a fallen city.)

Loaded by `src/systems/AudioBus.js`. Playback varies **distance** (gain + lowpass),
**pitch** (e.g. dog size), **echo** (canyon delay), and **anti-repeat** (recent
files avoided) so the same source rarely sounds identical twice.
