# PLAN — synthwave landing (first screen only)

Experience: `DOOR → KNOCK → OPEN → GREET → WARP → WORLD`, rendered on a
320×180 Canvas2D, integer-scaled, with bloom + scanlines, and live WebAudio
chiptune. Spec: `design/CLOUD_PROMPT.md`. Visual reference: `design/synthwave/`.

## Modules and ownership

| Module | Files | Owner |
|---|---|---|
| Shared contracts | `src/hero/types.ts` | lead |
| Engine | `src/hero/engine/*` (`director` state machine + fixed-step loop, `display` scaling/bloom/scanlines, `text` Silkscreen text + bubbles, `draw` pixel primitives, `particles`, `rng`, `ease`, `params`) | lead |
| Data | `src/hero/data/agents.ts` (profiles + `openAgent()`), `src/hero/data/theme.ts` (palette) | lead |
| Entry | `index.html`, `src/hero/mount.ts`, `src/hero/hero.css` | lead |
| Sprite renderer | `src/hero/sprites/render.ts` (cache + `drawSprite`/`frameAt`/`spriteSize`) | lead |
| **Sprites** | `src/hero/sprites/defs.ts` (+ optional `src/hero/sprites/art/*`), `src/hero/scenes/sheet.ts` | sprites agent |
| **Audio** | `src/hero/audio/**` | audio agent |
| **World** | `src/hero/scenes/world.ts`, `src/hero/world/**` | world agent |
| **Intro** | `src/hero/scenes/intro.ts`, `src/hero/scenes/warp.ts`, `src/hero/scenes/intro/**` | intro agent |
| Deploy | `Dockerfile`, `nginx.conf`, `deploy/k8s/*`, `README.md` | lead |

Nobody edits files they don't own. Contract changes go through the lead.

## Interfaces (see `src/hero/types.ts` for the source of truth)

**Scene** — `enter(ctx) / update(dt) / render(g) / exit?() / pointerDown?(x,y) / debug?()`.
`update` runs at a fixed 60 Hz (`STEP`). `render` gets `g.ctx` (320×180, already
cleared + shake-translated) and `g.text` (hi-res text overlay, always on top).
`SceneContext` gives `rng` (seeded), `audio`, `pointer` (low-res coords),
`params`, `reducedMotion`, `goto(id)`, `setPhase(p)`, `shake(a,d)`,
`flash(c,d)`, `setCursor(c)`.

Scene ids: `intro` (DOOR/KNOCK/OPEN/GREET), `warp` (WARP), `world` (WORLD),
`sheet` (debug sprite sheet). URL: `?scene=door|warp|world|sheet`, `?seed=n`,
`?speed=n` (debug time multiplier), `?debug=1`.

Director owns: the loop, scene switching, phase → `<html data-phase>`,
localStorage `mx.seenIntro` (set on reaching WORLD), skip (`skip ▸`, Esc),
replay (`↺ replay intro`), mute button (M), pausing on hidden tab, unlocking
audio on the first user gesture anywhere.

**Sprites** — `SpriteDef = { palette: {char: '#rrggbb'}, anims: { name: { frames: string[][], fps, loop? } } }`.
Pixel matrices, `.` transparent, face **right**, anchored bottom-centre.
`drawSprite(ctx, id, anim, frame, cx, by, { flip, scale, outline, solid, alpha })`
caches every variant as an offscreen canvas. Missing anims fall back to `idle`
(then the first anim), so consumers can code against the full name list before
the art exists. Name lists: `AGENT_ANIMS`, `ORCA_ANIMS`, `PROP_ANIMS`.

**Audio** — `createAudio(): AudioAPI` with `unlock()` (in a gesture),
`sfx(name, {volume, pan, detune})`, `music(on)`, `setMuted`, `setPaused`.
AudioContext is created only inside `unlock()`. `SfxName` lists every effect.
Mute persists in localStorage `mx.muted`.

**World** — `createWorldScene(): Scene`. Agent state machines + weighted,
cooldown-limited random event scheduler (max 1–2 concurrent "skits").
Clicking an agent calls `openAgent(id)` from `src/hero/data/agents.ts`.
`debug()` returns `{ activeEvents, eventCounts, agents: [{id,state,x,y}], particles, packets, minis, ... }`. Dev hook: `window.__mxWorld.trigger(name)` (with `?debug=1`) starts a skit immediately.

**Text** — `text.draw(str, x, y, style)`, `text.measure(str, size)`,
`text.bubble(str, x, y, style)` (tail tip at x,y). Sizes are low-res px:
label ≈ 4, bubble ≈ 4.5, hint ≈ 6, big KNOCK! ≈ 11.

## Rules for everyone

- Palette from `src/hero/data/theme.ts` (and sprite palettes). No official logos.
- All randomness through `ctx.rng` (or a `fork()` of it) so `?seed=` reproduces.
- Hot loop: no per-frame allocation of arrays/objects/closures where avoidable;
  pre-render static layers with `makeLayer()`.
- `reducedMotion`: no shake, fewer particles, gentler motion.
- `npx tsc --noEmit` must pass for your files.

## Order of work

1. Lead: skeleton + contracts + placeholders (done in the first commit).
2. In parallel: sprites, audio, world, intro.
3. Lead: integrate, deploy files, verification (Playwright screenshots,
   60 s seeded soak), docs.
