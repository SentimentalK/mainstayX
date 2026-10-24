// Pixel-art style explorations for the "knock to enter" landing page.
// Chosen direction: synthwave. Everything is drawn at 320x180 and scaled up
// nearest-neighbour; the palette lives in theme.js.
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

  // ---------- backdrop ----------
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

  // ---------- the door ----------
  const DOOR_W = 36, DOOR_H = 60;
  function leaf(ctx, p, x, y, w, h, cx) {
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
  }

  function door(ctx, t, open) {
    const p = t.pal, w = DOOR_W, h = DOOR_H, cx = 160, x = cx - w / 2, y = GROUND - h;
    rect(ctx, cx - 22, y - 22, 44, 11, p.frame);
    frame(ctx, cx - 22, y - 22, 44, 11, p.neonA);
    rect(ctx, x - 6, y - 8, w + 12, h + 8, p.frame);
    rect(ctx, x - 6, y - 8, w + 12, 1, p.frameHi);
    rect(ctx, x - 6, y - 8, 1, h + 8, p.frameHi);
    rect(ctx, cx - 8, y - 6, 16, 2, open ? p.neonA : p.neonB); // status light
    rect(ctx, x - 2, y - 2, w + 4, 1, p.neonA);
    rect(ctx, x - 2, y - 2, 1, h + 2, p.neonA);
    rect(ctx, x + w + 1, y - 2, 1, h + 2, p.neonA);
    rect(ctx, x + w + 2, y + 24, 3, 9, p.doorDark);
    for (let i = 0; i < 3; i++) rect(ctx, x + w + 3, y + 25 + i * 3, 1, 1, i === 2 ? p.neonB : p.neonA);
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
      leaf(ctx, p, x, y, w, h, cx);
      alpha(ctx, 0.5, () => rect(ctx, x - 2, GROUND + 2, w + 4, 1, p.neonA));
    }
    rect(ctx, x - 8, GROUND, w + 16, 2, p.frameHi);
    return { signY: y - 16.5 };
  }

  // ---------- scenes ----------
  function sceneDoor(ctx, t) {
    synth(ctx, t, rng(7));
    const d = door(ctx, t, 0);
    return [
      { text: 'MAINSTAY_X', x: 160, y: d.signY, cls: 'sign' },
      { text: 'KNOCK!', x: 212, y: 98, cls: 'knock' },
      { text: 'KNOCK', x: 110, y: 116, cls: 'knock small' },
      { text: '▶ CLICK TO KNOCK', x: 160, y: 166, cls: 'hint' },
    ];
  }

  function sceneOpen(ctx, t) {
    synth(ctx, t, rng(7));
    door(ctx, t, 0.82);
    place(ctx, SPR.wave, 160, GROUND, 2);
    return [{ text: 'HI!', x: 182, y: GROUND - 24, cls: 'bubble' }];
  }

  function sceneWarp(ctx, t) {
    const p = t.pal, r = rng(3), cx = 160, cy = 92;
    for (let k = 1; k < 9; k++) {
      const s = Math.pow(1.5, k), w = 10 * s, h = 6 * s;
      frame(ctx, cx - w / 2, cy - h / 2, w, h, mix(p.neonA, p.warp0, k / 9));
    }
    const cols = [p.neonA, p.neonB, '#ffffff'];
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

  // ---------- agent world ----------
  const HZ = 70;
  function worldGrid(ctx, t, r) {
    const p = t.world, q = t.pal;
    bands(ctx, 0, HZ, p.sky0, p.sky1, 7);
    for (let i = 0; i < 70; i++) alpha(ctx, 0.3 + r() * 0.7, () => rect(ctx, r() * W, r() * (HZ - 4), 1, 1, q.star));
    rect(ctx, 0, HZ, W, H - HZ, p.floor);
    for (let k = 1; k < 10; k++) rect(ctx, 0, HZ + Math.round((H - HZ) * (k / 9) ** 2), W, 1, p.grid);
    for (let i = -16; i <= 16; i++) line(ctx, 160 + i * 8, HZ, 160 + i * 44, H, p.grid);
    alpha(ctx, 0.6, () => rect(ctx, 0, HZ, W, 1, q.neonA));
  }

  function sceneWorld(ctx, t) {
    const q = t.pal;
    worldGrid(ctx, t, rng(11));

    const crew = [
      { s: 'clawd', x: 62, y: 98, sc: 2, label: 'CLAUDE', bubble: 'on it!' },
      { s: 'clawd', x: 112, y: 76, sc: 1, label: 'sub-agent', flip: true, run: true },
      { s: 'gemini', x: 92, y: 160, sc: 2, label: 'GEMINI', run: true },
      { s: 'codex', x: 234, y: 160, sc: 2, label: 'CODEX', bubble: '>_ done' },
      { s: 'qwen', x: 268, y: 100, sc: 2, label: 'QWEN', flip: true },
      { s: 'kimi', x: 212, y: 78, sc: 2, label: 'KIMI', bubble: '?' },
    ];

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

    alpha(ctx, 0.5, () => ellipse(ctx, 160, 114, 46, 9, q.neonA));
    ellipse(ctx, 160, 114, 34, 6, q.neonA);
    place(ctx, SPR.orca, 160, 110, 2, { outline: q.neonA });

    const rim = mix(q.neonA, '#000000', 0.45), marks = [];
    for (const a of crew) {
      const [w, h] = size(SPR[a.s], a.sc);
      alpha(ctx, 0.5, () => rect(ctx, a.x - w / 2 + 2, a.y, w - 4, 1, '#000000'));
      if (a.run) for (let k = 0; k < 3; k++) alpha(ctx, 0.6 - k * 0.18, () => rect(ctx, a.x + (a.flip ? 1 : -1) * (w / 2 + 2 + k * 3), a.y - 1 - (k & 1), 2, 1, q.neonB));
      place(ctx, SPR[a.s], a.x, a.y, a.sc, { flip: a.flip, outline: rim });
      marks.push({ text: a.label, x: a.x, y: a.y + 6, cls: 'label' });
      if (a.bubble) marks.push({ text: a.bubble, x: a.x + w / 2 + 6, y: a.y - h - 5, cls: 'bubble' });
    }
    marks.push({ text: 'ORCA · DISPATCH', x: 160, y: 129, cls: 'label hub' });
    marks.push({ text: '→ task #42', x: 214, y: 120, cls: 'bubble' });
    return marks;
  }

  const SHEET_H = 64;
  function sceneSheet(ctx, t) {
    rect(ctx, 0, 0, W, SHEET_H, t.world.sky0);
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

  function page() {
    const t = window.THEME;
    document.title = `${t.name} · 首屏风格`;
    skin(document.documentElement, t);
    const root = el('main');
    document.body.appendChild(root);

    const head = el('header');
    head.appendChild(el('div', 'kicker', `MAINSTAY_X · LANDING STYLE · ${t.en}`));
    head.appendChild(el('h1', '', t.name));
    head.appendChild(el('p', 'desc', t.desc));
    root.appendChild(head);

    stage(section(root, '01 · 门（首屏）', '打开页面看到的第一屏。敲门字样、提示文字是 HTML 叠加层，真实版本里会有震动 / 弹出动画。'), t, sceneDoor);
    const board = el('div', 'board');
    section(root, '02 · 过场分镜', '开门打招呼 → 冲进门里穿梭。这两段之后全自动播放。').appendChild(board);
    stage(board, t, sceneOpen);
    stage(board, t, sceneWarp);
    stage(section(root, '03 · Agent 世界', 'Orca 居中调度，各家 agent 散布四周；虚线 = 调度，细线 = agent 之间互相沟通，方块 = 正在流动的消息。'), t, sceneWorld);
    stage(section(root, '04 · 角色表', '全部是代码里的像素矩阵，可以直接导出成 spritesheet。'), t, sceneSheet, SHEET_H);
  }

  window.Explore = { page };
})();
