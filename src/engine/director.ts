// Owns the experience state machine (DOOR → KNOCK → OPEN → GREET → WARP →
// WORLD), the fixed-step main loop, scene switching, shake/flash, input
// routing and the HUD buttons (skip / replay / mute).
import type { AudioAPI, Params, Phase, PointerState, Rng, Scene, SceneContext, SceneFactory, SceneId } from '../types';
import { W, H, STEP } from '../types';
import type { Display } from './display';
import type { Text } from './text';
import { rgba } from './draw';
import { createRng } from './rng';

const SEEN_KEY = 'mx.seenIntro';

export function storageGet(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
export function storageSet(key: string, value: string | null): void {
  try { value === null ? localStorage.removeItem(key) : localStorage.setItem(key, value); } catch { /* private mode */ }
}

export interface Hud {
  skip: HTMLButtonElement;
  replay: HTMLButtonElement;
  mute: HTMLButtonElement;
}

export class Director {
  phase: Phase = 'DOOR';
  sceneId: SceneId = 'intro';
  private scene!: Scene;
  private pending: SceneId | null = null;
  private ctx: SceneContext;
  private rng: Rng;
  private pointer: PointerState = { x: -1, y: -1, inside: false, down: false };
  private shakeAmp = 0;
  private shakeLeft = 0;
  private shakeDur = 0;
  private flashColor = '#ffffff';
  private flashLeft = 0;
  private flashDur = 0;
  private acc = 0;
  private last = 0;
  private running = false;
  private raf = 0;
  /** Frames rendered / sim steps, for debug and tests. */
  frames = 0;
  steps = 0;
  fps = 0;
  private fpsAcc = 0;
  private fpsN = 0;
  /** Seconds of simulated time since boot. */
  time = 0;

  constructor(
    private display: Display,
    private text: Text,
    private audio: AudioAPI,
    private scenes: Record<SceneId, SceneFactory>,
    private params: Params,
    private hud: Hud,
    readonly reducedMotion: boolean,
  ) {
    this.rng = createRng(params.seed);
    const self = this;
    this.ctx = {
      rng: this.rng,
      audio,
      pointer: this.pointer,
      params,
      reducedMotion,
      goto: id => { self.pending = id; },
      setPhase: p => self.setPhase(p),
      shake: (a, d) => {
        if (reducedMotion) return;
        if (a >= self.shakeAmp * (self.shakeLeft / (self.shakeDur || 1))) { self.shakeAmp = a; self.shakeLeft = self.shakeDur = d; }
      },
      flash: (c, d) => { self.flashColor = c; self.flashLeft = self.flashDur = reducedMotion ? Math.min(d, 0.25) : d; },
      setCursor: c => { display.stage.style.cursor = c; },
    };
    this.bindInput();
    this.bindHud();
    document.addEventListener('visibilitychange', () => this.onVisibility());
  }

  // ---------- flow ----------

  start(): void {
    const p = this.params;
    const seen = storageGet(SEEN_KEY) === '1';
    let first: SceneId;
    if (p.scene === 'door') first = 'intro';
    else if (p.scene === 'warp') first = 'warp';
    else if (p.scene === 'world') first = 'world';
    else if (p.scene === 'sheet') first = 'sheet';
    else first = seen || this.reducedMotion ? 'world' : 'intro';
    this.switchTo(first);
    this.running = true;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.tick);
  }

  private switchTo(id: SceneId): void {
    this.scene?.exit?.();
    this.sceneId = id;
    this.ctx.setCursor('default');
    this.scene = this.scenes[id]();
    if (id === 'intro') this.setPhase('DOOR');
    else if (id === 'warp') this.setPhase('WARP');
    else if (id === 'world') this.setPhase('WORLD');
    this.scene.enter(this.ctx);
    this.updateHud();
  }

  private setPhase(p: Phase): void {
    if (p === this.phase && this.sceneId !== 'intro') return;
    this.phase = p;
    if (p === 'WORLD' && this.params.scene === null) storageSet(SEEN_KEY, '1');
    document.documentElement.dataset.phase = p;
    if (this.params.debug) console.debug('[mx] phase', p);
    this.updateHud();
  }

  skip(): void {
    if (this.sceneId === 'world') return;
    this.audio.unlock();
    this.ctx.flash('#ffffff', 0.5);
    this.audio.sfx('warpHit', { volume: 0.6 });
    this.pending = 'world';
  }

  replay(): void {
    storageSet(SEEN_KEY, null);
    this.audio.music(false);
    this.ctx.flash('#000000', 0.4);
    this.pending = 'intro';
  }

  // ---------- loop ----------

  private tick = (now: number): void => {
    if (!this.running) return;
    this.raf = requestAnimationFrame(this.tick);
    const real = Math.min(0.25, Math.max(0, (now - this.last) / 1000));
    this.last = now;
    this.fpsAcc += real; this.fpsN++;
    if (this.fpsAcc >= 0.5) { this.fps = this.fpsN / this.fpsAcc; this.fpsAcc = 0; this.fpsN = 0; }
    this.acc += real * this.params.speed;
    let n = 0;
    while (this.acc >= STEP && n < 64) {
      this.step();
      this.acc -= STEP;
      n++;
    }
    if (n === 64) this.acc = 0;
    this.render();
  };

  private step(): void {
    this.scene.update(STEP);
    this.time += STEP;
    this.steps++;
    if (this.shakeLeft > 0) this.shakeLeft = Math.max(0, this.shakeLeft - STEP);
    if (this.flashLeft > 0) this.flashLeft = Math.max(0, this.flashLeft - STEP);
    if (this.pending) {
      const id = this.pending;
      this.pending = null;
      this.switchTo(id);
    }
  }

  private render(): void {
    const { ctx } = this.display;
    let ox = 0, oy = 0;
    if (this.shakeLeft > 0) {
      const k = this.shakeAmp * (this.shakeLeft / this.shakeDur);
      ox = Math.round((Math.random() * 2 - 1) * k);
      oy = Math.round((Math.random() * 2 - 1) * k);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    ctx.setTransform(1, 0, 0, 1, ox, oy);
    this.text.begin(this.display.uiScale, ox, oy);
    this.scene.render({ ctx, text: this.text });
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    if (this.flashLeft > 0) {
      ctx.fillStyle = rgba(this.flashColor, Math.min(1, (this.flashLeft / this.flashDur) * 1.4));
      ctx.fillRect(0, 0, W, H);
    }
    if (this.params.debug) this.text.draw(`${this.fps.toFixed(0)}fps ${this.phase}`, 2, 4, { size: 4, align: 'left', color: '#3df5ff' });
    this.display.present();
    this.frames++;
  }

  private onVisibility(): void {
    const hidden = document.hidden;
    this.audio.setPaused(hidden);
    if (hidden) {
      this.running = false;
      cancelAnimationFrame(this.raf);
    } else if (!this.running) {
      this.running = true;
      this.last = performance.now();
      this.acc = 0;
      this.raf = requestAnimationFrame(this.tick);
    }
  }

  // ---------- input ----------

  private bindInput(): void {
    const stage = this.display.stage;
    const move = (e: PointerEvent) => {
      const p = this.display.toLocal(e.clientX, e.clientY);
      this.pointer.x = p.x; this.pointer.y = p.y; this.pointer.inside = p.inside;
    };
    stage.addEventListener('pointermove', move);
    stage.addEventListener('pointerleave', () => { this.pointer.inside = false; this.pointer.down = false; });
    stage.addEventListener('pointerdown', e => {
      if ((e.target as HTMLElement).closest('button')) return;
      move(e);
      this.pointer.down = true;
      this.gesture();
      this.scene.pointerDown?.(this.pointer.x, this.pointer.y);
    });
    addEventListener('pointerup', () => { this.pointer.down = false; });
    // Keyboard: Enter / Space on the focused stage acts like a click at the centre.
    stage.addEventListener('keydown', e => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      this.gesture();
      this.scene.pointerDown?.(W / 2, H / 2 + 20);
    });
    // Any gesture anywhere may unlock audio (returning visitors land in WORLD).
    const any = () => this.gesture();
    addEventListener('pointerdown', any, { capture: true });
    addEventListener('keydown', any, { capture: true });
  }

  private gesture(): void {
    if (this.audio.unlocked) return;
    this.audio.unlock();
  }

  private bindHud(): void {
    const { skip, replay, mute } = this.hud;
    skip.addEventListener('click', () => this.skip());
    replay.addEventListener('click', () => this.replay());
    mute.addEventListener('click', () => {
      this.audio.unlock();
      this.audio.setMuted(!this.audio.muted);
      this.updateHud();
    });
    addEventListener('keydown', e => {
      if (e.target instanceof HTMLButtonElement) return;
      if (e.key === 'Escape' && this.sceneId !== 'world') this.skip();
      if (e.key === 'm' || e.key === 'M') mute.click();
    });
  }

  private updateHud(): void {
    const inIntro = this.sceneId === 'intro' || this.sceneId === 'warp';
    this.hud.skip.hidden = !inIntro;
    this.hud.replay.hidden = this.sceneId !== 'world';
    const m = this.audio.muted;
    this.hud.mute.textContent = m ? '♪ off' : '♪ on';
    this.hud.mute.setAttribute('aria-pressed', String(m));
    this.hud.mute.setAttribute('aria-label', m ? 'Unmute sound' : 'Mute sound');
  }

  /** For automated checks: window.__mx.debug(). */
  debug(): unknown {
    return {
      phase: this.phase,
      scene: this.sceneId,
      time: this.time,
      frames: this.frames,
      steps: this.steps,
      fps: this.fps,
      audio: { unlocked: this.audio.unlocked, muted: this.audio.muted },
      detail: this.scene.debug?.(),
    };
  }
}
