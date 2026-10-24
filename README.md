# MAINSTAYX

Personal site. The home page opens on a synthwave pixel-art door: knock three
times, Clawd says hi, the camera warps through the door, and you land in a busy
little world of AI agents dispatched by Orca, with a live-synthesised chiptune
soundtrack. Below it is a projects section (also its own page); the nav's Blog
goes to X.

Astro (static output) for the site; the hero is plain TypeScript + Canvas2D
(320×180, scaled to fit its section) + WebAudio. No game framework, no audio
files, no images besides the favicon.

## Develop

```sh
npm install
npm run dev          # http://localhost:4321
npm run typecheck    # astro check (.astro + .ts)
npm run build        # type-check + static build into dist/
npm run preview      # serve dist/ locally
npm run verify       # Playwright screenshots + 60 s world soak (needs a running dev/preview server, see below)
```

URL parameters (handy while developing):

| Param | Effect |
|---|---|
| `?scene=door\|warp\|world` | jump straight to a scene (`sheet` shows every sprite + animation) |
| `?seed=123` | reproducible random behaviour |
| `?speed=4` | run the simulation faster (debug) |
| `?debug=1` | fps / phase overlay |

Every visit plays the intro (knock, Clawd says hi, warp); the world behind the
door opens on a different random moment each time. `skip ▸` / `Esc` skips the
intro, `↺ replay intro` replays it from the world, the `♪` button / `M` toggles sound (stored
in `mx.muted`). `prefers-reduced-motion` goes straight to the world with
gentler animation.

## Content

- **Projects**: one Markdown file per project in `src/content/projects/`
  (`title`, `blurb`, `status`, optional `url`, `github`, `agent`, `order`).
- Schemas live in `src/content.config.ts`; a typo in front matter fails the build.

## Docker

```sh
docker build -t mainstayx:latest .
docker run --rm -p 8080:8080 mainstayx:latest   # http://localhost:8080
```

Multi-stage: `node:22-alpine` builds, `nginx:stable-alpine` serves `dist/` on
port 8080 as the unprivileged `nginx` user. `nginx.conf` gzips, caches hashed
`/_astro/*` for a year, revalidates every page, serves `404.html` for unknown
paths and answers `/healthz`.

## Deploy (k3s)

Production: **https://www.mainstayx.com**, on the owner's K3s homelab
(GitOps repo [`SentimentalK/k3s-homelab`](https://github.com/SentimentalK/k3s-homelab)).
Same flow as the other homelab apps:

1. **Image.** `.github/workflows/image.yaml` builds the Dockerfile and smoke-tests
   it (`/healthz`, every page, a hashed asset, a 404, relative redirects) on every
   push and PR. Every **push** (any branch) also publishes a multi-arch
   (`linux/amd64,linux/arm64`) image to GHCR as `:sha-<short>` and `:<branch>`;
   only `main` moves `:latest`, which is what production runs. The cluster has no
   pull secret, so the GHCR package must be **public**.
2. **Manifests.** They live in the homelab repo, not here:
   `apps/mainstayx/` (namespace, Deployment, Service, Ingress) plus the ArgoCD
   Application `apps/mainstayx-app.yaml`. ArgoCD auto-syncs (prune + self-heal)
   from that repo's `master` branch.
3. **Ingress/TLS.** Traefik (`ingressClassName: traefik`) routes
   `www.mainstayx.com` to the Service on 8080; cert-manager's `letsencrypt-prod`
   ClusterIssuer (HTTP-01) issues the `mainstayx-tls` certificate.
4. **Rollout.** The Deployment tracks `:latest` with `imagePullPolicy: Always`
   and there is no image updater, so a new image goes live on the next pod
   restart:

```sh
kubectl -n mainstayx rollout restart deployment/mainstayx
```

The pod is pinned to the arm64 node `mtl0` (like `ceo-web`), runs as uid 101
with a read-only root filesystem, and mounts in-memory `emptyDir`s at `/tmp`
(nginx pid) and `/var/cache/nginx`. The bare `mainstayx.com` is not routed: the
homelab has no apex→www redirect yet (see `docs/DECISIONS.md`).

## Layout

```
src/
  pages/             routes: index, projects/, 404
  layouts/Base.astro shared <head>, nav, footer
  components/        Nav, Footer, Hero (mounts the pixel scene), ProjectCard
  content/           projects/*.md (schema in content.config.ts)
  lib/content.ts     collection queries
  styles/global.css  site tokens + base styles
  hero/              the pixel-art scene, framework-free
    mount.ts         mountHero(el): display, HUD buttons, director
    types.ts         shared contracts between modules
    engine/          loop + scene director (state machine), display (fits its container,
                     bloom, scanlines), text overlay, pixel draw helpers, particles, rng, easing
    scenes/          intro (door → knock → open → greet), warp, world, sheet (debug)
    sprites/         pixel matrices (defs) + cached renderer
    audio/           WebAudio synth, sequencer, BGM, sound effects
    world/           agent state machines, skit scheduler, links/packets, backdrop
    data/            agent profiles (projects/links), palette
design/              approved static style reference + the original build brief
docs/                PLAN.md (architecture), DECISIONS.md (judgement calls)
.github/workflows/   image.yaml: build, smoke-test, publish multi-arch image to GHCR
```

The hero pauses (loop and music) whenever it's scrolled out of view or the tab
is hidden, and its keyboard shortcuts only fire while it's on screen.

Clicking an agent calls `openAgent()` in `src/hero/data/agents.ts` (currently a
`console.info`); that's the hook for the future project popover.
