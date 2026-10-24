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
  small pose "rig" (`src/hero/sprites/art/rig.ts`). Codex became a terminal-on-a-stand whose screen is
  its face (`>_`, `^ ^`, `x x`); Kimi a ghost whose hem ripples when walking; Gemini's sparkle
  lags and twinkles. Orca was mirrored to face right like every other sprite.
- `mini` is its own 9×6 matrix drawn at 1×, not a scaled-down Clawd.
- **GLM and DeepSeek** joined later (`src/hero/sprites/art/newcomers.ts`). GLM is a navy visor-bot with a
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
  `src/hero/audio/song.ts`; the format is documented at the top of that file.
- While muted the music keeps running silently, so unmuting resumes in place.
- Every sfx is rate-limited per name and voices are capped, so busy skits can't get loud.

## Deploy
- Image listens on **8080 as the unprivileged `nginx` user** (k8s `runAsNonRoot`), serves
  `/healthz` for probes. Base `nginx:stable-alpine`.
- Ingress defaults to `ingressClassName: traefik` (k3s' built-in controller).
- **Deployed the homelab way, copying `ceo-web`** (the other nginx static site on 8080 with
  `/healthz`). The manifests live in `k3s-homelab/apps/mainstayx/` and the ArgoCD Application
  in `apps/mainstayx-app.yaml`; ArgoCD auto-syncs them. The placeholder `deploy/k8s/` here was
  deleted so there aren't two copies to drift apart. CI publishes multi-arch
  `ghcr.io/sentimentalk/mainstayx:latest` (the nodes are a mix of arm64 and amd64), and the
  Deployment uses `imagePullPolicy: Always` with no image updater, so a release goes live on
  `rollout restart`, as it does for the other apps. Pinned to `arm64`/`mtl0` like `ceo-web`.
- The pod sets `runAsUser: 101` explicitly: `runAsNonRoot` refuses an image whose `USER` is the
  name `nginx` because it can't prove the user isn't root. It also has a read-only root
  filesystem with in-memory `emptyDir`s for `/tmp` (pid) and `/var/cache/nginx`. The Dockerfile
  is unchanged.
- **No apex redirect yet.** No homelab app redirects between hosts (no Traefik `Middleware`
  anywhere), so only `www.mainstayx.com` is routed. To add `mainstayx.com` → `www`, either use a
  redirect rule at the DNS provider or add a Traefik `redirectRegex` Middleware plus a second
  host on the Ingress.

## Site shell (Astro)
- The landing page grew into a site (projects, blog, about), so the app moved to **Astro with
  static output**: Vite under the hood (the hero code moved over unchanged into `src/hero/`),
  Markdown content collections for posts and projects, and still plain files in `dist/` for nginx.
- The hero is one section of the home page (`components/Hero.astro` → `mountHero(el)`). Its stage
  fits the **section**, not the window: integer scale when that fills ≥ 90% of the box, otherwise
  fractional (at 3× and up uneven pixels are hard to see). The section is
  `min(100svh − nav, 56.25vw)` tall, so it never shows wide bars above/below the 16:9 stage.
- It pauses (loop + music) when scrolled out of view, and `Esc`/`M` only act while it's on screen
  and focus isn't in a form field.
- During the intro phases the nav dims to 40% (hover/focus restores it) so it doesn't compete with
  the door, but stays usable.
- nginx: hashed assets are under `/_astro/`; unknown paths now get `404.html` instead of falling
  back to the home page.
- Door sign reads `MEET MY AI TEAM` (`SIGN_TEXT` in `scenes/intro/layout.ts`); the sign box is 82 px
  wide to fit it.
