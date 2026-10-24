// Pixel-art style explorations for the "knock to enter" landing page.
// Everything is drawn at 320x180 and scaled up nearest-neighbour; a theme picks
// palette, backdrop, door, particles and post FX, so styles stay comparable.
(function () {
  const W = 320, H = 180, GROUND = 150;

  // ---------- helpers ----------
  function rng(seed) {
    let s = seed >>> 0;
    return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  }
  function hex(c) {
    const n = parseInt(c.slice(1), 16);
    return [n >> 16, (n >> 8) & 255, n & 255];
  }
  function mix(a, b, t) {
    const A = hex(a), B = hex(b);
    return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('');
  }
  function rect(ctx, x, y, w, h, c) {
    ctx.fillStyle = c;
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }
  function alpha(ctx, a, fn) {
    ctx.globalAlpha = a; fn(); ctx.globalAlpha = 1;
  }
  // Hard colour steps read as pixel art; smooth gradients don't.
  function bands(ctx, y0, y1, c0, c1, steps) {
    const h = (y1 - y0) / steps;
    for (let i = 0; i < steps; i++) rect(ctx, 0, y0 + i * h, W, Math.ceil(h) + 1, mix(c0, c1, i / (steps - 1)));
  }
  function line(ctx, x0, y0, x1, y1, c, dash = 0) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let e = dx + dy, n = 0;
    ctx.fillStyle = c;
    for (;;) {
      if (!dash || (n++ % (dash * 2)) < dash) ctx.fillRect(x0, y0, 1, 1);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * e;
      if (e2 >= dy) { e += dy; x0 += sx; }
      if (e2 <= dx) { e += dx; y0 += sy; }
    }
  }
  function frame(ctx, x, y, w, h, c) {
    rect(ctx, x, y, w, 1, c); rect(ctx, x, y + h - 1, w, 1, c);
    rect(ctx, x, y, 1, h, c); rect(ctx, x + w - 1, y, 1, h, c);
  }
  function ellipse(ctx, cx, cy, rx, ry, c) {
    for (let a = 0; a < 360; a += 2) {
      const t = a * Math.PI / 180;
      rect(ctx, cx + Math.cos(t) * rx, cy + Math.sin(t) * ry, 1, 1, c);
    }
  }
  function disc(ctx, cx, cy, r, c) {
    for (let y = -r; y <= r; y++) {
      const hw = Math.round(Math.sqrt(r * r - y * y));
      rect(ctx, cx - hw, cy + y, hw * 2 + 1, 1, c);
    }
  }
  // Mountain range as overlapping triangles, with optional snow caps.
  function peaks(ctx, r, base, n, hMin, hMax, slope, c, cap, avoid) {
    const tops = Array.from({ length: n }, () => [r() * W, hMin + r() * (hMax - hMin)]);
    for (let x = 0; x < W; x++) {
      let h = 0;
      for (const [px, ph] of tops) h = Math.max(h, ph - Math.abs(x - px) * slope);
      if (avoid) h *= avoid(x);
      if (h <= 0) continue;
      rect(ctx, x, base - h, 1, h, c);
      if (cap && h > hMin * 0.8) rect(ctx, x, base - h, 1, 2 + (x % 3 === 0), cap);
    }
  }
  function pine(ctx, x, base, h, c) {
    for (let i = 0; i < h; i++) {
      const hw = Math.floor(i * 0.4) - (i % 4 === 3 ? 1 : 0);
      rect(ctx, x - hw, base - h + i, hw * 2 + 1, 1, c);
    }
    rect(ctx, x, base, 1, 2, c);
  }
  function cloud(ctx, x, y, s, c) {
    disc(ctx, x, y, s, c); disc(ctx, x + s, y - s / 2, s, c); disc(ctx, x + s * 2, y, s, c);
    rect(ctx, x, y, s * 2, s + 1, c);
  }
  // Fake text: random 3x5 glyph blobs, stays crisp at 1x.
  function greek(ctx, x, y, n, c, r) {
    for (let i = 0; i < n; i++, x += 4) {
      if (r() < 0.18) continue;
      for (let gy = 0; gy < 5; gy++) for (let gx = 0; gx < 3; gx++) if (r() < 0.45) rect(ctx, x + gx, y + gy, 1, 1, c);
    }
  }
  function rays(ctx, c, r, bottom) {
    ctx.globalAlpha = 0.06;
    for (let i = 0; i < 6; i++) {
      const x0 = r() * W - 40, w = 6 + r() * 16;
      for (let y = 0; y < bottom; y++) rect(ctx, x0 + y * 0.35, y, w, 1, c);
    }
    ctx.globalAlpha = 1;
  }

  // ---------- sprites ----------
  const CLAUDE = { O: '#d97757', K: '#1a1210' };
  const SPR = {
    clawd: { colors: CLAUDE, map: [
      '..OOOOOOOOO..',
      '..OOKOOOKOO..',
      '..OOKOOOKOO..',
      'OOOOOOOOOOOOO',
      'OOOOOOOOOOOOO',
      '..OOOOOOOOO..',
      '..O.O...O.O..',
      '..O.O...O.O..',
    ] },
    wave: { colors: CLAUDE, map: [
      '............O',
      '..OOOOOOOOO.O',
      '..OOKOOOKOO.O',
      '..OOKOOOKOOOO',
      'OOOOOOOOOOOO.',
      '..OOOOOOOOO..',
      '..O.O...O.O..',
      '..O.O...O.O..',
    ] },
    orca: { colors: { K: '#1b2030', W: '#f2f4f8', G: '#5b6378' }, map: [
      '..................KK..........',
      '.................KKK..........',
      '................KKKK..........',
      '.........KKKKKKKKKKKKKK.......',
      '......KKKKKKKKKKKKKKKKKKKK....',
      '....KKKKWWWKKKKKKKKKKKKKKKK..K',
      '...KKKKKWWWKKKKKKKKKKKKKKKKKKK',
      '..KKKKKKKKKKKKKKKKKKGGKKKKKKK.',
      '.KKKKKKKKKKKKKKKKKGGGKKKKKKKKK',
      'KWWWKKKKKKKKKKKKKKKKKKKKKK..KK',
      '.KWWWWWWKKKKKKKWWWWKKKKKK....K',
      '..KKWWWWWWWWWWWWWWKKKKK.......',
      '....KKKWWWWWWWWKKKK...........',
      '........KKKKKKKK..............',
      '..........KKK.................',
    ] },
    gemini: { colors: { A: '#9ab8ff', B: '#5b7cfa', K: '#0b1030' }, map: [
      '....A....',
      '...AAA...',
      '.AAAAAAA.',
      '...AAA...',
      '....A....',
      '..BBBBB..',
      '.BBKBKBB.',
      '.BBBBBBB.',
      '..BBBBB..',
      '..B...B..',
    ] },
    codex: { colors: { K: '#a0a6ad', W: '#0d1117', G: '#e8e8e8' }, map: [
      '.KKKKKKK.',
      'KWWWWWWWK',
      'KWGWWWWWK',
      'KWWGWWWWK',
      'KWGWWGGWK',
      'KWWWWWWWK',
      '.KKKKKKK.',
      '...KKK...',
      '..KKKKK..',
      '..K...K..',
    ] },
    qwen: { colors: { A: '#c4b5fd', P: '#7c5cff', K: '#160d3a' }, map: [
      '....A....',
      '....A....',
      '..PPPPP..',
      '.PPPPPPP.',
      '.PKPPPKP.',
      '.PPPPPPP.',
      '..PPPPP..',
      '.PP.P.PP.',
    ] },
    kimi: { colors: { C: '#e6edf3', K: '#111111' }, map: [
      '..CCCCC..',
      '.CCCCCCC.',
      'CCKCCCKCC',
      'CCCCCCCCC',
      'CCCCCCCCC',
      'CCCCCCCCC',
      'C.CC.CC.C',
    ] },
  };
  function size(spr, s) {
    return [Math.max(...spr.map.map(r => r.length)) * s, spr.map.length * s];
  }
  function blit(ctx, spr, x, y, s, flip, solid) {
    const w = Math.max(...spr.map.map(r => r.length));
    spr.map.forEach((row, j) => [...row].forEach((ch, i) => {
      if (ch === '.') return;
      rect(ctx, x + (flip ? w - 1 - i : i) * s, y + j * s, s, s, solid || spr.colors[ch]);
    }));
  }
  // Anchored at bottom-centre (the feet), optional 1px rim for dark scenes.
  function place(ctx, spr, cx, by, s = 1, opt = {}) {
    const [w, h] = size(spr, s), x = Math.round(cx - w / 2), y = by - h;
    if (opt.outline) for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) blit(ctx, spr, x + dx, y + dy, s, opt.flip, opt.outline);
    blit(ctx, spr, x, y, s, opt.flip);
    return { x, y, w, h };
  }

  // ---------- door-scene backdrops ----------
  function street(ctx, p, r) {
    rect(ctx, 0, GROUND, W, H - GROUND, p.ground);
    rect(ctx, 0, GROUND, W, 1, p.frameHi);
  }

  function city(ctx, t, r) {
    const p = t.pal;
    bands(ctx, 0, GROUND, p.sky0, p.sky1, 8);
    let x = 0;
    while (x < W) {
      const w = 10 + (r() * 18 | 0), h = 30 + (r() * 60 | 0);
      rect(ctx, x, GROUND - h - 10, w, h + 10, p.far);
      for (let wy = GROUND - h - 6; wy < GROUND - 4; wy += 4)
        for (let wx = x + 2; wx < x + w - 2; wx += 3)
          if (r() < 0.12) rect(ctx, wx, wy, 1, 1, mix(p.far, p.win[0], 0.5));
      x += w + (r() * 3 | 0);
    }
    x = -5;
    while (x < W) {
      const w = 16 + (r() * 26 | 0), h = 20 + (r() * 50 | 0);
      if (x + w > 92 && x < 228) { x = 228; continue; } // keep the door area clear
      rect(ctx, x, GROUND - h, w, h, p.near);
      for (let wy = GROUND - h + 3; wy < GROUND - 3; wy += 5)
        for (let wx = x + 2; wx < x + w - 3; wx += 4)
          if (r() < 0.35) rect(ctx, wx, wy, 2, 2, p.win[r() * p.win.length | 0]);
      if (r() < 0.7) rect(ctx, x + w - 3, GROUND - h + 6 + (r() * 16 | 0), 2, 10 + (r() * 10 | 0), r() < 0.5 ? p.neonA : p.neonB);
      x += w + 2 + (r() * 6 | 0);
    }
    street(ctx, p, r);
    for (let i = 0; i < 34; i++) {
      const c = [p.neonA, p.neonB, ...p.win][r() * (2 + p.win.length) | 0];
      alpha(ctx, 0.35, () => rect(ctx, r() * W, GROUND + 3 + r() * 26, 3 + r() * 10, 1, c));
    }
  }

  function synth(ctx, t, r) {
    const p = t.pal, HZ = 112;
    bands(ctx, 0, HZ, p.sky0, p.sky1, 10);
    for (let i = 0; i < 60; i++) alpha(ctx, 0.3 + r() * 0.7, () => rect(ctx, r() * W, r() * 60, 1, 1, p.star));
    const cx = 160, cy = 96, R = 44;
    for (let y = -R; y <= 0; y++) {
      const half = Math.sqrt(R * R - y * y) | 0, k = -y;
      if (y > -R * 0.6 && k % 7 < 3 - k / 14) continue; // stripes thicken toward the horizon
      rect(ctx, cx - half, cy + y, half * 2, 1, mix(p.sunTop, p.sunBot, (y + R) / R));
    }
    let h = 14;
    for (let x = 0; x < W; x++) {
      h = Math.max(4, Math.min(30, h + (r() - 0.5) * 4));
      const dip = Math.abs(x - 160) < 60 ? 0.35 : 1; // lower in front of the sun
      rect(ctx, x, HZ - h * dip, 1, h * dip, p.far);
    }
    rect(ctx, 0, HZ, W, H - HZ, p.ground);
    for (let k = 1; k < 9; k++) rect(ctx, 0, HZ + Math.round((H - HZ) * (k / 8) ** 2), W, 1, p.grid);
    for (let i = -14; i <= 14; i++) line(ctx, 160 + i * 10, HZ, 160 + i * 52, H, p.grid);
    rect(ctx, 0, HZ, W, 1, p.sunBot);
  }

  function kelp(ctx, p, r, n, base, keepOut) {
    for (let k = 0; k < n; k++) {
      let x0 = r() * W;
      if (keepOut && x0 > keepOut[0] && x0 < keepOut[1]) x0 = r() < 0.5 ? r() * keepOut[0] : keepOut[1] + r() * (W - keepOut[1]);
      const h = 20 + r() * 50, ph = r() * 6;
      for (let y = 0; y < h; y++) {
        const x = x0 + Math.round(Math.sin(y * 0.22 + ph) * 1.6);
        rect(ctx, x, base - y, 2, 1, p.kelp);
        if (y % 9 === 4) rect(ctx, x + (y % 18 < 9 ? 2 : -2), base - y, 2, 1, p.kelp);
        if (y % 13 === 7 && r() < 0.6) alpha(ctx, 0.8, () => rect(ctx, x, base - y, 1, 1, p.neonA));
      }
    }
  }
  function sea(ctx, t, r) {
    const p = t.pal;
    bands(ctx, 0, GROUND, p.sky0, p.sky1, 9);
    rays(ctx, p.ray, r, GROUND);
    peaks(ctx, r, GROUND, 9, 14, 46, 0.9, p.far);
    kelp(ctx, p, r, 14, GROUND, [92, 228]);
    street(ctx, p, r);
    for (let i = 0; i < 50; i++) alpha(ctx, 0.3, () => rect(ctx, r() * W, GROUND + 2 + r() * 28, 1 + r() * 3, 1, p.frameHi));
    for (let i = 0; i < 90; i++) alpha(ctx, 0.2 + r() * 0.5, () => rect(ctx, r() * W, r() * GROUND, 1, 1, p.star));
  }

  function town(ctx, t, r) {
    const p = t.pal;
    bands(ctx, 0, GROUND, p.sky0, p.sky1, 6);
    for (let i = 0; i < 5; i++) cloud(ctx, r() * W, 12 + r() * 30, 3 + (r() * 3 | 0), p.cloud);
    let x = 0;
    while (x < W) {
      const w = 18 + (r() * 22 | 0), h = 30 + (r() * 40 | 0);
      rect(ctx, x, GROUND - h, w, h, p.far);
      for (let wy = GROUND - h + 4; wy < GROUND - 6; wy += 6)
        for (let wx = x + 3; wx < x + w - 3; wx += 5) rect(ctx, wx, wy, 3, 3, p.farWin);
      x += w + 3;
    }
    for (const tx of [20, 52, 74, 246, 270, 300]) {
      rect(ctx, tx, GROUND - 12, 2, 12, p.trunk);
      disc(ctx, tx + 1, GROUND - 18, 8, p.treeDark);
      disc(ctx, tx, GROUND - 20, 6, p.tree);
    }
    rect(ctx, 0, GROUND, W, 20, p.ground);
    for (let sx = 0; sx < W; sx += 10) rect(ctx, sx, GROUND, 1, 20, p.groundLine);
    rect(ctx, 0, GROUND, W, 1, p.frameHi);
    rect(ctx, 0, GROUND + 20, W, H - GROUND - 20, p.road);
    for (let sx = 4; sx < W; sx += 24) rect(ctx, sx, GROUND + 25, 12, 1, p.cloud);
  }

  function peaksBg(ctx, t, r, base = GROUND) {
    const p = t.pal;
    bands(ctx, 0, base, p.sky0, p.sky1, 9);
    for (let i = 0; i < 90; i++) alpha(ctx, 0.3 + r() * 0.7, () => rect(ctx, r() * W, r() * (base - 40), 1, 1, p.star));
    for (let i = 0; i < 6; i++) {
      const sx = r() * W, sy = r() * 60;
      rect(ctx, sx - 1, sy, 3, 1, p.star); rect(ctx, sx, sy - 1, 1, 3, p.star);
    }
    disc(ctx, 262, 30, 9, p.moon);
    disc(ctx, 259, 28, 2, mix(p.moon, p.sky0, 0.15));
    peaks(ctx, r, base, 6, 40, 85, 1.1, p.far, p.snowFar);
    peaks(ctx, r, base, 8, 20, 50, 1.3, p.mid, p.snow);
    for (let x = 4; x < W; x += 7 + (r() * 6 | 0)) {
      if (x > 92 && x < 228) continue;
      pine(ctx, x, base - 1, 10 + (r() * 12 | 0), p.near);
    }
  }
  function peaksDoor(ctx, t, r) {
    peaksBg(ctx, t, r);
    street(ctx, t.pal, r);
  }

  function paper(ctx, t, r) {
    const p = t.pal;
    rect(ctx, 0, 0, W, H, p.paper);
    for (let i = 0; i < 300; i++) alpha(ctx, 0.07, () => rect(ctx, r() * W, r() * H, 1 + r() * 3, 1, p.ink));
    for (let i = 0; i < 3; i++) alpha(ctx, 0.05, () => disc(ctx, r() * W, r() * H, 10 + (r() * 14 | 0), p.inkLight));
    frame(ctx, 6, 6, W - 12, H - 12, p.inkLight);
    alpha(ctx, 0.5, () => frame(ctx, 8, 8, W - 16, H - 16, p.inkLight));
  }
  function margins(ctx, p, r, x0, x1, y0, y1) {
    for (let y = y0; y < y1; y += 7) greek(ctx, x0, y, ((x1 - x0) / 4 | 0) - (r() * 4 | 0), p.inkLight, r);
  }

  function wall(ctx, t) {
    const p = t.pal, x0 = 96, x1 = 224, top = 56, style = t.wallStyle || 'panel';
    rect(ctx, x0, top, x1 - x0, GROUND - top, p.wall);
    if (style === 'panel') {
      for (let x = x0 + 8; x < x1; x += 16) rect(ctx, x, top, 1, GROUND - top, p.wallLine);
      for (let y = top + 20; y < GROUND; y += 24) rect(ctx, x0, y, x1 - x0, 1, p.wallLine);
    } else {
      const rowH = style === 'brick' ? 4 : 5;
      for (let y = top + rowH, row = 0; y < GROUND; y += rowH, row++) {
        rect(ctx, x0, y, x1 - x0, 1, p.wallLine);
        if (style === 'brick') for (let x = x0 + (row % 2) * 4; x < x1; x += 8) rect(ctx, x, y - rowH + 1, 1, rowH - 1, p.wallLine);
      }
      for (const wx of [104, 192]) {
        rect(ctx, wx - 1, 92, 26, 22, p.frame);
        rect(ctx, wx + 1, 94, 22, 18, p.doorGlass || p.inside1);
        rect(ctx, wx + 11, 94, 1, 18, p.frame);
        rect(ctx, wx + 1, 102, 22, 1, p.frame);
        alpha(ctx, 0.5, () => line(ctx, wx + 3, 108, wx + 9, 96, '#ffffff'));
        rect(ctx, wx - 2, 114, 28, 2, p.frameHi);
      }
    }
    rect(ctx, x0 - 2, top - 3, x1 - x0 + 4, 3, p.frame);
    rect(ctx, x0 - 2, top - 3, x1 - x0 + 4, 1, p.frameHi);
    if (t.snowRoof) rect(ctx, x0 - 3, top - 5, x1 - x0 + 6, 2, p.snow);
    if (style === 'planks') {
      for (let x = x0 + 4, i = 0; x < x1 - 2; x += 6, i++) {
        rect(ctx, x, top + 2 + (i % 2), 1, 1, p.wallLine);
        rect(ctx, x, top + 3 + (i % 2), 2, 2, [p.neonA, p.neonB, p.inside1][i % 3]);
      }
    } else if (style === 'panel') {
      rect(ctx, x0 + 4, top + 3, x1 - x0 - 8, 1, p.neonB);
      rect(ctx, x1 - 10, top, 3, GROUND - top, p.frame);
      rect(ctx, x1 - 10, top, 1, GROUND - top, p.frameHi);
      for (let i = 0; i < 4; i++) rect(ctx, x0 + 10, top + 30 + i * 3, 14, 1, p.wallLine);
    }
  }

  const BACKDROPS = { city, synth, sea, town, peaks: peaksDoor };

  // ---------- particles ----------
  const PARTICLES = {
    rain(ctx, p, r, n) {
      for (let i = 0; i < n; i++) {
        const x = r() * W, y = r() * H, len = 3 + (r() * 4 | 0);
        alpha(ctx, 0.25 + r() * 0.25, () => { for (let k = 0; k < len; k++) rect(ctx, x - (k >> 1), y + k, 1, 1, p.rain); });
      }
    },
    snow(ctx, p, r, n) {
      for (let i = 0; i < n; i++) {
        const s = r() < 0.2 ? 2 : 1;
        alpha(ctx, 0.5 + r() * 0.5, () => rect(ctx, r() * W, r() * H, s, s, p.flake));
      }
    },
    bubbles(ctx, p, r, n) {
      for (let i = 0; i < n; i++) {
        const x = r() * W, y = r() * H;
        alpha(ctx, 0.35 + r() * 0.4, () => {
          if (r() < 0.6) { rect(ctx, x, y, 1, 1, p.star); return; }
          rect(ctx, x - 1, y, 1, 1, p.star); rect(ctx, x + 1, y, 1, 1, p.star);
          rect(ctx, x, y - 1, 1, 1, p.star); rect(ctx, x, y + 1, 1, 1, p.star);
        });
      }
    },
  };
  function particles(ctx, t, r) {
    if (t.particles) PARTICLES[t.particles](ctx, t.pal, r, t.count);
  }

  // ---------- the door ----------
  const DOOR_W = 36, DOOR_H = 60;
  const LEAF = {
    scifi(ctx, p, x, y, w, h, cx) {
      rect(ctx, cx, y, 1, h, p.doorDark);
      for (const gy of [y + 12, y + 30, y + 44]) {
        rect(ctx, x + 2, gy, w - 4, 1, p.doorDark);
        rect(ctx, x + 2, gy + 1, w - 4, 1, p.doorHi);
      }
      rect(ctx, cx - 9, y + 18, 18, 4, p.doorDark);
      rect(ctx, cx - 8, y + 19, 16, 1, p.neonA);
      for (let j = 0; j < 5; j++)
        for (let i = 0; i < w - 4; i++)
          rect(ctx, x + 2 + i, y + h - 9 + j, 1, 1, (i + j) % 6 < 3 ? p.neonB : p.doorDark);
      for (const [rx, ry] of [[2, 2], [w - 3, 2], [2, h - 3], [w - 3, h - 3]]) rect(ctx, x + rx, y + ry, 1, 1, p.doorHi);
    },
    hatch(ctx, p, x, y, w, h, cx) {
      for (let i = 3; i < h - 2; i += 4) { rect(ctx, x + 2, y + i, 1, 1, p.doorHi); rect(ctx, x + w - 3, y + i, 1, 1, p.doorHi); }
      for (let i = 6; i < w - 4; i += 4) { rect(ctx, x + i, y + 2, 1, 1, p.doorHi); rect(ctx, x + i, y + h - 3, 1, 1, p.doorHi); }
      disc(ctx, cx, y + 16, 8, p.frameHi);
      disc(ctx, cx, y + 16, 6, mix(p.neonA, p.doorDark, 0.55));
      rect(ctx, cx - 3, y + 12, 2, 2, mix(p.neonA, '#ffffff', 0.5));
      ellipse(ctx, cx, y + 38, 7, 7, p.doorHi);
      line(ctx, cx - 7, y + 38, cx + 7, y + 38, p.doorHi);
      line(ctx, cx, y + 31, cx, y + 45, p.doorHi);
      disc(ctx, cx, y + 38, 1, p.neonB);
      rect(ctx, x + 3, y + h - 8, w - 6, 2, p.doorDark);
    },
    wood(ctx, p, x, y, w, h, cx) {
      for (let i = x + 4; i < x + w; i += 5) rect(ctx, i, y, 1, h, p.doorDark);
      rect(ctx, x + 1, y + 8, w - 2, 2, p.doorHi);
      rect(ctx, x + 1, y + h - 12, w - 2, 2, p.doorHi);
      rect(ctx, cx - 7, y + 16, 14, 11, p.doorDark);
      rect(ctx, cx - 6, y + 17, 12, 9, mix(p.inside1, p.doorDark, 0.25));
      rect(ctx, cx, y + 17, 1, 9, p.doorDark);
      rect(ctx, cx - 6, y + 21, 12, 1, p.doorDark);
      rect(ctx, x + w - 7, y + 34, 2, 2, p.neonB);
    },
    glass(ctx, p, x, y, w, h, cx) {
      for (const gx of [x + 3, cx + 2]) {
        rect(ctx, gx, y + 3, w / 2 - 5, h - 8, p.doorGlass);
        alpha(ctx, 0.6, () => { line(ctx, gx + 1, y + 20, gx + 8, y + 8, '#ffffff'); line(ctx, gx + 1, y + 26, gx + 11, y + 11, '#ffffff'); });
      }
      rect(ctx, cx, y, 1, h, p.doorDark);
      rect(ctx, cx - 4, y + 26, 2, 12, p.frameHi);
      rect(ctx, cx + 3, y + 26, 2, 12, p.frameHi);
      rect(ctx, cx - 14, y + 34, 10, 4, p.neonA);
    },
  };

  function door(ctx, t, open) {
    const p = t.pal, style = t.door || 'scifi', w = DOOR_W, h = DOOR_H, cx = 160, x = cx - w / 2, y = GROUND - h;
    rect(ctx, cx - 22, y - 22, 44, 11, p.frame);
    frame(ctx, cx - 22, y - 22, 44, 11, p.neonA);
    rect(ctx, x - 6, y - 8, w + 12, h + 8, p.frame);
    rect(ctx, x - 6, y - 8, w + 12, 1, p.frameHi);
    rect(ctx, x - 6, y - 8, 1, h + 8, p.frameHi);
    rect(ctx, cx - 8, y - 6, 16, 2, open ? p.neonA : p.neonB); // status light
    rect(ctx, x - 2, y - 2, w + 4, 1, p.neonA);
    rect(ctx, x - 2, y - 2, 1, h + 2, p.neonA);
    rect(ctx, x + w + 1, y - 2, 1, h + 2, p.neonA);
    if (style === 'scifi' || style === 'hatch') {
      rect(ctx, x + w + 2, y + 24, 3, 9, p.doorDark);
      for (let i = 0; i < 3; i++) rect(ctx, x + w + 3, y + 25 + i * 3, 1, 1, i === 2 ? p.neonB : p.neonA);
    }
    if (open) {
      for (let i = 0; i < 6; i++) rect(ctx, x, y + i * 10, w, 10, mix(p.inside0, p.inside1, i / 5));
      for (let k = 0; k < H - GROUND; k++)
        alpha(ctx, 0.35 * (1 - k / (H - GROUND)), () => rect(ctx, x - k * 1.6, GROUND + k, w + k * 3.2, 1, p.inside1));
      const leaf = (w / 2) * (1 - open);
      rect(ctx, x, y, leaf, h, p.door);
      rect(ctx, x + w - leaf, y, leaf, h, p.door);
      rect(ctx, x + leaf - 1, y, 1, h, p.doorHi);
      rect(ctx, x + w - leaf, y, 1, h, p.doorHi);
    } else {
      rect(ctx, x, y, w, h, p.door);
      LEAF[style](ctx, p, x, y, w, h, cx);
      alpha(ctx, 0.5, () => rect(ctx, x - 2, GROUND + 2, w + 4, 1, p.neonA));
    }
    rect(ctx, x - 8, GROUND, w + 16, 2, p.frameHi);
    return { signY: y - 16.5 };
  }

  // TUNIC-style manual page: the scene becomes an illustration plate on paper.
  function manualPage(ctx, t, open) {
    const p = t.pal, r = rng(7), bx = 96, by = 30, bw = 128, bh = 126;
    paper(ctx, t, r);
    margins(ctx, p, r, 16, 84, 18, 160);
    margins(ctx, p, r, 236, 304, 18, 160);
    ctx.save();
    ctx.beginPath(); ctx.rect(bx, by, bw, bh); ctx.clip();
    bands(ctx, 0, GROUND, p.sky0, p.sky1, 6);
    cloud(ctx, 110, 46, 4, '#ffffff');
    cloud(ctx, 190, 40, 3, '#ffffff');
    peaks(ctx, r, GROUND, 5, 20, 40, 0.6, p.far);
    peaks(ctx, r, GROUND, 6, 8, 22, 0.8, p.mid);
    rect(ctx, 0, GROUND, W, H - GROUND, p.ground);
    for (let i = 0; i < 40; i++) rect(ctx, bx + r() * bw, GROUND + 2 + r() * 6, 1, 2, p.mid);
    door(ctx, t, open);
    if (open) place(ctx, SPR.wave, 160, GROUND, 2);
    ctx.restore();
    alpha(ctx, 0.25, () => { rect(ctx, bx + 2, by + bh, bw, 2, p.ink); rect(ctx, bx + bw, by + 2, 2, bh, p.ink); });
    frame(ctx, bx - 1, by - 1, bw + 2, bh + 2, p.ink);
    ellipse(ctx, 84, 60, 5, 5, p.neonA);
    line(ctx, 89, 62, 133, 86, p.neonA, 2);
    return [
      { text: '1', x: 84, y: 60, cls: 'callout' },
      { text: 'fig. 1 — knock to enter', x: 160, y: 166, cls: 'hint' },
      { text: '— 3 —', x: 296, y: 170, cls: 'label' },
    ];
  }

  // ---------- scenes ----------
  function sceneDoor(ctx, t) {
    if (t.bg === 'paper') {
      return [...manualPage(ctx, t, 0),
        { text: 'KNOCK!', x: 212, y: 98, cls: 'knock' }, { text: 'knock', x: 112, y: 120, cls: 'knock small' }];
    }
    const r = rng(7);
    BACKDROPS[t.bg](ctx, t, r);
    if (t.wall) wall(ctx, t);
    const d = door(ctx, t, 0);
    particles(ctx, t, r);
    return [
      { text: 'MAINSTAY_X', x: 160, y: d.signY, cls: 'sign' },
      { text: 'KNOCK!', x: 212, y: 98, cls: 'knock' },
      { text: 'KNOCK', x: 110, y: 116, cls: 'knock small' },
      { text: '▶ CLICK TO KNOCK', x: 160, y: 166, cls: 'hint' },
    ];
  }

  function sceneOpen(ctx, t) {
    const bubble = { text: 'HI!', x: 182, y: GROUND - 24, cls: 'bubble' };
    if (t.bg === 'paper') return [...manualPage(ctx, t, 0.82).slice(0, 1), bubble];
    const r = rng(7);
    BACKDROPS[t.bg](ctx, t, r);
    if (t.wall) wall(ctx, t);
    door(ctx, t, 0.82);
    place(ctx, SPR.wave, 160, GROUND, 2);
    particles(ctx, t, r);
    return [bubble];
  }

  function sceneWarp(ctx, t) {
    const p = t.pal, r = rng(3), cx = 160, cy = 92;
    if (t.warp === 'dive') {
      bands(ctx, 0, H, p.sky0, p.warp0, 8);
      rays(ctx, p.ray, r, H);
      for (let i = 0; i < 140; i++) {
        const x = r() * W, y = r() * H, len = 8 + r() * 60, c = [p.neonA, '#ffffff', p.star][r() * 3 | 0];
        alpha(ctx, 0.3 + r() * 0.6, () => { line(ctx, x, y, x, y + len, c); if (r() < 0.4) ellipse(ctx, x, y - 2, 2, 2, c); });
      }
      for (let i = 0; i < 12; i++) alpha(ctx, 0.6, () => ellipse(ctx, r() * W, r() * H, 3 + r() * 5, 3 + r() * 5, p.star));
      return [];
    }
    if (t.bg === 'paper') paper(ctx, t, r); else rect(ctx, 0, 0, W, H, p.warp0);
    for (let k = 1; k < 9; k++) {
      const s = Math.pow(1.5, k), w = 10 * s, h = 6 * s;
      frame(ctx, cx - w / 2, cy - h / 2, w, h, mix(p.neonA, p.warp0, k / 9));
    }
    const cols = [p.neonA, p.neonB, p.warpHi || '#ffffff'];
    for (let i = 0; i < 170; i++) {
      const a = r() * Math.PI * 2, d0 = 12 + r() * 50, len = 20 + r() * 140;
      const c = cols[r() * 3 | 0], ca = Math.cos(a), sa = Math.sin(a) * 0.62;
      alpha(ctx, 0.4 + r() * 0.6, () => line(ctx, cx + ca * d0, cy + sa * d0, cx + ca * (d0 + len), cy + sa * (d0 + len), c));
    }
    for (let k = 14; k > 0; k -= 2) {
      const c = mix(p.neonA, '#ffffff', 1 - k / 14);
      alpha(ctx, 0.5, () => { for (let y = -k; y <= k; y++) { const hw = Math.sqrt(k * k - y * y); rect(ctx, cx - hw, cy + y * 0.7, hw * 2, 1, c); } });
    }
    return [];
  }

  // ---------- agent-world backdrops ----------
  const HZ = 70;
  const WORLDS = {
    grid(ctx, t, r) {
      const p = t.world, q = t.pal;
      bands(ctx, 0, HZ, p.sky0, p.sky1, 7);
      for (let i = 0; i < 70; i++) alpha(ctx, 0.3 + r() * 0.7, () => rect(ctx, r() * W, r() * (HZ - 4), 1, 1, q.star));
      rect(ctx, 0, HZ, W, H - HZ, p.floor);
      for (let k = 1; k < 10; k++) rect(ctx, 0, HZ + Math.round((H - HZ) * (k / 9) ** 2), W, 1, p.grid);
      for (let i = -16; i <= 16; i++) line(ctx, 160 + i * 8, HZ, 160 + i * 44, H, p.grid);
      alpha(ctx, 0.6, () => rect(ctx, 0, HZ, W, 1, q.neonA));
    },
    sea(ctx, t, r) {
      const p = t.world, q = t.pal;
      bands(ctx, 0, H, p.sky0, p.sky1, 10);
      rays(ctx, q.ray, r, H);
      peaks(ctx, r, 172, 10, 10, 30, 0.8, p.grid);
      rect(ctx, 0, 168, W, 12, p.floor);
      kelp(ctx, q, r, 7, 172, [50, 270]);
      for (let i = 0; i < 120; i++) alpha(ctx, 0.2 + r() * 0.5, () => rect(ctx, r() * W, r() * H, 1, 1, q.star));
    },
    peaks(ctx, t, r) {
      const p = t.world;
      peaksBg(ctx, { pal: { ...t.pal, sky0: p.sky0, sky1: p.sky1 } }, r, HZ + 10);
      rect(ctx, 0, HZ + 10, W, H - HZ - 10, p.floor);
      for (let k = 1; k < 8; k++) rect(ctx, 0, HZ + 10 + Math.round((H - HZ - 10) * (k / 7) ** 2), W, 1, p.grid);
      for (let i = 0; i < 40; i++) rect(ctx, r() * W, HZ + 12 + r() * 90, 2, 1, p.grid);
    },
    office(ctx, t, r) {
      const p = t.world, q = t.pal;
      for (let y = 46; y < H; y += 10)
        for (let x = 0; x < W; x += 10) rect(ctx, x, y, 10, 10, ((x + y) / 10) % 2 ? p.floor : p.floor2);
      rect(ctx, 0, 0, W, 44, p.wall);
      rect(ctx, 0, 44, W, 3, p.base);
      for (const wx of [24, 76, 244, 296]) {
        rect(ctx, wx - 15, 8, 30, 24, p.frame);
        rect(ctx, wx - 13, 10, 26, 20, p.sky);
        cloud(ctx, wx - 8, 22, 2, '#ffffff');
        rect(ctx, wx, 10, 1, 20, p.frame);
      }
      rect(ctx, 128, 7, 64, 28, p.frame);
      rect(ctx, 130, 9, 60, 24, '#ffffff');
      line(ctx, 134, 26, 146, 16, q.neonA); line(ctx, 146, 16, 156, 22, q.neonA); line(ctx, 156, 22, 170, 12, q.neonA);
      for (let i = 0; i < 3; i++) rect(ctx, 174, 13 + i * 5, 12, 1, q.neonB);
      rect(ctx, 104, 74, 112, 50, p.rug);
      frame(ctx, 106, 76, 108, 46, mix(p.rug, '#ffffff', 0.3));
      for (const [px, py] of [[10, 70], [310, 70], [10, 172], [310, 172]]) {
        rect(ctx, px - 4, py - 6, 8, 6, p.pot);
        disc(ctx, px, py - 11, 5, q.treeDark);
        disc(ctx, px - 1, py - 13, 3, q.tree);
      }
    },
    paper(ctx, t, r) {
      const q = t.pal;
      paper(ctx, t, r);
      for (let y = 20; y < H - 12; y += 12) for (let x = 20; x < W - 12; x += 12) rect(ctx, x, y, 1, 1, q.inkLight);
      margins(ctx, q, r, 14, 60, 14, 50);
      margins(ctx, q, r, 262, 306, 120, 166);
    },
  };

  function desk(ctx, p, x, y, right) {
    rect(ctx, x - 16, y - 14, 32, 3, p.deskTop);
    rect(ctx, x - 16, y - 11, 32, 8, p.desk);
    const mx = x + (right ? 6 : -14);
    rect(ctx, mx, y - 24, 9, 9, p.frame);
    rect(ctx, mx + 1, y - 23, 7, 6, p.sky);
    rect(ctx, mx + 4, y - 15, 1, 1, p.frame);
  }

  function sceneWorld(ctx, t) {
    const p = t.world, q = t.pal, r = rng(11);
    WORLDS[t.worldBg || 'grid'](ctx, t, r);

    const crew = [
      { s: 'clawd', x: 62, y: 98, sc: 2, label: 'CLAUDE', bubble: 'on it!' },
      { s: 'clawd', x: 112, y: 76, sc: 1, label: 'sub-agent', flip: true, run: true },
      { s: 'gemini', x: 92, y: 160, sc: 2, label: 'GEMINI', run: true },
      { s: 'codex', x: 234, y: 160, sc: 2, label: 'CODEX', bubble: '>_ done' },
      { s: 'qwen', x: 268, y: 100, sc: 2, label: 'QWEN', flip: true },
      { s: 'kimi', x: 212, y: 78, sc: 2, label: 'KIMI', bubble: '?' },
    ];
    if (p.desks) crew.forEach(a => a.sc > 1 && desk(ctx, p, a.x, a.y, !a.flip));

    const hub = [160, 96];
    const mid = a => [a.x, a.y - size(SPR[a.s], a.sc)[1] / 2];
    const lerp = (A, B, f) => [A[0] + (B[0] - A[0]) * f, A[1] + (B[1] - A[1]) * f];
    const packet = ([x, y], c) => {
      alpha(ctx, 0.35, () => rect(ctx, x - 2, y - 2, 5, 5, c));
      rect(ctx, x - 1, y - 1, 3, 3, c);
      rect(ctx, x, y, 1, 1, '#ffffff');
    };
    for (const a of crew) line(ctx, ...hub, ...mid(a), q.neonA, 2);
    const peers = [[0, 1], [2, 3], [4, 5], [0, 2]];
    for (const [i, j] of peers) line(ctx, ...mid(crew[i]), ...mid(crew[j]), q.neonB, 1);
    crew.forEach((a, i) => packet(lerp(hub, mid(a), 0.3 + (i % 3) * 0.2), q.neonA));
    for (const [i, j] of peers) packet(lerp(mid(crew[i]), mid(crew[j]), 0.55), q.neonB);

    if (p.tank) {
      rect(ctx, 122, 76, 76, 40, p.frame);
      for (let i = 0; i < 4; i++) rect(ctx, 124, 78 + i * 9, 72, 10, mix(p.water0, p.water1, i / 3));
      place(ctx, SPR.orca, 160, 112, 2);
      alpha(ctx, 0.5, () => { line(ctx, 128, 100, 140, 80, '#ffffff'); line(ctx, 132, 104, 146, 80, '#ffffff'); });
      rect(ctx, 120, 116, 80, 4, p.base);
    } else {
      alpha(ctx, 0.5, () => ellipse(ctx, 160, 114, 46, 9, q.neonA));
      ellipse(ctx, 160, 114, 34, 6, q.neonA);
      place(ctx, SPR.orca, 160, 110, 2, { outline: q.neonA });
    }

    const rim = mix(q.neonA, '#000000', 0.45), marks = [];
    for (const a of crew) {
      const [w, h] = size(SPR[a.s], a.sc);
      alpha(ctx, 0.5, () => rect(ctx, a.x - w / 2 + 2, a.y, w - 4, 1, '#000000'));
      if (a.run) for (let k = 0; k < 3; k++) alpha(ctx, 0.6 - k * 0.18, () => rect(ctx, a.x + (a.flip ? 1 : -1) * (w / 2 + 2 + k * 3), a.y - 1 - (k & 1), 2, 1, q.neonB));
      place(ctx, SPR[a.s], a.x, a.y, a.sc, { flip: a.flip, outline: rim });
      marks.push({ text: a.label, x: a.x, y: a.y + 6, cls: 'label' });
      if (a.bubble) marks.push({ text: a.bubble, x: a.x + w / 2 + 6, y: a.y - h - 5, cls: 'bubble' });
    }
    if (t.worldParticles) particles(ctx, t, rng(5));
    marks.push({ text: 'ORCA · DISPATCH', x: 160, y: 129, cls: 'label hub' });
    marks.push({ text: '→ task #42', x: 214, y: 120, cls: 'bubble' });
    return marks;
  }

  const SHEET_H = 64;
  function sceneSheet(ctx, t) {
    if (t.bg === 'paper') paper(ctx, t, rng(2)); else rect(ctx, 0, 0, W, SHEET_H, t.world.sky0);
    const items = [['clawd', 3, 'idle'], ['wave', 3, 'wave'], ['orca', 2, 'orca'], ['gemini', 3, 'gemini'], ['codex', 3, 'codex'], ['qwen', 3, 'qwen'], ['kimi', 3, 'kimi']];
    const total = items.reduce((s, [k, sc]) => s + size(SPR[k], sc)[0], 0);
    const gap = (W - total) / (items.length + 1);
    let x = gap;
    return items.map(([k, sc, label]) => {
      const [w] = size(SPR[k], sc);
      place(ctx, SPR[k], x + w / 2, 48, sc, k === 'orca' ? { outline: t.pal.neonA } : {});
      const m = { text: label, x: x + w / 2, y: 57, cls: 'label' };
      x += w + gap;
      return m;
    });
  }

  // ---------- post + DOM ----------
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const lum = (r, g, b) => r * 0.3 + g * 0.59 + b * 0.11;
  // Ordered-dither the frame down to a few colours. Luminance is stretched
  // between its 2nd/98th percentiles so dark and light scenes both survive.
  function quantize(ctx, w, h, pal, gamma = 1) {
    const levels = pal.map(hex).sort((a, b) => lum(...a) - lum(...b)), n = levels.length - 1;
    const img = ctx.getImageData(0, 0, w, h), d = img.data, count = w * h;
    const L = new Float32Array(count), hist = new Uint32Array(256);
    for (let i = 0; i < count; i++) { L[i] = lum(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]); hist[L[i] | 0]++; }
    let lo = 0, hi = 255;
    for (let v = 0, acc = 0; v < 256; v++) if ((acc += hist[v]) > count * 0.02) { lo = v; break; }
    for (let v = 255, acc = 0; v >= 0; v--) if ((acc += hist[v]) > count * 0.02) { hi = v; break; }
    for (let i = 0; i < count; i++) {
      const px = i % w, py = (i / w) | 0;
      let x = Math.min(1, Math.max(0, (L[i] - lo) / Math.max(1, hi - lo))) ** gamma;
      x += (BAYER[(py & 3) * 4 + (px & 3)] / 16 - 0.47) / n;
      const c = levels[Math.min(n, Math.max(0, Math.round(x * n)))];
      d[i * 4] = c[0]; d[i * 4 + 1] = c[1]; d[i * 4 + 2] = c[2];
    }
    ctx.putImageData(img, 0, 0);
  }

  // The 1-bit treatment can be layered on any theme.
  const ONE_BIT = {
    quantize: ['#312f28', '#b1aea7'], gamma: 0.85, bloom: 0, scan: 0,
    ui: { bg: '#b1aea7', fg: '#312f28', accent: '#312f28', accent2: '#312f28' },
  };
  const oneBit = () => location.hash === '#1bit';
  const styled = t => (oneBit() ? { ...t, ...ONE_BIT } : t);
  window.addEventListener('hashchange', () => location.reload());

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text) e.textContent = text;
    return e;
  }

  function stage(parent, t, paint, h = H) {
    const box = el('div', 'stage');
    box.style.aspectRatio = `${W} / ${h}`;
    const c = el('canvas');
    c.width = W; c.height = h;
    box.appendChild(c);
    parent.appendChild(box);
    const ctx = c.getContext('2d');
    const marks = paint(ctx, t);
    if (t.quantize) quantize(ctx, W, h, t.quantize, t.gamma);
    if (t.bloom) {
      const b = el('canvas', 'bloom');
      b.width = W; b.height = h;
      b.getContext('2d').drawImage(c, 0, 0);
      b.style.filter = `blur(${t.bloom}px) brightness(1.4)`;
      box.appendChild(b);
    }
    if (t.scan) { const s = el('div', 'scan'); s.style.opacity = t.scan; box.appendChild(s); }
    for (const m of marks) {
      const d = el('div', 'mark ' + m.cls, m.text);
      d.style.left = (m.x / W) * 100 + '%';
      d.style.top = (m.y / h) * 100 + '%';
      box.appendChild(d);
    }
    return box;
  }

  function skin(node, t) {
    const u = t.ui, s = node.style;
    s.setProperty('--bg', u.bg); s.setProperty('--fg', u.fg);
    s.setProperty('--accent', u.accent); s.setProperty('--accent2', u.accent2);
    s.setProperty('--font', t.font); s.setProperty('--fs', t.fontScale || 1);
  }

  function section(parent, title, note) {
    const s = el('section');
    s.appendChild(el('h2', '', title));
    if (note) s.appendChild(el('p', 'note', note));
    parent.appendChild(s);
    return s;
  }

  function toggle() {
    const b = el('button', 'toggle' + (oneBit() ? ' on' : ''), `◐ 1-BIT 抖动：${oneBit() ? '开' : '关'}`);
    b.onclick = () => { location.hash = oneBit() ? '' : '1bit'; };
    return b;
  }

  function page(id) {
    const themes = window.THEMES, i = themes.findIndex(x => x.id === id), t = styled(themes[i]);
    document.title = `${t.name} · 首屏风格`;
    skin(document.documentElement, t);
    const root = el('main');
    document.body.appendChild(root);

    const head = el('header');
    head.appendChild(el('div', 'kicker', `STYLE ${String(i + 1).padStart(2, '0')} / ${themes.length} · ${t.en}`));
    head.appendChild(el('h1', '', t.name));
    head.appendChild(el('p', 'desc', t.desc));
    const nav = el('nav');
    const home = el('a', '', '← 全部风格'); home.href = 'index.html' + location.hash; nav.appendChild(home);
    themes.forEach(o => { const a = el('a', o.id === id ? 'on' : '', o.name); a.href = `${o.id}.html${location.hash}`; nav.appendChild(a); });
    nav.appendChild(toggle());
    head.appendChild(nav);
    root.appendChild(head);

    stage(section(root, '01 · 门（首屏）', '打开页面看到的第一屏。敲门字样、提示文字是 HTML 叠加层，真实版本里会有震动 / 弹出动画。'), t, sceneDoor);
    const board = el('div', 'board');
    section(root, '02 · 过场分镜', '开门打招呼 → 冲进门里穿梭。这两段之后全自动播放。').appendChild(board);
    stage(board, t, sceneOpen);
    stage(board, t, sceneWarp);
    stage(section(root, '03 · Agent 世界', 'Orca 居中调度，各家 agent 散布四周；虚线 = 调度，细线 = agent 之间互相沟通，方块 = 正在流动的消息。'), t, sceneWorld);
    stage(section(root, '04 · 角色表', '全部是代码里的像素矩阵，可以直接导出成 spritesheet。'), t, sceneSheet, SHEET_H);
  }

  function gallery() {
    const root = el('main');
    document.body.appendChild(root);
    const head = el('header');
    head.appendChild(el('div', 'kicker', 'MAINSTAY_X · LANDING STYLE EXPLORATIONS'));
    head.appendChild(el('h1', '', '首屏风格探索'));
    head.appendChild(el('p', 'desc', '同一套构图、同一批像素精灵，换配色、背景、门和后期效果。点进去看完整的门 / 过场 / agent 世界 / 角色表。1-bit 抖动是一层处理，可以叠加在任何风格上。'));
    const nav = el('nav');
    nav.appendChild(toggle());
    head.appendChild(nav);
    root.appendChild(head);
    const grid = el('div', 'grid');
    root.appendChild(grid);
    window.THEMES.forEach((raw, i) => {
      const t = styled(raw), card = el('a', 'card');
      card.href = `${t.id}.html${location.hash}`;
      skin(card, t);
      stage(card, t, sceneDoor);
      card.appendChild(el('h3', '', `${String(i + 1).padStart(2, '0')} · ${t.name}`));
      card.appendChild(el('p', '', t.desc));
      grid.appendChild(card);
    });
  }

  window.Explore = { page, gallery };
})();
