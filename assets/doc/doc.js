/* Renders quotations, agreements, bills and invoices as A4 HTML (for PDF download and print). */
(function(){
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num = v => { const n = parseFloat(v); return isFinite(n) ? n : 0; };
const inr = n => Number(Math.round(num(n) * 100) / 100).toLocaleString('en-IN', {maximumFractionDigits: 2});
const rs = n => '₹' + inr(n);
const fmtDate = d => { if (!d) return ''; const x = new Date(d + 'T00:00:00'); return isNaN(x) ? d : x.toLocaleDateString('en-IN', {day: '2-digit', month: 'short', year: 'numeric'}); };

const TYPES = {
  quotation: {title: 'Work Quotation', prefix: 'Q', label: 'Quotation'},
  agreement: {title: 'Work Agreement', prefix: 'AG', label: 'Agreement'},
  bill:      {title: 'Bill', prefix: 'B', label: 'Bill'},
  invoice:   {title: 'Tax Invoice', prefix: 'INV', label: 'Invoice'}
};

/* "7'6\" x 4'", "12' x 30\"", "3.5' x 6'" → area in sq ft */
function feet(t){
  t = String(t).trim().replace(/[’‘`´]/g, "'").replace(/[“”″]/g, '"').replace(/''/g, '"');
  let m = t.match(/^(\d+(?:\.\d+)?)\s*'\s*(?:(\d+(?:\.\d+)?)\s*"?)?$/); if (m) return num(m[1]) + num(m[2] || 0) / 12;
  m = t.match(/^(\d+(?:\.\d+)?)\s*"$/); if (m) return num(m[1]) / 12;
  m = t.match(/^(\d+(?:\.\d+)?)\s*(ft|feet)?$/i); if (m) return num(m[1]);
  m = t.match(/^(\d+(?:\.\d+)?)\s*(in|inch|inches)$/i); if (m) return num(m[1]) / 12;
  return NaN;
}
function area(size){
  const p = String(size || '').split(/\s*[x×*X]\s*/);
  if (p.length !== 2) return '';
  const a = feet(p[0]), b = feet(p[1]);
  return isFinite(a) && isFinite(b) ? Math.round(a * b * 100) / 100 : '';
}
function lineAmount(it){
  if (it.unit === 'lump' || (it.amountManual && it.amount !== '' && it.amount != null)) return num(it.amount);
  const q = num(it.qty || 1), r = num(it.rate);
  if (!r) return num(it.amount);
  if (it.unit === 'nos') return q * r;
  const a = num(it.area);
  return a ? a * r * q : q * r;
}
function totals(d){
  const sub = (d.items || []).reduce((s, it) => s + lineAmount(it), 0);
  const disc = num(d.discount);
  const taxable = Math.max(0, sub - disc);
  const gst = d.type === 'invoice' ? taxable * num(d.gst) / 100 : 0;
  const grand = Math.round(taxable + gst);
  const paid = num(d.advance);
  return {sub, disc, taxable, gst, grand, paid, balance: grand - paid};
}

/* Indian number words: 504225 → "Five Lakh Four Thousand Two Hundred Twenty-Five" */
const ONES = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
const TENS = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
function two(n){ return n < 20 ? ONES[n] : TENS[Math.floor(n / 10)] + (n % 10 ? '-' + ONES[n % 10] : ''); }
function three(n){ const h = Math.floor(n / 100), r = n % 100; return (h ? ONES[h] + ' Hundred' + (r ? ' ' : '') : '') + (r ? two(r) : ''); }
function words(n){
  n = Math.round(num(n)); if (!n) return 'Zero Rupees Only';
  const parts = []; const cr = Math.floor(n / 1e7); n %= 1e7; const lk = Math.floor(n / 1e5); n %= 1e5; const th = Math.floor(n / 1e3); n %= 1e3;
  if (cr) parts.push((cr > 99 ? words(cr).replace(' Rupees Only', '') : two(cr)) + ' Crore');
  if (lk) parts.push(two(lk) + ' Lakh'); if (th) parts.push(two(th) + ' Thousand'); if (n) parts.push(three(n));
  return parts.join(' ') + ' Rupees Only';
}

function letterhead(L){
  const g = '<img src="' + esc(L.logo || 'assets/doc/ganesh.png') + '" alt=""/>';
  return '<header class="lh">' + g + '<div class="mid"><h1>' + esc(L.title) + '</h1>' + (L.intro ? '<div class="intro">' + esc(L.intro) + '</div>' : '') +
    (L.address ? '<div class="addr">' + esc(L.address) + '</div>' : '') +
    '<div class="ph">' + [(L.phones || []).filter(Boolean).map(p => 'Mob: ' + esc(p)).join(' &nbsp;|&nbsp; '), L.email && esc(L.email)].filter(Boolean).join(' &nbsp;|&nbsp; ') + '</div>' +
    (L.gstin ? '<div class="addr">GSTIN: ' + esc(L.gstin) + '</div>' : '') + '</div>' + g + '</header><div class="rule"></div><div class="rule2"></div>';
}
function footer(L, d){
  return '<footer class="foot"><div><span class="thanks">' + esc(d.footer_note || L.footer_note || 'Thank you for your business!') + '</span><br/>' + esc(L.title) + (L.address ? ' · ' + esc(L.address) : '') + '</div><div style="text-align:right;white-space:nowrap"><b>' + (L.phones || []).filter(Boolean).map(esc).join('<br/>') + '</b>' + (L.website ? '<br/>' + esc(L.website) : '') + '</div></footer>';
}

function itemsTable(d){
  const groups = !!d.group_rooms;
  let last = null, i = 0;
  const rows = (d.items || []).filter(it => it.desc || it.room).map(it => {
    let pre = '';
    if (groups && (it.room || '') !== last) { last = it.room || ''; if (last) pre = '<tr class="grp"><td colspan="7">' + esc(last) + '</td></tr>'; }
    i++;
    const amt = lineAmount(it), a = num(it.area);
    return pre + '<tr><td class="n">' + i + '</td>' + (groups ? '' : '<td class="room">' + esc(it.room) + '</td>') + '<td>' + esc(it.desc) + (it.note ? '<br/><small style="color:#777">' + esc(it.note) + '</small>' : '') + '</td><td>' + esc(it.size || '') + '</td><td class="n">' + (a ? inr(a) : '') + '</td><td class="n">' + esc(it.qty || '') + '</td><td class="n">' + (num(it.rate) ? inr(it.rate) : '') + '</td><td class="n">' + inr(amt) + '</td></tr>';
  }).join('');
  return '<table class="items"><thead><tr><th class="n">#</th>' + (groups ? '' : '<th>Room</th>') + '<th>Description</th><th>Size</th><th class="n">Area<br/>(sq ft)</th><th class="n">Qty</th><th class="n">Rate (₹)</th><th class="n">Amount (₹)</th></tr></thead><tbody>' + rows + '</tbody></table>';
}
function totalsBox(d, t){
  const rowsT = [['Subtotal', rs(t.sub)]];
  if (t.disc) rowsT.push(['Discount', '− ' + rs(t.disc)]);
  if (d.type === 'invoice' && num(d.gst)) { rowsT.push(['CGST ' + num(d.gst) / 2 + '%', rs(t.gst / 2)]); rowsT.push(['SGST ' + num(d.gst) / 2 + '%', rs(t.gst / 2)]); }
  let h = '<div class="tot">' + rowsT.map(r => '<div><span>' + r[0] + '</span><span>' + r[1] + '</span></div>').join('') + '<div class="grand"><span>Grand Total</span><span>' + rs(t.grand) + '</span></div>';
  if ((d.type === 'bill' || d.type === 'invoice') && t.paid) h += '<div><span>Advance received</span><span>− ' + rs(t.paid) + '</span></div><div class="bal"><span>Balance due</span><span>' + rs(t.balance) + '</span></div>';
  return h + '</div>';
}
function metaBlock(d, T){
  const right = [[T.label + ' No.', d.no], ['Date', fmtDate(d.date)]];
  if (d.type === 'quotation' && d.valid_till) right.push(['Valid till', fmtDate(d.valid_till)]);
  if (d.basis) right.push(['Work basis', d.basis]);
  if (d.type === 'invoice' && d.client_gstin) right.push(['Client GSTIN', d.client_gstin]);
  if (d.ref) right.push(['Reference', d.ref]);
  return '<div class="meta"><div class="box"><b class="k">' + (d.type === 'agreement' ? 'Client (Second party)' : d.type === 'quotation' ? 'Quotation for' : 'Billed to') + '</b><div class="nm">' + esc(d.client || '—') + '</div>' +
    (d.client_phone ? '<div>Mob: ' + esc(d.client_phone) + '</div>' : '') + (d.client_address ? '<div>' + esc(d.client_address) + '</div>' : '') + (d.site && d.site !== d.client_address ? '<div><b>Site:</b> ' + esc(d.site) + '</div>' : '') + '</div>' +
    '<div class="box"><dl class="kv">' + right.filter(r => r[1]).map(r => '<dt>' + r[0] + '</dt><dd>' + esc(r[1]) + '</dd>').join('') + '</dl></div></div>';
}
function terms(list, title){ list = (list || []).filter(x => String(x).trim()); return list.length ? '<h3 class="sec">' + (title || 'Terms & Conditions') + '</h3><ol class="terms">' + list.map(x => '<li>' + esc(x) + '</li>').join('') + '</ol>' : ''; }
function bank(B){
  if (!B) return '';
  const r = [['Account name', B.name], ['Bank', B.bank], ['Account no.', B.account], ['IFSC', B.ifsc], ['UPI', B.upi]].filter(x => x[1]);
  return r.length ? '<h3 class="sec">Payment details</h3><dl class="bank">' + r.map(x => '<dt>' + x[0] + '</dt><dd>' + esc(x[1]) + '</dd>').join('') + '</dl>' : '';
}

function agreementBody(d, L, t){
  const contractor = L.title + (L.address ? ', ' + L.address : '');
  const sched = (d.schedule || []).filter(s => s.label || s.percent);
  return '<p class="para">This Work Agreement is made on <b>' + esc(fmtDate(d.date)) + '</b> between <b>' + esc(contractor) + '</b> (the "Contractor") and <b>' + esc(d.client || '________') + '</b>' + (d.client_address ? ', ' + esc(d.client_address) : '') + ' (the "Client").</p>' +
    '<p class="para">The Contractor agrees to carry out the interior and carpentry work listed below at <b>' + esc(d.site || d.client_address || 'the Client\'s site') + '</b> on <b>' + esc(d.basis || 'contract basis') + '</b>' +
    (/labour/i.test(d.basis || '') ? ', with all material supplied by the Client' : ', including material, labour and fitting unless stated otherwise') + '.</p>' +
    '<h3 class="sec">1. Scope of work</h3>' + itemsTable(d) +
    '<div class="sum"><div class="words"><b>Total contract value in words</b>' + words(t.grand) + '</div>' + totalsBox(d, t) + '</div>' +
    '<h3 class="sec">2. Timeline</h3><p class="para">Work will start on <b>' + esc(fmtDate(d.start_date) || 'the agreed date') + '</b> and is expected to be completed ' + (d.end_date ? 'by <b>' + esc(fmtDate(d.end_date)) + '</b>' : 'within <b>' + esc(d.duration || 'the agreed period') + '</b>') + ', subject to timely payments, site availability and material supply.</p>' +
    (sched.length ? '<h3 class="sec">3. Payment schedule</h3><table class="sched"><thead><tr><th>Stage</th><th style="width:70px">Share</th><th style="width:120px;text-align:right">Amount</th></tr></thead><tbody>' + sched.map(s => '<tr><td>' + esc(s.label) + '</td><td>' + esc(s.percent ? s.percent + '%' : '') + '</td><td style="text-align:right">' + (s.percent ? rs(t.grand * num(s.percent) / 100) : '') + '</td></tr>').join('') + '</tbody></table>' : '') +
    terms(d.terms, (sched.length ? '4' : '3') + '. Terms & conditions');
}

function render(d, L, opt = {}){
  const T = TYPES[d.type] || TYPES.quotation, t = totals(d);
  let body = '<div class="dtitle"><span>' + esc(d.title || (d.type === 'invoice' && !L.gstin ? 'Invoice' : T.title)) + '</span></div>' + metaBlock(d, T);
  if (d.type === 'agreement') body += agreementBody(d, L, t);
  else {
    if (d.intro) body += '<p class="para">' + esc(d.intro) + '</p>';
    body += itemsTable(d) + '<div class="sum"><div class="words"><b>Amount in words</b>' + words((d.type === 'bill' || d.type === 'invoice') && t.paid ? t.grand : t.grand) + '</div>' + totalsBox(d, t) + '</div>';
    if (d.notes) body += '<h3 class="sec">Notes</h3><p class="para">' + esc(d.notes) + '</p>';
    body += terms(d.terms);
    if (d.type === 'bill' || d.type === 'invoice') body += bank(opt.bank);
  }
  const signs = d.type === 'agreement'
    ? '<div class="signs three"><div class="sign"><div class="line">For ' + esc(L.title) + '<small>Contractor</small></div></div><div class="sign"><div class="line">' + esc(d.client || 'Client') + '<small>Client</small></div></div><div class="sign"><div class="line">Witness<small>Name &amp; signature</small></div></div></div>'
    : '<div class="signs"><div class="sign">' + (d.type === 'quotation' ? '<div class="line">Customer acceptance<small>Signature &amp; date</small></div>' : '') + '</div><div class="sign" style="text-align:right"><div class="line">For ' + esc(L.title) + '<small>Authorised signatory</small></div></div></div>';
  return '<div class="docpage">' + (d.status === 'draft' && opt.watermark ? '<div class="stamp">DRAFT</div>' : '') + letterhead(L) + body + '<div class="grow"></div>' + signs + footer(L, d) + '</div>';
}

window.DOCS = {TYPES, area, lineAmount, totals, words, render, rs, inr, fmtDate, letterhead, footer, esc};
})();
