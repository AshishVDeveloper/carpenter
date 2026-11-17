/* Mumbai Interior — page renderer shared by the static build (tools/build.mjs) and the browser (assets/store.js).
   Every page is pre-rendered into its own folder for search engines, then refreshed in the browser from /data/*.json. */
(function (root, factory) { if (typeof module === 'object' && module.exports) module.exports = factory(); else root.VI = factory(); })(this, function () {
'use strict';
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const slugify = s => String(s || '').toLowerCase().replace(/&/g, ' ').replace(/\(.*?\)/g, ' ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const inr = n => '₹' + Number(n || 0).toLocaleString('en-IN');
const src = s => !s ? '/assets/logo.svg' : /^(https?:|data:|\/)/.test(s) ? s : '/' + s;
/* responsive photos: 400 px and 600 px versions; if a fresh upload has no small copy yet, fall back to the original */
const RS = u => /^\/images\/(products|site|blog)\/[a-z0-9-]+-sm\.webp$/.test(u) ? ' srcset="' + u.replace(/-sm\.webp$/, '-xs.webp') + ' 400w, ' + u + ' 600w" sizes="(max-width:700px) 92vw, 320px" onerror="this.onerror=null;this.removeAttribute(\'srcset\');this.src=this.src.replace(/-(sm|xs)\\.webp$/,\'.webp\')"' : '';
/* readable quote links: /get-quote/#contract-basis instead of ?mode=Contract%20basis */
const qslug = t => String(t || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const small = s => { const u = src(s); return /^\/images\/(products|site|blog)\/[a-z0-9-]+\.webp$/.test(u) && !/-sm\.webp$/.test(u) ? u.replace(/\.webp$/, '-sm.webp') : u; };

const I = {
  wa: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.8 11.9 11.9 0 0 0 4.6 4c1.7.7 2.4.8 3.2.7a2.8 2.8 0 0 0 1.8-1.3 2.3 2.3 0 0 0 .2-1.3c-.1-.1-.3-.2-.5-.3z"/></svg>',
  list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M9 5h11M9 12h11M9 19h11"/><circle cx="4.5" cy="5" r="1.2"/><circle cx="4.5" cy="12" r="1.2"/><circle cx="4.5" cy="19" r="1.2"/></svg>',
  pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>',
  phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/></svg>',
  mail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>',
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  ruler: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="2" y="8" width="20" height="8" rx="1"/><path d="M6 8v3M10 8v4M14 8v3M18 8v4"/></svg>',
  truck: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M3 6h11v10H3zM14 10h4l3 3v3h-7"/><circle cx="7" cy="18" r="1.8"/><circle cx="17" cy="18" r="1.8"/></svg>',
  shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/><path d="m9 12 2 2 4-4"/></svg>',
  tree: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 22v-6M12 3 6 11h3l-4 5h14l-4-5h3z"/></svg>',
  building: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M4 21V5l8-2v18M12 8l8 2v11M2 21h20M7 8h2M7 12h2M7 16h2M15 13h2M15 17h2"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="m5 12 4.5 4.5L19 7"/></svg>',
  arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  moon: '<svg class="i-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/></svg>',
  sun: '<svg class="i-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
  contrast: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>'
};

/* ── data ── */
function prep(raw) {
  const S = Object.assign({}, raw.S || {});
  S.site_url = (S.site_url || 'https://www.mumbai-interior.in').replace(/\/$/, '');
  S.services = (S.services || []).map((s, i) => Object.assign({}, s, { slug: s.slug || slugify(s.title) || 'service-' + i, est: s.est || [], points: s.points || [] }));
  const CATS = (raw.CATS || []).slice().sort((a, b) => (a.order || 99) - (b.order || 99));
  const seen = {};
  const PRODUCTS = (raw.PRODUCTS || []).filter(p => p.visible !== false).sort((a, b) => (a.order || 99) - (b.order || 99)).map(p => {
    let s = slugify(p.name) || 'item-' + p.id; if (seen[s]) s += '-' + p.id; seen[s] = 1;
    const lo = +p.price_min || +p.price || 0, hi = +p.price_max || (lo ? Math.round(lo * 1.4 / 500) * 500 : 0);
    return Object.assign({}, p, { slug: s, lo, hi, url: '/furniture/' + (p.category || 'other') + '/' + s + '/' });
  });
  const WORK = (raw.WORK || []).slice().sort((a, b) => (a.order || 99) - (b.order || 99));
  const areaNames = [];
  (S.locations || []).concat(WORK.map(w => w.area)).forEach(a => { a = String(a || '').trim(); if (a && !/&/.test(a) && !areaNames.some(x => slugify(x) === slugify(a))) areaNames.push(a); });
  const AREAS = areaNames.map(n => ({ name: n, short: n.split(',')[0].replace(/\s*\(.*\)/, '').trim(), slug: slugify(n) }));
  const BLOG = (raw.BLOG || []).filter(b => b && !b.draft && b.slug && b.title).map((b, i) => Object.assign({}, b, { _i: i, cat: b.category || 'Tips', catSlug: slugify(b.category || 'Tips') })).sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')) || a._i - b._i);
  return { S, CATS, PRODUCTS, WORK, AREAS, QUOTES: raw.QUOTES || [], GUIDES: raw.GUIDES || [], BLOG };
}
const catName = (D, slug) => (D.CATS.find(c => c.slug === slug) || {}).name || slug;
const waNum = S => String(S.whatsapp || S.phone || '').replace(/\D/g, '');
const waLink = (S, text) => 'https://wa.me/' + waNum(S) + '?text=' + encodeURIComponent(text);
const tel = S => 'tel:+91' + String(S.phone || '').replace(/\D/g, '').slice(-10);
const range = p => p.lo ? inr(p.lo) + ' – ' + inr(p.hi) : 'Price on request';

/* ── shared blocks ── */
function priceHTML(p, big) {
  return '<div class="est' + (big ? ' big' : '') + '"><small>Estimated price</small><b>' + range(p) + '</b></div>';
}
function card(D, p) {
  return '<article class="card"><a class="ph" href="' + p.url + '"><img src="' + esc(small((p.images || [])[0])) + '"' + RS(small((p.images || [])[0])) + ' alt="' + esc(p.name) + '" loading="lazy" width="600" height="450"/>' +
    (p.customizable ? '<span class="badge">Made to your size</span>' : '') + '</a>' +
    '<div class="body"><span class="kicker">' + esc(catName(D, p.category)) + '</span><h3><a href="' + p.url + '">' + esc(p.name) + '</a></h3>' + priceHTML(p) +
    '<div class="acts"><button class="btn btn-primary btn-sm" type="button" data-add="' + p.id + '">' + I.plus + 'Add to quote</button><a class="btn btn-ghost btn-sm" href="' + p.url + '">Details<span class="sr"> of ' + esc(p.name) + '</span></a></div></div></article>';
}
function svcTile(s) {
  return '<a class="svc" href="/services/' + s.slug + '/"><span class="svc-ph"><img src="' + esc(small(s.image || 'images/site/home-interiors.webp')) + '"' + RS(small(s.image || 'images/site/home-interiors.webp')) + ' alt="' + esc(s.title) + '" loading="lazy" width="600" height="450"/></span>' +
    '<span class="svc-body"><h3>' + esc(s.title) + '</h3><p>' + esc(s.desc) + '</p>' + (s.est[0] ? '<span class="svc-est">' + esc(s.est[0].item) + ': <b>' + esc(s.est[0].range) + '</b></span>' : '') +
    '<span class="svc-go">View details ' + I.arrow + '</span></span></a>';
}
function estTable(rows) {
  if (!rows || !rows.length) return '';
  return '<div class="esttable"><table><thead><tr><th scope="col">Work</th><th scope="col">Estimated cost</th></tr></thead><tbody>' +
    rows.map(r => '<tr><td>' + esc(r.item) + '</td><td>' + esc(r.range) + '</td></tr>').join('') + '</tbody></table><p class="hint">Indicative estimates for Mumbai and Thane. The final price is confirmed after a free site visit and measurement.</p></div>';
}
function modesHTML(D) {
  return '<div class="modes">' + (D.S.work_modes || []).map(m => '<div class="mode"><h3>' + esc(m.title) + '</h3><p>' + esc(m.desc) + '</p>' + (m.est ? '<p class="mode-est">' + I.ruler + esc(m.est) + '</p>' : '') +
    '<a class="link" href="/get-quote/#' + qslug(m.title) + '">Ask for a ' + esc(m.title.toLowerCase()) + ' quote</a></div>').join('') + '</div>';
}
function workHTML(list) {
  return '<div class="work">' + list.map(w => '<article class="site-card">' + (w.images && w.images[0] ? '<img src="' + esc(src(w.images[0])) + '" alt="' + esc(w.title) + '" loading="lazy"/>' : '<div class="noimg">' + I.building + '</div>') +
    '<div><span class="tag">' + esc(w.type || '') + '</span><h3>' + esc(w.title) + '</h3><p class="meta">' + I.pin + esc(w.area || '') + '</p>' + (w.description ? '<p>' + esc(w.description) + '</p>' : '') + '</div></article>').join('') + '</div>';
}
function areasHTML(D, current) {
  return '<ul class="areas">' + D.AREAS.map(a => '<li><a href="/areas/' + a.slug + '/"' + (a.slug === current ? ' aria-current="page"' : '') + '>' + I.pin + esc(a.name) + '</a></li>').join('') + '</ul>';
}
function teamHTML(D) {
  const T = D.S.team || []; if (!T.length) return '';
  return '<div class="team">' + T.map(t => '<figure class="person' + (t.photo ? ' has-photo' : '') + '">' + (t.photo ? '<img class="pphoto" src="' + esc(src(t.photo)) + '"' + (/^\/images\/team\/[a-z0-9-]+\.webp$/.test(src(t.photo)) ? ' srcset="' + src(t.photo).replace(/\.webp$/, '-xs.webp') + ' 320w, ' + src(t.photo) + ' 600w" sizes="(max-width:700px) 80vw, 300px"' : '') + ' alt="' + esc(t.name) + ', ' + esc(t.role) + '" loading="lazy" width="600" height="600"/>' : '<span class="mono" aria-hidden="true">' + esc(String(t.name || '').split(/\s+/).map(w => w[0]).slice(0, 2).join('')) + '</span>') + '<figcaption><b>' + esc(t.name) + '</b><span class="role">' + esc(t.role) + '</span>' + (t.bio ? '<p>' + esc(t.bio) + '</p>' : '') + '</figcaption></figure>').join('') + '</div>';
}
function faqHTML(D) {
  const F = D.S.faqs || []; if (!F.length) return '';
  return '<div class="faq">' + F.map(f => '<details><summary>' + esc(f.q) + I.plus + '</summary><p>' + esc(f.a) + '</p></details>').join('') + '</div>';
}
function stepsHTML() {
  return '<ol class="steps">' + [['Share your requirement', 'Send photos, a sketch or your room sizes on WhatsApp.'], ['Site visit & measurement', 'We visit, measure and suggest materials and finishes.'], ['Approve the quote', 'You get a clear contract or labour-basis price before we start.'], ['We build and finish', 'Our carpenters complete the work on site or in our workshop.']]
    .map(s => '<li class="step"><h3>' + s[0] + '</h3><p>' + s[1] + '</p></li>').join('') + '</ol>';
}
function ctaBand(D, title, text) {
  return '<section class="sec tight"><div class="wrap"><div class="band"><div><h2>' + esc(title) + '</h2><p>' + esc(text) + '</p></div><div class="band-btns"><a class="btn btn-tape" href="/get-quote/">Get a free estimate</a><a class="btn btn-wa" href="' + esc(waLink(D.S, 'Hi, I want a quote for interior / furniture work.')) + '" target="_blank" rel="noopener">' + I.wa + 'WhatsApp</a></div></div></div></section>';
}
const crumbs = list => '<nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a>' + list.map(c => ' <span aria-hidden="true">/</span> ' + (c[1] ? '<a href="' + c[1] + '">' + esc(c[0]) + '</a>' : '<span aria-current="page">' + esc(c[0]) + '</span>')).join('') + '</nav>';
const pageHead = (title, lede, cr) => '<section class="phead"><div class="wrap">' + (cr || '') + '<h1>' + esc(title) + '</h1>' + (lede ? '<p class="lede">' + esc(lede) + '</p>' : '') + '</div></section>';
function photoHead(img, title, lede, cr, extra) {
  return '<section class="phero"><img src="' + esc(src(img)) + '" alt="' + esc(title) + '" fetchpriority="high" width="1200" height="900"/><div class="wrap">' + (cr || '') + '<h1>' + esc(title) + '</h1>' + (lede ? '<p class="lede">' + esc(lede) + '</p>' : '') + (extra || '') + '</div></section>';
}
function crumbLD(D, list) {
  return { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [['Home', '/']].concat(list).map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c[0], item: D.S.site_url + (c[1] || '') })) };
}

/* ── pages ── */
const V = {};
V.home = D => {
  const S = D.S, feat = D.PRODUCTS.filter(p => p.featured).concat(D.PRODUCTS.filter(p => !p.featured)).slice(0, 8);
  const ld = [{ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: (S.faqs || []).map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) }];
  const body =
    '<section class="hero"><picture><source media="(max-width:700px)" srcset="/images/site/hero-sm.webp"/><img src="/images/site/hero.webp" alt="Living and dining room interior with an L-shaped sofa, dining table and wall panelling" fetchpriority="high" width="1920" height="1080"/></picture>' +
    '<div class="wrap"><div class="hero-in"><p class="hero-k">World-class furniture, made in India · Custom furniture</p>' +
    '<h1>' + esc(S.hero_title) + '</h1><p class="lede">' + esc(S.hero_text) + '</p>' +
    '<div class="ctas"><a class="btn btn-tape" href="/get-quote/">Get a free estimate</a><a class="btn btn-light" href="/services/">Our services</a></div>' +
    '<div class="tape" aria-hidden="true">' + [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(i => '<span>' + (i * 10) + '</span>').join('') + '</div>' +
    '<ul class="trust"><li><b>' + D.AREAS.length + '</b> areas served</li><li><b>2 ways</b> to hire — contract or labour</li><li><b>Free</b> site visit</li></ul></div></div></section>' +

    '<section class="sec"><div class="wrap"><div class="sec-head"><div><h2>What we do</h2><p class="lede">Complete interiors and carpentry for homes and businesses — with an estimate for every kind of work.</p></div><a class="link" href="/services/">All services</a></div><div class="svcs">' + S.services.map(svcTile).join('') + '</div></div></section>' +

    '<section class="sec alt"><div class="wrap split"><div><h2>Contract basis or labour basis</h2><p class="lede">Choose how you want to hire us. Either way, our own carpenters do the work.</p>' + modesHTML(D) + '</div>' +
    '<figure class="photo"><img src="/images/site/workshop-sm.webp" alt="Carpenter drilling a wooden plank in the workshop" loading="lazy" width="600" height="450"/><figcaption>Our carpenters build on site and in our workshop.</figcaption></figure></div></section>' +

    '<section class="sec"><div class="wrap"><div class="sec-head"><div><h2>Furniture, made to your size</h2><p class="lede">Estimated prices for popular pieces. Change the size, wood or finish and we will quote the exact price.</p></div><a class="link" href="/furniture/">See all ' + D.PRODUCTS.length + ' designs</a></div><div class="grid">' + feat.map(p => card(D, p)).join('') + '</div></div></section>' +

    (D.WORK.length ? '<section class="sec alt"><div class="wrap"><div class="sec-head"><div><h2>Where we have worked</h2><p class="lede">Homes, offices, shops, showrooms and mall stores across Mumbai and Thane.</p></div><a class="link" href="/our-work/">Our work</a></div>' + workHTML(D.WORK.slice(0, 6)) +
      '<h3 class="mini">Areas we serve</h3>' + areasHTML(D) + '</div></section>' : '') +

    '<section class="sec"><div class="wrap"><h2>How we work</h2><p class="lede mb16">From your first message to the finished space.</p>' + stepsHTML() + '</div></section>' +

    ((S.team || []).length ? '<section class="sec alt"><div class="wrap split"><div><h2>The people behind the work</h2><p class="lede">' + esc(S.about) + '</p><a class="link" href="/about/">About us</a></div>' + teamHTML(D) + '</div></section>' : '') +

    (D.QUOTES.length ? '<section class="sec"><div class="wrap"><h2>What customers say</h2><div class="quotes">' + D.QUOTES.map(q => '<figure class="quote"><div class="stars" aria-label="' + (q.rating || 5) + ' out of 5">' + '★'.repeat(q.rating || 5) + '</div><p>' + esc(q.text) + '</p><figcaption><b>' + esc(q.name) + '</b><small>' + esc(q.place || '') + '</small></figcaption></figure>').join('') + '</div></div></section>' : '') +

    (D.BLOG.length ? '<section class="sec alt"><div class="wrap"><div class="sec-head"><div><h2>From our blog</h2><p class="lede">Ideas, costs and care tips from our carpenters and designers.</p></div><a class="link" href="/blog/">All articles</a></div><div class="svcs">' + D.BLOG.slice(0, 3).map(blogCard).join('') + '</div></div></section>' :
    D.GUIDES.length ? '<section class="sec alt"><div class="wrap"><div class="sec-head"><div><h2>Guides and price advice</h2><p class="lede">Free, honest guides to help you plan your budget.</p></div><a class="link" href="/guides/">All guides</a></div><div class="svcs">' + D.GUIDES.slice(0, 3).map(guideCard).join('') + '</div></div></section>' : '') +
    ((S.faqs || []).length ? '<section class="sec"><div class="wrap split"><div><h2>Questions people ask</h2><p class="lede">Still unsure? Call <a class="link" href="' + tel(S) + '">' + esc(S.phone) + '</a> — we are happy to explain.</p></div>' + faqHTML(D) + '</div></section>' : '') +
    ctaBand(D, 'Planning an interior or furniture project?', 'Tell us what you need. We will visit, measure and give you a clear estimate on contract or labour basis.');
  return { title: S.name + ' — Custom Furniture & Interiors in Mumbai', desc: 'Home interiors, modular kitchens, wardrobes, office, shop and mall fit-outs and made-to-measure furniture by ' + S.name + '. Contract or labour basis. Free site visit. Call ' + S.phone + '.', body, ld, image: '/images/site/og.jpg' };
};

V.services = D => {
  const S = D.S;
  const body = pageHead('Interior services and estimated costs', 'Homes, kitchens, offices, shops, showrooms and malls — and furniture made in our own workshop. Every service comes with an indicative cost so you can plan your budget.', crumbs([['Services']])) +
    '<section class="sec tight"><div class="wrap svc-list">' + S.services.map((s, i) =>
      '<article class="svc-row' + (i % 2 ? ' flip' : '') + '"><a class="svc-row-ph" href="/services/' + s.slug + '/"><img src="' + esc(small(s.image)) + '"' + RS(small(s.image)) + ' alt="' + esc(s.title) + '" loading="lazy" width="600" height="450"/></a><div><h2><a href="/services/' + s.slug + '/">' + esc(s.title) + '</a></h2><p>' + esc(s.intro || s.desc) + '</p>' + estTable(s.est.slice(0, 3)) + '<a class="btn btn-primary btn-sm" href="/services/' + s.slug + '/">' + esc(s.title) + ' details</a></div></article>').join('') + '</div></section>' +
    '<section class="sec alt"><div class="wrap"><h2>Two ways to work with us</h2><p class="lede mb14">Pick what suits your budget and how involved you want to be.</p>' + modesHTML(D) + '</div></section>' + ctaBand(D, 'Not sure what it will cost?', 'Send us your room sizes or a photo on WhatsApp and we will give you a quick estimate.');
  return { title: 'Interior Services & Cost Estimates in Mumbai, Thane | ' + S.name, desc: 'Home interiors, modular kitchens, office interiors, shop & showroom fit-outs, mall work and furniture to measure — with estimated costs per sq ft. Contract or labour basis.', body, ld: [crumbLD(D, [['Services', '/services/']])] };
};

V.service = (D, slug) => {
  const S = D.S, s = S.services.find(x => x.slug === slug); if (!s) return null;
  const rel = D.PRODUCTS.filter(p => slug === 'furniture-to-measure' || (slug === 'home-interiors' && /wardrobes|beds|tv-units|storage/.test(p.category)) || (slug === 'office-interiors' && /study|chairs/.test(p.category))).slice(0, 4);
  const others = S.services.filter(x => x.slug !== slug);
  const body = photoHead(s.image, s.title + ' in Mumbai, Thane & Navi Mumbai', s.desc, crumbs([['Services', '/services/'], [s.title]]), '<div class="ctas"><a class="btn btn-tape" href="/get-quote/#' + qslug(s.title) + '">Get a free estimate</a><a class="btn btn-light" href="' + esc(waLink(S, 'Hi, I want a quote for ' + s.title.toLowerCase() + '.')) + '" target="_blank" rel="noopener">' + I.wa + 'WhatsApp us</a></div>') +
    '<section class="sec"><div class="wrap split"><div><h2>What we do</h2><p class="lede">' + esc(s.intro || s.desc) + '</p>' + (s.points.length ? '<ul class="ticks">' + s.points.map(p => '<li>' + I.check + esc(p) + '</li>').join('') + '</ul>' : '') + '</div>' +
    '<div><h2>Estimated cost</h2>' + (estTable(s.est) || '<p class="lede">Call us for a quick estimate.</p>') + '</div></div></section>' +
    (rel.length ? '<section class="sec alt"><div class="wrap"><div class="sec-head"><h2>Related furniture</h2><a class="link" href="/furniture/">All furniture</a></div><div class="grid">' + rel.map(p => card(D, p)).join('') + '</div></div></section>' : '') +
    '<section class="sec"><div class="wrap"><h2>Contract basis or labour basis</h2><p class="lede mb14">Hire us for the complete job, or just for the labour.</p>' + modesHTML(D) + '</div></section>' +
    '<section class="sec alt"><div class="wrap"><h2>' + esc(s.title) + ' near you</h2><p class="lede mb10">Our teams work in these areas.</p>' + areasHTML(D) + '</div></section>' +
    (D.GUIDES.some(g => g.service === slug) ? '<section class="sec"><div class="wrap"><h2>Helpful guides</h2><div class="svcs mt12">' + D.GUIDES.filter(g => g.service === slug).slice(0, 3).map(guideCard).join('') + '</div></div></section>' : '') +
    '<section class="sec"><div class="wrap"><h2>Other services</h2><div class="svcs mt12">' + others.slice(0, 3).map(svcTile).join('') + '</div></div></section>' +
    ctaBand(D, 'Get an estimate for ' + s.title.toLowerCase(), 'Share your sizes or photos — we will reply with a price range and a date for a site visit.');
  const ld = [crumbLD(D, [['Services', '/services/'], [s.title, '/services/' + s.slug + '/']]), { '@context': 'https://schema.org', '@type': 'Service', name: s.title, serviceType: s.title, description: s.intro || s.desc, provider: { '@type': 'HomeAndConstructionBusiness', name: S.name, telephone: '+91' + S.phone }, areaServed: D.AREAS.map(a => a.name), image: S.site_url + src(s.image) }];
  return { title: s.title + ' in Mumbai, Thane & Navi Mumbai — Cost & Estimate | ' + S.name, desc: s.title + ' by ' + S.name + ': ' + s.desc + ' ' + (s.est[0] ? s.est[0].item + ' ' + s.est[0].range + '. ' : '') + 'Free site visit — call ' + S.phone + '.', body, ld, image: src(s.image) };
};

function shopBody(D, cat) {
  const list = cat ? D.PRODUCTS.filter(p => p.category === cat) : D.PRODUCTS;
  const count = slug => D.PRODUCTS.filter(p => p.category === slug).length;
  return '<section class="sec tight"><div class="wrap"><nav class="chips" aria-label="Furniture categories"><a href="/furniture/"' + (!cat ? ' aria-current="page"' : '') + '>All <small>' + D.PRODUCTS.length + '</small></a>' +
    D.CATS.filter(c => count(c.slug)).map(c => '<a href="/furniture/' + esc(c.slug) + '/"' + (cat === c.slug ? ' aria-current="page"' : '') + '>' + esc(c.name) + ' <small>' + count(c.slug) + '</small></a>').join('') + '</nav>' +
    '<div class="toolbar"><input id="search" type="search" placeholder="Search sofa, bed, wardrobe…" aria-label="Search furniture"/><div><span id="count" class="hint">' + list.length + (list.length === 1 ? ' design' : ' designs') + '</span><select id="sort" aria-label="Sort"><option value="popular">Popular</option><option value="low">Estimate: low to high</option><option value="high">Estimate: high to low</option></select></div></div>' +
    '<div id="results"><div class="grid">' + list.map(p => card(D, p)).join('') + '</div></div>' +
    '<p class="note mt14">Prices shown are estimates. Every piece is made to order — the final price depends on size, wood or board and finish, and is confirmed after measurement. Photos are design references.</p></div></section>';
}
V.furniture = D => {
  const S = D.S;
  const body = pageHead('Furniture made to your size', 'Sofas, beds, dining sets, wardrobes, TV units and more — made in our workshop in teak, sheesham or engineered wood. Estimated prices below.', crumbs([['Furniture']])) + shopBody(D, '') + ctaBand(D, 'Have a design in mind?', 'Send us a photo of furniture you like and your room size — we will make it for you.');
  return { title: 'Custom Furniture in Mumbai & Thane — Sofas, Beds, Wardrobes | ' + S.name, desc: 'Made-to-measure sofas, beds, dining sets, wardrobes, TV units and study tables in Mumbai, Thane and Navi Mumbai. See estimated prices and get a free quote.', body, ld: [crumbLD(D, [['Furniture', '/furniture/']])] };
};
V.category = (D, cat) => {
  const S = D.S, c = D.CATS.find(x => x.slug === cat); if (!c) return null;
  const body = pageHead(c.name + ' made to measure', 'Estimated prices for ' + c.name.toLowerCase() + ' made in our workshop. Choose your size, wood and finish.', crumbs([['Furniture', '/furniture/'], [c.name]])) + shopBody(D, cat) + ctaBand(D, 'Want ' + c.name.toLowerCase() + ' in your size?', 'Share your room size and a reference photo — we will send an estimate on WhatsApp.');
  return { title: c.name + ' Made to Order in Mumbai & Thane — Estimated Prices | ' + S.name, desc: c.name + ' made to your size in teak, sheesham or engineered wood by ' + S.name + '. Estimated prices, free site visit and delivery in Mumbai, Thane and Navi Mumbai.', body, ld: [crumbLD(D, [['Furniture', '/furniture/'], [c.name, '/furniture/' + cat + '/']])] };
};
V.product = (D, cat, slug) => {
  const S = D.S, p = D.PRODUCTS.find(x => x.category === cat && x.slug === slug); if (!p) return null;
  const imgs = p.images && p.images.length ? p.images : ['assets/logo.svg'];
  const RV = (p.reviews || []).filter(r => r && r.name && r.text && +r.rating >= 1 && +r.rating <= 5);
  const rel = D.PRODUCTS.filter(x => x.category === p.category && x.id !== p.id).concat(D.PRODUCTS.filter(x => x.category !== p.category && x.featured)).slice(0, 4);
  const body = '<section class="sec tight"><div class="wrap">' + crumbs([['Furniture', '/furniture/'], [catName(D, p.category), '/furniture/' + p.category + '/'], [p.name]]) + '<div class="pd">' +
    '<div class="gallery"><div class="main"><img id="mainImg" src="' + esc(src(imgs[0])) + '" alt="' + esc(p.name) + '" width="1200" height="900"/></div>' + (imgs.length > 1 ? '<div class="thumbs" id="thumbs">' + imgs.map((s, i) => '<button type="button" data-src="' + esc(src(s)) + '" aria-pressed="' + (i === 0) + '" aria-label="Photo ' + (i + 1) + '"><img src="' + esc(small(s)) + '" alt="' + esc(p.name) + ' photo ' + (i + 1) + '"/></button>').join('') + '</div>' : '') + '<p class="hint">Photo is a design reference. We make it to your size and finish.</p></div>' +
    '<div class="pd-info"><span class="kicker">' + esc(catName(D, p.category)) + '</span><h1>' + esc(p.name) + '</h1>' + priceHTML(p, true) +
    '<p class="pd-desc">' + esc(p.description) + '</p>' +
    '<dl class="specs">' + [['Material', p.material], ['Size', p.size], ['Finish', p.finish], ['Made to size', p.customizable ? 'Yes — any size, wood or finish' : 'Standard size only']].filter(r => r[1]).map(r => '<div><dt>' + r[0] + '</dt><dd>' + esc(r[1]) + '</dd></div>').join('') + '</dl>' +
    '<div class="buy"><button class="btn btn-primary" type="button" data-add="' + p.id + '">' + I.plus + 'Add to quote list</button><a class="btn btn-wa" href="' + esc(waLink(S, 'Hi, I am interested in: ' + p.name + ' (estimate ' + range(p) + ').\n' + S.site_url + p.url)) + '" target="_blank" rel="noopener">' + I.wa + 'Ask on WhatsApp</a></div>' +
    '<div class="note">' + I.ruler + '<span>The final price depends on the size, wood or board and finish you choose. <a class="link" href="/get-quote/#' + qslug(p.name) + '">Get an exact quote</a></span></div>' +
    (S.delivery_note ? '<p class="hint mt08">' + esc(S.delivery_note) + '</p>' : '') + '</div></div>' +
    reviewsHTML(p, RV) +
    (rel.length ? '<h2 class="mh35">You may also like</h2><div class="grid">' + rel.map(x => card(D, x)).join('') + '</div>' : '') + '</div></section>';
  const ld = [crumbLD(D, [['Furniture', '/furniture/'], [catName(D, p.category), '/furniture/' + p.category + '/'], [p.name, p.url]]),
    { '@context': 'https://schema.org', '@type': 'Product', name: p.name, description: p.description, image: S.site_url + src(imgs[0]), material: p.material, brand: { '@type': 'Brand', name: S.name }, offers: { '@type': 'AggregateOffer', priceCurrency: 'INR', lowPrice: p.lo, highPrice: p.hi, offerCount: 1, availability: 'https://schema.org/MadeToOrder', url: S.site_url + p.url } }];
  /* star ratings for Google only from real customer reviews added in the admin */
  if (RV.length) Object.assign(ld[1], { aggregateRating: { '@type': 'AggregateRating', ratingValue: +(RV.reduce((a, r) => a + +r.rating, 0) / RV.length).toFixed(1), reviewCount: RV.length, bestRating: 5, worstRating: 1 },
    review: RV.slice(0, 10).map(r => Object.assign({ '@type': 'Review', author: { '@type': 'Person', name: r.name }, reviewRating: { '@type': 'Rating', ratingValue: +r.rating, bestRating: 5, worstRating: 1 }, reviewBody: r.text }, r.date ? { datePublished: r.date } : {})) });
  return { title: p.name + ' — Est. ' + range(p).replace(/ – /, '–') + ' | ' + S.name, desc: p.name + ' made to order in Mumbai & Thane. ' + (p.material ? p.material + '. ' : '') + 'Estimated price ' + range(p) + '. Custom size, wood and finish. Free site visit.', body, ld, image: src(imgs[0]) };
};

function reviewsHTML(p, RV) {
  const avg = RV.length ? RV.reduce((a, r) => a + +r.rating, 0) / RV.length : 0, star = n => '<span class="stars" aria-hidden="true">' + '★'.repeat(n) + '<span class="off">' + '★'.repeat(5 - n) + '</span></span>';
  return '<section class="previews" id="reviews"><div class="prv-head"><h2>Customer reviews</h2>' + (RV.length ? '<p class="prv-avg">' + star(Math.round(avg)) + '<b>' + avg.toFixed(1) + '</b> out of 5 · ' + RV.length + ' review' + (RV.length === 1 ? '' : 's') + '</p>' : '<p class="lede">No reviews yet for this piece. Bought it from us? Your review helps other families decide.</p>') + '</div>' +
    (RV.length ? '<div class="prv-list">' + RV.map(r => '<figure class="prv"><div aria-label="' + r.rating + ' out of 5">' + star(+r.rating) + '</div><blockquote>' + esc(r.text) + '</blockquote><figcaption><b>' + esc(r.name) + '</b>' + (r.place ? ' · ' + esc(r.place) : '') + (r.date ? ' · <time datetime="' + esc(r.date) + '">' + fdate(r.date) + '</time>' : '') + '</figcaption></figure>').join('') + '</div>' : '') +
    '<details class="prv-form"><summary>Bought this? Share your review</summary><form id="rvf" novalidate data-product="' + esc(p.name) + '"><div class="row2"><div class="field"><label for="rvName">Your name</label><input id="rvName" name="name" autocomplete="name" required/></div><div class="field"><label for="rvPlace">Area (optional)</label><input id="rvPlace" name="place" placeholder="e.g. Airoli"/></div></div>' +
    '<div class="row2"><div class="field"><label for="rvRate">Rating</label><select id="rvRate" name="rating"><option value="5">★★★★★ Excellent</option><option value="4">★★★★ Good</option><option value="3">★★★ Okay</option><option value="2">★★ Poor</option><option value="1">★ Bad</option></select></div><div class="field"><label for="rvPhone">Phone (not shown)</label><input id="rvPhone" name="phone" type="tel" autocomplete="tel"/></div></div>' +
    '<div class="field"><label for="rvText">Your review</label><textarea id="rvText" name="text" required></textarea></div><input class="hp" name="_honey" tabindex="-1" autocomplete="off" aria-hidden="true"/><p class="hint">We check every review with our order records before it appears here.</p><button class="btn btn-primary">Send review</button></form></details></section>';
}

V.work = D => {
  const S = D.S;
  const body = pageHead('Our work', 'Homes, offices, shops, showrooms and mall stores we have worked on across Mumbai, Thane and Mira Bhayandar.', crumbs([['Our work']])) +
    '<section class="sec tight"><div class="wrap">' + (D.WORK.length ? workHTML(D.WORK) : '<div class="empty">Project photos are coming soon.</div>') + '</div></section>' +
    '<section class="sec alt"><div class="wrap"><h2>Areas we serve</h2><p class="lede mb10">Tap your area to see what we do there.</p>' + areasHTML(D) + '</div></section>' + ctaBand(D, 'Want the same for your home or business?', 'Book a free site visit — we will measure and give you an estimate.');
  return { title: 'Our Work — Interior Projects in Bhandup, Thane, Mira Bhayandar | ' + S.name, desc: 'Interior and carpentry projects by ' + S.name + ' in Dreams building Bhandup, Usha Nagar, Hiranandani Thane, Mira Bhayandar and more — homes, offices, shops, showrooms and malls.', body, ld: [crumbLD(D, [['Our work', '/our-work/']])] };
};

V.about = D => {
  const S = D.S;
  const body = pageHead('About ' + S.name, S.about, crumbs([['About us']])) +
    '<section class="sec tight"><div class="wrap split"><figure class="photo"><img src="/images/site/furniture-to-measure-sm.webp" alt="Carpenter cutting and drilling wood on a workbench" loading="lazy" width="600" height="450"/></figure>' +
    '<div><h2>A family of carpenters</h2><p class="lede">' + esc(S.name) + ' is run by the Vishwakarma family and grew out of hands-on carpentry — ' + esc((S.letterhead && S.letterhead.intro || 'teakwood furniture, sofas and wardrobes').toLowerCase()) + '. Today we take on complete interior contracts as well as labour-basis work, and we still make furniture in our own workshop.</p>' +
    '<ul class="ticks">' + ['Our own carpenters on every job', 'Clear contract or labour-basis pricing', 'Free site visit and measurement', 'Teams in Mumbai, Thane, Navi Mumbai and Uttar Pradesh'].map(t => '<li>' + I.check + t + '</li>').join('') + '</ul></div></div></section>' +
    ((S.team || []).length ? '<section class="sec alt"><div class="wrap"><h2>Our people</h2><p class="lede mb14">The family that runs ' + esc(S.name) + '.</p>' + teamHTML(D) + '</div></section>' : '') +
    '<section class="sec"><div class="wrap"><h2>How we work</h2><p class="lede mb16">From your first message to the finished space.</p>' + stepsHTML() + '</div></section>' +
    '<section class="sec alt"><div class="wrap"><h2>Where we are</h2><p class="lede mb10">Offices and teams in these areas.</p>' + areasHTML(D) + '</div></section>' + ctaBand(D, 'Talk to us about your project', 'Call or WhatsApp to book a free site visit.');
  return { title: 'About Us — ' + S.name + ' | Founder ' + ((S.team || [])[0] || {}).name, desc: 'About ' + S.name + ': a family of carpenters doing interiors and furniture in Mumbai, Thane, Navi Mumbai and Uttar Pradesh. ' + (S.team || []).map(t => t.role + ' ' + t.name).join(', ') + '.', body, ld: [crumbLD(D, [['About us', '/about/']])] };
};

function contactList(D) {
  const S = D.S, locs = (S.locations || []).filter(Boolean);
  return '<div class="info">' + [S.phone && [I.phone, tel(S), 'Call', '+91 ' + S.phone], waNum(S) && [I.wa, waLink(S, 'Hi, I have a question about interior / furniture work.'), 'WhatsApp', 'Chat with us'], S.email && [I.mail, 'mailto:' + S.email, 'Email', S.email], S.hours && [I.clock, '', 'Open', S.hours]]
    .concat(locs.map((l, i) => [I.pin, 'https://maps.google.com/?q=' + encodeURIComponent(l), i ? 'Also in' : 'Main office', i === 0 && S.letterhead && S.letterhead.address ? S.letterhead.address : l])).filter(Boolean)
    .map(b => (b[1] ? '<a href="' + esc(b[1]) + '"' + (/^http/.test(b[1]) ? ' target="_blank" rel="noopener"' : '') + '>' : '<div>') + b[0] + '<span><small>' + b[2] + '</small>' + esc(b[3]) + '</span>' + (b[1] ? '</a>' : '</div>')).join('') + '</div>';
}
V.contact = D => {
  const S = D.S;
  const body = pageHead('Contact us', 'Call, WhatsApp or send a message. We usually reply within an hour during working hours.', crumbs([['Contact']])) +
    '<section class="sec tight"><div class="wrap split">' + contactList(D) +
    '<form class="panel" id="qf" novalidate><h2>Send a message</h2><div class="field"><label for="qName">Your name</label><input id="qName" name="name" autocomplete="name" required/></div><div class="field"><label for="qPhone">Phone</label><input id="qPhone" name="phone" type="tel" autocomplete="tel"/></div><div class="field"><label for="qEmail">Email (optional)</label><input id="qEmail" name="email" type="email" autocomplete="email" inputmode="email"/></div><div class="field"><label for="qMsg">Message</label><textarea id="qMsg" name="message" required></textarea></div><input class="hp" name="_honey" tabindex="-1" autocomplete="off" aria-hidden="true"/><button class="btn btn-wa w100">' + I.wa + 'Send on WhatsApp</button></form></div></section>' +
    '<section class="sec tight"><div class="wrap narrow0">' + officerBox(D) + '<p class="hint mt06">Complaints are acknowledged within 48 hours and resolved within 30 days. See <a class="link" href="/grievance/">Grievance & Feedback</a>.</p></div></section>';
  return { title: 'Contact ' + S.name + ' — Call ' + S.phone + ' | Airoli, Bhandup, Thane', desc: 'Contact ' + S.name + ' for interior and furniture work. Call or WhatsApp ' + S.phone + '. Offices in Airoli (Navi Mumbai), Bhandup (Mumbai), Kunda and Prayagraj.', body, ld: [crumbLD(D, [['Contact', '/contact/']])] };
};

V.quote = D => {
  const S = D.S;
  const body = pageHead('Get a free estimate', 'Tell us about your interior or furniture work. We will reply on WhatsApp with a price range and a date for a site visit.', crumbs([['Get a quote']])) +
    '<section class="sec tight"><div class="wrap split"><div><h2>How it works</h2><ol class="steps one">' + [['Send the request', 'Fill in this form — it opens WhatsApp with your details.'], ['Share photos', 'Send pictures of the site or designs you like in the same chat.'], ['Site visit & quote', 'We measure, suggest materials and confirm the price.']].map(s => '<li class="step"><h3>' + s[0] + '</h3><p>' + s[1] + '</p></li>').join('') + '</ol></div>' +
    '<form class="panel" id="cf" novalidate><div class="field"><label for="xType">What do you need?</label><input id="xType" name="type" list="types" required placeholder="e.g. 2BHK interior, modular kitchen, wardrobe"/><datalist id="types">' + S.services.map(s => '<option value="' + esc(s.title) + '">').join('') + D.CATS.map(c => '<option value="' + esc(c.name) + '">').join('') + '<option value="False ceiling"><option value="Wall panelling"><option value="Sliding aluminium window"><option value="Temple / mandir"></datalist></div>' +
    '<div class="field"><label for="xMode">How do you want to hire us?</label><select id="xMode" name="mode"><option value="">Not sure yet</option>' + (S.work_modes || []).map(m => '<option>' + esc(m.title) + '</option>').join('') + '</select></div>' +
    '<div class="row2"><div class="field"><label for="xSize">Size (approx.)</label><input id="xSize" name="size" placeholder="e.g. 2BHK, 600 sq ft, 7 × 6 ft"/></div><div class="field"><label for="xWood">Wood / material</label><select id="xWood" name="wood"><option value="">Not sure — suggest</option><option>Teak</option><option>Sheesham</option><option>Plywood with laminate</option><option>Engineered wood</option></select></div></div>' +
    '<div class="row2"><div class="field"><label for="xBudget">Budget</label><select id="xBudget" name="budget"><option value="">Prefer not to say</option><option>Under ₹50,000</option><option>₹50,000 – ₹2 lakh</option><option>₹2 – 5 lakh</option><option>₹5 – 10 lakh</option><option>Above ₹10 lakh</option></select></div><div class="field"><label for="xArea">Site location</label><input id="xArea" name="area" list="areas" placeholder="e.g. Bhandup, Thane, Airoli"/><datalist id="areas">' + D.AREAS.map(a => '<option value="' + esc(a.name) + '">').join('') + '</datalist></div></div>' +
    '<div class="field"><label for="xDet">Details</label><textarea id="xDet" name="details" placeholder="Colour, number of drawers, mirror, finish…"></textarea></div>' +
    '<div class="row2"><div class="field"><label for="xName">Your name</label><input id="xName" name="name" autocomplete="name" required/></div><div class="field"><label for="xPhone">Phone</label><input id="xPhone" name="phone" type="tel" autocomplete="tel" required/></div></div><div class="field"><label for="xEmail">Email (optional)</label><input id="xEmail" name="email" type="email" autocomplete="email" inputmode="email"/></div><input class="hp" name="_honey" tabindex="-1" autocomplete="off" aria-hidden="true"/>' +
    '<button class="btn btn-wa w100">' + I.wa + 'Send request on WhatsApp</button></form></div></section>';
  return { title: 'Get a Free Interior Estimate in Mumbai & Thane | ' + S.name, desc: 'Ask ' + S.name + ' for a free estimate for home interiors, modular kitchens, wardrobes, office or shop work and custom furniture. Contract or labour basis.', body, ld: [crumbLD(D, [['Get a quote', '/get-quote/']])] };
};

V.list = D => ({ title: 'Your quote list | ' + D.S.name, desc: 'Furniture you have picked for a quote.', noindex: true,
  body: pageHead('Your quote list', 'Pieces you have picked. Send the list on WhatsApp and we will confirm sizes and the exact price.', crumbs([['Quote list']])) + '<section class="sec tight"><div class="wrap" id="listApp"><div class="empty">Loading your list…</div></div></section>' });

V.thanks = D => ({ title: 'Thank you | ' + D.S.name, desc: 'Thank you for contacting us.', noindex: true,
  body: '<section class="sec"><div class="wrap narrow center"><h1>Thank you!</h1><p class="lede">WhatsApp should have opened with your details. Tap <b>Send</b> there, and we will reply with an estimate and a time for a site visit. If WhatsApp didn\'t open, call us on <a class="link" href="' + tel(D.S) + '">' + esc(D.S.phone) + '</a>.</p><div class="ctas center"><a class="btn btn-primary" href="/furniture/">Browse furniture</a><a class="btn btn-ghost" href="/">Back to home</a></div></div></section>' });

V.area = (D, slug) => {
  const S = D.S, a = D.AREAS.find(x => x.slug === slug); if (!a) return null;
  const here = D.WORK.filter(w => slugify(w.area) === slug || (w.area || '').indexOf(a.short) >= 0);
  const office = (S.locations || []).some(l => slugify(l) === slug);
  const body = photoHead('images/site/living.webp', 'Interior work & carpenters in ' + a.name, (office ? 'We have a team based in ' + a.short + '. ' : 'Our teams regularly work in ' + a.short + '. ') + 'Home interiors, modular kitchens, wardrobes, office and shop work, and furniture made to measure — on contract or labour basis.', crumbs([['Areas', '/our-work/'], [a.short]]), '<div class="ctas"><a class="btn btn-tape" href="/get-quote/#' + qslug(a.name) + '">Book a free site visit</a><a class="btn btn-light" href="' + tel(S) + '">' + I.phone + 'Call ' + esc(S.phone) + '</a></div>') +
    '<section class="sec"><div class="wrap"><div class="sec-head"><div><h2>Services in ' + esc(a.short) + '</h2><p class="lede">With an indicative cost for each.</p></div></div><div class="svcs">' + S.services.map(svcTile).join('') + '</div></div></section>' +
    (here.length ? '<section class="sec alt"><div class="wrap"><h2>Our work in ' + esc(a.short) + '</h2>' + workHTML(here) + '</div></section>' : '') +
    '<section class="sec"><div class="wrap"><h2>Contract basis or labour basis</h2><p class="lede mb14">Choose how you want to hire us.</p>' + modesHTML(D) + '</div></section>' +
    '<section class="sec alt"><div class="wrap"><h2>Other areas we serve</h2>' + areasHTML(D, slug) + '</div></section>' + ctaBand(D, 'Need a carpenter or interior team in ' + a.short + '?', 'Call or WhatsApp ' + S.phone + ' for a free site visit.');
  return { title: 'Interior Contractor & Carpenter in ' + a.name + ' | ' + S.name, desc: 'Home interiors, modular kitchens, wardrobes, office and shop work and custom furniture in ' + a.name + '. Contract or labour basis. Free site visit — call ' + S.phone + '.', body, ld: [crumbLD(D, [[a.short, '/areas/' + slug + '/']])], image: '/images/site/living.webp' };
};

V.notfound = D => ({ title: 'Page not found | ' + D.S.name, desc: 'This page does not exist.', noindex: true,
  body: '<section class="sec nf"><div class="wrap narrow center">' +
    '<div class="nf-mark" aria-hidden="true"><b>404</b><div class="nf-tape">' + Array.from({ length: 24 }, (_, i) => '<i' + (i % 4 ? '' : ' class="l"') + '></i>').join('') + '</div></div>' +
    '<h1>Page not found</h1><p class="lede">We measured twice, but this page isn\'t here. It may have moved, or the link has a typo.</p>' +
    '<p class="nf-path" id="nfPath" hidden></p><p class="nf-sug" id="nfSug" hidden></p>' +
    '<form class="nf-search" id="nfForm" action="/furniture/" method="get" role="search"><label class="sr" for="nfq">Search furniture</label><input id="nfq" name="q" type="search" placeholder="Search furniture, e.g. wardrobe" autocomplete="off"/><button class="btn btn-primary">Search</button></form>' +
    '<div class="ctas center"><a class="btn btn-ghost" href="/">Home</a><a class="btn btn-ghost" href="/services/">Services</a><a class="btn btn-ghost" href="/furniture/">Furniture</a><a class="btn btn-ghost" href="/get-quote/">Get a quote</a></div>' +
    '<p class="nf-help">Need help? Call <a class="link" href="' + tel(D.S) + '">' + esc(D.S.phone) + '</a> or <a class="link" href="' + waLink(D.S, 'Hi, I was looking for a page on your website.') + '" target="_blank" rel="noopener">WhatsApp us</a>.</p>' +
    '</div></section>' });



/* ── guides (free articles for search) ── */
function block(b) {
  const [t, v] = b;
  if (t === 'h2') return '<h2>' + esc(v) + '</h2>';
  if (t === 'p') return '<p>' + esc(v) + '</p>';
  if (t === 'ul') return '<ul>' + v.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul>';
  if (t === 'table') return '<div class="esttable"><table><thead><tr>' + v[0].map(h => '<th scope="col">' + esc(h) + '</th>').join('') + '</tr></thead><tbody>' + v.slice(1).map(r => '<tr>' + r.map(c => '<td>' + esc(c) + '</td>').join('') + '</tr>').join('') + '</tbody></table></div>';
  return '';
}
function guideCard(g) {
  return '<a class="svc" href="/guides/' + g.slug + '/"><span class="svc-ph"><img src="' + esc(small(g.image)) + '"' + RS(small(g.image)) + ' alt="' + esc(g.title) + '" loading="lazy" width="600" height="450"/></span><span class="svc-body"><h3>' + esc(g.title) + '</h3><p>' + esc(g.desc) + '</p><span class="svc-go">Read guide ' + I.arrow + '</span></span></a>';
}
V.guides = D => {
  const body = pageHead('Guides and price advice', 'Plain-language guides on interior and furniture costs in Mumbai, Thane and Navi Mumbai — written by our team.', crumbs([['Guides']])) +
    '<section class="sec tight"><div class="wrap"><div class="svcs">' + D.GUIDES.map(guideCard).join('') + '</div></div></section>' + ctaBand(D, 'Have a question we haven\'t covered?', 'Ask us on WhatsApp — we reply with honest advice and an estimate.');
  return { title: 'Interior & Furniture Cost Guides for Mumbai | ' + D.S.name, desc: 'Free guides on modular kitchen cost, wardrobe price per sq ft, 2BHK interior budget, false ceiling cost and choosing materials in Mumbai and Thane.', body, ld: [crumbLD(D, [['Guides', '/guides/']])] };
};
V.guide = (D, slug) => {
  const S = D.S, g = D.GUIDES.find(x => x.slug === slug); if (!g) return null;
  const svc = S.services.find(x => x.slug === g.service), more = D.GUIDES.filter(x => x.slug !== slug).slice(0, 3);
  const body = photoHead(g.image, g.title, g.desc, crumbs([['Guides', '/guides/'], [g.title]])) +
    '<section class="sec tight"><div class="wrap legal-wrap"><article class="legal guide">' + (CUR.lang !== 'en' ? '<p class="note">This guide is in English.</p>' : '') + (g.body || []).map(block).join('') +
    '<div class="ctas mt14"><a class="btn btn-tape" href="/get-quote/">Get a free estimate</a><a class="btn btn-wa" href="' + esc(waLink(S, 'Hi, I read your guide "' + g.title + '" and want an estimate.')) + '" target="_blank" rel="noopener">' + I.wa + 'WhatsApp us</a></div></article>' +
    '<nav class="legal-nav" aria-label="More guides"><h2>More guides</h2>' + D.GUIDES.map(x => '<a href="/guides/' + x.slug + '/"' + (x.slug === slug ? ' aria-current="page"' : '') + '>' + esc(x.title) + '</a>').join('') + (svc ? '<a href="/services/' + svc.slug + '/">' + esc(svc.title) + ' service</a>' : '') + '</nav></div></section>' +
    '<section class="sec alt"><div class="wrap"><h2>Read next</h2><div class="svcs mt12">' + more.map(guideCard).join('') + '</div></div></section>';
  const ld = [crumbLD(D, [['Guides', '/guides/'], [g.title, '/guides/' + slug + '/']]), { '@context': 'https://schema.org', '@type': 'Article', headline: g.title, description: g.desc, image: S.site_url + src(g.image), datePublished: g.date, dateModified: g.date, author: { '@type': 'Organization', name: S.name, url: S.site_url + '/' }, publisher: { '@type': 'Organization', name: S.name, logo: { '@type': 'ImageObject', url: S.site_url + '/assets/logo.png' } }, mainEntityOfPage: S.site_url + '/guides/' + slug + '/' }];
  return { title: g.title + ' | ' + S.name, desc: g.desc, body, ld, image: src(g.image) };
};

/* ── blog: articles written in the admin panel (data/blog.json) ── */
/* safe inline formatting inside article text: **bold** and [link text](/page/ or https://…) */
function inl(t) {
  return esc(t).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\(((?:\/|https:\/\/)[^\s)]*)\)/g, (m, a, u) => '<a class="link" href="' + u + '"' + (u[0] === '/' ? '' : ' target="_blank" rel="noopener"') + '>' + a + '</a>');
}
/* article text format used by the admin editor: "## heading", "### small heading", "- bullet", "1. step", "> tip", "| table | row |", blank line = new paragraph */
function parseBody(text) {
  const out = [], lines = String(text || '').replace(/\r/g, '').split('\n'); let i = 0;
  const take = re => { const a = []; while (i < lines.length && re.test(lines[i])) a.push(lines[i++]); return a; };
  while (i < lines.length) {
    const l = lines[i];
    if (!l.trim()) { i++; continue; }
    if (/^###\s+/.test(l)) { out.push(['h3', l.replace(/^###\s+/, '').trim()]); i++; continue; }
    if (/^##\s+/.test(l)) { out.push(['h2', l.replace(/^##\s+/, '').trim()]); i++; continue; }
    if (/^\s*[-*]\s+/.test(l)) { out.push(['ul', take(/^\s*[-*]\s+/).map(x => x.replace(/^\s*[-*]\s+/, '').trim())]); continue; }
    if (/^\s*\d+[.)]\s+/.test(l)) { out.push(['ol', take(/^\s*\d+[.)]\s+/).map(x => x.replace(/^\s*\d+[.)]\s+/, '').trim())]); continue; }
    if (/^>\s?/.test(l)) { out.push(['tip', take(/^>\s?/).map(x => x.replace(/^>\s?/, '')).join(' ').trim()]); continue; }
    if (/^\s*\|/.test(l)) { const rows = take(/^\s*\|/).filter(x => !/^\s*\|[\s:|-]+\|\s*$/.test(x)).map(x => x.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim())); if (rows.length) out.push(['table', rows]); continue; }
    const para = []; while (i < lines.length && lines[i].trim() && !/^(#{2,3}\s|\s*[-*]\s|\s*\d+[.)]\s|>|\s*\|)/.test(lines[i])) para.push(lines[i++].trim());
    out.push(['p', para.join(' ')]);
  }
  return out;
}
function bodyText(blocks) {
  return (blocks || []).map(([t, v]) => t === 'h2' ? '## ' + v : t === 'h3' ? '### ' + v : t === 'ul' ? v.map(x => '- ' + x).join('\n') : t === 'ol' ? v.map((x, i) => (i + 1) + '. ' + x).join('\n') : t === 'tip' ? '> ' + v : t === 'table' ? v.map(r => '| ' + r.join(' | ') + ' |').join('\n') : v).join('\n\n');
}
const hid = t => slugify(t).slice(0, 60) || 'section';
function blogBlock(b) {
  const [t, v] = b;
  if (t === 'h2') return '<h2 id="' + hid(v) + '">' + inl(v) + '</h2>';
  if (t === 'h3') return '<h3>' + inl(v) + '</h3>';
  if (t === 'p') return '<p>' + inl(v) + '</p>';
  if (t === 'ul') return '<ul>' + v.map(x => '<li>' + inl(x) + '</li>').join('') + '</ul>';
  if (t === 'ol') return '<ol>' + v.map(x => '<li>' + inl(x) + '</li>').join('') + '</ol>';
  if (t === 'tip') return '<aside class="tipbox">' + I.check + '<p>' + inl(v) + '</p></aside>';
  if (t === 'table') return '<div class="esttable"><table><thead><tr>' + v[0].map(h => '<th scope="col">' + inl(h) + '</th>').join('') + '</tr></thead><tbody>' + v.slice(1).map(r => '<tr>' + r.map(c => '<td>' + inl(c) + '</td>').join('') + '</tr>').join('') + '</tbody></table></div>';
  return '';
}
const words = b => (b.body || []).map(x => [].concat(x[1]).flat().join(' ')).join(' ').split(/\s+/).filter(Boolean).length;
const readMin = b => Math.max(2, Math.round(words(b) / 200));
const fdate = d => { const x = new Date(String(d || '') + 'T00:00:00'); return isNaN(x) ? '' : x.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); };
function blogCard(b) {
  return '<a class="svc bcard" href="/blog/' + b.slug + '/"><span class="svc-ph"><img src="' + esc(small(b.image)) + '"' + RS(small(b.image)) + ' alt="' + esc(b.title) + '" loading="lazy" width="600" height="450"/></span><span class="svc-body"><span class="bmeta">' + esc(b.cat) + ' · ' + readMin(b) + ' min read</span><h3>' + esc(b.title) + '</h3><p>' + esc(b.desc) + '</p><span class="svc-go">Read article ' + I.arrow + '</span></span></a>';
}
const blogCats = D => { const m = {}; D.BLOG.forEach(b => { m[b.catSlug] = m[b.catSlug] || { name: b.cat, slug: b.catSlug, n: 0 }; m[b.catSlug].n++; }); return Object.values(m).sort((a, b) => b.n - a.n || a.name.localeCompare(b.name)); };
const BLOG_PER = 12;
function blogList(D, list, page, base, title, lede, crumbList, cur) {
  const pages = Math.max(1, Math.ceil(list.length / BLOG_PER)), p = Math.min(Math.max(1, +page || 1), pages), rows = list.slice((p - 1) * BLOG_PER, p * BLOG_PER);
  const link = n => n === 1 ? base : base + 'page/' + n + '/';
  const chips = '<nav class="bchips" aria-label="Blog categories"><a href="/blog/"' + (!cur ? ' aria-current="page"' : '') + '>All <span>' + D.BLOG.length + '</span></a>' + blogCats(D).map(c => '<a href="/blog/category/' + c.slug + '/"' + (cur === c.slug ? ' aria-current="page"' : '') + '>' + esc(c.name) + ' <span>' + c.n + '</span></a>').join('') + '<a href="/guides/">Price guides</a></nav>';
  const pager = pages > 1 ? '<nav class="bpager" aria-label="Pages">' + (p > 1 ? '<a href="' + link(p - 1) + '" rel="prev">← Newer</a>' : '<span></span>') + '<span>Page ' + p + ' of ' + pages + '</span>' + (p < pages ? '<a href="' + link(p + 1) + '" rel="next">Older →</a>' : '<span></span>') + '</nav>' : '';
  return pageHead(title, lede, crumbs(crumbList)) + '<section class="sec tight"><div class="wrap">' + chips + (rows.length ? '<div class="svcs mt14">' + rows.map(blogCard).join('') + '</div>' : '<div class="empty">No articles here yet.</div>') + pager + '</div></section>' +
    ctaBand(D, 'Planning an interior or furniture project?', 'Ask us on WhatsApp — we reply with honest advice and an estimate.');
}
V.blog = (D, page) => {
  const p = +page || 1, body = blogList(D, D.BLOG, p, '/blog/', 'Blog: interior and furniture ideas', 'Practical ideas, costs and care tips for homes, offices and shops in Mumbai, Thane and Navi Mumbai — from the people who build them.', [['Blog']], '');
  return { title: (p > 1 ? 'Interior & Furniture Blog, Page ' + p : 'Interior & Furniture Blog — Ideas and Tips for Mumbai Homes') + ' | ' + D.S.name, desc: 'Interior design ideas, furniture buying tips, material guides and maintenance advice for Mumbai, Thane and Navi Mumbai homes, offices and shops.' + (p > 1 ? ' Page ' + p + '.' : ''), body, ld: [crumbLD(D, [['Blog', '/blog/']])] };
};
V.blogcat = (D, slug, page) => {
  const c = blogCats(D).find(x => x.slug === slug); if (!c) return null;
  const list = D.BLOG.filter(b => b.catSlug === slug), p = +page || 1;
  const body = blogList(D, list, p, '/blog/category/' + slug + '/', c.name, c.n + ' article' + (c.n === 1 ? '' : 's') + ' on ' + c.name.toLowerCase() + ' for homes, offices and shops in Mumbai, Thane and Navi Mumbai.', [['Blog', '/blog/'], [c.name]], slug);
  return { title: c.name + (p > 1 ? ', Page ' + p : '') + ' — Interior & Furniture Blog | ' + D.S.name, desc: 'Articles about ' + c.name.toLowerCase() + ': practical interior and furniture advice for Mumbai, Thane and Navi Mumbai from ' + D.S.name + '.', body, ld: [crumbLD(D, [['Blog', '/blog/'], [c.name, '/blog/category/' + slug + '/']])] };
};
V.post = (D, slug) => {
  const S = D.S, b = D.BLOG.find(x => x.slug === slug); if (!b) return null;
  const h2s = (b.body || []).filter(x => x[0] === 'h2').map(x => x[1]), url = S.site_url + '/blog/' + slug + '/';
  const rel = D.BLOG.filter(x => x.slug !== slug && x.catSlug === b.catSlug).concat(D.BLOG.filter(x => x.slug !== slug && x.catSlug !== b.catSlug)).slice(0, 3);
  const meta = '<p class="pmeta"><a href="/blog/category/' + b.catSlug + '/">' + esc(b.cat) + '</a><span>' + I.clock + readMin(b) + ' min read</span>' + (b.date ? '<time datetime="' + esc(b.date) + '">' + fdate(b.date) + '</time>' : '') + '<span>By ' + esc(b.author || S.name) + '</span></p>';
  const share = '<div class="share"><b>Share</b><a class="btn btn-wa btn-sm" href="https://wa.me/?text=' + encodeURIComponent(b.title + ' ' + url) + '" target="_blank" rel="noopener">' + I.wa + 'WhatsApp</a><a class="btn btn-ghost btn-sm" href="https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(url) + '" target="_blank" rel="noopener">Facebook</a><a class="btn btn-ghost btn-sm" href="https://www.linkedin.com/sharing/share-offsite/?url=' + encodeURIComponent(url) + '" target="_blank" rel="noopener">LinkedIn</a></div>';
  const body = photoHead(b.image, b.title, b.desc, crumbs([['Blog', '/blog/'], [b.cat, '/blog/category/' + b.catSlug + '/'], [b.title]]), meta) +
    '<section class="sec tight"><div class="wrap legal-wrap"><article class="legal guide post">' + (CUR.lang !== 'en' ? '<p class="note">This article is in English.</p>' : '') +
    (h2s.length >= 3 ? '<nav class="toc" aria-label="In this article"><b>In this article</b><ol>' + h2s.map(h => '<li><a href="#' + hid(h) + '">' + esc(h) + '</a></li>').join('') + '</ol></nav>' : '') +
    (b.body || []).map(blogBlock).join('') +
    ((b.tags || []).length ? '<p class="tags">' + b.tags.map(t => '<span>#' + esc(t) + '</span>').join('') + '</p>' : '') + share +
    '<div class="ctas mt14"><a class="btn btn-tape" href="/get-quote/">Get a free estimate</a><a class="btn btn-wa" href="' + esc(waLink(S, 'Hi, I read your article "' + b.title + '" and have a question.')) + '" target="_blank" rel="noopener">' + I.wa + 'Ask us on WhatsApp</a></div></article>' +
    '<nav class="legal-nav" aria-label="Blog"><h2>Categories</h2>' + blogCats(D).map(c => '<a href="/blog/category/' + c.slug + '/"' + (c.slug === b.catSlug ? ' aria-current="page"' : '') + '>' + esc(c.name) + ' (' + c.n + ')</a>').join('') + '<h2 class="mt14">Latest articles</h2>' + D.BLOG.filter(x => x.slug !== slug).slice(0, 5).map(x => '<a href="/blog/' + x.slug + '/">' + esc(x.title) + '</a>').join('') + '</nav></div></section>' +
    (rel.length ? '<section class="sec alt"><div class="wrap"><h2>Read next</h2><div class="svcs mt12">' + rel.map(blogCard).join('') + '</div></div></section>' : '');
  const ld = [crumbLD(D, [['Blog', '/blog/'], [b.cat, '/blog/category/' + b.catSlug + '/'], [b.title, '/blog/' + slug + '/']]), { '@context': 'https://schema.org', '@type': 'BlogPosting', headline: b.title, description: b.desc, image: S.site_url + src(b.image), datePublished: b.date, dateModified: b.updated || b.date, wordCount: words(b), articleSection: b.cat, keywords: (b.tags || []).join(', '), author: b.author ? { '@type': 'Person', name: b.author } : { '@type': 'Organization', name: S.name, url: S.site_url + '/' }, publisher: { '@type': 'Organization', name: S.name, logo: { '@type': 'ImageObject', url: S.site_url + '/assets/logo.png' } }, mainEntityOfPage: url }];
  return { title: b.title + ' | ' + S.name, desc: b.desc, body, ld, image: src(b.image) };
};

/* ── legal & citizen pages ── */
const P = s => '<p>' + s + '</p>', UL = a => '<ul>' + a.map(x => '<li>' + x + '</li>').join('') + '</ul>';
function legalInfo(D) {
  const S = D.S, L = S.legal || {}, G = L.grievance || {}, LH = S.letterhead || {};
  return { S, L, G, name: esc(L.legal_name || S.name), addr: esc(LH.address || S.address || ''), email: esc(G.email || S.email), phone: esc(G.phone || S.phone),
    court: esc(L.jurisdiction || 'Thane, Maharashtra'), updated: esc(L.updated || ''), site: esc(S.site_url.replace(/^https?:\/\//, '')) };
}
function officerBox(D) {
  const x = legalInfo(D);
  return '<div class="officer"><h3>Grievance Officer</h3><dl><div><dt>Name</dt><dd>' + esc(x.G.name || '') + '</dd></div><div><dt>Designation</dt><dd>' + esc(x.G.role || '') + '</dd></div><div><dt>Business</dt><dd>' + x.name + (x.L.gstin ? ' · GSTIN ' + esc(x.L.gstin) : '') + '</dd></div><div><dt>Address</dt><dd>' + x.addr + '</dd></div><div><dt>Email</dt><dd><a href="mailto:' + x.email + '">' + x.email + '</a></dd></div><div><dt>Phone / WhatsApp</dt><dd><a href="tel:+91' + x.phone.replace(/\D/g, '').slice(-10) + '">+91 ' + x.phone + '</a></dd></div><div><dt>Hours</dt><dd>' + esc(x.S.hours || 'Monday to Saturday, 10 am to 7 pm') + '</dd></div></dl></div>';
}
const POLICIES = {
  terms: { path: 'terms-of-use', title: 'Terms of Use', desc: 'Terms for using the website', body: (D, x) =>
    '<h2>1. About these terms</h2>' + P('This website, ' + x.site + ', is run by ' + x.name + ', ' + x.addr + '. By using it you agree to these terms. If you do not agree, please do not use the website.') +
    '<h2>2. Information on this website</h2>' + P('The services, furniture designs, photos and prices on this website are for general guidance. Prices are <b>estimates</b> and are not an offer to sell. A job or order is confirmed only by a written quotation or agreement from us, and the terms in that document apply to it.') +
    '<h2>3. Quote requests and messages</h2>' + P('When you send a quote request, quote list or message, it opens WhatsApp or email on your device and you choose whether to send it. Sending a request does not create a contract. Please give correct contact details so we can reply.') +
    '<h2>4. Acceptable use</h2>' + UL(['Do not misuse the website, try to break its security, or send spam or harmful code.', 'Do not copy the website to pass yourself off as ' + x.name + '.', 'Do not use content from this website in a misleading or derogatory way.']) +
    '<h2>5. Intellectual property</h2>' + P('Text, layout, logo and our own photos belong to ' + x.name + '. Some photos are licensed stock images used as design references. See the <a class="link" href="/copyright-policy/">Copyright Policy</a>.') +
    '<h2>6. Liability</h2>' + P('We take care to keep the website correct and available, but we do not guarantee that it is always complete, current or free of errors. We are not liable for any loss arising from use of the website, except where the law does not allow this to be excluded. See the <a class="link" href="/disclaimer/">Disclaimer</a>.') +
    '<h2>7. Privacy</h2>' + P('How we handle your personal data is explained in the <a class="link" href="/privacy-policy/">Privacy Policy</a>.') +
    '<h2>8. Law and jurisdiction</h2>' + P('These terms are governed by the laws of India, including the Information Technology Act, 2000 and the Consumer Protection Act, 2019. Courts at ' + x.court + ' have jurisdiction over any dispute, without limiting your rights as a consumer to approach a consumer commission.') +
    '<h2>9. Changes</h2>' + P('We may update these terms. The date at the top shows the latest version.') },
  privacy: { path: 'privacy-policy', title: 'Privacy Policy', desc: 'How we collect, use and protect personal data', body: (D, x) =>
    P('This policy explains how ' + x.name + ' handles personal data collected through ' + x.site + '. It is written to follow the Information Technology Act, 2000 and its rules, and the Digital Personal Data Protection Act, 2023 and the DPDP Rules, 2025.') +
    '<h2>1. What we collect</h2>' + UL(['<b>Details you type into our forms</b> — your name, phone number, site area or address, and details of the work you want (size, material, budget, notes).', '<b>Your quote list</b> — the furniture you add is stored only in your own browser on your device. We do not receive it unless you send it to us.', '<b>Messages you send us</b> on WhatsApp, by email or by phone.', '<b>Technical logs</b> — our hosting provider (GitHub Pages) may record your IP address, browser type and time of visit for security and operation. We do not use advertising or tracking cookies, and we do not run analytics that identify you.'].concat(D.S.ga_id ? ['<b>Visit statistics</b> — we use Google Analytics to count visits and see which pages are useful (pages viewed, device type, approximate city). It uses cookies, does not tell us who you are, and IP addresses are anonymised by Google. You can block it with your browser\'s privacy settings.'] : [])) +
    P('We do not collect passwords, bank or card details, Aadhaar, or any other sensitive personal data through this website. We do not take online payments on this website.') +
    '<h2>2. Why we use it</h2>' + UL(['To reply to your enquiry and give you an estimate.', 'To arrange a site visit and prepare a quotation, agreement, bill or invoice.', 'To carry out and support the work you hire us for.', 'To keep records that tax and other laws require.']) +
    P('By sending us a form or message you give consent for these uses. You can withdraw consent at any time by contacting the Grievance Officer below; this does not affect work already done or records the law requires us to keep.') +
    '<h2>3. Sharing</h2>' + P('We never sell or rent your personal data, and we do not share it with other businesses for their marketing. Your data passes through these services only so that we can receive and answer you:') +
    UL(['WhatsApp (Meta) — when you choose to send us a WhatsApp message.', 'FormSubmit — forwards a copy of website forms to our email inbox.', 'Google (Gmail) — our email service.']) +
    P('We may disclose data if required by law, court order or a government authority.') +
    '<h2>4. How long we keep it</h2>' + P('Enquiries that do not lead to work are deleted within 12 months. Records of jobs, quotations and invoices are kept for as long as tax and accounting laws require, and then deleted.') +
    '<h2>5. Security</h2>' + P('The website is served over HTTPS. Business documents in our admin panel are encrypted on our devices, and access is limited to the people who run the business.') +
    '<h2>6. Your rights</h2>' + UL(['Ask what personal data we hold about you and how it is used.', 'Ask us to correct, update or delete it.', 'Withdraw your consent.', 'Nominate another person to act for you in case of death or incapacity.', 'Raise a grievance with us, and if it is not resolved, complain to the Data Protection Board of India.']) +
    P('Write to the Grievance Officer below. We acknowledge requests within 48 hours and aim to resolve them within 30 days.') +
    '<h2>7. Children</h2>' + P('This website is meant for adults arranging interior work. We do not knowingly collect data from anyone under 18.') +
    '<h2>8. Contact</h2>' + officerBox(D) },
  disclaimer: { path: 'disclaimer', title: 'Disclaimer', desc: 'Limits on the information, prices and photos on this website', body: (D, x) =>
    '<h2>Estimates are not final prices</h2>' + P('All prices on this website are indicative estimates for Mumbai and Thane. The final price depends on the exact size, wood or board, hardware, finish and site conditions, and is confirmed only in our written quotation after a site visit.') +
    '<h2>Photos are design references</h2>' + P('Many photos on this website are licensed stock images that show the style of work we do. They are not photos of specific projects by ' + x.name + ' unless the page says so. Finished work will follow the agreed design, not the photo.') +
    '<h2>Accuracy and availability</h2>' + P('We try to keep information correct and up to date, but we do not guarantee that it is complete, current or free from errors, or that the website will always be available. Nothing on this website is legal, structural or engineering advice.') +
    '<h2>External links</h2>' + P('Links to other websites (for example WhatsApp and Google Maps) are for convenience. We do not control those websites and are not responsible for their content, privacy practices or availability.') },
  copyright: { path: 'copyright-policy', title: 'Copyright Policy', desc: 'Using material from this website', body: (D, x) =>
    P('Text, layout, logo and our own project photos on this website are © ' + x.name + '.') +
    UL(['You may quote or reproduce our <b>text</b> free of charge, if it is reproduced accurately, not used in a derogatory or misleading way, and the source is acknowledged as “' + x.name + ' (' + x.site + ')”.', 'You may <b>not</b> use our name, logo or project photos to advertise another business, or in a way that suggests we endorse you.', 'Stock photos on this website are licensed to us from Pexels under its own licence. Permission to reuse them must come from Pexels, not from us.']) +
    P('For any other use, ask us first at <a class="link" href="mailto:' + x.email + '">' + x.email + '</a>. If you believe something on this website infringes your copyright, write to the same address and we will review and act on it promptly.') },
  linking: { path: 'hyperlinking-policy', title: 'Hyperlinking Policy', desc: 'Linking to and from this website', body: (D, x) =>
    '<h2>Links to other websites</h2>' + P('We link to other websites, such as WhatsApp, Google Maps and payment or map services, for your convenience. We are not responsible for their content or reliability, and a link does not mean we endorse the website or its views. We cannot guarantee that these links will always work.') +
    '<h2>Links to this website</h2>' + P('You do not need our permission to link to any page on ' + x.site + '. We ask that you tell us about the link, and that you do <b>not</b> load our pages inside frames on your website — our pages must open in a new browser window or tab.') },
  refund: { path: 'refund-and-cancellation', title: 'Refund & Cancellation Policy', desc: 'Advances, cancellation and refunds for interior work and furniture', body: (D, x) =>
    P('We do not take payments on this website. Every job has its own written quotation or agreement, and the payment schedule, cancellation and refund terms in that document apply first. Where the document is silent, the following applies.') +
    '<h2>Advance payments</h2>' + P('Work starts after the advance agreed in the quotation is paid. The advance is used to buy material and book our carpenters for your job.') +
    '<h2>Cancelling a job or order</h2>' + UL(['<b>Before we buy material or start work</b> — the advance is refunded in full, less any site-visit or design charges agreed in writing.', '<b>After material is bought or work has started</b> — we refund the advance less the cost of material bought, work already done and labour booked for your job. Material bought for your job is handed over to you.', '<b>Made-to-measure furniture</b> that is already made to your size cannot be cancelled.']) +
    '<h2>Defects and changes</h2>' + P('Tell us about any defect in our workmanship as soon as you notice it. We will inspect and repair it as set out in your quotation or agreement. Changes you ask for after approval may change the price and the time needed.') +
    '<h2>How refunds are paid</h2>' + P('Approved refunds are paid by bank transfer or UPI within 15 working days.') +
    '<h2>Questions or complaints</h2>' + P('Contact the Grievance Officer on the <a class="link" href="/grievance/">Grievance & Feedback</a> page.') },
  accessibility: { path: 'accessibility-statement', title: 'Accessibility Statement', desc: 'How this website supports people with disabilities', body: (D, x) =>
    P(x.name + ' wants everyone, including people with disabilities, to be able to use this website. We aim to meet the Web Content Accessibility Guidelines (WCAG) 2.1 at Level AA, in the spirit of the Rights of Persons with Disabilities Act, 2016.') +
    '<h2>What we have done</h2>' + UL(['A “Skip to main content” link at the top of every page for keyboard and screen-reader users.', 'The whole website works with a keyboard, with a visible focus outline.', 'Text size controls (A−, A, A+), a dark mode, and Hindi and Marathi versions, at the top of every page. Your choice is remembered.', 'Descriptive text for every meaningful image.', 'Clear headings, labelled form fields and page titles that make sense on their own.', 'Layouts that work on phones, tablets and computers and when zoomed to 200%.', 'Animations are switched off if your device asks for reduced motion.']) +
    '<h2>Known limitations</h2>' + UL(['Some older photos may have short descriptions only.', 'WhatsApp and Google Maps open in their own apps, and their accessibility is controlled by those companies.']) +
    '<h2>Report a barrier</h2>' + P('If something on this website is hard to use, tell us and we will fix it or give you the information another way. Call or WhatsApp +91 ' + x.phone + ' or email <a class="link" href="mailto:' + x.email + '">' + x.email + '</a>. We aim to reply within 2 working days.') },
  grievance: { path: 'grievance', title: 'Grievance & Feedback', desc: 'Grievance officer, complaint process and feedback', body: (D, x) =>
    P('We want every customer to be satisfied. If you have a complaint about our work, a quotation, your personal data or this website, or simply want to give feedback, contact our Grievance Officer.') + officerBox(D) +
    '<h2>How we handle your complaint</h2><ol class="steps one">' + [['Tell us', 'Use the form below, WhatsApp, email or phone. Include your name, phone, site address and what went wrong.'], ['Acknowledgement within 48 hours', 'We confirm we have received your complaint and who is handling it.'], ['Resolution within 30 days', 'We inspect, discuss and resolve the complaint, and tell you the outcome.']].map(s => '<li class="step"><h3>' + s[0] + '</h3><p>' + s[1] + '</p></li>').join('') + '</ol>' +
    '<h2>Send a complaint or feedback</h2><form class="panel" id="gf" novalidate><div class="row2"><div class="field"><label for="gName">Your name</label><input id="gName" name="name" autocomplete="name" required/></div><div class="field"><label for="gPhone">Phone</label><input id="gPhone" name="phone" type="tel" autocomplete="tel" required/></div></div><div class="field"><label for="gEmail">Email (optional)</label><input id="gEmail" name="email" type="email" autocomplete="email" inputmode="email"/></div>' +
    '<div class="field"><label for="gType">Type</label><select id="gType" name="type"><option>Complaint about work</option><option>Quotation or billing</option><option>Personal data request</option><option>Website or accessibility</option><option>Feedback or suggestion</option></select></div><div class="field"><label for="gMsg">Details</label><textarea id="gMsg" name="message" required></textarea></div><input class="hp" name="_honey" tabindex="-1" autocomplete="off" aria-hidden="true"/><button class="btn btn-primary w100">Send to Grievance Officer</button></form>' +
    '<h2>If you are not satisfied</h2>' + UL(['Consumer complaints: National Consumer Helpline — call 1915 or visit <a class="link" href="https://consumerhelpline.gov.in" target="_blank" rel="noopener">consumerhelpline.gov.in</a>.', 'Personal data complaints: the Data Protection Board of India, after first contacting us.']) },
  help: { path: 'help', title: 'Help', desc: 'How to use this website', body: (D, x) =>
    '<h2>Getting an estimate</h2>' + UL(['Open a <a class="link" href="/services/">service</a> to see what it usually costs.', 'Use <a class="link" href="/get-quote/">Get a quote</a> to send your requirement. It opens WhatsApp with your details filled in — tap Send.', 'For furniture, tap <b>Add to quote</b> on the pieces you like, then open the quote list (the list icon at the top) and send it.']) +
    '<h2>Prices</h2>' + P('Prices are estimates. We confirm the exact price after a free site visit and measurement.') +
    '<h2>Reading the website</h2>' + UL(['Use A−, A and A+ to change text size, the moon button for dark mode, and EN / हिंदी / मराठी to change language.', 'Press Tab to move between links and buttons; the first link skips to the main content.', 'No plug-ins or PDF reader are needed to use this website. Quotations and invoices we send you are PDF files and open in any PDF reader or browser.']) +
    '<h2>Still need help?</h2>' + P('Call or WhatsApp +91 ' + x.phone + ', or see the <a class="link" href="/sitemap/">site map</a> for every page.') }
};
Object.keys(POLICIES).forEach(k => {
  V['legal_' + k] = D => {
    const Pp = POLICIES[k], x = legalInfo(D);
    const body = pageHead(Pp.title, (x.updated && k !== 'help' ? 'Last updated: ' + x.updated : ''), crumbs([[Pp.title]])) +
      '<section class="sec tight"><div class="wrap legal-wrap"><article class="legal">' + (CUR.lang !== 'en' && !/grievance|help/.test(k) ? '<p class="note">The English text of this policy applies.</p>' : '') + Pp.body(D, x) + '</article>' + legalNav(k) + '</div></section>';
    return { title: Pp.title + ' | ' + D.S.name, desc: Pp.desc + '. ' + Pp.title + ' of ' + D.S.name + ', interiors and furniture makers in Airoli, Navi Mumbai.', body, ld: [crumbLD(D, [[Pp.title, '/' + Pp.path + '/']])] };
  };
});
function legalNav(cur) {
  return '<nav class="legal-nav" aria-label="Policies"><h2>Policies & help</h2>' + Object.keys(POLICIES).map(k => '<a href="/' + POLICIES[k].path + '/"' + (k === cur ? ' aria-current="page"' : '') + '>' + POLICIES[k].title + '</a>').join('') + '<a href="/sitemap/"' + (cur === 'sitemap' ? ' aria-current="page"' : '') + '>Site map</a></nav>';
}
V.sitemap = D => {
  const g = (t, items) => '<div class="smap-col"><h2>' + t + '</h2><ul>' + items.map(i => '<li><a href="' + i[0] + '">' + esc(i[1]) + '</a></li>').join('') + '</ul></div>';
  const body = pageHead('Site map', 'Every page on this website.', crumbs([['Site map']])) + '<section class="sec tight"><div class="wrap legal-wrap"><div class="smap">' +
    g('Main pages', [['/', 'Home'], ['/services/', 'Services'], ['/furniture/', 'Furniture'], ['/our-work/', 'Our work'], ['/about/', 'About us'], ['/contact/', 'Contact'], ['/get-quote/', 'Get a quote'], ['/quote-list/', 'Quote list']]) +
    g('Services', D.S.services.map(s => ['/services/' + s.slug + '/', s.title])) +
    g('Furniture', D.CATS.filter(c => D.PRODUCTS.some(p => p.category === c.slug)).map(c => ['/furniture/' + c.slug + '/', c.name]).concat(D.PRODUCTS.map(p => [p.url, p.name]))) +
    g('Areas', D.AREAS.map(a => ['/areas/' + a.slug + '/', a.name])) +
    (D.BLOG.length ? g('Blog', [['/blog/', 'All articles']].concat(blogCats(D).map(c => ['/blog/category/' + c.slug + '/', c.name])).concat(D.BLOG.map(x => ['/blog/' + x.slug + '/', x.title]))) : '') +
    (D.GUIDES.length ? g('Guides', [['/guides/', 'All guides']].concat(D.GUIDES.map(x => ['/guides/' + x.slug + '/', x.title]))) : '') +
    g('Policies & help', Object.keys(POLICIES).map(k => ['/' + POLICIES[k].path + '/', POLICIES[k].title])) + '</div>' + legalNav('sitemap') + '</div></section>';
  return { title: 'Site Map | ' + D.S.name, desc: 'All pages on the ' + D.S.name + ' website: services, furniture, areas, policies and help.', body, ld: [crumbLD(D, [['Site map', '/sitemap/']])] };
};


/* ── languages: English is the source; Hindi and Marathi come from /data/i18n.json ── */
const CUR = { lang: 'en', dict: null };
function setLang(lang, raw) {
  CUR.lang = lang || 'en'; CUR.dict = null;
  const d = raw && raw[CUR.lang]; if (CUR.lang === 'en' || !d) return;
  const t = {}, p = [];
  Object.keys(d).forEach(k => { const v = d[k]; if (!v) return; const key = k, val = esc(v);
    if (/\{\d\}/.test(k)) p.push([new RegExp('^' + key.replace(/[.*+?^$()|[\]\\]/g, '\\$&').replace(/\{(\d)\}/g, '(.+?)') + '$'), val]); else t[key] = val; });
  p.sort((a, b) => b[0].source.length - a[0].source.length);
  CUR.dict = { t, p };
}
function trText(s) {
  const D = CUR.dict; if (!D) return s;
  const raw = s.trim(); if (!raw || !/[A-Za-z]/.test(raw)) return s;
  const lead = s.slice(0, s.indexOf(raw[0])), trail = s.slice(s.lastIndexOf(raw[raw.length - 1]) + 1);
  const core = raw.replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  if (D.t[core] != null) return lead + D.t[core] + trail;
  for (const [re, out] of D.p) { const m = core.match(re); if (m) return lead + out.replace(/\{(\d)\}/g, (_, i) => trText(esc(m[+i + 1])).trim()) + trail; }
  return s;
}
const LOCAL_SKIP = /^\/(assets|images|data|admin\.html|admin\/|favicon|icon-|apple-touch|site\.webmanifest|hi\/|mr\/|en\/)/;
function localize(html) {
  if (CUR.lang === 'en') return html;
  html = html.replace(/<a([^>]*?)\shref="(\/[^"]*)"/g, (m, pre, href) => /data-nolocal/.test(m) || LOCAL_SKIP.test(href) ? m : '<a' + pre + ' href="/' + CUR.lang + href + '"');
  return html.replace(/(<(script|style)[\s\S]*?<\/\2>)|(\s(?:alt|aria-label|placeholder|title)=")([^"]*)(")|>([^<]+)</g, (m, scr, _t, a1, av, a2, txt) => scr ? scr : a1 ? a1 + trText(av) + a2 : '>' + trText(txt) + '<');
}
const tr = s => CUR.lang === 'en' ? s : String(s).split(/( \| | — |: )/).map(x => /^( \| | — |: )$/.test(x) ? x : trText(esc(x)).replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"')).join('');
function langOf(path) { const m = String(path || '').match(/^\/(hi|mr)(\/|$)/); return m ? m[1] : 'en'; }

/* search-result friendly lengths: titles about 60 characters, descriptions about 155 */
function fitTitle(t, brand, max = 60) {
  t = String(t || ''); if (t.length <= max && t.length >= 30) return t;
  /* keep as many leading parts as fit in max characters; cut an overlong part at a comma; add the brand if there is room */
  const segs = t.split(/(?= \| | — )/); let out = '';
  for (const g of segs) {
    if ((out + g).length <= max) { out += g; continue; }
    const cut = g.split(', '); while (cut.length > 1 && (out + cut.join(', ')).length > max) cut.pop();
    if ((out + cut.join(', ')).length <= max && cut.join(', ').replace(/^( \| | — )/, '').length > 3) { out += cut.join(', '); break; }
    const w = g.split(' '); while (w.length && ((out + w.join(' ')).length > max || /^(in|and|&|for|of|the|to|with|—|\|)$/i.test(w[w.length - 1]))) w.pop();
    if (w.join(' ').replace(/^( \| | — )/, '').length > 10) out += w.join(' ');
    break;
  }
  if (!out) out = clip(t, max);
  if (out.length < 30 && !out.includes(brand) && (out + ' | ' + brand).length <= max) out += ' | ' + brand;
  if (out.length < 30 && (out + ', Navi Mumbai').length <= max) out += ', Navi Mumbai';
  return out;
}
/* descriptions: 120–155 characters */
function fitDesc(d, S) {
  d = String(d || '').trim();
  if (d.length < 120) {
    const A = { en: [' ' + S.name + ' — interiors and custom furniture in Mumbai, Thane and Navi Mumbai. Call ' + S.phone + '.', ' Interiors and custom furniture in Mumbai, Thane and Navi Mumbai.', ' Call ' + S.phone + '.'],
      hi: [' ' + S.name + ' — मुंबई, ठाणे और नवी मुंबई में इंटीरियर और कस्टम फर्नीचर। कॉल करें ' + S.phone + '।', ' मुंबई, ठाणे और नवी मुंबई में इंटीरियर और कस्टम फर्नीचर।', ' कॉल करें ' + S.phone + '।'],
      mr: [' ' + S.name + ' — मुंबई, ठाणे आणि नवी मुंबईत इंटिरियर आणि कस्टम फर्निचर. कॉल करा ' + S.phone + '.', ' मुंबई, ठाणे आणि नवी मुंबईत इंटिरियर आणि कस्टम फर्निचर.', ' कॉल करा ' + S.phone + '.'] }[CUR.lang] || [];
    const base = d.replace(/[.।]?$/, CUR.lang === 'hi' ? '।' : '.'), add = A.find(x => (base + x).length <= 158);
    if (add) d = base + add;
  }
  return clip(d, 158);
}
function clip(s, n) { s = String(s || ''); if (s.length <= n) return s; const c = s.slice(0, n - 1); return c.slice(0, Math.max(c.lastIndexOf(' '), n - 20)).replace(/[\s,.;:—–-]+$/, '') + '…'; }

/* ── routing ── */
function routes(D) {
  const R = [['/', 'home'], ['/services/', 'services'], ['/furniture/', 'furniture'], ['/our-work/', 'work'], ['/about/', 'about'], ['/contact/', 'contact'], ['/get-quote/', 'quote'], ['/quote-list/', 'list'], ['/thanks/', 'thanks']];
  D.S.services.forEach(s => R.push(['/services/' + s.slug + '/', 'service', s.slug]));
  D.CATS.forEach(c => R.push(['/furniture/' + c.slug + '/', 'category', c.slug]));
  D.PRODUCTS.forEach(p => R.push([p.url, 'product', p.category, p.slug]));
  D.AREAS.forEach(a => R.push(['/areas/' + a.slug + '/', 'area', a.slug]));
  Object.keys(POLICIES).forEach(k => R.push(['/' + POLICIES[k].path + '/', 'legal_' + k]));
  if (D.GUIDES.length) { R.push(['/guides/', 'guides']); D.GUIDES.forEach(g => R.push(['/guides/' + g.slug + '/', 'guide', g.slug])); }
  if (D.BLOG.length) {
    const pg = n => Math.ceil(n / BLOG_PER);
    R.push(['/blog/', 'blog']); for (let i = 2; i <= pg(D.BLOG.length); i++) R.push(['/blog/page/' + i + '/', 'blog', String(i)]);
    blogCats(D).forEach(c => { R.push(['/blog/category/' + c.slug + '/', 'blogcat', c.slug]); for (let i = 2; i <= pg(c.n); i++) R.push(['/blog/category/' + c.slug + '/page/' + i + '/', 'blogcat', c.slug, String(i)]); });
    D.BLOG.forEach(b => R.push(['/blog/' + b.slug + '/', 'post', b.slug]));
  }
  R.push(['/sitemap/', 'sitemap']);
  return R;
}
function resolve(D, path) {
  path = String(path || '/').replace(/^\/(hi|mr)(?=\/|$)/, '');
  path = ('/' + String(path || '/').replace(/index\.html$/, '').replace(/^\/+/, '')).replace(/\/?$/, '/');
  const r = routes(D).find(x => x[0] === path);
  return r ? { path, view: r[1], args: r.slice(2) } : { path, view: 'notfound', args: [] };
}
function render(D, view, args) {
  const p = (V[view] && V[view].apply(null, [D].concat(args || []))) || V.notfound(D);
  if (CUR.lang !== 'en') { p.body = localize(p.body); p.title = tr(p.title); p.desc = tr(p.desc); }
  p.title = fitTitle(p.title, D.S.name); p.desc = fitDesc(p.desc, D.S);
  if (CUR.lang !== 'en') { const L = CUR.lang === 'hi' ? ' (हिंदी)' : ' (मराठी)'; p.title = (p.title.length + L.length > 60 ? fitTitle(p.title, D.S.name, 60 - L.length) : p.title) + L; }
  return p;
}
const headerL = (D, path) => localize(header(D, path)), footerL = D => localize(footer(D));

/* ── header & footer ── */
const NAV = [['/services/', 'Services'], ['/furniture/', 'Furniture'], ['/our-work/', 'Our work'], ['/blog/', 'Blog'], ['/about/', 'About'], ['/contact/', 'Contact']];
const LANGS = [['en', 'EN', 'English'], ['hi', 'हिंदी', 'Hindi'], ['mr', 'मराठी', 'Marathi']];
function langLinks(path) {
  return '<span class="langs" role="group" aria-label="Language">' + LANGS.map(l => '<a data-nolocal href="' + (l[0] === 'en' ? '' : '/' + l[0]) + (path || '/') + '" hreflang="' + l[0] + '" lang="' + l[0] + '"' + (l[0] === CUR.lang ? ' aria-current="true"' : '') + ' title="' + l[2] + '">' + l[1] + '</a>').join('') + '</span>';
}
function header(D, path) {
  const S = D.S, fs = '<span class="fs" role="group" aria-label="Text size"><button type="button" data-fs="-1" aria-label="Decrease text size">A−</button><button type="button" data-fs="0" aria-label="Normal text size">A</button><button type="button" data-fs="1" aria-label="Increase text size">A+</button></span>';
  const theme = '<button type="button" class="themebtn" data-theme aria-pressed="false" aria-label="Dark mode">' + I.moon + I.sun + '</button>';
  return '<a class="skip" href="#app">Skip to main content</a><div class="top-note"><div class="wrap"><span class="tn-text">' + esc(S.top_note || '') + '</span>' +
    '<a class="tn-phone" href="' + tel(S) + '">' + I.phone + '+91 ' + esc(S.phone) + '</a><span class="tools">' + langLinks(path) + fs + theme + '</span></div></div>' +
    '<header class="site"><div class="wrap"><a class="brand" href="/" aria-label="' + esc(S.name) + ' home"><span class="logo-i" role="img" aria-label="' + esc(S.name) + ' logo"></span><span>' + esc(S.short || S.name) + '<small>Custom furniture · Made in India</small></span></a>' +
    '<nav class="main" id="nav" aria-label="Main">' + NAV.map(n => '<a href="' + n[0] + '"' + (path.indexOf(n[0]) === 0 ? ' aria-current="page"' : '') + '>' + n[1] + '</a>').join('') +
    '<a class="nav-list" href="/quote-list/"' + (path.indexOf('/quote-list/') === 0 ? ' aria-current="page"' : '') + '>' + I.list + 'Quote list<b data-count hidden>0</b></a>' +
    '<div class="nav-tools"><span>Text size</span>' + fs + '</div><a class="btn btn-primary btn-sm nav-cta" href="/get-quote/">Get a quote</a></nav>' +
    '<a class="listbtn" href="/quote-list/" aria-label="Quote list">' + I.list + '<b id="cartCount" data-count hidden>0</b></a>' +
    '<button class="menubtn" id="menuBtn" type="button" aria-label="Open menu" aria-expanded="false" aria-controls="nav"><span></span><span></span><span></span><b class="mdot" data-count hidden>0</b></button></div></header>';
}
function footer(D) {
  const S = D.S, locs = (S.locations || []).filter(Boolean);
  return '<footer class="site"><div class="wrap fgrid">' +
    '<div class="fbrand"><a class="fbrand-name" href="/"><span class="logo-i" role="img" aria-label="' + esc(S.name) + ' logo"></span><span>' + esc(S.name) + '</span></a><p>' + esc(S.tagline || '') + '</p>' +
    ((S.team || []).length ? '<ul class="fteam">' + S.team.map(t => '<li><b>' + esc(t.name) + '</b><span>' + esc(t.role) + '</span></li>').join('') + '</ul>' : '') +
    '<ul class="fmodes">' + (S.work_modes || []).map(m => '<li>' + I.shield + esc(m.title) + '</li>').join('') + '</ul></div>' +
    '<nav class="fcol" aria-label="Services"><h3>Services</h3>' + S.services.map(s => '<a href="/services/' + s.slug + '/">' + esc(s.title) + '</a>').join('') + '</nav>' +
    '<nav class="fcol" aria-label="Furniture and pages"><h3>Explore</h3><a href="/furniture/">Furniture</a>' + D.CATS.filter(c => D.PRODUCTS.some(p => p.category === c.slug)).slice(0, 5).map(c => '<a href="/furniture/' + esc(c.slug) + '/">' + esc(c.name) + '</a>').join('') + '<a href="/our-work/">Our work</a><a href="/blog/">Blog</a><a href="/guides/">Guides</a><a href="/about/">About us</a><a href="/get-quote/">Get a quote</a></nav>' +
    '<div class="fcol"><h3>Reach us</h3><ul class="flist">' + (S.phone ? '<li><a href="' + tel(S) + '">' + I.phone + '<span>+91 ' + esc(S.phone) + '</span></a></li>' : '') +
    (waNum(S) ? '<li><a href="' + esc(waLink(S, 'Hi, I want a quote for interior / furniture work.')) + '" target="_blank" rel="noopener">' + I.wa + '<span>WhatsApp us</span></a></li>' : '') +
    (S.email ? '<li><a href="mailto:' + esc(S.email) + '">' + I.mail + '<span>' + esc(S.email) + '</span></a></li>' : '') +
    locs.map(l => '<li><a href="https://maps.google.com/?q=' + encodeURIComponent(l) + '" target="_blank" rel="noopener">' + I.pin + '<span>' + esc(l) + '</span></a></li>').join('') + '</ul></div></div>' +
    '<div class="wrap fareas"><h3>Areas we serve</h3><p>' + D.AREAS.map(a => '<a href="/areas/' + a.slug + '/">' + esc(a.name) + '</a>').join('') + '</p></div>' +
    '<nav class="wrap fpolicy" aria-label="Policies"><a href="/terms-of-use/">Terms of Use</a><a href="/privacy-policy/">Privacy Policy</a><a href="/copyright-policy/">Copyright Policy</a><a href="/hyperlinking-policy/">Hyperlinking Policy</a><a href="/disclaimer/">Disclaimer</a><a href="/refund-and-cancellation/">Refund & Cancellation</a><a href="/accessibility-statement/">Accessibility</a><a href="/grievance/">Grievance & Feedback</a><a href="/help/">Help</a><a href="/sitemap/">Site map</a></nav>' +
    '<div class="wrap fbottom"><span>© ' + new Date().getFullYear() + ' ' + esc(S.name) + '. All rights reserved.</span><span>Estimates are indicative · Photos are design references</span></div></footer>' +
    '<a class="wafab" href="' + esc(waLink(S, 'Hi, I have a question about interior / furniture work.')) + '" target="_blank" rel="noopener" aria-label="Chat on WhatsApp">' + I.wa + '</a><div id="toast" role="status" aria-live="polite"></div>';
}
function orgLD(D) {
  const S = D.S, L = S.letterhead || {};
  return { '@context': 'https://schema.org', '@type': 'HomeAndConstructionBusiness', '@id': S.site_url + '/#business', name: S.name, url: S.site_url + '/', image: S.site_url + '/images/site/og.jpg', logo: S.site_url + '/assets/logo.png', telephone: '+91' + S.phone, email: S.email, priceRange: '₹₹',
    address: { '@type': 'PostalAddress', streetAddress: 'RM36, Yadav Nagar, MIDC Road, Airoli', addressLocality: 'Navi Mumbai', addressRegion: 'Maharashtra', postalCode: (String(L.address || '').match(/\b\d{6}\b/) || [])[0], addressCountry: 'IN' }, hasMap: S.map || undefined,
    openingHoursSpecification: [{ '@type': 'OpeningHoursSpecification', dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'], opens: '09:00', closes: '20:00' }],
    sameAs: [S.instagram, S.facebook].filter(Boolean),
    areaServed: D.AREAS.map(a => ({ '@type': 'Place', name: a.name })), founder: (S.team || []).filter(t => /founder/i.test(t.role)).map(t => ({ '@type': 'Person', name: t.name, jobTitle: t.role, image: t.photo ? S.site_url + src(t.photo) : undefined })),
    employee: (S.team || []).filter(t => !/founder/i.test(t.role)).map(t => ({ '@type': 'Person', name: t.name, jobTitle: t.role })),
    makesOffer: S.services.map(s => ({ '@type': 'Offer', itemOffered: { '@type': 'Service', name: s.title, url: S.site_url + '/services/' + s.slug + '/' } })) };
}

function sig(str) { let h = 5381; str = String(str); for (let i = 0; i < str.length; i++) h = (h * 33 ^ str.charCodeAt(i)) >>> 0; return h.toString(36); }

return { parseBody, bodyText, blogBlock, readMin, CUR, LANGS, setLang, langOf, localize, tr, header: headerL, footer: footerL, sig, esc, slugify, inr, src, small, I, prep, routes, resolve, render, orgLD, card, catName, waLink, tel, range, V };
});
