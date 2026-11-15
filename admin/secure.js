/* Secure sign-in with two-step verification, through the Cloudflare sign-in server.
   Loaded before admin.js; its functions are only called after admin.js has loaded. */
const SRVK = 'carpenter_srv';
let API = null, API_READY = false, API_DOWN = false;

async function loadApi() {
  try { API = (await fetchJSON('api.json')).url || null; } catch (e) { API = null; }
  if (!API) return;
  try { const r = await fetch(API + '/', { cache: 'no-store' }); API_READY = !!(await r.json()).ready; } catch (e) { API_DOWN = true; }
}
const SERVER = () => !!(API && API_READY);
function srvSess() { try { const s = JSON.parse(sessionStorage.getItem(SRVK) || 'null'); return s && s.exp > Date.now() ? s : null; } catch (e) { return null; } }
async function api(path, body, method) {
  const s = srvSess();
  const r = await fetch(API + path, { method: method || (body ? 'POST' : 'GET'), headers: { 'Content-Type': 'application/json', ...(s ? { Authorization: 'Bearer ' + s.session } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(j.message || 'The sign-in server answered ' + r.status + '.'); e.status = r.status; e.code = j.error; throw e; }
  return j;
}
const srvHash = (email, pass) => { const e = String(email).trim().toLowerCase(); return pbkdf2Hex(e + '|' + pass, 'mi-admin-server|' + e, PBKDF2_ITER); };
async function srvValid() { if (!srvSess()) return false; try { await api('/me'); return true; } catch (e) { return false; } }
async function srvGh(path, opt = {}) {
  const s = srvSess(); if (!s) { const e = new Error('Your sign-in expired. Sign in again.'); e.code = 'session'; e.status = 401; throw e; }
  const r = await fetch(API + '/gh' + path, { ...opt, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + s.session } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(j.message || 'GitHub error ' + r.status); e.status = r.status; e.code = j.error; throw e; }
  return j;
}
const codeField = (id, label, hint) => '<div class="field"><label for="' + id + '">' + label + '</label><input id="' + id + '" inputmode="numeric" autocomplete="one-time-code" maxlength="11" required placeholder="6-digit code" style="letter-spacing:.12em;font-size:1.15rem"/>' + (hint ? '<div class="hint">' + hint + '</div>' : '') + '</div>';
const msg = (id, t, kind) => { const m = $(id); if (!m) return; m.className = 'msg ' + (kind || 'err'); m.textContent = t; m.hidden = !t; };
function qrSVG(text) { const q = qrcode(0, 'M'); q.addData(text); q.make(); return q.createSvgTag({ cellSize: 5, margin: 3, scalable: true }); }

/* ── sign-in page ── */
let PENDING = null;
async function srvLogin(e) {
  const email = $('lEmail').value, pw = $('lPass').value;
  $('lBtn').disabled = true; $('lBtn').textContent = 'Checking…';
  try {
    const { ticket } = await api('/login', { email, hash: await srvHash(email, pw) });
    PENDING = { ticket, email, pw }; showTfa();
  } catch (err) { msg('lErr', err.message); }
  $('lBtn').disabled = false; $('lBtn').textContent = 'Sign in';
}
function showTfa() {
  let f = $('tfaForm');
  if (!f) {
    f = document.createElement('div'); f.id = 'tfaForm';
    f.innerHTML = '<h1>Enter your code</h1><p>Open Google Authenticator (or your authenticator app) and type the 6-digit code for <b>Mumbai Interior</b>.</p><div class="msg err" id="tErr" hidden></div>' +
      '<form onsubmit="srvTfa(event)">' + codeField('tCode', 'Code', 'Lost your phone? Type one of your backup codes instead.') + '<button class="btn pri" id="tBtn">Verify and sign in</button></form><button class="linkbtn" onclick="tfaBack()">Back</button>';
    $('loginForm').after(f);
  }
  $('loginForm').hidden = true; $('resetForm').hidden = true; f.hidden = false; msg('tErr', ''); $('tCode').value = ''; $('tCode').focus();
}
function tfaBack() { PENDING = null; $('tfaForm').hidden = true; $('loginForm').hidden = false; $('lPass').value = ''; $('lPass').focus(); }
async function srvTfa(e) {
  e.preventDefault(); if (!PENDING) return tfaBack();
  $('tBtn').disabled = true; $('tBtn').textContent = 'Verifying…';
  try {
    const s = await api('/login/2fa', { ticket: PENDING.ticket, code: $('tCode').value });
    sessionStorage.setItem(SRVK, JSON.stringify(s));
    try { await vaultOpen(PENDING.pw); } catch (er) { if (!er.locked) throw er; if (!window.confirm('Your saved documents were locked with an older password and can\'t be opened. Start a new, empty document store? (You can restore a backup file afterwards.)')) { $('tBtn').disabled = false; return; } await vaultFresh(PENDING.pw); }
    sessionStorage.setItem(SESS, JSON.stringify({ email: AUTH.email, t: Date.now() })); PENDING = null;
    location.replace('/admin/' + location.hash); return;
  } catch (err) { msg('tErr', err.message); if (err.code === 'expired') setTimeout(tfaBack, 1500); }
  $('tBtn').disabled = false; $('tBtn').textContent = 'Verify and sign in';
}
function srvResetForm() {
  if ($('rCode')) return;
  const f = $('resetForm').querySelector('form'), first = f.querySelector('.field');
  first.insertAdjacentHTML('afterend', codeField('rCode', '2FA code or backup code'));
  $('rCode').removeAttribute('maxlength'); $('rCode').setAttribute('inputmode', 'text');
}
async function srvReset() {
  $('rBtn').disabled = true;
  try { await api('/reset', { github: $('rToken').value.trim(), code: $('rCode').value, hash: await srvHash(AUTH.email, $('rNew').value) }); msg('rOk', 'Password changed. Sign in with the new password.', 'ok'); msg('rErr', ''); }
  catch (err) { msg('rErr', err.message); }
  $('rBtn').disabled = false;
}

/* ── account page: security card ── */
function srvCard() {
  const box = document.createElement('div'); box.id = 'secCard'; box.className = 'card'; box.style.maxWidth = '560px';
  $('content').append(box); drawSec();
}
async function drawSec(step) {
  const b = $('secCard'); if (!b) return;
  if (!API) { b.innerHTML = '<h2>Two-step sign-in</h2><p>The sign-in server isn\'t connected yet.</p>'; return; }
  if (API_DOWN) { b.innerHTML = '<h2>Two-step sign-in</h2><div class="msg err">Can\'t reach the sign-in server right now. Try again in a minute.</div>'; return; }
  if (SERVER()) {
    let left = '';
    try { left = (await api('/me')).backupLeft; } catch (e) { }
    b.innerHTML = '<h2>Two-step sign-in <span class="pill ok">On</span></h2><p>Every sign-in needs your password <b>and</b> a code from your authenticator app. Your GitHub publishing key is kept on the sign-in server, not in this browser.</p>' +
      '<p class="hint">Backup codes left: <b>' + left + '</b> of 8.' + (left !== '' && left < 3 ? ' Make new ones soon.' : '') + '</p><div class="msg err" id="sErr" hidden></div><div id="sBody"></div>' +
      '<div class="bar" style="justify-content:flex-start"><button class="btn" onclick="secAsk(\'backup\')">New backup codes</button><button class="btn" onclick="secAsk(\'move\')">Move to a new phone</button></div>';
    return;
  }
  b.innerHTML = '<h2>Two-step sign-in <span class="pill warn">Off</span></h2><p>Turn this on so nobody can sign in with just your password. You\'ll need an authenticator app on your phone — <b>Google Authenticator</b> or <b>Microsoft Authenticator</b> (free on Play Store / App Store).</p>' +
    '<div class="msg err" id="sErr" hidden></div><div id="sBody">' +
    (gh() && gh().token ? '' : '<div class="field"><label for="sGh">GitHub key</label><input id="sGh" type="password" autocomplete="off" placeholder="github_pat_…"/><div class="hint">Needed once to prove you own the website. Create it in <a href="#publishing">Publishing</a>.</div></div>') +
    '<div class="bar" style="justify-content:flex-start"><button class="btn pri" id="sStart" onclick="secStart()">Turn on two-step sign-in</button></div></div>';
}
let SETUP = null;
async function secStart() {
  const github = (gh() && gh().token) || ($('sGh') && $('sGh').value.trim());
  if (!github) return msg('sErr', 'Paste your GitHub key first.');
  $('sStart').disabled = true; $('sStart').textContent = 'Starting…';
  try { const r = await api('/setup/start', { github, email: AUTH.email }); SETUP = { github, ...r }; secQR('finish'); }
  catch (err) { msg('sErr', err.message); $('sStart').disabled = false; $('sStart').textContent = 'Turn on two-step sign-in'; }
}
function secQR(mode) {
  const s = SETUP, isMove = mode === 'movefinish';
  $('sBody').innerHTML =
    '<ol class="steps" style="margin:.4rem 0 1rem 1.2rem;padding:0;color:var(--muted)"><li>Open your authenticator app and tap <b>+</b> → <b>Scan a QR code</b>.</li><li>Scan this code. On this phone? Tap <b>Open in authenticator app</b> instead.</li><li>Type the 6-digit code the app shows' + (isMove ? '' : ', and your current password') + '.</li></ol>' +
    '<div style="display:flex;flex-wrap:wrap;gap:1rem;align-items:center"><div class="qr" style="width:180px;background:#fff;border-radius:12px;padding:4px;border:1px solid var(--line)">' + qrSVG(s.otpauth) + '</div>' +
    '<div style="flex:1;min-width:200px"><a class="btn" href="' + esc(s.otpauth) + '">Open in authenticator app</a><p class="hint" style="margin-top:.8rem">Can\'t scan? Enter this key in the app:<br/><code style="font-size:.95rem;word-break:break-all;user-select:all">' + s.secret.replace(/(.{4})/g, '$1 ').trim() + '</code></p></div></div>' +
    '<form onsubmit="secFinish(event,\'' + mode + '\')" style="margin-top:1rem">' + (isMove ? '' : '<input type="text" autocomplete="username" value="' + esc(AUTH.email) + '" hidden/><div class="field"><label for="sPw">Current password</label><input id="sPw" type="password" autocomplete="current-password" required/></div>') +
    codeField('sCode', 'Code from the app') + '<div class="bar" style="justify-content:flex-start"><button class="btn pri" id="sFin">' + (isMove ? 'Confirm new phone' : 'Turn on') + '</button><button type="button" class="btn" onclick="drawSec()">Cancel</button></div></form>';
}
async function secFinish(e, mode) {
  e.preventDefault(); msg('sErr', ''); const btn = $('sFin'); btn.disabled = true; btn.textContent = 'Checking…';
  try {
    if (mode === 'movefinish') { await api('/2fa/move/finish', { code: $('sCode').value }); SETUP = null; toast('Two-step sign-in moved to your new phone.'); drawSec(); return; }
    const pw = $('sPw').value;
    if (!await checkPass(AUTH.email, pw)) throw new Error('Current password is incorrect.');
    const r = await api('/setup/finish', { github: SETUP.github, code: $('sCode').value, email: AUTH.email, hash: await srvHash(AUTH.email, pw) });
    sessionStorage.setItem(SRVK, JSON.stringify({ session: r.session, exp: r.exp })); API_READY = true;
    // remove the password check from the public website and the GitHub key from this browser
    await srvSwitchAuth();
    localStorage.removeItem(GHK); SETUP = null; chrome(); showBackup(r.backup, true);
  } catch (err) { msg('sErr', err.message); btn.disabled = false; btn.textContent = 'Turn on'; }
}
function showBackup(codes, first) {
  const txt = 'Mumbai Interior admin — backup codes\nEach code works once. Keep them somewhere safe (not on the same phone).\n\n' + codes.join('\n') + '\n';
  $('secCard').innerHTML = '<h2>' + (first ? 'Two-step sign-in is on' : 'New backup codes') + '</h2><div class="msg info">Save these backup codes now — this is the only time they\'re shown. If you lose your phone, each code lets you sign in once.' + (first ? '' : ' Your old backup codes no longer work.') + '</div>' +
    '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:.4rem .8rem;font:600 1.05rem ui-monospace,monospace;margin:1rem 0;padding:1rem;border:1px dashed var(--line);border-radius:12px;user-select:all">' + codes.map(c => '<span>' + c + '</span>').join('') + '</div>' +
    '<div class="bar" style="justify-content:flex-start"><button class="btn" id="bCopy">Copy</button><button class="btn" id="bDl">Download</button><button class="btn pri" onclick="drawSec()">I\'ve saved them</button></div>';
  $('bCopy').onclick = () => navigator.clipboard.writeText(txt).then(() => toast('Backup codes copied.'));
  $('bDl').onclick = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([txt], { type: 'text/plain' })); a.download = 'mumbai-interior-backup-codes.txt'; a.click(); };
}
function secAsk(kind) {
  $('sBody').innerHTML = '<form onsubmit="secDo(event,\'' + kind + '\')" style="margin-top:.6rem">' + codeField('sCode', kind === 'move' ? 'Code from your current (old) phone, or a backup code' : 'Code from your authenticator app') +
    '<div class="bar" style="justify-content:flex-start"><button class="btn pri" id="sGo">Continue</button><button type="button" class="btn" onclick="drawSec()">Cancel</button></div></form>';
  if (kind === 'move') { $('sCode').removeAttribute('maxlength'); $('sCode').setAttribute('inputmode', 'text'); }
  $('sCode').focus();
}
async function secDo(e, kind) {
  e.preventDefault(); msg('sErr', ''); $('sGo').disabled = true;
  try {
    if (kind === 'backup') { const r = await api('/backup', { code: $('sCode').value }); showBackup(r.backup, false); return; }
    const r = await api('/2fa/move/start', { code: $('sCode').value }); SETUP = r; secQR('movefinish');
  } catch (err) { msg('sErr', err.message); $('sGo').disabled = false; }
}

/* once 2FA is on, the public website no longer needs the password check — remove it (retried on each sign-in until it succeeds) */
async function srvSwitchAuth() {
  if (!SERVER() || !srvSess() || (AUTH && AUTH.mode === 'server')) return;
  try { await ghPut({ ...ghDefaults(), token: '@server' }, 'auth.json', { email: AUTH.email, mode: 'server' }, 'Admin sign-in moved to the secure server'); AUTH = { email: AUTH.email, mode: 'server' }; }
  catch (er) { console.warn('auth.json switch failed', er); }
}

/* ── account page: change password (server mode) ── */
async function srvChangePw(e) {
  const err = m => { $('aErr').textContent = m; $('aErr').hidden = false; }; $('aErr').hidden = true;
  if ($('a_new').value !== $('a_conf').value) return err('The two new passwords don\'t match.');
  $('aBtn').disabled = true;
  try { await api('/password', { old: await srvHash(AUTH.email, $('a_cur').value), hash: await srvHash(AUTH.email, $('a_new').value), code: $('a_code').value }); await vaultRekey($('a_new').value); e.target.reset(); toast('Password changed.'); }
  catch (er) { err(er.message); }
  $('aBtn').disabled = false;
}

/* ── publishing page (server mode) ── */
function srvPublishing() {
  C('<div class="card" style="max-width:620px"><h2>Publishing</h2><div class="msg ok">Publishing is on. Your GitHub key is kept safely on the sign-in server — not in this browser.</div>' +
    '<p>When your GitHub key expires, create a new one (<a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">GitHub → New fine-grained token</a>, only the <b>carpenter</b> repository, <b>Contents: Read and write</b>) and paste it here.</p>' +
    '<form onsubmit="srvSaveGh(event)"><div class="field"><label for="g_token">New GitHub key</label><input id="g_token" type="password" autocomplete="off" required placeholder="github_pat_…"/></div><div class="bar" style="justify-content:flex-start"><button class="btn pri" id="gBtn">Save and test</button></div></form></div>');
}
async function srvSaveGh(e) {
  e.preventDefault(); $('gBtn').disabled = true;
  try { await api('/github', { github: $('g_token').value.trim() }); e.target.reset(); toast('GitHub key updated.'); } catch (er) { toast(er.message, true); }
  $('gBtn').disabled = false;
}
