# MAINSTAY_X

Personal landing page: a synthwave pixel-art door. Knock three times, Clawd
says hi, the camera warps through the door, and you land in a busy little
world of AI agents (Claude, Gemini, Codex, Qwen, Kimi) dispatched by Orca —
with a live-synthesised chiptune soundtrack.

Vite + TypeScript + native Canvas2D (320×180, integer-scaled) + WebAudio. No
game framework, no audio files, no images besides the favicon.

## Develop

```sh
npm install
npm run dev          # http://localhost:5173
npm run typecheck
npm run build        # type-check + production build into dist/
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

First visit plays the full intro; afterwards (localStorage `mx.seenIntro`)
the page opens straight into the world with a `↺ replay intro` button.
`skip ▸` / `Esc` skips the intro, the `♪` button / `M` toggles sound (stored
in `mx.muted`). `prefers-reduced-motion` goes straight to the world with
gentler animation.

## Docker

```sh
docker build -t mainstayx:latest .
docker run --rm -p 8080:8080 mainstayx:latest   # http://localhost:8080
```

Multi-stage: `node:22-alpine` builds, `nginx:stable-alpine` serves `dist/` on
port 8080 as the unprivileged `nginx` user. `nginx.conf` gzips, caches hashed
`/assets/*` for a year, never caches `index.html`, and answers `/healthz`.

## Deploy (k3s)

Example manifests live in `deploy/k8s/` (Deployment, Service, Ingress,
kustomization). Lines marked `CHANGE ME` need your values:

- image registry/name/tag (`kustomization.yaml` → `images`, or `deployment.yaml`)
- namespace (`kustomization.yaml`)
- host name and TLS secret / cert-manager issuer (`ingress.yaml`); the ingress
  class defaults to k3s' built-in `traefik`

```sh
docker build -t REGISTRY/mainstayx:TAG . && docker push REGISTRY/mainstayx:TAG
kubectl create namespace mainstayx
kubectl apply -k deploy/k8s
```

## Layout

```
src/
  main.ts            boot: display, HUD buttons, director
  types.ts           shared contracts between modules
  engine/            loop + scene director (state machine), display (scaling, bloom,
                     scanlines), text overlay, pixel draw helpers, particles, rng, easing
  scenes/            intro (door → knock → open → greet), warp, world, sheet (debug)
  sprites/           pixel matrices (defs) + cached renderer
  audio/             WebAudio synth, sequencer, BGM, sound effects
  world/             agent state machines, skit scheduler, links/packets, backdrop
  data/              agent profiles (projects/links), palette
design/              approved static style reference + the original build brief
docs/                PLAN.md (architecture), DECISIONS.md (judgement calls)
deploy/k8s/          example manifests
```

Clicking an agent calls `openAgent()` in `src/data/agents.ts` (currently a
`console.info`); that's the hook for the future project popover.
