/* Dashboard: greeting with live India time, what needs attention, money and work numbers, charts (own SVG, no library), recent activity.
   Money figures come from the encrypted documents store (payment requests, quotations) and are shown only to people who can see them. */
const IST = 'Asia/Kolkata';
const dNow = () => new Date();
const dPart = (d, o) => d.toLocaleString('en-IN', { timeZone: IST, ...o });
const dYM = s => String(s || '').slice(0, 7); // "2026-11-18" → "2026-11"
const dKeyNow = () => { const p = new Intl.DateTimeFormat('en-CA', { timeZone: IST, year: 'numeric', month: '2-digit', day: '2-digit' }).format(dNow()); return p; };
function dMonths(n) { const [y, m] = dKeyNow().split('-').map(Number), out = []; for (let i = n - 1; i >= 0; i--) { const d = new Date(Date.UTC(y, m - 1 - i, 1)); out.push({ k: d.toISOString().slice(0, 7), l: d.toLocaleString('en-IN', { month: 'short', timeZone: 'UTC' }), y: d.getUTCFullYear() }); } return out; }
const dShort = n => { n = +n || 0; const a = Math.abs(n); return '₹' + (a >= 1e7 ? +(n / 1e7).toFixed(1) + ' Cr' : a >= 1e5 ? +(n / 1e5).toFixed(1) + ' L' : a >= 1e3 ? +(n / 1e3).toFixed(1) + 'k' : Math.round(n)); };
const dAgo = t => { const m = Math.round((Date.now() - t) / 6e4); return m < 1 ? 'just now' : m < 60 ? m + ' min ago' : m < 1440 ? Math.round(m / 60) + ' h ago' : m < 2880 ? 'yesterday' : Math.round(m / 1440) + ' days ago'; };
const DI = { // small line icons
  alert: '<path d="M12 3 2 20h20L12 3z"/><path d="M12 10v4M12 17.5v.01"/>', clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', ok: '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>', star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z"/>', up: '<path d="M12 4v12M7 9l5-5 5 5M5 20h14"/>', img: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 17-5-5-8 8"/>'
};
const dIco = (k, cls) => '<svg class="' + (cls || 'dico') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + DI[k] + '</svg>';

function dName() {
  const n = (ME && ME.name && ME.name !== 'Owner' ? ME.name : '') || (ME && ME.owner && DB.settings && DB.settings.payment && DB.settings.payment.name) || (ME && ME.email ? ME.email.split('@')[0] : '');
  return String(n).trim().split(/\s+/)[0].replace(/^./, c => c.toUpperCase());
}
function dGreet() { const h = +dPart(dNow(), { hour: 'numeric', hour12: false }) % 24; return h < 5 ? 'Good night' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; }

/* ── numbers ── */
function dMoney() {
  const V = window.VLT && VLT.data(); if (!V) return null;
  const pays = V.payments || [], docs = (V.docs || []), sum = r => (r.lines || []).reduce((s, l) => s + (+l.amount || 0), 0), today = dKeyNow(), ym = dYM(today);
  const lastYm = dMonths(2)[0].k;
  const paid = pays.filter(r => r.status === 'paid'), pend = pays.filter(r => r.status === 'pending');
  const quotes = docs.filter(d => d.type === 'quotation');
  return {
    can: { pay: canView('payments'), doc: canView('documents') },
    recvMonth: paid.filter(r => dYM(r.paid_on) === ym).reduce((s, r) => s + sum(r), 0),
    recvLast: paid.filter(r => dYM(r.paid_on) === lastYm).reduce((s, r) => s + sum(r), 0),
    recvCount: paid.filter(r => dYM(r.paid_on) === ym).length,
    waiting: pend.reduce((s, r) => s + sum(r), 0), waitN: pend.length, overdue: pend.filter(r => r.due && r.due < today),
    qMonth: quotes.filter(d => dYM(d.date) === ym), qVal: quotes.filter(d => dYM(d.date) === ym).reduce((s, d) => s + (dTot(d) || 0), 0),
    byMonth: dMonths(6).map(m => ({ ...m, v: paid.filter(r => dYM(r.paid_on) === m.k).reduce((s, r) => s + sum(r), 0), n: paid.filter(r => dYM(r.paid_on) === m.k).length })),
    qByMonth: dMonths(6).map(m => { const L = quotes.filter(d => dYM(d.date) === m.k); return { ...m, v: L.reduce((s, d) => s + (dTot(d) || 0), 0), n: L.length }; }),
    recent: [...docs.map(d => ({ t: d.updated || Date.parse(d.date) || 0, kind: (VLT && D_LABEL(d.type)) || 'Document', no: d.no, who: d.client, amt: dTot(d), href: '#documents/' + d.id, st: d.status === 'final' ? ['Final', 'ok'] : ['Draft', 'warn'] })),
      ...pays.map(r => ({ t: r.updated || Date.parse(r.date) || 0, kind: 'Payment request', no: r.no, who: r.client, amt: sum(r), href: '#payments/' + r.id, st: r.status === 'paid' ? ['Paid', 'ok'] : r.status === 'cancelled' ? ['Cancelled', ''] : (r.due && r.due < today ? ['Overdue', 'bad'] : ['Waiting', 'warn']) }))]
      .filter(x => (x.kind === 'Payment request' ? canView('payments') : canView('documents'))).sort((a, b) => b.t - a.t).slice(0, 6)
  };
}
const dTot = d => { const t = VLT.docTotal(d); return t && typeof t === 'object' ? (+t.grand || 0) : (+t || 0); };
const D_LABEL = t => ({ quotation: 'Quotation', agreement: 'Agreement', bill: 'Bill', invoice: 'Invoice' })[t];

/* ── bar chart (single series, SVG). Hover / focus a bar for the exact value. ── */
function dBars(data, o) {
  o = o || {}; const W = 560, H = 210, L = 48, R = 8, T = 12, B = 30, max = Math.max(...data.map(d => d.v), 0);
  if (!max) return '<div class="dempty">' + dIco('clock', 'dico lg') + '<p>' + esc(o.empty || 'Nothing yet') + '</p></div>';
  const step = (() => { const raw = max / 4, p = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / p; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p; })(), top = step * 4;
  const y = v => T + (H - T - B) * (1 - v / top), bw = (W - L - R) / data.length, w = Math.min(46, bw * .56);
  let g = '';
  for (let i = 0; i <= 4; i++) { const v = step * i, yy = y(v).toFixed(1); g += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + yy + '" y2="' + yy + '" class="' + (i ? 'grid' : 'base') + '"/><text x="' + (L - 8) + '" y="' + yy + '" dy="4" text-anchor="end" class="ax">' + (o.money ? dShort(v) : Math.round(v)) + '</text>'; }
  const bars = data.map((d, i) => {
    const cx = L + bw * i + bw / 2, x = cx - w / 2, y0 = y(0), y1 = y(d.v), h = Math.max(0, y0 - y1), r = Math.min(4, h, w / 2), cur = i === data.length - 1;
    const path = h ? 'M' + x + ',' + y0 + 'V' + (y1 + r) + 'Q' + x + ',' + y1 + ' ' + (x + r) + ',' + y1 + 'H' + (x + w - r) + 'Q' + (x + w) + ',' + y1 + ' ' + (x + w) + ',' + (y1 + r) + 'V' + y0 + 'Z' : '';
    const tip = d.l + ' ' + d.y + ': ' + (o.money ? money(Math.round(d.v)) : d.v) + (o.unit ? ' · ' + d.n + ' ' + o.unit + (d.n === 1 ? '' : 's') : '');
    return '<g class="bar' + (cur ? ' cur' : '') + '" tabindex="0" role="img" aria-label="' + esc(tip) + '" data-tip="' + esc(tip) + '"><rect class="hit" x="' + (L + bw * i) + '" y="' + T + '" width="' + bw + '" height="' + (H - T - B) + '"/>' + (path ? '<path d="' + path + '"/>' : '') +
      '<text x="' + cx + '" y="' + (H - B + 18) + '" text-anchor="middle" class="ax' + (cur ? ' now' : '') + '">' + d.l + '</text></g>';
  }).join('');
  return '<svg class="dchart" viewBox="0 0 ' + W + ' ' + H + '" role="group" aria-label="' + esc(o.title || '') + '">' + g + bars + '</svg>';
}
/* horizontal bars: products by category */
function dHBars(rows) {
  const max = Math.max(1, ...rows.map(r => r.v));
  return rows.length ? '<div class="dhb">' + rows.map(r => '<a class="dhr' + (r.other ? ' other' : '') + '" href="' + r.href + '" data-tip="' + esc(r.l + ': ' + r.v) + '"><span class="dhl">' + esc(r.l) + '</span><span class="dht"><i style="width:' + Math.max(2, r.v / max * 100).toFixed(1) + '%"></i></span><b>' + r.v + '</b></a>').join('') + '</div>' : '<div class="dempty"><p>No products yet</p></div>';
}
function dTipWire(root) {
  let tip = $('dtip'); if (!tip) { tip = document.createElement('div'); tip.id = 'dtip'; tip.setAttribute('role', 'tooltip'); document.body.append(tip); }
  const show = el => { const r = el.getBoundingClientRect(); tip.textContent = el.dataset.tip; tip.hidden = false; const tw = tip.offsetWidth; tip.style.left = Math.max(8, Math.min(innerWidth - tw - 8, r.left + r.width / 2 - tw / 2)) + 'px'; tip.style.top = (r.top + scrollY - tip.offsetHeight - 8 + (el.classList.contains('bar') ? Math.max(0, el.querySelector('path') ? el.querySelector('path').getBoundingClientRect().top - r.top : r.height - 30) : 0)) + 'px'; };
  root.querySelectorAll('[data-tip]').forEach(el => { el.onmouseenter = el.onfocus = () => show(el); el.onmouseleave = el.onblur = () => tip.hidden = true; });
}

/* ── what needs attention ── */
function dAttention() {
  const A = [], S = DB.settings || {}, c = gh(), M = dMoney();
  if (window.PR_REVIEW && canView('payments')) A.push(['img', 'bad', window.PR_REVIEW + ' payment screenshot' + (window.PR_REVIEW > 1 ? 's' : '') + ' to check', 'Customers say they paid — check your bank, then approve or reject.', '#payments', 'Check']);
  if (M && M.can.pay && M.overdue.length) A.push(['clock', 'bad', M.overdue.length + ' payment request' + (M.overdue.length > 1 ? 's are' : ' is') + ' overdue', M.overdue.slice(0, 3).map(r => r.no + (r.client ? ' · ' + r.client : '')).join(', '), '#payments', 'Open']);
  if (typeof PRV !== 'undefined' && PRV.length && (can('products', 'edit') || can('testimonials', 'edit'))) A.push(['star', 'warn', PRV.length + ' new review' + (PRV.length > 1 ? 's' : '') + ' waiting for approval', 'Approve real reviews to show them on the website.', '#testimonials', 'Review']);
  if (typeof MAIL_UNREAD !== 'undefined' && MAIL_UNREAD > 0 && canView('mail')) A.push(['mail', 'warn', MAIL_UNREAD + ' unread email' + (MAIL_UNREAD > 1 ? 's' : ''), 'Enquiries and replies in your business mailboxes.', '#mail', 'Read']);
  if (DIRTY.size) A.push(['up', 'warn', 'Unpublished changes', [...DIRTY].map(k => PAGES[k] ? PAGES[k].t : k).join(', ') + ' — publish so the website shows them.', '#' + [...DIRTY][0], 'Publish']);
  if (M && M.can.pay && M.waitN && !M.overdue.length) A.push(['clock', 'info', M.waitN + ' payment request' + (M.waitN > 1 ? 's' : '') + ' waiting', money(Math.round(M.waiting)) + ' still to come.', '#payments', 'View']);
  if (S.sample_data) A.push(['alert', 'warn', 'Sample products are showing', 'Replace them with your real furniture, then untick "Sample data" in Business details.', '#settings', 'Fix']);
  if (!(c && c.token) && !(typeof SERVER === 'function' && SERVER())) A.push(['alert', 'warn', 'Publishing is not connected', 'Connect GitHub so Publish updates the live website.', '#publishing', 'Set up']);
  return A;
}
function drawAttn() {
  const box = $('dAttn'); if (!box) return; const A = dAttention();
  box.innerHTML = A.length ? A.map(a => '<li class="att ' + a[1] + '">' + dIco(a[0]) + '<div><b>' + esc(a[2]) + '</b><span>' + esc(a[3]) + '</span></div><a class="btn sm" href="' + a[4] + '">' + a[5] + '</a></li>').join('')
    : '<li class="att ok">' + dIco('ok') + '<div><b>All clear</b><span>Nothing is waiting for you right now.</span></div></li>';
  const n = $('dAttnN'); if (n) n.textContent = A.filter(a => a[1] !== 'info').length ? A.filter(a => a[1] !== 'info').length + ' to do' : '';
}

/* ── live clock ── */
let D_TICK = 0;
function dTick() {
  const el = $('dClock'); if (!el) { clearInterval(D_TICK); D_TICK = 0; return; }
  const n = dNow(); el.textContent = dPart(n, { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true }).replace(/\s?([ap])m/i, (m, x) => ' ' + x.toUpperCase() + 'M');
  $('dDate').textContent = dPart(n, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const g = $('dGreet'); if (g) g.textContent = dGreet() + (dName() ? ', ' + dName() : '');
}

function pgDash() {
  const M = dMoney(), P = DB.products || [], cats = DB.categories || [];
  const kpi = (lab, val, sub, href, tone) => '<a class="kpi' + (tone ? ' ' + tone : '') + '" href="' + href + '"><span class="kl">' + lab + '</span><b class="kv">' + val + '</b><span class="ks">' + sub + '</span></a>';
  const chg = M && M.recvLast ? Math.round((M.recvMonth - M.recvLast) / M.recvLast * 100) : null;
  const kpis = (M && M.can.pay ? kpi('Received this month', money(Math.round(M.recvMonth)), M.recvCount + ' payment' + (M.recvCount === 1 ? '' : 's') + (chg === null ? '' : ' · <span class="' + (chg >= 0 ? 'up' : 'down') + '">' + (chg >= 0 ? '▲ ' : '▼ ') + Math.abs(chg) + '%</span> vs last month'), '#payments') +
      kpi('Waiting for payment', money(Math.round(M.waiting)), M.waitN + ' request' + (M.waitN === 1 ? '' : 's') + (M.overdue.length ? ' · <span class="down">' + M.overdue.length + ' overdue</span>' : ''), '#payments') : '') +
    (M && M.can.doc ? kpi('Quotations this month', String(M.qMonth.length), 'Worth ' + money(Math.round(M.qVal)), '#documents') : '') +
    kpi('Products', String(P.filter(p => p.visible !== false).length), P.filter(p => p.visible === false).length + ' hidden · ' + cats.length + ' categories', '#products') +
    (!(M && M.can.pay) ? kpi('Catalogue designs', String((DB.catalogue || []).length), (DB.projects || []).length + ' project sites', '#catalogue') : '');
  const byCat = cats.map(c => ({ l: c.name, v: P.filter(p => p.category === c.slug).length, href: '#products' })).filter(r => r.v).sort((a, b) => b.v - a.v);
  const catRows = byCat.length > 7 ? byCat.slice(0, 6).concat([{ other: 1, l: 'Other', v: byCat.slice(6).reduce((s, r) => s + r.v, 0), href: '#products' }]) : byCat;
  const site = [['catalogue', 'Catalogue designs', (DB.catalogue || []).length], ['projects', 'Project sites', (DB.projects || []).length], ['blog', 'Blog articles', (DB.blog || []).length], ['testimonials', 'Reviews', (DB.testimonials || []).length], ['banners', 'Home banners', ((DB.banners || {}).items || []).filter(b => b.visible !== false).length], ['orders', 'Orders on this device', orders().length]].filter(x => canView(x[0]));
  C('<section class="dhero"><div class="dh1"><p class="dk">' + esc(ME && ME.roleName || '') + ' · Mumbai Interior</p><h2 id="dGreet">' + esc(dGreet() + (dName() ? ', ' + dName() : '')) + '</h2><p class="dsub">Here is how the business is doing today.</p></div>' +
    '<div class="dh2" aria-live="off"><div class="dclock" id="dClock">--:--</div><div class="ddate" id="dDate"></div><div class="dtz">India time (IST)</div></div></section>' +
    '<div class="kpis">' + kpis + '</div>' +
    '<div class="dgrid">' +
      '<div class="card dcard dattn"><h2>Needs your attention <span class="pill bad" id="dAttnN"></span></h2><ul id="dAttn" class="attl"></ul></div>' +
      '<div class="card dcard"><h2>Quick actions</h2><div class="qa">' + [['documents.add', '#documents/new-quotation', 'New quotation', 'documents'], ['payments.add', '#payments/new', 'Payment request', 'payments'], ['products.add', '#products/new', 'Add product', 'products'], ['catalogue.add', '#catalogue/new', 'Catalogue design', 'catalogue'], ['blog.add', '#blog/new', 'Write article', 'blog'], ['', '#card', 'Visiting card', 'card']].filter(q => !q[0] || can(q[0].split('.')[0], q[0].split('.')[1])).map(q => '<a href="' + q[1] + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICON[q[3]] || '') + '</svg>' + q[2] + '</a>').join('') + '<a href="/" target="_blank" rel="noopener"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18"/></svg>Open website</a></div></div>' +
    '</div>' +
    (M && (M.can.pay || M.can.doc) ? '<div class="dgrid">' +
      (M.can.pay ? '<div class="card dcard"><h2>Money received <span class="hint">last 6 months</span></h2><p class="dbig">' + money(Math.round(M.byMonth.reduce((s, m) => s + m.v, 0))) + ' <span>in 6 months</span></p>' + dBars(M.byMonth, { money: 1, unit: 'payment', title: 'Money received by month', empty: 'No payments marked paid yet' }) + '</div>' : '') +
      (M.can.doc ? '<div class="card dcard"><h2>Quotations given <span class="hint">value, last 6 months</span></h2><p class="dbig">' + M.qByMonth.reduce((s, m) => s + m.n, 0) + ' <span>quotations · ' + money(Math.round(M.qByMonth.reduce((s, m) => s + m.v, 0))) + '</span></p>' + dBars(M.qByMonth, { money: 1, unit: 'quotation', title: 'Quotation value by month', empty: 'No quotations in the last 6 months' }) + '</div>' : '') +
    '</div>' : '') +
    '<div class="dgrid">' +
      (M && M.recent.length ? '<div class="card dcard"><h2>Recent activity <a class="btn sm" href="#documents">All documents</a></h2><ul class="recent">' + M.recent.map(r => '<li><a href="' + r.href + '"><div><b>' + esc(r.no || '—') + '</b> <span class="pill ' + r.st[1] + '">' + r.st[0] + '</span><span class="s">' + esc(r.kind + (r.who ? ' · ' + r.who : '')) + '</span></div><div class="ra"><b>' + money(Math.round(r.amt || 0)) + '</b><span class="s">' + (r.t ? dAgo(r.t) : '') + '</span></div></a></li>').join('') + '</ul></div>' : '') +
      '<div class="card dcard"><h2>Products by category <a class="btn sm" href="#products">Products</a></h2>' + dHBars(catRows) + '</div>' +
      '<div class="card dcard"><h2>On the website</h2><div class="sitest">' + site.map(x => '<a href="#' + x[0] + '"><b>' + x[2] + '</b><span>' + x[1] + '</span></a>').join('') + '</div></div>' +
    '</div>');
  drawAttn(); dTick(); if (!D_TICK) D_TICK = setInterval(dTick, 1000); dTipWire($('content'));
  // fresh counts that load in the background: payment screenshots, reviews, unread mail
  if (typeof prLoadProofs === 'function' && canView('payments')) prLoadProofs().then(drawAttn).catch(() => {});
  setTimeout(drawAttn, 2500);
}
