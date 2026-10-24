// The pixel-art hero: door → warp → agent world, mounted into any element.
import '@fontsource/silkscreen/400.css';
import './hero.css';
import type { SceneId, SceneFactory } from './types';
import { Display } from './engine/display';
import { Text } from './engine/text';
import { Director, type Hud } from './engine/director';
import { readParams } from './engine/params';
import { createAudio } from './audio';
import { POST } from './data/theme';
import { createIntroScene } from './scenes/intro';
import { createWarpScene } from './scenes/warp';
import { createWorldScene } from './scenes/world';
import { createSheetScene } from './scenes/sheet';

function button(cls: string, label: string, aria: string): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = cls;
  b.textContent = label;
  b.setAttribute('aria-label', aria);
  return b;
}

/** Mount the hero into root; it scales its 320×180 stage to fit root's box. */
export async function mountHero(root: HTMLElement): Promise<void> {
  const params = readParams();
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const display = new Display(root, reducedMotion ? POST.bloom * 0.6 : POST.bloom, POST.scan);
  display.stage.tabIndex = 0;
  display.stage.setAttribute('aria-label', 'Pixel-art door. Press Enter to knock.');

  const right = document.createElement('div');
  right.className = 'hud';
  const left = document.createElement('div');
  left.className = 'hud left';
  const hud: Hud = {
    skip: button('skip', 'skip ▸', 'Skip intro'),
    replay: button('replay', '↺ replay intro', 'Replay intro'),
    mute: button('mute', '♪ on', 'Mute sound'),
  };
  left.append(hud.replay);
  right.append(hud.skip, hud.mute);
  display.stage.append(left, right);

  // Wait (briefly) for the pixel font so the first frames don't flash a fallback.
  const text = new Text(display.ui);
  try {
    await Promise.race([document.fonts.load("16px 'Silkscreen'"), new Promise(r => setTimeout(r, 1500))]);
  } catch { /* fall back to monospace */ }
  document.fonts?.addEventListener?.('loadingdone', () => text.invalidate());

  const scenes: Record<SceneId, SceneFactory> = {
    intro: createIntroScene,
    warp: createWarpScene,
    world: createWorldScene,
    sheet: createSheetScene,
  };
  const audio = createAudio();
  const director = new Director(display, text, audio, scenes, params, hud, reducedMotion);
  (window as unknown as { __mx: unknown }).__mx = { director, params, debug: () => director.debug() };
  director.start();
}

