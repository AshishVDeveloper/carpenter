/* Mail page: read and send info@mumbai-interior.in mail through the sign-in server (Zoho Mail API).
   Loaded before admin.js; uses its helpers ($, esc, C, toast) only when the page is opened. */
let MAIL = { folders: [], folder: null, list: [], start: 1, open: null, email: '' };
const MAIL_BOXES = [['info@mumbai-interior.in', 'Main business inbox'], ['asheesh@mumbai-interior.in', 'Asheesh Vishwakarma'], ['ramkumar@mumbai-interior.in', 'Ramkumar Vishwakarma']];
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
  MAIL.email = st.email;
  try { const f = await api('/mail/folders'); MAIL.folders = f.folders; } catch (e) { $('mailWrap').innerHTML = '<div class="msg err">' + esc(e.message) + ' <a href="#" onclick="mailReconnect();return false">Reconnect Mail</a></div>'; return; }
  const inbox = MAIL.folders.find(f => /inbox/i.test(f.type) || /^inbox$/i.test(f.name)) || MAIL.folders[0];
  if (!MAIL.folder || !MAIL.folders.some(f => f.id === MAIL.folder)) MAIL.folder = inbox && inbox.id;
  $('mailWrap').innerHTML =
    '<div class="mailbar"><div class="mfolders" role="tablist">' + mailFolderTabs() + '</div><div class="macts"><button class="btn sm" onclick="mailLoad()" title="Refresh">Refresh</button><button class="btn sm pri" onclick="mailCompose()">Write email</button></div></div>' +
    '<div class="mailgrid"><div class="card mlist" id="mList"></div><div class="card mread" id="mRead"><div class="empty">Choose an email to read it.</div></div></div>' +
    '<p class="hint" style="margin-top:.6rem">Signed in as <b>' + esc(MAIL.email || '') + '</b>. <a href="https://mail.zoho.in/zm/" target="_blank" rel="noopener">Open full Zoho Mail</a> · <a href="#" onclick="mailReconnect();return false">Reconnect</a></p>' + mailBoxesCard();
  mailLoad();
  mailBadge();
}
function mailFolderTabs() {
  const pick = MAIL.folders.filter(f => /inbox|sent|spam|drafts|trash/i.test(f.type + ' ' + f.name));
  return (pick.length ? pick : MAIL.folders).map(f => '<button role="tab" aria-selected="' + (f.id === MAIL.folder) + '" class="' + (f.id === MAIL.folder ? 'on' : '') + '" onclick="mailFolder(\'' + esc(f.id) + '\')">' + esc(f.name) + (f.unread ? ' <span class="n">' + f.unread + '</span>' : '') + '</button>').join('');
}
function mailFolder(id) { MAIL.folder = id; MAIL.start = 1; document.querySelector('.mfolders').innerHTML = mailFolderTabs(); $('mRead').innerHTML = '<div class="empty">Choose an email to read it.</div>'; mailLoad(); }
async function mailLoad() {
  const box = $('mList'); if (!box) return;
  box.innerHTML = '<p class="hint" style="padding:1rem">Loading…</p>';
  try {
    const r = await api('/mail/list?folder=' + encodeURIComponent(MAIL.folder) + '&start=' + MAIL.start); MAIL.list = r.messages;
    box.innerHTML = (MAIL.list.length ? MAIL.list.map((m, i) => '<button class="mitem' + (m.unread ? ' unread' : '') + (MAIL.open === m.id ? ' on' : '') + '" onclick="mailOpen(' + i + ')"><span class="mfrom">' + esc(m.from || m.fromAddress || '') + '</span><span class="mtime">' + mailTime(m.time) + '</span><span class="msub">' + (m.attach ? '📎 ' : '') + esc(m.subject || '(no subject)') + '</span><span class="msum">' + esc(m.summary || '') + '</span></button>').join('') : '<div class="empty">No emails here.</div>') +
      '<div class="mpager">' + (MAIL.start > 1 ? '<button class="btn sm" onclick="MAIL.start=Math.max(1,MAIL.start-30);mailLoad()">Newer</button>' : '<span></span>') + (MAIL.list.length === 30 ? '<button class="btn sm" onclick="MAIL.start+=30;mailLoad()">Older</button>' : '') + '</div>';
  } catch (e) { box.innerHTML = '<div class="msg err">' + esc(e.message) + '</div>'; }
}
async function mailOpen(i) {
  const m = MAIL.list[i]; if (!m) return; MAIL.open = m.id;
  document.querySelectorAll('.mitem').forEach((b, j) => b.classList.toggle('on', j === i));
  const r = $('mRead'); r.innerHTML = '<p class="hint">Opening…</p>'; document.querySelector('.mailgrid').classList.add('reading');
  try {
    const d = await api('/mail/read?folder=' + encodeURIComponent(m.folder) + '&id=' + encodeURIComponent(m.id));
    if (m.unread) { m.unread = false; document.querySelectorAll('.mitem')[i].classList.remove('unread'); mailBadge(true); }
    r.innerHTML = '<button class="btn sm mback" onclick="document.querySelector(\'.mailgrid\').classList.remove(\'reading\')">← Back</button><h2 class="mh">' + esc(d.subject || m.subject || '(no subject)') + '</h2>' +
      '<div class="mmeta"><b>' + esc(d.from || m.from || '') + '</b> &lt;' + esc(d.fromAddress || m.fromAddress || '') + '&gt;<br/>To: ' + esc(d.to || '') + (d.cc ? '<br/>Cc: ' + esc(d.cc) : '') + '<br/>' + (d.time ? new Date(d.time).toLocaleString('en-IN') : '') + '</div>' +
      '<iframe class="mbody" sandbox="allow-popups allow-popups-to-escape-sandbox" referrerpolicy="no-referrer" title="Email content"></iframe>' +
      '<div class="bar" style="justify-content:flex-start"><button class="btn pri" onclick="mailCompose(' + i + ')">Reply</button></div>';
    const f = r.querySelector('iframe');
    f.srcdoc = '<!doctype html><meta charset="utf-8"><base target="_blank"><style>body{font:15px/1.5 system-ui,sans-serif;color:#222;margin:0;padding:4px;word-wrap:break-word}img{max-width:100%;height:auto}</style>' + mailClean(d.content || '');
    f.onload = () => { try { f.style.height = Math.min(2000, f.contentDocument.body.scrollHeight + 24) + 'px'; } catch (e) { f.style.height = '480px'; } };
  } catch (e) { r.innerHTML = '<div class="msg err">' + esc(e.message) + '</div>'; }
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
  document.querySelector('.mailgrid').classList.add('reading');
  r.innerHTML = '<button class="btn sm mback" onclick="document.querySelector(\'.mailgrid\').classList.remove(\'reading\')">← Back</button><h2 class="mh">' + (m ? 'Reply' : 'New email') + '</h2><div class="msg err" id="cErr" hidden></div>' +
    '<form onsubmit="mailSend(event,' + (m ? '\'' + esc(m.id) + '\'' : 'null') + ')"><div class="field"><label for="c_to">To</label><input id="c_to" type="email" multiple required value="' + esc(m ? (m.fromAddress || '') : '') + '" placeholder="customer@example.com"/></div>' +
    '<div class="field"><label for="c_sub">Subject</label><input id="c_sub" value="' + esc(m ? (/^re:/i.test(m.subject || '') ? m.subject : 'Re: ' + (m.subject || '')) : '') + '"/></div>' +
    '<div class="field"><label for="c_body">Message</label><textarea id="c_body" required style="min-height:200px"></textarea><div class="hint">Sent from ' + esc(MAIL.email) + '.</div></div>' +
    '<div class="bar" style="justify-content:flex-start"><button class="btn pri" id="cBtn">Send</button><button type="button" class="btn" onclick="document.querySelector(\'.mailgrid\').classList.remove(\'reading\');$(\'mRead\').innerHTML=\'<div class=empty>Choose an email to read it.</div>\'">Cancel</button></div></form>';
  $(m ? 'c_body' : 'c_to').focus();
}
async function mailSend(e, replyTo) {
  e.preventDefault(); const b = $('cBtn'); b.disabled = true; b.textContent = 'Sending…'; $('cErr').hidden = true;
  const text = $('c_body').value, html = esc(text).replace(/\n/g, '<br/>') + '<br/><br/>--<br/>Mumbai Interior<br/>+91 9004200401 · www.mumbai-interior.in';
  try { await api('/mail/send', { to: $('c_to').value.trim(), subject: $('c_sub').value.trim(), content: html, replyTo: replyTo || undefined }); toast('Email sent.'); document.querySelector('.mailgrid').classList.remove('reading'); $('mRead').innerHTML = '<div class="empty">Sent. Choose an email to read it.</div>'; }
  catch (er) { $('cErr').textContent = er.message; $('cErr').hidden = false; b.disabled = false; b.textContent = 'Send'; }
}
function mailConnect() {
  $('mailWrap').innerHTML = '<div class="card" style="max-width:680px"><h2>Connect your info@ inbox</h2><p>One-time setup (about 3 minutes). Do it on a computer, signed in to Zoho as <b>info@mumbai-interior.in</b>.</p>' +
    '<ol class="steps" style="margin:.4rem 0 1rem 1.2rem;padding:0;color:var(--muted);line-height:1.7"><li>Open <a href="https://api-console.zoho.in/" target="_blank" rel="noopener">Zoho API Console</a> → <b>Add Client</b> → <b>Self Client</b> → <b>Create</b>.</li>' +
    '<li>In the <b>Generate Code</b> tab, paste this into <b>Scope</b>:<br/><code style="user-select:all;word-break:break-all">ZohoMail.accounts.READ,ZohoMail.folders.READ,ZohoMail.messages.ALL</code><br/>Time duration: <b>10 minutes</b>, description: <b>Admin mail</b> → <b>Create</b>, then copy the code.</li>' +
    '<li>In the <b>Client Secret</b> tab, copy the <b>Client ID</b> and <b>Client Secret</b>.</li><li>Paste all three below and press Connect. They are sent only to your sign-in server and are never shown again.</li></ol>' +
    '<div class="msg err" id="zErr" hidden></div><form onsubmit="mailDoConnect(event)" autocomplete="off"><div class="field"><label for="z_id">Client ID</label><input id="z_id" required autocomplete="off"/></div><div class="field"><label for="z_sec">Client Secret</label><input id="z_sec" type="password" required autocomplete="off"/></div><div class="field"><label for="z_code">Code</label><input id="z_code" required autocomplete="off"/></div>' +
    '<div class="bar" style="justify-content:flex-start"><button class="btn pri" id="zBtn">Connect</button></div></form></div>' + mailBoxesCard();
}
async function mailDoConnect(e) {
  e.preventDefault(); const b = $('zBtn'); b.disabled = true; b.textContent = 'Connecting…'; $('zErr').hidden = true;
  try { const r = await api('/mail/connect', { clientId: $('z_id').value, clientSecret: $('z_sec').value, code: $('z_code').value }); toast('Mail connected: ' + r.email); pgMail(); }
  catch (er) { $('zErr').textContent = er.message; $('zErr').hidden = false; b.disabled = false; b.textContent = 'Connect'; }
}
async function mailReconnect() { if (!await confirmBox('Reconnect Mail?', 'You will need to paste a new Client ID, Secret and Code.', 'Reconnect')) return; try { await api('/mail/disconnect', {}); } catch (e) { } mailConnect(); }
/* unread badge on the Mail menu item */
let MAIL_UNREAD = 0;
async function mailBadge(dec) {
  if (dec) MAIL_UNREAD = Math.max(0, MAIL_UNREAD - 1);
  else { try { if (typeof SERVER !== 'function' || !SERVER()) return; const f = await api('/mail/folders'); const ib = f.folders.find(x => /inbox/i.test(x.type) || /^inbox$/i.test(x.name)); MAIL_UNREAD = ib ? ib.unread : 0; } catch (e) { return; } }
  const a = document.querySelector('#nav a[href="#mail"]'); if (!a) return;
  let n = a.querySelector('.n'); if (!MAIL_UNREAD) { n && n.remove(); return; }
  if (!n) { n = document.createElement('span'); n.className = 'n'; a.append(n); } n.textContent = MAIL_UNREAD;
}
