/* Mumbai Interior — admin sign-in server (Cloudflare Worker + KV).
   Keeps the password check, the 2FA secret and the GitHub publishing key off the public website.

   KV keys
     acct            {email, salt, ph, totp, last, backup:[sha256], gh}
     pending         {secret, gh, kind}                       (15 min) 2FA setup in progress
     ticket:<id>     {email}                                   (5 min)  password OK, waiting for 2FA code
     sess:<id>       {email, exp}                              (12 h)   signed-in session
     fail:<ip>       {n, until}                                         wrong-try counter
*/

import { connect } from 'cloudflare:sockets';

const SESSION_TTL = 12 * 3600, TICKET_TTL = 300, PENDING_TTL = 900, MAX_FAIL = 5;

export default {
  async fetch(req, env) {
    const origin = req.headers.get('Origin') || '';
    const allowed = (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
    const cors = allowed.includes(origin) ? {
      'Access-Control-Allow-Origin': origin, 'Vary': 'Origin',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Max-Age': '600'
    } : {};
    if (req.method === 'OPTIONS') return new Response(null, { status: allowed.includes(origin) ? 204 : 403, headers: cors });
    if (origin && !allowed.includes(origin)) return json({ error: 'origin' }, 403, cors);
    try {
      const res = await route(req, env, new URL(req.url));
      for (const [k, v] of Object.entries(cors)) res.headers.set(k, v);
      res.headers.set('Cache-Control', 'no-store');
      res.headers.set('X-Content-Type-Options', 'nosniff');
      return res;
    } catch (e) {
      const st = e.status || 500;
      return json({ error: e.code || 'server', message: st === 500 ? 'Server error' : e.message }, st, cors);
    }
  }
};

async function route(req, env, url) {
  const p = url.pathname, m = req.method, KV = env.AUTH;
  if (p === '/' && m === 'GET') return json({ ok: true, ready: !!(await KV.get('acct')) });

  // ── website enquiry → email to the business inbox via own SMTP (public, rate-limited) ──
  if (p === '/enquiry' && m === 'POST') {
    const b = await body(req), ip = req.headers.get('CF-Connecting-IP') || 'local';
    if (b._honey) return json({ ok: true });
    if (!env.SMTP_PASS) throw err(503, 'nosmtp', 'Email sending is not set up yet.');
    const f = b.fields && typeof b.fields === 'object' ? b.fields : {};
    const keys = Object.keys(f).slice(0, 15);
    if (!keys.length || !String(b.subject || '').trim()) throw err(400, 'bad', 'Empty enquiry.');
    const clip = (v, n) => String(v == null ? '' : v).replace(/\r/g, '').slice(0, n);
    const cust = clip(b.email, 120).trim().toLowerCase(), okCust = /^[^\s@<>"',;]+@[^\s@<>"',;]+\.[a-z]{2,}$/i.test(cust);
    const day = new Date().toISOString().slice(0, 10), ipk = 'enq:' + ip + ':' + day, dk = 'enq:day:' + day, ck = 'enq:to:' + cust + ':' + day;
    const [ipn, dn, cn] = await Promise.all([KV.get(ipk), KV.get(dk), okCust ? KV.get(ck) : null]);
    if ((+ipn || 0) >= 8) throw err(429, 'limit', 'Too many enquiries from this connection today. Please call or WhatsApp us.');
    if ((+dn || 0) >= 45) throw err(429, 'limit', 'Daily email limit reached. Please call or WhatsApp us.');
    const rows = keys.map(k => [clip(k, 40), clip(f[k], 2000)]);
    const page = clip(b.page || 'https://www.mumbai-interior.in/', 200), subj = clip(b.subject, 180);
    const name = clip(f.Name || f.name || '', 80).trim(), phone = clip(f.Phone || f.phone || '', 30).trim();
    // 1) to the business inbox — Reply goes straight to the customer when they gave an email
    await smtpSend(env, { to: env.ENQUIRY_TO || 'info@mumbai-interior.in', replyTo: okCust ? cust : undefined, subject: subj,
      text: rows.map(r => r[0] + ': ' + r[1]).join('\n') + '\n\n--\nSent from ' + page + '\nIP: ' + ip,
      html: brandMail(env, { preheader: subj, title: subj, intro: 'A new request came in from the website.' + (okCust ? ' Press Reply to answer the customer directly.' : ''), rows, note: 'Sent from <a href="' + escH(page) + '" style="color:#2F4A3A">' + escH(page) + '</a> · ' + new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) }) });
    let sent = 1;
    // 2) confirmation to the customer (only when they gave an email; at most 2 a day per address)
    if (okCust && (+cn || 0) < 2 && (+dn || 0) + 1 < 45) {
      try {
        const hello = name ? 'Namaste ' + name + ',' : 'Namaste,';
        await smtpSend(env, { to: cust, replyTo: env.ENQUIRY_TO || 'info@mumbai-interior.in', subject: 'We received your request — Mumbai Interior',
          text: hello + '\n\nThank you for contacting Mumbai Interior. We have received your request and will call you' + (phone && phone !== '-' ? ' on ' + phone : '') + ' within 24 hours (open all days, 9 AM – 8 PM).\n\nYour request:\n' + rows.map(r => r[0] + ': ' + r[1]).join('\n') + '\n\nNeed us sooner? Call or WhatsApp +91 9004200401.\n\nMumbai Interior\nRM36, Yadav Nagar, MIDC Road, Airoli, Navi Mumbai 400708\nwww.mumbai-interior.in',
          html: brandMail(env, { preheader: 'Thank you — we will call you within 24 hours.', title: 'Thank you for your request', intro: escH(hello) + '<br/><br/>We have received your request and will call you' + (phone && phone !== '-' ? ' on <b>' + escH(phone) + '</b>' : '') + ' within <b>24 hours</b> (open all days, 9 AM – 8 PM). Here is what you sent us:', rows, cta: true, note: 'You are receiving this email because this address was entered on a form at www.mumbai-interior.in. If it was not you, please ignore it.' }) });
        sent++; await KV.put(ck, String((+cn || 0) + 1), { expirationTtl: 90000 });
      } catch (e) { /* the business still got the enquiry */ }
    }
    await Promise.all([KV.put(ipk, String((+ipn || 0) + 1), { expirationTtl: 90000 }), KV.put(dk, String((+dn || 0) + sent), { expirationTtl: 90000 })]);
    return json({ ok: true, confirmation: sent > 1 });
  }

  // ── one-time setup: owner proves control of the GitHub repo, scans QR, confirms a code ──
  if (p === '/setup/start' && m === 'POST') {
    const b = await body(req);
    if (await KV.get('acct')) throw err(409, 'exists', 'Secure sign-in is already set up.');
    await ghOwner(env, b.github);
    const secret = b32(rand(20));
    await KV.put('pending', JSON.stringify({ secret, gh: b.github, kind: 'setup' }), { expirationTtl: PENDING_TTL });
    return json({ secret, otpauth: otpauth(env, b.email, secret) });
  }
  if (p === '/setup/finish' && m === 'POST') {
    const b = await body(req);
    if (await KV.get('acct')) throw err(409, 'exists', 'Secure sign-in is already set up.');
    const pend = JSON.parse(await KV.get('pending') || 'null');
    if (!pend || pend.kind !== 'setup' || pend.gh !== b.github) throw err(400, 'expired', 'Setup expired. Start again.');
    const step = await totpCheck(pend.secret, b.code, -1);
    if (step < 0) throw err(400, 'code', 'That code is wrong. Use the newest code from the app.');
    if (!/^[0-9a-f]{64}$/.test(b.hash || '') || !b.email) throw err(400, 'bad', 'Missing details.');
    const salt = hex(rand(16)), codes = backupCodes();
    await KV.put('acct', JSON.stringify({ email: lc(b.email), salt, ph: await sha(salt + b.hash), totp: pend.secret, last: step, backup: await Promise.all(codes.map(c => sha(c.replace(/-/g, '')))), gh: pend.gh }));
    await KV.delete('pending');
    return json({ backup: codes, ...(await newSession(KV, lc(b.email))) });
  }

  // ── sign in: step 1 password, step 2 code ──
  if (p === '/login' && m === 'POST') {
    const b = await body(req), ip = req.headers.get('CF-Connecting-IP') || 'local';
    await lockCheck(KV, ip);
    const a = await acct(KV);
    if (lc(b.email) !== a.email || await sha(a.salt + (b.hash || '')) !== a.ph) { await lockFail(KV, ip); throw err(401, 'login', 'Email or password is incorrect.'); }
    const id = hex(rand(24));
    await KV.put('ticket:' + id, JSON.stringify({ email: a.email }), { expirationTtl: TICKET_TTL });
    return json({ ticket: id });
  }
  if (p === '/login/2fa' && m === 'POST') {
    const b = await body(req), ip = req.headers.get('CF-Connecting-IP') || 'local';
    await lockCheck(KV, ip);
    const t = JSON.parse(await KV.get('ticket:' + (b.ticket || '')) || 'null');
    if (!t) throw err(401, 'expired', 'Sign-in expired. Enter your password again.');
    const a = await acct(KV);
    if (!(await secondFactor(KV, a, b.code))) { await lockFail(KV, ip); throw err(401, 'code', 'That code is wrong. Use the newest code from the app.'); }
    await KV.delete('ticket:' + b.ticket); await KV.delete('fail:' + ip);
    return json(await newSession(KV, a.email));
  }

  // ── password reset (forgot password): GitHub key + 2FA code or backup code ──
  if (p === '/reset' && m === 'POST') {
    const b = await body(req), ip = req.headers.get('CF-Connecting-IP') || 'local';
    await lockCheck(KV, ip);
    const a = await acct(KV);
    await ghOwner(env, b.github);
    if (!(await secondFactor(KV, a, b.code))) { await lockFail(KV, ip); throw err(401, 'code', 'That code is wrong.'); }
    if (!/^[0-9a-f]{64}$/.test(b.hash || '')) throw err(400, 'bad', 'Missing details.');
    a.salt = hex(rand(16)); a.ph = await sha(a.salt + b.hash); a.gh = b.github;
    await KV.put('acct', JSON.stringify(a));
    return json({ ok: true });
  }

  // ── everything below needs a signed-in session ──
  const s = await session(KV, req);
  if (p === '/me' && m === 'GET') { const a = await acct(KV); return json({ email: s.email, exp: s.exp, backupLeft: a.backup.length }); }
  if (p === '/logout' && m === 'POST') { await KV.delete('sess:' + s.id); return json({ ok: true }); }
  if (p === '/password' && m === 'POST') {
    const b = await body(req), a = await acct(KV);
    if (await sha(a.salt + (b.old || '')) !== a.ph) throw err(401, 'login', 'Current password is incorrect.');
    if (!(await secondFactor(KV, a, b.code))) throw err(401, 'code', 'That 2FA code is wrong.');
    if (!/^[0-9a-f]{64}$/.test(b.hash || '')) throw err(400, 'bad', 'Missing details.');
    a.salt = hex(rand(16)); a.ph = await sha(a.salt + b.hash);
    await KV.put('acct', JSON.stringify(a)); return json({ ok: true });
  }
  if (p === '/backup' && m === 'POST') {
    const b = await body(req), a = await acct(KV);
    if (!(await secondFactor(KV, a, b.code, true))) throw err(401, 'code', 'That 2FA code is wrong.');
    const codes = backupCodes(); a.backup = await Promise.all(codes.map(c => sha(c.replace(/-/g, ''))));
    await KV.put('acct', JSON.stringify(a)); return json({ backup: codes });
  }
  if (p === '/2fa/move/start' && m === 'POST') {
    const b = await body(req), a = await acct(KV);
    if (!(await secondFactor(KV, a, b.code))) throw err(401, 'code', 'That 2FA code is wrong.');
    const secret = b32(rand(20));
    await KV.put('pending', JSON.stringify({ secret, kind: 'move' }), { expirationTtl: PENDING_TTL });
    return json({ secret, otpauth: otpauth(env, a.email, secret) });
  }
  if (p === '/2fa/move/finish' && m === 'POST') {
    const b = await body(req), a = await acct(KV), pend = JSON.parse(await KV.get('pending') || 'null');
    if (!pend || pend.kind !== 'move') throw err(400, 'expired', 'Expired. Start again.');
    const step = await totpCheck(pend.secret, b.code, -1);
    if (step < 0) throw err(400, 'code', 'That code is wrong. Use the newest code from the new app.');
    a.totp = pend.secret; a.last = step; await KV.put('acct', JSON.stringify(a)); await KV.delete('pending');
    return json({ ok: true });
  }
  if (p === '/github' && m === 'POST') {
    const b = await body(req), a = await acct(KV);
    await ghOwner(env, b.github); a.gh = b.github; await KV.put('acct', JSON.stringify(a)); return json({ ok: true });
  }

  // ── Zoho Mail: several mailboxes (info@, asheesh@, …), each connected once with its own Zoho login ──
  if (p === '/mail/status' && m === 'GET') { const Z = await zLoad(KV); return json({ connected: Z.boxes.length > 0, email: Z.boxes[0] && Z.boxes[0].email, boxes: Z.boxes.map(x => x.email) }); }
  if (p === '/mail/connect' && m === 'POST') {
    const b = await body(req);
    if (!b.clientId || !b.clientSecret || !b.code) throw err(400, 'bad', 'Fill in Client ID, Client Secret and Code.');
    const r = await fetch(zAcc(env) + '/oauth/v2/token?' + new URLSearchParams({ grant_type: 'authorization_code', client_id: b.clientId.trim(), client_secret: b.clientSecret.trim(), code: b.code.trim() }), { method: 'POST' });
    const j = await r.json().catch(() => ({}));
    if (!j.refresh_token) throw err(400, 'zoho', j.error === 'invalid_code' ? 'That code has expired or was already used. Generate a new code (it lasts 10 minutes) and try again.' : 'Zoho did not accept these details (' + (j.error || r.status) + '). Check the Client ID and Secret.');
    const Z = await zLoad(KV), cid = 'c' + [...rand(5)].map(x => x.toString(16).padStart(2, '0')).join('');
    Z.conns[cid] = { cid: b.clientId.trim(), sec: b.clientSecret.trim(), refresh: j.refresh_token };
    await KV.put('zoho_at:' + cid, JSON.stringify({ t: j.access_token, exp: Date.now() + (j.expires_in || 3600) * 1000 - 120000 }), { expirationTtl: 3500 });
    await zSave(KV, Z);
    const acc = await zApi(env, KV, cid, '/api/accounts').catch(e => { delete Z.conns[cid]; zSave(KV, Z); throw e; });
    const found = (acc.data || []).map(a => ({ email: lc(a.primaryEmailAddress || a.mailboxAddress), acc: String(a.accountId), conn: cid })).filter(x => x.email && x.acc);
    if (!found.length) { delete Z.conns[cid]; await zSave(KV, Z); throw err(400, 'zoho', 'Connected, but no mailbox was found for this Zoho login.'); }
    Z.boxes = Z.boxes.filter(x => !found.some(f => f.email === x.email)).concat(found);
    zTidy(Z); await zSave(KV, Z);
    return json({ connected: true, email: found[0].email, added: found.map(x => x.email), boxes: Z.boxes.map(x => x.email) });
  }
  if (p === '/mail/disconnect' && m === 'POST') {
    const b = await body(req), Z = await zLoad(KV);
    Z.boxes = b.box ? Z.boxes.filter(x => x.email !== lc(b.box)) : [];
    zTidy(Z); await zSave(KV, Z); return json({ ok: true, boxes: Z.boxes.map(x => x.email) });
  }
  if (p === '/mail/unread' && m === 'GET') {
    const Z = await zLoad(KV);
    const out = await Promise.all(Z.boxes.map(async x => { try { const r = await zApi(env, KV, x.conn, '/api/accounts/' + x.acc + '/folders'); const ib = (r.data || []).find(f => /inbox/i.test(f.folderType) || /^inbox$/i.test(f.folderName)); return { email: x.email, unread: ib ? +ib.unreadCount || 0 : 0 }; } catch (e) { return { email: x.email, unread: 0, error: e.message }; } }));
    return json({ boxes: out });
  }
  if (p.startsWith('/mail/')) {
    const Z = await zLoad(KV); if (!Z.boxes.length) throw err(409, 'nomail', 'Mail is not connected yet.');
    const want = lc(url.searchParams.get('box') || (m === 'POST' ? (await req.clone().json().catch(() => ({}))).box : '') || '');
    const z = (want && Z.boxes.find(x => x.email === want)) || Z.boxes[0];
    const A = '/api/accounts/' + z.acc, zApiB = (path, opt) => zApi(env, KV, z.conn, path, opt);
    if (p === '/mail/folders' && m === 'GET') { const r = await zApiB(A + '/folders'); return json({ email: z.email, folders: (r.data || []).map(f => ({ id: f.folderId, name: f.folderName, type: f.folderType, unread: +f.unreadCount || 0 })) }); }
    if (p === '/mail/list' && m === 'GET') {
      const q = new URLSearchParams({ folderId: url.searchParams.get('folder') || '', start: String(Math.max(1, +url.searchParams.get('start') || 1)), limit: '30', sortorder: 'false' });
      const r = await zApiB(A + '/messages/view?' + q);
      return json({ messages: (r.data || []).map(x => ({ id: x.messageId, folder: x.folderId, from: x.sender || x.fromAddress, fromAddress: x.fromAddress, to: x.toAddress, subject: x.subject, summary: x.summary, time: +x.receivedTime || +x.sentDateInGMT, unread: String(x.status) === '0', attach: String(x.hasAttachment) === '1' })) });
    }
    if (p === '/mail/read' && m === 'GET') {
      const f = url.searchParams.get('folder'), id = url.searchParams.get('id');
      if (!/^\d+$/.test(f || '') || !/^\d+$/.test(id || '')) throw err(400, 'bad', 'Bad message.');
      const [c, h] = await Promise.all([zApiB(A + '/folders/' + f + '/messages/' + id + '/content'), zApiB(A + '/folders/' + f + '/messages/' + id + '/details').catch(() => ({}))]);
      const marked = await zMark(zApiB, A, [id], true).then(() => true, () => false);
      const d = h.data || {};
      return json({ content: (c.data || {}).content || '', from: d.sender || d.fromAddress, fromAddress: d.fromAddress, to: d.toAddress, cc: d.ccAddress, subject: d.subject, time: +d.receivedTime || +d.sentDateInGMT, marked });
    }
    if (p === '/mail/mark' && m === 'POST') {
      const b = await body(req), ids = (Array.isArray(b.ids) ? b.ids : []).map(String).filter(x => /^\d{1,25}$/.test(x)).slice(0, 50);
      if (!ids.length) throw err(400, 'bad', 'Bad message.');
      await zMark(zApiB, A, ids, b.read !== false); return json({ ok: true });
    }
    if (p === '/mail/send' && m === 'POST') {
      const b = await body(req);
      if (!/\S+@\S+\.\S+/.test(b.to || '')) throw err(400, 'bad', 'Enter a valid "To" email address.');
      const sub = String(b.subject || '(no subject)').slice(0, 250);
      const msg = { fromAddress: z.email, toAddress: b.to, ccAddress: b.cc || undefined, subject: sub, content: brandMail(env, { preheader: sub, bodyHtml: String(b.content || '') }), mailFormat: 'html' };
      if (b.replyTo && /^\d+$/.test(b.replyTo)) await zApiB(A + '/messages/' + b.replyTo, { method: 'POST', body: JSON.stringify({ ...msg, action: 'reply' }) });
      else await zApiB(A + '/messages', { method: 'POST', body: JSON.stringify(msg) });
      return json({ ok: true });
    }
    throw err(404, 'notfound', 'Not found.');
  }

  // ── publishing: forwards only this repo's contents API, using the key kept here ──
  if (p === '/gh' || p.startsWith('/gh/contents/')) {
    if (!['GET', 'PUT'].includes(m)) throw err(405, 'method', 'Not allowed.');
    const a = await acct(KV);
    const r = await fetch(ghBase(env) + '/repos/' + env.GH_OWNER + '/' + env.GH_REPO + p.slice(3) + url.search, {
      method: m, body: m === 'PUT' ? await req.text() : undefined,
      headers: { Accept: 'application/vnd.github+json', Authorization: 'Bearer ' + a.gh, 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'mumbai-interior-admin', ...(m === 'PUT' ? { 'Content-Type': 'application/json' } : {}) }
    });
    return new Response(await r.text(), { status: r.status, headers: { 'Content-Type': 'application/json' } });
  }
  throw err(404, 'notfound', 'Not found.');
}

/* ── minimal SMTP client (implicit TLS, AUTH LOGIN) for sending from the business mailbox ── */
const b64u = str => { const b = new TextEncoder().encode(str); let o = ''; for (const x of b) o += String.fromCharCode(x); return btoa(o); };
const encHead = v => /^[\x20-\x7e]*$/.test(v) ? v : '=?UTF-8?B?' + b64u(v) + '?=';
async function smtpSend(env, { to, subject, text, html, replyTo }) {
  const user = env.SMTP_USER || 'noreply@mumbai-interior.in', host = env.SMTP_HOST || 'smtppro.zoho.in', port = +(env.SMTP_PORT || 465);
  const sock = connect({ hostname: host, port }, { secureTransport: env.SMTP_TLS === 'off' ? 'off' : 'on', allowHalfOpen: false });
  const w = sock.writable.getWriter(), r = sock.readable.getReader(), dec = new TextDecoder(), enc = new TextEncoder();
  let buf = '';
  const reply = async () => {
    const t0 = Date.now();
    for (;;) {
      const lines = buf.split('\r\n');
      for (let i = 0; i < lines.length - 1; i++) if (/^\d{3} /.test(lines[i])) { const out = lines.slice(0, i + 1).join('\n'); buf = lines.slice(i + 1).join('\r\n'); return out; }
      if (Date.now() - t0 > 15000) throw err(504, 'smtp', 'Mail server did not answer.');
      const { value, done } = await r.read(); if (done) throw err(502, 'smtp', 'Mail server closed the connection.');
      buf += dec.decode(value, { stream: true });
    }
  };
  const cmd = async (c, ok) => { if (c != null) await w.write(enc.encode(c + '\r\n')); const res = await reply(); if (!res.startsWith(ok)) throw err(502, 'smtp', 'Mail server said: ' + res.split('\n').pop().slice(0, 160)); return res; };
  try {
    await cmd(null, '220'); await cmd('EHLO mumbai-interior.in', '250');
    await cmd('AUTH LOGIN', '334'); await cmd(b64u(user), '334'); await cmd(b64u(env.SMTP_PASS), '235');
    await cmd('MAIL FROM:<' + user + '>', '250');
    for (const t of String(to).split(',').map(x => x.trim()).filter(Boolean)) await cmd('RCPT TO:<' + t + '>', '25');
    await cmd('DATA', '354');
    const wrap = t => b64u(t).replace(/.{1,76}/g, '$&\r\n');
    const head = ['From: ' + encHead('Mumbai Interior') + ' <' + user + '>', 'To: ' + to, 'Reply-To: ' + (replyTo || env.ENQUIRY_TO || 'info@mumbai-interior.in'), 'Subject: ' + encHead(subject),
      'Date: ' + new Date().toUTCString().replace('GMT', '+0000'), 'Message-ID: <' + crypto.randomUUID() + '@mumbai-interior.in>', 'MIME-Version: 1.0'];
    let msg;
    if (html) {
      const bd = 'mi_' + crypto.randomUUID().replace(/-/g, '');
      msg = head.concat(['Content-Type: multipart/alternative; boundary="' + bd + '"', '', '--' + bd, 'Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', wrap(text || ''), '--' + bd, 'Content-Type: text/html; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', wrap(html), '--' + bd + '--']).join('\r\n');
    } else msg = head.concat(['Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', wrap(text)]).join('\r\n');
    await cmd(msg + '\r\n.', '250');
    await cmd('QUIT', '221').catch(() => {});
  } finally { try { await w.close(); } catch (e) { } try { sock.close(); } catch (e) { } }
}

/* ── branded email (header + footer), email-client safe: tables and inline styles ── */
const escH = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function brandMail(env, { preheader, title, intro, rows, bodyHtml, cta, note }) {
  const site = 'https://www.mumbai-interior.in', ink = '#1F2A22', forest = '#2F4A3A', gold = '#E9C46A', muted = '#5B675D', line = '#E3E6DD';
  const table = rows && rows.length ? '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:18px 0 6px;border:1px solid ' + line + ';border-radius:10px">' +
    rows.map((r, i) => '<tr><td style="padding:10px 14px;' + (i ? 'border-top:1px solid ' + line + ';' : '') + 'width:34%;color:' + muted + ';font-size:13px;vertical-align:top">' + escH(r[0]) + '</td><td style="padding:10px 14px;' + (i ? 'border-top:1px solid ' + line + ';' : '') + 'color:' + ink + ';font-size:14px;white-space:pre-wrap;word-break:break-word">' + escH(r[1]) + '</td></tr>').join('') + '</table>' : '';
  const btn = (href, label, bg, fg) => '<a href="' + href + '" style="display:inline-block;background:' + bg + ';color:' + fg + ';text-decoration:none;font-weight:700;font-size:14px;padding:11px 18px;border-radius:10px;margin:6px 8px 0 0">' + label + '</a>';
  return '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>' + escH(title || 'Mumbai Interior') + '</title></head>' +
    '<body style="margin:0;padding:0;background:#F2F3EE;font-family:Arial,Helvetica,sans-serif">' +
    (preheader ? '<div style="display:none;max-height:0;overflow:hidden;opacity:0">' + escH(preheader) + '</div>' : '') +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F2F3EE"><tr><td align="center" style="padding:20px 10px">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid ' + line + '">' +
    // header
    '<tr><td style="background:' + forest + ';padding:18px 22px"><table role="presentation" cellpadding="0" cellspacing="0"><tr>' +
    '<td style="padding-right:12px"><img src="' + site + '/assets/logo-96.png" width="44" height="44" alt="" style="display:block;border-radius:8px"></td>' +
    '<td><a href="' + site + '" style="color:#ffffff;text-decoration:none;font-size:20px;font-weight:700;letter-spacing:.2px">Mumbai Interior</a>' +
    '<div style="color:' + gold + ';font-size:12px;margin-top:2px">Custom furniture · Made in India</div></td></tr></table></td></tr>' +
    '<tr><td style="height:4px;background:' + gold + ';font-size:0;line-height:0">&nbsp;</td></tr>' +
    // body
    '<tr><td style="padding:24px 22px 8px;color:' + ink + ';font-size:15px;line-height:1.6">' +
    (title ? '<h1 style="margin:0 0 10px;font-size:20px;line-height:1.3;color:' + ink + '">' + escH(title) + '</h1>' : '') +
    (intro ? '<p style="margin:0">' + intro + '</p>' : '') + (bodyHtml || '') + table +
    (cta ? '<div style="margin:18px 0 4px">' + btn('tel:+919004200401', 'Call 9004200401', forest, '#ffffff') + btn('https://wa.me/919004200401', 'WhatsApp us', '#1F8F4E', '#ffffff') + btn(site, 'Visit website', gold, ink) + '</div>' : '') +
    '</td></tr>' +
    (note ? '<tr><td style="padding:6px 22px 18px;color:' + muted + ';font-size:12px;line-height:1.5">' + note + '</td></tr>' : '<tr><td style="padding:6px 22px 10px"></td></tr>') +
    // footer
    '<tr><td style="background:#F7F8F4;border-top:1px solid ' + line + ';padding:16px 22px;color:' + muted + ';font-size:12px;line-height:1.7">' +
    '<b style="color:' + ink + '">Mumbai Interior</b> · Interiors &amp; custom furniture<br>RM36, Yadav Nagar, MIDC Road, Airoli, Navi Mumbai 400708<br>' +
    '<a href="tel:+919004200401" style="color:' + forest + ';text-decoration:none">+91 9004200401</a> · <a href="mailto:info@mumbai-interior.in" style="color:' + forest + ';text-decoration:none">info@mumbai-interior.in</a> · <a href="' + site + '" style="color:' + forest + ';text-decoration:none">www.mumbai-interior.in</a><br>Open all days, 9 AM – 8 PM' +
    '</td></tr></table></td></tr></table></body></html>';
}

/* ── Zoho helpers ── */
const zAcc = env => env.ZOHO_ACCOUNTS || 'https://accounts.zoho.in';
const zMail = env => env.ZOHO_MAIL || 'https://mail.zoho.in';
async function zLoad(KV) {
  const Z = JSON.parse(await KV.get('zoho') || 'null') || {};
  if (Z.refresh) return { conns: { c0: { cid: Z.cid, sec: Z.sec, refresh: Z.refresh } }, boxes: Z.acc ? [{ email: lc(Z.email), acc: String(Z.acc), conn: 'c0' }] : [] }; // older single-mailbox format
  return { conns: Z.conns || {}, boxes: Z.boxes || [] };
}
const zSave = (KV, Z) => KV.put('zoho', JSON.stringify({ conns: Z.conns, boxes: Z.boxes }));
function zTidy(Z) { for (const k of Object.keys(Z.conns)) if (!Z.boxes.some(x => x.conn === k)) delete Z.conns[k]; }
async function zToken(env, KV, conn, force) {
  const c = JSON.parse(await KV.get('zoho_at:' + conn) || 'null');
  if (!force && c && c.exp > Date.now()) return c.t;
  const z = (await zLoad(KV)).conns[conn]; if (!z) throw err(409, 'nomail', 'This mailbox is not connected any more.');
  const r = await fetch(zAcc(env) + '/oauth/v2/token?' + new URLSearchParams({ grant_type: 'refresh_token', client_id: z.cid, client_secret: z.sec, refresh_token: z.refresh }), { method: 'POST' });
  const j = await r.json().catch(() => ({}));
  if (!j.access_token) throw err(502, 'zoho', 'Zoho refused the saved connection (' + (j.error || r.status) + '). Reconnect this mailbox.');
  await KV.put('zoho_at:' + conn, JSON.stringify({ t: j.access_token, exp: Date.now() + (j.expires_in || 3600) * 1000 - 120000 }), { expirationTtl: 3500 });
  return j.access_token;
}
async function zApi(env, KV, conn, path, opt = {}, retry) {
  const t = await zToken(env, KV, conn, retry);
  const r = await fetch(zMail(env) + path, { ...opt, headers: { Authorization: 'Zoho-oauthtoken ' + t, Accept: 'application/json', ...(opt.body ? { 'Content-Type': 'application/json' } : {}) } });
  if (r.status === 401 && !retry) return zApi(env, KV, conn, path, opt, true);
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw err(r.status === 404 ? 404 : 502, 'zoho', (j.data && (j.data.moreInfo || j.data.errorCode)) || (j.status && j.status.description) || 'Zoho Mail error ' + r.status);
  return j;
}

/* Zoho wants message ids as JSON numbers, but they are longer than JavaScript numbers can hold exactly — so write them as digits */
const zMark = (zApiB, A, ids, read) => zApiB(A + '/updatemessage', { method: 'PUT', body: '{"mode":"' + (read ? 'markAsRead' : 'markAsUnread') + '","messageId":[' + ids.filter(x => /^\d+$/.test(x)).join(',') + ']}' });

/* ── helpers ── */
const json = (o, st = 200, h = {}) => new Response(JSON.stringify(o), { status: st, headers: { 'Content-Type': 'application/json', ...h } });
const err = (status, code, message) => Object.assign(new Error(message), { status, code });
const lc = s => String(s || '').trim().toLowerCase();
const rand = n => crypto.getRandomValues(new Uint8Array(n));
const hex = b => [...b].map(x => x.toString(16).padStart(2, '0')).join('');
const enc = new TextEncoder();
async function sha(s) { return hex(new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(s)))); }
async function body(req) { try { return await req.json(); } catch (e) { throw err(400, 'bad', 'Bad request.'); } }
async function acct(KV) { const a = JSON.parse(await KV.get('acct') || 'null'); if (!a) throw err(409, 'nosetup', 'Secure sign-in is not set up yet.'); return a; }
const ghBase = env => env.GH_API || 'https://api.github.com';
async function ghOwner(env, token) {
  if (!token || token.length < 20) throw err(400, 'github', 'Enter your GitHub key.');
  const r = await fetch(ghBase(env) + '/repos/' + env.GH_OWNER + '/' + env.GH_REPO, { headers: { Accept: 'application/vnd.github+json', Authorization: 'Bearer ' + token, 'User-Agent': 'mumbai-interior-admin' } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.permissions || !j.permissions.push) throw err(403, 'github', 'That GitHub key can\'t change the website. Check it has "Contents: Read and write" for the ' + env.GH_REPO + ' repository.');
}
async function newSession(KV, email) {
  const id = hex(rand(32)), exp = Date.now() + SESSION_TTL * 1000;
  await KV.put('sess:' + id, JSON.stringify({ email, exp }), { expirationTtl: SESSION_TTL });
  return { session: id, exp };
}
async function session(KV, req) {
  const id = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/, '');
  const s = id && /^[0-9a-f]{64}$/.test(id) ? JSON.parse(await KV.get('sess:' + id) || 'null') : null;
  if (!s || s.exp < Date.now()) throw err(401, 'session', 'Please sign in again.');
  return { ...s, id };
}
async function lockCheck(KV, ip) {
  const f = JSON.parse(await KV.get('fail:' + ip) || 'null');
  if (f && f.until && f.until > Date.now()) throw err(429, 'locked', 'Too many wrong tries. Wait ' + Math.ceil((f.until - Date.now()) / 60000) + ' minute(s) and try again.');
}
async function lockFail(KV, ip) {
  const f = JSON.parse(await KV.get('fail:' + ip) || 'null') || { n: 0 };
  f.n++; if (f.n >= MAX_FAIL) f.until = Date.now() + Math.min(60, 5 * 2 ** (f.n - MAX_FAIL)) * 60000;
  await KV.put('fail:' + ip, JSON.stringify(f), { expirationTtl: 86400 });
}
/* app code, or a one-time backup code */
async function secondFactor(KV, a, code, appOnly) {
  const c = String(code || '').replace(/\s/g, '');
  if (/^\d{6}$/.test(c)) { const st = await totpCheck(a.totp, c, a.last || -1); if (st < 0) return false; a.last = st; await KV.put('acct', JSON.stringify(a)); return true; }
  if (appOnly) return false;
  const h = await sha(c.toUpperCase().replace(/[^A-Z0-9]/g, '')), i = a.backup.indexOf(h);
  if (i < 0) return false;
  a.backup.splice(i, 1); await KV.put('acct', JSON.stringify(a)); return true;
}
function backupCodes() { const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; return Array.from({ length: 8 }, () => { const r = rand(10); return [...r].map(x => A[x % A.length]).join('').replace(/(.{5})/, '$1-'); }); }

/* ── TOTP (RFC 6238: SHA-1, 30 s, 6 digits, ±1 step), returns matched step or -1; refuses reuse ── */
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function b32(bytes) { let bits = 0, v = 0, o = ''; for (const b of bytes) { v = (v << 8) | b; bits += 8; while (bits >= 5) { o += B32[(v >>> (bits - 5)) & 31]; bits -= 5; } } if (bits) o += B32[(v << (5 - bits)) & 31]; return o; }
function unb32(s) { let bits = 0, v = 0; const o = []; for (const ch of s.replace(/=+$/, '')) { v = (v << 5) | B32.indexOf(ch); bits += 5; if (bits >= 8) { o.push((v >>> (bits - 8)) & 255); bits -= 8; } } return new Uint8Array(o); }
async function hotp(secret, step) {
  const key = await crypto.subtle.importKey('raw', unb32(secret), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
  const msg = new ArrayBuffer(8), dv = new DataView(msg); dv.setUint32(0, Math.floor(step / 2 ** 32)); dv.setUint32(4, step >>> 0);
  const h = new Uint8Array(await crypto.subtle.sign('HMAC', key, msg)), o = h[19] & 15;
  return String((((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3]) % 1e6).padStart(6, '0');
}
async function totpCheck(secret, code, last) {
  const c = String(code || '').replace(/\s/g, ''); if (!/^\d{6}$/.test(c)) return -1;
  const now = Math.floor(Date.now() / 30000);
  for (const st of [now, now - 1, now + 1]) if (st > last && await hotp(secret, st) === c) return st;
  return -1;
}
function otpauth(env, email, secret) { const iss = env.ISSUER || 'Mumbai Interior'; return 'otpauth://totp/' + encodeURIComponent(iss + ':' + lc(email)) + '?secret=' + secret + '&issuer=' + encodeURIComponent(iss) + '&algorithm=SHA1&digits=6&period=30'; }
export { hotp, b32 }; /* for tests */
// smtp enabled 2026-11-16
