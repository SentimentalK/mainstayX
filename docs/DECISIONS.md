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
- **Characters are models, workstations are tools.** The cast comes from `AGENT_PROFILE`s, not a list
  in the world: `world/roster.ts` puts every `onStage` agent with a tool on stage (Claude first),
  treats anything in some profile's `summons` as a sub-agent, and everything else that's off stage as
  benched (Codex, Qwen, Kimi). On stage: Claude (Claude Code), GPT (Codex), Grok (Cursor), Gemini
  (Antigravity), GLM and DeepSeek (OpenCode). Homes are two per flank and two in front, DeepSeek
  front-centre below its big cousin.
- **Portable desks** (`world/desks.ts`). With a job, an agent first looks for a free seat at a desk
  of *its own tool* within ~100 px; failing that it tosses the crate out of its pocket (an arc drawn
  with `drawPocketCube`, 1 toss in 8 bonks it on the head first), the crate lands with dust, unfolds
  (`drawStation` unfold 0→1) and the agent's own seat is right where it stood. A desk has 4 seats:
  two ends on the floor at `cx ∓ (w/2 + 6)` and two behind it at `cx ∓ 17`, where a 2× agent stands
  at `by − 6` (drawn before the desk, which hides its legs) and a 1× sub-agent hops onto the desktop
  at `by − 14` (drawn after it: `Agent.depth`). 2× agents prefer the ends, sub-agents the desktop.
  Desks go anywhere a "plot" (desk + seated agents) fits: inside the floor, off Orca's keep-out
  ellipse and its sprite/label box (`ORCA_VIS`), clear of every other plot, and high enough that
  names under the end seats stay on screen. Empty for 3.5–6.5 s → it folds and flies into its owner's
  pocket (or the nearest agent of that tool), or poofs if nobody's around. Nameplates are drawn on
  the text layer at `platePos` once `unfold ≥ PLATE_READY`. Seats are only taken through
  `Desks.reserve`, which refuses another tool's desk, so the "never at another tool's desk / never
  two in a seat" rule holds by construction; a seat stays reserved while its agent is pulled into a
  skit, and it walks back afterwards.
- **Jobs** (`world/jobs.ts`): S 52%, M 30%, L 18% (L only for agents that can summon, one at a time).
  The packet grows with the size (medium glows, large is 2×, pulsing, with a sparkle trail and
  confetti on arrival; Orca calls "big one!"). Small: work alone. Medium: 2–4 sub-agents, large:
  6–10 (capped at 12 alive across all jobs). Claude summons its own `mini`s onto Claude Code desks:
  its own desk first, then new ones *it* throws. GPT, Grok and Gemini summon OpenCode sub-agents
  (`glmMini` / `deepseekMini`) who throw OpenCode desks next to the caller (or join an OpenCode desk
  nearby, e.g. GLM's) and never sit at the caller's desk. GLM and DeepSeek have no `summons`, so they
  always work alone. Sub-agents poof in (staggered), work, send a result packet back along a peer
  link (the summoner counts `3/8`), then poof out; the summoner waits for the last one and then
  delivers to Orca. A job has a 55 s hard limit; sub-agents of a finished job are poofed within 2 s.
  Orca runs at most 3 jobs at once.
- **Offline**: an agent that idles a while may go offline (max 2 at once): `brb`/`afk`, sleep anim,
  dimmed, `zzz` and a little striped nightcap. Orca only dispatches to an offline agent when nobody
  else is free; the packet jolts it awake, it stretches (`*yawn*`), then takes the job. Clicking an
  offline agent wakes it too.
- **Working is for show**: typing sparks and a busy screen, plus random business at the desk
  (icons, mutters, a hop, and after a while `@_@` dizziness). A summoner whose own part is done
  looks around impatiently until its sub-agents report.
- **Invariant audit** (`world/audit.ts`, `window.__mxWorld.audit()`): seat tool = agent tool, seat ↔
  agent bookkeeping, ≤ 4 per desk, desks not overlapping each other / Orca's keep-out zone / Orca's
  box, no benched character on stage, sub-agents tied to a live job (or one that ended < 4 s ago)
  and summonable by their summoner, and working agents actually in their seat. With `?debug=1` it
  runs every sim second and `console.error`s each violation; `scripts/verify.mjs` checks it in the
  world soak. Other test hooks: `__mxWorld.job(size, id?)`, `.offline(id)`, `.trigger(name)`, `.skits()`.

## Skits
- **17 skits.** Kept: lost & found, dropped packet, collision, meeting, relay, celebration, bug
  hunt, code review, context overflow (now Gemini is the one that rarely overflows: "2M ctx?! not
  enough??"), coffee run, merge conflict and whale song. Removed: `summon-subagents` (sub-agents
  are now part of real jobs) and `nap` (replaced by offline agents and the desk nap).
- **New workstation skits** (they only cast while someone is at a desk, otherwise the scheduler
  falls through to the others): **back to work** (a worker sneaks off toward something shiny; a
  free colleague, preferably Claude, drags it back by the ear, "ow ow ow", or Orca yells BACK TO
  WORK and reels it in on a tether), **desk fold** (the desk creaks and snaps shut on whoever is at
  it; a kick and it springs back open, "unsaved..."), **desk nap** (falls asleep at the desk with a
  `z` screensaver; one of its sub-agents pokes it or Orca pings), **swarm chaos** (during a big
  job the sub-agents abandon their desks and zoom around bonking into each other until the summoner
  or Orca yells SIT DOWN) and **wrong desk** (an idle agent tries a free seat at another tool's desk,
  which flashes red, WRONG IDE!, and bounces it off; nobody actually sits).
- Scheduler unchanged: weighted pick + per-skit cooldown + 4.5–8 s gap between starts, at most 2 at
  once (second one only 40% of the time), staleness boost, hard timeouts. New skits weigh 2–3 with
  30–45 s cooldowns, like the old ones.
- **Labels**: every agent's name is shown dimly, the hovered one brightly with a cyan outline
  (sub-agents have none, and an agent standing behind a desk hides its name so it doesn't sit on
  the nameplate). Orca pauses dispatching during meetings.

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
- Brand is written **MAINSTAYX** (no underscore). Blog in the nav goes to
  x.com/SentimentalK229 for now (About was dropped: it pointed to the same place), so the on-site blog/about pages and the home "Writing" section were
  removed (restore from git history when the blog moves on-site). Projects list = public repos with a
  live homepage on the homelab, plus Echolet and the homelab itself; internal tools (tracking, n8n,
  LifeOS MCP) and the Avalon Tunnel decoy host are deliberately left off.
- **Orca speaks "pod"**: orcas live in pods, and so do Kubernetes workloads. Orca's own lines are
  pod calls and clicks (`pod up!` / `swim!` to start/end a meeting, `fan out!` / `all pods!` for big
  jobs, `*CLICK* back!`, `*click*`, `*CLICK CLICK*`) instead of office talk like "standup!" and
  "break!". The agents keep talking like developers; the whale-song duet keeps its whale song.
