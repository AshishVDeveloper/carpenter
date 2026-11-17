/* Documents module for admin.html: quotations, agreements, bills, invoices, rate list and letterhead.
   Client documents are private: they are encrypted with the admin password (AES-GCM) before being
   stored in this browser and in data/vault.json on GitHub, so the public site can't read them. */
(function(){
const VKEY = 'carpenter_vault', VSESS = 'carpenter_vault_key';
const D = window.DOCS;
let V = null, KEY = null, SALT = null, saveTimer = null, saving = false;

/* ── crypto ── */
const enc = new TextEncoder(), dec = new TextDecoder();
const toB64 = buf => { const b = new Uint8Array(buf); let s = ''; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000)); return btoa(s); };
const fromB64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
async function derive(pass, salt){
  const base = await crypto.subtle.importKey('raw', enc.encode(pass), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({name: 'PBKDF2', salt, iterations: 200000, hash: 'SHA-256'}, base, {name: 'AES-GCM', length: 256}, true, ['encrypt', 'decrypt']);
}
async function seal(obj){
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({name: 'AES-GCM', iv}, KEY, enc.encode(JSON.stringify(obj)));
  return SALT ? {v: 1, salt: toB64(SALT), iv: toB64(iv), data: toB64(ct), updated: obj.updated} : {v: 2, kind: 'srv', iv: toB64(iv), data: toB64(ct), updated: obj.updated};
}
async function unseal(blob, key){
  const pt = await crypto.subtle.decrypt({name: 'AES-GCM', iv: fromB64(blob.iv)}, key, fromB64(blob.data));
  return JSON.parse(dec.decode(pt));
}
async function remember(){ sessionStorage.setItem(VSESS, JSON.stringify({k: toB64(await crypto.subtle.exportKey('raw', KEY)), s: SALT ? toB64(SALT) : ''})); }

/* ── defaults ── */
const DEF_TERMS = {
  quotation: ['Rates are per square foot unless mentioned otherwise.', 'Laminate changing items are without fitting as specified.', 'Hardware, handles and fittings as per the agreed brand and sample.', 'Any extra work will be charged separately at the agreed rates.', 'This quotation is valid for 15 days from the date above.'],
  agreement: ['The Client shall provide a clear site, electricity and water during the work.', 'On contract basis the Contractor supplies material of the agreed brand; on labour basis the Client supplies all material on time.', 'Any change in design or extra work will be done only after written approval and charged separately.', 'Payments shall be made as per the schedule above; work may pause if a payment is delayed.', 'The Contractor will repair any defect in workmanship reported within the agreed warranty period.', 'Delays caused by material shortage, site access or other reasons beyond the Contractor\'s control will extend the timeline.', 'Any dispute will be settled by mutual discussion, failing which the courts of Thane / Mumbai shall have jurisdiction.'],
  bill: ['Please pay the balance amount on receipt of this bill.'],
  invoice: ['Payment is due within 7 days of the invoice date.', 'Subject to Thane / Mumbai jurisdiction.']
};
const DEF_SCHEDULE = [{label: 'Advance on signing', percent: 40}, {label: 'After framework / carcass is complete', percent: 40}, {label: 'On completion and handover', percent: 20}];
const SEED_RATES = [['TV Unit',1200],['Dining Table (Folding)',1000],['File Box',1500],['Table',1500],['AC Panelling',600],['Bassing Box',800],['Passage Frame Door',800],['Safety Door Panelling',600],['Safety Door Laminate Changing',600],['Main Door Laminate Changing',600],['Kitchen Platform Storage',1800],['Kitchen Cabinet',1000],['Fridge Side Box',1200],['Loft',1000],['Kitchen Door Laminate Changing',600],['Kokri Unit',1600],['Wardrobe',1500],['Frame Loft',1000],['Palang Top',500],['Palang Overhead',500],['Palang Laminate Changing',600],['Wardrobe Dressing',1200],['Bedroom Door Laminate Changing',600]]
  .map(([desc, rate], i) => ({id: i + 1, desc, unit: 'sqft', rate})).concat([{id: 24, desc: 'Mandir', unit: 'lump', rate: 15000}]);
const SAMPLE = [['Hall','TV Unit',"7' x 7'",1200],['Hall','Dining Table (Folding)',"3.5' x 6'",1000],['Hall','File Box',"5' x 30\"",1500],['Hall','Table',"2.5' x 2.5'",1500],['Hall','AC Panelling',"2' x 10'",600],['Hall','Bassing Box',"2' x 3'",800],['Hall','Passage Frame Door',"4' x 2'",800],['Hall','Safety Door Panelling',"10' x 2'",600],['Hall','Safety Door Panelling',"3' x 2'",600],['Hall','Safety Door Laminate Changing',"7' x 3'",600],['Hall','Main Door Laminate Changing',"7' x 3'",600],
  ['Kitchen','Kitchen Platform Storage',"12' x 30\"",1800],['Kitchen','Kitchen Cabinet',"8'6\" x 4'",1000],['Kitchen','Fridge Side Box',"7' x 18\"",1200],['Kitchen','Loft',"6' x 2'",1000],['Kitchen','Kitchen Door Laminate Changing',"7' x 3'",600],['Kitchen','Kokri Unit',"3' x 2.5'",1600],
  ['Bedroom','Wardrobe',"7' x 7'6\"",1500],['Bedroom','Frame Loft',"2' x 10'",1000],['Bedroom','Palang Top',"6'6\" x 7'",500],['Bedroom','Palang Overhead',"4' x 6'6\"",500],['Bedroom','Mandir',"2' x 3'",''],['Bedroom','Palang Laminate Changing','-',600],['Bedroom','Wardrobe Dressing',"2' x 7'",1200],['Bedroom','Bedroom Door Laminate Changing',"7' x 3'",600]];
function sampleQuote(){
  const items = SAMPLE.map(([room, desc, size, rate]) => ({room, desc, size, qty: 1, rate, unit: rate === '' ? 'lump' : 'sqft', area: D.area(size), amount: rate === '' ? 15000 : '', areaManual: false}));
  items.find(i => i.desc === 'Palang Laminate Changing').area = 27; items.find(i => i.desc === 'Palang Laminate Changing').areaManual = true;
  return {id: 'd1', type: 'quotation', no: 'Q-' + new Date().getFullYear() + '-001', date: today(), valid_till: '', client: 'Sample client', client_phone: '', client_address: '', site: '', basis: 'Contract basis', status: 'draft', group_rooms: false,
    items, discount: '', gst: '', advance: '', notes: '', terms: ['Laminate changing items are without fitting as specified.'], created: Date.now(), updated: Date.now()};
}
const today = () => new Date().toISOString().slice(0, 10);
function blankVault(){ return {docs: [sampleQuote()], rates: SEED_RATES, counters: {quotation: 1}, bank: {}, gstin: '', terms: DEF_TERMS, updated: Date.now()}; }

/* ── open / save vault ── */
async function remoteBlob(){ try { const r = await fetch('data/vault.json?t=' + Date.now()); return r.ok ? r.json() : null; } catch (e) { return null; } }
function localBlob(){ try { return JSON.parse(localStorage.getItem(VKEY) || 'null'); } catch (e) { return null; } }
function newest(a, b){ return !a ? b : !b ? a : (a.updated || 0) >= (b.updated || 0) ? a : b; }
window.vaultOpen = async function(pass){
  const blob = newest(localBlob(), await remoteBlob());
  if (blob && blob.kind === 'srv') { V = null; KEY = null; return; } /* team-key documents open only through the sign-in server */
  if (blob) {
    SALT = fromB64(blob.salt); KEY = await derive(pass, SALT);
    try { V = await unseal(blob, KEY); }
    catch (e) { V = null; KEY = null; throw Object.assign(new Error('locked'), {locked: true}); }
  } else { SALT = crypto.getRandomValues(new Uint8Array(16)); KEY = await derive(pass, SALT); V = blankVault(); await saveVault(true); }
  await remember();
};
window.vaultResume = async function(){
  const s = JSON.parse(sessionStorage.getItem(VSESS) || 'null'); if (!s) return false;
  SALT = s.s ? fromB64(s.s) : null; KEY = await crypto.subtle.importKey('raw', fromB64(s.k), 'AES-GCM', true, ['encrypt', 'decrypt']);
  let rb;
  if (!SALT && typeof srvGh === 'function') { try { const j = await srvGh('/contents/data/vault.json?ref=main'); rb = j.content ? JSON.parse(dec.decode(fromB64(j.content.replace(/\s/g, '')))) : await remoteBlob(); } catch (e) { rb = e.status === 404 ? null : await remoteBlob(); } }
  else rb = await remoteBlob();
  const lb = localBlob(), blob = newest(lb, rb), other = blob === lb ? rb : lb;
  for (const b of [blob, other]) { if (!b) continue; try { V = await unseal(b, KEY); return true; } catch (e) { } }
  if (!blob) { V = blankVault(); return true; }
  sessionStorage.removeItem(VSESS); return false;
};
window.vaultForget = () => sessionStorage.removeItem(VSESS);
/* team mode: one shared key from the sign-in server. The owner's password-locked store is moved to it on the owner's next sign-in. */
window.vaultOpenKey = async function(kb64, pass, fresh){
  const skey = await crypto.subtle.importKey('raw', fromB64(kb64), 'AES-GCM', true, ['encrypt', 'decrypt']);
  let gh0; /* freshest copy straight from GitHub (the website copy can be a minute old) */
  if (!fresh) { try { const j = await srvGh('/contents/data/vault.json?ref=main'); gh0 = j.content ? JSON.parse(new TextDecoder().decode(fromB64(j.content.replace(/\s/g, '')))) : await remoteBlob(); } catch (e) { if (e.status !== 404) throw Object.assign(new Error('unreachable'), {unreachable: true}); gh0 = null; } }
  const blob = fresh ? null : newest(localBlob(), gh0);
  if (blob && blob.kind === 'srv') { try { V = await unseal(blob, skey); } catch (e) { V = null; throw Object.assign(new Error('locked'), {locked: true}); } KEY = skey; SALT = null; }
  else if (blob) {
    if (!pass) throw Object.assign(new Error('owner'), {needOwner: true});
    try { V = await unseal(blob, await derive(pass, fromB64(blob.salt))); } catch (e) { V = null; throw Object.assign(new Error('locked'), {locked: true}); }
    KEY = skey; SALT = null; await saveVault(true);
  } else { KEY = skey; SALT = null; V = blankVault(); await saveVault(true); }
  await remember();
};
window.vaultReady = () => !!V;
window.vaultFresh = async function(pass){ SALT = crypto.getRandomValues(new Uint8Array(16)); KEY = await derive(pass, SALT); V = blankVault(); await saveVault(true); await remember(); };
window.vaultRekey = async function(pass){ if (!V || !SALT) return; SALT = crypto.getRandomValues(new Uint8Array(16)); KEY = await derive(pass, SALT); await saveVault(true); await remember(); };
async function saveVault(now){
  V.updated = Date.now();
  const blob = await seal(V);
  localStorage.setItem(VKEY, JSON.stringify(blob));
  const cfg = gh();
  setSync(cfg && cfg.token ? 'Saving…' : 'Saved on this device');
  if (!(cfg && cfg.token)) return;
  clearTimeout(saveTimer);
  const push = async () => { if (saving) { saveTimer = setTimeout(push, 800); return; } saving = true;
    try { await ghPutRaw(cfg, 'data/vault.json', b64(JSON.stringify(blob)), 'Update private documents (encrypted)'); setSync('Saved to GitHub'); }
    catch (e) { setSync('Saved on this device — GitHub sync failed'); } finally { saving = false; } };
  if (now) await push(); else saveTimer = setTimeout(push, 1200);
}
function setSync(t){ const el = document.getElementById('syncState'); if (el) el.textContent = t; }

/* ── helpers ── */
const DT = D.TYPES;
const docTotal = d => D.totals(d).grand;
function nextNo(type){ V.counters = V.counters || {}; const n = (V.counters[type] || 0) + 1; V.counters[type] = n; return DT[type].prefix + '-' + new Date().getFullYear() + '-' + String(n).padStart(3, '0'); }
function letterheadData(){ const L = {...(DB.settings.letterhead || {})}; L.gstin = V.gstin || ''; return L; }
function fileName(d){ return (DT[d.type].label + '-' + d.no + '-' + (d.client || '')).replace(/[^\w\-]+/g, '-').replace(/-+/g, '-').replace(/-$/, '') + '.pdf'; }
async function makePDF(d, btn){
  const host = document.createElement('div'); host.style.cssText = 'position:absolute;left:0;top:0;width:794px;z-index:-1;pointer-events:none';
  host.innerHTML = D.render(d, letterheadData(), {bank: V.bank});
  document.body.appendChild(host);
  const label = btn && btn.innerHTML; if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spin"></span>Making PDF…'; }
  try {
    await document.fonts.ready;
    await Promise.all([...host.querySelectorAll('img')].map(i => i.complete ? 0 : new Promise(r => { i.onload = i.onerror = r; })));
    await html2pdf().set({margin: [28, 0, 26, 0], filename: fileName(d), image: {type: 'jpeg', quality: .96},
      html2canvas: {scale: 2, useCORS: true, backgroundColor: '#ffffff', scrollX: 0, scrollY: 0, windowWidth: 794, x: 0, y: 0}, jsPDF: {unit: 'px', format: [794, 1123], hotfixes: ['px_scaling']},
      pagebreak: {mode: ['css', 'legacy'], avoid: ['tr', '.signs', '.foot', '.sum', '.meta', 'h3.sec']}}).from(host.firstElementChild).save();
    toast('PDF downloaded.');
  } catch (e) { toast('Couldn\'t make the PDF. Try Print → Save as PDF instead.', true); }
  finally { host.remove(); if (btn) { btn.disabled = false; btn.innerHTML = label; } }
}
function printDoc(d){
  const w = window.open('', '_blank'); if (!w) { toast('Allow pop-ups to print.', true); return; }
  const base = location.origin + '/';
  w.document.write('<!DOCTYPE html><html><head><meta charset="utf-8"><title>' + esc(fileName(d).replace('.pdf', '')) + '</title><base href="' + base + '"><link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,800&family=Figtree:wght@400;700;800&display=swap" rel="stylesheet"><link rel="stylesheet" href="assets/doc/doc.css"><style>body{margin:0}</style></head><body>' + D.render(d, letterheadData(), {bank: V.bank}) + '<script>window.onload=()=>setTimeout(()=>window.print(),400)<\/script></body></html>');
  w.document.close();
}

/* ── documents list ── */
let DF = '', DQ = '';
window.pgDocs = function(){
  C('<div class="card" data-perm="documents.add"><h2>New document <span class="hint" id="syncState" style="font-weight:500"></span></h2><div class="bar" style="justify-content:flex-start">' + Object.entries(DT).map(([k, t]) => '<a class="btn' + (k === 'quotation' ? ' pri' : '') + '" data-perm="documents.add" href="#documents/new-' + k + '">+ ' + t.label + '</a>').join('') + '</div></div>' +
    '<div class="card"><h2>All documents <span><button class="btn sm" onclick="backupDocs()">Download backup</button> <label class="btn sm" data-perm="documents.delete" style="margin:0">Restore backup<input type="file" accept=".json,application/json" hidden onchange="restoreDocs(this)"/></label></span></h2>' +
    '<div class="tools"><input type="search" placeholder="Search client or number" aria-label="Search documents" value="' + esc(DQ) + '" oninput="DQ_set(this.value)"/><select aria-label="Type" onchange="DF_set(this.value)"><option value="">All types</option>' + Object.entries(DT).map(([k, t]) => '<option value="' + k + '"' + (DF === k ? ' selected' : '') + '>' + t.label + '</option>').join('') + '</select></div>' +
    '<div class="tw"><table><thead><tr><th class="sr">Sr.</th><th>No.</th><th>Client</th><th class="hide-m">Date</th><th>Total</th><th class="hide-m">Status</th><th><span hidden>Actions</span></th></tr></thead><tbody id="dRows"></tbody></table></div></div>' +
    (SALT ? '<div class="msg info">Documents are private. They are encrypted with your admin password before being saved on this device' + (gh() ? ' and on GitHub (so they sync to your other devices)' : '') + '. Keep a backup: if the password is reset with a GitHub token, old documents can\'t be opened without a backup.</div>' : '<div class="msg info">Documents are private. They are encrypted with a team key that only your sign-in server hands out, to people allowed to see documents. Keep a backup now and then.</div>'));
  drawDocs(); setSync('');
};
window.DQ_set = v => { DQ = v; drawDocs(); }; window.DF_set = v => { DF = v; drawDocs(); };
window.drawDocs = drawDocs;
function drawDocs(){
  const q = DQ.toLowerCase(), L = V.docs.filter(d => (!DF || d.type === DF) && (!q || (d.no + ' ' + d.client + ' ' + (d.client_phone || '')).toLowerCase().includes(q))).sort((a, b) => (b.updated || 0) - (a.updated || 0));
  const pg = pageOf('documents', L, q + '|' + DF);
  document.getElementById('dRows').innerHTML = L.length ? pg.rows.map((d, j) => '<tr>' + sr(pg, j) + '<td><div class="t">' + esc(d.no) + '</div><div class="s">' + DT[d.type].label + '</div></td><td>' + esc(d.client || '—') + '<div class="s">' + esc(d.client_phone || '') + '</div></td><td class="hide-m">' + esc(D.fmtDate(d.date)) + '</td><td><b>' + D.rs(docTotal(d)) + '</b></td><td class="hide-m"><span class="pill ' + (d.status === 'final' ? 'ok' : 'warn') + '">' + (d.status === 'final' ? 'Final' : 'Draft') + '</span></td>' +
    '<td><div class="acts-cell"><a class="btn sm" href="#documents/' + d.id + '">Open</a><button class="btn sm" onclick="docPDF(\'' + d.id + '\',this)">PDF</button><button class="btn sm danger" data-perm="documents.delete" onclick="docDel(\'' + d.id + '\')">Delete</button></div></td></tr>').join('')
    : '<tr><td colspan="7" class="empty">No documents yet.</td></tr>';
  pgMount(document.getElementById('dRows'), pg, 'drawDocs');
}
window.docPDF = (id, btn) => makePDF(V.docs.find(d => d.id === id), btn);
window.docDel = async id => { const d = V.docs.find(x => x.id === id); if (!await confirmBox('Delete ' + DT[d.type].label.toLowerCase() + ' ' + d.no + '?', 'This can\'t be undone unless you have a backup.')) return; V.docs = V.docs.filter(x => x.id !== id); await saveVault(); drawDocs(); };
window.backupDocs = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(V, null, 2)], {type: 'application/json'})); a.download = 'vishwakarma-documents-backup-' + today() + '.json'; a.click(); toast('Backup downloaded. Keep it somewhere safe — it is not encrypted.'); };
window.restoreDocs = async input => { const f = input.files[0]; if (!f) return; try { const data = JSON.parse(await f.text()); if (!Array.isArray(data.docs)) throw 0;
  if (!await confirmBox('Restore this backup?', 'It replaces the documents, rate list and payment details stored now (' + data.docs.length + ' documents in the backup).', 'Restore')) return;
  V = {...blankVault(), ...data}; await saveVault(true); pgDocs(); toast('Backup restored.'); } catch (e) { toast('That file isn\'t a documents backup.', true); } input.value = ''; };

/* ── editor ── */
let E = null;
window.pgDoc = function(arg, preset){
  if (preset) { E = preset; }
  else if (arg.startsWith('new-')) {
    const type = arg.slice(4); if (!DT[type]) { location.hash = 'documents'; return; }
    E = {id: 'd' + Date.now().toString(36), type, no: '', date: today(), valid_till: '', client: '', client_phone: '', client_address: '', site: '', basis: type === 'agreement' ? 'Contract basis' : '', status: 'draft', group_rooms: false,
      items: [{room: '', desc: '', size: '', area: '', qty: 1, rate: '', unit: 'sqft', amount: ''}], discount: '', gst: type === 'invoice' && V.gstin ? 18 : '', advance: '', notes: '', terms: [...((V.terms || DEF_TERMS)[type] || [])],
      schedule: type === 'agreement' ? DEF_SCHEDULE.map(s => ({...s})) : [], start_date: '', end_date: '', duration: '', isNew: true};
  } else {
    const d = V.docs.find(x => x.id === arg); if (!d) { location.hash = 'documents'; return; }
    E = JSON.parse(JSON.stringify(d));
  }
  document.getElementById('pTitle').textContent = (E.isNew ? 'New ' : '') + DT[E.type].label + (E.no ? ' ' + E.no : '');
  const f = (k, l, t = 'text', ph = '') => '<div class="field"><label for="e_' + k + '">' + l + '</label><input id="e_' + k + '" data-e="' + k + '" type="' + t + '" value="' + esc(E[k] ?? '') + '" placeholder="' + esc(ph) + '"/></div>';
  C('<div class="docwrap"><div class="docform">' +
    '<div class="card"><h2>' + DT[E.type].label + ' details <span class="hint" id="syncState" style="font-weight:500"></span></h2><div class="g2">' + f('no', DT[E.type].label + ' number', 'text', 'Created automatically') + f('date', 'Date', 'date') +
      (E.type === 'quotation' ? f('valid_till', 'Valid till', 'date') : '') +
      '<div class="field"><label for="e_basis">Work basis</label><select id="e_basis" data-e="basis"><option value="">—</option>' + ['Contract basis', 'Labour basis'].map(b => '<option' + (E.basis === b ? ' selected' : '') + '>' + b + '</option>').join('') + '</select></div>' +
      '<div class="field"><label for="e_status">Status</label><select id="e_status" data-e="status"><option value="draft"' + (E.status !== 'final' ? ' selected' : '') + '>Draft</option><option value="final"' + (E.status === 'final' ? ' selected' : '') + '>Final</option></select></div>' + f('ref', 'Reference (optional)', 'text', 'e.g. Quotation Q-2026-001') + '</div></div>' +
    '<div class="card"><h2>Client</h2><div class="g2">' + f('client', 'Client name') + f('client_phone', 'Phone', 'tel') + '</div>' + f('client_address', 'Client address') + f('site', 'Site address (if different)') + (E.type === 'invoice' ? f('client_gstin', 'Client GSTIN (optional)') : '') + '</div>' +
    '<div class="card"><h2>Items <span><label class="check" style="display:inline-flex;margin:0;font-size:.85rem"><input type="checkbox" id="e_group"' + (E.group_rooms ? ' checked' : '') + '/> <span style="margin-left:.4rem">Group by room</span></label></span></h2>' +
      '<div class="itab" id="itab"></div><div class="bar" style="justify-content:space-between"><button type="button" class="btn sm" onclick="itAdd()">+ Add item</button><span class="hint" style="margin:0">Area is worked out from the size, e.g. 7\' x 7\' or 12\' x 30". Leave the rate empty for a fixed amount.</span></div>' +
      '<datalist id="rateList">' + (V.rates || []).map(r => '<option value="' + esc(r.desc) + '">').join('') + '</datalist><datalist id="roomList"><option value="Hall"><option value="Kitchen"><option value="Bedroom"><option value="Master Bedroom"><option value="Kids Bedroom"><option value="Bathroom"><option value="Balcony"><option value="Office"><option value="Shop"></datalist></div>' +
    '<div class="card"><h2>Totals</h2><div class="g3">' + f('discount', 'Discount (₹)', 'number') + (E.type === 'invoice' ? f('gst', 'GST %', 'number') : '') + (E.type === 'bill' || E.type === 'invoice' ? f('advance', 'Advance received (₹)', 'number') : '') + '</div><div id="totline" class="hint"></div></div>' +
    (E.type === 'agreement' ? '<div class="card"><h2>Timeline & payments</h2><div class="g3">' + f('start_date', 'Start date', 'date') + f('end_date', 'Completion date', 'date') + f('duration', 'Or duration', 'text', 'e.g. 30 working days') + '</div><label>Payment schedule</label><div id="sched"></div><button type="button" class="btn sm" onclick="schAdd()">+ Add stage</button></div>' : '') +
    '<div class="card"><h2>Notes & terms</h2>' + (E.type !== 'agreement' ? '<div class="field"><label for="e_notes">Notes (optional)</label><textarea id="e_notes" data-e="notes" style="min-height:60px">' + esc(E.notes) + '</textarea></div>' : '') +
      '<div class="field"><label for="e_terms">Terms — one per line</label><textarea id="e_terms" style="min-height:130px">' + esc((E.terms || []).join('\n')) + '</textarea>' + (E.type === 'agreement' ? '<div class="hint">These are general clauses — read them carefully and change them to match your deal. They are not legal advice.</div>' : '') + '</div>' + f('footer_note', 'Footer message', 'text', 'Thank you for your business!') + '</div>' +
    '<div class="docbar"><a class="btn" href="#documents">Back</a><button class="btn pri" onclick="docSave(this)">Save</button><button class="btn" onclick="docPDFcur(this)">Download PDF</button><button class="btn" onclick="docPrint()">Print</button>' +
      (E.type === 'quotation' ? '<select class="btn" aria-label="Convert" onchange="docConvert(this.value);this.value=\'\'"><option value="">Make from this…</option><option value="agreement">Agreement</option><option value="bill">Bill</option><option value="invoice">Invoice</option></select>' : '') +
      (!E.isNew ? '<button class="btn" onclick="docDup()">Duplicate</button>' : '') + '</div>' +
    '</div><div class="docprev' + (innerWidth <= 1150 ? ' shut' : '') + '" id="docprev"><div class="prevhead"><b>Preview</b><span class="hint" style="margin:0">A4 · updates as you type</span><button type="button" class="btn sm prevtoggle" aria-expanded="' + (innerWidth > 1150) + '" aria-controls="prevbox" onclick="togglePrev(this)">' + (innerWidth <= 1150 ? 'Show preview' : 'Hide preview') + '</button></div><div class="prevbox" id="prevbox"><div id="prev"></div></div></div></div>');
  document.querySelectorAll('[data-e]').forEach(el => el.oninput = el.onchange = () => { E[el.dataset.e] = el.value; dirtyDoc(); });
  document.getElementById('e_terms').oninput = e => { E.terms = e.target.value.split('\n'); dirtyDoc(); };
  document.getElementById('e_group').onchange = e => { E.group_rooms = e.target.checked; dirtyDoc(); };
  drawItems(); if (E.type === 'agreement') drawSched(); preview(); setSync(E.isNew ? 'Not saved yet' : '');
  window.onresize = fitPreview;
};
let docDirty = false;
function dirtyDoc(){ docDirty = true; setSync('Unsaved changes'); preview(); }
window.addEventListener('beforeunload', e => { if (docDirty && location.hash.startsWith('#documents/')) { e.preventDefault(); e.returnValue = ''; } });
window.addEventListener('hashchange', () => { if (!location.hash.startsWith('#documents/')) docDirty = false; });
function preview(){
  const p = document.getElementById('prev'); if (!p) return;
  p.innerHTML = D.render({...E, no: E.no || DT[E.type].prefix + '-' + new Date().getFullYear() + '-…'}, letterheadData(), {bank: V.bank, watermark: true});
  const t = D.totals(E); const tl = document.getElementById('totline');
  if (tl) tl.innerHTML = 'Subtotal ' + D.rs(t.sub) + (t.disc ? ' · Discount ' + D.rs(t.disc) : '') + (t.gst ? ' · GST ' + D.rs(t.gst) : '') + ' · <b>Grand total ' + D.rs(t.grand) + '</b>' + (t.paid ? ' · Balance ' + D.rs(t.balance) : '');
  fitPreview();
}
function fitPreview(){ const box = document.getElementById('prevbox'), p = document.getElementById('prev'); if (!box || !p) return; const s = Math.min(1, box.clientWidth / 794); p.style.transform = 'scale(' + s + ')'; box.style.height = (p.firstElementChild ? p.firstElementChild.offsetHeight * s : 0) + 'px'; }

window.togglePrev = b => { const p = document.getElementById('docprev'), open = p.classList.toggle('shut') === false; b.textContent = open ? 'Hide preview' : 'Show preview'; b.setAttribute('aria-expanded', open); if (open) fitPreview(); };

/* items */
function drawItems(){
  const rows = E.items.map((it, i) => {
    const amt = D.lineAmount(it), auto = !(it.unit === 'lump' || (!Number(it.rate) && it.amountManual !== false));
    return '<div class="irow" data-i="' + i + '">' +
      '<input aria-label="Room" list="roomList" placeholder="Room" value="' + esc(it.room) + '" data-f="room"/>' +
      '<input aria-label="Description" list="rateList" placeholder="Description" value="' + esc(it.desc) + '" data-f="desc"/>' +
      '<input aria-label="Size" placeholder="7\' x 7\'" value="' + esc(it.size) + '" data-f="size"/>' +
      '<input aria-label="Area in sq ft" placeholder="Area" value="' + esc(it.area) + '" data-f="area" inputmode="decimal" title="Square feet — worked out from size; type to change"/>' +
      '<input aria-label="Quantity" placeholder="Qty" value="' + esc(it.qty) + '" data-f="qty" inputmode="decimal"/>' +
      '<select aria-label="Unit" data-f="unit"><option value="sqft"' + (it.unit !== 'nos' && it.unit !== 'lump' ? ' selected' : '') + '>/sq ft</option><option value="nos"' + (it.unit === 'nos' ? ' selected' : '') + '>/piece</option><option value="lump"' + (it.unit === 'lump' ? ' selected' : '') + '>Fixed</option></select>' +
      '<input aria-label="Rate" placeholder="Rate" value="' + esc(it.rate) + '" data-f="rate" inputmode="decimal"' + (it.unit === 'lump' ? ' disabled' : '') + '/>' +
      '<input aria-label="Amount" class="amt" placeholder="Amount" value="' + (it.unit === 'lump' || !Number(it.rate) ? esc(it.amount) : D.inr(amt)) + '" data-f="amount" inputmode="decimal"' + (it.unit !== 'lump' && Number(it.rate) ? ' readonly tabindex="-1"' : '') + '/>' +
      '<div class="iacts"><button type="button" aria-label="Move up" onclick="itMove(' + i + ',-1)">▲</button><button type="button" aria-label="Move down" onclick="itMove(' + i + ',1)">▼</button><button type="button" aria-label="Remove item" class="x" onclick="itDel(' + i + ')">✕</button></div></div>';
  }).join('');
  document.getElementById('itab').innerHTML = '<div class="irow ihead"><span>Room</span><span>Description</span><span>Size</span><span>Area</span><span>Qty</span><span>Unit</span><span>Rate ₹</span><span>Amount ₹</span><span></span></div>' + rows;
  document.querySelectorAll('#itab .irow[data-i]').forEach(r => r.querySelectorAll('[data-f]').forEach(el => {
    el.oninput = el.onchange = () => {
      const it = E.items[+r.dataset.i], k = el.dataset.f; it[k] = el.value;
      if (k === 'size' && !it.areaManual) { it.area = D.area(el.value); r.querySelector('[data-f=area]').value = it.area; }
      if (k === 'area') it.areaManual = el.value !== '';
      if (k === 'desc') { const rt = (V.rates || []).find(x => x.desc.toLowerCase() === el.value.trim().toLowerCase()); if (rt && !it.rate) { it.rate = rt.unit === 'lump' ? '' : rt.rate; it.unit = rt.unit; if (rt.unit === 'lump') it.amount = rt.rate; drawItems(); dirtyDoc(); return; } }
      const autoNow = it.unit !== 'lump' && !!Number(it.rate);
      if (k === 'unit' || (k === 'rate' && autoNow !== r.querySelector('.amt').readOnly)) { const idx = r.dataset.i; drawItems(); dirtyDoc(); const n = document.querySelector('#itab .irow[data-i="' + idx + '"] [data-f="' + k + '"]'); if (n) { n.focus(); if (n.setSelectionRange && n.type === 'text') n.setSelectionRange(n.value.length, n.value.length); } return; }
      const a = r.querySelector('.amt'); if (a.readOnly) a.value = D.inr(D.lineAmount(it));
      dirtyDoc();
    };
  }));
}
window.itAdd = () => { const last = E.items[E.items.length - 1] || {}; E.items.push({room: last.room || '', desc: '', size: '', area: '', qty: 1, rate: '', unit: 'sqft', amount: ''}); drawItems(); dirtyDoc(); const rs = document.querySelectorAll('#itab .irow[data-i]'); rs[rs.length - 1].querySelector('[data-f=desc]').focus(); };
window.itDel = i => { E.items.splice(i, 1); if (!E.items.length) E.items.push({room: '', desc: '', size: '', area: '', qty: 1, rate: '', unit: 'sqft', amount: ''}); drawItems(); dirtyDoc(); };
window.itMove = (i, d) => { const j = i + d; if (j < 0 || j >= E.items.length) return; [E.items[i], E.items[j]] = [E.items[j], E.items[i]]; drawItems(); dirtyDoc(); };
function drawSched(){
  document.getElementById('sched').innerHTML = (E.schedule || []).map((s, i) => '<div class="r" style="grid-template-columns:1fr 90px auto"><input aria-label="Stage" value="' + esc(s.label) + '" oninput="E_sched(' + i + ',\'label\',this.value)"/><input aria-label="Percent" value="' + esc(s.percent) + '" inputmode="decimal" placeholder="%" oninput="E_sched(' + i + ',\'percent\',this.value)"/><button type="button" class="btn sm danger" onclick="schDel(' + i + ')">Remove</button></div>').join('');
}
window.E_sched = (i, k, v) => { E.schedule[i][k] = v; dirtyDoc(); };
window.schAdd = () => { E.schedule.push({label: '', percent: ''}); drawSched(); };
window.schDel = i => { E.schedule.splice(i, 1); drawSched(); dirtyDoc(); };

function cleanE(){ const d = JSON.parse(JSON.stringify(E)); delete d.isNew; d.items = d.items.filter(it => it.desc || it.room || it.amount); d.terms = (d.terms || []).map(s => s.trim()).filter(Boolean); return d; }
window.docSave = async btn => {
  if (!E.client.trim()) { toast('Add the client name first.', true); document.getElementById('e_client').focus(); return; }
  if (!E.no) { E.no = nextNo(E.type); const n = document.getElementById('e_no'); if (n) n.value = E.no; }
  const d = cleanE(); d.updated = Date.now(); d.created = d.created || d.updated;
  const i = V.docs.findIndex(x => x.id === d.id); if (i >= 0) V.docs[i] = d; else V.docs.push(d);
  if (btn) { btn.disabled = true; } await saveVault(true); if (btn) btn.disabled = false;
  docDirty = false; const wasNew = E.isNew; E.isNew = false;
  toast(DT[d.type].label + ' ' + d.no + ' saved.');
  if (wasNew) location.hash = 'documents/' + d.id; else { document.getElementById('pTitle').textContent = DT[d.type].label + ' ' + d.no; preview(); }
};
window.docPDFcur = async btn => { if (docDirty || E.isNew) await docSave(); makePDF(cleanE(), btn); };
window.docPrint = async () => { if (docDirty || E.isNew) await docSave(); printDoc(cleanE()); };
let PENDING = null;
window.docDup = () => { const c = cleanE(); PENDING = {...c, id: 'd' + Date.now().toString(36), no: '', date: today(), status: 'draft', isNew: true, created: 0}; location.hash = 'documents/new-' + c.type; };
window.docConvert = async type => {
  if (!type) return; if (docDirty || E.isNew) await docSave();
  const src = cleanE();
  PENDING = {...src, id: 'd' + Date.now().toString(36), type, no: '', date: today(), status: 'draft', ref: DT[src.type].label + ' ' + src.no, terms: [...((V.terms || DEF_TERMS)[type] || [])],
    schedule: type === 'agreement' ? DEF_SCHEDULE.map(s => ({...s})) : [], gst: type === 'invoice' && V.gstin ? 18 : '', advance: '', valid_till: '', start_date: '', end_date: '', duration: '', basis: src.basis || (type === 'agreement' ? 'Contract basis' : ''), isNew: true, created: 0};
  location.hash = 'documents/new-' + type;
};
window.docRoute = function(arg){
  if (PENDING && arg === 'new-' + PENDING.type) { const p = PENDING; PENDING = null; pgDoc(arg, p); return; }
  pgDoc(arg);
};

/* ── rate list ── */
window.pgRates = function(){
  C('<div class="card"><h2>Rate list <span class="hint" id="syncState" style="font-weight:500"></span></h2><p class="hint" style="margin:-.5rem 0 1rem">Pick these in the Description box of any document — the rate fills in by itself.</p><div id="rRows"></div><div class="bar" style="justify-content:space-between"><button class="btn sm" data-perm="rates.edit" onclick="rtAdd()">+ Add item</button><button class="btn pri" onclick="rtSave(this)">Save rate list</button></div></div>');
  drawRates();
};
window.drawRates = drawRates;
function drawRates(){
  const pg = pageOf('rates', (V.rates || []).map((r, i) => [r, i]));
  document.getElementById('rRows').innerHTML = '<div class="r rhead" style="grid-template-columns:40px 1fr 130px 120px auto"><span>Sr.</span><span>Item</span><span>Charged</span><span>Rate ₹</span><span></span></div>' + pg.rows.map(([r, i], j) => '<div class="r" style="grid-template-columns:40px 1fr 130px 120px auto"><span class="sr">' + (pg.from + j + 1) + '</span><input aria-label="Item" value="' + esc(r.desc) + '" oninput="V_rate(' + i + ',\'desc\',this.value)"/><select aria-label="Charged" onchange="V_rate(' + i + ',\'unit\',this.value)"><option value="sqft"' + (r.unit === 'sqft' ? ' selected' : '') + '>per sq ft</option><option value="nos"' + (r.unit === 'nos' ? ' selected' : '') + '>per piece</option><option value="lump"' + (r.unit === 'lump' ? ' selected' : '') + '>fixed price</option></select><input aria-label="Rate" inputmode="decimal" value="' + esc(r.rate) + '" oninput="V_rate(' + i + ',\'rate\',this.value)"/><button class="btn sm danger" data-perm="rates.edit" onclick="rtDel(' + i + ')">Remove</button></div>').join('');
  pgMount(document.getElementById('rRows'), pg, 'drawRates');
}
window.V_rate = (i, k, v) => { V.rates[i][k] = k === 'rate' ? (Number(v) || v) : v; setSync('Unsaved changes'); };
window.rtAdd = () => { V.rates.push({id: Date.now(), desc: '', unit: 'sqft', rate: ''}); PGS.rates && (PGS.rates.p = 1e9); drawRates(); const ins = document.querySelectorAll('#rRows input[aria-label=Item]'); ins[ins.length - 1].focus(); };
window.rtDel = i => { V.rates.splice(i, 1); drawRates(); setSync('Unsaved changes'); };
window.rtSave = async b => { V.rates = V.rates.filter(r => r.desc.trim()); b.disabled = true; await saveVault(true); b.disabled = false; toast('Rate list saved.'); drawRates(); };

/* ── letterhead ── */
window.pgLetterhead = function(){
  const L = DB.settings.letterhead = DB.settings.letterhead || {}, B = V.bank = V.bank || {};
  const f = (k, l, h = '') => '<div class="field"><label for="l_' + k + '">' + l + '</label><input id="l_' + k + '" data-l="' + k + '" value="' + esc(k === 'phone1' ? (L.phones || [])[0] : k === 'phone2' ? (L.phones || [])[1] : L[k] || '') + '"/>' + (h ? '<div class="hint">' + h + '</div>' : '') + '</div>';
  const b = (k, l) => '<div class="field"><label for="b_' + k + '">' + l + '</label><input id="b_' + k + '" data-b="' + k + '" value="' + esc(B[k] || '') + '"/></div>';
  C('<div class="docwrap"><div class="docform"><div class="card"><h2>Letterhead</h2>' + f('title', 'Name in the centre') + f('intro', 'Line under the name', 'e.g. SLIDING ALUMINIUM WINDOW, TEAKWOOD FURNITURE, SOFA, KAPAT') + f('address', 'Address') + '<div class="g2">' + f('phone1', 'Mobile 1') + f('phone2', 'Mobile 2') + f('email', 'Email') + f('website', 'Website') + '</div>' + f('footer_note', 'Footer message') + '<div class="bar"><button class="btn pri" onclick="publish(\'settings\',this)">Publish letterhead</button></div></div>' +
    '<div class="card"><h2>Private details <span class="hint" id="syncState" style="font-weight:500"></span></h2><p class="hint" style="margin:-.5rem 0 1rem">Shown only on bills and invoices. Stored encrypted, never on the public website.</p>' +
      '<div class="field"><label for="v_gstin">Your GSTIN (optional)</label><input id="v_gstin" value="' + esc(V.gstin || '') + '"/></div><div class="g2">' + b('name', 'Account name') + b('bank', 'Bank') + b('account', 'Account number') + b('ifsc', 'IFSC') + b('upi', 'UPI ID') + '</div><div class="bar"><button class="btn pri" onclick="lhSavePriv(this)">Save private details</button></div></div>' +
    '<div class="card"><h2>Default terms for new documents</h2>' + Object.entries(DT).map(([k, t]) => '<div class="field"><label for="t_' + k + '">' + t.label + ' — one per line</label><textarea id="t_' + k + '" data-t="' + k + '" style="min-height:' + (k === 'agreement' ? 160 : 90) + 'px">' + esc(((V.terms || DEF_TERMS)[k] || []).join('\n')) + '</textarea></div>').join('') + '<div class="bar"><button class="btn pri" onclick="lhSavePriv(this)">Save default terms</button></div></div></div>' +
    '<div class="docprev' + (innerWidth <= 1150 ? ' shut' : '') + '" id="docprev"><div class="prevhead"><b>Preview</b><button type="button" class="btn sm prevtoggle" aria-expanded="' + (innerWidth > 1150) + '" aria-controls="prevbox" onclick="togglePrev(this)">' + (innerWidth <= 1150 ? 'Show preview' : 'Hide preview') + '</button></div><div class="prevbox" id="prevbox"><div id="prev"></div></div></div></div>');
  const sample = () => { const s = V.docs.find(d => d.type === 'quotation') || sampleQuote(); document.getElementById('prev').innerHTML = D.render(s, letterheadData(), {bank: V.bank}); fitPreview(); };
  document.querySelectorAll('[data-l]').forEach(el => el.oninput = () => { const k = el.dataset.l; if (k === 'phone1' || k === 'phone2') { L.phones = L.phones || ['', '']; L.phones[k === 'phone1' ? 0 : 1] = el.value; } else L[k] = el.value; markDirty('settings'); sample(); });
  document.querySelectorAll('[data-b]').forEach(el => el.oninput = () => { B[el.dataset.b] = el.value; setSync('Unsaved changes'); });
  document.getElementById('v_gstin').oninput = e => { V.gstin = e.target.value; setSync('Unsaved changes'); sample(); };
  document.querySelectorAll('[data-t]').forEach(el => el.oninput = () => { V.terms = V.terms || JSON.parse(JSON.stringify(DEF_TERMS)); V.terms[el.dataset.t] = el.value.split('\n').map(s => s.trim()).filter(Boolean); setSync('Unsaved changes'); });
  window.onresize = fitPreview; sample();
};
window.lhSavePriv = async b => { b.disabled = true; await saveVault(true); b.disabled = false; toast('Saved.'); };
window.vaultCount = () => V ? V.docs.length : 0;
})();
