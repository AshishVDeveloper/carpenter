/* Mumbai Interior — furniture structure drawings with sizes (3D view, front, top and side views).
   Shared by the site build (Node), the website and the admin drawing editor. Our own code: no outside library or service.
   All sizes are in inches. A drawing is { fs, els: [elements] }; every element is plain data, so the admin can edit it. */
(function (root, factory) { if (typeof module === 'object' && module.exports) module.exports = factory(); else root.VS = factory(); })(this, function () {
'use strict';
const INK = '#3a2a1c', NAVY = '#123e7c', WOOD = '#c68a52', TOPW = '#dba46c', SIDEW = '#a96f3b', WHITE = '#f8f6f1',
  GLASS = '#d4e9f2', MIRROR = '#e2edf1', LED = '#ffe39a', SHADE = '#e9e2d4', METAL = '#b9bec4';
const r1 = n => Math.round((+n || 0) * 100) / 100;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
/* 66 → 5'6"   72 → 6'   9 → 9"   (half inches kept) */
function ftin(n) { n = Math.round((+n || 0) * 2) / 2; const neg = n < 0; n = Math.abs(n); const f = Math.floor(n / 12), i = r1(n - f * 12); return (neg ? '-' : '') + (!f ? i + '"' : !i ? f + "'" : f + "'" + i + '"'); }
const sqft = (a, b) => Math.round(a * b / 144 * 100) / 100;

/* ── element makers ── */
const R = (x, y, w, h, o) => Object.assign({ t: 'rect', x: r1(x), y: r1(y), w: r1(w), h: r1(h), fill: WHITE, stroke: INK, sw: .45 }, o);
const L = (x1, y1, x2, y2, o) => Object.assign({ t: 'line', x1: r1(x1), y1: r1(y1), x2: r1(x2), y2: r1(y2), stroke: INK, sw: .35 }, o);
const T = (x, y, text, size, o) => Object.assign({ t: 'text', x: r1(x), y: r1(y), text: String(text), size: r1(size), fill: INK, anchor: 'middle' }, o);
const C = (x, y, r, o) => Object.assign({ t: 'circle', x: r1(x), y: r1(y), r: r1(r), fill: 'none', stroke: INK, sw: .3 }, o);
const P = (pts, o) => Object.assign({ t: 'poly', pts: pts.map(p => [r1(p[0]), r1(p[1])]), fill: WHITE, stroke: INK, sw: .45, closed: true }, o);
const DM = (x1, y1, x2, y2, off, size, o) => Object.assign({ t: 'dim', x1: r1(x1), y1: r1(y1), x2: r1(x2), y2: r1(y2), off: r1(off), size: r1(size), text: '', stroke: NAVY }, o);

/* drawing context: elements are grouped by box, so each box's 3D faces sit behind its own front */
function ctx(fs) {
  const k = { fs, els: [], boxes: [], g: -1, depth: null };
  k.add = (...a) => { a.forEach(e => { if (e) { if (k.g >= 0 && e._g === undefined) e._g = k.g; k.els.push(e); } }); return k; };
  k.box = (x, y, w, h, d, main) => { k.boxes.push({ x, y, w, h, d: Math.max(0, d || 0), i: k.boxes.length }); k.g = k.boxes.length - 1; if (main) k.depth = k.boxes[k.g]; return k.g; };
  k.free = () => { k.g = -1; };
  return k;
}
const hV = (k, x, y, len) => k.add(R(x - .5, y - len / 2, 1, len, { fill: METAL, stroke: '#6f757b', sw: .25, r: .5 }));
const hH = (k, x, y, len) => k.add(R(x - len / 2, y - .5, len, 1, { fill: METAL, stroke: '#6f757b', sw: .25, r: .5 }));
function refl(k, x, y, w, h, c) { k.add(L(x + w * .2, y + h * .32, x + w * .48, y + h * .12, { stroke: c || '#93bfd2', sw: .3 }), L(x + w * .3, y + h * .44, x + w * .6, y + h * .22, { stroke: c || '#93bfd2', sw: .3 })); }
/* a row of n shutters in (x,y,w,h). hp: 'side' tall doors (handles where pairs meet), 'bottom' loft, 'top' base cabinets */
function doors(k, x, y, w, h, n, fill, hp, o) {
  o = o || {}; n = Math.max(1, n | 0); const dw = w / n, g = .35;
  for (let i = 0; i < n; i++) {
    const dx = x + i * dw;
    k.add(R(dx + g, y + g, dw - 2 * g, h - 2 * g, { fill, sw: .4 }));
    if (o.frame && dw > 8 && h > 8) k.add(R(dx + 2.6, y + 2.6, dw - 5.2, h - 5.2, { fill: o.inner || fill, sw: .3 }));
    if (o.refl) refl(k, dx + g, y + g, dw - 2 * g, h - 2 * g, o.reflC);
    const right = (n % 2 && i === n - 1) ? true : i % 2 === 0, hx = right ? dx + dw - 2.2 : dx + 2.2;
    if (n === 1 && hp !== 'side') { hH(k, dx + dw / 2, hp === 'top' ? y + 2.6 : y + h - 2.6, Math.min(6, dw * .4)); continue; }
    if (hp === 'side') hV(k, hx, y + h * (o.hy || .5), Math.min(9, h * .16));
    else if (hp === 'bottom') hV(k, hx, y + h - Math.min(3.5, h * .28), Math.min(3.5, h * .3));
    else hV(k, hx, y + Math.min(3.5, h * .28), Math.min(3.5, h * .3));
  }
}
/* drawers stacked (n rows) or side by side (row) */
function drawers(k, x, y, w, h, n, fill) { n = Math.max(1, n | 0); const dh = h / n; for (let i = 0; i < n; i++) { k.add(R(x + .35, y + i * dh + .35, w - .7, dh - .7, { fill, sw: .4 })); hH(k, x + w / 2, y + i * dh + dh / 2, Math.min(8, w * .35)); } }
function drawRow(k, x, y, w, h, n, fill) { n = Math.max(1, n | 0); const dw = w / n; for (let i = 0; i < n; i++) { k.add(R(x + i * dw + .35, y + .35, dw - .7, h - .7, { fill, sw: .4 })); hH(k, x + i * dw + dw / 2, y + h / 2, Math.min(8, dw * .4)); } }
function jali(k, x, y, w, h, step, c) { step = Math.max(2.5, step || 4); const nx = Math.floor(w / step), ny = Math.floor(h / step); if (nx < 1 || ny < 1 || nx * ny > 900) return; const ox = x + (w - nx * step) / 2 + step / 2, oy = y + (h - ny * step) / 2 + step / 2;
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) k.add(C(ox + i * step, oy + j * step, step * .42, { stroke: c || '#9a7330', sw: .22 }), C(ox + i * step, oy + j * step, step * .16, { stroke: c || '#9a7330', sw: .2 })); }
function grooves(k, x, y, w, h, step, c) { if (!(step > 0)) return; for (let xx = x + step; xx < x + w - .5; xx += step) k.add(L(xx, y, xx, y + h, { stroke: c || 'rgba(60,40,20,.35)', sw: .25 })); }
function shelves(k, x, y, w, h, step, c) { for (let yy = y + step; yy < y + h - 2; yy += step) k.add(R(x, yy - .4, w, .8, { fill: c || WOOD, sw: .25 })); }
/* scalloped mandir arch over a niche: base arch with small outward scallops (cusps point inward) */
function scallopArch(x, y, w, ah) {
  const N = 9, base = []; for (let i = 0; i <= N; i++) { const s = i / N, a = Math.PI * s; base.push([x + w / 2 - Math.cos(a) * w / 2, y + ah - Math.sin(a) * ah * .78 - ah * .22 * Math.pow(1 - Math.abs(2 * s - 1), 2.2)]); }
  const pts = [[x, y + ah + 1]];
  for (let i = 0; i < N; i++) { const [ax, ay] = base[i], [bx, by] = base[i + 1], dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1, nx = dy / len, ny = -dx / len;
    for (let u = 0; u <= 6; u++) { const t = u / 6, b = Math.sin(Math.PI * t) * len * .32; pts.push([ax + dx * t + nx * b, ay + dy * t + ny * b]); } }
  pts.push([x + w, y + ah + 1]); return pts;
}

/* ── field helpers for the admin form ── */
const len = (key, label, def, min) => ({ key, label, kind: 'len', def, min: min ?? 1 });
const int = (key, label, def, min, max) => ({ key, label, kind: 'int', def, min, max });
const bool = (key, label, def) => ({ key, label, kind: 'bool', def });
const col = (key, label, def) => ({ key, label, kind: 'color', def });
const sel = (key, label, def, opts) => ({ key, label, kind: 'sel', def, opts });
const WOODF = col('wood', 'Frame (carcass) colour', WOOD);
const COMMON = [sel('view', 'Main view', '3d', [['3d', '3D view'], ['front', 'Front view (flat)']]), bool('top', 'Show top view', true), bool('side', 'Show side view', true)];

/* ── furniture types: form fields, area for estimates, and the drawing ── */
const TYPES = {
  wardrobe: { name: 'Wardrobe (hinged doors)', fields: [len('W', 'Width', 72), len('H', 'Height', 87), len('D', 'Depth', 24), int('doors', 'Doors', 4, 1, 12), len('loft', 'Loft height (0 = none)', 0, 0), int('drawers', 'Drawer rows at bottom', 0, 0, 4), col('color', 'Shutter colour', WHITE), WOODF],
    area: p => sqft(p.W, p.H),
    draw(p, k) { const { W, H } = p, f = k.fs, t = .75, pl = 3, lf = Math.min(p.loft, H - 24), drH = 7, dz = p.drawers * drH, cols = Math.max(1, Math.ceil(p.doors / 2));
      k.box(0, 0, W, H, p.D, 1); k.add(R(0, 0, W, H, { fill: p.wood, sw: .6 }));
      if (lf > 0) { doors(k, t, t, W - 2 * t, lf - t, cols, p.color, 'bottom'); k.add(R(0, lf - .4, W, .8, { fill: p.wood, sw: .25 })); }
      const yB = H - pl, yD = yB - dz;
      for (let r = 0; r < p.drawers; r++) drawRow(k, t, yD + r * drH, W - 2 * t, drH, cols, p.color);
      doors(k, t, Math.max(t, lf), W - 2 * t, yD - Math.max(t, lf), p.doors, p.color, 'side');
      k.add(R(t, yB, W - 2 * t, pl - .2, { fill: SHADE, sw: .3 })); k.free();
      k.add(DM(0, 0, W, 0, -f * 2.6, f), DM(W, 0, W, H, -f * 2.6, f), DM(t, H, t + (W - 2 * t) / p.doors, H, f * 2.6, f));
      if (lf > 0) k.add(DM(0, 0, 0, lf, f * 2.6, f), DM(0, lf, 0, H, f * 2.6, f)); } },
  sliding: { name: 'Sliding wardrobe', fields: [len('W', 'Width', 96), len('H', 'Height', 87), len('D', 'Depth', 24), int('panels', 'Sliding panels', 2, 2, 4), len('loft', 'Loft height (0 = none)', 0, 0), bool('band', 'Contrast band across doors', false), col('color', 'Door colour', '#8b6b55'), col('color2', 'Band colour', WHITE), WOODF],
    area: p => sqft(p.W, p.H),
    draw(p, k) { const { W, H } = p, f = k.fs, t = .75, lf = Math.min(p.loft, H - 30), rail = 1.6, n = Math.max(2, p.panels), ov = 2.5, iw = W - 2 * t, pw = (iw + (n - 1) * ov) / n;
      k.box(0, 0, W, H, p.D, 1); k.add(R(0, 0, W, H, { fill: p.wood, sw: .6 }));
      if (lf > 0) doors(k, t, t, iw, lf - t, n, p.color, 'bottom');
      const y0 = Math.max(t, lf), h = H - t - y0;
      k.add(R(t, y0, iw, rail, { fill: METAL, sw: .3 }), R(t, H - t - rail, iw, rail, { fill: METAL, sw: .3 }));
      const order = [...Array(n).keys()].sort((a, b) => (a % 2) - (b % 2));
      for (const i of order) { const x = t + i * (pw - ov);
        k.add(R(x, y0 + rail, pw, h - 2 * rail, { fill: p.color, sw: i % 2 ? .6 : .4 }));
        if (p.band) k.add(R(x, y0 + rail + (h - 2 * rail) * .42, pw, (h - 2 * rail) * .1, { fill: p.color2, sw: .3 }));
        k.add(R(x + (i % 2 ? pw - 1.3 : .3), y0 + rail, 1, h - 2 * rail, { fill: '#d0d4d8', stroke: '#7d838a', sw: .2 })); }
      k.free(); k.add(DM(0, 0, W, 0, -f * 2.6, f), DM(W, 0, W, H, -f * 2.6, f), DM(t, H, t + pw, H, f * 2.6, f));
      if (lf > 0) k.add(DM(0, 0, 0, lf, f * 2.6, f), DM(0, lf, 0, H, f * 2.6, f)); } },
  bed: { name: 'Bed', fields: [len('W', 'Bed width', 66), len('L', 'Bed length', 78), len('headH', 'Headboard height', 42), len('baseH', 'Base height', 14), sel('storage', 'Storage', 'hydraulic', [['hydraulic', 'Hydraulic lift-up'], ['drawers', 'Side drawers'], ['none', 'No storage']]), col('color', 'Bed colour', '#b48a6a'), WOODF],
    area: p => sqft(p.W, p.L), size: p => 'W ' + ftin(p.W) + ' × L ' + ftin(p.L) + ' × H ' + ftin(p.headH),
    /* the 3D view looks at the side of the bed; the "side view" is the foot end, the top view the plan with pillows */
    draw(p, k) { const { W, L: Lg } = p, f = k.fs, hh = Math.max(p.headH, p.baseH + 8), bh = p.baseH, mt = 7, fl = hh;
      k.box(3, fl - bh, Lg - 3, bh, W, 1); k.add(R(3, fl - bh, Lg - 3, bh, { fill: p.color, sw: .6 }));
      if (p.storage === 'drawers') { const n = Math.max(2, Math.round((Lg - 3) / 30)), w = (Lg - 9) / n; for (let i = 0; i < n; i++) { k.add(R(6 + i * w, fl - bh + 2, w - 1.5, bh - 4, { fill: p.color, sw: .4 })); hH(k, 6 + i * w + (w - 1.5) / 2, fl - bh / 2, Math.min(8, w * .3)); } }
      if (p.storage === 'hydraulic') k.add(L(3, fl - bh + 2.5, Lg, fl - bh + 2.5, { dash: '1.5 1', stroke: '#6b5a48' }), T((Lg + 3) / 2, fl - bh / 2 + f * .6, 'Lift-up storage inside', f * .75, { fill: '#4a3a2a' }));
      k.box(3, fl - bh - mt, Lg - 3, mt, W - 2); k.add(R(3, fl - bh - mt, Lg - 3, mt, { fill: WHITE, sw: .4, r: 2 }));
      k.box(0, 0, 3, hh, W); k.add(R(0, 0, 3, hh, { fill: p.wood, sw: .6 }));
      k.free(); k.add(DM(0, fl, Lg, fl, f * 2.6, f), DM(0, 0, 0, fl, f * 2.6, f), DM(Lg, fl - bh, Lg, fl, -f * 2.6, f)); },
    top(p, k, x0, y0) { const { W, L: Lg } = p, f = k.fs, pw = Math.min(26, (W - 9) / 2);
      k.add(R(x0, y0, W, 3, { fill: p.wood, sw: .5 }), R(x0, y0 + 3, W, Lg - 3, { fill: p.color, sw: .5 }), R(x0 + 1.5, y0 + 4.5, W - 3, Lg - 6, { fill: WHITE, sw: .4, r: 2 }),
        R(x0 + 3, y0 + 7, pw, 12, { fill: '#efece6', sw: .3, r: 3 }), R(x0 + W - 3 - pw, y0 + 7, pw, 12, { fill: '#efece6', sw: .3, r: 3 }));
      k.add(DM(x0, y0, x0 + W, y0, -f * 2.6, f), DM(x0 + W, y0, x0 + W, y0 + Lg, -f * 2.6, f)); return [W, Lg]; },
    side(p, k, x0, y0) { const { W } = p, f = k.fs, hh = Math.max(p.headH, p.baseH + 8), bh = p.baseH;
      k.add(R(x0, y0, W, hh, { fill: p.wood, sw: .5 }), R(x0 + 1, y0 + hh - bh - 7, W - 2, 7, { fill: WHITE, sw: .4, r: 2 }), R(x0, y0 + hh - bh, W, bh, { fill: p.color, sw: .5 }));
      k.add(DM(x0, y0 + hh, x0 + W, y0 + hh, f * 2.6, f), DM(x0 + W, y0, x0 + W, y0 + hh, -f * 2.6, f)); return [W, hh]; } },
  tv: { name: 'TV unit', fields: [len('W', 'Width', 96), len('H', 'Wall panel height', 96), len('unitH', 'Console height', 18), len('D', 'Console depth', 16), int('tv', 'TV size (inches)', 55, 24, 100), bool('floating', 'Wall-hung (floating) console', false), len('gap', 'Gap under console', 10, 0), len('sideW', 'Side unit width (0 = none)', 0, 0), sel('kind', 'Side unit', 'shelves', [['shelves', 'Open shelves'], ['jali', 'Back-lit jali pooja niche'], ['glass', 'Glass display']]), bool('fluted', 'Fluted wall panel', false), int('drawers', 'Console drawers', 2, 1, 6), col('color', 'Console colour', '#a9805c'), col('color2', 'Wall panel colour', '#e9dfcf'), WOODF],
    area: p => sqft(p.W, p.H),
    draw(p, k) { const { W, H } = p, f = k.fs, sw = Math.min(p.sideW, W - 30), mw = W - sw, uh = Math.min(p.unitH, H - 30), fl = H, cy = fl - (p.floating ? p.gap : 0) - uh;
      k.box(0, 0, mw, H, 1.5, 0); k.add(R(0, 0, mw, H, { fill: p.color2, sw: .6 })); if (p.fluted) grooves(k, 0, 0, mw, H, 3);
      const tw = p.tv * .872, th = p.tv * .49, tx = mw / 2 - tw / 2, ty = Math.min(fl - 42 - th / 2, cy - 6 - th);
      if (tw < mw - 4 && ty > 2) k.add(R(tx, ty, tw, th, { fill: '#1e2124', stroke: '#0c0d0e', sw: .6, r: .6 }), T(mw / 2, ty + th / 2 + f * .35, p.tv + '" TV', f, { fill: '#d9dde1' }));
      if (sw > 0) { const sx = mw; k.box(sx, 0, sw, H, p.D); k.add(R(sx, 0, sw, H, { fill: p.wood, sw: .6 }));
        if (p.kind === 'jali') { const ny = H * .3, nh = H * .32; shelves(k, sx + .75, .75, sw - 1.5, ny - .75, 13); k.add(R(sx + 1.5, ny, sw - 3, nh, { fill: LED, sw: .4 })); jali(k, sx + 1.5, ny, sw - 3, nh, 4.5); doors(k, sx + .75, ny + nh + 1, sw - 1.5, fl - ny - nh - 1.75, sw >= 24 ? 2 : 1, p.color, 'top'); }
        else if (p.kind === 'glass') { const gh = H * .6; k.add(R(sx + 1.5, 1.5, sw - 3, gh, { fill: GLASS, sw: .4 })); refl(k, sx + 1.5, 1.5, sw - 3, gh); shelves(k, sx + 1.5, 1.5, sw - 3, gh, 14, 'rgba(120,160,180,.6)'); doors(k, sx + .75, gh + 3, sw - 1.5, H - gh - 3.75, sw >= 24 ? 2 : 1, p.color, 'top'); }
        else shelves(k, sx + .75, 0, sw - 1.5, H, 14); }
      k.box(0, cy, mw, uh, p.D, 1); k.add(R(0, cy, mw, uh, { fill: p.wood, sw: .6 })); drawRow(k, .75, cy + .75, mw - 1.5, uh - (p.floating ? 1.5 : 3.5), p.drawers, p.color);
      if (!p.floating) k.add(R(.75, fl - 2.6, mw - 1.5, 2.4, { fill: SHADE, sw: .3 }));
      k.free(); k.add(DM(0, 0, W, 0, -f * 2.6, f), DM(W, 0, W, H, -f * 2.6, f), DM(0, cy, 0, cy + uh, f * 2.6, f));
      if (p.floating && p.gap > 0) k.add(DM(0, cy + uh, 0, fl, f * 2.6, f));
      if (sw > 0) k.add(DM(mw, H, W, H, f * 2.6, f)); } },
  kitchen: { name: 'Kitchen (base and loft)', fields: [len('L', 'Length', 108), bool('base', 'Base cabinets', true), len('counterH', 'Counter height', 34), len('D', 'Base depth', 24), len('loft', 'Loft / wall cabinet height (0 = none)', 0, 0), len('loftAt', 'Loft bottom from floor', 78), len('loftD', 'Loft depth', 14), col('color', 'Base shutter colour', WHITE), col('color2', 'Loft shutter colour', WHITE), WOODF],
    area: p => r1((p.base ? sqft(p.L, 36) : 0) + (p.loft > 0 ? sqft(p.L, p.loft) : 0)), size: p => 'L ' + ftin(p.L) + (p.base ? ' × H ' + ftin(p.counterH) + ' × D ' + ftin(p.D) : '') + (p.loft > 0 ? ' · loft ' + ftin(p.loft) : ''),
    draw(p, k) { const Lg = p.L, f = k.fs, ch = p.counterH, lf = p.loft > 0 ? p.loft : 0, la = Math.max(p.loftAt, ch + 12), fl = Math.max(lf ? la + lf : 0, ch), n = Math.max(1, Math.round(Lg / 24)), uw = Lg / n;
      if (lf) { const ly = fl - la - lf; k.box(0, ly, Lg, lf, p.loftD); k.add(R(0, ly, Lg, lf, { fill: p.wood, sw: .6 })); doors(k, .75, ly + .75, Lg - 1.5, lf - 1.5, n, p.color2, 'bottom');
        k.free(); k.add(DM(0, ly, 0, ly + lf, f * 2.6, f), DM(0, ly + lf, 0, fl, f * 2.6, f), DM(0, ly, Lg, ly, -f * 2.6, f)); }
      if (p.base) { const by = fl - ch; k.box(0, by, Lg, ch, p.D, 1); k.add(R(0, by + 1.5, Lg, ch - 1.5, { fill: p.wood, sw: .6 }), R(-.8, by, Lg + 1.6, 1.6, { fill: '#3b3d3f', stroke: '#222', sw: .4 }));
        for (let i = 0; i < n; i++) { const x = i * uw + .4, w = uw - .8; if (i === 0) drawers(k, x, by + 2, w, ch - 6.5, 3, p.color); else doors(k, x, by + 2, w, ch - 6.5, uw >= 30 ? 2 : 1, p.color, 'top'); }
        k.add(R(.75, fl - 4, Lg - 1.5, 3.8, { fill: SHADE, sw: .3 }));
        k.free(); k.add(DM(Lg, by, Lg, fl, -f * 2.6, f), DM(0, fl, uw, fl, f * 2.6, f)); if (!lf) k.add(DM(0, by, Lg, by, -f * 2.6, f)); }
      k.free(); k.add(L(-6, fl, Lg + 6, fl, { stroke: '#8a8a85', sw: .5 })); },
    top(p, k, x0, y0) { const f = k.fs, d = Math.max(p.base ? p.D : 0, p.loft > 0 ? p.loftD : 0) || 24; k.add(R(x0, y0, p.L, d, { fill: p.base ? '#3b3d3f' : p.wood, sw: .5 })); k.add(DM(x0, y0, x0 + p.L, y0, -f * 2.6, f), DM(x0 + p.L, y0, x0 + p.L, y0 + d, -f * 2.6, f)); return [p.L, d]; },
    side(p, k, x0, y0) { const f = k.fs, ch = p.counterH, lf = p.loft > 0 ? p.loft : 0, la = Math.max(p.loftAt, ch + 12), fl = Math.max(lf ? la + lf : 0, ch), d = Math.max(p.base ? p.D : 0, lf ? p.loftD : 0);
      if (lf) k.add(R(x0, y0 + fl - la - lf, p.loftD, lf, { fill: p.wood, sw: .5 }));
      if (p.base) k.add(R(x0, y0 + fl - ch + 1.5, p.D, ch - 1.5, { fill: p.wood, sw: .5 }), R(x0, y0 + fl - ch, p.D + .8, 1.6, { fill: '#3b3d3f', sw: .3 }), DM(x0, y0 + fl, x0 + p.D, y0 + fl, f * 2.6, f));
      if (lf && !p.base) k.add(DM(x0, y0 + fl - la, x0 + p.loftD, y0 + fl - la, f * 2.6, f));
      return [d, fl]; } },
  cabinet: { name: 'Loft / cabinet box', fields: [len('W', 'Width', 96), len('H', 'Height', 30), len('D', 'Depth', 24), int('doors', 'Doors', 4, 1, 12), bool('frame', 'Frame (moulded) doors', false), sel('kind', 'Door type', 'plain', [['plain', 'Plain'], ['glass', 'Glass'], ['mirror', 'Mirror']]), col('color', 'Shutter colour', WHITE), WOODF],
    area: p => sqft(p.W, p.H),
    draw(p, k) { const { W, H } = p, f = k.fs; k.box(0, 0, W, H, p.D, 1); k.add(R(0, 0, W, H, { fill: p.wood, sw: .6 }));
      const fill = p.kind === 'glass' ? GLASS : p.kind === 'mirror' ? MIRROR : p.color;
      doors(k, .75, .75, W - 1.5, H - 1.5, p.doors, fill, H >= 36 ? 'side' : 'bottom', { frame: p.frame, inner: p.kind === 'plain' ? '#ffffff' : fill, refl: p.kind !== 'plain' });
      k.free(); k.add(DM(0, 0, W, 0, -f * 2.6, f), DM(W, 0, W, H, -f * 2.6, f)); if (p.doors > 1) k.add(DM(.75, H, .75 + (W - 1.5) / p.doors, H, f * 2.6, f)); } },
  door: { name: 'Door with frame', fields: [len('W', 'Door width', 36), len('H', 'Door height', 84), len('D', 'Frame depth', 5), len('frame', 'Frame width', 3), bool('jali', 'CNC jali panel', true), len('clad', 'Wall cladding each side (0 = none)', 0, 0), col('color', 'Door colour', '#6b4a33'), col('color2', 'Jali colour', '#d9b779'), WOODF],
    area: p => sqft(p.W + 2 * p.frame + 2 * p.clad, p.H + p.frame), size: p => 'Door ' + ftin(p.W) + ' × ' + ftin(p.H) + (p.clad > 0 ? ' · total ' + ftin(p.W + 2 * p.frame + 2 * p.clad) + ' wide' : ''),
    draw(p, k) { const f = k.fs, fr = p.frame, cl = p.clad, W = p.W, H = p.H, X = cl + fr, TW = W + 2 * fr + 2 * cl, TH = H + fr;
      if (cl > 0) { k.box(0, 0, cl, TH, 1); k.add(R(0, 0, cl, TH, { fill: p.wood, sw: .5 })); grooves(k, 0, 0, cl, TH, 4); k.box(TW - cl, 0, cl, TH, 1); k.add(R(TW - cl, 0, cl, TH, { fill: p.wood, sw: .5 })); grooves(k, TW - cl, 0, cl, TH, 4); }
      k.box(cl, 0, W + 2 * fr, TH, p.D, 1); k.add(R(cl, 0, W + 2 * fr, TH, { fill: SIDEW, sw: .6 }), R(X, fr, W, H, { fill: p.color, sw: .6 }));
      if (p.jali) { const jx = X + 5, jy = fr + 9, jw = W - 10, jh = H * .52; k.add(R(jx, jy, jw, jh, { fill: p.color2, sw: .4 })); jali(k, jx, jy, jw, jh, 4.5, '#5a3a22'); }
      hV(k, X + W - 4, fr + H * .5, 18); k.add(C(X + W - 4, fr + H * .5 + 12, .9, { fill: METAL }));
      k.free(); k.add(L(-6, TH, TW + 6, TH, { stroke: '#8a8a85', sw: .5 }), DM(X, TH, X + W, TH, f * 2.6, f), DM(TW, fr, TW, TH, -f * 2.6, f));
      if (cl > 0 || fr > 0) k.add(DM(0, 0, TW, 0, -f * 2.6, f)); if (cl > 0) k.add(DM(0, TH, cl, TH, f * 2.6, f)); } },
  open: { name: 'Open shelf unit', fields: [len('W', 'Width', 36), len('H', 'Height', 72), len('D', 'Depth', 12), int('cols', 'Columns', 2, 1, 8), int('rows', 'Shelf rows', 5, 1, 12), WOODF],
    area: p => sqft(p.W, p.H),
    draw(p, k) { const { W, H } = p, f = k.fs, t = .75; k.box(0, 0, W, H, p.D, 1); k.add(R(0, 0, W, H, { fill: p.wood, sw: .6 }), R(t, t, W - 2 * t, H - 2 * t, { fill: WHITE, sw: .3 }));
      for (let i = 1; i < p.cols; i++) k.add(R(i * W / p.cols - t / 2, t, t, H - 2 * t, { fill: p.wood, sw: .25 }));
      for (let j = 1; j < p.rows; j++) k.add(R(t, j * H / p.rows - t / 2, W - 2 * t, t, { fill: p.wood, sw: .25 }));
      k.free(); k.add(DM(0, 0, W, 0, -f * 2.6, f), DM(W, 0, W, H, -f * 2.6, f), DM(0, 0, 0, H / p.rows, f * 2.6, f)); } },
  mandir: { name: 'Mandir (pooja unit)', fields: [len('W', 'Width', 45), len('H', 'Height', 96), len('D', 'Depth', 15), len('platform', 'Platform height', 36), int('doors', 'Doors below', 2, 1, 4), bool('drawer', 'Drawers above doors', true), bool('jali', 'Back-lit jali in niche', false), col('color', 'Shutter colour', WHITE), WOODF],
    area: p => sqft(p.W, p.H),
    draw(p, k) { const { W, H } = p, f = k.fs, t = 1.2, pf = Math.min(p.platform, H - 30), by = H - pf, dh = p.drawer ? 6 : 0, pl = 3;
      k.box(0, 0, W, H, p.D, 1); k.add(R(0, 0, W, H, { fill: p.wood, sw: .6 }), R(t, t, W - 2 * t, by - t - .6, { fill: '#efe9df', sw: .35 }));
      const nx = t + 3, nw = W - 2 * t - 6, ah = Math.min(nw * .42, 18), ny = t + 3;
      k.add(R(nx, ny + ah, nw, by - ny - ah - .6, { fill: p.jali ? LED : WHITE, stroke: 'none', sw: 0 }));
      k.add(P(scallopArch(nx, ny, nw, ah), { fill: p.jali ? LED : WHITE, stroke: INK, sw: .35 }));
      k.add(L(nx, ny + ah + 1, nx, by - .6, { sw: .3 }), L(nx + nw, ny + ah + 1, nx + nw, by - .6, { sw: .3 }));
      if (p.jali) jali(k, nx + 2, ny + ah + 2, nw - 4, (by - ny - ah) * .5, 4.5);
      k.add(R(0, by - .8, W, 1.4, { fill: p.wood, sw: .35 }));
      if (dh) drawRow(k, t, by + .6, W - 2 * t, dh, 2, p.color);
      k.add(R(0, by + .6 + dh, W, .8, { fill: p.wood, sw: .25 }));
      doors(k, t, by + 1.4 + dh, W - 2 * t, H - pl - by - 1.4 - dh, p.doors, p.color, 'side', { hy: .4 });
      k.add(R(t, H - pl, W - 2 * t, pl - .2, { fill: SHADE, sw: .3 }));
      k.free(); k.add(DM(0, H, W, H, f * 2.6, f), DM(W, 0, W, H, -f * 2.6, f), DM(0, by, 0, H, f * 2.6, f)); if (dh) k.add(DM(0, by, 0, by + dh + .6, f * 5.2, f)); } },
  chest: { name: 'Drawer unit / side table', fields: [len('W', 'Width', 24), len('H', 'Height', 18), len('D', 'Depth', 18), int('drawers', 'Drawers (high)', 2, 1, 8), int('cols', 'Drawer columns', 1, 1, 4), len('legs', 'Leg height (0 = none)', 0, 0), col('color', 'Drawer colour', WHITE), WOODF],
    area: p => sqft(p.W, p.H),
    draw(p, k) { const { W, H } = p, f = k.fs, lg = Math.min(p.legs, H - 6), bh = H - lg, t = 1, cols = Math.max(1, p.cols);
      if (lg > 0) k.add(R(1, bh, 1.6, lg, { fill: SIDEW, sw: .3 }), R(W - 2.6, bh, 1.6, lg, { fill: SIDEW, sw: .3 }));
      k.box(0, 0, W, bh, p.D, 1); k.add(R(0, 0, W, bh, { fill: p.wood, sw: .6 }));
      for (let c = 0; c < cols; c++) drawers(k, .75 + c * (W - 1.5) / cols, t, (W - 1.5) / cols, bh - t - .75, p.drawers, p.color);
      k.free(); k.add(DM(0, 0, W, 0, -f * 2.6, f), DM(W, 0, W, H, -f * 2.6, f), DM(0, t, 0, t + (bh - t - .75) / p.drawers, f * 2.6, f)); } },
  dressing: { name: 'Dressing unit with mirror', fields: [len('W', 'Width', 36), len('H', 'Height', 84), len('D', 'Depth', 15), len('mirrorW', 'Mirror width', 18), int('drawers', 'Drawers', 3, 1, 6), col('color', 'Shutter colour', WHITE), WOODF],
    area: p => sqft(p.W, p.H),
    draw(p, k) { const { W, H } = p, f = k.fs, t = .75, mw = Math.min(p.mirrorW, W - 8), pl = 3, dz = Math.min(p.drawers * 7, H * .45), dy = H - pl - dz;
      k.box(0, 0, W, H, p.D, 1); k.add(R(0, 0, W, H, { fill: p.wood, sw: .6 }), R(t + .5, t + .5, mw - t - 1, H - pl - t - 1, { fill: MIRROR, sw: .45 })); refl(k, t + .5, t + .5, mw - t - 1, H - pl - t - 1);
      k.add(R(mw, t, W - mw - t, dy - t, { fill: WHITE, sw: .3 })); shelves(k, mw, t, W - mw - t, dy - t, 14);
      drawers(k, mw, dy, W - mw - t, dz, p.drawers, p.color); k.add(R(t, H - pl, W - 2 * t, pl - .2, { fill: SHADE, sw: .3 }));
      k.free(); k.add(DM(0, 0, W, 0, -f * 2.6, f), DM(W, 0, W, H, -f * 2.6, f), DM(0, H, mw, H, f * 2.6, f)); } },
  crockery: { name: 'Crockery unit', fields: [len('W', 'Width', 36), len('H', 'Height', 90), len('D', 'Depth', 16), int('doors', 'Doors', 2, 1, 4), len('glassH', 'Glass door height', 40), int('drawers', 'Drawer rows', 1, 0, 3), col('color', 'Shutter colour', WHITE), WOODF],
    area: p => sqft(p.W, p.H),
    draw(p, k) { const { W, H } = p, f = k.fs, t = .75, pl = 3, gh = Math.min(p.glassH, H * .7), dz = p.drawers * 7, n = Math.max(1, p.doors);
      k.box(0, 0, W, H, p.D, 1); k.add(R(0, 0, W, H, { fill: p.wood, sw: .6 }));
      doors(k, t, t, W - 2 * t, gh - t, n, GLASS, 'bottom', { refl: 1 }); for (let i = 1; i < 3; i++) k.add(L(t + 1, t + (gh - t) * i / 3, W - t - 1, t + (gh - t) * i / 3, { stroke: '#8fb3c4', sw: .3, dash: '1.2 .8' }));
      for (let r = 0; r < p.drawers; r++) drawRow(k, t, gh + r * 7, W - 2 * t, 7, n, p.color);
      doors(k, t, gh + dz, W - 2 * t, H - pl - gh - dz, n, p.color, 'top'); k.add(R(t, H - pl, W - 2 * t, pl - .2, { fill: SHADE, sw: .3 }));
      k.free(); k.add(DM(0, 0, W, 0, -f * 2.6, f), DM(W, 0, W, H, -f * 2.6, f), DM(0, 0, 0, gh, f * 2.6, f), DM(0, gh, 0, H, f * 2.6, f)); } },
  panel: { name: 'Wall / bed back panel', fields: [len('W', 'Width', 96), len('H', 'Height', 48), len('D', 'Thickness', 1.5, .5), len('grooves', 'Groove spacing (0 = plain)', 6, 0), bool('lights', 'LED lights', true), len('sideW', 'Side unit width (0 = none)', 0, 0), col('color', 'Panel colour', '#c8b49a'), col('color2', 'Side unit colour', WHITE), WOODF],
    area: p => sqft(p.W, p.H),
    draw(p, k) { const { W, H } = p, f = k.fs, sw = Math.min(p.sideW, W / 3);
      k.box(0, 0, W, H, p.D, 1); k.add(R(0, 0, W, H, { fill: p.color, sw: .6 })); grooves(k, 0, 0, W, H, p.grooves);
      if (p.lights) k.add(R(1.5, 1.5, W - 3, .9, { fill: LED, stroke: '#e0a800', sw: .2 }), T(W / 2, 1.5 + f * 1.4, 'LED strip', f * .7, { fill: '#6b5a48' }));
      if (sw > 0) for (const x of [0, W - sw]) { k.box(x, H - 11, sw, 11, 16); k.add(R(x, H - 11, sw, 11, { fill: p.wood, sw: .5 })); drawRow(k, x + .75, H - 10.25, sw - 1.5, 9.5, 1, p.color2); }
      k.free(); k.add(DM(0, 0, W, 0, -f * 2.6, f), DM(W, 0, W, H, -f * 2.6, f)); if (sw > 0) k.add(DM(0, H, sw, H, f * 2.6, f)); } },
  custom: { name: 'Custom (outline only)', fields: [len('W', 'Width', 48), len('H', 'Height', 48), len('D', 'Depth', 18), col('color', 'Front colour', WHITE), WOODF],
    area: p => sqft(p.W, p.H),
    draw(p, k) { const { W, H } = p, f = k.fs; k.box(0, 0, W, H, p.D, 1); k.add(R(0, 0, W, H, { fill: p.wood, sw: .6 }), R(.75, .75, W - 1.5, H - 1.5, { fill: p.color, sw: .35 }));
      k.free(); k.add(DM(0, 0, W, 0, -f * 2.6, f), DM(W, 0, W, H, -f * 2.6, f)); } }
};
Object.values(TYPES).forEach(t => { t.fields = t.fields.concat(COMMON); });

/* fill in defaults and keep numbers sane */
function params(type, p) {
  const T0 = TYPES[type] || TYPES.custom, out = {};
  T0.fields.forEach(fd => { let v = p && p[fd.key] !== undefined && p[fd.key] !== '' ? p[fd.key] : fd.def;
    if (fd.kind === 'len') v = Math.max(fd.min, Math.min(600, +v || 0)); else if (fd.kind === 'int') v = Math.max(fd.min, Math.min(fd.max, Math.round(+v || 0))); else if (fd.kind === 'bool') v = v === true || v === 'true' || v === 1; else v = String(v || fd.def || '');
    out[fd.key] = v; });
  if (!out.wood) out.wood = WOOD; if (!out.color) out.color = WHITE; if (out.color2 === '') out.color2 = out.color;
  return out;
}
const sizeText = (type, p) => { const T0 = TYPES[type] || TYPES.custom; p = params(type, p); return T0.size ? T0.size(p) : 'W ' + ftin(p.W) + ' × H ' + ftin(p.H) + (p.D ? ' × D ' + ftin(p.D) : ''); };
const area = (type, p) => { const T0 = TYPES[type] || TYPES.custom; return T0.area(params(type, p)); };

/* oblique (3D-looking) faces for a box: depth goes up and to the right */
const OB = d => [d * .5 * Math.cos(Math.PI / 6), -d * .5 * Math.sin(Math.PI / 6)];
function faces(b, wood) {
  if (!(b.d > 0)) return [];
  const [ox, oy] = OB(b.d), { x, y, w, h } = b;
  return [P([[x, y], [x + w, y], [x + w + ox, y + oy], [x + ox, y + oy]], { fill: TOPW, sw: .45 }), P([[x + w, y], [x + w + ox, y + oy], [x + w + ox, y + h + oy], [x + w, y + h]], { fill: SIDEW, sw: .45 })];
}
function badge(k, cx, y, label) { const f = k.fs, w = label.length * f * .62 + f * 2.4; k.add(R(cx - w / 2, y, w, f * 2.1, { fill: NAVY, stroke: 'none', sw: 0, r: f * .35 }), T(cx, y + f * 1.45, label, f * .95, { fill: '#ffffff', bold: 1 })); }

/* the full drawing for a catalogue item */
function gen(type, raw, name, bare) {
  const T0 = TYPES[type] || TYPES.custom, p = params(type, raw);
  const big = Math.max(p.W || 0, p.L || 0, p.H || 0, type === 'bed' ? p.L + p.W : 0, 36), fs = r1(Math.min(7, Math.max(2.6, big / 30)));
  const k = ctx(fs); T0.draw(p, k);
  /* order: each box's faces then its front; free elements (sizes) last */
  const out = [];
  if (p.view === '3d') k.boxes.forEach(b => { out.push(...faces(b, p.wood)); out.push(...k.els.filter(e => e._g === b.i)); });
  else k.boxes.forEach(b => out.push(...k.els.filter(e => e._g === b.i)));
  out.push(...k.els.filter(e => e._g === undefined || e._g < 0));
  const main = ctx(fs); main.els = out;
  if (p.view === '3d' && k.depth && k.depth.d > 0) { const b = k.depth, [ox, oy] = OB(b.d); main.add(DM(b.x + b.w, b.y + b.h, b.x + b.w + ox, b.y + b.h + oy, -fs * 2.4, fs, { text: ftin(b.d) })); }
  /* 3D: move size lines on the right and top clear of the side and top faces */
  if (p.view === '3d' && k.boxes.length) { let mx = -Infinity, my = Infinity, ox = 0, oy = 0; k.boxes.forEach(b => { const o = OB(b.d); mx = Math.max(mx, b.x + b.w); my = Math.min(my, b.y); ox = Math.max(ox, o[0]); oy = Math.min(oy, o[1]); });
    out.forEach(e => { if (e.t !== 'dim' || e.text) return; if (Math.abs(e.x1 - e.x2) < .01 && e.x1 >= mx - .01 && e.off < 0) e.off = r1(e.off - ox); else if (Math.abs(e.y1 - e.y2) < .01 && e.y1 <= my + .01 && e.off < 0) e.off = r1(e.off + oy); }); }
  out.forEach(e => delete e._g);
  let bb = bbox(main.els); const mainBox = bb;
  if (bare) return { fs, els: main.els };
  badge(main, (bb.x1 + bb.x2) / 2, bb.y2 + fs * 1.2, p.view === '3d' ? '3D VIEW' : 'FRONT VIEW');
  /* top and side views on the right */
  let x0 = mainBox.x2 + fs * 9, y = mainBox.y1 + fs * 3.2;
  const D = p.D || 18;
  if (p.top) { let wh; if (T0.top) wh = T0.top(p, main, x0, y); else { const W = p.W || 48; main.add(R(x0, y, W, D, { fill: p.wood, sw: .5 }), R(x0 + .75, y + .75, W - 1.5, D - 1.5, { fill: TOPW, sw: .3 })); const nd = p.doors || p.panels || 0; if (nd > 1 && nd < 13) for (let i = 1; i < nd; i++) main.add(L(x0 + i * W / nd, y + .75, x0 + i * W / nd, y + D - .75, { stroke: 'rgba(60,40,20,.4)', sw: .3 })); main.add(DM(x0, y, x0 + W, y, -fs * 2.6, fs), DM(x0 + W, y, x0 + W, y + D, -fs * 2.6, fs)); wh = [W, D]; }
    badge(main, x0 + wh[0] / 2, y + wh[1] + fs * 4.6, 'TOP VIEW'); y += wh[1] + fs * 12; }
  if (p.side) { let wh; if (T0.side) wh = T0.side(p, main, x0, y); else { const H = p.H || 48; main.add(R(x0, y, D, H, { fill: SIDEW, sw: .5 }), R(x0 + .75, y + .75, D - 1.5, H - 1.5, { fill: WOOD, sw: .3 })); main.add(DM(x0, y, x0 + D, y, -fs * 2.6, fs), DM(x0 + D, y, x0 + D, y + H, -fs * 2.6, fs)); wh = [D, H]; }
    badge(main, x0 + wh[0] / 2, y + wh[1] + fs * 4.6, 'SIDE VIEW'); }
  if (bare) return { fs, els: main.els };
  /* title */
  bb = bbox(main.els); let ty = bb.y2 + fs * 3.4;
  if (name) { main.add(T(bb.x1, ty, name, fs * 1.35, { anchor: 'start', bold: 1, fill: NAVY })); ty += fs * 1.9; }
  main.add(T(bb.x1, ty, 'Size: ' + sizeText(type, p) + '   ·   Area: ' + area(type, p) + ' sq ft   ·   All sizes in feet and inches', fs * .9, { anchor: 'start', fill: '#4a4a46' }));
  return { fs, els: main.els };
}

/* ── geometry ── */
function dimGeo(e) {
  const dx = e.x2 - e.x1, dy = e.y2 - e.y1, l = Math.hypot(dx, dy) || 1, ux = dx / l, uy = dy / l, nx = -uy, ny = ux, o = +e.off || 0;
  return { l, ux, uy, nx, ny, a: [e.x1 + nx * o, e.y1 + ny * o], b: [e.x2 + nx * o, e.y2 + ny * o] };
}
function ebox(e) {
  if (e.t === 'rect') return [e.x, e.y, e.x + e.w, e.y + e.h];
  if (e.t === 'line') return [Math.min(e.x1, e.x2), Math.min(e.y1, e.y2), Math.max(e.x1, e.x2), Math.max(e.y1, e.y2)];
  if (e.t === 'circle') return [e.x - e.r, e.y - e.r, e.x + e.r, e.y + e.r];
  if (e.t === 'poly') { const xs = e.pts.map(p => p[0]), ys = e.pts.map(p => p[1]); return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]; }
  if (e.t === 'text') { const w = String(e.text).length * e.size * .56, x = e.anchor === 'start' ? e.x : e.anchor === 'end' ? e.x - w : e.x - w / 2; return [x, e.y - e.size * .85, x + w, e.y + e.size * .25]; }
  if (e.t === 'dim') { const g = dimGeo(e), s = e.size || 3; return [Math.min(e.x1, e.x2, g.a[0], g.b[0]) - s, Math.min(e.y1, e.y2, g.a[1], g.b[1]) - s, Math.max(e.x1, e.x2, g.a[0], g.b[0]) + s, Math.max(e.y1, e.y2, g.a[1], g.b[1]) + s]; }
  return [0, 0, 0, 0];
}
function bbox(els) { let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity; (els || []).forEach(e => { const b = ebox(e); x1 = Math.min(x1, b[0]); y1 = Math.min(y1, b[1]); x2 = Math.max(x2, b[2]); y2 = Math.max(y2, b[3]); }); return isFinite(x1) ? { x1, y1, x2, y2 } : { x1: 0, y1: 0, x2: 48, y2: 48 }; }

/* ── SVG ── */
const A = (n, v) => v === undefined || v === null || v === '' ? '' : ' ' + n + '="' + esc(typeof v === 'number' ? r1(v) : v) + '"';
const paint = e => A('fill', e.fill || 'none') + A('stroke', e.stroke || 'none') + A('stroke-width', e.stroke && e.stroke !== 'none' ? (e.sw ?? .4) : '') + A('stroke-dasharray', e.dash);
function one(e, ed) {
  if (e.t === 'rect') return '<rect' + A('x', e.x) + A('y', e.y) + A('width', Math.max(0, e.w)) + A('height', Math.max(0, e.h)) + A('rx', e.r) + paint(e) + '/>';
  if (e.t === 'line') return '<line' + A('x1', e.x1) + A('y1', e.y1) + A('x2', e.x2) + A('y2', e.y2) + A('stroke', e.stroke || INK) + A('stroke-width', e.sw ?? .4) + A('stroke-dasharray', e.dash) + ' stroke-linecap="round"/>' + (ed ? '<line' + A('x1', e.x1) + A('y1', e.y1) + A('x2', e.x2) + A('y2', e.y2) + ' stroke="transparent" stroke-width="3"/>' : '');
  if (e.t === 'circle') return '<circle' + A('cx', e.x) + A('cy', e.y) + A('r', e.r) + paint(e) + '/>';
  if (e.t === 'poly') return '<' + (e.closed === false ? 'polyline' : 'polygon') + ' points="' + e.pts.map(p => r1(p[0]) + ',' + r1(p[1])).join(' ') + '"' + paint(e) + ' stroke-linejoin="round"/>';
  if (e.t === 'text') return '<text' + A('x', e.x) + A('y', e.y) + A('font-size', e.size) + A('fill', e.fill || INK) + A('text-anchor', e.anchor || 'middle') + (e.bold ? ' font-weight="700"' : '') + (e.rot ? A('transform', 'rotate(' + r1(e.rot) + ' ' + r1(e.x) + ' ' + r1(e.y) + ')') : '') + '>' + esc(e.text) + '</text>';
  if (e.t === 'dim') {
    const g = dimGeo(e), s = e.size || 3, c = e.stroke || NAVY, sg = Math.sign(+e.off || 1), ah = s * .75, aw = s * .3, gap = s * .35;
    const ext = (px, py, q) => '<line' + A('x1', px + g.nx * gap * sg) + A('y1', py + g.ny * gap * sg) + A('x2', q[0] + g.nx * gap * sg) + A('y2', q[1] + g.ny * gap * sg) + A('stroke', c) + ' stroke-width="' + r1(s * .06) + '"/>';
    const arrow = (q, dir) => '<polygon points="' + [[q[0], q[1]], [q[0] + dir * g.ux * ah + g.nx * aw, q[1] + dir * g.uy * ah + g.ny * aw], [q[0] + dir * g.ux * ah - g.nx * aw, q[1] + dir * g.uy * ah - g.ny * aw]].map(p => r1(p[0]) + ',' + r1(p[1])).join(' ') + '"' + A('fill', c) + '/>';
    let ang = Math.atan2(g.uy, g.ux) * 180 / Math.PI; if (ang > 89.5) ang -= 180; if (ang <= -90.5) ang += 180;
    const mx = (g.a[0] + g.b[0]) / 2, my = (g.a[1] + g.b[1]) / 2, label = e.text || ftin(g.l);
    return (Math.abs(+e.off) > gap ? ext(e.x1, e.y1, g.a) + ext(e.x2, e.y2, g.b) : '') + '<line' + A('x1', g.a[0]) + A('y1', g.a[1]) + A('x2', g.b[0]) + A('y2', g.b[1]) + A('stroke', c) + ' stroke-width="' + r1(s * .08) + '"/>' + arrow(g.a, 1) + arrow(g.b, -1) +
      '<text' + A('x', mx) + A('y', my) + ' dy=".35em"' + A('font-size', s) + A('fill', c) + ' font-weight="800" text-anchor="middle" paint-order="stroke" stroke="#fff"' + A('stroke-width', s * .45) + ' stroke-linejoin="round"' + (Math.abs(ang) > .5 ? A('transform', 'rotate(' + r1(ang) + ' ' + r1(mx) + ' ' + r1(my) + ')') : '') + '>' + esc(label) + '</text>' + (ed ? '<line' + A('x1', g.a[0]) + A('y1', g.a[1]) + A('x2', g.b[0]) + A('y2', g.b[1]) + ' stroke="transparent"' + A('stroke-width', s * 1.2) + '/>' : '');
  }
  return '';
}
/* o: { label, cls, ed (editor: wrap each element), box (fixed view box) } */
function svg(doc, o) {
  o = o || {}; const els = (doc && doc.els) || [], fs = (doc && doc.fs) || 4, bb = o.box || bbox(els), pad = fs * 2;
  const vb = [bb.x1 - pad, bb.y1 - pad, bb.x2 - bb.x1 + 2 * pad, bb.y2 - bb.y1 + 2 * pad].map(r1);
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + vb.join(' ') + '"' + A('class', o.cls) + ' role="img"' + A('aria-label', o.label || 'Structure drawing with sizes') + ' font-family="Figtree, \'Segoe UI\', system-ui, sans-serif">' +
    '<rect' + A('x', vb[0]) + A('y', vb[1]) + A('width', vb[2]) + A('height', vb[3]) + ' fill="#fff"/>' +
    els.map((e, i) => o.ed ? '<g data-i="' + i + '">' + one(e, true) + '</g>' : one(e)).join('') + (o.after || '') + '</svg>';
}
/* drawing for an item: the saved (edited) one, or generated from its sizes */
const docOf = (it, thumb) => it && it.drawing && (it.drawing.els || []).length ? it.drawing : thumb ? gen(it.type, it.p || {}, '', 1) : gen(it.type, it.p || {}, it.name);

return { TYPES, params, gen, svg, docOf, bbox, ebox, dimGeo, ftin, sqft, area, sizeText, one, NAVY, WOOD, WHITE };
});
