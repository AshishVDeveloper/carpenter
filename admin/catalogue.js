/* Catalogue master (data/catalogue.json).
   Enter the sizes of a design → its structure drawing is made by /assets/structure.js (VS.gen).
   The drawing can then be edited like a design tool: select, move, resize, add boxes, lines, text, circles and size lines,
   change colours, undo/redo, zoom, download as SVG or PNG. Everything runs here in the browser — no outside service. */
let CQ = '', CT = '', CITEM = null, ED = null;
const cimg = c => (c.images || [])[0] || (((DB.products || []).find(p => String(p.id) === String(c.product_id)) || {}).images || [])[0];
const cEst = c => { const a = VS.area(c.type, c.p || {}); return +c.rate > 0 ? Math.round(a * c.rate / 100) * 100 : 0; };

function pgCatalogue() {
  DB.catalogue = DB.catalogue || [];
  C('<div class="msg info">Enter the sizes of a design and its structure drawing is made automatically. You can then change anything in the drawing. The website shows every design with its photo, drawing and sizes at <a href="/catalogue/" target="_blank" rel="noopener">/catalogue/</a>.</div>' +
    '<div class="card"><h2>Catalogue <a class="btn sm pri" data-perm="catalogue.add" href="#catalogue/new">Add design</a></h2>' +
    '<div class="tools"><input type="search" placeholder="Search name" aria-label="Search catalogue" value="' + esc(CQ) + '" oninput="CQ=this.value;drawCat()"/>' +
    '<select class="keep" aria-label="Type" onchange="CT=this.value;drawCat()"><option value="">All types</option>' + Object.entries(VS.TYPES).map(([k, t]) => '<option value="' + k + '"' + (CT === k ? ' selected' : '') + '>' + esc(t.name) + '</option>').join('') + '</select></div>' +
    '<div class="tw"><table><thead><tr><th class="sr">Sr.</th><th>Photo and drawing</th><th>Design</th><th class="hide-m">Size</th><th class="hide-m">Estimate</th><th><span hidden>Actions</span></th></tr></thead><tbody id="cRows"></tbody></table></div></div>' + saveBar('catalogue'));
  drawCat();
}
function drawCat() {
  const q = CQ.toLowerCase(), L = (DB.catalogue || []).map((c, i) => [c, i]).filter(([c]) => (!CT || c.type === CT) && (!q || String(c.name).toLowerCase().includes(q))).sort((a, b) => (a[0].order || 999) - (b[0].order || 999));
  const pg = pageOf('catalogue', L, q + '|' + CT);
  $('cRows').innerHTML = L.length ? pg.rows.map(([c, i], j) => { const img = cimg(c), est = cEst(c);
    return '<tr>' + sr(pg, j) + '<td style="width:170px"><div class="cthumbs">' + (img ? '<img class="th" src="' + esc(smallUrl(img)) + '" alt=""/>' : '') + '<span class="cth">' + VS.svg(VS.docOf(c, 1), {}) + '</span></div></td>' +
      '<td><div class="t">' + esc(c.name) + (c.visible === false ? ' <span class="pill warn">Hidden</span>' : '') + (c.drawing ? ' <span class="pill">Edited drawing</span>' : '') + '</div><div class="s">' + esc((VS.TYPES[c.type] || {}).name || c.type) + '</div></td>' +
      '<td class="hide-m">' + esc(VS.sizeText(c.type, c.p || {})) + '<div class="s">' + VS.area(c.type, c.p || {}) + ' sq ft</div></td><td class="hide-m">' + (est ? money(est) : '—') + '</td>' +
      '<td><div class="acts-cell"><a class="btn sm" href="/catalogue/' + esc(c.slug || VI.slugify(c.name)) + '/" target="_blank" rel="noopener">View</a><a class="btn sm" href="#catalogue/' + c.id + '">' + (can('catalogue', 'edit') ? 'Edit' : 'Open') + '</a><button class="btn sm" data-perm="catalogue.add" onclick="dupCat(' + i + ')">Copy</button><button class="btn sm danger" data-perm="catalogue.delete" onclick="delCat(' + i + ')">Delete</button></div></td></tr>'; }).join('')
    : '<tr><td colspan="6" class="empty">No designs match. Press <b>Add design</b>.</td></tr>';
  pgMount($('cRows'), pg, 'drawCat'); applyPerms();
}
function catSlug(name, id) { let s = VI.slugify(name) || 'design', n = 2; const used = new Set((DB.catalogue || []).filter(c => String(c.id) !== String(id)).map(c => c.slug)); const b = s; while (used.has(s)) s = b + '-' + n++; return s; }
function dupCat(i) { const c = JSON.parse(JSON.stringify(DB.catalogue[i])); c.id = nextId(DB.catalogue); c.name += ' (copy)'; c.slug = catSlug(c.name, c.id); DB.catalogue.unshift(c); renumber(DB.catalogue); markDirty('catalogue'); toast('Copied. Open it to change the sizes.'); location.hash = 'catalogue/' + c.id; }
async function delCat(i) { const c = DB.catalogue[i]; if (!await confirmBox('Delete design?', 'Delete "' + c.name + '" from the catalogue? The website page goes away after you publish.')) return; DB.catalogue.splice(i, 1); renumber(DB.catalogue); markDirty('catalogue'); drawCat(); toast('Deleted. Publish to update the website.'); }

/* ── one design: details, sizes, drawing editor, photos ── */
function pgCatItem(id) {
  DB.catalogue = DB.catalogue || [];
  const isNew = id === 'new', src = isNew ? { name: '', type: 'wardrobe', p: {}, images: [], product_id: null, rate: 1600, material: '', finish: '', notes: '', visible: true, drawing: null } : DB.catalogue.find(x => String(x.id) === id);
  if (!src) { location.hash = 'catalogue'; return; }
  CITEM = JSON.parse(JSON.stringify(src)); CITEM._id = id; CITEM.p = VS.params(CITEM.type, CITEM.p || {}); IMGS = [...(CITEM.images || [])];
  $('pTitle').textContent = isNew ? 'Add design' : 'Edit design';
  C('<form class="card cform" id="cf" onsubmit="saveCat(event)" novalidate>' +
    '<div class="g2"><div class="field"><label for="c_name">Design name</label><input id="c_name" required value="' + esc(CITEM.name) + '" placeholder="e.g. 3-door wardrobe with loft" oninput="CITEM.name=this.value;catChanged(1)"/></div>' +
    '<div class="field"><label for="c_type">Type</label><select id="c_type" onchange="catSetType(this.value)">' + Object.entries(VS.TYPES).map(([k, t]) => '<option value="' + k + '"' + (k === CITEM.type ? ' selected' : '') + '>' + esc(t.name) + '</option>').join('') + '</select></div></div>' +
    '<h2>Sizes <span class="hint" style="font-weight:500">Feet and inches. The drawing updates as you type.</span></h2><div class="csizes" id="cSizes"></div>' +
    '<h2 style="margin-top:1.2rem">Structure drawing</h2><div id="cStale"></div><div id="ced"></div>' +
    '<h2 style="margin-top:1.4rem">Price and details</h2><div class="g2">' +
    '<div class="field"><label for="c_rate">Rate per sq ft with material (₹)</label><input id="c_rate" type="number" min="0" value="' + esc(CITEM.rate || '') + '" oninput="CITEM.rate=+this.value||0;catEst()"/><div class="hint" id="cEst"></div></div>' +
    '<div class="field"><label for="c_prod">Linked product (optional)</label><select id="c_prod" onchange="CITEM.product_id=this.value?+this.value:null;drawImgs()"><option value="">None</option>' + (DB.products || []).map(p => '<option value="' + p.id + '"' + (String(p.id) === String(CITEM.product_id) ? ' selected' : '') + '>' + esc(p.name) + '</option>').join('') + '</select><div class="hint">The product page then shows this drawing. Its photos are used if you add none here.</div></div>' +
    '<div class="field"><label for="c_mat">Material</label><input id="c_mat" value="' + esc(CITEM.material || '') + '" placeholder="e.g. Semi-marine plywood"/></div>' +
    '<div class="field"><label for="c_fin">Finish</label><input id="c_fin" value="' + esc(CITEM.finish || '') + '" placeholder="e.g. White laminate inside, wood-finish outside"/></div></div>' +
    '<div class="field"><label for="c_notes">Notes for customers (optional)</label><textarea id="c_notes" style="min-height:70px">' + esc(CITEM.notes || '') + '</textarea></div>' +
    '<div class="check"><input type="checkbox" id="c_vis"' + (CITEM.visible !== false ? ' checked' : '') + '/><label for="c_vis">Show on the website</label></div>' +
    '<h2 style="margin-top:1.4rem">Photos <span class="hint" id="imgCount" style="font-weight:500"></span></h2><div class="imgs" id="imgs"></div>' + UPL() +
    '<div class="bar"><a class="btn" href="#catalogue">Cancel</a><button class="btn pri">' + (isNew ? 'Add design' : 'Save design') + '</button></div></form>');
  drawSizes(); edInit($('ced')); catEst(); drawImgs(); bindUpl(() => $('c_name').value || 'design', 'design');
}
function catEst() { const a = VS.area(CITEM.type, CITEM.p), e = +CITEM.rate > 0 ? Math.round(a * CITEM.rate / 100) * 100 : 0, el = $('cEst'); if (el) el.textContent = a + ' sq ft' + (e ? ' × ' + money(CITEM.rate) + ' = estimate ' + money(e) : ''); }
function catSetType(t) {
  if (CITEM.drawing && !confirm('Changing the type makes a new drawing and replaces your edits. Continue?')) { $('c_type').value = CITEM.type; return; }
  const keep = {}; ['W', 'H', 'D', 'color', 'wood'].forEach(k => { if (CITEM.p[k] !== undefined) keep[k] = CITEM.p[k]; });
  CITEM.type = t; CITEM.p = VS.params(t, keep); CITEM.drawing = null; drawSizes(); catChanged(); catEst();
}
function drawSizes() {
  const T0 = VS.TYPES[CITEM.type], p = CITEM.p;
  $('cSizes').innerHTML = T0.fields.map(f => {
    const id = 'cs_' + f.key, v = p[f.key];
    if (f.kind === 'len') { const ft = Math.floor(v / 12), inch = Math.round((v - ft * 12) * 2) / 2;
      return '<div class="field cs-len"><label for="' + id + '">' + esc(f.label) + '</label><div class="ftin"><input id="' + id + '" type="number" min="0" step="1" inputmode="numeric" data-k="' + f.key + '" data-u="ft" value="' + ft + '" aria-label="' + esc(f.label) + ' feet"/><span>ft</span><input type="number" min="0" max="11.5" step="0.5" inputmode="decimal" data-k="' + f.key + '" data-u="in" value="' + inch + '" aria-label="' + esc(f.label) + ' inches"/><span>in</span></div><div class="hint" data-tot="' + f.key + '">' + VS.ftin(v) + ' = ' + v + ' in</div></div>'; }
    if (f.kind === 'int') return '<div class="field"><label for="' + id + '">' + esc(f.label) + '</label><input id="' + id + '" type="number" min="' + f.min + '" max="' + f.max + '" data-k="' + f.key + '" value="' + v + '"/></div>';
    if (f.kind === 'bool') return '<div class="check cs-bool"><input type="checkbox" id="' + id + '" data-k="' + f.key + '"' + (v ? ' checked' : '') + '/><label for="' + id + '">' + esc(f.label) + '</label></div>';
    if (f.kind === 'text') return '<div class="field cs-text"><label for="' + id + '">' + esc(f.label) + '</label><input id="' + id + '" type="text" maxlength="60" data-k="' + f.key + '" value="' + esc(v) + '"/></div>';
    if (f.kind === 'sel') return '<div class="field"><label for="' + id + '">' + esc(f.label) + '</label><select id="' + id + '" class="keep" data-k="' + f.key + '">' + f.opts.map(o => '<option value="' + o[0] + '"' + (o[0] === v ? ' selected' : '') + '>' + esc(o[1]) + '</option>').join('') + '</select></div>';
    return '<div class="field cs-col"><label for="' + id + '">' + esc(f.label) + '</label><input id="' + id + '" type="color" data-k="' + f.key + '" value="' + esc(/^#[0-9a-f]{6}$/i.test(v) ? v : '#ffffff') + '"/></div>';
  }).join('');
  const box = $('cSizes');
  box.oninput = box.onchange = e => { const el = e.target, k = el.dataset.k; if (!k) return; const f = T0.fields.find(x => x.key === k);
    if (f.kind === 'len') { const ins = box.querySelectorAll('[data-k="' + k + '"]'), v = (+ins[0].value || 0) * 12 + (+ins[1].value || 0); p[k] = v; const t = box.querySelector('[data-tot="' + k + '"]'); if (t) t.textContent = VS.ftin(v) + ' = ' + v + ' in'; }
    else if (f.kind === 'int') p[k] = +el.value || 0; else if (f.kind === 'text') p[k] = el.value; else if (f.kind === 'bool') p[k] = el.checked; else p[k] = el.value;
    clearTimeout(box._t); box._t = setTimeout(() => { catChanged(); catEst(); }, 120); };
}
/* sizes changed: a drawing nobody edited is simply made again; an edited one asks first */
function catChanged(nameOnly) {
  if (!ED) return; const sig = JSON.stringify([CITEM.type, CITEM.p, CITEM.name]); if (sig === ED.sig) return; ED.sig = sig;
  if (!CITEM.drawing) { edLoad(VS.gen(CITEM.type, CITEM.p, CITEM.name), true, true); $('cStale').innerHTML = ''; return; }
  if (!nameOnly) $('cStale').innerHTML = '<div class="msg warn">You changed the sizes, but this drawing has your own edits. <button type="button" class="btn sm" onclick="catRegen()">Make the drawing again from the sizes</button> <span class="hint">This replaces your edits.</span></div>';
}
function catRegen() { ED.sig = JSON.stringify([CITEM.type, CITEM.p, CITEM.name]); CITEM.drawing = null; $('cStale').innerHTML = ''; edLoad(VS.gen(CITEM.type, CITEM.p, CITEM.name), true, true); toast('Drawing made again from the sizes.'); }
function saveCat(e) {
  e.preventDefault(); const name = $('c_name').value.trim(); if (!name) { toast('Give the design a name.', true); $('c_name').focus(); return; }
  const id = CITEM._id, isNew = id === 'new';
  const d = { name, slug: catSlug(name, isNew ? -1 : id), type: CITEM.type, p: VS.params(CITEM.type, CITEM.p), images: [...IMGS], product_id: CITEM.product_id || null, rate: +$('c_rate').value || 0,
    material: $('c_mat').value.trim(), finish: $('c_fin').value.trim(), notes: $('c_notes').value.trim(), visible: $('c_vis').checked, drawing: CITEM.drawing ? { fs: ED.doc.fs, els: ED.doc.els } : null };
  if (isNew) { DB.catalogue.unshift({ id: nextId(DB.catalogue), order: 1, ...d }); renumber(DB.catalogue); } else Object.assign(DB.catalogue.find(x => String(x.id) === id), d);
  markDirty('catalogue'); toast('Saved. Press Publish catalogue to put it on the website.'); location.hash = 'catalogue';
}

/* ── drawing editor ── */
const ED_TOOLS = [['select', 'Select and move (V)', '<path d="M5 3l14 8-6 2-3 6z"/>'], ['rect', 'Box (R)', '<rect x="4" y="5" width="16" height="14" rx="1"/>'], ['line', 'Line (L)', '<path d="M5 19 19 5"/>'], ['dim', 'Size line (M)', '<path d="M3 12h18M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3M3 7v10M21 7v10"/>'], ['text', 'Text (T)', '<path d="M5 6V4h14v2M12 4v16M9 20h6"/>'], ['circle', 'Circle (C)', '<circle cx="12" cy="12" r="8"/>']];
const ED_ACTS = [['undo', 'Undo (Ctrl+Z)', '<path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>'], ['redo', 'Redo (Ctrl+Y)', '<path d="m15 14 5-5-5-5"/><path d="M20 9H10a6 6 0 0 0 0 12h3"/>'], ['|'], ['dup', 'Copy (Ctrl+D)', '<rect x="8" y="8" width="12" height="12" rx="1"/><path d="M4 16V5a1 1 0 0 1 1-1h11"/>'], ['del', 'Delete (Del)', '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>'], ['front', 'Bring to front', '<rect x="8" y="8" width="12" height="12" fill="currentColor"/><path d="M4 16V4h12"/>'], ['back', 'Send to back', '<rect x="4" y="4" width="12" height="12" fill="currentColor"/><path d="M20 8v12H8"/>'], ['|'], ['zout', 'Zoom out', '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4M8 11h6"/>'], ['fit', 'Fit to screen', '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>'], ['zin', 'Zoom in', '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4M8 11h6M11 8v6"/>'], ['snap', 'Snap to ½ inch', '<path d="M4 4h16v16H4zM4 10h16M4 16h16M10 4v16M16 4v16"/>'], ['|'], ['auto', 'Make again from sizes', '<path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/>'], ['svg', 'Download SVG', '<path d="M12 3v12M7 10l5 5 5-5M4 20h16"/>'], ['png', 'Download picture (PNG)', '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 17-5-5-9 8"/>']];
const ico = d => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>';
const ED_NAMES = { rect: 'Box', line: 'Line', text: 'Text', dim: 'Size line', circle: 'Circle', poly: 'Shape' };

function edInit(host) {
  host.innerHTML = '<div class="ed"><div class="edbar" role="toolbar" aria-label="Drawing tools">' +
    ED_TOOLS.map(t => '<button type="button" class="keep" data-tool="' + t[0] + '" title="' + t[1] + '" aria-label="' + t[1] + '">' + ico(t[2]) + '</button>').join('') + '<i></i>' +
    ED_ACTS.map(a => a[0] === '|' ? '<i></i>' : '<button type="button" class="keep" data-act="' + a[0] + '" title="' + a[1] + '" aria-label="' + a[1] + '">' + ico(a[2]) + '</button>').join('') +
    '<span class="edzoom" id="edZoom">100%</span><span class="edstate" id="edState"></span></div>' +
    '<div class="edwrap"><div class="edstage" id="edStage" tabindex="0" aria-label="Drawing. Click a shape to select it; drag to move it."></div><aside class="edprops" id="edProps" aria-label="Selected shape"></aside></div></div>';
  ED = { doc: null, sel: -1, hist: [], fut: [], tool: 'select', zoom: 1, snap: true, box: null, base: !CITEM.drawing, drag: null };
  edLoad(CITEM.drawing || VS.gen(CITEM.type, CITEM.p, CITEM.name), true, !CITEM.drawing); ED.sig = JSON.stringify([CITEM.type, CITEM.p, CITEM.name]);
  host.querySelector('.edbar').onclick = e => { const t = e.target.closest('[data-tool]'), a = e.target.closest('[data-act]'); if (t) { ED.tool = t.dataset.tool; edRender(); } if (a) edAct(a.dataset.act); };
  const st = $('edStage');
  st.addEventListener('pointerdown', edDown); st.addEventListener('pointermove', edMove); st.addEventListener('pointerup', edUp); st.addEventListener('pointercancel', edUp);
  st.addEventListener('dblclick', e => { const g = e.target.closest('[data-i]'); if (g && ED.doc.els[+g.dataset.i].t === 'text') { ED.sel = +g.dataset.i; edRender(); const ta = $('edProps').querySelector('textarea'); if (ta) { ta.focus(); ta.select(); } } });
  st.addEventListener('wheel', e => { if (!e.ctrlKey) return; e.preventDefault(); edZoom(e.deltaY < 0 ? 1.15 : 1 / 1.15); }, { passive: false });
}
function edLoad(doc, resetHist, base) {
  ED.doc = JSON.parse(JSON.stringify(doc)); ED.sel = -1;
  if (resetHist) { ED.hist = []; ED.fut = []; ED.base = !!base; }
  ED.box = edFit(); edRender();
}
function edFit() { const b = VS.bbox(ED.doc.els), m = Math.max(b.x2 - b.x1, b.y2 - b.y1) * .06; return { x1: b.x1 - m, y1: b.y1 - m, x2: b.x2 + m, y2: b.y2 + m }; }
function edGrow() { const b = VS.bbox(ED.doc.els), o = ED.box, m = (ED.doc.fs || 4) * 2; ED.box = { x1: Math.min(o.x1, b.x1 - m), y1: Math.min(o.y1, b.y1 - m), x2: Math.max(o.x2, b.x2 + m), y2: Math.max(o.y2, b.y2 + m) }; }
/* the drawing counts as "edited" once anything was changed by hand; then it is saved with the design */
function edSync() { CITEM.drawing = (ED.hist.length || !ED.base) ? ED.doc : null; const s = $('edState'); if (s) s.innerHTML = CITEM.drawing ? '<span class="pill">Edited</span>' : '<span class="pill ok">Automatic</span>'; }
function edSnap(v) { return ED.snap ? Math.round(v * 2) / 2 : Math.round(v * 100) / 100; }
function edPt(e) { const s = $('edStage').querySelector('svg'), p = s.createSVGPoint(); p.x = e.clientX; p.y = e.clientY; const q = p.matrixTransform(s.getScreenCTM().inverse()); return { x: q.x, y: q.y }; }
function edScale() { const s = $('edStage').querySelector('svg'); if (!s) return 1; const vb = s.viewBox.baseVal; return s.getBoundingClientRect().width / (vb.width || 1); }

function edRender(skipProps) {
  const st = $('edStage'); if (!st) return;
  const k = 1 / edScale() || .2, hs = 8 * k, e = ED.doc.els[ED.sel]; let over = '';
  if (e) {
    const b = VS.ebox(e), sw = 1.2 * k;
    over = '<g pointer-events="none"><rect x="' + b[0] + '" y="' + b[1] + '" width="' + Math.max(0, b[2] - b[0]) + '" height="' + Math.max(0, b[3] - b[1]) + '" fill="none" stroke="#2563eb" stroke-width="' + sw + '" stroke-dasharray="' + 4 * k + ' ' + 3 * k + '"/></g>';
    const H = (n, x, y, cur) => '<rect data-h="' + n + '" x="' + (x - hs / 2) + '" y="' + (y - hs / 2) + '" width="' + hs + '" height="' + hs + '" rx="' + hs * .2 + '" fill="#fff" stroke="#2563eb" stroke-width="' + sw + '" style="cursor:' + cur + '"/>';
    if (e.t === 'line' || e.t === 'dim') { over += H('p1', e.x1, e.y1, 'move') + H('p2', e.x2, e.y2, 'move'); if (e.t === 'dim') { const g = VS.dimGeo(e); over += '<circle data-h="off" cx="' + (g.a[0] + g.b[0]) / 2 + '" cy="' + (g.a[1] + g.b[1]) / 2 + '" r="' + hs * .6 + '" fill="#2563eb" stroke="#fff" stroke-width="' + sw + '" style="cursor:ns-resize"/>'; } }
    else { const [x1, y1, x2, y2] = b, mx = (x1 + x2) / 2, my = (y1 + y2) / 2; over += H('nw', x1, y1, 'nwse-resize') + H('ne', x2, y1, 'nesw-resize') + H('sw', x1, y2, 'nesw-resize') + H('se', x2, y2, 'nwse-resize'); if (e.t !== 'text') over += H('n', mx, y1, 'ns-resize') + H('s', mx, y2, 'ns-resize') + H('w', x1, my, 'ew-resize') + H('e', x2, my, 'ew-resize'); }
  }
  const sx = st.scrollLeft, sy = st.scrollTop;
  st.innerHTML = VS.svg(ED.doc, { ed: 1, box: ED.box, cls: 'edsvg' + (ED.tool !== 'select' ? ' draw' : ''), after: over });
  st.querySelector('svg').style.width = (ED.zoom * 100) + '%'; st.scrollLeft = sx; st.scrollTop = sy;
  document.querySelectorAll('.edbar [data-tool]').forEach(b => b.setAttribute('aria-pressed', b.dataset.tool === ED.tool));
  const sn = document.querySelector('.edbar [data-act="snap"]'); if (sn) sn.setAttribute('aria-pressed', ED.snap);
  document.querySelectorAll('.edbar [data-act="dup"],.edbar [data-act="del"],.edbar [data-act="front"],.edbar [data-act="back"]').forEach(b => b.disabled = ED.sel < 0);
  const u = document.querySelector('.edbar [data-act="undo"]'), r = document.querySelector('.edbar [data-act="redo"]'); if (u) u.disabled = !ED.hist.length; if (r) r.disabled = !ED.fut.length;
  $('edZoom').textContent = Math.round(ED.zoom * 100) + '%'; edSync();
  if (!skipProps) edProps();
}
function edSave() { return JSON.stringify(ED.doc.els); }
function edPush(before) { if (before === edSave()) return; ED.hist.push(before); if (ED.hist.length > 100) ED.hist.shift(); ED.fut = []; }

function edDown(e) {
  if (e.button > 0) return;
  const pt = edPt(e), h = e.target.closest('[data-h]'), before = edSave(), fs = ED.doc.fs || 4;
  $('edStage').focus({ preventScroll: true });
  if (h && ED.sel >= 0) { const el = ED.doc.els[ED.sel]; ED.drag = { mode: 'h', h: h.dataset.h, start: pt, orig: JSON.parse(JSON.stringify(el)), ob: VS.ebox(el), before }; }
  else if (ED.tool !== 'select') {
    const x = edSnap(pt.x), y = edSnap(pt.y); let el, hh = 'se';
    if (ED.tool === 'rect') el = { t: 'rect', x, y, w: 0, h: 0, fill: '#f8f6f1', stroke: '#3a2a1c', sw: .45 };
    else if (ED.tool === 'circle') el = { t: 'circle', x, y, r: .25, fill: '#f8f6f1', stroke: '#3a2a1c', sw: .4 };
    else if (ED.tool === 'line') { el = { t: 'line', x1: x, y1: y, x2: x, y2: y, stroke: '#3a2a1c', sw: .5 }; hh = 'p2'; }
    else if (ED.tool === 'dim') { el = { t: 'dim', x1: x, y1: y, x2: x, y2: y, off: -fs * 2, size: fs, text: '', stroke: VS.NAVY }; hh = 'p2'; }
    else el = { t: 'text', x, y, text: 'Text', size: fs * 1.1, fill: '#3a2a1c', anchor: 'start' };
    ED.doc.els.push(el); ED.sel = ED.doc.els.length - 1;
    if (el.t === 'text') { edPush(before); ED.tool = 'select'; edRender(); const ta = $('edProps').querySelector('textarea'); if (ta) { ta.focus(); ta.select(); } return; }
    ED.drag = { mode: 'h', h: hh, start: pt, orig: JSON.parse(JSON.stringify(el)), ob: VS.ebox(el), before, isNew: 1 };
  } else {
    const g = e.target.closest('[data-i]');
    if (g) { ED.sel = +g.dataset.i; ED.drag = { mode: 'move', start: pt, orig: JSON.parse(JSON.stringify(ED.doc.els[ED.sel])), before }; } else ED.sel = -1;
  }
  if (ED.drag) { try { $('edStage').setPointerCapture(e.pointerId); } catch (x) { } e.preventDefault(); }
  edRender();
}
function edMove(e) {
  const d = ED.drag; if (!d) return; const pt = edPt(e), dx = edSnap(pt.x - d.start.x), dy = edSnap(pt.y - d.start.y), o = d.orig, el = ED.doc.els[ED.sel]; if (!el) return;
  if (d.mode === 'move') edShift(el, o, dx, dy);
  else if (d.h === 'p1' || d.h === 'p2') { const n = d.h === 'p1' ? 1 : 2; let x = edSnap(o['x' + n] + (pt.x - d.start.x)), y = edSnap(o['y' + n] + (pt.y - d.start.y));
    if (e.shiftKey) { const ox = o[n === 1 ? 'x2' : 'x1'], oy = o[n === 1 ? 'y2' : 'y1']; if (Math.abs(x - ox) > Math.abs(y - oy)) y = oy; else x = ox; }
    el['x' + n] = x; el['y' + n] = y; }
  else if (d.h === 'off') { const g = VS.dimGeo(o); el.off = edSnap((pt.x - o.x1) * g.nx + (pt.y - o.y1) * g.ny); }
  else { const nb = d.ob.slice(); if (d.h.includes('w')) nb[0] = edSnap(d.ob[0] + dx); if (d.h.includes('e')) nb[2] = edSnap(d.ob[2] + dx); if (d.h.includes('n')) nb[1] = edSnap(d.ob[1] + dy); if (d.h.includes('s')) nb[3] = edSnap(d.ob[3] + dy);
    if (nb[2] < nb[0]) [nb[0], nb[2]] = [nb[2], nb[0]]; if (nb[3] < nb[1]) [nb[1], nb[3]] = [nb[3], nb[1]];
    if (e.shiftKey && el.t !== 'text') { const s = Math.max((nb[2] - nb[0]) / ((d.ob[2] - d.ob[0]) || 1), (nb[3] - nb[1]) / ((d.ob[3] - d.ob[1]) || 1)); if (d.ob[2] > d.ob[0] && d.ob[3] > d.ob[1]) { nb[2] = nb[0] + (d.ob[2] - d.ob[0]) * s; nb[3] = nb[1] + (d.ob[3] - d.ob[1]) * s; } }
    edBox(el, o, d.ob, nb); }
  d.moved = 1; if (!ED.raf) ED.raf = requestAnimationFrame(() => { ED.raf = 0; edRender(true); });
}
function edUp() {
  const d = ED.drag; if (!d) return; ED.drag = null; const el = ED.doc.els[ED.sel];
  if (d.isNew && el) { const b = VS.ebox(el), fs = ED.doc.fs || 4;
    if (el.t === 'rect' && (el.w < 1 || el.h < 1)) Object.assign(el, { w: 12, h: 12 }); if (el.t === 'circle' && el.r < .6) el.r = 4;
    if ((el.t === 'line' || el.t === 'dim') && Math.hypot(el.x2 - el.x1, el.y2 - el.y1) < 1) { el.x2 = el.x1 + (el.t === 'dim' ? 24 : 12); el.y2 = el.y1; } ED.tool = 'select'; }
  edPush(d.before); edGrow(); edRender();
}
function edShift(el, o, dx, dy) {
  if ('x1' in o) { el.x1 = o.x1 + dx; el.y1 = o.y1 + dy; el.x2 = o.x2 + dx; el.y2 = o.y2 + dy; }
  else if (o.pts) el.pts = o.pts.map(p => [Math.round((p[0] + dx) * 100) / 100, Math.round((p[1] + dy) * 100) / 100]);
  else { el.x = o.x + dx; el.y = o.y + dy; }
}
function edBox(el, o, ob, nb) {
  const ow = ob[2] - ob[0], oh = ob[3] - ob[1], w = nb[2] - nb[0], h = nb[3] - nb[1], r2 = v => Math.round(v * 100) / 100;
  if (el.t === 'rect') Object.assign(el, { x: nb[0], y: nb[1], w: r2(w), h: r2(h) });
  else if (el.t === 'circle') Object.assign(el, { x: r2(nb[0] + w / 2), y: r2(nb[1] + h / 2), r: r2(Math.max(.25, Math.min(w, h) / 2)) });
  else if (el.t === 'poly' && ow > 0 && oh > 0) el.pts = o.pts.map(p => [r2(nb[0] + (p[0] - ob[0]) * w / ow), r2(nb[1] + (p[1] - ob[1]) * h / oh)]);
  else if (el.t === 'text' && oh > 0) { const s = Math.max(.2, h / oh); Object.assign(el, { size: r2(Math.max(.5, o.size * s)), x: r2(nb[0] + (o.x - ob[0]) * s), y: r2(nb[1] + (o.y - ob[1]) * s) }); }
}
function edAct(a) {
  const els = ED.doc.els, before = edSave();
  if (a === 'undo') { if (!ED.hist.length) return; ED.fut.push(before); ED.doc.els = JSON.parse(ED.hist.pop()); ED.sel = -1; }
  else if (a === 'redo') { if (!ED.fut.length) return; ED.hist.push(before); ED.doc.els = JSON.parse(ED.fut.pop()); ED.sel = -1; }
  else if (a === 'del' && ED.sel >= 0) { els.splice(ED.sel, 1); ED.sel = -1; edPush(before); }
  else if (a === 'dup' && ED.sel >= 0) { const c = JSON.parse(JSON.stringify(els[ED.sel])); edShift(c, JSON.parse(JSON.stringify(c)), 3, 3); els.push(c); ED.sel = els.length - 1; edPush(before); }
  else if (a === 'front' && ED.sel >= 0) { els.push(els.splice(ED.sel, 1)[0]); ED.sel = els.length - 1; edPush(before); }
  else if (a === 'back' && ED.sel >= 0) { els.unshift(els.splice(ED.sel, 1)[0]); ED.sel = 0; edPush(before); }
  else if (a === 'zin') return edZoom(1.25); else if (a === 'zout') return edZoom(1 / 1.25);
  else if (a === 'fit') { ED.zoom = 1; ED.box = edFit(); }
  else if (a === 'snap') ED.snap = !ED.snap;
  else if (a === 'auto') { if (CITEM.drawing && !confirm('Make the drawing again from the sizes? Your edits to the drawing will be replaced.')) return; return catRegen(); }
  else if (a === 'svg') return edDownload('svg'); else if (a === 'png') return edDownload('png');
  edRender();
}
function edZoom(f) { ED.zoom = Math.max(.4, Math.min(5, ED.zoom * f)); edRender(true); }
function edDownload(kind) {
  const name = VI.slugify(CITEM.name || 'design') + '-structure', x = VS.svg(ED.doc, {}), url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(x);
  const save = (href, fn) => { const a = document.createElement('a'); a.href = href; a.download = fn; document.body.appendChild(a); a.click(); a.remove(); };
  if (kind === 'svg') return save(url, name + '.svg');
  const img = new Image(); img.onload = () => { const w = 2400, h = Math.round(w * img.height / img.width), c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.drawImage(img, 0, 0, w, h); save(c.toDataURL('image/png'), name + '.png'); };
  img.onerror = () => toast('Could not make the picture. Try Download SVG.', true); img.src = url;
}
/* keyboard shortcuts while the editor is open (not while typing in a box) */
document.addEventListener('keydown', e => {
  if (!ED || !$('edStage') || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable) return;
  const k = e.key.toLowerCase(), mod = e.ctrlKey || e.metaKey;
  if (mod && k === 'z') { e.preventDefault(); edAct(e.shiftKey ? 'redo' : 'undo'); return; }
  if (mod && k === 'y') { e.preventDefault(); edAct('redo'); return; }
  if (mod && k === 'd') { e.preventDefault(); edAct('dup'); return; }
  if (mod) return;
  if ((k === 'delete' || k === 'backspace') && ED.sel >= 0) { e.preventDefault(); edAct('del'); return; }
  if (k === 'escape') { ED.sel = -1; ED.tool = 'select'; edRender(); return; }
  if (k.startsWith('arrow') && ED.sel >= 0) { e.preventDefault(); const s = e.shiftKey ? 6 : .5, el = ED.doc.els[ED.sel], before = edSave(); edShift(el, JSON.parse(JSON.stringify(el)), k === 'arrowleft' ? -s : k === 'arrowright' ? s : 0, k === 'arrowup' ? -s : k === 'arrowdown' ? s : 0); edPush(before); edGrow(); edRender(); return; }
  const t = { v: 'select', r: 'rect', l: 'line', m: 'dim', t: 'text', c: 'circle' }[k]; if (t) { ED.tool = t; edRender(); }
});
/* properties of the selected shape */
function edProps() {
  const P = $('edProps'); if (!P) return; const e = ED.doc.els[ED.sel];
  if (!e) { P.innerHTML = '<h3>Drawing</h3><p class="hint">Click a shape to change it. Drag to move; drag the small squares to resize. Hold <b>Shift</b> to keep straight lines or proportions.</p><p class="hint">Add shapes with the tools above: box, line, size line, text, circle.</p><p class="hint">Keys: V select · R box · L line · M size line · T text · C circle · arrows move · Del delete · Ctrl+Z undo.</p>'; return; }
  const num = (k, l, step) => '<label><span>' + l + '</span><input type="number" step="' + (step || .5) + '" data-p="' + k + '" value="' + (Math.round((+e[k] || 0) * 100) / 100) + '"/></label>';
  const colr = (k, l) => { const v = e[k], ok = /^#[0-9a-f]{6}$/i.test(v || ''); return '<label class="ec"><span>' + l + '</span><input type="color" data-p="' + k + '" value="' + (ok ? v : '#ffffff') + '"/>' + (k === 'fill' || k === 'stroke' ? '<span class="chk"><input type="checkbox" data-none="' + k + '"' + (!v || v === 'none' || v === 'transparent' ? ' checked' : '') + '/>None</span>' : '') + '</label>'; };
  const line = colr('stroke', 'Line colour') + num('sw', 'Line width', .05) + '<label class="chk2"><input type="checkbox" data-dash' + (e.dash ? ' checked' : '') + '/> Dashed line</label>';
  let h = '<h3>' + ED_NAMES[e.t] + '</h3><div class="epg">';
  if (e.t === 'rect') h += num('x', 'X') + num('y', 'Y') + num('w', 'Width') + num('h', 'Height') + '<div class="ehint">' + VS.ftin(e.w) + ' × ' + VS.ftin(e.h) + '</div>' + colr('fill', 'Fill') + line + num('r', 'Round corners', .1);
  else if (e.t === 'line') h += num('x1', 'X start') + num('y1', 'Y start') + num('x2', 'X end') + num('y2', 'Y end') + '<div class="ehint">Length ' + VS.ftin(Math.hypot(e.x2 - e.x1, e.y2 - e.y1)) + '</div>' + line;
  else if (e.t === 'circle') h += num('x', 'Centre X') + num('y', 'Centre Y') + num('r', 'Radius') + colr('fill', 'Fill') + line;
  else if (e.t === 'poly') h += colr('fill', 'Fill') + line;
  else if (e.t === 'text') h += '<label class="full"><span>Text</span><textarea data-p="text" rows="2">' + esc(e.text) + '</textarea></label>' + num('size', 'Text size', .1) + colr('fill', 'Colour') + '<label><span>Align</span><select data-p="anchor" class="keep">' + [['start', 'Left'], ['middle', 'Centre'], ['end', 'Right']].map(o => '<option value="' + o[0] + '"' + ((e.anchor || 'middle') === o[0] ? ' selected' : '') + '>' + o[1] + '</option>').join('') + '</select></label>' + num('rot', 'Rotate (°)', 1) + '<label class="chk2"><input type="checkbox" data-bold' + (e.bold ? ' checked' : '') + '/> Bold</label>';
  else if (e.t === 'dim') h += '<label class="full"><span>Label</span><input type="text" data-p="text" value="' + esc(e.text || '') + '" placeholder="' + esc(VS.ftin(Math.hypot(e.x2 - e.x1, e.y2 - e.y1))) + ' (measured)"/></label><div class="ehint">Leave the label empty to show the measured size.</div>' + num('off', 'Distance from shape') + num('size', 'Text size', .1) + colr('stroke', 'Colour') + num('x1', 'X start') + num('y1', 'Y start') + num('x2', 'X end') + num('y2', 'Y end');
  h += '</div><div class="ebtns"><button type="button" class="btn sm keep" onclick="edAct(\'dup\')">Copy</button><button type="button" class="btn sm keep" onclick="edAct(\'front\')">To front</button><button type="button" class="btn sm keep" onclick="edAct(\'back\')">To back</button><button type="button" class="btn sm danger keep" onclick="edAct(\'del\')">Delete</button></div>';
  P.innerHTML = h;
  let pre = null;
  P.onfocusin = () => { pre = edSave(); };
  const apply = (t, live) => { const el = ED.doc.els[ED.sel]; if (!el) return;
    if (t.dataset.p) { const k = t.dataset.p; el[k] = t.type === 'number' ? (+t.value || 0) : t.value; if (t.type === 'color') { const n = P.querySelector('[data-none="' + k + '"]'); if (n) n.checked = false; } }
    if (t.dataset.none) el[t.dataset.none] = t.checked ? 'none' : (P.querySelector('[data-p="' + t.dataset.none + '"]').value);
    if ('dash' in t.dataset) el.dash = t.checked ? '1.5 1' : undefined; if ('bold' in t.dataset) el.bold = t.checked ? 1 : undefined;
    edRender(live); };
  P.oninput = ev => apply(ev.target, true);
  P.onchange = ev => { apply(ev.target, true); if (pre !== null) { edPush(pre); pre = edSave(); } edGrow(); edRender(true); };
}
