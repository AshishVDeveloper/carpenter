/* Mumbai Interior — admin sign-in server (Cloudflare Worker + KV).
   Keeps the password check, the 2FA secret and the GitHub publishing key off the public website.

   KV keys
     acct            {email, salt, ph, totp, last, backup:[sha256], gh}
     pending         {secret, gh, kind}                       (15 min) 2FA setup in progress
     ticket:<id>     {email}                                   (5 min)  password OK, waiting for 2FA code
     sess:<id>       {email, exp}                              (12 h)   signed-in session
     fail:<ip>       {n, until}                                         wrong-try counter
*/

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
