import type { Params } from '../types';

export function readParams(search = location.search): Params {
  const q = new URLSearchParams(search);
  const scene = q.get('scene');
  const seed = Number(q.get('seed'));
  const speed = Number(q.get('speed'));
  return {
    scene: scene === 'door' || scene === 'warp' || scene === 'world' || scene === 'sheet' ? scene : null,
    seed: q.has('seed') && Number.isFinite(seed) ? seed >>> 0 : (Date.now() ^ (Math.random() * 0x7fffffff)) >>> 0,
    speed: Number.isFinite(speed) && speed > 0 ? Math.min(speed, 16) : 1,
    debug: q.get('debug') === '1',
  };
}
