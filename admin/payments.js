/* Payment requests + visiting card.
   Payment requests live in the encrypted documents store (VLT, from assets/doc/admin-docs.js), never on the public site.
   The PDF uses the same letterhead as quotations; the email is sent through the sign-in server (/pay/send) with the PDF
   (and the visiting card) attached; "Pay by UPI" opens /pay/ on the website, which only ever shows the business UPI ID. */
const PR_ST = { pending: ['Waiting for payment', 'warn'], paid: ['Paid', 'ok'], cancelled: ['Cancelled', ''] };
const PR_MODES = ['UPI', 'Bank transfer', 'Cash', 'Cheque'];
let PRQ = '', PRF = '', PRE = null;
const prV = () => window.VLT && VLT.data();
const prList = () => { const V = prV(); V.payments = V.payments || []; return V.payments; };
const prSum = r => (r.lines || []).reduce((s, l) => s + (+l.amount || 0), 0);
const prMoney = n => '₹' + Number(Math.round((+n || 0) * 100) / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 });
const prDate = d => DOCS.fmtDate(d);
const UPI_RE = /^[\w.\-]{2,256}@[a-zA-Z][\w.\-]{1,64}$/;
function prPayee() { const P = DB.settings.payment || {}, B = (prV() && prV().bank) || {}, L = DB.settings.letterhead || {}; return { upi: String(P.upi || B.upi || '').trim(), name: String(P.name || B.name || L.title || DB.settings.name || '').trim() }; }
function prNo() { const V = prV(); V.counters = V.counters || {}; const n = (V.counters.payment || 0) + 1; V.counters.payment = n; return 'PR-' + new Date().getFullYear() + '-' + String(n).padStart(3, '0'); }
const prNote = r => String((r.no || '') + ' ' + (r.title || 'Payment')).replace(/[^\w .,\-\/]/g, '').trim().slice(0, 50);
/* upi://pay link (the QR code holds this). Most UPI apps want the @ in pa unencoded. */
function prUpiLink(r) { const u = prPayee(), e = encodeURIComponent; return 'upi://pay?pa=' + u.upi + '&pn=' + e(u.name.slice(0, 40)) + '&am=' + prSum(r).toFixed(2) + '&cu=INR&tn=' + e(prNote(r)) + '&tr=' + e(r.no || ''); }
function prPayLink(r) { const site = (DB.settings.site_url || 'https://www.mumbai-interior.in').replace(/\/$/, ''); return site + '/pay/?am=' + prSum(r).toFixed(2).replace(/\.00$/, '') + '&n=' + encodeURIComponent(r.no || '') + '&f=' + encodeURIComponent(String(r.title || '').slice(0, 60)); }
function prQR(text, cell) { try { const q = qrcode(0, 'M'); q.addData(text); q.make(); return q.createDataURL(cell || 6, 2); } catch (e) { return ''; } }

/* ── A4 payment request (same letterhead as quotations) ── */
function prDoc(r, opt) {
  opt = opt || {}; const L = VLT.lh(), u = prPayee(), t = prSum(r), B = (prV() && prV().bank) || {}, esc2 = DOCS.esc;
  const meta = '<div class="meta"><div class="box"><b class="k">Payment requested from</b><div class="nm">' + esc2(r.client || '—') + '</div>' + (r.client_phone ? '<div>Mob: ' + esc2(r.client_phone) + '</div>' : '') + (r.client_email ? '<div>' + esc2(r.client_email) + '</div>' : '') + (r.client_address ? '<div>' + esc2(r.client_address) + '</div>' : '') + '</div>' +
    '<div class="box"><dl class="kv">' + [['Request No.', r.no || 'PR-…'], ['Date', prDate(r.date)], ['Pay by', prDate(r.due)], ['Reference', r.ref]].filter(x => x[1]).map(x => '<dt>' + x[0] + '</dt><dd>' + esc2(x[1]) + '</dd>').join('') + '</dl></div></div>';
  const intro = r.intro || ('Dear ' + (r.client || 'Sir / Madam') + ', please find below our request for payment' + (r.ref ? ' against ' + r.ref : '') + '. You can pay by scanning the UPI QR code with any UPI app, or by bank transfer.');
  const rows = (r.lines || []).filter(l => l.desc || +l.amount).map((l, i) => '<tr><td class="n">' + (i + 1) + '</td><td>' + esc2(l.desc) + '</td><td class="n">' + DOCS.inr(+l.amount || 0) + '</td></tr>').join('');
  const ctx = +r.work_total ? '<div class="ctx"><div><b>Total work value</b><span>' + prMoney(r.work_total) + '</span></div><div><b>Received so far</b><span>' + prMoney(r.received || 0) + '</span></div><div><b>This request</b><span>' + prMoney(t) + '</span></div><div><b>Balance after this</b><span>' + prMoney(Math.max(0, (+r.work_total) - (+r.received || 0) - t)) + '</span></div></div>' : '';
  const qr = u.upi && UPI_RE.test(u.upi) && t > 0 ? prQR(prUpiLink(r), 6) : '';
  const pay = '<div class="pay">' + (qr ? '<div class="qr"><img src="' + qr + '" alt="UPI QR code"/><small>Scan to pay ' + prMoney(t) + '</small></div>' : '<div class="qr"><small>Add your UPI ID in Payment requests → Settings to show a QR code here.</small></div>') +
    '<div><h4>Pay by UPI</h4><div class="amt">' + prMoney(t) + '</div>' + (u.upi ? '<div>UPI ID: <span class="upi">' + esc2(u.upi) + '</span></div><div>Name: <b>' + esc2(u.name) + '</b></div>' : '') +
    '<div class="apps">Scan with Google Pay, PhonePe, Paytm, BHIM or your bank\'s UPI app. Please write <b>' + esc2(r.no || '') + '</b> in the payment note.</div></div></div>';
  const bank = [['Account name', B.name], ['Bank', B.bank], ['Account no.', B.account], ['IFSC', B.ifsc]].filter(x => x[1]);
  return '<div class="docpage">' + (r.status === 'paid' ? '<div class="stamp paid">PAID</div>' : r.status === 'cancelled' ? '<div class="stamp">CANCELLED</div>' : '') + DOCS.letterhead(L) +
    '<div class="dtitle"><span>Payment Request</span></div>' + meta + '<p class="para">' + esc2(intro) + '</p>' + ctx +
    '<table class="items"><thead><tr><th class="n" style="width:36px">#</th><th>Description</th><th class="n" style="width:140px">Amount (₹)</th></tr></thead><tbody>' + rows + '</tbody></table>' +
    '<div class="sum"><div class="words"><b>Amount in words</b>' + DOCS.words(t) + '</div><div class="tot"><div class="grand"><span>Amount payable</span><span>' + prMoney(t) + '</span></div>' + (r.due ? '<div><span>Please pay by</span><span>' + esc2(prDate(r.due)) + '</span></div>' : '') + '</div></div>' +
    pay + (bank.length ? '<h3 class="sec">Or pay by bank transfer</h3><dl class="bank">' + bank.map(x => '<dt>' + x[0] + '</dt><dd>' + esc2(x[1]) + '</dd>').join('') + '</dl>' : '') +
    (r.notes ? '<h3 class="sec">Notes</h3><p class="para">' + esc2(r.notes) + '</p>' : '') +
    (r.status === 'paid' && r.paid_on ? '<p class="para"><b>Received with thanks</b> on ' + esc2(prDate(r.paid_on)) + (r.paid_mode ? ' by ' + esc2(r.paid_mode) : '') + (r.paid_ref ? ' (ref. ' + esc2(r.paid_ref) + ')' : '') + '.</p>' : '') +
    '<div class="grow"></div><div class="signs"><div class="sign"></div><div class="sign" style="text-align:right"><div class="line">For ' + esc2(L.title) + '<small>Authorised signatory</small></div></div></div>' + DOCS.footer(L, { footer_note: r.footer_note || 'Thank you for your business!' }) + '</div>';
}
const prFile = r => ('Payment-Request-' + (r.no || 'draft') + '-' + (r.client || '')).replace(/[^\w\-]+/g, '-').replace(/-+/g, '-').replace(/-$/, '');
/* render HTML off-screen and get a PDF (base64 or download) via html2pdf */
async function prPDF(r, mode) {
  const host = document.createElement('div'); host.style.cssText = 'position:absolute;left:0;top:0;width:794px;z-index:-1;pointer-events:none'; host.innerHTML = prDoc(r); document.body.appendChild(host);
  try { await document.fonts.ready; await Promise.all([...host.querySelectorAll('img')].map(i => i.complete ? 0 : new Promise(res => { i.onload = i.onerror = res; })));
    const w = html2pdf().set({ margin: [28, 0, 26, 0], filename: prFile(r) + '.pdf', image: { type: 'jpeg', quality: .95 }, html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff', scrollX: 0, scrollY: 0, windowWidth: 794, x: 0, y: 0 }, jsPDF: { unit: 'px', format: [794, 1123], hotfixes: ['px_scaling'] }, pagebreak: { mode: ['css', 'legacy'], avoid: ['tr', '.signs', '.foot', '.sum', '.meta', '.pay', 'h3.sec'] } }).from(host.firstElementChild);
    if (mode === 'save') return await w.save();
    return (await w.outputPdf('datauristring')).split(',')[1];
  } finally { host.remove(); document.querySelectorAll('.html2pdf__overlay').forEach(o => o.remove()); }
}


/* public payment status for the website's /pay/ page: only a hash of "request no.|amount" → paid / cancelled.
   No names, phone numbers or other customer details are published. */
async function prKey(r) { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(r.no) + '|' + prSum(r).toFixed(2))); return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('').slice(0, 24); }
async function prPublishStatus(r) {
  const cfg = gh(); if (!cfg || !cfg.token || !r.no) return;
  try {
    let cur = {}, sha; try { const j = await ghApi(cfg, '/contents/data/payreq.json?ref=' + encodeURIComponent(cfg.branch)); sha = j.sha; cur = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(j.content.replace(/\s/g, '')), c => c.charCodeAt(0)))) || {}; } catch (e) { if (e.status !== 404) throw e; }
    const k = await prKey(r);
    if (r.status === 'paid') cur[k] = { s: 'paid', d: r.paid_on || VLT.today() }; else if (r.status === 'cancelled') cur[k] = { s: 'cancelled' }; else delete cur[k];
    await ghPutRaw(cfg, 'data/payreq.json', b64(JSON.stringify(cur, null, 1) + '\n'), 'Update payment status');
  } catch (e) { toast('Saved, but the website\'s payment page could not be updated: ' + (e.message || e), true); }
}

/* ── list ── */
function pgPayments() {
  if (!prV()) { C('<div class="card"><h2>Documents are locked</h2><p>Sign out and sign in again to open payment requests.</p></div>'); return; }
  const L = prList(), u = prPayee(), mon = new Date().toISOString().slice(0, 7);
  const wait = L.filter(r => r.status === 'pending'), got = L.filter(r => r.status === 'paid' && String(r.paid_on || '').startsWith(mon));
  C('<div class="stats prstats"><div class="stat"><b>' + prMoney(wait.reduce((s, r) => s + prSum(r), 0)) + '</b><span>Waiting · ' + wait.length + ' request' + (wait.length === 1 ? '' : 's') + '</span></div><div class="stat"><b>' + prMoney(got.reduce((s, r) => s + prSum(r), 0)) + '</b><span>Received this month</span></div>' +
    '<div class="stat"><b>' + (u.upi ? esc(u.upi) : 'Not set') + '</b><span>UPI ID for payments</span></div></div>' +
    (u.upi ? '' : '<div class="msg warn">Add your UPI ID below so payment requests can show a QR code and a Pay button.</div>') +
    '<div class="card"><h2>Payment requests <span><span class="hint" id="syncState" style="font-weight:500"></span> <a class="btn sm pri" data-perm="payments.add" href="#payments/new">New payment request</a></span></h2>' +
    '<div class="tools"><input type="search" placeholder="Search customer or number" aria-label="Search payment requests" value="' + esc(PRQ) + '" oninput="PRQ=this.value;drawPayments()"/><select class="keep" aria-label="Status" onchange="PRF=this.value;drawPayments()"><option value="">All</option>' + Object.entries(PR_ST).map(([k, v]) => '<option value="' + k + '"' + (PRF === k ? ' selected' : '') + '>' + v[0] + '</option>').join('') + '</select></div>' +
    '<div class="tw"><table><thead><tr><th class="sr">Sr.</th><th>No.</th><th>Customer</th><th class="hide-m">Date</th><th>Amount</th><th class="hide-m">Status</th><th><span hidden>Actions</span></th></tr></thead><tbody id="prRows"></tbody></table></div></div>' +
    '<div class="card"><h2>Payment settings</h2><p class="hint" style="margin:-.4rem 0 .9rem">This UPI ID is shown on payment requests and on the website\'s payment page. It is your business UPI ID, so it is fine to show publicly.</p><div class="g2">' +
    '<div class="field"><label for="ps_upi">UPI ID</label><input id="ps_upi" value="' + esc((DB.settings.payment || {}).upi || u.upi) + '" placeholder="e.g. mumbaiinterior@okhdfcbank" autocomplete="off"/></div>' +
    '<div class="field"><label for="ps_name">Name shown to the payer</label><input id="ps_name" value="' + esc((DB.settings.payment || {}).name || u.name) + '" placeholder="Name on the bank account"/><div class="hint">Use the name on the bank account linked to this UPI ID.</div></div></div>' +
    '<div class="bar"><button class="btn pri" data-perm="letterhead.edit|card.edit" onclick="prSaveSettings(this)">Save and publish</button></div></div>');
  drawPayments(); applyPerms();
}
function drawPayments() {
  const q = PRQ.toLowerCase(), L = prList().map((r, i) => [r, i]).filter(([r]) => (!PRF || r.status === PRF) && (!q || (r.no + ' ' + r.client + ' ' + (r.client_phone || '') + ' ' + (r.title || '')).toLowerCase().includes(q))).sort((a, b) => String(b[0].date).localeCompare(String(a[0].date)) || (b[0].created || 0) - (a[0].created || 0));
  const pg = pageOf('payments', L, q + '|' + PRF), today = VLT.today();
  $('prRows').innerHTML = L.length ? pg.rows.map(([r, i], j) => { const st = PR_ST[r.status] || PR_ST.pending, late = r.status === 'pending' && r.due && r.due < today;
    return '<tr>' + sr(pg, j) + '<td><b>' + esc(r.no) + '</b></td><td><div class="t">' + esc(r.client || '—') + '</div><div class="s">' + esc(r.title || '') + (r.sent ? ' · sent ' + esc(prDate(r.sent.slice(0, 10))) : '') + '</div></td><td class="hide-m">' + esc(prDate(r.date)) + '</td><td><b>' + prMoney(prSum(r)) + '</b></td>' +
      '<td class="hide-m"><span class="pill ' + (late ? 'bad' : st[1]) + '">' + (late ? 'Overdue' : st[0]) + '</span></td><td><div class="acts-cell"><a class="btn sm" href="#payments/' + r.id + '">Open</a>' + (r.status === 'pending' ? '<button class="btn sm" data-perm="payments.edit" onclick="prMarkPaid(\'' + r.id + '\')">Mark paid</button>' : '') + '<button class="btn sm danger" data-perm="payments.delete" onclick="prDel(\'' + r.id + '\')">Delete</button></div></td></tr>'; }).join('')
    : '<tr><td colspan="7" class="empty">No payment requests yet. Press <b>New payment request</b>, or open a quotation or bill and press <b>Request payment</b>.</td></tr>';
  pgMount($('prRows'), pg, 'drawPayments'); applyPerms();
}
async function prSaveSettings(btn) {
  const upi = $('ps_upi').value.trim(), name = $('ps_name').value.trim();
  if (upi && !UPI_RE.test(upi)) { toast('That doesn\'t look like a UPI ID. It looks like name@bank, e.g. 9004200401@okicici.', true); $('ps_upi').focus(); return; }
  DB.settings.payment = { upi, name }; markDirty('settings'); await publish('settings', btn); pgPayments();
}
async function prDel(id) { const L = prList(), r = L.find(x => x.id === id); if (!await confirmBox('Delete payment request?', 'Delete ' + r.no + ' for ' + (r.client || 'this customer') + '? This can\'t be undone.')) return; L.splice(L.indexOf(r), 1); await VLT.save(true); if (r.status !== 'pending') await prPublishStatus({ ...r, status: 'pending' }); drawPayments(); toast('Deleted.'); }
async function prMarkPaid(id, fromEditor) {
  const r = prList().find(x => x.id === id) || PRE; if (!r) return;
  const box = document.createElement('div'); box.className = 'modal'; box.innerHTML = '<div class="box" role="dialog" aria-modal="true" aria-labelledby="mpT"><h2 id="mpT">Mark ' + esc(r.no) + ' as paid</h2><p>' + prMoney(prSum(r)) + ' from ' + esc(r.client || 'customer') + '</p><div class="g2"><div class="field"><label for="mp_d">Received on</label><input id="mp_d" type="date" value="' + VLT.today() + '"/></div><div class="field"><label for="mp_m">Paid by</label><select id="mp_m">' + PR_MODES.map(m => '<option>' + m + '</option>').join('') + '</select></div></div><div class="field"><label for="mp_r">Transaction / UTR number (optional)</label><input id="mp_r" placeholder="e.g. 431245678901"/></div><div class="bar"><button class="btn" id="mp_no">Cancel</button><button class="btn pri" id="mp_ok">Mark as paid</button></div></div>';
  document.body.appendChild(box); $('mp_d').focus();
  await new Promise(res => { $('mp_no').onclick = () => { box.remove(); res(); }; $('mp_ok').onclick = async () => { Object.assign(r, { status: 'paid', paid_on: $('mp_d').value || VLT.today(), paid_mode: $('mp_m').value, paid_ref: $('mp_r').value.trim(), updated: Date.now() }); const real = prList().find(x => x.id === r.id); if (real && real !== r) Object.assign(real, r); box.remove(); await VLT.save(true); await prPublishStatus(r); toast('Marked as paid. The payment page now shows it as paid.'); res(); }; });
  if (fromEditor) pgPayReq(r.id); else drawPayments();
}

/* ── editor ── */
function pgPayReq(arg) {
  if (!prV()) { pgPayments(); return; }
  const V = prV(), today = VLT.today();
  if (arg === 'new' || arg.startsWith('from-')) {
    PRE = { id: 'p' + Date.now().toString(36), no: '', date: today, due: '', status: 'pending', client: '', client_phone: '', client_email: '', client_address: '', ref: '', title: 'Advance payment', lines: [{ desc: 'Advance payment for interior work', amount: '' }], work_total: '', received: '', intro: '', notes: '', attach_card: true, isNew: true };
    const d = arg.startsWith('from-') && (V.docs || []).find(x => x.id === arg.slice(5)); if (d) prFromDoc(d);
  } else { const r = prList().find(x => x.id === arg); if (!r) { location.hash = 'payments'; return; } PRE = JSON.parse(JSON.stringify(r)); }
  $('pTitle').textContent = PRE.isNew ? 'New payment request' : 'Payment request ' + PRE.no;
  const f = (k, l, t, ph, h) => '<div class="field"><label for="pr_' + k + '">' + l + '</label><input id="pr_' + k + '" data-p="' + k + '" type="' + (t || 'text') + '" value="' + esc(PRE[k] ?? '') + '" placeholder="' + esc(ph || '') + '"' + (t === 'number' ? ' min="0" step="any" inputmode="decimal"' : '') + '/>' + (h ? '<div class="hint">' + h + '</div>' : '') + '</div>';
  const docs = (V.docs || []).filter(d => d.type !== 'agreement').slice().sort((a, b) => (b.updated || 0) - (a.updated || 0));
  C('<div class="docwrap"><div class="docform">' +
    (PRE.isNew && docs.length ? '<div class="card"><h2>Start from a quotation or bill</h2><select id="pr_doc" class="keep" aria-label="Start from a document" onchange="prPickDoc(this.value)"><option value="">Choose a document (optional)…</option>' + docs.map(d => '<option value="' + d.id + '">' + esc(d.no + ' · ' + (d.client || '') + ' · ' + DOCS.rs(VLT.docTotal(d).grand)) + '</option>').join('') + '</select><p class="hint">Fills in the customer, the reference and the work value.</p></div>' : '') +
    '<div class="card"><h2>Customer <span class="hint" id="syncState" style="font-weight:500"></span></h2><div class="g2">' + f('client', 'Customer name') + f('client_phone', 'Mobile (for WhatsApp)', 'tel', '10-digit mobile') + f('client_email', 'Email', 'email', 'customer@example.com', 'The request is emailed here.') + f('client_address', 'Address (optional)') + '</div></div>' +
    '<div class="card"><h2>Request</h2><div class="g3">' + f('no', 'Request number', 'text', 'Made automatically') + f('date', 'Date', 'date') + f('due', 'Pay by (optional)', 'date') + '</div><div class="g2">' + f('title', 'What is it for', 'text', 'e.g. Advance payment, 2nd stage payment') + f('ref', 'Reference (optional)', 'text', 'e.g. Quotation Q-2026-004') + '</div>' +
      '<label>Amount</label><div id="prLines"></div><div class="bar" style="justify-content:space-between"><button type="button" class="btn sm" onclick="prLineAdd()">+ Add line</button><b id="prTot"></b></div>' +
      '<details class="prctx"' + (+PRE.work_total ? ' open' : '') + '><summary>Show the work value and amount already received (optional)</summary><div class="g2">' + f('work_total', 'Total work value (₹)', 'number') + f('received', 'Received so far (₹)', 'number') + '</div></details></div>' +
    '<div class="card"><h2>Message</h2><div class="field"><label for="pr_intro">Message to the customer (optional)</label><textarea id="pr_intro" data-p="intro" style="min-height:70px" placeholder="Leave empty for the standard message">' + esc(PRE.intro || '') + '</textarea></div><div class="field"><label for="pr_notes">Notes on the PDF (optional)</label><textarea id="pr_notes" data-p="notes" style="min-height:60px">' + esc(PRE.notes || '') + '</textarea></div>' +
      '<div class="check"><input type="checkbox" id="pr_card"' + (PRE.attach_card !== false ? ' checked' : '') + '/><label for="pr_card">Attach my visiting card to the email</label></div></div>' +
    (PRE.status === 'paid' ? '<div class="msg ok">Paid on ' + esc(prDate(PRE.paid_on)) + (PRE.paid_mode ? ' by ' + esc(PRE.paid_mode) : '') + (PRE.paid_ref ? ' · ref. ' + esc(PRE.paid_ref) : '') + '.</div>' : '') +
    (PRE.log && PRE.log.length ? '<div class="card"><h2>History</h2><ul class="prlog">' + PRE.log.slice().reverse().map(l => '<li><b>' + esc(new Date(l.t).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })) + '</b> ' + esc(l.what) + '</li>').join('') + '</ul></div>' : '') +
    '<div class="docbar"><a class="btn" href="#payments">Back</a><button class="btn pri" data-perm="payments.add|payments.edit" onclick="prSave(this)">Save</button><button class="btn pri" data-perm="payments.send" onclick="prSend(this)">Send email</button><button class="btn" onclick="prWhatsApp()">WhatsApp</button><button class="btn" onclick="prCopyLink()">Copy pay link</button><button class="btn" onclick="prDownload(this)">Download PDF</button>' +
      (PRE.status === 'pending' && !PRE.isNew ? '<button class="btn" data-perm="payments.edit" onclick="prMarkPaid(\'' + PRE.id + '\',1)">Mark paid</button>' : '') + (PRE.status === 'pending' && !PRE.isNew ? '<button class="btn" data-perm="payments.edit" onclick="prCancel()">Cancel request</button>' : '') + '</div>' +
    '</div><div class="docprev' + (innerWidth <= 1150 ? ' shut' : '') + '" id="docprev"><div class="prevhead"><b>Preview</b><span class="hint" style="margin:0">A4 · updates as you type</span><button type="button" class="btn sm prevtoggle" aria-expanded="' + (innerWidth > 1150) + '" aria-controls="prevbox" onclick="togglePrev(this)">' + (innerWidth <= 1150 ? 'Show preview' : 'Hide preview') + '</button></div><div class="prevbox" id="prevbox"><div id="prev"></div></div></div></div>');
  document.querySelectorAll('[data-p]').forEach(el => el.oninput = el.onchange = () => { PRE[el.dataset.p] = el.value; prDirty(); });
  $('pr_card').onchange = e => { PRE.attach_card = e.target.checked; prDirty(); };
  prDrawLines(); prPrev(); VLT.sync(PRE.isNew ? 'Not saved yet' : ''); window.onresize = VLT.fit;
}
function prFromDoc(d) { const t = VLT.docTotal(d); Object.assign(PRE, { client: d.client || '', client_phone: d.client_phone || '', client_address: d.client_address || '', ref: (DOCS.TYPES[d.type] || {}).label + ' ' + d.no, work_total: t.grand || '', received: t.paid || '' });
  const bal = Math.max(0, (t.grand || 0) - (t.paid || 0)); PRE.title = t.paid ? 'Balance payment' : 'Advance payment'; PRE.lines = [{ desc: (t.paid ? 'Balance payment' : 'Advance payment') + ' for ' + ((DOCS.TYPES[d.type] || {}).label || 'work').toLowerCase() + ' ' + d.no, amount: d.type === 'quotation' && !t.paid ? Math.round((t.grand || 0) * .4) : bal }]; }
function prPickDoc(id) { const d = (prV().docs || []).find(x => x.id === id); if (!d) return; prFromDoc(d);
  document.querySelectorAll('[data-p]').forEach(el => { el.value = PRE[el.dataset.p] ?? ''; }); const det = document.querySelector('.prctx'); if (det && +PRE.work_total) det.open = true; prDrawLines(); prDirty(); toast('Filled in from ' + d.no + '. Check the amount.'); }
function prDrawLines() {
  $('prLines').innerHTML = (PRE.lines || []).map((l, i) => '<div class="prline"><input aria-label="Description" placeholder="e.g. Advance for wardrobe and kitchen work" value="' + esc(l.desc || '') + '" oninput="PRE.lines[' + i + '].desc=this.value;prDirty()"/><input aria-label="Amount in rupees" type="number" min="0" step="any" inputmode="decimal" placeholder="₹" value="' + esc(l.amount ?? '') + '" oninput="PRE.lines[' + i + '].amount=this.value;prDirty()"/>' + (PRE.lines.length > 1 ? '<button type="button" class="btn sm danger" aria-label="Remove line ' + (i + 1) + '" onclick="PRE.lines.splice(' + i + ',1);prDrawLines();prDirty()">✕</button>' : '<span></span>') + '</div>').join('');
  prTot();
}
function prLineAdd() { PRE.lines.push({ desc: '', amount: '' }); prDrawLines(); $('prLines').querySelector('.prline:last-child input').focus(); }
function prTot() { const t = $('prTot'); if (t) t.textContent = 'Total ' + prMoney(prSum(PRE)); }
let prT = 0; function prDirty() { VLT.sync('Unsaved changes'); prTot(); clearTimeout(prT); prT = setTimeout(prPrev, 150); }
function prPrev() { const p = $('prev'); if (!p) return; p.innerHTML = prDoc({ ...PRE, no: PRE.no || 'PR-' + new Date().getFullYear() + '-…' }); VLT.fit(); }
function prCheck(forSend) {
  if (!String(PRE.client || '').trim()) { toast('Enter the customer name.', true); $('pr_client').focus(); return false; }
  if (!(prSum(PRE) > 0)) { toast('Enter the amount to request.', true); const a = $('prLines').querySelector('input[type=number]'); a && a.focus(); return false; }
  if (forSend === 'email' && !/^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/.test(String(PRE.client_email || '').trim())) { toast('Enter the customer\'s email address.', true); $('pr_client_email').focus(); return false; }
  if (forSend === 'wa' && String(PRE.client_phone || '').replace(/\D/g, '').length < 10) { toast('Enter the customer\'s 10-digit mobile number.', true); $('pr_client_phone').focus(); return false; }
  return true;
}
async function prSave(btn, quiet) {
  if (!prCheck()) return false;
  const L = prList(); if (!PRE.no) PRE.no = prNo();
  const d = JSON.parse(JSON.stringify(PRE)); delete d.isNew; d.lines = d.lines.filter(l => l.desc || +l.amount); d.updated = Date.now(); d.created = d.created || Date.now();
  const i = L.findIndex(x => x.id === d.id); if (i < 0) L.push(d); else L[i] = d;
  PRE = JSON.parse(JSON.stringify(d)); if (btn) btn.disabled = true; await VLT.save(true); if (btn) btn.disabled = false;
  $('pTitle').textContent = 'Payment request ' + PRE.no; if (location.hash !== '#payments/' + PRE.id) history.replaceState(null, '', '#payments/' + PRE.id);
  if (!quiet) toast('Saved.'); prPrev(); return true;
}
function prLog(what) { const r = prList().find(x => x.id === PRE.id); const e = { t: Date.now(), what }; PRE.log = (PRE.log || []).concat(e); if (r) r.log = PRE.log; }
async function prDownload(btn) { if (!prCheck()) return; if (PRE.isNew && !await prSave(null, 1)) return; const l = btn.innerHTML; btn.disabled = true; btn.innerHTML = '<span class="spin"></span>Making PDF…'; try { await prPDF(PRE, 'save'); toast('PDF downloaded.'); } catch (e) { toast('Couldn\'t make the PDF.', true); } finally { btn.disabled = false; btn.innerHTML = l; } }
async function prCopyLink() { if (!prCheck()) return; if (PRE.isNew && !await prSave(null, 1)) return; if (!prPayee().upi) { toast('Add your UPI ID in Payment requests → Payment settings first.', true); return; } try { await navigator.clipboard.writeText(prPayLink(PRE)); toast('Pay link copied. Paste it in any chat.'); } catch (e) { prompt('Copy this link:', prPayLink(PRE)); } }
async function prCancel() { if (!await confirmBox('Cancel this request?', 'Mark ' + PRE.no + ' as cancelled? The customer is not told automatically.', 'Cancel request')) return; PRE.status = 'cancelled'; prLog('Cancelled'); await prSave(null, 1); await prPublishStatus(PRE); toast('Request cancelled.'); pgPayReq(PRE.id); }
function prMsg() { const u = prPayee(), C2 = DB.settings.card || {}; return 'Namaste ' + (PRE.client || '') + ',\n\nPayment request ' + PRE.no + ' from ' + (DB.settings.name || 'Mumbai Interior') + (PRE.title ? ' — ' + PRE.title : '') + '\nAmount: ' + prMoney(prSum(PRE)) + (PRE.due ? '\nPlease pay by: ' + prDate(PRE.due) : '') + (PRE.ref ? '\nReference: ' + PRE.ref : '') +
  (u.upi ? '\n\nPay by UPI (Google Pay, PhonePe, Paytm, BHIM):\n' + prPayLink(PRE) + '\nUPI ID: ' + u.upi : '') + '\n\nThank you,\n' + (C2.name || u.name || '') + '\n' + (DB.settings.name || 'Mumbai Interior') + ' · ' + ((DB.settings.letterhead || {}).phones || [DB.settings.phone]).filter(Boolean).join(' / '); }
async function prWhatsApp() { if (!prCheck('wa')) return; if (!await prSave(null, 1)) return; let n = String(PRE.client_phone).replace(/\D/g, ''); if (n.length === 10) n = '91' + n; prLog('Shared on WhatsApp'); await VLT.save(); window.open('https://wa.me/' + n + '?text=' + encodeURIComponent(prMsg()), '_blank', 'noopener'); toast('WhatsApp opened. Attach the PDF there if you like — use Download PDF.'); }
async function prSend(btn) {
  if (!prCheck('email')) return; if (typeof api !== 'function' || typeof SERVER !== 'function' || !SERVER()) { toast('Sending email needs the sign-in server. Use Download PDF and send it from your mail, or WhatsApp.', true); return; }
  if (!prPayee().upi && !await confirmBox('No UPI ID yet', 'Your UPI ID is not set, so the email will have no Pay button or QR code. Send anyway?', 'Send anyway')) return;
  if (!await prSave(null, 1)) return;
  const label = btn.innerHTML; btn.disabled = true; btn.innerHTML = '<span class="spin"></span>Preparing…';
  try {
    const files = [{ name: prFile(PRE) + '.pdf', b64: await prPDF(PRE) }];
    if (PRE.attach_card !== false) { btn.innerHTML = '<span class="spin"></span>Adding card…'; const c = await cardImage('front').catch(() => null); if (c) files.push({ name: 'Visiting-card.png', b64: c }); }
    btn.innerHTML = '<span class="spin"></span>Sending…';
    const r = await api('/pay/send', { to: String(PRE.client_email).trim(), subject: 'Payment request ' + PRE.no + ' · ' + prMoney(prSum(PRE)) + ' · ' + (DB.settings.name || 'Mumbai Interior'), preheader: 'Please pay ' + prMoney(prSum(PRE)) + (PRE.due ? ' by ' + prDate(PRE.due) : '') + ' — pay by UPI in one tap.', content: prMailHTML(), attachments: files });
    PRE.sent = new Date().toISOString(); prLog('Emailed to ' + PRE.client_email + (r && r.from ? ' from ' + r.from : '')); await prSave(null, 1); toast('Payment request emailed to ' + PRE.client_email + '.'); pgPayReq(PRE.id);
  } catch (e) { toast(e.message || 'Couldn\'t send the email.', true); } finally { btn.disabled = false; btn.innerHTML = label; }
}
/* email body (goes inside the branded header/footer the server adds); inline styles only, email-client safe */
function prMailHTML() {
  const u = prPayee(), C2 = DB.settings.card || {}, L = DB.settings.letterhead || {}, B = (prV() && prV().bank) || {}, t = prSum(PRE), e = DOCS.esc, ink = '#1F2A22', muted = '#5B675D', line = '#E3E6DD';
  const row = (k, v, strong) => v ? '<tr><td style="padding:9px 14px;border-top:1px solid ' + line + ';color:' + muted + ';font-size:13px;width:38%">' + k + '</td><td style="padding:9px 14px;border-top:1px solid ' + line + ';color:' + ink + ';font-size:14px;' + (strong ? 'font-weight:700' : '') + '">' + v + '</td></tr>' : '';
  const lines = (PRE.lines || []).filter(l => l.desc || +l.amount).map(l => '<tr><td style="padding:7px 14px;border-top:1px solid ' + line + ';font-size:14px;color:' + ink + '">' + e(l.desc) + '</td><td style="padding:7px 14px;border-top:1px solid ' + line + ';font-size:14px;color:' + ink + ';text-align:right;white-space:nowrap">' + prMoney(+l.amount || 0) + '</td></tr>').join('');
  const intro = PRE.intro ? e(PRE.intro).replace(/\n/g, '<br>') : 'Please find our payment request below' + (PRE.ref ? ' for <b>' + e(PRE.ref) + '</b>' : '') + '. The full request is attached as a PDF.';
  return '<p style="margin:0 0 12px">Dear ' + e(PRE.client || 'Sir / Madam') + ',</p><p style="margin:0 0 16px">' + intro + '</p>' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid ' + line + ';border-radius:10px;margin:0 0 14px">' +
    '<tr><td colspan="2" style="padding:12px 14px;background:#F7F8F4;font-size:12px;letter-spacing:1px;text-transform:uppercase;color:' + muted + '">Payment request ' + e(PRE.no) + '</td></tr>' + lines +
    '<tr><td style="padding:12px 14px;border-top:2px solid ' + ink + ';font-weight:700;font-size:15px;color:' + ink + '">Amount payable</td><td style="padding:12px 14px;border-top:2px solid ' + ink + ';font-weight:800;font-size:20px;color:' + ink + ';text-align:right;white-space:nowrap">' + prMoney(t) + '</td></tr></table>' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 6px">' + row('Date', e(prDate(PRE.date))) + row('Please pay by', e(prDate(PRE.due)), 1) + row('For', e(PRE.title)) + row('Reference', e(PRE.ref)) + row('UPI ID', u.upi ? '<b>' + e(u.upi) + '</b> (' + e(u.name) + ')' : '') + '</table>' +
    (u.upi && UPI_RE.test(u.upi) ? '<div style="text-align:center;margin:22px 0 8px"><a href="' + e(prPayLink(PRE)) + '" style="display:inline-block;background:#1F8F4E;color:#ffffff;text-decoration:none;font-weight:700;font-size:17px;padding:14px 28px;border-radius:12px">Pay ' + prMoney(t) + ' by UPI</a>' +
      '<div style="font-size:12px;color:' + muted + ';margin-top:8px">Opens a secure page on ' + e((DB.settings.site_url || 'www.mumbai-interior.in').replace(/^https?:\/\//, '')) + ' with a QR code and your UPI apps.<br>Or scan the QR code in the attached PDF.</div></div>' : '') +
    ([B.account, B.ifsc].every(Boolean) ? '<p style="margin:16px 0 4px;font-size:13px;color:' + muted + '"><b style="color:' + ink + '">Bank transfer:</b> ' + e([B.name, B.bank, 'A/c ' + B.account, 'IFSC ' + B.ifsc].filter(Boolean).join(' · ')) + '</p>' : '') +
    '<p style="margin:16px 0 0;font-size:13px;color:' + muted + '">After paying, please reply to this email or WhatsApp us the payment screenshot with <b>' + e(PRE.no) + '</b>.</p>' +
    '<p style="margin:18px 0 0">Thank you,<br><b>' + e(C2.name || L.title || u.name) + '</b>' + (C2.role ? '<br><span style="color:' + muted + '">' + e(C2.role) + ', ' + e(C2.company || DB.settings.name || '') + '</span>' : '') + '<br><span style="color:' + muted + '">' + e(((C2.phones && C2.phones.length ? C2.phones : L.phones) || []).filter(Boolean).join(' · ')) + '</span></p>';
}

/* ── visiting card (data/settings.json → card; business details only, so it is public) ── */
const CARD_THEMES = { forest: ['Forest & gold', '#1F2A22', '#2F4A3A', '#E9C46A', '#ffffff'], maroon: ['Maroon & saffron (like the letterhead)', '#5E1717', '#7A1F1F', '#F0A54A', '#ffffff'], navy: ['Navy & silver', '#0E2747', '#123E7C', '#C9D3DF', '#ffffff'], white: ['White & forest', '#ffffff', '#F2F3EE', '#2F4A3A', '#1F2A22'] };
function cardData() {
  const S = DB.settings, L = S.letterhead || {}, T = (S.team || [])[0] || {};
  S.card = Object.assign({ name: T.name || L.title || '', role: T.role || 'Proprietor', company: S.name || 'Mumbai Interior', tagline: L.intro || S.tagline || '', phones: (L.phones || [S.phone]).filter(Boolean), email: L.email || S.email || '', website: L.website || (S.site_url || '').replace(/^https?:\/\//, ''), address: L.address || S.address || '', qr: 'contact', theme: 'forest', services: 'Interiors · Modular kitchens · Wardrobes · False ceiling · Aluminium · Repairs' }, S.card || {});
  return S.card;
}
function cardQRText(c) {
  const ph = (c.phones || []).filter(Boolean), web = c.website ? (/^https?:/.test(c.website) ? c.website : 'https://' + c.website) : '';
  if (c.qr === 'website') return web;
  if (c.qr === 'whatsapp') return 'https://wa.me/' + String(ph[0] || '').replace(/\D/g, '').replace(/^(\d{10})$/, '91$1');
  if (c.qr === 'upi' && prPayee().upi) return 'upi://pay?pa=' + prPayee().upi + '&pn=' + encodeURIComponent(prPayee().name) + '&cu=INR';
  const n = String(c.name || '').trim().split(/\s+/), esc3 = s => String(s || '').replace(/[,;\\]/g, m => '\\' + m);
  return ['BEGIN:VCARD', 'VERSION:3.0', 'N:' + esc3(n.slice(-1)[0]) + ';' + esc3(n.slice(0, -1).join(' ')), 'FN:' + esc3(c.name), 'ORG:' + esc3(c.company), c.role ? 'TITLE:' + esc3(c.role) : '', ...ph.map(p => 'TEL;TYPE=CELL:' + p.replace(/\s/g, '')), c.email ? 'EMAIL:' + c.email : '', web ? 'URL:' + web : '', c.address ? 'ADR;TYPE=WORK:;;' + esc3(c.address) + ';;;;' : '', 'END:VCARD'].filter(Boolean).join('\n');
}
const CARD_QR_LABEL = { contact: 'Scan to save my number', website: 'Scan to see our work', whatsapp: 'Scan to chat on WhatsApp', upi: 'Scan to pay by UPI' };
/* icons as small images (the picture export can't draw inline icons); coloured with the card's accent */
const ci = d => col => '<img class="vic" alt="" src="data:image/svg+xml;charset=utf-8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="' + col + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + d + '</svg>') + '"/>';
const CI = { phone: ci('<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/>'), mail: ci('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>'), web: ci('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>'), pin: ci('<path d="M12 22s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/>') };
function cardHTML(side, c) {
  c = c || cardData(); const T = CARD_THEMES[c.theme] || CARD_THEMES.forest, [, bg, bg2, acc, fg] = T, accl = 'rgba(' + [1, 3, 5].map(i => parseInt(acc.slice(i, i + 2), 16)).join(',') + ',.55)', e = DOCS.esc, light = c.theme === 'white';
  const logo = '<img class="vlogo" src="/assets/logo.png" alt=""/>';
  if (side === 'front') return '<div class="vcard" style="--bg:' + bg + ';--bg2:' + bg2 + ';--acc:' + acc + ';--accl:' + accl + ';--fg:' + fg + '"><div class="vleft">' + logo + '<div class="vco">' + e(c.company) + '</div><div class="vtag">' + e(c.tagline) + '</div></div>' +
    '<div class="vright"><div class="vname">' + e(c.name) + '</div><div class="vrole">' + e(c.role) + '</div><div class="vrule"></div><ul class="vlist">' + (c.phones || []).filter(Boolean).map(p => '<li>' + CI.phone(acc) + '<span>' + e(p) + '</span></li>').join('') +
    (c.email ? '<li>' + CI.mail(acc) + '<span>' + e(c.email) + '</span></li>' : '') + (c.website ? '<li>' + CI.web(acc) + '<span>' + e(c.website) + '</span></li>' : '') + (c.address ? '<li class="vaddr">' + CI.pin(acc) + '<span>' + e(c.address) + '</span></li>' : '') + '</ul></div><div class="vtape">' + '<i></i>'.repeat(86) + '</div></div>';
  const qr = prQR(cardQRText(c), 5);
  return '<div class="vcard back' + (light ? ' light' : '') + '" style="--bg:' + bg + ';--bg2:' + bg2 + ';--acc:' + acc + ';--fg:' + fg + '"><div class="vbl">' + logo + '<div class="vco big">' + e(c.company) + '</div><div class="vserv">' + e(c.services) + '</div><div class="vweb">' + e(c.website) + '</div></div>' +
    (qr ? '<div class="vqr"><img src="' + qr + '" alt="QR code"/><span>' + e(CARD_QR_LABEL[c.qr] || '') + '</span></div>' : '') + '<div class="vtape">' + '<i></i>'.repeat(86) + '</div></div>';
}
/* PNG (base64) of one side at 1050 × 600 px (3.5 × 2 in at 300 dpi) */
async function cardImage(side) {
  const host = document.createElement('div'); host.style.cssText = 'position:absolute;left:0;top:0;z-index:-1;pointer-events:none'; host.innerHTML = cardHTML(side); document.body.appendChild(host);
  try { await document.fonts.ready; await Promise.all([...host.querySelectorAll('img')].map(i => i.complete ? 0 : new Promise(r => { i.onload = i.onerror = r; })));
    const cv = await html2pdf().set({ margin: 0, jsPDF: { unit: 'px', format: [525, 300], orientation: 'landscape', hotfixes: ['px_scaling'] }, html2canvas: { scale: 2, backgroundColor: null, useCORS: true, scrollX: 0, scrollY: 0 } }).from(host.firstElementChild).toCanvas().get('canvas');
    return cv.toDataURL('image/png').split(',')[1];
  } finally { host.remove(); document.querySelectorAll('.html2pdf__overlay').forEach(o => o.remove()); }
}
function pgCard() {
  const c = cardData();
  const f = (k, l, ph, h) => '<div class="field"><label for="vc_' + k + '">' + l + '</label><input id="vc_' + k + '" data-c="' + k + '" value="' + esc(k === 'phone1' ? (c.phones || [])[0] || '' : k === 'phone2' ? (c.phones || [])[1] || '' : c[k] || '') + '" placeholder="' + esc(ph || '') + '"/>' + (h ? '<div class="hint">' + h + '</div>' : '') + '</div>';
  C('<div class="vcwrap"><div class="card"><h2>Your visiting card</h2><p class="hint" style="margin:-.4rem 0 1rem">Standard size 3.5 × 2 inches. Download it for printing, share it on WhatsApp, or attach it to payment requests.</p>' +
    '<div class="vprev"><div><span class="hint">Front</span><div id="vcFront"></div></div><div><span class="hint">Back</span><div id="vcBack"></div></div></div>' +
    '<div class="bar" style="justify-content:flex-start;flex-wrap:wrap"><button class="btn pri" onclick="cardDL(\'front\',this)">Download front (PNG)</button><button class="btn" onclick="cardDL(\'back\',this)">Download back (PNG)</button><button class="btn" onclick="cardPDF(this)">Download for printing (PDF)</button><button class="btn" id="vcShare" onclick="cardShare(this)">Share</button></div></div>' +
    '<div class="card"><h2>Card details</h2><div class="g2">' + f('name', 'Your name') + f('role', 'Designation', 'e.g. Proprietor, Director') + f('company', 'Business name') + f('tagline', 'Line under the business name', 'e.g. Interiors & custom furniture') + f('phone1', 'Mobile 1') + f('phone2', 'Mobile 2 (optional)') + f('email', 'Email') + f('website', 'Website') + '</div>' + f('address', 'Address') + f('services', 'Services (back of the card)', '', 'Separate with · ') +
    '<div class="g2"><div class="field"><label for="vc_qr">QR code on the back</label><select id="vc_qr" data-c="qr" class="keep">' + Object.entries({ contact: 'Save my contact (phone, email, address)', website: 'Open the website', whatsapp: 'Chat on WhatsApp', upi: 'Pay by UPI' }).map(([k, v]) => '<option value="' + k + '"' + (c.qr === k ? ' selected' : '') + '>' + v + '</option>').join('') + '</select></div>' +
    '<div class="field"><label for="vc_theme">Colours</label><select id="vc_theme" data-c="theme" class="keep">' + Object.entries(CARD_THEMES).map(([k, v]) => '<option value="' + k + '"' + (c.theme === k ? ' selected' : '') + '>' + v[0] + '</option>').join('') + '</select></div></div>' +
    '<div class="bar"><button class="btn pri" data-perm="card.edit" onclick="publish(\'settings\',this)">Save card</button></div></div></div>');
  document.querySelectorAll('[data-c]').forEach(el => el.oninput = el.onchange = () => { const k = el.dataset.c; if (k === 'phone1' || k === 'phone2') { c.phones = [(c.phones || [])[0] || '', (c.phones || [])[1] || '']; c.phones[k === 'phone1' ? 0 : 1] = el.value.trim(); c.phones = c.phones.filter(Boolean); } else c[k] = el.value; markDirty('settings'); cardDraw(); });
  if (!(navigator.canShare && navigator.canShare({ files: [new File([''], 'a.png', { type: 'image/png' })] }))) $('vcShare').hidden = true;
  cardDraw(); applyPerms();
}
function cardDraw() { $('vcFront').innerHTML = cardHTML('front'); $('vcBack').innerHTML = cardHTML('back'); }
const b64Blob = (b, t) => new Blob([Uint8Array.from(atob(b), c => c.charCodeAt(0))], { type: t });
async function cardDL(side, btn) { const l = btn.innerHTML; btn.disabled = true; btn.innerHTML = '<span class="spin"></span>Making…'; try { const b = await cardImage(side), a = document.createElement('a'); a.href = URL.createObjectURL(b64Blob(b, 'image/png')); a.download = 'Visiting-card-' + side + '.png'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); } catch (e) { toast('Couldn\'t make the picture.', true); } finally { btn.disabled = false; btn.innerHTML = l; } }
async function cardPDF(btn) {
  const l = btn.innerHTML; btn.disabled = true; btn.innerHTML = '<span class="spin"></span>Making PDF…';
  try { const f = await cardImage('front'), b = await cardImage('back');
    const pdf = await html2pdf().set({ margin: 0, jsPDF: { unit: 'in', format: [3.5, 2], orientation: 'landscape' } }).from('<div style="width:10px;height:10px"></div>', 'string').toPdf().get('pdf');
    pdf.addImage('data:image/png;base64,' + f, 'PNG', 0, 0, 3.5, 2, undefined, 'FAST'); pdf.addPage([3.5, 2], 'landscape'); pdf.addImage('data:image/png;base64,' + b, 'PNG', 0, 0, 3.5, 2, undefined, 'FAST');
    pdf.save('Visiting-card.pdf'); }
  catch (e) { toast('Couldn\'t make the PDF.', true); } finally { document.querySelectorAll('.html2pdf__overlay').forEach(o => o.remove()); btn.disabled = false; btn.innerHTML = l; }
}
async function cardShare(btn) { try { const b = await cardImage('front'), f = new File([b64Blob(b, 'image/png')], 'Visiting-card.png', { type: 'image/png' }); await navigator.share({ files: [f], title: cardData().name, text: cardData().company + ' · ' + (cardData().phones || []).join(' / ') }); } catch (e) { if (e.name !== 'AbortError') toast('Couldn\'t share. Use Download instead.', true); } }
