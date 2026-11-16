/* Mumbai Interior — browser runtime. Pages arrive pre-rendered; this refreshes them from /data/*.json
   (so admin changes show at once) and wires up the quote list, filters and forms. */
(function () {
'use strict';
const VI = window.VI, $ = id => document.getElementById(id), esc = VI.esc;
const CART_KEY = 'carpenter_cart', ORD_KEY = 'carpenter_orders';
const get = f => fetch('/data/' + f + '?t=' + Date.now()).then(r => { if (!r.ok) throw new Error(f); return r.json(); });
let D = null;
const LANG = window.VI_LANG || VI.langOf(location.pathname);
const L = html => VI.localize(html);                     /* translate + prefix links for hi/mr */
const tt = s => VI.tr(s);                                /* translate a plain sentence */
const home = p => (LANG === 'en' ? '' : '/' + LANG) + p;

/* old #/ links from the previous single-page site */
(function legacy() {
  const h = location.hash; if (!/^#\//.test(h)) return;
  const [a, b] = h.slice(2).split('?')[0].split('/');
  const map = { services: '/services/', work: '/our-work/', shop: b ? '/furniture/' + b + '/' : '/furniture/', custom: '/get-quote/', cart: '/quote-list/', about: '/about/', contact: '/contact/', thanks: '/thanks/' };
  if (map[a]) location.replace(map[a]);
  else if (a === 'p') window.__legacyProduct = b;
})();

/* text size & contrast (remembered) */
const A11Y = 'vi_a11y';
function a11y(set) {
  let p; try { p = JSON.parse(localStorage.getItem(A11Y) || '{}'); } catch (e) { p = {}; }
  if (set) { p = Object.assign(p, set); try { localStorage.setItem(A11Y, JSON.stringify(p)); } catch (e) {} }
  const h = document.documentElement; h.classList.remove('fs-1', 'fs1', 'fs2'); if (p.fs) h.classList.add(p.fs < 0 ? 'fs-1' : 'fs' + p.fs);
  return p;
}
function theme(set) {
  const h = document.documentElement;
  if (set !== undefined) { try { localStorage.setItem('vi_theme', set ? 'dark' : 'light'); } catch (e) {} h.classList.toggle('dark', set); }
  document.querySelectorAll('[data-theme]').forEach(b => { b.setAttribute('aria-pressed', h.classList.contains('dark')); b.setAttribute('aria-label', h.classList.contains('dark') ? 'Light mode' : 'Dark mode'); });
}
a11y(); theme();
document.addEventListener('click', e => {
  const f = e.target.closest('[data-fs]'); if (f) { const p = a11y(), v = +f.dataset.fs; a11y({ fs: v === 0 ? 0 : Math.max(-1, Math.min(2, (p.fs || 0) + v)) }); }
  if (e.target.closest('[data-theme]')) theme(!document.documentElement.classList.contains('dark'));
});
function toast(msg, err) { const t = $('toast'); if (!t) return; t.innerHTML = msg; t.className = 'show' + (err ? ' err' : ''); clearTimeout(t._t); t._t = setTimeout(() => t.className = '', 4000); }
const list = {
  get() { try { return JSON.parse(localStorage.getItem(CART_KEY) || '[]'); } catch (e) { return []; } },
  set(c) { try { localStorage.setItem(CART_KEY, JSON.stringify(c)); } catch (e) {} badge(); },
  add(id) { const c = list.get(), l = c.find(x => x.id === id); if (l) l.q += 1; else c.push({ id, q: 1 }); list.set(c); }
};
function badge() { const n = list.get().reduce((a, l) => a + l.q, 0); document.querySelectorAll('[data-count]').forEach(b => { b.textContent = n; b.hidden = !n; }); }
function save(rec) { try { const a = JSON.parse(localStorage.getItem(ORD_KEY) || '[]'); a.unshift(Object.assign({ id: Date.now(), date: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) }, rec)); localStorage.setItem(ORD_KEY, JSON.stringify(a.slice(0, 100))); } catch (e) {} }
function emailCopy(subject, fields) {
  if (!D || !D.S.email) return;
  const fallback = () => fetch('https://formsubmit.co/ajax/' + D.S.email, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(Object.assign({}, fields, { _subject: subject, _template: 'table', _captcha: 'false' })) }).catch(() => {});
  /* own mail server first (sends from noreply@ to info@); old form service only if it is unavailable */
  get('api.json').then(a => fetch(a.url + '/enquiry', { method: 'POST', headers: { 'Content-Type': 'application/json' }, keepalive: true, body: JSON.stringify({ subject, fields, page: location.href }) }))
    .then(r => { if (!r.ok && r.status !== 429) fallback(); }).catch(fallback);
}
const okPhone = p => /^\+?\d[\d\s-]{8,}$/.test(String(p || '').trim());

document.addEventListener('click', e => {
  const b = e.target.closest('[data-add]');
  if (b) { list.add(+b.dataset.add); toast(tt('Added to your quote list.') + ' <a href="' + home('/quote-list/') + '">' + tt('View list') + '</a>'); b.classList.add('added'); setTimeout(() => b.classList.remove('added'), 900); }
  const m = e.target.closest('#menuBtn');
  if (m) { const o = $('nav').classList.toggle('open'); m.setAttribute('aria-expanded', o); document.body.classList.toggle('navopen', o); }
});

/* ── page behaviour ── */
function bindShop() {
  const box = $('results'); if (!box) return;
  const cat = (location.pathname.replace(/^\/(hi|mr)/, '').match(/^\/furniture\/([^/]+)\/$/) || [])[1] || '';
  const draw = () => {
    const q = ($('search').value || '').toLowerCase(), sort = $('sort').value;
    let Li = D.PRODUCTS.filter(p => (!cat || p.category === cat) && (!q || (p.name + ' ' + p.material + ' ' + VI.catName(D, p.category)).toLowerCase().includes(q)));
    if (sort === 'low') Li.sort((a, b) => a.lo - b.lo); if (sort === 'high') Li.sort((a, b) => b.lo - a.lo);
    $('count').textContent = tt(Li.length + (Li.length === 1 ? ' design' : ' designs'));
    box.innerHTML = L(Li.length ? '<div class="grid">' + Li.map(p => VI.card(D, p)).join('') + '</div>' : '<div class="empty">Nothing matches. Try another word, or <a class="link" href="/get-quote/">ask us to make it</a>.</div>');
  };
  const q0 = new URLSearchParams(location.search).get('q'); if (q0) { $('search').value = q0; draw(); }
  $('search').oninput = draw; $('sort').onchange = draw;
}
function bindProduct() {
  const t = $('thumbs'); if (t) t.onclick = e => { const b = e.target.closest('button'); if (!b) return; $('mainImg').src = b.dataset.src; [...t.children].forEach(x => x.setAttribute('aria-pressed', x === b)); };
}
function bindList() {
  const app = $('listApp'); if (!app) return;
  const draw = () => {
    const lines = list.get().map(l => Object.assign({}, l, { p: D.PRODUCTS.find(p => p.id === l.id) })).filter(l => l.p);
    if (!lines.length) { app.innerHTML = L('<div class="empty">Your quote list is empty. <a class="link" href="/furniture/">Browse furniture</a> and tap <b>Add to quote</b>.</div>'); return; }
    const lo = lines.reduce((a, l) => a + l.p.lo * l.q, 0), hi = lines.reduce((a, l) => a + l.p.hi * l.q, 0);
    app.innerHTML = L('<div class="cart"><div><div id="lines">' + lines.map(l => '<div class="line"><img src="' + esc(VI.small((l.p.images || [])[0])) + '" alt=""/><div><h3><a href="' + l.p.url + '">' + esc(l.p.name) + '</a></h3><div class="meta">' + VI.range(l.p) + ' each</div><button class="rm" type="button" data-rm="' + l.p.id + '">Remove</button></div><div class="qtybox"><label class="sr" for="q' + l.p.id + '">Quantity</label><input id="q' + l.p.id + '" data-q="' + l.p.id + '" type="number" min="1" max="20" value="' + l.q + '"/></div></div>').join('') + '</div>' +
      '<div class="sum total"><span>Estimated total</span><span>' + VI.inr(lo) + ' – ' + VI.inr(hi) + '</span></div><p class="hint">The exact price is confirmed after we check sizes, wood and finish with you.</p></div>' +
      '<form class="panel" id="checkout" novalidate><h2>Send for a quote</h2><p class="hint" style="margin-bottom:1rem">Your list opens in WhatsApp so you can send it to us. No payment now.</p>' +
      '<div class="field"><label for="cName">Full name</label><input id="cName" name="name" autocomplete="name" required/></div><div class="field"><label for="cPhone">Phone</label><input id="cPhone" name="phone" type="tel" autocomplete="tel" required/></div>' +
      '<div class="field"><label for="cAddr">Area / address</label><input id="cAddr" name="address" autocomplete="street-address" placeholder="e.g. Bhandup West"/></div><div class="field"><label for="cNotes">Sizes or notes (optional)</label><textarea id="cNotes" name="notes" style="min-height:80px" placeholder="Room size, colour, wood…"></textarea></div><input class="hp" name="_honey" tabindex="-1" autocomplete="off" aria-hidden="true"/>' +
      '<button class="btn btn-wa" style="width:100%">' + VI.I.wa + 'Send list on WhatsApp</button></form></div>');
    $('lines').onclick = e => { const b = e.target.closest('[data-rm]'); if (b) { list.set(list.get().filter(l => l.id !== +b.dataset.rm)); draw(); } };
    $('lines').onchange = e => { const i = e.target.closest('[data-q]'); if (i) { const c = list.get(), l = c.find(x => x.id === +i.dataset.q); l.q = Math.max(1, Math.min(20, +i.value || 1)); list.set(c); draw(); } };
    $('checkout').onsubmit = e => {
      e.preventDefault(); const d = Object.fromEntries(new FormData(e.target)); if (d._honey) return;
      if (!d.name.trim() || !okPhone(d.phone)) { toast(tt('Add your name and a 10-digit phone number.'), true); return; }
      const items = lines.map(l => '• ' + l.p.name + ' × ' + l.q + ' — est. ' + VI.range(l.p)).join('\n');
      const msg = 'Quote request from website\n\n' + items + '\n\nEstimated total: ' + VI.inr(lo) + ' – ' + VI.inr(hi) + '\n\nName: ' + d.name + '\nPhone: ' + d.phone + (d.address ? '\nArea: ' + d.address : '') + (d.notes ? '\nNotes: ' + d.notes : '');
      save({ name: d.name, phone: d.phone, address: d.address, notes: d.notes, items: lines.map(l => ({ id: l.p.id, name: l.p.name, q: l.q, price: l.p.lo })), total: lo, kind: 'order' });
      emailCopy('Quote list — ' + d.name, { Name: d.name, Phone: d.phone, Area: d.address || '-', Items: items, Estimate: VI.inr(lo) + ' – ' + VI.inr(hi), Notes: d.notes || '-' });
      window.open(VI.waLink(D.S, msg), '_blank', 'noopener'); list.set([]); location.href = home('/thanks/');
    };
  };
  draw();
}
function bindQuote() {
  const f = $('cf'); if (!f) return;
  const qs = new URLSearchParams(location.search);
  if (qs.get('item')) $('xType').value = qs.get('item');
  if (qs.get('mode')) $('xMode').value = qs.get('mode');
  if (qs.get('area')) $('xArea').value = qs.get('area');
  f.onsubmit = e => {
    e.preventDefault(); const d = Object.fromEntries(new FormData(f)); if (d._honey) return;
    if (!d.name.trim() || !okPhone(d.phone) || !d.type.trim()) { toast(tt('Add what you need, your name and phone number.'), true); return; }
    const msg = 'Estimate request\n\nWork: ' + d.type + (d.mode ? '\nBasis: ' + d.mode : '') + (d.size ? '\nSize: ' + d.size : '') + (d.wood ? '\nMaterial: ' + d.wood : '') + (d.budget ? '\nBudget: ' + d.budget : '') + (d.details ? '\nDetails: ' + d.details : '') + '\n\nName: ' + d.name + '\nPhone: ' + d.phone + (d.area ? '\nSite: ' + d.area : '') + '\n\n(I will send photos here.)';
    save(Object.assign({}, d, { work: d.type, kind: 'custom' }));
    emailCopy('Estimate request — ' + d.type + ' — ' + d.name, { Work: d.type, Basis: d.mode || '-', Size: d.size || '-', Material: d.wood || '-', Budget: d.budget || '-', Details: d.details || '-', Name: d.name, Phone: d.phone, Site: d.area || '-' });
    window.open(VI.waLink(D.S, msg), '_blank', 'noopener'); location.href = home('/thanks/');
  };
}
function bindContact() {
  const f = $('qf'); if (!f) return;
  f.onsubmit = e => {
    e.preventDefault(); const d = Object.fromEntries(new FormData(f)); if (d._honey) return;
    if (!d.name.trim() || !d.message.trim()) { toast(tt('Add your name and a message.'), true); return; }
    emailCopy('Website enquiry — ' + d.name, { Name: d.name, Phone: d.phone || '-', Message: d.message });
    save(Object.assign({}, d, { kind: 'enquiry' }));
    window.open(VI.waLink(D.S, 'Hi, I am ' + d.name + '.\n' + d.message), '_blank', 'noopener'); f.reset(); toast(tt('Thanks! We will reply soon.'));
  };
}
function bindGrievance() {
  const f = $('gf'); if (!f) return;
  f.onsubmit = e => {
    e.preventDefault(); const d = Object.fromEntries(new FormData(f)); if (d._honey) return;
    if (!d.name.trim() || !okPhone(d.phone) || !d.message.trim()) { toast(tt('Add your name, phone number and details.'), true); return; }
    emailCopy('Grievance / feedback — ' + d.type + ' — ' + d.name, { Name: d.name, Phone: d.phone, Type: d.type, Details: d.message });
    save(Object.assign({}, d, { kind: 'enquiry', work: d.type }));
    window.open(VI.waLink(D.S, d.type + '\n\nName: ' + d.name + '\nPhone: ' + d.phone + '\n\n' + d.message), '_blank', 'noopener');
    f.reset(); toast(tt('Sent. We will acknowledge it within 48 hours.'));
  };
}
function notFound() {
  const raw = decodeURIComponent(location.pathname), pp = $('nfPath'), sg = $('nfSug'), f = $('nfForm');
  if (f) f.action = home('/furniture/');
  if (pp && raw !== '/404.html') { pp.innerHTML = tt('You opened') + ' <code>' + esc(raw) + '</code>'; pp.hidden = false; }
  const words = raw.replace(/^\/(hi|mr)(?=\/)/, '').toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 2 && !['html', 'www', 'index'].includes(w));
  if (!sg || !words.length) return;
  const lev = (x, y) => { const d = Array.from({ length: x.length + 1 }, (_, i) => [i].concat(Array(y.length).fill(0))); for (let j = 0; j <= y.length; j++) d[0][j] = j; for (let i = 1; i <= x.length; i++) for (let j = 1; j <= y.length; j++) { d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (x[i - 1] === y[j - 1] ? 0 : 1)); if (i > 1 && j > 1 && x[i - 1] === y[j - 2] && x[i - 2] === y[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1); } return d[x.length][y.length]; };
  const sim = (w, u) => { if (u.includes(w)) return 1; let b = 0; for (const s of u.split(/[^a-z0-9]+/)) if (s.length > 2) b = Math.max(b, 1 - lev(w, s) / Math.max(w.length, s.length)); return b >= .6 ? b : 0; };
  let best = null, score = 0;
  for (const rt of VI.routes(D)) { const u = rt[0].toLowerCase(), sc = words.reduce((t, w) => t + sim(w, u), 0) / words.length - rt[0].split('/').length * .001; if (sc > score) { score = sc; best = rt; } }
  if (!best || score < .5) return;
  const t = String((VI.render(D, best[1], best.slice(2)) || {}).title || best[0]).split(' | ')[0].split(' — ')[0];
  sg.innerHTML = tt('Were you looking for') + ' <a class="link" href="' + home(best[0]) + '">' + esc(tt(t)) + '</a>?'; sg.hidden = false;
}

/* header: transparent over photo banners, glass + progress line after scrolling */
function hdrFx() {
  const h = document.documentElement;
  h.classList.toggle('ovl', !!document.querySelector('#app > .hero:first-child, #app > .phero:first-child'));
  if (hdrFx.on) return; hdrFx.on = 1;
  let raf = 0;
  const upd = () => { raf = 0; const y = scrollY, max = document.documentElement.scrollHeight - innerHeight; h.classList.toggle('scrolled', y > 24); h.style.setProperty('--sp', max > 0 ? Math.min(1, y / max).toFixed(4) : 0); };
  addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(upd); }, { passive: true });
  addEventListener('resize', upd); upd();
}
hdrFx();
function bind() { bindGrievance(); bindShop(); bindProduct(); bindList(); bindQuote(); bindContact(); badge(); }

/* bind immediately with built-in data, then refresh from JSON */
function swap(id, html) { const el = $(id); if (el && el.dataset.sig !== VI.sig(html)) { el.innerHTML = html; el.dataset.sig = VI.sig(html); return true; } return false; }
(async () => {
  badge();
  let raw;
  try { const [S, CATS, PRODUCTS] = await Promise.all(['settings.json', 'categories.json', 'products.json'].map(get));
    raw = { S, CATS, PRODUCTS, WORK: await get('projects.json').catch(() => []), QUOTES: await get('testimonials.json').catch(() => []), GUIDES: await get('guides.json').catch(() => []) };
    if (LANG !== 'en') VI.setLang(LANG, await get('i18n.json'));
  } catch (e) { return; }
  D = VI.prep(raw);
  if (window.__legacyProduct) { const p = D.PRODUCTS.find(x => String(x.id) === window.__legacyProduct); location.replace(home(p ? p.url : '/furniture/')); return; }
  const r = VI.resolve(D, location.pathname), p = VI.render(D, r.view, r.args);
  if (r.view !== 'list' && swap('app', p.body)) document.title = p.title;
  swap('hdr', VI.header(D, r.view === 'notfound' ? '' : r.path)); swap('ftr', VI.footer(D)); a11y(); theme(); hdrFx();
  if (r.view === 'notfound' || location.pathname === '/404.html') document.title = p.title;
  if (r.view === 'notfound') notFound();
  bind();
})();
})();
if ('serviceWorker' in navigator) addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
