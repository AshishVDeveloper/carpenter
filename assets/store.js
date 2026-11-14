/* Carpenter Furniture Store — storefront. Data lives in /data/*.json, edited from admin.html. */
(function(){
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const get = f => fetch('data/' + f + '?t=' + Date.now()).then(r => { if (!r.ok) throw new Error(f); return r.json(); });
const CART_KEY = 'carpenter_cart', ORD_KEY = 'carpenter_orders';
let S = {}, CATS = [], PRODUCTS = [], QUOTES = [], WORK = [];

const I = {
  wa: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2z"/></svg>',
  cart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.5L21 8H6.2"/></svg>',
  pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>',
  phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/></svg>',
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  mail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>',
  ruler: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="2" y="8" width="20" height="8" rx="1"/><path d="M6 8v3M10 8v4M14 8v3M18 8v4"/></svg>',
  truck: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M3 6h11v10H3zM14 10h4l3 3v3h-7"/><circle cx="7" cy="18" r="1.8"/><circle cx="17" cy="18" r="1.8"/></svg>',
  shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/><path d="m9 12 2 2 4-4"/></svg>',
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M3 11 12 4l9 7v9H3z"/><path d="M9 20v-6h6v6"/></svg>',
  kitchen: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="10" width="18" height="10" rx="1"/><path d="M3 14h18M8 6h8v4H8z"/></svg>',
  office: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="8" width="18" height="5" rx="1"/><path d="M5 13v7M19 13v7M9 4h6v4H9z"/></svg>',
  shop: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 9h16l-1-5H5zM5 9v11h14V9M10 20v-5h4v5"/></svg>',
  mall: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M3 21V7l9-4 9 4v14"/><path d="M7 21v-8h10v8M7 17h10"/></svg>',
  sofa: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M5 11V8a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v3"/><path d="M3 13a2 2 0 0 1 4 0v2h10v-2a2 2 0 0 1 4 0v5H3z"/><path d="M6 18v2M18 18v2"/></svg>',
  tree: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 22v-6M12 3 6 11h3l-4 5h14l-4-5h3z"/></svg>'
};

/* ── helpers ── */
const money = n => (S.currency || '₹') + Number(n || 0).toLocaleString('en-IN');
const off = p => p.mrp && p.mrp > p.price ? Math.round((1 - p.price / p.mrp) * 100) : 0;
const catName = slug => (CATS.find(c => c.slug === slug) || {}).name || slug;
const img = p => (p.images && p.images[0]) || 'assets/logo.svg';
const waNum = () => String(S.whatsapp || S.phone || '').replace(/\D/g, '');
const waLink = text => 'https://wa.me/' + waNum() + '?text=' + encodeURIComponent(text);
function toast(msg, err){ const t = $('toast'); t.innerHTML = msg; t.className = 'show' + (err ? ' err' : ''); clearTimeout(t._t); t._t = setTimeout(() => t.className = '', 4000); }
const cart = { get(){ try { return JSON.parse(localStorage.getItem(CART_KEY) || '[]'); } catch(e){ return []; } },
  set(c){ try { localStorage.setItem(CART_KEY, JSON.stringify(c)); } catch(e){} badge(); },
  add(id, q = 1){ const c = cart.get(), l = c.find(x => x.id === id); if (l) l.q += q; else c.push({id, q}); cart.set(c); } };
function badge(){ const n = cart.get().reduce((a, l) => a + l.q, 0); $('cartCount').textContent = n; $('cartCount').hidden = !n; }
function priceHTML(p){ const o = off(p); return '<div class="price"><b>' + money(p.price) + '</b>' + (o ? '<s>' + money(p.mrp) + '</s><em>' + o + '% off</em>' : '') + '</div>'; }
function cardHTML(p){
  const o = off(p);
  return '<article class="card"><a class="ph" href="#/p/' + p.id + '"><img src="' + esc(img(p)) + '" alt="' + esc(p.name) + '" loading="lazy"/>' +
    (p.in_stock === false ? '<span class="badge out">Made to order</span>' : o ? '<span class="badge">' + o + '% off</span>' : '') +
    (p.customizable ? '<span class="badge custom">Custom size</span>' : '') + '</a>' +
    '<div class="body"><h3><a href="#/p/' + p.id + '">' + esc(p.name) + '</a></h3><div class="meta">' + esc(p.material || '') + '</div>' + priceHTML(p) +
    '<div class="acts"><button class="btn btn-primary" data-add="' + p.id + '">Add to cart</button><a class="btn btn-ghost" href="#/p/' + p.id + '">Details</a></div></div></article>';
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-add]');
  if (b) { cart.add(+b.dataset.add, +(b.dataset.q || 1)); toast('Added to cart. <a href="#/cart">View cart</a>'); }
});

/* ── interior business blocks ── */
const SVC_ICONS = ['home','kitchen','office','shop','mall','sofa'];
function servicesHTML(){ return '<div class="svcs">' + (S.services || []).map((s, i) => '<div class="svc">' + (I[SVC_ICONS[i]] || I.ruler) + '<h3>' + esc(s.title) + '</h3><p>' + esc(s.desc) + '</p></div>').join('') + '</div>'; }
function modesHTML(){ return '<div class="modes">' + (S.work_modes || []).map(m => '<div class="mode"><h3>' + esc(m.title) + '</h3><p>' + esc(m.desc) + '</p><a class="link" href="#/custom?mode=' + encodeURIComponent(m.title) + '">Ask for a ' + esc(m.title.toLowerCase()) + ' quote</a></div>').join('') + '</div>'; }
function workHTML(list){ return '<div class="work">' + list.map(w => '<article class="site-card">' + (w.images && w.images[0] ? '<img src="' + esc(w.images[0]) + '" alt="' + esc(w.title) + '" loading="lazy"/>' : '') + '<div><span class="tag">' + esc(w.type || '') + '</span><h3>' + esc(w.title) + '</h3><p class="meta">' + I.pin + esc(w.area || '') + '</p>' + (w.description ? '<p>' + esc(w.description) + '</p>' : '') + '</div></article>').join('') + '</div>'; }
function locationsHTML(){ return '<ul class="locs">' + (S.locations || [S.address]).filter(Boolean).map(l => '<li>' + I.pin + esc(l) + '</li>').join('') + '</ul>'; }
function services(){
  return '<section class="sec" style="padding-top:2rem"><div class="wrap"><h1 style="font-size:clamp(2rem,4vw,3rem)">Interior services</h1><p class="lede" style="margin:1rem 0 2rem">' + esc(S.about) + '</p>' + servicesHTML() +
    '<h2 style="margin-top:3.5rem">Two ways to work with us</h2><p class="lede" style="margin-bottom:1.4rem">Pick what suits your budget and how involved you want to be.</p>' + modesHTML() +
    '<h2 style="margin-top:3.5rem">Where we work</h2><p class="lede" style="margin-bottom:1rem">Teams in Mumbai, Thane and Navi Mumbai, and in Uttar Pradesh.</p>' + locationsHTML() +
    '<div class="ctas" style="margin-top:2rem"><a class="btn btn-primary" href="#/custom">Get a quote</a><a class="btn btn-ghost" href="#/work">See our work</a></div></div></section>';
}
function work(){
  return '<section class="sec" style="padding-top:2rem"><div class="wrap"><h1 style="font-size:clamp(2rem,4vw,3rem)">Our work</h1><p class="lede" style="margin:1rem 0 2rem">Homes, offices, shops, showrooms and mall stores we have worked on.</p>' + (WORK.length ? workHTML(WORK) : '<div class="empty">Project photos are coming soon.</div>') +
    '</div></section>';
}

/* ── pages ── */
function home(){
  const feat = PRODUCTS.filter(p => p.featured), pick = feat.concat(PRODUCTS.filter(p => !p.featured)).slice(0, 4);
  const col = (feat.length >= 3 ? feat : PRODUCTS).slice(0, 3);
  const count = slug => PRODUCTS.filter(p => p.category === slug).length;
  const firstImg = slug => { const p = PRODUCTS.find(p => p.category === slug); return p ? img(p) : 'assets/logo.svg'; };
  return '<section class="hero"><div class="wrap"><div>' +
    '<h1>' + esc(S.hero_title) + '</h1>' +
    '<div class="tape" aria-hidden="true">' + [0,50,100,150,200,250,300,350,400,450,500].map((x,i)=>'<span style="left:'+(x+3)+'px">'+(i*10)+'</span>').join('') + '</div>' +
    '<p class="lede">' + esc(S.hero_text) + '</p>' +
    '<div class="ctas"><a class="btn btn-primary" href="#/custom">Get a quote</a><a class="btn btn-ghost" href="#/work">See our work</a></div>' +
    '<div class="trust">' + (S.years ? '<div><b>' + esc(S.years) + '</b>years experience</div>' : '') + '<div><b>' + ((S.locations || []).length || 1) + '</b>locations</div><div><b>2 ways</b>contract or labour basis</div>' + (WORK.length ? '<div><b>' + WORK.length + '+</b>project sites</div>' : '') + '</div>' +
    '</div><div class="collage">' + col.map(p => '<a href="#/p/' + p.id + '"><img src="' + esc(img(p)) + '" alt="' + esc(p.name) + '"/><span>' + esc(p.name) + '</span></a>').join('') + '</div></div></section>' +

    '<section class="sec" style="padding-top:1.5rem"><div class="wrap"><div class="sec-head"><div><h2>What we do</h2><p class="lede">Complete interiors and carpentry for homes and businesses.</p></div><a class="link" href="#/services">All services</a></div>' + servicesHTML() + '</div></section>' +
    '<section class="sec" style="padding-top:0"><div class="wrap"><h2>Contract basis or labour basis</h2><p class="lede" style="margin-bottom:1.4rem">Choose how you want to hire us.</p>' + modesHTML() + '</div></section>' +
    (WORK.length ? '<section class="sec" style="padding-top:0"><div class="wrap"><div class="sec-head"><div><h2>Our work</h2><p class="lede">Some of the buildings and businesses we have worked in.</p></div><a class="link" href="#/work">See all</a></div>' + workHTML(WORK.slice(0, 6)) + '</div></section>' : '') +
    '<section class="sec" style="padding-top:0"><div class="wrap"><div class="sec-head"><h2>Furniture by room</h2><a class="link" href="#/shop">View all</a></div><div class="cats">' +
    CATS.filter(c => count(c.slug)).map(c => '<a class="cat" href="#/shop/' + esc(c.slug) + '"><img src="' + esc(firstImg(c.slug)) + '" alt=""/>' + esc(c.name) + ' <small>' + count(c.slug) + '</small></a>').join('') + '</div></div></section>' +

    '<section class="sec" style="padding-top:1rem"><div class="wrap"><div class="sec-head"><div><h2>Ready furniture</h2><p class="lede">Every piece can also be made in your size, wood and finish.</p></div><a class="link" href="#/shop">See all ' + PRODUCTS.length + '</a></div><div class="grid">' + pick.map(cardHTML).join('') + '</div></div></section>' +

    '<section class="sec"><div class="wrap"><h2>How we work</h2><p class="lede" style="margin-bottom:1.6rem">From your first message to the finished space.</p><div class="steps">' +
    [['Share your requirement','Send photos, a sketch or your room sizes on WhatsApp.'],['Site visit & measurement','We visit, measure and suggest materials and finishes.'],['Approve the quote','You get a clear contract or labour-basis price before we start.'],['We build and finish','Our carpenters complete the work on site or in our workshop.']]
      .map(s => '<div class="step"><h3>' + s[0] + '</h3><p>' + s[1] + '</p></div>').join('') + '</div></div></section>' +

    '<section class="sec" style="padding-top:0"><div class="wrap"><div class="feats">' +
    [[I.tree,'Real wood','Sheesham, teak, plywood and laminates — we tell you exactly what goes in.'],[I.ruler,'Made to measure','Built to your exact space, corner or wall.'],[I.truck,'Delivery & fitting',S.delivery_note||'Delivered and fitted by our own team.'],[I.pin,'Mumbai to UP','Teams in Mumbai, Thane, Navi Mumbai and Uttar Pradesh.']].concat(S.warranty?[[I.shield,'Warranty',S.warranty]]:[]).slice(0,4)
      .map(f => '<div class="feat">' + f[0] + '<h3>' + f[1] + '</h3><p>' + esc(f[2]) + '</p></div>').join('') + '</div></div></section>' +

    (QUOTES.length ? '<section class="sec" style="padding-top:0"><div class="wrap"><h2>What customers say</h2><div class="quotes" style="margin-top:1.4rem">' +
      QUOTES.map(q => '<figure class="quote"><div class="stars" aria-label="' + (q.rating||5) + ' out of 5">' + '★'.repeat(q.rating||5) + '</div><p>' + esc(q.text) + '</p><figcaption><b>' + esc(q.name) + '</b><small>' + esc(q.place||'') + '</small></figcaption></figure>').join('') + '</div></div></section>' : '');

}

function shop(slug){
  const q = new URLSearchParams(location.hash.split('?')[1] || '');
  const state = { cat: slug || '', sort: q.get('sort') || 'popular', custom: q.get('custom') === '1', search: q.get('q') || '' };
  setTimeout(() => {
    const draw = () => {
      let L = PRODUCTS.filter(p => (!state.cat || p.category === state.cat) && (!state.custom || p.customizable) &&
        (!state.search || (p.name + ' ' + p.material + ' ' + catName(p.category)).toLowerCase().includes(state.search.toLowerCase())));
      if (state.sort === 'low') L.sort((a, b) => a.price - b.price);
      if (state.sort === 'high') L.sort((a, b) => b.price - a.price);
      $('count').textContent = L.length + (L.length === 1 ? ' piece' : ' pieces');
      $('results').innerHTML = L.length ? '<div class="grid">' + L.map(cardHTML).join('') + '</div>' : '<div class="empty">Nothing matches. Try another category, or <a class="link" href="#/custom">ask us to make it</a>.</div>';
    };
    $('fl').onchange = e => { const t = e.target; if (t.name === 'cat') state.cat = t.value; if (t.name === 'custom') state.custom = t.checked; draw(); };
    $('sort').onchange = e => { state.sort = e.target.value; draw(); };
    $('search').oninput = e => { state.search = e.target.value; draw(); };
    draw();
  });
  return '<section class="sec" style="padding-top:2rem"><div class="wrap"><h1 style="font-size:clamp(2rem,4vw,3rem);margin-bottom:1.4rem">' + (slug ? esc(catName(slug)) : 'All furniture') + '</h1><div class="shop">' +
    '<form class="filters" id="fl" onsubmit="return false"><h3>Category</h3><label><input type="radio" name="cat" value=""' + (!slug ? ' checked' : '') + '/> All</label>' +
    CATS.map(c => '<label><input type="radio" name="cat" value="' + esc(c.slug) + '"' + (slug === c.slug ? ' checked' : '') + '/> ' + esc(c.name) + '</label>').join('') +
    '<h3>Options</h3><label><input type="checkbox" name="custom"' + (state.custom ? ' checked' : '') + '/> Available in custom size</label></form>' +
    '<div><div class="toolbar"><input id="search" type="search" placeholder="Search sofa, sheesham, bed…" aria-label="Search furniture" value="' + esc(state.search) + '"/><div style="display:flex;gap:.8rem;align-items:center"><span id="count" class="hint" style="margin:0"></span><select id="sort" aria-label="Sort"><option value="popular">Popular</option><option value="low"' + (state.sort === 'low' ? ' selected' : '') + '>Price: low to high</option><option value="high"' + (state.sort === 'high' ? ' selected' : '') + '>Price: high to low</option></select></div></div><div id="results"></div></div></div></div></section>';
}

function product(id){
  const p = PRODUCTS.find(x => String(x.id) === String(id));
  if (!p) return '<section class="sec"><div class="wrap"><div class="empty">This product is no longer available. <a class="link" href="#/shop">Browse all furniture</a></div></div></section>';
  document.title = p.name + ' — ' + S.name;
  const imgs = p.images && p.images.length ? p.images : ['assets/logo.svg'];
  const rel = PRODUCTS.filter(x => x.category === p.category && x.id !== p.id).concat(PRODUCTS.filter(x => x.category !== p.category && x.featured)).slice(0, 4);
  setTimeout(() => {
    $('thumbs') && ($('thumbs').onclick = e => { const b = e.target.closest('button'); if (!b) return; $('mainImg').src = b.dataset.src; [...$('thumbs').children].forEach(x => x.setAttribute('aria-pressed', x === b)); });
    const qi = $('qty'), set = v => { qi.value = Math.max(1, Math.min(20, v | 0 || 1)); $('addBtn').dataset.q = qi.value; };
    $('qm').onclick = () => set(+qi.value - 1); $('qp').onclick = () => set(+qi.value + 1); qi.oninput = () => set(qi.value);
    $('waBuy').onclick = () => { $('waBuy').href = waLink('Hi, I want to order:\n' + p.name + ' × ' + qi.value + ' — ' + money(p.price * qi.value) + '\nLink: ' + location.href); };
  });
  return '<section class="sec" style="padding-top:2rem"><div class="wrap"><div class="crumbs"><a href="#/shop">Shop</a> / <a href="#/shop/' + esc(p.category) + '">' + esc(catName(p.category)) + '</a> / ' + esc(p.name) + '</div><div class="pd">' +
    '<div class="gallery"><div class="main"><img id="mainImg" src="' + esc(imgs[0]) + '" alt="' + esc(p.name) + '"/></div>' + (imgs.length > 1 ? '<div class="thumbs" id="thumbs">' + imgs.map((s, i) => '<button type="button" data-src="' + esc(s) + '" aria-pressed="' + (i === 0) + '" aria-label="Photo ' + (i + 1) + '"><img src="' + esc(s) + '" alt=""/></button>').join('') + '</div>' : '') + '</div>' +
    '<div><h1>' + esc(p.name) + '</h1><p class="hint" style="margin:.4rem 0 1rem">' + esc(catName(p.category)) + (p.in_stock === false ? ' · Made to order' : ' · Ready to deliver') + '</p>' + priceHTML(p) +
    (p.size ? '<div style="margin-top:.8rem"><span class="size">' + esc(p.size) + '</span></div>' : '') +
    '<p style="margin-top:1rem">' + esc(p.description) + '</p>' +
    '<dl class="specs">' + [['Material', p.material], ['Size', p.size], ['Finish', p.finish], ['Custom size', p.customizable ? 'Available — ask for a quote' : 'Not available']].filter(r => r[1]).map(r => '<div><dt>' + r[0] + '</dt><dd>' + esc(r[1]) + '</dd></div>').join('') + '</dl>' +
    '<div class="buy"><div class="qty"><button type="button" id="qm" aria-label="Fewer">−</button><input id="qty" value="1" inputmode="numeric" aria-label="Quantity"/><button type="button" id="qp" aria-label="More">+</button></div><button class="btn btn-primary" id="addBtn" data-add="' + p.id + '" data-q="1">' + I.cart + 'Add to cart</button><a class="btn btn-wa" id="waBuy" href="#" target="_blank" rel="noopener">' + I.wa + 'Order on WhatsApp</a></div>' +
    (p.customizable ? '<div class="note">Need a different size, wood or colour? <a class="link" href="#/custom?item=' + encodeURIComponent(p.name) + '">Ask for a custom quote</a>.</div>' : '') +
    '<p class="hint" style="margin-top:1rem">' + esc(S.delivery_note || '') + '</p></div></div>' +
    (rel.length ? '<h2 style="margin:3.5rem 0 1.2rem">You may also like</h2><div class="grid">' + rel.map(cardHTML).join('') + '</div>' : '') + '</div></section>';
}

function cartPage(){
  const lines = cart.get().map(l => ({...l, p: PRODUCTS.find(p => p.id === l.id)})).filter(l => l.p);
  if (!lines.length) return '<section class="sec"><div class="wrap"><h1 style="font-size:2.2rem;margin-bottom:1rem">Your cart</h1><div class="empty">Your cart is empty. <a class="link" href="#/shop">Browse furniture</a></div></div></section>';
  const total = lines.reduce((a, l) => a + l.p.price * l.q, 0);
  setTimeout(() => {
    $('lines').onclick = e => { const b = e.target.closest('[data-rm]'); if (b) { cart.set(cart.get().filter(l => l.id !== +b.dataset.rm)); route(); } };
    $('lines').onchange = e => { const i = e.target.closest('[data-q]'); if (i) { const c = cart.get(), l = c.find(x => x.id === +i.dataset.q); l.q = Math.max(1, +i.value || 1); cart.set(c); route(); } };
    $('checkout').onsubmit = async e => {
      e.preventDefault(); const d = Object.fromEntries(new FormData(e.target)); if (d._honey) return;
      if (!d.name.trim() || !/^\+?\d[\d\s-]{8,}$/.test(d.phone.trim()) || !d.address.trim()) { toast('Add your name, a 10-digit phone number and delivery address.', true); return; }
      const items = lines.map(l => '• ' + l.p.name + ' × ' + l.q + ' — ' + money(l.p.price * l.q)).join('\n');
      const msg = 'New order from website\n\n' + items + '\n\nTotal: ' + money(total) + '\n\nName: ' + d.name + '\nPhone: ' + d.phone + '\nAddress: ' + d.address + (d.notes ? '\nNotes: ' + d.notes : '');
      const order = {id: Date.now(), date: new Date().toLocaleString('en-IN', {timeZone: 'Asia/Kolkata'}), name: d.name, phone: d.phone, address: d.address, notes: d.notes, items: lines.map(l => ({id: l.p.id, name: l.p.name, q: l.q, price: l.p.price})), total, kind: 'order'};
      try { const a = JSON.parse(localStorage.getItem(ORD_KEY) || '[]'); a.unshift(order); localStorage.setItem(ORD_KEY, JSON.stringify(a.slice(0, 100))); } catch (er) {}
      emailCopy('New order — ' + money(total) + ' — ' + d.name, {Name: d.name, Phone: d.phone, Address: d.address, Items: items, Total: money(total), Notes: d.notes || '-'});
      window.open(waLink(msg), '_blank', 'noopener');
      cart.set([]); location.hash = '#/thanks';
    };
  });
  return '<section class="sec" style="padding-top:2rem"><div class="wrap"><h1 style="font-size:2.2rem;margin-bottom:1.4rem">Your cart</h1><div class="cart"><div id="lines">' +
    lines.map(l => '<div class="line"><img src="' + esc(img(l.p)) + '" alt=""/><div><h3><a href="#/p/' + l.p.id + '" style="text-decoration:none">' + esc(l.p.name) + '</a></h3><div class="meta">' + money(l.p.price) + ' each</div><button class="rm" data-rm="' + l.p.id + '">Remove</button></div><div style="text-align:right"><input data-q="' + l.p.id + '" type="number" min="1" max="20" value="' + l.q + '" aria-label="Quantity of ' + esc(l.p.name) + '" style="width:64px;padding:.4rem;border:1.5px solid var(--line);border-radius:8px;text-align:center"/><div style="font-weight:700;margin-top:.3rem">' + money(l.p.price * l.q) + '</div></div></div>').join('') +
    '<div class="sum total"><span>Total</span><span>' + money(total) + '</span></div><p class="hint">' + esc(S.delivery_note || '') + '</p></div>' +
    '<form class="panel" id="checkout" novalidate><h2 style="font-size:1.4rem">Place your order</h2><p class="hint" style="margin-bottom:1rem">Your order opens in WhatsApp so you can confirm it with us. Pay on delivery or by UPI after we confirm.</p>' +
    '<div class="field"><label for="cName">Full name</label><input id="cName" name="name" autocomplete="name" required/></div>' +
    '<div class="field"><label for="cPhone">Phone</label><input id="cPhone" name="phone" type="tel" autocomplete="tel" required/></div>' +
    '<div class="field"><label for="cAddr">Delivery address</label><textarea id="cAddr" name="address" autocomplete="street-address" required style="min-height:80px"></textarea></div>' +
    '<div class="field"><label for="cNotes">Notes (optional)</label><input id="cNotes" name="notes" placeholder="Preferred delivery date, floor, lift…"/></div><input class="hp" name="_honey" tabindex="-1" autocomplete="off" aria-hidden="true"/>' +
    '<button class="btn btn-wa" style="width:100%">' + I.wa + 'Send order on WhatsApp</button></form></div></div></section>';
}

function custom(){
  const qs = new URLSearchParams(location.hash.split('?')[1] || ''), item = qs.get('item') || '', mode = qs.get('mode') || '';
  setTimeout(() => {
    $('cf').onsubmit = e => {
      e.preventDefault(); const d = Object.fromEntries(new FormData(e.target)); if (d._honey) return;
      if (!d.name.trim() || !/^\+?\d[\d\s-]{8,}$/.test(d.phone.trim()) || !d.type) { toast('Add your name, phone number and what you need.', true); return; }
      const msg = 'Quote request\n\nWork: ' + d.type + (d.mode ? '\nBasis: ' + d.mode : '') + (d.size ? '\nSize: ' + d.size : '') + (d.wood ? '\nWood: ' + d.wood : '') + (d.budget ? '\nBudget: ' + d.budget : '') + (d.details ? '\nDetails: ' + d.details : '') + '\n\nName: ' + d.name + '\nPhone: ' + d.phone + (d.area ? '\nArea: ' + d.area : '') + '\n\n(I will send reference photos here.)';
      try { const a = JSON.parse(localStorage.getItem(ORD_KEY) || '[]'); a.unshift({...d, id: Date.now(), date: new Date().toLocaleString('en-IN', {timeZone: 'Asia/Kolkata'}), work: d.type, kind: 'custom'}); localStorage.setItem(ORD_KEY, JSON.stringify(a.slice(0, 100))); } catch (er) {}
      emailCopy('Quote request — ' + d.type + ' — ' + d.name, {Work: d.type, Basis: d.mode || '-', Size: d.size || '-', Wood: d.wood || '-', Budget: d.budget || '-', Details: d.details || '-', Name: d.name, Phone: d.phone, Area: d.area || '-'});
      window.open(waLink(msg), '_blank', 'noopener'); location.hash = '#/thanks';
    };
  });
  return '<section class="sec" style="padding-top:2rem"><div class="wrap split"><div><h1 style="font-size:clamp(2rem,4vw,3rem)">Get a quote</h1><p class="lede" style="margin:1rem 0 1.6rem">Tell us about your interior or furniture work. We\'ll reply on WhatsApp with questions, a price range and a date for a site visit.</p><div class="steps" style="grid-template-columns:1fr">' +
    [['Send the request','Fill in this form — it opens WhatsApp with your details.'],['Share photos','Send pictures of the site or designs you like in the same chat.'],['Site visit & quote','We measure, suggest materials and confirm the price.']].map(s => '<div class="step"><h3>' + s[0] + '</h3><p>' + s[1] + '</p></div>').join('') + '</div></div>' +
    '<form class="panel" id="cf" novalidate><div class="field"><label for="xType">What do you need?</label><input id="xType" name="type" list="types" required value="' + esc(item) + '" placeholder="e.g. 2BHK interior, office cabins, wardrobe"/><datalist id="types">' + (S.services || []).map(s => '<option value="' + esc(s.title) + '">').join('') + CATS.map(c => '<option value="' + esc(c.name) + '">').join('') + '<option value="False ceiling"><option value="Wall panelling"><option value="Temple / mandir"></datalist></div>' +
    '<div class="field"><label for="xMode">How do you want to hire us?</label><select id="xMode" name="mode"><option value="">Not sure yet</option>' + (S.work_modes || []).map(m => '<option' + (m.title === mode ? ' selected' : '') + '>' + esc(m.title) + '</option>').join('') + '</select></div>' +
    '<div class="row2"><div class="field"><label for="xSize">Size (approx.)</label><input id="xSize" name="size" placeholder="e.g. 2BHK, 600 sq ft, 7 × 6 ft"/></div><div class="field"><label for="xWood">Wood / material</label><select id="xWood" name="wood"><option value="">Not sure — suggest</option><option>Sheesham</option><option>Teak</option><option>Mango wood</option><option>Engineered wood / plywood</option></select></div></div>' +
    '<div class="row2"><div class="field"><label for="xBudget">Budget</label><select id="xBudget" name="budget"><option value="">Prefer not to say</option><option>Under ₹50,000</option><option>₹50,000 – ₹2 lakh</option><option>₹2 – 5 lakh</option><option>Above ₹5 lakh</option></select></div><div class="field"><label for="xArea">Site location</label><input id="xArea" name="area" placeholder="e.g. Bhandup, Thane, Prayagraj"/></div></div>' +
    '<div class="field"><label for="xDet">Details</label><textarea id="xDet" name="details" placeholder="Colour, number of drawers, mirror, finish…"></textarea></div>' +
    '<div class="row2"><div class="field"><label for="xName">Your name</label><input id="xName" name="name" autocomplete="name" required/></div><div class="field"><label for="xPhone">Phone</label><input id="xPhone" name="phone" type="tel" autocomplete="tel" required/></div></div><input class="hp" name="_honey" tabindex="-1" autocomplete="off" aria-hidden="true"/>' +
    '<button class="btn btn-wa" style="width:100%">' + I.wa + 'Send request on WhatsApp</button></form></div></section>';
}

function contactBlocks(){
  const locs = (S.locations && S.locations.length ? S.locations : [S.address]).filter(Boolean);
  return [...locs.map((l, i) => ['pin', i === 0 && S.map ? S.map : 'https://maps.google.com/?q=' + encodeURIComponent(l), i === 0 ? 'Main office' : 'Also in', l]),
    S.phone && ['phone', 'tel:+91' + String(S.phone).replace(/\D/g, '').slice(-10), 'Call', S.phone],
    waNum() && ['wa', waLink('Hi, I have a question about your furniture.'), 'WhatsApp', 'Chat with us'],
    S.email && ['mail', 'mailto:' + S.email, 'Email', S.email],
    S.hours && ['clock', '', 'Open', S.hours]].filter(Boolean)
    .map(b => (b[1] ? '<a href="' + esc(b[1]) + '"' + (b[1].startsWith('http') ? ' target="_blank" rel="noopener"' : '') + '>' : '<div>') + I[b[0]] + '<span><small>' + b[2] + '</small>' + esc(b[3]) + '</span>' + (b[1] ? '</a>' : '</div>')).join('');
}
function about(){
  return '<section class="sec" style="padding-top:2rem"><div class="wrap split"><div><h1 style="font-size:clamp(2rem,4vw,3rem)">About ' + esc(S.name) + '</h1><p class="lede" style="margin:1rem 0">' + esc(S.about) + '</p>' +
    '<div class="feats" style="grid-template-columns:1fr 1fr;margin-top:1.4rem">' + (S.work_modes||[]).map(m=>[I.ruler,m.title]).concat([[I.tree,'Real wood'],[I.truck,'Delivery & fitting']]).slice(0,4).map(f => '<div class="feat">' + f[0] + '<h3>' + esc(f[1]) + '</h3></div>').join('') + '</div></div>' +
    '<div><h2>Contact us</h2><p class="lede" style="margin-bottom:1rem">Call or WhatsApp to book a site visit.</p><div class="info">' + contactBlocks() + '</div></div></div></section>';
}
function contact(){
  setTimeout(() => {
    $('qf').onsubmit = e => { e.preventDefault(); const d = Object.fromEntries(new FormData(e.target)); if (d._honey) return;
      if (!d.name.trim() || !d.message.trim()) { toast('Add your name and a message.', true); return; }
      emailCopy('Website enquiry — ' + d.name, {Name: d.name, Phone: d.phone || '-', Message: d.message});
      try { const a = JSON.parse(localStorage.getItem(ORD_KEY) || '[]'); a.unshift({...d, id: Date.now(), date: new Date().toLocaleString('en-IN', {timeZone: 'Asia/Kolkata'}), kind: 'enquiry'}); localStorage.setItem(ORD_KEY, JSON.stringify(a.slice(0, 100))); } catch (er) {}
      window.open(waLink('Hi, I am ' + d.name + '.\n' + d.message), '_blank', 'noopener'); e.target.reset(); toast('Thanks! We\'ll reply soon.'); };
  });
  return '<section class="sec" style="padding-top:2rem"><div class="wrap split"><div><h1 style="font-size:clamp(2rem,4vw,3rem)">Contact us</h1><p class="lede" style="margin:1rem 0 1.4rem">Questions about a product, delivery or a custom piece? We usually reply within an hour during shop hours.</p><div class="info">' + contactBlocks() + '</div></div>' +
    '<form class="panel" id="qf" novalidate><h2 style="font-size:1.4rem;margin-bottom:1rem">Send a message</h2><div class="field"><label for="qName">Your name</label><input id="qName" name="name" autocomplete="name" required/></div><div class="field"><label for="qPhone">Phone (optional)</label><input id="qPhone" name="phone" type="tel" autocomplete="tel"/></div><div class="field"><label for="qMsg">Message</label><textarea id="qMsg" name="message" required></textarea></div><input class="hp" name="_honey" tabindex="-1" autocomplete="off" aria-hidden="true"/><button class="btn btn-wa" style="width:100%">' + I.wa + 'Send on WhatsApp</button></form></div></section>';
}
function thanks(){
  return '<section class="sec"><div class="wrap" style="max-width:640px;text-align:center"><h1 style="font-size:2.4rem">Thank you!</h1><p class="lede" style="margin:1rem auto 1.6rem">WhatsApp should have opened with your details. Tap <b>Send</b> there, and we\'ll confirm the price and delivery date shortly. If WhatsApp didn\'t open, call us on <a class="link" href="tel:' + esc(S.phone) + '">' + esc(S.phone) + '</a>.</p><a class="btn btn-primary" href="#/shop">Continue shopping</a></div></section>';
}

/* a copy of every order/enquiry by email (FormSubmit — needs a one-time activation click in the inbox) */
function emailCopy(subject, fields){
  if (!S.email) return;
  fetch('https://formsubmit.co/ajax/' + S.email, {method: 'POST', headers: {'Content-Type': 'application/json', Accept: 'application/json'},
    body: JSON.stringify({...fields, _subject: subject, _template: 'table', _captcha: 'false'})}).catch(() => {});
}

/* ── router ── */
function route(){
  const h = location.hash.replace(/^#\/?/, '').split('?')[0], [a, b] = h.split('/');
  document.title = S.name + ' — ' + (S.tagline || '');
  const html = !a ? home() : a === 'shop' ? shop(b) : a === 'p' ? product(b) : a === 'cart' ? cartPage() : a === 'custom' ? custom() : a === 'about' ? about() : a === 'services' ? services() : a === 'work' ? work() : a === 'contact' ? contact() : a === 'thanks' ? thanks() : home();
  $('app').innerHTML = html;
  document.querySelectorAll('nav.main a').forEach(x => x.classList.toggle('on', x.getAttribute('href') === '#/' + a));
  $('nav').classList.remove('open'); $('menuBtn').setAttribute('aria-expanded', false);
  window.scrollTo(0, 0);
}
window.addEventListener('hashchange', route);
$('menuBtn').onclick = () => { const o = $('nav').classList.toggle('open'); $('menuBtn').setAttribute('aria-expanded', o); };

(async () => {
  try { [S, CATS, PRODUCTS] = await Promise.all(['settings.json', 'categories.json', 'products.json'].map(get)); }
  catch (e) { $('app').innerHTML = '<section class="sec"><div class="wrap"><div class="empty">The shop couldn\'t load. Check your connection and refresh the page.</div></div></section>'; return; }
  QUOTES = await get('testimonials.json').catch(() => []);
  WORK = (await get('projects.json').catch(() => [])).sort((a, b) => (a.order || 99) - (b.order || 99));
  CATS.sort((a, b) => (a.order || 99) - (b.order || 99)); PRODUCTS.sort((a, b) => (a.order || 99) - (b.order || 99));
  PRODUCTS = PRODUCTS.filter(p => p.visible !== false);
  $('brandName').textContent = S.short || S.name; $('fName').textContent = S.name; $('fTag').textContent = S.tagline || '';
  $('topNote').textContent = S.top_note || ''; $('topNote').hidden = !S.top_note;
  $('fModes').innerHTML = (S.work_modes || []).map(m => '<li>' + I.shield + esc(m.title) + '</li>').join('');
  $('fCats').innerHTML = CATS.filter(c => PRODUCTS.some(p => p.category === c.slug)).map(c => '<a href="#/shop/' + esc(c.slug) + '">' + esc(c.name) + '</a>').join('');
  const locs = (S.locations && S.locations.length ? S.locations : [S.address]).filter(Boolean);
  $('fContact').innerHTML = (S.phone ? '<li><a href="tel:+91' + esc(String(S.phone).replace(/\D/g, '').slice(-10)) + '">' + I.phone + '<span>+91 ' + esc(S.phone) + '</span></a></li>' : '') +
    (S.email ? '<li><a href="mailto:' + esc(S.email) + '">' + I.mail + '<span>' + esc(S.email) + '</span></a></li>' : '') +
    (S.hours ? '<li>' + I.clock + '<span>' + esc(S.hours) + '</span></li>' : '') +
    locs.map(l => '<li><a href="https://maps.google.com/?q=' + encodeURIComponent(l) + '" target="_blank" rel="noopener">' + I.pin + '<span>' + esc(l) + '</span></a></li>').join('');
  $('fWa').href = waLink('Hi, I want a quote for interior / furniture work.');
  $('fCall').href = 'tel:+91' + String(S.phone || '').replace(/\D/g, '').slice(-10); $('fCall').hidden = !S.phone;
  $('fCopy').textContent = '© ' + new Date().getFullYear() + ' ' + S.name + '. All rights reserved.';
  $('fAreas').textContent = 'Serving ' + locs.map(l => l.split(',')[0].replace(/\s*\(.*\)/, '')).join(' · ');
  $('waFab').href = waLink('Hi, I have a question about your furniture.');
  badge(); route();
})();
})();
