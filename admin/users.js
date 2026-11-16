/* Users & roles: team members, the role master (Super admin, Admin, Employee, Sale, plus your own roles)
   and per-person custom permissions. Everything is checked again on the sign-in server. */
let UR = { users: [], roles: {}, mods: {}, q: '', role: '', tab: 'users', edit: null, rk: null, rdraft: null };
const MOD_LABEL = { dashboard: 'Dashboard', documents: 'Documents (quotations, bills, invoices)', rates: 'Rate list', letterhead: 'Letterhead', settings: 'Business details', projects: 'Our work', testimonials: 'Reviews', products: 'Products', categories: 'Categories', orders: 'Orders & enquiries', mail: 'Mail', publishing: 'Publishing (GitHub key)', users: 'Users & roles' };
const ACT_LABEL = { view: 'View', add: 'Add', edit: 'Edit', delete: 'Delete', send: 'Send', manage: 'Manage mailboxes' };
const COLS = ['view', 'add', 'edit', 'delete'];
const whenTxt = t => t ? new Date(t).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : 'Never';

async function pgUsers(arg) {
  if (typeof SERVER !== 'function' || !SERVER()) { C('<div class="card" style="max-width:620px"><h2>Team members need two-step sign-in</h2><p>Each person gets their own password and authenticator app, checked by your secure sign-in server. Turn on two-step sign-in in My account first.</p><div class="bar" style="justify-content:flex-start"><a class="btn pri" href="#account">Go to My account</a></div></div>'); return; }
  UR.tab = arg === 'roles' ? 'roles' : 'users';
  C('<div class="utabs" role="tablist"><a role="tab" href="#users" class="' + (UR.tab === 'users' ? 'on' : '') + '" aria-selected="' + (UR.tab === 'users') + '">Users</a><a role="tab" href="#users/roles" class="' + (UR.tab === 'roles' ? 'on' : '') + '" aria-selected="' + (UR.tab === 'roles') + '">Roles &amp; permissions</a></div><div id="uWrap"><div class="card"><p class="hint">Loading…</p></div></div>');
  try { const r = await api('/users'); UR.users = r.users; UR.roles = r.roles; UR.mods = r.mods; }
  catch (e) { $('uWrap').innerHTML = '<div class="msg err">' + esc(e.message) + '</div>'; return; }
  if (UR.tab === 'roles') return rolesPage();
  if (arg && arg !== 'roles') return userForm(arg === 'new' ? null : decodeURIComponent(arg));
  usersList();
}

/* ── users list ── */
function usersList() {
  $('uWrap').innerHTML = '<div class="card"><h2>Team members <a class="btn sm pri" data-perm="users.add" href="#users/new">Add user</a></h2>' +
    '<div class="tools"><input type="search" placeholder="Search name, email or phone" aria-label="Search users" value="' + esc(UR.q) + '" oninput="UR.q=this.value;drawUsers()"/><select class="keep" aria-label="Role" onchange="UR.role=this.value;drawUsers()"><option value="">All roles</option>' + Object.entries(UR.roles).map(([k, r]) => '<option value="' + esc(k) + '"' + (UR.role === k ? ' selected' : '') + '>' + esc(r.name) + '</option>').join('') + '</select></div>' +
    '<div class="tw"><table><thead><tr><th class="sr">Sr.</th><th>Name</th><th>Role</th><th class="hide-m">Status</th><th class="hide-m">Last sign-in</th><th><span hidden>Actions</span></th></tr></thead><tbody id="uRows"></tbody></table></div></div>';
  drawUsers();
}
function drawUsers() {
  const q = UR.q.toLowerCase(), L = UR.users.filter(u => (!UR.role || u.role === UR.role) && (!q || (u.name + ' ' + u.email + ' ' + u.phone).toLowerCase().includes(q)))
    .sort((a, b) => (b.owner - a.owner) || (a.name || a.email).localeCompare(b.name || b.email));
  const pg = pageOf('users', L, q + '|' + UR.role);
  $('uRows').innerHTML = L.length ? pg.rows.map((u, j) => '<tr>' + sr(pg, j) + '<td><div class="t">' + esc(u.name && !(u.owner && u.name === 'Owner') ? u.name : u.owner ? '' : '—') + (u.owner ? ' <span class="pill star">Owner</span>' : '') + (u.email === ME.email ? ' <span class="pill">You</span>' : '') + '</div><div class="s">' + esc(u.email) + (u.phone ? ' · ' + esc(u.phone) : '') + '</div></td>' +
    '<td><span class="pill rp-' + esc(u.role) + '">' + esc(u.roleName) + '</span>' + (u.custom ? ' <span class="pill warn" title="This person has their own permission list">Custom</span>' : '') + '</td>' +
    '<td class="hide-m">' + (u.active ? '<span class="pill ok">Active</span>' : '<span class="pill">Switched off</span>') + (u.has2fa ? '' : ' <span class="pill warn" title="Sets up the authenticator app at first sign-in">First sign-in pending</span>') + '</td>' +
    '<td class="hide-m">' + whenTxt(u.last) + '</td><td><div class="acts-cell"><a class="btn sm" href="#users/' + encodeURIComponent(u.email) + '">' + (can('users', 'edit') ? 'Edit' : 'View') + '</a></div></td></tr>').join('')
    : '<tr><td colspan="6" class="empty">No one matches.</td></tr>';
  pgMount($('uRows'), pg, 'drawUsers');
}

/* ── permission matrix (used for roles and for custom permissions) ── */
function permMatrix(id, perms, locked) {
  const has = new Set(perms || []);
  return '<div class="tw"><table class="pmx" id="' + id + '"><thead><tr><th>Module</th>' + COLS.map(c => '<th>' + ACT_LABEL[c] + '</th>').join('') + '<th>Other</th></tr></thead><tbody>' +
    Object.entries(UR.mods).map(([m, acts]) => '<tr><td><b>' + esc(MOD_LABEL[m] || m) + '</b></td>' +
      COLS.map(c => '<td>' + (acts.includes(c) ? '<input type="checkbox" aria-label="' + esc((MOD_LABEL[m] || m) + ' ' + c) + '" data-p="' + m + '.' + c + '"' + (has.has(m + '.' + c) ? ' checked' : '') + (locked ? ' disabled' : '') + ' onchange="pmTick(this)"/>' : '<span class="na">—</span>') + '</td>').join('') +
      '<td>' + acts.filter(a => !COLS.includes(a)).map(a => '<label class="pmo"><input type="checkbox" data-p="' + m + '.' + a + '"' + (has.has(m + '.' + a) ? ' checked' : '') + (locked ? ' disabled' : '') + ' onchange="pmTick(this)"/> ' + ACT_LABEL[a] + '</label>').join('') + '</td></tr>').join('') +
    '</tbody></table></div>' + (locked ? '' : '<div class="bar" style="justify-content:flex-start;margin-top:.4rem"><button type="button" class="btn sm" onclick="pmAll(\'' + id + '\',true)">Tick all</button><button type="button" class="btn sm" onclick="pmAll(\'' + id + '\',false)">Clear all</button></div>');
}
/* any action needs View; removing View removes the rest of that module */
function pmTick(el) {
  const [m, a] = el.dataset.p.split('.'), box = el.closest('table');
  if (a === 'view' && !el.checked) box.querySelectorAll('[data-p^="' + m + '."]').forEach(x => x.checked = false);
  if (a !== 'view' && el.checked) { const v = box.querySelector('[data-p="' + m + '.view"]'); if (v) v.checked = true; }
}
function pmAll(id, on) { $(id).querySelectorAll('input[data-p]').forEach(x => x.checked = on); $(id).dispatchEvent(new Event('change')); }
const pmRead = id => [...$(id).querySelectorAll('input[data-p]:checked')].map(x => x.dataset.p);

/* ── add / edit user ── */
function userForm(email) {
  const isNew = !email, u = isNew ? { email: '', name: '', phone: '', role: 'employee', custom: null, active: true } : UR.users.find(x => x.email === email);
  if (!u) { location.hash = 'users'; return; }
  const iAmSuper = ME.role === 'super_admin', canSave = isNew ? can('users', 'add') : can('users', 'edit') && (iAmSuper || u.role !== 'super_admin') && (!u.owner || ME.owner);
  const self = u.email === ME.email, roleLocked = u.owner || self;
  UR.edit = { ...u, isNew };
  $('uWrap').innerHTML = '<form class="card" style="max-width:860px" onsubmit="userSave(event)"><h2>' + (isNew ? 'Add user' : esc(u.name || u.email)) + (u.owner ? ' <span class="pill star">Owner</span>' : '') + '</h2><div class="msg err" id="uErr" hidden></div>' +
    (canSave ? '' : '<div class="msg info">View only. ' + (u.role === 'super_admin' ? 'Only a super admin can change a super admin.' : 'Your role can\'t change users.') + '</div>') +
    '<div class="g3"><div class="field"><label for="u_name">Full name</label><input id="u_name" required maxlength="60" value="' + esc(u.name) + '"/></div>' +
    '<div class="field"><label for="u_email">Email (used to sign in)</label><input id="u_email" type="email" required ' + (isNew ? '' : 'readonly ') + 'value="' + esc(u.email) + '"/></div>' +
    '<div class="field"><label for="u_phone">Mobile (optional)</label><input id="u_phone" type="tel" value="' + esc(u.phone) + '"/></div></div>' +
    '<div class="g3"><div class="field"><label for="u_role">Role</label><select id="u_role" onchange="userRoleChange()"' + (roleLocked ? ' disabled' : '') + '>' + Object.entries(UR.roles).filter(([k]) => k !== 'super_admin' || iAmSuper || u.role === 'super_admin').map(([k, r]) => '<option value="' + esc(k) + '"' + (u.role === k ? ' selected' : '') + '>' + esc(r.name) + '</option>').join('') + '</select>' + (u.owner ? '<div class="hint">The owner is always super admin.</div>' : self ? '<div class="hint">You can\'t change your own role.</div>' : '') + '</div>' +
    '<div class="field"><label for="u_active">Status</label><select id="u_active"' + (roleLocked ? ' disabled' : '') + '><option value="1"' + (u.active ? ' selected' : '') + '>Active — can sign in</option><option value="0"' + (u.active ? '' : ' selected') + '>Switched off — can\'t sign in</option></select></div>' +
    '<div class="field"><label for="u_pw">' + (isNew ? 'First password' : 'Set a new password (optional)') + '</label><div class="pwrow"><input id="u_pw" type="text" autocomplete="new-password" minlength="8"' + (isNew ? ' required' : '') + ' placeholder="At least 8 characters"/><button type="button" class="btn sm" onclick="$(\'u_pw\').value=genPw()">Generate</button></div><div class="hint">' + (isNew ? 'Share it with them privately. They choose their own after the first sign-in.' : 'They will be asked to choose their own after signing in.') + '</div></div></div>' +
    '<h3 class="uh">Permissions</h3><div id="u_perm"></div>' +
    (!isNew && !u.owner ? '<label class="chk" style="margin-top:1rem"><input type="checkbox" id="u_2fa"/> Reset their authenticator app (they scan a new QR code at next sign-in — use this if they lost their phone)</label>' : '') +
    (!isNew ? '<p class="hint" style="margin-top:.8rem">Added ' + whenTxt(u.created) + ' · Last sign-in ' + whenTxt(u.last) + ' · Authenticator ' + (u.has2fa ? 'set up' : 'not set up yet') + '</p>' : '') +
    '<div class="bar"><a class="btn" href="#users">Back</a>' + (!isNew && !u.owner && !self && can('users', 'delete') && canSave ? '<button type="button" class="btn danger" onclick="userDel()">Delete user</button>' : '') + (canSave ? '<button class="btn pri" id="uBtn">' + (isNew ? 'Add user' : 'Save changes') + '</button>' : '') + '</div></form>';
  userPermDraw(u.custom ? 'custom' : 'role');
  if (!canSave) $('uWrap').querySelectorAll('input,select,textarea').forEach(x => x.disabled = true);
}
function userPermDraw(mode) {
  const role = $('u_role').value, sup = role === 'super_admin', rp = (UR.roles[role] || {}).perms || [];
  const cur = mode === 'custom' ? (UR.edit.draft || UR.edit.custom || rp) : rp;
  $('u_perm').innerHTML = sup ? '<div class="msg info">Super admin can do everything, including managing users and roles.</div>' :
    '<div class="seg" role="radiogroup" aria-label="Permission type"><label><input type="radio" name="pm" value="role"' + (mode === 'role' ? ' checked' : '') + ' onchange="userPermMode(this.value)"/> Same as role (' + esc((UR.roles[role] || {}).name || role) + ')</label><label><input type="radio" name="pm" value="custom"' + (mode === 'custom' ? ' checked' : '') + ' onchange="userPermMode(this.value)"/> Custom for this person</label></div>' +
    '<p class="hint">' + (mode === 'role' ? 'They get exactly what the role allows. Change the role in Roles &amp; permissions to update everyone with it.' : 'Starts from the role. Tick or untick to give this person their own list.') + '</p>' + permMatrix('u_mx', cur, mode === 'role');
  UR.edit.mode = sup ? 'role' : mode;
}
function userPermMode(m) { if (m === 'custom' && $('u_mx') && !UR.edit.custom) UR.edit.draft = pmRead('u_mx'); userPermDraw(m); }
function userRoleChange() { UR.edit.draft = null; UR.edit.custom = null; userPermDraw(UR.edit.mode === 'custom' ? 'custom' : 'role'); }
function genPw() { const A = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'; return [...crypto.getRandomValues(new Uint8Array(12))].map(x => A[x % A.length]).join('').replace(/(.{4})(?=.)/g, '$1-'); }
async function userSave(e) {
  e.preventDefault(); const E = UR.edit, b = $('uBtn'), er = m => { $('uErr').textContent = m; $('uErr').hidden = false; $('uErr').scrollIntoView({ block: 'center' }); };
  $('uErr').hidden = true;
  const email = $('u_email').value.trim().toLowerCase(), pw = $('u_pw').value;
  if (pw && pw.length < 8) return er('The password needs at least 8 characters.');
  const custom = E.mode === 'custom' && $('u_mx') ? pmRead('u_mx') : null;
  if (custom && !custom.length) return er('Tick at least one permission, or use "Same as role".');
  b.disabled = true; b.textContent = 'Saving…';
  try {
    await api('/users/save', { create: E.isNew, email, name: $('u_name').value.trim(), phone: $('u_phone').value.trim(), role: $('u_role').value, active: $('u_active').value === '1', custom, hash: pw ? await srvHash(email, pw) : undefined, reset2fa: $('u_2fa') ? $('u_2fa').checked : false });
    toast(E.isNew ? 'User added. Share the password with them privately.' : 'Saved.');
    if (email === ME.email) { try { ME = await api('/me'); } catch (x) { } }
    location.hash = 'users';
  } catch (x) { er(x.message); b.disabled = false; b.textContent = E.isNew ? 'Add user' : 'Save changes'; }
}
async function userDel() {
  const E = UR.edit;
  if (!await confirmBox('Delete ' + (E.name || E.email) + '?', 'They can\'t sign in any more. Their past work stays.', 'Delete')) return;
  try { await api('/users/delete', { email: E.email }); toast('User deleted.'); location.hash = 'users'; } catch (x) { toast(x.message, true); }
}

/* ── role master ── */
function rolesPage() {
  const sup = ME.role === 'super_admin';
  if (!UR.rdraft) UR.rdraft = JSON.parse(JSON.stringify(UR.roles));
  if (!UR.rk || !UR.rdraft[UR.rk]) UR.rk = 'admin' in UR.rdraft ? 'admin' : Object.keys(UR.rdraft)[0];
  const cnt = k => UR.users.filter(u => u.role === k).length, R = UR.rdraft[UR.rk], locked = !sup || UR.rk === 'super_admin';
  const pg = pageOf('roles', Object.entries(UR.rdraft));
  $('uWrap').innerHTML = (sup ? '' : '<div class="msg info">Only a super admin can change roles.</div>') +
    '<div class="rgrid"><div class="card"><h2>Roles ' + (sup ? '<button class="btn sm pri" onclick="roleAdd()">Add role</button>' : '') + '</h2><div class="tw"><table><thead><tr><th class="sr">Sr.</th><th>Role</th><th>People</th></tr></thead><tbody id="rlRows">' +
    pg.rows.map(([k, r], j) => '<tr class="rrow' + (k === UR.rk ? ' on' : '') + '" onclick="UR.rk=\'' + esc(k) + '\';rolesPage()" tabindex="0" onkeydown="if(event.key===\'Enter\')this.click()">' + sr(pg, j) + '<td><b>' + esc(r.name) + '</b><div class="s">' + (k === 'super_admin' ? 'Everything' : (r.perms || []).length + ' permissions') + '</div></td><td>' + cnt(k) + '</td></tr>').join('') + '</tbody></table></div></div>' +
    '<div class="card"><h2>' + esc(R.name) + (UR.rk === 'super_admin' ? ' <span class="pill">Fixed</span>' : '') + '</h2>' +
    (UR.rk === 'super_admin' ? '<p>Super admin can do everything, including managing users and roles. This can\'t be changed.</p>' :
      '<div class="field" style="max-width:340px"><label for="r_name">Role name</label><input id="r_name" value="' + esc(R.name) + '"' + (locked ? ' disabled' : '') + ' oninput="UR.rdraft[UR.rk].name=this.value"/></div>' + permMatrix('r_mx', R.perms, locked) +
      (sup ? '<div class="bar">' + (!['admin', 'employee', 'sale'].includes(UR.rk) ? '<button class="btn danger" onclick="roleDel()"' + (cnt(UR.rk) ? ' disabled title="Someone still has this role"' : '') + '>Delete role</button>' : '') + '<button class="btn" onclick="UR.rdraft=null;rolesPage()">Undo changes</button><button class="btn pri" id="rBtn2" onclick="rolesSave()">Save roles</button></div>' : '')) + '</div></div>';
  pgMount($('rlRows'), pg, 'rolesPage');
  if ($('r_mx') && !locked) $('r_mx').addEventListener('change', () => UR.rdraft[UR.rk].perms = pmRead('r_mx'));
}
function roleAdd() {
  const name = (prompt('Name of the new role (for example: Site supervisor)') || '').trim(); if (!name) return;
  let k = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 20) || 'role'; if (!/^[a-z]/.test(k)) k = 'r_' + k;
  while (UR.rdraft[k]) k += '_2';
  UR.rdraft[k] = { name, perms: ['dashboard.view'] }; UR.rk = k; PGS.roles && (PGS.roles.p = 1e9); rolesPage();
}
function roleDel() { delete UR.rdraft[UR.rk]; UR.rk = null; rolesPage(); }
async function rolesSave() {
  const b = $('rBtn2'); b.disabled = true; b.textContent = 'Saving…';
  const out = {}; for (const [k, r] of Object.entries(UR.rdraft)) if (k !== 'super_admin') out[k] = { name: r.name, perms: r.perms };
  try { const r = await api('/roles', { roles: out }); UR.roles = r.roles; UR.rdraft = null; try { ME = await api('/me'); } catch (x) { } toast('Roles saved. Everyone with these roles gets the new permissions right away.'); rolesPage(); chrome(); }
  catch (x) { toast(x.message, true); b.disabled = false; b.textContent = 'Save roles'; }
}
