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
/* wishlist: saved product ids in this browser */
const WISH_KEY = 'carpenter_wish';
const wish = {
  get() { try { return JSON.parse(localStorage.getItem(WISH_KEY) || '[]'); } catch (e) { return []; } },
  set(a) { try { localStorage.setItem(WISH_KEY, JSON.stringify(a)); } catch (e) {} wishSync(); },
  has(id) { return wish.get().includes(id); },
  toggle(id) { const a = wish.get(), on = !a.includes(id); wish.set(on ? a.concat(id) : a.filter(x => x !== id)); return on; }
};
function wishSync() {
  const a = wish.get();
  document.querySelectorAll('[data-wish]').forEach(b => { const on = a.includes(+b.dataset.wish); b.setAttribute('aria-pressed', on); b.classList.toggle('on', on); const t = b.querySelector('span'); if (t) t.textContent = tt(on ? 'Saved' : 'Save'); });
  document.querySelectorAll('[data-wcount]').forEach(b => { b.textContent = a.length; b.hidden = !a.length; });
}
async function shareLink(url, title) {
  const full = location.origin + home(url);
  if (navigator.share) { try { await navigator.share({ title, text: title + ' — ' + (D ? D.S.name : 'Mumbai Interior'), url: full }); return; } catch (e) { if (e && e.name === 'AbortError') return; } }
  try { await navigator.clipboard.writeText(full); } catch (e) { }
  toast(tt('Link copied.') + ' <a href="https://wa.me/?text=' + encodeURIComponent(title + ' ' + full) + '" target="_blank" rel="noopener">' + tt('Share on WhatsApp') + '</a>');
}
function badge() { wishSync(); const n = list.get().reduce((a, l) => a + l.q, 0); document.querySelectorAll('[data-count]').forEach(b => { b.textContent = n; b.hidden = !n; }); }
function save(rec) { try { const a = JSON.parse(localStorage.getItem(ORD_KEY) || '[]'); a.unshift(Object.assign({ id: Date.now(), date: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) }, rec)); localStorage.setItem(ORD_KEY, JSON.stringify(a.slice(0, 100))); } catch (e) {} }
function emailCopy(subject, fields, email) {
  email = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test((email || '').trim()) ? email.trim() : '';
  if (email) fields = Object.assign({}, fields, { Email: email });
  if (!D || !D.S.email) return;
  const fallback = () => fetch('https://formsubmit.co/ajax/' + D.S.email, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(Object.assign({}, fields, { _subject: subject, _template: 'table', _captcha: 'false' }, email ? { _replyto: email } : {})) }).catch(() => {});
  /* own mail server first (sends from noreply@ to info@); old form service only if it is unavailable */
  get('api.json').then(a => fetch(a.url + '/enquiry', { method: 'POST', headers: { 'Content-Type': 'application/json' }, keepalive: true, body: JSON.stringify({ subject, fields, email, page: location.href }) }))
    .then(r => { if (!r.ok && r.status !== 429) fallback(); }).catch(fallback);
}
const okPhone = p => /^\+?\d[\d\s-]{8,}$/.test(String(p || '').trim());

document.addEventListener('click', e => {
  const w = e.target.closest('[data-wish]');
  if (w) { e.preventDefault(); const on = wish.toggle(+w.dataset.wish); toast(on ? tt('Saved to your wishlist.') + ' <a href="' + home('/wishlist/') + '">' + tt('View wishlist') + '</a>' : tt('Removed from your wishlist.')); if ($('wishApp')) bindWish(); }
  /* catalogue drawing: full screen, download, print, type filter */
  const sv = () => { const g = document.querySelector('#csheet svg'); return g ? '<?xml version="1.0" encoding="UTF-8"?>\n' + g.outerHTML : ''; };
  if (e.target.closest('[data-sfull]')) { const x = sv(); if (x) lightbox(['data:image/svg+xml;charset=utf-8,' + encodeURIComponent(x)], 0, e.target.closest('[data-sfull]').dataset.title); }
  const dl = e.target.closest('[data-sdl]');
  if (dl) { const a = document.createElement('a'); a.href = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(sv()); a.download = dl.dataset.sdl + '-structure.svg'; document.body.appendChild(a); a.click(); a.remove(); }
  if (e.target.closest('[data-sprint]')) window.print();
  const ct = e.target.closest('#ctypes [data-ct]');
  if (ct) { e.preventDefault(); const t = ct.dataset.ct; document.querySelectorAll('#ctypes [data-ct]').forEach(a => a.toggleAttribute('aria-current', a === ct)); document.querySelectorAll('.cgrid .ccard').forEach(c => { c.hidden = !!t && c.dataset.ctype !== t; }); history.replaceState(null, '', t ? '#' + t : location.pathname); }
  const sh = e.target.closest('[data-share]');
  if (sh) { e.preventDefault(); shareLink(sh.dataset.share, sh.dataset.title || document.title); }
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
    box.innerHTML = L(Li.length ? '<div class="grid">' + Li.map(p => VI.card(D, p)).join('') + '</div>' : '<div class="empty">Nothing matches. Try another word, or <a class="link" href="/get-quote/">ask us to make it</a>.</div>'); wishSync();
  };
  const q0 = new URLSearchParams(location.search).get('q'); if (q0) { $('search').value = q0; draw(); }
  $('search').oninput = draw; $('sort').onchange = draw;
}
/* full-screen photo viewer: swipe or arrow keys to move, tap or double-tap to zoom, Esc to close */
function lightbox(imgs, start, title) {
  let i = start, zoom = 1, ox = 0, oy = 0, sx = 0, sy = 0, moved = false;
  const back = document.activeElement, box = document.createElement('div');
  box.id = 'lb'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-label', title + ' photos');
  box.innerHTML = '<div class="lb-top"><span class="lb-count" aria-live="polite"></span><span class="lb-title"></span><button type="button" class="lb-x" aria-label="Close">✕</button></div>' +
    '<div class="lb-stage"><img alt=""/></div>' + (imgs.length > 1 ? '<button type="button" class="lb-nav lb-prev" aria-label="Previous photo">‹</button><button type="button" class="lb-nav lb-next" aria-label="Next photo">›</button><div class="lb-dots">' + imgs.map((u, k) => '<button type="button" data-k="' + k + '" aria-label="Photo ' + (k + 1) + '"><img src="' + u.replace(/^(\/images\/(?:products|site|blog)\/[a-z0-9-]+)\.webp$/, '$1-xs.webp') + '" alt="" loading="lazy" onerror="this.onerror=null;this.src=\'' + '\'+this.closest(\'button\').dataset.full"/></button>').join('') + '</div>' : '');
  box.querySelectorAll('.lb-dots button').forEach((b, k) => b.dataset.full = imgs[k]);
  const img = box.querySelector('.lb-stage img'), stage = box.querySelector('.lb-stage');
  const apply = () => { img.style.transform = 'translate(' + ox + 'px,' + oy + 'px) scale(' + zoom + ')'; box.classList.toggle('zoomed', zoom > 1); };
  const show = k => { i = (k + imgs.length) % imgs.length; zoom = 1; ox = oy = 0; apply(); img.src = imgs[i]; img.alt = title + ' — photo ' + (i + 1); box.querySelector('.lb-count').textContent = imgs.length > 1 ? (i + 1) + ' / ' + imgs.length : ''; box.querySelector('.lb-title').textContent = title; box.querySelectorAll('.lb-dots button').forEach((b, k) => b.setAttribute('aria-current', k === i)); [imgs[i + 1], imgs[i - 1]].forEach(u => { if (u) new Image().src = u; }); };
  const close = () => { box.remove(); document.documentElement.classList.remove('lbopen'); removeEventListener('keydown', key); back && back.focus && back.focus(); };
  const key = e => { if (e.key === 'Escape') close(); else if (e.key === 'ArrowRight') show(i + 1); else if (e.key === 'ArrowLeft') show(i - 1); else if (e.key === 'Tab') { e.preventDefault(); box.querySelector('.lb-x').focus(); } };
  box.addEventListener('click', e => {
    if (e.target.closest('.lb-x')) return close();
    if (e.target.closest('.lb-prev')) return show(i - 1);
    if (e.target.closest('.lb-next')) return show(i + 1);
    const d = e.target.closest('[data-k]'); if (d) return show(+d.dataset.k);
    if (e.target === img && !moved) { zoom = zoom > 1 ? 1 : 2.2; if (zoom === 1) { ox = oy = 0; } apply(); return; }
    if (e.target === stage && zoom === 1 && !moved) close();
  });
  stage.addEventListener('pointerdown', e => { moved = false; sx = e.clientX; sy = e.clientY; stage._d = { ox, oy }; });
  stage.addEventListener('pointermove', e => { if (!stage._d) return; const dx = e.clientX - sx, dy = e.clientY - sy; if (Math.abs(dx) + Math.abs(dy) > 6) moved = true; if (zoom > 1) { ox = stage._d.ox + dx; oy = stage._d.oy + dy; apply(); } });
  stage.addEventListener('pointerleave', () => { stage._d = null; });
  stage.addEventListener('pointerup', e => { const d = stage._d; stage._d = null; if (!d) return; const dx = e.clientX - sx; if (zoom === 1 && moved && Math.abs(dx) > 50 && imgs.length > 1) show(i + (dx < 0 ? 1 : -1)); setTimeout(() => moved = false, 0); });
  document.body.append(box); document.documentElement.classList.add('lbopen'); addEventListener('keydown', key); show(start); box.querySelector('.lb-x').focus();
}
function bindProduct() {
  const g = document.querySelector('.gallery[data-gal]');
  if (g) { const imgs = g.dataset.gal.split('|').filter(Boolean); let cur = 0;
    g.querySelector('.gopen').onclick = () => lightbox(imgs, cur, g.dataset.title);
    const th = $('thumbs'); if (th) th.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; cur = [...th.children].indexOf(b); const z = g.querySelector('.gzoom'); if (z && imgs.length > 1) z.lastChild.textContent = (cur + 1) + ' / ' + imgs.length; }); }
  const rf = $('rvf'); if (rf) rf.onsubmit = e => {
    e.preventDefault(); const d = Object.fromEntries(new FormData(rf)); if (d._honey) return;
    if (!d.name.trim() || d.text.trim().length < 10) { toast(tt('Add your name and a few words about the product.'), true); return; }
    const btn = rf.querySelector('button'); btn.disabled = true;
    const done = ok => { btn.disabled = false; if (ok) { rf.reset(); rf.closest('details').open = false; toast(tt('Thank you! Your review will appear after we check it.')); } else toast(tt('Could not send your review. Please try again or send it on WhatsApp.'), true); };
    get('api.json').then(a => fetch(a.url + '/review', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pid: rf.dataset.pid, product: rf.dataset.product, url: location.href, name: d.name, place: d.place, phone: d.phone, rating: d.rating, text: d.text, _honey: d._honey }) }))
      .then(r => done(r.ok)).catch(() => done(false));
    return;
  };
  const t = $('thumbs'); if (t) t.onclick = e => { const b = e.target.closest('button'); if (!b) return; $('mainImg').src = b.dataset.src; [...t.children].forEach(x => x.setAttribute('aria-pressed', x === b)); };
}
function bindWish() {
  const app = $('wishApp'); if (!app || !D) return;
  const items = wish.get().map(id => D.PRODUCTS.find(p => p.id === id)).filter(Boolean);
  if (!items.length) { app.innerHTML = L('<div class="empty">Your wishlist is empty. Tap the ♡ on any furniture to save it here. <a class="link" href="/furniture/">Browse furniture</a></div>'); return; }
  const text = 'My furniture wishlist from ' + D.S.name + ':\n' + items.map(p => '• ' + p.name + ' — ' + location.origin + home(p.url)).join('\n');
  app.innerHTML = L('<div class="wishbar"><b>' + items.length + ' saved</b><button class="btn btn-primary btn-sm" type="button" id="wishAll">' + VI.I.plus + 'Add all to quote list</button><a class="btn btn-wa btn-sm" href="https://wa.me/?text=' + encodeURIComponent(text) + '" target="_blank" rel="noopener">' + VI.I.wa + 'Share list</a><button class="btn btn-ghost btn-sm" type="button" id="wishClear">Clear</button></div><div class="grid">' + items.map(p => VI.card(D, p)).join('') + '</div>');
  $('wishAll').onclick = () => { items.forEach(p => list.add(p.id)); toast(tt('Added to your quote list.') + ' <a href="' + home('/quote-list/') + '">' + tt('View list') + '</a>'); };
  $('wishClear').onclick = () => { wish.set([]); bindWish(); };
  wishSync();
}
function bindList() {
  const app = $('listApp'); if (!app) return;
  const draw = () => {
    const lines = list.get().map(l => Object.assign({}, l, { p: D.PRODUCTS.find(p => p.id === l.id) })).filter(l => l.p);
    if (!lines.length) { app.innerHTML = L('<div class="empty">Your quote list is empty. <a class="link" href="/furniture/">Browse furniture</a> and tap <b>Add to quote</b>.</div>'); return; }
    const lo = lines.reduce((a, l) => a + l.p.lo * l.q, 0), hi = lines.reduce((a, l) => a + l.p.hi * l.q, 0);
    app.innerHTML = L('<div class="cart"><div><div id="lines">' + lines.map(l => '<div class="line"><img src="' + esc(VI.small((l.p.images || [])[0])) + '" alt=""/><div><h3><a href="' + l.p.url + '">' + esc(l.p.name) + '</a></h3><div class="meta">' + VI.range(l.p) + ' each</div><button class="rm" type="button" data-rm="' + l.p.id + '">Remove</button></div><div class="qtybox"><label class="sr" for="q' + l.p.id + '">Quantity</label><input id="q' + l.p.id + '" data-q="' + l.p.id + '" type="number" min="1" max="20" value="' + l.q + '"/></div></div>').join('') + '</div>' +
      '<div class="sum total"><span>Estimated total</span><span>' + VI.inr(lo) + ' – ' + VI.inr(hi) + '</span></div><p class="hint">The exact price is confirmed after we check sizes, wood and finish with you.</p></div>' +
      '<form class="panel" id="checkout" novalidate><h2>Send for a quote</h2><p class="hint mb10">Your list opens in WhatsApp so you can send it to us. No payment now.</p>' +
      '<div class="field"><label for="cName">Full name</label><input id="cName" name="name" autocomplete="name" required/></div><div class="field"><label for="cPhone">Phone</label><input id="cPhone" name="phone" type="tel" autocomplete="tel" required/></div><div class="field"><label for="cEmail">' + tt('Email (optional)') + '</label><input id="cEmail" name="email" type="email" autocomplete="email" inputmode="email"/></div>' +
      '<div class="field"><label for="cAddr">Area / address</label><input id="cAddr" name="address" autocomplete="street-address" placeholder="e.g. Bhandup West"/></div><div class="field"><label for="cNotes">Sizes or notes (optional)</label><textarea id="cNotes" name="notes" class="mh80" placeholder="Room size, colour, wood…"></textarea></div><input class="hp" name="_honey" tabindex="-1" autocomplete="off" aria-hidden="true"/>' +
      '<button class="btn btn-wa w100">' + VI.I.wa + 'Send list on WhatsApp</button></form></div>');
    $('lines').onclick = e => { const b = e.target.closest('[data-rm]'); if (b) { list.set(list.get().filter(l => l.id !== +b.dataset.rm)); draw(); } };
    $('lines').onchange = e => { const i = e.target.closest('[data-q]'); if (i) { const c = list.get(), l = c.find(x => x.id === +i.dataset.q); l.q = Math.max(1, Math.min(20, +i.value || 1)); list.set(c); draw(); } };
    $('checkout').onsubmit = e => {
      e.preventDefault(); const d = Object.fromEntries(new FormData(e.target)); if (d._honey) return;
      if (!d.name.trim() || !okPhone(d.phone)) { toast(tt('Add your name and a 10-digit phone number.'), true); return; }
      const items = lines.map(l => '• ' + l.p.name + ' × ' + l.q + ' — est. ' + VI.range(l.p)).join('\n');
      const msg = 'Quote request from website\n\n' + items + '\n\nEstimated total: ' + VI.inr(lo) + ' – ' + VI.inr(hi) + '\n\nName: ' + d.name + '\nPhone: ' + d.phone + (d.address ? '\nArea: ' + d.address : '') + (d.notes ? '\nNotes: ' + d.notes : '');
      save({ name: d.name, phone: d.phone, address: d.address, notes: d.notes, items: lines.map(l => ({ id: l.p.id, name: l.p.name, q: l.q, price: l.p.lo })), total: lo, kind: 'order' });
      emailCopy('Quote list — ' + d.name, { Name: d.name, Phone: d.phone, Area: d.address || '-', Items: items, Estimate: VI.inr(lo) + ' – ' + VI.inr(hi), Notes: d.notes || '-' }, d.email);
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
  const hs = decodeURIComponent(location.hash.slice(1)), sl = t => String(t || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  if (hs && D) {
    const m = (D.S.work_modes || []).find(x => sl(x.title) === hs), a = (D.AREAS || []).find(x => sl(x.name) === hs), w = (D.PRODUCTS || []).map(x => x.name).concat((D.S.services || []).map(x => x.title)).find(x => sl(x) === hs);
    if (m) $('xMode').value = m.title; if (a) $('xArea').value = a.name; if (w) $('xType').value = w;
  }
  f.onsubmit = e => {
    e.preventDefault(); const d = Object.fromEntries(new FormData(f)); if (d._honey) return;
    if (!d.name.trim() || !okPhone(d.phone) || !d.type.trim()) { toast(tt('Add what you need, your name and phone number.'), true); return; }
    const msg = 'Estimate request\n\nWork: ' + d.type + (d.mode ? '\nBasis: ' + d.mode : '') + (d.size ? '\nSize: ' + d.size : '') + (d.wood ? '\nMaterial: ' + d.wood : '') + (d.budget ? '\nBudget: ' + d.budget : '') + (d.details ? '\nDetails: ' + d.details : '') + '\n\nName: ' + d.name + '\nPhone: ' + d.phone + (d.area ? '\nSite: ' + d.area : '') + '\n\n(I will send photos here.)';
    save(Object.assign({}, d, { work: d.type, kind: 'custom' }));
    emailCopy('Estimate request — ' + d.type + ' — ' + d.name, { Work: d.type, Basis: d.mode || '-', Size: d.size || '-', Material: d.wood || '-', Budget: d.budget || '-', Details: d.details || '-', Name: d.name, Phone: d.phone, Site: d.area || '-' }, d.email);
    window.open(VI.waLink(D.S, msg), '_blank', 'noopener'); location.href = home('/thanks/');
  };
}
function bindContact() {
  const f = $('qf'); if (!f) return;
  f.onsubmit = e => {
    e.preventDefault(); const d = Object.fromEntries(new FormData(f)); if (d._honey) return;
    if (!d.name.trim() || !d.message.trim()) { toast(tt('Add your name and a message.'), true); return; }
    emailCopy('Website enquiry — ' + d.name, { Name: d.name, Phone: d.phone || '-', Message: d.message }, d.email);
    save(Object.assign({}, d, { kind: 'enquiry' }));
    window.open(VI.waLink(D.S, 'Hi, I am ' + d.name + '.\n' + d.message), '_blank', 'noopener'); f.reset(); toast(tt('Thanks! We will reply soon.'));
  };
}
function bindGrievance() {
  const f = $('gf'); if (!f) return;
  f.onsubmit = e => {
    e.preventDefault(); const d = Object.fromEntries(new FormData(f)); if (d._honey) return;
    if (!d.name.trim() || !okPhone(d.phone) || !d.message.trim()) { toast(tt('Add your name, phone number and details.'), true); return; }
    emailCopy('Grievance / feedback — ' + d.type + ' — ' + d.name, { Name: d.name, Phone: d.phone, Type: d.type, Details: d.message }, d.email);
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
  /* page height is measured only when the page size changes (ResizeObserver runs after layout), never right after a class change, so scrolling never forces an extra layout */
  let raf = 0, max = 0;
  const upd = () => { raf = 0; const y = scrollY; h.classList.toggle('scrolled', y > 24); h.style.setProperty('--sp', max > 0 ? Math.min(1, y / max).toFixed(4) : 0); };
  const tick = () => { if (!raf) raf = requestAnimationFrame(upd); };
  if ('ResizeObserver' in window) new ResizeObserver(en => { max = en[0].contentRect.height - innerHeight; tick(); }).observe(document.body);
  addEventListener('scroll', tick, { passive: true });
  addEventListener('resize', tick); tick();
}
hdrFx();

/* home banner slider: auto, random order, arrows, dots, swipe; pauses on hover, focus, touch and hidden tab */
function bindHero() {
  const h = $('hero'); if (!h || h._b) return; const S = [...h.querySelectorAll('.hslide')], T = [...h.querySelectorAll('.htext')], n = S.length; if (n < 2) return; h._b = 1;
  const dots = [...h.querySelectorAll('[data-hgo]')], play = h.querySelector('[data-hplay]'), ms = (+h.dataset.int || 6) * 1000, calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let order = [...Array(n).keys()];
  if (h.dataset.rand === '1') { for (let i = n - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; } const st = +h.dataset.start || 0; order = [st].concat(order.filter(x => x !== st)); }
  let pos = 0, cur = order[0], timer = 0, stopped = h.dataset.auto !== '1' || calm, hold = 0;
  h.style.setProperty('--hint', ms + 'ms');
  const load = i => { S[i].querySelectorAll('[data-src]').forEach(e => { e.src = e.dataset.src; e.removeAttribute('data-src'); }); S[i].querySelectorAll('[data-srcset]').forEach(e => { e.srcset = e.dataset.srcset; e.removeAttribute('data-srcset'); }); };
  const show = i => { if (i === cur) return; load(i); const old = cur; S[old].classList.add('out'); setTimeout(() => S[old].classList.remove('out'), 1100);
    [S, T].forEach(L => { L[old].classList.remove('on'); L[old].setAttribute('aria-hidden', 'true'); L[i].classList.add('on'); L[i].removeAttribute('aria-hidden'); });
    dots.forEach((d, k) => d.toggleAttribute('aria-current', k === i)); cur = i; pos = order.indexOf(i); load(order[(pos + 1) % n]); restart(); };
  const step = d => { h.classList.toggle('back', d < 0); show(order[(pos + d + n) % n]); };
  const restart = () => { clearTimeout(timer); h.classList.remove('playing'); h.classList.toggle('stopped', stopped); if (stopped || hold) return; void h.offsetWidth; h.classList.add('playing'); timer = setTimeout(() => step(1), ms); };
  const pause = v => { hold = v; restart(); };
  h.addEventListener('click', e => { if (e.target.closest('[data-hnext]')) step(1); else if (e.target.closest('[data-hprev]')) step(-1); else { const g = e.target.closest('[data-hgo]'); if (g) { h.classList.toggle('back', order.indexOf(+g.dataset.hgo) < pos); show(+g.dataset.hgo); } }
    if (e.target.closest('[data-hplay]')) { stopped = !stopped; play.setAttribute('aria-pressed', stopped); play.setAttribute('aria-label', stopped ? 'Play the slides' : 'Pause the slides'); restart(); } });
  h.addEventListener('mouseenter', () => pause(1)); h.addEventListener('mouseleave', () => pause(0));
  h.addEventListener('focusin', () => pause(1)); h.addEventListener('focusout', e => { if (!h.contains(e.relatedTarget)) pause(0); });
  h.addEventListener('keydown', e => { if (e.key === 'ArrowRight') step(1); if (e.key === 'ArrowLeft') step(-1); });
  let x0 = null, y0 = 0; h.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; pause(1); }, { passive: true });
  h.addEventListener('touchend', e => { if (x0 !== null) { const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0; if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) step(dx < 0 ? 1 : -1); } x0 = null; setTimeout(() => pause(0), 2500); }, { passive: true });
  document.addEventListener('visibilitychange', () => pause(document.hidden ? 1 : 0));
  if (calm && play) { play.setAttribute('aria-pressed', 'true'); play.setAttribute('aria-label', 'Play the slides'); }
  dots.forEach((d, k) => d.toggleAttribute('aria-current', k === cur));
  addEventListener('load', () => load(order[1 % n]), { once: true }); if (document.readyState === 'complete') load(order[1 % n]);
  restart();
}
function bindCat() { const t = location.hash.slice(1), a = t && document.querySelector('#ctypes [data-ct="' + CSS.escape(t) + '"]'); if (a) a.click(); }
function bind() { bindHero(); bindCat(); bindWish(); bindGrievance(); bindShop(); bindProduct(); bindList(); bindQuote(); bindContact(); badge(); }

/* bind immediately with built-in data, then refresh from JSON */
function swap(id, html) { const el = $(id); if (el && el.dataset.sig !== VI.sig(html)) { el.innerHTML = html; el.dataset.sig = VI.sig(html); return true; } return false; }
(async () => {
  badge();
  /* fetch fresh data after the page has finished loading, so it never competes with the first view */
  await new Promise(r => document.readyState === 'complete' ? r() : addEventListener('load', r, { once: true }));
  let raw;
  try { const [S, CATS, PRODUCTS] = await Promise.all(['settings.json', 'categories.json', 'products.json'].map(get));
    raw = { S, CATS, PRODUCTS, WORK: await get('projects.json').catch(() => []), QUOTES: await get('testimonials.json').catch(() => []), GUIDES: await get('guides.json').catch(() => []), BLOG: await get('blog.json').catch(() => []), CATALOGUE: await get('catalogue.json').catch(() => []), BANNERS: await get('banners.json').catch(() => ({})) };
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
