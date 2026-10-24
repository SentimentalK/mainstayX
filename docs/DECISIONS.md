# Decisions

Calls made while building without being able to ask. Principle: flashier,
smoother, simpler.

## Process
- **Pushed straight to `main`, no PR.** The prompt asked for `feat/synthwave-landing` + a PR;
  the owner later said to push directly and skip the PR, so work lands on `main`
  (and on the session branch `claude/clever-bohr-doxazi`).

## Engine
- **Text is drawn on a hi-res overlay canvas in Silkscreen**, not as DOM nodes and not as a
  bitmap font inside the 320×180 buffer. Matches the approved reference (HTML Silkscreen text),
  stays crisp at any scale, ends up in screenshots, and costs no DOM churn. Font sizes snap to
  Silkscreen's 8-unit grid so glyph pixels stay square. The font is self-hosted via
  `@fontsource/silkscreen` (no Google Fonts request).
- **Fixed 60 Hz simulation step**, render once per animation frame. Makes `?seed=` runs
  reproducible regardless of display refresh rate. `?speed=n` multiplies sim time for testing.
- **Integer scaling**; viewports narrower than 320 px fall back to fractional scale so phones
  still show the whole scene.
- **Bloom** = the reference approach (blurred copy, `mix-blend-mode: screen`), refreshed every
  other frame.
- **Audio unlock on any first gesture.** Returning visitors land directly in WORLD with no click,
  so BGM starts on their first click/key anywhere (browsers forbid earlier).
- **HUD buttons** (skip / replay / mute) live inside the letterboxed stage, not the viewport
  corner, so they sit on the artwork. `Esc` skips, `M` toggles mute.

## Intro
- **Knocking counts anywhere on the stage**, not only on the door: less frustrating, and the
  `KNOCK!` popups still appear around the door (alternating sides). Enter/Space knocks too.
- **Status light has 3 segments** that turn cyan → pink, one per knock, so progress is visible.
- **Light cone is peach-pink**, not the reference yellow: yellow at low opacity over the purple
  ground turned olive.
- **Clawd emerges as a silhouette** against the glare and gains colour as he walks out, then
  fades back into the light.
- Timings: OPEN ≈ 1.2 s, GREET ≈ 3.5 s, WARP ≈ 2.8 s (zoom into the doorway 0.75 s, then tunnel).

## Sprites
- Original silhouettes, sizes and palettes kept; everything else got animation frames via a
  small pose "rig" (`src/sprites/art/rig.ts`). Codex became a terminal-on-a-stand whose screen is
  its face (`>_`, `^ ^`, `x x`); Kimi a ghost whose hem ripples when walking; Gemini's sparkle
  lags and twinkles. Orca was mirrored to face right like every other sprite.
- `mini` is its own 9×6 matrix drawn at 1×, not a scaled-down Clawd.
- **GLM and DeepSeek** joined later (`src/sprites/art/newcomers.ts`). GLM is a navy visor-bot with a
  "Z" bolt antenna (boxy, tallest at 12×14, so it can't be mistaken for Gemini's star blob or Qwen's
  bean); DeepSeek is a 13×12 blue whale with an up-curled fluke, blush and a tiny spout, so it reads
  as Orca's little cousin rather than a second Orca. Both have `project: null` for now.

## World
- **14 skits** — the 8 from the brief plus bug hunt, code review (`lgtm` stamp), context overflow
  (`where's my ctx??` with flying pages), coffee run, merge-conflict tug-of-war and whale song
  (DeepSeek swims up to Orca, they trade sonar calls, then a spout duet: the cousin's first try is a
  dribble, the second meets Orca's jet in a rainbow).
- **7 agents + Orca**: homes are three per flank with DeepSeek front-centre below Orca; meetings
  have one seat per agent (7).
- Scheduler: weighted pick + per-skit cooldown + 4.5–8 s gap between starts, at most 2 at once
  (second one only 40% of the time); skits that haven't run for a while get boosted weight;
  every skit has a hard timeout that releases its actors.
- **Labels**: every agent's name is shown dimly, the hovered one brightly with a cyan outline.
  The approved reference labelled everyone, but at full brightness it got cluttered.
- Orca dispatches to at most 2 agents at a time, picking whoever has idled longest, and pauses
  dispatching during meetings.

## Audio
- A-minor, 108 BPM, 32-bar loop (≈71 s): intro / A / B / breakdown / A′. Tune lives in
  `src/audio/song.ts`; the format is documented at the top of that file.
- While muted the music keeps running silently, so unmuting resumes in place.
- Every sfx is rate-limited per name and voices are capped, so busy skits can't get loud.

## Deploy
- Image listens on **8080 as the unprivileged `nginx` user** (k8s `runAsNonRoot`), serves
  `/healthz` for probes. Base `nginx:stable-alpine`.
- Ingress defaults to `ingressClassName: traefik` (k3s' built-in controller).
