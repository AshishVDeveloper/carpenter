/* Banners (data/banners.json): the slides at the top of the home page.
   { auto, interval (seconds), random, items: [{ id, order, visible, image, alt, kicker, title, text, btn, link, btn2, link2 }] } */
const BN_DEF = () => ({ fx: 'pan', auto: true, interval: 6, random: false, items: [] });
const BN_LINKS = [['/get-quote/', 'Get a quote form'], ['/services/', 'All services'], ['/furniture/', 'Furniture'], ['/catalogue/', 'Catalogue'], ['/our-work/', 'Our work'], ['/blog/', 'Blog'], ['/contact/', 'Contact']];
const BN_IMGS = ['images/site/hero.webp', 'images/site/living.webp', 'images/site/bedroom.webp', 'images/site/open-plan.webp', 'images/site/home-interiors.webp', 'images/site/modular-kitchens.webp', 'images/site/kitchen-2.webp', 'images/site/office-interiors.webp', 'images/site/shops-showrooms.webp', 'images/site/mall-work.webp', 'images/site/furniture-to-measure.webp', 'images/site/workshop.webp'];
let BNE = null;
function bnData() { if (!DB.banners || Array.isArray(DB.banners) || typeof DB.banners !== 'object') DB.banners = BN_DEF(); DB.banners.items = DB.banners.items || []; return DB.banners; }
const bnSorted = () => bnData().items.slice().sort((a, b) => (a.order || 99) - (b.order || 99));
function bnRenumber() { bnSorted().forEach((b, i) => { b.order = i + 1; }); }

function pgBanners() {
  const B = bnData(), live = B.items.filter(b => b.visible !== false).length;
  C('<div class="msg info">These banners slide at the top of your home page. Add as many as you like — each one has its own photo, heading, text and buttons. Changes go live about 2 minutes after you press <b>Publish banners</b>.</div>' +
    '<div class="card"><h2>Slider settings</h2><div class="g3 bnset">' +
    '<div class="check"><input type="checkbox" id="bn_auto"' + (B.auto !== false ? ' checked' : '') + ' onchange="bnSet(\'auto\',this.checked)"/><label for="bn_auto">Slide automatically</label></div>' +
    '<div class="field"><label for="bn_int">Seconds on each banner</label><input id="bn_int" type="number" min="3" max="20" value="' + (B.interval || 6) + '" onchange="bnSet(\'interval\',Math.max(3,Math.min(20,+this.value||6)))"/></div>' +
    '<div class="field"><label for="bn_fx">Animation</label><select id="bn_fx" class="keep" onchange="bnSet(\'fx\',this.value)">' + [['pan', 'Pan — photo moves right to left (like a video)'], ['zoom', 'Slow zoom in'], ['fade', 'Simple fade']].map(o => '<option value="' + o[0] + '"' + ((B.fx || 'pan') === o[0] ? ' selected' : '') + '>' + o[1] + '</option>').join('') + '</select></div>' +
    '<div class="check"><input type="checkbox" id="bn_rand"' + (B.random ? ' checked' : '') + ' onchange="bnSet(\'random\',this.checked)"/><label for="bn_rand">Random order (a different banner first on each visit)</label></div></div>' +
    '<p class="hint">' + live + ' banner' + (live === 1 ? '' : 's') + ' shown on the website. The slider pauses while a visitor points at it or taps it, and visitors can pause it.</p></div>' +
    '<div class="card"><h2>Banners <a class="btn sm pri" data-perm="banners.add" href="#banners/new">Add banner</a></h2>' +
    '<div class="tw"><table><thead><tr><th class="sr">Sr.</th><th>Photo</th><th>Heading</th><th class="hide-m">Buttons</th><th class="hide-m">Status</th><th><span hidden>Actions</span></th></tr></thead><tbody id="bnRows"></tbody></table></div></div>' + saveBar('banners'));
  drawBanners();
}
function bnSet(k, v) { bnData()[k] = v; markDirty('banners'); }
function drawBanners() {
  const L = bnSorted(), pg = pageOf('banners', L, '');
  $('bnRows').innerHTML = L.length ? pg.rows.map((b, j) => { const i = pg.from + j;
    return '<tr>' + sr(pg, j) + '<td style="width:150px"><img class="bnth" src="' + esc(smallUrl(b.image)) + '" alt="" onerror="this.onerror=null;this.src=\'/' + esc(b.image) + '\'"/></td>' +
      '<td><div class="t">' + esc(b.title) + '</div><div class="s">' + esc(b.kicker || '') + '</div></td>' +
      '<td class="hide-m"><div class="s">' + [b.btn && b.btn + ' → ' + b.link, b.btn2 && b.btn2 + ' → ' + b.link2].filter(Boolean).map(esc).join('<br>') + '</div></td>' +
      '<td class="hide-m">' + (b.visible === false ? '<span class="pill warn">Hidden</span>' : '<span class="pill ok">Shown</span>') + '</td>' +
      '<td><div class="acts-cell"><button class="btn sm" data-perm="banners.edit" title="Move up" aria-label="Move ' + esc(b.title) + ' up" onclick="bnMove(' + b.id + ',-1)"' + (i ? '' : ' disabled') + '>▲</button><button class="btn sm" data-perm="banners.edit" title="Move down" aria-label="Move ' + esc(b.title) + ' down" onclick="bnMove(' + b.id + ',1)"' + (i < L.length - 1 ? '' : ' disabled') + '>▼</button>' +
      '<button class="btn sm" data-perm="banners.edit" onclick="bnToggle(' + b.id + ')">' + (b.visible === false ? 'Show' : 'Hide') + '</button><a class="btn sm" href="#banners/' + b.id + '">' + (can('banners', 'edit') ? 'Edit' : 'Open') + '</a><button class="btn sm danger" data-perm="banners.delete" onclick="bnDel(' + b.id + ')">Delete</button></div></td></tr>'; }).join('')
    : '<tr><td colspan="6" class="empty">No banners yet. Press <b>Add banner</b>. Until you add one, the website shows the standard banner.</td></tr>';
  pgMount($('bnRows'), pg, 'drawBanners'); applyPerms();
}
function bnMove(id, d) { const L = bnSorted(), i = L.findIndex(b => b.id === id), j = i + d; if (j < 0 || j >= L.length) return; [L[i].order, L[j].order] = [L[j].order, L[i].order]; bnRenumber(); markDirty('banners'); drawBanners(); }
function bnToggle(id) { const b = bnData().items.find(x => x.id === id); b.visible = b.visible === false; markDirty('banners'); drawBanners(); toast(b.visible ? 'Banner will show after you publish.' : 'Banner hidden after you publish.'); }
async function bnDel(id) { const B = bnData(), b = B.items.find(x => x.id === id); if (!await confirmBox('Delete banner?', 'Delete "' + b.title + '"? It leaves the home page after you publish.')) return; B.items = B.items.filter(x => x.id !== id); bnRenumber(); markDirty('banners'); drawBanners(); }

function pgBanner(id) {
  const B = bnData(), isNew = id === 'new', src0 = isNew ? { visible: true, image: '', alt: '', kicker: '', title: '', text: '', btn: 'Get a free estimate', link: '/get-quote/', btn2: '', link2: '' } : B.items.find(x => String(x.id) === id);
  if (!src0) { location.hash = 'banners'; return; }
  BNE = JSON.parse(JSON.stringify(src0)); BNE._id = id; IMGS = BNE.image ? [BNE.image] : [];
  $('pTitle').textContent = isNew ? 'Add banner' : 'Edit banner';
  const f = (k, l, ph, hint, area) => '<div class="field"><label for="bn_' + k + '">' + l + '</label>' + (area ? '<textarea id="bn_' + k + '" data-k="' + k + '" rows="2" placeholder="' + esc(ph) + '">' + esc(BNE[k] || '') + '</textarea>' : '<input id="bn_' + k + '" data-k="' + k + '" value="' + esc(BNE[k] || '') + '" placeholder="' + esc(ph) + '"' + (/link/.test(k) ? ' list="bnLinks"' : '') + '/>') + (hint ? '<div class="hint">' + hint + '</div>' : '') + '</div>';
  C('<form class="card" id="bnf" onsubmit="bnSave(event)" novalidate><h2>Preview</h2><div class="bnprev" id="bnPrev"></div>' +
    '<h2 style="margin-top:1.4rem">Photo</h2><div class="imgs" id="imgs"></div>' + UPL() + '<p class="hint">Use a wide photo (landscape), at least 1600 pixels wide. Only one photo is used — a new upload replaces the old one. Or pick one of your website photos:</p><div class="bnpick">' + BN_IMGS.map(s => '<button type="button" class="keep" onclick="bnPick(\'' + s + '\')"><img src="/' + s.replace(/\.webp$/, '-xs.webp') + '" alt="' + esc(s.split('/').pop()) + '"/></button>').join('') + '</div>' +
    '<h2 style="margin-top:1.4rem">Text</h2><div class="g2">' + f('kicker', 'Small line above the heading', 'e.g. Modular kitchens') + f('title', 'Heading', 'e.g. Kitchens made to your wall size', 'Keep it short — about 4 to 10 words.') + '</div>' +
    f('text', 'Text under the heading', 'One or two short sentences.', '', 1) + f('alt', 'Photo description (for Google and blind visitors)', 'e.g. Modular kitchen with wooden shutters') +
    '<h2 style="margin-top:1.4rem">Buttons</h2><div class="g2">' + f('btn', 'Main button text', 'e.g. Get a free estimate') + f('link', 'Main button opens', '/get-quote/', 'A page of your website (pick from the list) or a full https:// link.') + f('btn2', 'Second button text (optional)', 'e.g. See designs') + f('link2', 'Second button opens', '/catalogue/') + '</div>' +
    '<datalist id="bnLinks">' + BN_LINKS.concat((DB.settings && DB.settings.services || []).map(s => ['/services/' + (s.slug || slugify(s.title)) + '/', s.title])).map(l => '<option value="' + esc(l[0]) + '">' + esc(l[1]) + '</option>').join('') + '</datalist>' +
    '<div class="check"><input type="checkbox" id="bn_vis"' + (BNE.visible !== false ? ' checked' : '') + '/><label for="bn_vis">Show this banner on the website</label></div>' +
    '<div class="bar"><a class="btn" href="#banners">Cancel</a><button class="btn pri">' + (isNew ? 'Add banner' : 'Save banner') + '</button></div></form>');
  $('bnf').oninput = e => { const k = e.target.dataset.k; if (k) { BNE[k] = e.target.value; bnPrev(); } };
  drawImgs(); bindUpl(() => $('bn_title').value || 'banner', 'banner'); bnPrev();
  /* one photo per banner: keep only the newest */
  const di = window.drawImgs; window.drawImgs = function () { if (IMGS.length > 1) IMGS.splice(0, IMGS.length - 1); BNE.image = IMGS[0] || ''; di(); bnPrev(); };
  window.addEventListener('hashchange', () => { window.drawImgs = di; }, { once: true });
}
function bnPick(s) { IMGS.splice(0, IMGS.length, s); drawImgs(); }
function bnPrev() {
  const b = BNE, el = $('bnPrev'); if (!el) return; const img = (IMGS[0] && (PREV[IMGS[0]] || '/' + IMGS[0])) || '';
  el.innerHTML = '<div class="bnhero"' + (img ? ' style="background-image:url(\'' + esc(img) + '\')"' : '') + '><div class="bnin">' + (b.kicker ? '<p class="k">' + esc(b.kicker) + '</p>' : '') + '<p class="h">' + esc(b.title || 'Your heading') + '</p>' + (b.text ? '<p class="t">' + esc(b.text) + '</p>' : '') +
    '<div class="b">' + (b.btn ? '<span class="b1">' + esc(b.btn) + '</span>' : '') + (b.btn2 ? '<span class="b2">' + esc(b.btn2) + '</span>' : '') + '</div></div>' + (img ? '' : '<span class="noimg">Add a photo</span>') + '</div>';
}
function bnSave(e) {
  e.preventDefault(); const B = bnData(), v = k => ($('bn_' + k).value || '').trim();
  const d = { image: IMGS[0] || '', alt: v('alt'), kicker: v('kicker'), title: v('title'), text: v('text'), btn: v('btn'), link: v('link'), btn2: v('btn2'), link2: v('link2'), visible: $('bn_vis').checked };
  if (!d.image) { toast('Add a photo for the banner.', true); return; } if (!d.title) { toast('Write a heading.', true); $('bn_title').focus(); return; }
  for (const [t, l] of [['btn', 'link'], ['btn2', 'link2']]) { if (d[t] && !d[l]) { toast('Choose where the "' + d[t] + '" button opens.', true); $('bn_' + l).focus(); return; } if (d[l] && !/^(\/|https:\/\/|tel:|mailto:)/.test(d[l])) { toast('A button link must start with / or https://', true); $('bn_' + l).focus(); return; } }
  if (!d.alt) d.alt = d.title;
  if (BNE._id === 'new') { B.items.push({ id: nextId(B.items), order: B.items.length + 1, ...d }); } else Object.assign(B.items.find(x => String(x.id) === BNE._id), d);
  bnRenumber(); markDirty('banners'); toast('Saved. Press Publish banners to put it on the website.'); location.hash = 'banners';
}
