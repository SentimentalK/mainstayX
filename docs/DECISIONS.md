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
