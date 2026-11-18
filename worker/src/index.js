/* Mumbai Interior — admin sign-in server (Cloudflare Worker + KV).
   Keeps the password check, the 2FA secret and the GitHub publishing key off the public website.

   KV keys
     acct            {email, salt, ph, totp, last, backup:[sha256], gh}   owner, always super admin
     user:<email>    {email, name, role, custom?, salt, ph, totp?, backup, active}   team members (list in "users")
     roles           {key: {name, perms[]}}                    role master (super_admin is fixed)
     vaultkey        shared AES key for private documents
     pending         {secret, gh, kind}                       (15 min) 2FA setup in progress
     ticket:<id>     {email}                                   (5 min)  password OK, waiting for 2FA code
     sess:<id>       {email, exp}                              (12 h)   signed-in session
     fail:<ip>       {n, until}                                         wrong-try counter
*/

import { connect } from 'cloudflare:sockets';

const REMEMBER_TTL = 30 * 86400, SESSION_TTL = 12 * 3600, TICKET_TTL = 300, PENDING_TTL = 900, MAX_FAIL = 5;

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
  if (p === '/' && m === 'GET') return json({ ok: true, ready: !!(await KV.get('acct')), roles: true });

  // ── website enquiry → email to the business inbox via own SMTP (public, rate-limited) ──
  // ── product review from the website: kept as "waiting for approval" and emailed to the business (public, rate-limited) ──
  if (p === '/review' && m === 'POST') {
    const b = await body(req), ip = req.headers.get('CF-Connecting-IP') || 'local';
    if (b._honey) return json({ ok: true });
    const clip = (v, n) => String(v == null ? '' : v).replace(/[\r\u0000-\u0008]/g, '').trim().slice(0, n);
    const r = { id: hex(rand(8)), pid: String(b.pid || '').slice(0, 20), product: clip(b.product, 120), url: clip(b.url, 200), name: clip(b.name, 60), place: clip(b.place, 60), phone: clip(b.phone, 20), rating: Math.min(5, Math.max(1, Math.round(+b.rating || 5))), text: clip(b.text, 1500), date: new Date().toISOString().slice(0, 10), at: Date.now() };
    if (!r.pid || !r.name || r.text.length < 10) throw err(400, 'bad', 'Add your name and a few words about the product.');
    const day = r.date, ipk = 'rev:' + ip + ':' + day, ipn = +(await KV.get(ipk)) || 0;
    if (ipn >= 5) throw err(429, 'limit', 'Too many reviews from this connection today.');
    const list = JSON.parse(await KV.get('reviews:pending') || '[]'); if (list.length >= 200) list.shift(); list.push(r);
    await KV.put('reviews:pending', JSON.stringify(list)); await KV.put(ipk, String(ipn + 1), { expirationTtl: 90000 });
    if (env.SMTP_PASS) {
      const rows = [['Product', r.product], ['Rating', r.rating + ' out of 5'], ['Name', r.name], ['Area', r.place || '-'], ['Phone', r.phone || '-'], ['Review', r.text]];
      const admin = (env.SITE_URL || 'https://www.mumbai-interior.in') + '/admin/#testimonials';
      try {
        await smtpSend(env, { to: env.ENQUIRY_TO || 'info@mumbai-interior.in', subject: 'New review waiting for approval — ' + r.product + ' — ' + r.rating + '★',
          text: rows.map(x => x[0] + ': ' + x[1]).join('\n') + '\n\nApprove or reject it in the admin: ' + admin,
          html: brandMail(env, { preheader: r.name + ' rated ' + r.product + ' ' + r.rating + '/5', title: 'New review waiting for approval', intro: 'Check it against your order records, then approve it to show it on the website (or reject it).', rows, cta: false, note: '<a href="' + admin + '" style="display:inline-block;background:#2F4A3A;color:#fff;text-decoration:none;font-weight:700;padding:10px 16px;border-radius:9px">Approve in admin</a>' }) });
      } catch (e) { /* still saved for approval */ }
    }
    return json({ ok: true });
  }

  // ── payment screenshots from the website's /pay/ page (public, rate-limited). Key = hash of "request no.|amount". ──
  if ((p === '/pay/proof' && m === 'POST') || (p === '/pay/status' && m === 'GET')) {
    const src = m === 'GET' ? Object.fromEntries(url.searchParams) : await body(req);
    const n = String(src.n || '').trim().toUpperCase(), am = Math.round(parseFloat(src.am) * 100) / 100;
    if (!/^[A-Z]{1,4}-\d{4}-\d{1,5}$/.test(n) || !(am > 0 && am <= 1000000)) throw err(400, 'bad', 'This payment link is not complete.');
    const k = (await sha(n + '|' + am.toFixed(2))).slice(0, 24), cur = JSON.parse(await KV.get('proof:' + k) || 'null');
    if (m === 'GET') { const rc = !!(await KV.get('rcptm:' + k)); return json(cur ? { s: cur.s, t: cur.t, d: cur.d || '', reason: cur.reason || '', utr: cur.utr || '', rc } : { s: 'none', rc }); }
    if (src._honey) return json({ ok: true });
    if (cur && cur.s === 'paid') throw err(409, 'paid', 'This payment is already confirmed. Thank you!');
    const ip = req.headers.get('CF-Connecting-IP') || 'local', day = new Date().toISOString().slice(0, 10), ipk = 'pp:' + ip + ':' + day, ipn = +(await KV.get(ipk)) || 0;
    if (ipn >= 8) throw err(429, 'limit', 'Too many uploads from this connection today. Please WhatsApp us the screenshot.');
    const img = String(src.img || '').replace(/^data:image\/\w+;base64,/, '').replace(/\s/g, '');
    if (!/^(\/9j\/|iVBOR)/.test(img) || img.length > 1400000) throw err(400, 'bad', 'Please choose a photo or screenshot of the payment (JPG or PNG).');
    const clip = (v, l) => String(v == null ? '' : v).replace(/[\r\n\u0000-\u001f<>]/g, ' ').trim().slice(0, l);
    const rec = { k, n, am, s: 'review', t: Date.now(), utr: clip(src.utr, 30).replace(/[^\w\-]/g, ''), name: clip(src.name, 60), phone: clip(src.phone, 20), ip: ip.slice(0, 45), tries: ((cur && cur.tries) || 0) + 1 };
    if (rec.tries > 10) throw err(429, 'limit', 'Too many uploads for this payment. Please WhatsApp us the screenshot.');
    const TTL = { expirationTtl: 60 * 60 * 24 * 120 };
    await KV.put('proofimg:' + k, img, TTL); await KV.put('proof:' + k, JSON.stringify(rec), TTL); await KV.put(ipk, String(ipn + 1), { expirationTtl: 90000 });
    const idx = JSON.parse(await KV.get('proofs') || '[]').filter(x => x !== k); idx.push(k); await KV.put('proofs', JSON.stringify(idx.slice(-300)));
    if (env.SMTP_PASS) {
      const rows = [['Request', n], ['Amount', '₹' + am.toLocaleString('en-IN')], ['UTR / ref.', rec.utr || '—'], ['Name', rec.name || '—'], ['Phone', rec.phone || '—']];
      try { await smtpSend(env, { to: env.ENQUIRY_TO || 'info@mumbai-interior.in', subject: 'Payment screenshot to check — ' + n + ' — ₹' + am.toLocaleString('en-IN'),
        text: rows.map(x => x[0] + ': ' + x[1]).join('\n') + '\n\nCheck your bank, then approve or reject it in the admin: ' + (env.SITE_URL || 'https://www.mumbai-interior.in') + '/admin/#payments',
        html: brandMail(env, { preheader: 'A customer says they paid ₹' + am.toLocaleString('en-IN') + ' for ' + n, title: 'Payment screenshot to check', intro: 'Check that the money is in your bank account, then approve or reject it in the admin (Payment requests). The customer sees "under review" until you decide.', rows, note: 'The screenshot is attached.' }),
        attachments: [{ name: n + '-payment.' + (img.startsWith('iVBOR') ? 'png' : 'jpg'), b64: img }] }); } catch (e) { /* still saved for the admin */ }
    }
    return json({ ok: true, s: 'review', t: rec.t });
  }

  // ── payment receipt PDF for the customer (public, rate-limited; put online by the admin when a request is marked paid) ──
  if (p === '/pay/receipt' && m === 'GET') {
    const n = String(url.searchParams.get('n') || '').trim().toUpperCase(), am = Math.round(parseFloat(url.searchParams.get('am')) * 100) / 100;
    const page = (t, st) => new Response('<!doctype html><meta name="viewport" content="width=device-width"><title>Receipt</title><body style="font:16px system-ui,sans-serif;padding:2rem;max-width:30rem;margin:auto"><h1 style="font-size:1.3rem">' + t + '</h1><p>Please call or WhatsApp us on +91 9004200401.</p></body>', { status: st, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    if (!/^[A-Z]{1,4}-\d{4}-\d{1,5}$/.test(n) || !(am > 0 && am <= 1000000)) return page('This receipt link is not complete.', 400);
    const ip = req.headers.get('CF-Connecting-IP') || 'local', ipk = 'rcd:' + ip + ':' + new Date().toISOString().slice(0, 10), ipn = +(await KV.get(ipk)) || 0;
    if (ipn >= 40) return page('Too many downloads from this connection today.', 429);
    await KV.put(ipk, String(ipn + 1), { expirationTtl: 90000 });
    const k = (await sha(n + '|' + am.toFixed(2))).slice(0, 24), pdf = await KV.get('rcpt:' + k);
    if (!pdf) return page('The receipt is not ready yet.', 404);
    return new Response(Uint8Array.from(atob(pdf), c => c.charCodeAt(0)), { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="Payment-Receipt-' + n.replace(/^PR-/, 'RC-') + '.pdf"' } });
  }

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

  // ── sign in: step 1 password, step 2 code (first sign-in of a team member: scan QR to set up 2FA) ──
  if (p === '/login' && m === 'POST') {
    const b = await body(req), ip = req.headers.get('CF-Connecting-IP') || 'local';
    await lockCheck(KV, ip); await acct(KV);
    const u = await getUser(KV, b.email);
    if (!u || !u.ph || await sha(u.salt + (b.hash || '')) !== u.ph) { await lockFail(KV, ip); throw err(401, 'login', 'Email or password is incorrect.'); }
    if (u.active === false) throw err(403, 'inactive', 'This account is switched off. Ask the owner to switch it on.');
    const id = hex(rand(24)), t = { email: u.email };
    if (!u.totp) t.secret = b32(rand(20));
    await KV.put('ticket:' + id, JSON.stringify(t), { expirationTtl: TICKET_TTL * 2 });
    return json({ ticket: id, ...(t.secret ? { setup: { secret: t.secret, otpauth: otpauth(env, u.email, t.secret) } } : {}) });
  }
  if (p === '/login/2fa' && m === 'POST') {
    const b = await body(req), ip = req.headers.get('CF-Connecting-IP') || 'local';
    await lockCheck(KV, ip);
    const t = JSON.parse(await KV.get('ticket:' + (b.ticket || '')) || 'null');
    if (!t) throw err(401, 'expired', 'Sign-in expired. Enter your password again.');
    const u = await getUser(KV, t.email); if (!u || u.active === false) throw err(401, 'login', 'This account is not available.');
    let codes;
    if (t.secret) {
      const step = await totpCheck(t.secret, b.code, -1);
      if (step < 0) { await lockFail(KV, ip); throw err(401, 'code', 'That code is wrong. Use the newest code from the app.'); }
      codes = backupCodes(); u.totp = t.secret; u.last = step; u.backup = await Promise.all(codes.map(c => sha(c.replace(/-/g, '')))); await saveUser(KV, u);
    } else if (!(await secondFactor(KV, u, b.code))) { await lockFail(KV, ip); throw err(401, 'code', 'That code is wrong. Use the newest code from the app.'); }
    await KV.delete('ticket:' + b.ticket); await KV.delete('fail:' + ip);
    return json({ ...(await newSession(KV, u.email, b.remember ? REMEMBER_TTL : 0)), ...(codes ? { backup: codes } : {}) });
  }

  // ── forgot password: a 6-digit code is emailed to the account's own address (any team member). Two-step sign-in still applies. ──
  if (p === '/forgot/start' && m === 'POST') {
    const b = await body(req), ip = req.headers.get('CF-Connecting-IP') || 'local', email = lc(b.email);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw err(400, 'bad', 'Enter the email you sign in with.');
    if (!env.SMTP_PASS) throw err(503, 'nosmtp', 'Email sending is not set up yet. Ask the owner to reset your password.');
    const hr = Math.floor(Date.now() / 36e5), ipk = 'fpi:' + ip + ':' + hr, ek = 'fpe:' + email + ':' + hr, [ipn, en] = [+(await KV.get(ipk)) || 0, +(await KV.get(ek)) || 0];
    if (ipn >= 6 || en >= 3) throw err(429, 'limit', 'Too many codes asked for. Wait an hour and try again.');
    await KV.put(ipk, String(ipn + 1), { expirationTtl: 4000 }); await KV.put(ek, String(en + 1), { expirationTtl: 4000 });
    const u = await getUser(KV, email).catch(() => null);
    if (u && u.active !== false) {
      const code = String(100000 + (new Uint32Array(rand(4).buffer)[0] % 900000));
      await KV.put('forgot:' + email, JSON.stringify({ ch: await sha(email + '|' + code), tries: 0 }), { expirationTtl: 900 });
      await smtpSend(env, { to: email, subject: 'Your password reset code: ' + code + ' — Mumbai Interior admin',
        text: 'Your code to reset your Mumbai Interior admin password is ' + code + '\n\nIt works for 15 minutes. If you did not ask for this, ignore this email — your password stays the same.',
        html: brandMail(env, { preheader: 'Your password reset code is ' + code, title: 'Reset your admin password', intro: 'Type this code on the sign-in page to choose a new password. It works for <b>15 minutes</b>.<div style="font:800 32px/1.2 Arial,sans-serif;letter-spacing:8px;margin:18px 0;color:#2F4A3A">' + code + '</div>If you did not ask for this, ignore this email — your password stays the same.', cta: false }) });
    }
    return json({ ok: true }); // same answer whether or not the email has an account
  }
  if (p === '/forgot/finish' && m === 'POST') {
    const b = await body(req), ip = req.headers.get('CF-Connecting-IP') || 'local', email = lc(b.email);
    await lockCheck(KV, ip);
    const f = JSON.parse(await KV.get('forgot:' + email) || 'null');
    if (!f) throw err(400, 'expired', 'This code has expired. Ask for a new one.');
    if (f.ch !== await sha(email + '|' + String(b.code || '').replace(/\D/g, ''))) {
      f.tries++; if (f.tries >= 5) await KV.delete('forgot:' + email); else await KV.put('forgot:' + email, JSON.stringify(f), { expirationTtl: 900 });
      await lockFail(KV, ip); throw err(401, 'code', f.tries >= 5 ? 'Too many wrong codes. Ask for a new one.' : 'That code is wrong. Check the latest email.');
    }
    if (!/^[0-9a-f]{64}$/.test(b.hash || '')) throw err(400, 'bad', 'Missing details.');
    const u = await getUser(KV, email); if (!u || u.active === false) throw err(400, 'expired', 'This code has expired. Ask for a new one.');
    u.salt = hex(rand(16)); u.ph = await sha(u.salt + b.hash); u.pwAt = Date.now(); delete u.mustChange; await saveUser(KV, u);
    await KV.delete('forgot:' + email);
    try { await smtpSend(env, { to: email, subject: 'Your admin password was changed — Mumbai Interior', text: 'Your Mumbai Interior admin password was just changed. If this was not you, contact the owner straight away.', html: brandMail(env, { preheader: 'Your admin password was changed', title: 'Your password was changed', intro: 'Your Mumbai Interior admin password was just changed, and you were signed out on other devices. If this was not you, contact the owner straight away.', cta: false }) }); } catch (e) { }
    return json({ ok: true });
  }

  // ── password reset (forgot password) for the owner: GitHub key + 2FA code or backup code. Team members ask the owner. ──
  if (p === '/reset' && m === 'POST') {
    const b = await body(req), ip = req.headers.get('CF-Connecting-IP') || 'local';
    await lockCheck(KV, ip);
    const a = await getUser(KV, (await acct(KV)).email);
    await ghOwner(env, b.github);
    if (!(await secondFactor(KV, a, b.code))) { await lockFail(KV, ip); throw err(401, 'code', 'That code is wrong.'); }
    if (!/^[0-9a-f]{64}$/.test(b.hash || '')) throw err(400, 'bad', 'Missing details.');
    a.salt = hex(rand(16)); a.ph = await sha(a.salt + b.hash); a.gh = b.github; a.pwAt = Date.now();
    await saveUser(KV, a);
    return json({ ok: true });
  }

  // ── everything below needs a signed-in session ──
  const s = await session(KV, req), U = s.user, can = (mod, act) => s.perms.includes(mod + '.' + act), need = (mod, act) => { if (!can(mod, act)) throw err(403, 'perm', 'You don\'t have permission for this. Ask the owner.'); };
  const R = await rolesLoad(KV);
  if (p === '/me' && m === 'GET') return json({ email: U.email, name: U.name || '', role: U.role, roleName: (R[U.role] || {}).name || U.role, custom: !!U.custom, perms: s.perms, owner: !!U.owner, mustChange: !!U.mustChange, exp: s.exp, backupLeft: (U.backup || []).length, mods: MODS });
  if (p === '/logout' && m === 'POST') { await KV.delete('sess:' + s.id); return json({ ok: true }); }
  if (p === '/password' && m === 'POST') {
    const b = await body(req), u = U;
    if (await sha(u.salt + (b.old || '')) !== u.ph) throw err(401, 'login', 'Current password is incorrect.');
    if (!(await secondFactor(KV, u, b.code))) throw err(401, 'code', 'That 2FA code is wrong.');
    if (!/^[0-9a-f]{64}$/.test(b.hash || '')) throw err(400, 'bad', 'Missing details.');
    u.salt = hex(rand(16)); u.ph = await sha(u.salt + b.hash); delete u.mustChange;
    await saveUser(KV, u); return json({ ok: true });
  }
  if (p === '/backup' && m === 'POST') {
    const b = await body(req), u = U;
    if (!(await secondFactor(KV, u, b.code, true))) throw err(401, 'code', 'That 2FA code is wrong.');
    const codes = backupCodes(); u.backup = await Promise.all(codes.map(c => sha(c.replace(/-/g, ''))));
    await saveUser(KV, u); return json({ backup: codes });
  }
  if (p === '/2fa/move/start' && m === 'POST') {
    const b = await body(req), u = U;
    if (!(await secondFactor(KV, u, b.code))) throw err(401, 'code', 'That 2FA code is wrong.');
    const secret = b32(rand(20));
    await KV.put('pending:' + u.email, JSON.stringify({ secret, kind: 'move' }), { expirationTtl: PENDING_TTL });
    return json({ secret, otpauth: otpauth(env, u.email, secret) });
  }
  if (p === '/2fa/move/finish' && m === 'POST') {
    const b = await body(req), u = U, pend = JSON.parse(await KV.get('pending:' + u.email) || 'null');
    if (!pend || pend.kind !== 'move') throw err(400, 'expired', 'Expired. Start again.');
    const step = await totpCheck(pend.secret, b.code, -1);
    if (step < 0) throw err(400, 'code', 'That code is wrong. Use the newest code from the new app.');
    u.totp = pend.secret; u.last = step; await saveUser(KV, u); await KV.delete('pending:' + u.email);
    return json({ ok: true });
  }
  if (p === '/github' && m === 'POST') {
    need('publishing', 'edit');
    const b = await body(req), a = await getUser(KV, (await acct(KV)).email);
    await ghOwner(env, b.github); a.gh = b.github; await saveUser(KV, a); return json({ ok: true });
  }

  // ── shared key for private documents (quotations, bills…), only for people allowed to see them ──
  if (p === '/vault/key' && m === 'GET') {
    if (!['documents', 'rates', 'letterhead', 'payments'].some(x => can(x, 'view'))) throw err(403, 'perm', 'No access to documents.');
    let k = await KV.get('vaultkey'); if (!k) { k = btoa(String.fromCharCode(...rand(32))); await KV.put('vaultkey', k); }
    return json({ key: k });
  }

  // ── reviews waiting for approval ──
  if (p === '/reviews/pending' && m === 'GET') {
    if (!can('products', 'edit') && !can('testimonials', 'edit')) throw err(403, 'perm', 'No access to reviews.');
    return json({ reviews: JSON.parse(await KV.get('reviews:pending') || '[]') });
  }
  if (p === '/reviews/done' && m === 'POST') {
    if (!can('products', 'edit') && !can('testimonials', 'edit')) throw err(403, 'perm', 'No access to reviews.');
    const b = await body(req), list = JSON.parse(await KV.get('reviews:pending') || '[]');
    await KV.put('reviews:pending', JSON.stringify(list.filter(x => x.id !== b.id))); return json({ ok: true });
  }

  // ── team members ──
  if (p === '/users' && m === 'GET') {
    need('users', 'view');
    const list = [(await acct(KV)).email, ...await userList(KV)], out = [];
    for (const e of list) { const u = await getUser(KV, e); if (u) out.push(pubUser(u, R)); }
    return json({ users: out, roles: R, mods: MODS });
  }
  if (p === '/users/save' && m === 'POST') {
    const b = await body(req), email = lc(b.email), isNew = !!b.create;
    need('users', isNew ? 'add' : 'edit');
    if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email)) throw err(400, 'bad', 'Enter a valid email address.');
    if (!R[b.role]) throw err(400, 'bad', 'Choose a role.');
    const iAmSuper = U.role === 'super_admin';
    let u = await getUser(KV, email);
    if (isNew && u) throw err(409, 'exists', 'Someone with this email already exists.');
    if (!isNew && !u) throw err(404, 'notfound', 'User not found.');
    if (!iAmSuper && (b.role === 'super_admin' || (u && u.role === 'super_admin'))) throw err(403, 'perm', 'Only a super admin can manage super admins.');
    if (u && u.owner && !U.owner) throw err(403, 'perm', 'Only the owner can change the owner account.');
    if (u && u.owner && b.role !== 'super_admin') throw err(400, 'bad', 'The owner always stays super admin.');
    if (u && u.email === U.email && (b.role !== U.role || b.active === false)) throw err(400, 'bad', 'You can\'t change your own role or switch yourself off.');
    if (isNew) { if (!/^[0-9a-f]{64}$/.test(b.hash || '')) throw err(400, 'bad', 'Set a first password.'); u = { email, created: Date.now(), by: U.email, _key: 'user:' + email }; }
    u.name = String(b.name || '').trim().slice(0, 60); u.phone = String(b.phone || '').replace(/[^\d+ ]/g, '').slice(0, 16);
    u.role = b.role; u.active = b.active !== false;
    const myPerms = new Set(s.perms), wanted = Array.isArray(b.custom) ? b.custom.filter(x => ALL.includes(x)) : null;
    if (wanted && !iAmSuper && wanted.some(x => !myPerms.has(x))) throw err(403, 'perm', 'You can only give permissions you have yourself.');
    if (u.owner || b.role === 'super_admin') delete u.custom; else if (wanted) u.custom = wanted; else delete u.custom;
    if (/^[0-9a-f]{64}$/.test(b.hash || '')) { u.salt = hex(rand(16)); u.ph = await sha(u.salt + b.hash); if (u.email !== U.email) u.mustChange = true; }
    if (b.reset2fa && !u.owner) { delete u.totp; delete u.last; u.backup = []; }
    await saveUser(KV, u);
    if (isNew) { const l = await userList(KV); if (!l.includes(email)) { l.push(email); await KV.put('users', JSON.stringify(l)); } }
    return json({ ok: true, user: pubUser(await getUser(KV, email), R) });
  }
  if (p === '/users/delete' && m === 'POST') {
    need('users', 'delete');
    const b = await body(req), u = await getUser(KV, b.email);
    if (!u) throw err(404, 'notfound', 'User not found.');
    if (u.owner || u.email === U.email) throw err(400, 'bad', 'You can\'t delete this account.');
    if (u.role === 'super_admin' && U.role !== 'super_admin') throw err(403, 'perm', 'Only a super admin can delete a super admin.');
    await KV.delete('user:' + u.email); await KV.put('users', JSON.stringify((await userList(KV)).filter(x => x !== u.email)));
    return json({ ok: true });
  }
  if (p === '/roles' && m === 'POST') {
    if (U.role !== 'super_admin') throw err(403, 'perm', 'Only a super admin can change roles.');
    const b = await body(req), inp = b.roles && typeof b.roles === 'object' ? b.roles : {}, out = {};
    for (const [k, v] of Object.entries(inp)) {
      if (!/^[a-z][a-z0-9_]{1,24}$/.test(k) || k === 'super_admin') continue;
      out[k] = { name: String(v.name || k).trim().slice(0, 30) || k, perms: (v.perms || []).filter(x => ALL.includes(x)), mods: Object.keys(MODS) };
    }
    const used = new Set(['super_admin']); for (const e of await userList(KV)) { const u = await getUser(KV, e); if (u) used.add(u.role); }
    for (const k of Object.keys(R)) if (k !== 'super_admin' && !out[k] && used.has(k)) throw err(400, 'bad', 'The role "' + R[k].name + '" is still given to someone. Change their role first.');
    await KV.put('roles', JSON.stringify(out));
    return json({ roles: await rolesLoad(KV) });
  }

  // ── payment screenshots: list, view, approve / reject (signed in) ──
  if (p === '/pay/proofs' && m === 'GET') {
    need('payments', 'view');
    const idx = JSON.parse(await KV.get('proofs') || '[]'), out = [];
    for (const k of idx.slice().reverse()) { const r = JSON.parse(await KV.get('proof:' + k) || 'null'); if (r) { delete r.ip; out.push(r); } }
    return json({ proofs: out });
  }
  if (p === '/pay/proof' && m === 'GET') {
    need('payments', 'view');
    const k = String(url.searchParams.get('k') || ''); if (!/^[0-9a-f]{24}$/.test(k)) throw err(400, 'bad', 'Bad request.');
    const r = JSON.parse(await KV.get('proof:' + k) || 'null'); if (!r) throw err(404, 'notfound', 'This screenshot is no longer stored.');
    delete r.ip; const img = await KV.get('proofimg:' + k) || '';
    return json({ ...r, img: img ? (img.startsWith('iVBOR') ? 'data:image/png;base64,' : 'data:image/jpeg;base64,') + img : '' });
  }
  if (p === '/pay/decide' && m === 'POST') {
    need('payments', 'edit');
    const b = await body(req), k = String(b.k || ''); if (!/^[0-9a-f]{24}$/.test(k)) throw err(400, 'bad', 'Bad request.');
    const r = JSON.parse(await KV.get('proof:' + k) || 'null'); if (!r) throw err(404, 'notfound', 'This screenshot is no longer stored.');
    if (b.action === 'approve') { r.s = 'paid'; r.d = /^\d{4}-\d{2}-\d{2}$/.test(b.paid_on || '') ? b.paid_on : new Date().toISOString().slice(0, 10); delete r.reason; }
    else if (b.action === 'reject') { r.s = 'rejected'; r.reason = String(b.reason || 'We could not find this payment in our account.').replace(/[\r\n<>]/g, ' ').slice(0, 200); }
    else throw err(400, 'bad', 'Choose approve or reject.');
    r.by = U.email; r.at = Date.now();
    await KV.put('proof:' + k, JSON.stringify(r), { expirationTtl: 60 * 60 * 24 * 120 });
    return json({ ok: true, s: r.s });
  }

  // ── payment receipt: put online / take down (signed in) ──
  if (p === '/pay/receipt' && m === 'POST') {
    need('payments', 'edit');
    const b = await body(req), n = String(b.n || '').trim().toUpperCase(), am = Math.round(parseFloat(b.am) * 100) / 100;
    if (!/^[A-Z]{1,4}-\d{4}-\d{1,5}$/.test(n) || !(am > 0 && am <= 1000000)) throw err(400, 'bad', 'Bad request.');
    const k = (await sha(n + '|' + am.toFixed(2))).slice(0, 24);
    if (b.remove) { await KV.delete('rcpt:' + k); await KV.delete('rcptm:' + k); return json({ ok: true }); }
    const pdf = String(b.pdf || '').replace(/\s/g, '');
    if (!pdf.startsWith('JVBER') || pdf.length > 5e6 || !/^[A-Za-z0-9+/=]+$/.test(pdf)) throw err(400, 'bad', 'The receipt PDF is not valid.');
    await KV.put('rcpt:' + k, pdf); await KV.put('rcptm:' + k, JSON.stringify({ n, am, at: Date.now(), by: U.email }));
    return json({ ok: true });
  }

  // ── payment request: branded email with the PDF (and visiting card) attached; from the first business mailbox, else from noreply@ ──
  if (p === '/pay/send' && m === 'POST') {
    need('payments', 'send');
    const b = await body(req), to = String(b.to || '').trim();
    if (!/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(to)) throw err(400, 'bad', 'Enter a valid customer email address.');
    const sub = String(b.subject || 'Payment request').replace(/[\r\n]+/g, ' ').slice(0, 200);
    const html = brandMail(env, { preheader: String(b.preheader || sub).slice(0, 200), bodyHtml: String(b.content || '').slice(0, 80000) });
    const files = (Array.isArray(b.attachments) ? b.attachments : []).slice(0, 3).filter(a => a && /^[\w.\- ]{1,90}\.(pdf|png|jpe?g)$/i.test(a.name || '') && typeof a.b64 === 'string' && /^[A-Za-z0-9+/=\s]+$/.test(a.b64.slice(0, 200)) && a.b64.length < 6e6);
    const Z = await zLoad(KV);
    if (Z.boxes.length) {
      const z = Z.boxes[0], A = '/api/accounts/' + z.acc, att = [];
      for (const f of files) {
        const bin = Uint8Array.from(atob(f.b64.replace(/\s/g, '')), c => c.charCodeAt(0));
        const up = async retry => { const t = await zToken(env, KV, z.conn, retry); return fetch(zMail(env) + A + '/messages/attachments?fileName=' + encodeURIComponent(f.name), { method: 'POST', headers: { Authorization: 'Zoho-oauthtoken ' + t, Accept: 'application/json', 'Content-Type': 'application/octet-stream' }, body: bin }); };
        let r = await up(); if (r.status === 401) r = await up(true);
        const j = await r.json().catch(() => ({})), d = Array.isArray(j.data) ? j.data[0] : j.data;
        if (!r.ok || !d || !d.storeName) throw err(502, 'zoho', 'Could not attach ' + f.name + ' (' + ((j.status && j.status.description) || r.status) + ').');
        att.push({ storeName: d.storeName, attachmentPath: d.attachmentPath, attachmentName: d.attachmentName || f.name });
      }
      await zApi(env, KV, z.conn, A + '/messages', { method: 'POST', body: JSON.stringify({ fromAddress: z.email, toAddress: to, subject: sub, content: html, mailFormat: 'html', ...(att.length ? { attachments: att } : {}) }) });
      return json({ ok: true, from: z.email });
    }
    if (!env.SMTP_PASS) throw err(409, 'nomail', 'No mailbox is connected. Connect one in Mail, or send the PDF on WhatsApp.');
    await smtpSend(env, { to, subject: sub, text: String(b.text || sub), html, replyTo: env.ENQUIRY_TO || 'info@mumbai-interior.in', attachments: files });
    return json({ ok: true, from: env.SMTP_USER || 'noreply@mumbai-interior.in' });
  }

  // ── Zoho Mail: several mailboxes (info@, asheesh@, …), each connected once with its own Zoho login ──
  if (p.startsWith('/mail/')) need('mail', 'view');
  if (p === '/mail/status' && m === 'GET') { const Z = await zLoad(KV); return json({ connected: Z.boxes.length > 0, email: Z.boxes[0] && Z.boxes[0].email, boxes: Z.boxes.map(x => x.email) }); }
  if (p === '/mail/connect' && m === 'POST') {
    need('mail', 'manage');
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
    need('mail', 'manage');
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
      need('mail', 'send');
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
    if (m === 'PUT') {
      const f = decodeURIComponent(p.slice('/gh/contents/'.length)), mods = ghMods(f), w = x => ['add', 'edit', 'delete'].some(a => can(x, a));
      if (f === 'data/auth.json' ? !U.owner : !mods.some(w)) throw err(403, 'perm', 'You don\'t have permission to change this. Ask the owner.');
    }
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
async function smtpSend(env, { to, subject, text, html, replyTo, attachments }) {
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
      const alt = ['Content-Type: multipart/alternative; boundary="' + bd + '"', '', '--' + bd, 'Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', wrap(text || ''), '--' + bd, 'Content-Type: text/html; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', wrap(html), '--' + bd + '--'];
      if (attachments && attachments.length) {
        const mx = 'mx_' + crypto.randomUUID().replace(/-/g, ''), type = n => /\.pdf$/i.test(n) ? 'application/pdf' : /\.png$/i.test(n) ? 'image/png' : 'image/jpeg';
        msg = head.concat(['Content-Type: multipart/mixed; boundary="' + mx + '"', '', '--' + mx].concat(alt).concat(attachments.flatMap(a => ['--' + mx, 'Content-Type: ' + type(a.name) + '; name="' + a.name + '"', 'Content-Disposition: attachment; filename="' + a.name + '"', 'Content-Transfer-Encoding: base64', '', a.b64.replace(/\s/g, '').replace(/.{1,76}/g, '$&\r\n')])).concat(['--' + mx + '--'])).join('\r\n');
      } else msg = head.concat(alt).join('\r\n');
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
/* ── team members, roles and permissions ──
   owner lives in 'acct' (always super admin); others in 'user:<email>', listed in 'users' */
const MODS = { dashboard: ['view'], documents: ['view', 'add', 'edit', 'delete'], rates: ['view', 'edit'], letterhead: ['view', 'edit'], settings: ['view', 'edit'],
  projects: ['view', 'add', 'edit', 'delete'], testimonials: ['view', 'add', 'edit', 'delete'], products: ['view', 'add', 'edit', 'delete'], categories: ['view', 'add', 'edit', 'delete'],
  blog: ['view', 'add', 'edit', 'delete'], catalogue: ['view', 'add', 'edit', 'delete'], banners: ['view', 'add', 'edit', 'delete'], payments: ['view', 'add', 'edit', 'delete', 'send'], card: ['view', 'edit'], orders: ['view', 'delete'], mail: ['view', 'send', 'manage'], publishing: ['view', 'edit'], users: ['view', 'add', 'edit', 'delete'] };
const ALL = Object.entries(MODS).flatMap(([k, a]) => a.map(x => k + '.' + x));
const pick = (spec) => ALL.filter(x => { const [mo, ac] = x.split('.'); return spec[mo] === '*' || (spec[mo] || []).includes(ac); });
const ROLE_DEF = {
  super_admin: { name: 'Super admin', perms: ALL, system: true },
  admin: { name: 'Admin', perms: ALL.filter(x => !['users.delete', 'publishing.edit', 'mail.manage'].includes(x)) },
  employee: { name: 'Employee', perms: pick({ blog: ['view', 'add', 'edit'], catalogue: ['view', 'add', 'edit'], banners: ['view'], payments: ['view'], card: ['view'], dashboard: '*', documents: ['view', 'add', 'edit'], rates: ['view'], letterhead: ['view'], projects: ['view', 'add', 'edit'], products: ['view'], categories: ['view'], orders: ['view'], mail: ['view'] }) },
  sale: { name: 'Sale', perms: pick({ blog: ['view'], catalogue: ['view'], banners: ['view'], payments: ['view', 'add', 'edit', 'send'], card: ['view'], dashboard: '*', documents: ['view', 'add', 'edit'], rates: ['view'], letterhead: ['view'], products: ['view'], categories: ['view'], testimonials: ['view'], orders: ['view'], mail: ['view', 'send'] }) }
};
async function rolesLoad(KV) {
  const saved = JSON.parse(await KV.get('roles') || 'null');
  const r = saved ? { super_admin: ROLE_DEF.super_admin, ...saved } : { ...ROLE_DEF };
  r.super_admin = ROLE_DEF.super_admin;
  /* new modules added after roles were saved: give saved built-in roles their default permissions for them */
  for (const [k, def] of Object.entries(ROLE_DEF)) if (saved && saved[k]) for (const mod of ['blog', 'catalogue', 'banners', 'payments', 'card']) if (!(r[k].mods || []).includes(mod)) r[k] = { ...r[k], perms: [...new Set((r[k].perms || []).concat(def.perms.filter(x => x.startsWith(mod + '.'))))] };
  return r;
}
const userList = async KV => JSON.parse(await KV.get('users') || '[]');
async function getUser(KV, email) {
  const e = lc(email); if (!e) return null;
  const a = JSON.parse(await KV.get('acct') || 'null');
  if (a && a.email === e) return { name: 'Owner', ...a, role: 'super_admin', owner: true, active: true, _key: 'acct' };
  const u = JSON.parse(await KV.get('user:' + e) || 'null'); return u ? { ...u, _key: 'user:' + e } : null;
}
async function saveUser(KV, u) { const { _key, owner, ...rest } = u; if (owner) delete rest.role; await KV.put(_key, JSON.stringify(rest)); }
function permsOf(u, R) { if (u.role === 'super_admin') return ALL.slice(); const base = Array.isArray(u.custom) ? u.custom : ((R[u.role] || {}).perms || []); return base.filter(x => ALL.includes(x)); }
const pubUser = (u, R) => ({ email: u.email, name: u.name || '', phone: u.phone || '', role: u.role, roleName: (R[u.role] || {}).name || u.role, custom: Array.isArray(u.custom) ? u.custom : null, active: u.active !== false, owner: !!u.owner, has2fa: !!u.totp, mustChange: !!u.mustChange, created: u.created || null, last: u.lastLogin || null });
/* which permission module may write which file in the repo */
function ghMods(f) {
  if (f === 'data/vault.json') return ['documents', 'rates', 'letterhead', 'payments'];
  if (f === 'data/settings.json') return ['settings', 'letterhead', 'card'];
  const m = f.match(/^data\/(products|categories|projects|testimonials|blog|catalogue|banners)\.json$/); if (m) return [m[1]];
  if (/^images\/blog\/[\w.-]+$/.test(f)) return ['blog'];
  if (f === 'data/payreq.json') return ['payments'];
  if (/^images\/catalogue\/[\w.-]+$/.test(f)) return ['catalogue'];
  if (/^images\/banners\/[\w.-]+$/.test(f)) return ['banners'];
  if (/^images\/products\/[\w.-]+$/.test(f)) return ['products'];
  if (/^images\/work\/[\w.-]+$/.test(f)) return ['projects'];
  return ['publishing'];
}

async function newSession(KV, email, ttl) {
  ttl = ttl || SESSION_TTL; const id = hex(rand(32)), exp = Date.now() + ttl * 1000;
  await KV.put('sess:' + id, JSON.stringify({ email, exp, t: Date.now() }), { expirationTtl: ttl });
  const u = await getUser(KV, email); if (u) { u.lastLogin = Date.now(); await saveUser(KV, u); }
  return { session: id, exp };
}
async function session(KV, req) {
  const id = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/, '');
  const s = id && /^[0-9a-f]{64}$/.test(id) ? JSON.parse(await KV.get('sess:' + id) || 'null') : null;
  if (!s || s.exp < Date.now()) throw err(401, 'session', 'Please sign in again.');
  const user = await getUser(KV, s.email);
  if (!user || user.active === false || (user.pwAt && (s.t || 0) < user.pwAt)) { await KV.delete('sess:' + id); throw err(401, 'session', 'Please sign in again.'); }
  return { ...s, id, user, perms: permsOf(user, await rolesLoad(KV)) };
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
  if (/^\d{6}$/.test(c)) { const st = await totpCheck(a.totp, c, a.last || -1); if (st < 0) return false; a.last = st; await saveUser(KV, a); return true; }
  if (appOnly) return false;
  const h = await sha(c.toUpperCase().replace(/[^A-Z0-9]/g, '')), i = (a.backup = a.backup || []).indexOf(h);
  if (i < 0) return false;
  a.backup.splice(i, 1); await saveUser(KV, a); return true;
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
