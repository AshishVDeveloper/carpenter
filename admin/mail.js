/* Mail page: read and send info@mumbai-interior.in mail through the sign-in server (Zoho Mail API).
   Loaded before admin.js; uses its helpers ($, esc, C, toast) only when the page is opened. */
let MAIL = { folders: [], folder: null, list: [], start: 1, open: null, email: '', boxes: [], unread: {} };
const mbq = () => 'box=' + encodeURIComponent(MAIL.email || '');
const mailShort = e => String(e || '').split('@')[0];
const MBOX_ICON = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="m3.5 7 8.5 6 8.5-6"/></svg>';
const MAIL_BOXES = [['info@mumbai-interior.in', 'Main business inbox'], ['asheesh@mumbai-interior.in', 'Asheesh Vishwakarma'], ['ramkumar@mumbai-interior.in', 'Ramkumar Vishwakarma']];
const un = v => { const t = document.createElement('textarea'); t.innerHTML = v == null ? '' : String(v); return t.value; };
const mailTime = t => { if (!t) return ''; const d = new Date(t), n = new Date(); return d.toDateString() === n.toDateString() ? d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }) : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', ...(d.getFullYear() !== n.getFullYear() ? { year: 'numeric' } : {}) }); };
const mailBoxesCard = () => '<div class="card"><h2>All mailboxes</h2><p class="hint" style="margin-top:-.4rem">Each person signs in to their own inbox in Zoho Mail (website or the Zoho Mail app).</p><div class="mboxes">' +
  MAIL_BOXES.map(b => '<a class="mbox" href="https://mail.zoho.in/zm/" target="_blank" rel="noopener"><b>' + esc(b[0]) + '</b><span>' + esc(b[1]) + '</span></a>').join('') + '</div></div>';

async function pgMail(arg) {
  if (typeof SERVER !== 'function' || !SERVER()) {
    C('<div class="card" style="max-width:620px"><h2>Mail needs two-step sign-in</h2><p>Your inbox is read through your secure sign-in server, so nobody can see it from the public website. Turn on two-step sign-in first, then come back here.</p><div class="bar" style="justify-content:flex-start"><a class="btn pri" href="#account">Go to Account</a></div></div>' + mailBoxesCard());
    return;
  }
  C('<div id="mailWrap"><div class="card"><p class="hint">Loading mail…</p></div></div>');
  let st; try { st = await api('/mail/status'); } catch (e) { $('mailWrap').innerHTML = '<div class="msg err">' + esc(e.message) + '</div>'; return; }
  if (!st.connected) return mailConnect();
  MAIL.boxes = st.boxes || [st.email];
  let want = arg && MAIL.boxes.includes(arg) ? arg : MAIL.email;
  if (!MAIL.boxes.includes(want)) { try { want = localStorage.getItem('mi-mailbox'); } catch (e) { } }
  if (!MAIL.boxes.includes(want)) want = MAIL.boxes[0];
  if (want !== MAIL.email) { MAIL.folder = null; MAIL.open = null; MAIL.start = 1; }
  MAIL.email = want; try { localStorage.setItem('mi-mailbox', want); } catch (e) { }
  try { const f = await api('/mail/folders?' + mbq()); MAIL.folders = f.folders; } catch (e) { $('mailWrap').innerHTML = '<div class="mailbar"><div></div><div class="macts">' + mailSwitch() + '</div></div><div class="msg err">' + esc(MAIL.email) + ': ' + esc(e.message) + ' <a href="#" onclick="mailReconnect();return false">Reconnect this mailbox</a></div>'; return; }
  const inbox = MAIL.folders.find(f => /inbox/i.test(f.type) || /^inbox$/i.test(f.name)) || MAIL.folders[0];
  if (!MAIL.folder || !MAIL.folders.some(f => f.id === MAIL.folder)) MAIL.folder = inbox && inbox.id;
  $('mailWrap').innerHTML =
    '<div class="mailbar"><div class="mfolders" role="tablist">' + mailFolderTabs() + '</div><div class="macts"><button class="btn sm" onclick="mailRefresh()" title="Refresh">Refresh</button><button class="btn sm pri" data-perm="mail.send" onclick="mailCompose()">Write email</button>' + mailSwitch() + '</div></div>' +
    '<div class="mailgrid"><div class="card mlist" id="mList"></div><div class="card mread" id="mRead"><div class="empty">Choose an email to read it.</div></div></div>' +
    '<p class="hint" style="margin-top:.6rem">Showing <b>' + esc(MAIL.email || '') + '</b>. <a href="https://mail.zoho.in/zm/" target="_blank" rel="noopener">Open full Zoho Mail</a></p>';
  mailLoad();
  mailBadge();
}
/* mailbox switcher: icon button at the top right with a menu of every connected mailbox */
function mailSwitch() {
  const tot = MAIL.boxes.reduce((n, e) => n + (e !== MAIL.email ? (MAIL.unread[e] || 0) : 0), 0);
  return '<div class="mswitch"><button class="btn sm mswbtn" aria-haspopup="menu" aria-expanded="false" onclick="mailSwitchToggle(event)" title="Switch mailbox">' + MBOX_ICON + '<span class="mswname">' + esc(mailShort(MAIL.email)) + '@</span>' + (tot ? '<span class="n">' + tot + '</span>' : '') + '</button>' +
    '<div class="mswmenu" role="menu" hidden><div class="mswhead">Mailboxes</div>' +
    MAIL.boxes.map(e => '<button role="menuitemradio" aria-checked="' + (e === MAIL.email) + '" class="' + (e === MAIL.email ? 'on' : '') + '" onclick="mailSwitchTo(\'' + esc(e) + '\')"><span class="mswdot">' + esc(mailShort(e).slice(0, 1).toUpperCase()) + '</span><span class="mswmail">' + esc(e) + '</span>' + (MAIL.unread[e] ? '<span class="n">' + MAIL.unread[e] + '</span>' : '') + '</button>').join('') +
    (can('mail', 'manage') ? '<hr/><button role="menuitem" onclick="mailConnect(true)">+ Add another mailbox</button><button role="menuitem" class="danger" onclick="mailRemove()">Remove ' + esc(mailShort(MAIL.email)) + '@ from this page</button>' : '') + '</div></div>';
}
function mailSwitchToggle(e) {
  e.stopPropagation(); const btn = e.currentTarget, m = btn.nextElementSibling, open = m.hidden;
  document.querySelectorAll('.mswmenu').forEach(x => x.hidden = true); m.hidden = !open; btn.setAttribute('aria-expanded', open);
  if (open) { const close = ev => { if (!m.contains(ev.target)) { m.hidden = true; btn.setAttribute('aria-expanded', 'false'); document.removeEventListener('click', close); } }; setTimeout(() => document.addEventListener('click', close)); }
}
function mailSwitchTo(e) { if (e === MAIL.email) { document.querySelectorAll('.mswmenu').forEach(x => x.hidden = true); return; } MAIL.email = e; MAIL.folder = null; MAIL.open = null; MAIL.start = 1; try { localStorage.setItem('mi-mailbox', e); } catch (x) { } pgMail(e); }
async function mailRemove() {
  if (!await confirmBox('Remove ' + MAIL.email + '?', 'It stops showing here. The mailbox and its emails stay safe in Zoho. You can add it again any time.', 'Remove')) return;
  try { await api('/mail/disconnect', { box: MAIL.email }); toast('Removed ' + MAIL.email); MAIL.email = ''; MAIL.folder = null; pgMail(); } catch (e) { toast(e.message, true); }
}
function mailFolderTabs() {
  const pick = MAIL.folders.filter(f => /inbox|sent|spam|drafts|trash/i.test(f.type + ' ' + f.name));
  return (pick.length ? pick : MAIL.folders).map(f => '<button role="tab" aria-selected="' + (f.id === MAIL.folder) + '" class="' + (f.id === MAIL.folder ? 'on' : '') + '" onclick="mailFolder(\'' + esc(f.id) + '\')">' + esc(f.name) + (f.unread ? ' <span class="n">' + f.unread + '</span>' : '') + '</button>').join('');
}
function mailFolder(id) { MAIL.folder = id; MAIL.start = 1; document.querySelector('.mfolders').innerHTML = mailFolderTabs(); $('mRead').innerHTML = '<div class="empty">Choose an email to read it.</div>'; mailLoad(); }
async function mailRefresh() {
  try { const f = await api('/mail/folders?' + mbq()); MAIL.folders = f.folders; const t = document.querySelector('.mfolders'); if (t) t.innerHTML = mailFolderTabs(); } catch (e) { }
  mailLoad(); mailBadge();
}
async function mailLoad() {
  const box = $('mList'); if (!box) return;
  box.innerHTML = '<p class="hint" style="padding:1rem">Loading…</p>';
  try {
    const r = await api('/mail/list?' + mbq() + '&folder=' + encodeURIComponent(MAIL.folder) + '&start=' + MAIL.start); MAIL.list = r.messages.map(m => ({ ...m, from: un(m.from), fromAddress: un(m.fromAddress), to: un(m.to), subject: un(m.subject), summary: un(m.summary) }));
    box.innerHTML = (MAIL.list.length ? MAIL.list.map((m, i) => '<button class="mitem' + (m.unread ? ' unread' : '') + (MAIL.open === m.id ? ' on' : '') + '" onclick="mailOpen(' + i + ')"><span class="mfrom">' + esc(m.from || m.fromAddress || '') + '</span><span class="mtime">' + mailTime(m.time) + '</span><span class="msub">' + (m.attach ? '📎 ' : '') + esc(m.subject || '(no subject)') + '</span><span class="msum">' + esc(m.summary || '') + '</span></button>').join('') : '<div class="empty">No emails here.</div>') +
      '<div class="mpager">' + (MAIL.start > 1 ? '<button class="btn sm" onclick="MAIL.start=Math.max(1,MAIL.start-30);mailLoad()">Newer</button>' : '<span></span>') + (MAIL.list.length === 30 ? '<button class="btn sm" onclick="MAIL.start+=30;mailLoad()">Older</button>' : '') + '</div>';
  } catch (e) { box.innerHTML = '<div class="msg err">' + esc(e.message) + '</div>'; }
}
async function mailOpen(i) {
  const m = MAIL.list[i]; if (!m) return; MAIL.open = m.id;
  document.querySelectorAll('.mitem').forEach((b, j) => b.classList.toggle('on', j === i));
  const r = $('mRead'); r.innerHTML = '<p class="hint">Opening…</p>'; mailOpenView();
  try {
    const d0 = await api('/mail/read?' + mbq() + '&folder=' + encodeURIComponent(m.folder) + '&id=' + encodeURIComponent(m.id)); const d = { ...d0, from: un(d0.from), fromAddress: un(d0.fromAddress), to: un(d0.to), cc: un(d0.cc), subject: un(d0.subject) };
    if (m.unread && d0.marked !== false) mailSetRead(i, true, true);
    r.innerHTML = '<button class="btn sm mback" onclick="mailCloseView()">← Back</button><h2 class="mh">' + esc(d.subject || m.subject || '(no subject)') + '</h2>' +
      '<div class="mmeta"><b>' + esc(d.from || m.from || '') + '</b> &lt;' + esc(d.fromAddress || m.fromAddress || '') + '&gt;<br/>To: ' + esc(d.to || '') + (d.cc ? '<br/>Cc: ' + esc(d.cc) : '') + '<br/>' + (d.time ? new Date(d.time).toLocaleString('en-IN') : '') + '</div>' +
      '<iframe class="mbody" sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox" scrolling="no" referrerpolicy="no-referrer" title="Email content"></iframe>' +
      '<div class="bar" style="justify-content:flex-start"><button class="btn pri" data-perm="mail.send" onclick="mailCompose(' + i + ')">Reply</button><button class="btn" onclick="mailToggleRead(' + i + ')" id="mRd">Mark as unread</button></div>';
    const f = r.querySelector('iframe');
    f.srcdoc = '<!doctype html><meta charset="utf-8"><base target="_blank"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;padding:0}body{font:15px/1.55 system-ui,sans-serif;color:#222;padding:12px;overflow-wrap:anywhere;word-break:break-word}img{max-width:100%!important;height:auto!important}table{max-width:100%!important;width:auto!important}td,th{word-break:break-word}*{max-width:100%;box-sizing:border-box}pre{white-space:pre-wrap}</style>' + mailClean(d.content || '');
    const fit = () => { try { const h = f.contentDocument.documentElement.scrollHeight; if (h) f.style.height = (h + 4) + 'px'; } catch (e) { f.style.height = '520px'; } };
    f.onload = () => { fit(); try { f.contentDocument.querySelectorAll('img').forEach(i => i.addEventListener('load', fit)); new ResizeObserver(fit).observe(f.contentDocument.body); } catch (e) { } setTimeout(fit, 600); };
  } catch (e) { r.innerHTML = '<div class="msg err">' + esc(e.message) + '</div>'; }
}
/* read / unread: update the row, the folder count, the mailbox count and the menu badge together */
function mailSetRead(i, read, already) {
  const m = MAIL.list[i]; if (!m || m.unread === !read) return; m.unread = !read;
  const row = document.querySelectorAll('.mitem')[i]; if (row) row.classList.toggle('unread', !read);
  const f = MAIL.folders.find(x => x.id === m.folder); if (f) f.unread = Math.max(0, (f.unread || 0) + (read ? -1 : 1));
  const tabs = document.querySelector('.mfolders'); if (tabs) tabs.innerHTML = mailFolderTabs();
  MAIL.unread[MAIL.email] = Math.max(0, (MAIL.unread[MAIL.email] || 0) + (read ? -1 : 1)); MAIL_UNREAD = Math.max(0, MAIL_UNREAD + (read ? -1 : 1)); mailBadge(0);
  const b = $('mRd'); if (b && MAIL.open === m.id) b.textContent = read ? 'Mark as unread' : 'Mark as read';
}
async function mailToggleRead(i) {
  const m = MAIL.list[i]; if (!m) return; const read = m.unread;
  mailSetRead(i, read);
  try { await api('/mail/mark', { box: MAIL.email, ids: [m.id], read }); toast(read ? 'Marked as read.' : 'Marked as unread.'); }
  catch (e) { mailSetRead(i, !read); toast(e.message, true); }
}
/* strip scripts, event handlers and active content from email HTML before showing it */
function mailClean(html) {
  const doc = new DOMParser().parseFromString(String(html), 'text/html');
  doc.querySelectorAll('script,iframe,object,embed,form,link,meta,base').forEach(n => n.remove());
  doc.querySelectorAll('*').forEach(n => { for (const a of [...n.attributes]) { if (/^on/i.test(a.name) || /^\s*javascript:/i.test(a.value)) n.removeAttribute(a.name); } });
  return doc.body ? doc.body.innerHTML : '';
}
function mailCompose(i) {
  const m = i != null ? MAIL.list[i] : null, r = $('mRead');
  mailOpenView();
  r.innerHTML = '<button class="btn sm mback" onclick="mailCloseView()">← Back</button><h2 class="mh">' + (m ? 'Reply' : 'New email') + '</h2><div class="msg err" id="cErr" hidden></div>' +
    '<form onsubmit="mailSend(event,' + (m ? '\'' + esc(m.id) + '\'' : 'null') + ')">' + (MAIL.boxes.length > 1 && !m ? '<div class="field"><label for="c_from">From</label><select id="c_from">' + MAIL.boxes.map(e => '<option' + (e === MAIL.email ? ' selected' : '') + '>' + esc(e) + '</option>').join('') + '</select></div>' : '') + '<div class="field"><label for="c_to">To</label><input id="c_to" type="email" multiple required value="' + esc(m ? (m.fromAddress || '') : '') + '" placeholder="customer@example.com"/></div>' +
    '<div class="field"><label for="c_sub">Subject</label><input id="c_sub" value="' + esc(m ? (/^re:/i.test(m.subject || '') ? m.subject : 'Re: ' + (m.subject || '')) : '') + '"/></div>' +
    '<div class="field"><label for="c_body">Message</label><textarea id="c_body" required style="min-height:200px"></textarea><div class="hint">' + (m || MAIL.boxes.length < 2 ? 'Sent from ' + esc(MAIL.email) + '. ' : '') + 'Your logo, address and phone are added at the top and bottom automatically.</div></div>' +
    '<div class="bar" style="justify-content:flex-start"><button class="btn pri" id="cBtn">Send</button><button type="button" class="btn" onclick="mailCloseView();$(\'mRead\').innerHTML=\'<div class=empty>Choose an email to read it.</div>\'">Cancel</button></div></form>';
  $(m ? 'c_body' : 'c_to').focus();
}
async function mailSend(e, replyTo) {
  e.preventDefault(); const b = $('cBtn'); b.disabled = true; b.textContent = 'Sending…'; $('cErr').hidden = true;
  const text = $('c_body').value, html = '<div style="white-space:normal">' + esc(text).replace(/\n/g, '<br/>') + '</div>', from = $('c_from') ? $('c_from').value : MAIL.email;
  try { await api('/mail/send', { box: from, to: $('c_to').value.trim(), subject: $('c_sub').value.trim(), content: html, replyTo: replyTo || undefined }); toast('Email sent.'); mailCloseView(); $('mRead').innerHTML = '<div class="empty">Sent. Choose an email to read it.</div>'; }
  catch (er) { $('cErr').textContent = er.message; $('cErr').hidden = false; b.disabled = false; b.textContent = 'Send'; }
}
function mailConnect(more) {
  if (!can('mail', 'manage')) { $('mailWrap').innerHTML = '<div class="card" style="max-width:560px"><h2>Mail isn\'t connected yet</h2><p>Ask the owner to connect the business mailboxes.</p></div>'; return; }
  document.querySelectorAll('.mswmenu').forEach(x => x.hidden = true);
  const have = (MAIL.boxes || []).length && more;
  $('mailWrap').innerHTML = '<div class="card" style="max-width:680px"><h2>' + (have ? 'Add another mailbox' : 'Connect your mailbox') + '</h2><p>One-time setup per mailbox (about 3 minutes). Do it on a computer. First <b>sign out of Zoho</b>, then sign in as the mailbox you want to add (for example <b>' + esc(['info', 'asheesh', 'ramkumar', 'noreply'].map(x => x + '@mumbai-interior.in').find(x => !(MAIL.boxes || []).includes(x)) || 'info@mumbai-interior.in') + '</b>).' + (have ? ' Already here: ' + MAIL.boxes.map(esc).join(', ') + '.' : '') + '</p>' +
    '<ol class="steps" style="margin:.4rem 0 1rem 1.2rem;padding:0;color:var(--muted);line-height:1.7"><li>Open <a href="https://api-console.zoho.in/" target="_blank" rel="noopener">Zoho API Console</a> → <b>Add Client</b> → <b>Self Client</b> → <b>Create</b>.</li>' +
    '<li>In the <b>Generate Code</b> tab, paste this into <b>Scope</b>:<br/><code style="user-select:all;word-break:break-all">ZohoMail.accounts.READ,ZohoMail.folders.READ,ZohoMail.messages.ALL</code><br/>Time duration: <b>10 minutes</b>, description: <b>Admin mail</b> → <b>Create</b>, then copy the code.</li>' +
    '<li>In the <b>Client Secret</b> tab, copy the <b>Client ID</b> and <b>Client Secret</b>.</li><li>Paste all three below and press Connect. They are sent only to your sign-in server and are never shown again.</li></ol>' +
    '<div class="msg err" id="zErr" hidden></div><form onsubmit="mailDoConnect(event)" autocomplete="off"><div class="field"><label for="z_id">Client ID</label><input id="z_id" required autocomplete="off"/></div><div class="field"><label for="z_sec">Client Secret</label><input id="z_sec" type="password" required autocomplete="off"/></div><div class="field"><label for="z_code">Code</label><input id="z_code" required autocomplete="off"/></div>' +
    '<div class="bar" style="justify-content:flex-start"><button class="btn pri" id="zBtn">Connect</button>' + (have ? '<button type="button" class="btn" onclick="pgMail()">Cancel</button>' : '') + '</div></form></div>';
}
async function mailDoConnect(e) {
  e.preventDefault(); const b = $('zBtn'); b.disabled = true; b.textContent = 'Connecting…'; $('zErr').hidden = true;
  try { const r = await api('/mail/connect', { clientId: $('z_id').value, clientSecret: $('z_sec').value, code: $('z_code').value }); toast('Connected: ' + (r.added || [r.email]).join(', ')); pgMail(r.email); }
  catch (er) { $('zErr').textContent = er.message; $('zErr').hidden = false; b.disabled = false; b.textContent = 'Connect'; }
}
async function mailReconnect() { if (!await confirmBox('Reconnect ' + MAIL.email + '?', 'You will need to paste a new Client ID, Secret and Code for this mailbox.', 'Reconnect')) return; try { await api('/mail/disconnect', { box: MAIL.email }); } catch (e) { } MAIL.boxes = MAIL.boxes.filter(x => x !== MAIL.email); mailConnect(true); }
/* unread badge on the Mail menu item */
let MAIL_UNREAD = 0;
async function mailBadge(dec) {
  if (dec === 0) { const sw = document.querySelector('.mswitch'); if (sw && MAIL.boxes.length) sw.outerHTML = mailSwitch(); }
  else {
    try { if (typeof SERVER !== 'function' || !SERVER()) return; const r = await api('/mail/unread'); MAIL.unread = {}; r.boxes.forEach(b => MAIL.unread[b.email] = b.unread); MAIL_UNREAD = r.boxes.reduce((n, b) => n + b.unread, 0); } catch (e) { return; }
    const sw = document.querySelector('.mswitch'); if (sw && MAIL.boxes.length) sw.outerHTML = mailSwitch();
  }
  const a = document.querySelector('#nav a[href="#mail"]'); if (!a) return;
  let n = a.querySelector('.n'); if (!MAIL_UNREAD) { n && n.remove(); return; }
  if (!n) { n = document.createElement('span'); n.className = 'n'; a.append(n); } n.textContent = MAIL_UNREAD;
}

/* phone: opening an email adds a step to the browser history, so the phone's own Back button returns to the list */
const mailNarrow = () => matchMedia('(max-width:860px)').matches;
function mailOpenView() {
  const g = document.querySelector('.mailgrid'); if (!g) return; g.classList.add('reading');
  if (mailNarrow() && !(history.state && history.state.mailRead)) history.pushState({ mailRead: 1 }, '', location.href);
}
function mailCloseView() {
  if (history.state && history.state.mailRead) { history.back(); return; } // popstate below closes it
  const g = document.querySelector('.mailgrid'); if (g) g.classList.remove('reading');
}
addEventListener('popstate', () => { const g = document.querySelector('.mailgrid'); if (g && !(history.state && history.state.mailRead)) g.classList.remove('reading'); });
