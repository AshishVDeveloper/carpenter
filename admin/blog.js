/* Blog: write, edit and delete articles (data/blog.json). Pages are built from it by the site build.
   Uses VI.parseBody / VI.bodyText / VI.blogBlock from /assets/render.js so the preview matches the website. */
let BQ = '', BC = '', BS = '', BDRAFT = null;
const blogCatsAdmin = () => [...new Set((DB.blog || []).map(b => b.category).filter(Boolean))].sort();
const BLOG_IMGS = ['images/site/hero.webp', 'images/site/living.webp', 'images/site/bedroom.webp', 'images/site/open-plan.webp', 'images/site/home-interiors.webp', 'images/site/modular-kitchens.webp', 'images/site/kitchen-2.webp', 'images/site/office-interiors.webp', 'images/site/shops-showrooms.webp', 'images/site/mall-work.webp', 'images/site/furniture-to-measure.webp', 'images/site/workshop.webp'];
const imgUrl = s => !s ? '' : /^(https?:|\/)/.test(s) ? s : '/' + s;
const smallUrl = s => { const u = imgUrl(s); return /^\/images\/(products|site|blog)\/[a-z0-9-]+\.webp$/.test(u) ? u.replace(/\.webp$/, '-sm.webp') : u; };

function pgBlog() {
  DB.blog = DB.blog || [];
  const cats = blogCatsAdmin();
  C('<div class="msg info">Articles help people find you on Google. Write about questions customers ask you — costs, materials, care, ideas. After saving, press <b>Publish blog</b>; the article goes live in about 2 minutes.</div>' +
    '<div class="card"><h2>Articles <a class="btn sm pri" data-perm="blog.add" href="#blog/new">Write article</a></h2>' +
    '<div class="tools"><input type="search" placeholder="Search title or tag" aria-label="Search articles" value="' + esc(BQ) + '" oninput="BQ=this.value;drawBlog()"/>' +
    '<select class="keep" aria-label="Category" onchange="BC=this.value;drawBlog()"><option value="">All categories</option>' + cats.map(c => '<option' + (BC === c ? ' selected' : '') + '>' + esc(c) + '</option>').join('') + '</select>' +
    '<select class="keep" aria-label="Status" onchange="BS=this.value;drawBlog()"><option value="">All</option><option value="live"' + (BS === 'live' ? ' selected' : '') + '>Published</option><option value="draft"' + (BS === 'draft' ? ' selected' : '') + '>Drafts</option></select></div>' +
    '<div class="tw"><table><thead><tr><th class="sr">Sr.</th><th></th><th>Article</th><th class="hide-m">Date</th><th class="hide-m">Status</th><th><span hidden>Actions</span></th></tr></thead><tbody id="bRows"></tbody></table></div></div>' + saveBar('blog'));
  drawBlog();
}
function drawBlog() {
  const q = BQ.toLowerCase(), L = (DB.blog || []).map((b, i) => [b, i])
    .filter(([b]) => (!BC || b.category === BC) && (!BS || (BS === 'draft' ? b.draft : !b.draft)) && (!q || (b.title + ' ' + (b.tags || []).join(' ') + ' ' + b.slug).toLowerCase().includes(q)))
    .sort((a, b) => String(b[0].date || '').localeCompare(String(a[0].date || '')) || a[1] - b[1]);
  const pg = pageOf('blog', L, q + '|' + BC + '|' + BS);
  $('bRows').innerHTML = L.length ? pg.rows.map(([b, i], j) => '<tr>' + sr(pg, j) + '<td style="width:80px"><img class="th" src="' + esc(smallUrl(b.image) || 'assets/logo.svg') + '" alt=""/></td>' +
    '<td><div class="t">' + esc(b.title) + '</div><div class="s">' + esc(b.category || '—') + ' · ' + (window.VI ? VI.readMin(b) : '') + ' min read · /blog/' + esc(b.slug) + '/</div></td>' +
    '<td class="hide-m">' + esc(b.date || '') + '</td><td class="hide-m">' + (b.draft ? '<span class="pill warn">Draft</span>' : '<span class="pill ok">Published</span>') + '</td>' +
    '<td><div class="acts-cell">' + (b.draft ? '' : '<a class="btn sm" href="/blog/' + esc(b.slug) + '/" target="_blank" rel="noopener">View</a>') + '<a class="btn sm" href="#blog/' + b.id + '">' + (can('blog', 'edit') ? 'Edit' : 'Open') + '</a><button class="btn sm danger" data-perm="blog.delete" onclick="delPost(' + i + ')">Delete</button></div></td></tr>').join('')
    : '<tr><td colspan="6" class="empty">No articles match.</td></tr>';
  pgMount($('bRows'), pg, 'drawBlog');
}
async function delPost(i) {
  const b = DB.blog[i];
  if (!await confirmBox('Delete "' + b.title + '"?', 'It disappears from the website when you publish the blog.')) return;
  DB.blog.splice(i, 1); markDirty('blog'); drawBlog(); toast('Deleted. Press Publish blog to remove it from the website.');
}

/* ── editor ── */
function pgPost(id) {
  const isNew = id === 'new', today = new Date().toISOString().slice(0, 10);
  const b = isNew ? { title: '', slug: '', desc: '', category: blogCatsAdmin()[0] || 'Design ideas', tags: [], image: BLOG_IMGS[0], author: 'Mumbai Interior team', date: today, draft: false, body: [] } : (DB.blog || []).find(x => String(x.id) === id);
  if (!b) { location.hash = 'blog'; return; }
  $('pTitle').textContent = isNew ? 'Write article' : 'Edit article';
  BDRAFT = { slugTouched: !isNew, image: b.image };
  const f = (id, label, val, extra = '', hint = '') => '<div class="field"><label for="' + id + '">' + label + '</label><input id="' + id + '" value="' + esc(val) + '" ' + extra + '/>' + (hint ? '<div class="hint" id="' + id + '_h">' + hint + '</div>' : '') + '</div>';
  const tb = [['## ', 'Heading'], ['### ', 'Small heading'], ['- ', 'Bullet'], ['1. ', 'Numbered'], ['> ', 'Tip box'], ['**', 'Bold'], ['[', 'Link'], ['|', 'Table']];
  C('<form class="card" onsubmit="savePost(event,\'' + id + '\')"><div class="msg err" id="bErr" hidden></div>' +
    f('b_title', 'Title', b.title, 'required maxlength="110" oninput="postTitle()"', '') +
    '<div class="g2">' + f('b_slug', 'Web address', b.slug, 'required pattern="[a-z0-9-]+" oninput="BDRAFT.slugTouched=true;postSlugHint()"', '') +
    '<div class="field"><label for="b_cat">Category</label><input id="b_cat" list="bcats" required value="' + esc(b.category || '') + '"/><datalist id="bcats">' + blogCatsAdmin().map(c => '<option value="' + esc(c) + '">').join('') + '</datalist><div class="hint">Pick one or type a new category.</div></div></div>' +
    '<div class="field"><label for="b_desc">Short description</label><textarea id="b_desc" maxlength="200" style="min-height:70px" oninput="postCount()">' + esc(b.desc || '') + '</textarea><div class="hint" id="b_desc_h"></div></div>' +
    '<div class="g3">' + f('b_tags', 'Tags', (b.tags || []).join(', '), 'placeholder="e.g. wardrobe, bedroom"', 'Separate with commas.') + f('b_author', 'Author', b.author || '') + f('b_date', 'Date', b.date || today, 'type="date"') + '</div>' +
    '<h2 class="mt14">Cover photo</h2><div class="bcover"><img id="b_img" src="' + esc(smallUrl(b.image)) + '" alt=""/><div><div class="field"><label for="b_pick">Choose a photo from the website</label><select id="b_pick" class="keep" onchange="if(this.value)postImg(this.value)"><option value="">— choose —</option>' + BLOG_IMGS.concat((DB.products || []).flatMap(p => p.images || []).filter(x => /\.webp$/.test(x))).filter((x, i, a) => a.indexOf(x) === i).map(x => '<option value="' + esc(x) + '"' + (x === b.image ? ' selected' : '') + '>' + esc(x.split('/').pop()) + '</option>').join('') + '</select></div>' +
    '<label class="btn sm" for="b_file" style="margin:0">Upload new photo</label><input id="b_file" type="file" accept="image/*" hidden/><p class="hint">Landscape photos work best (4:3 or wider).</p></div></div>' +
    '<h2 class="mt14">Article</h2><div class="btool" role="toolbar" aria-label="Formatting">' + tb.map(t => '<button type="button" class="btn sm" onclick="postIns(\'' + t[0].replace(/'/g, "\\'") + '\')">' + t[1] + '</button>').join('') + '<span class="sp"></span><button type="button" class="btn sm" id="b_pv" onclick="postPreview()">Preview</button></div>' +
    '<textarea id="b_body" class="bbody" oninput="postCount()" placeholder="Write here. Start a line with ## for a heading, - for a bullet, > for a tip. Leave an empty line between paragraphs.">' + esc(window.VI ? VI.bodyText(b.body) : '') + '</textarea>' +
    '<div id="b_prev" class="bprev" hidden></div>' +
    '<details class="bhelp"><summary>How to format</summary><table><tbody>' +
    [['## Heading', 'Section heading (also builds the "In this article" list)'], ['### Small heading', 'Smaller heading'], ['- item', 'Bullet list'], ['1. step', 'Numbered list'], ['> text', 'Highlighted tip box'], ['**bold**', '<b>bold</b> text'], ['[text](/services/home-interiors/)', 'Link to a page on your website or https:// link'], ['| A | B |', 'Table: one row per line, first row is the heading']].map(r => '<tr><td><code>' + esc(r[0]) + '</code></td><td>' + r[1] + '</td></tr>').join('') + '</tbody></table></details>' +
    '<div class="bseo" id="b_seo"></div>' +
    '<div class="bar"><label class="check" style="margin:0 auto 0 0"><input type="checkbox" id="b_draft"' + (b.draft ? ' checked' : '') + '/> Save as draft (not shown on the website)</label><a class="btn" href="#blog">Cancel</a><button class="btn pri">' + (isNew ? 'Add article' : 'Save article') + '</button></div></form>' + saveBar('blog'));
  $('b_file').onchange = async e => { const fs = [...e.target.files]; if (!fs.length) return; toast('Uploading photo…'); const paths = await uploadPhotos(fs, $('b_slug').value || 'blog'); if (paths.length) { postImg(paths[0]); toast('Photo uploaded. Save the article, then publish.'); } e.target.value = ''; };
  postSlugHint(); postCount();
}
function postImg(p) { BDRAFT.image = p; $('b_img').src = smallUrl(p); $('b_img').onerror = () => { $('b_img').onerror = null; $('b_img').src = imgUrl(p); }; }
function postTitle() { if (!BDRAFT.slugTouched) $('b_slug').value = slugify($('b_title').value).slice(0, 70); postSlugHint(); postCount(); }
function postSlugHint() { const h = $('b_slug_h') || (() => { const d = document.createElement('div'); d.className = 'hint'; d.id = 'b_slug_h'; $('b_slug').after(d); return d; })(); h.textContent = 'www.mumbai-interior.in/blog/' + ($('b_slug').value || '…') + '/'; }
function postIns(tok) {
  const t = $('b_body'), s = t.selectionStart, e = t.selectionEnd, sel = t.value.slice(s, e);
  let ins;
  if (tok === '**') ins = '**' + (sel || 'bold text') + '**';
  else if (tok === '[') ins = '[' + (sel || 'link text') + '](/get-quote/)';
  else if (tok === '|') ins = '\n| Item | Detail |\n| First | Value |\n| Second | Value |\n';
  else { const ls = t.value.lastIndexOf('\n', s - 1) + 1; t.setRangeText(tok, ls, ls, 'end'); t.focus(); postCount(); return; }
  t.setRangeText(ins, s, e, 'end'); t.focus(); postCount();
}
function postPreview() {
  const p = $('b_prev'), on = p.hidden;
  if (on) p.innerHTML = '<article class="post-pv"><h1>' + esc($('b_title').value) + '</h1><p class="lede">' + esc($('b_desc').value) + '</p>' + VI.parseBody($('b_body').value).map(VI.blogBlock).join('') + '</article>';
  p.hidden = !on; $('b_body').hidden = on; $('b_pv').textContent = on ? 'Back to editing' : 'Preview';
}
/* quick checks that help the article rank */
function postCount() {
  const t = $('b_title').value.trim(), d = $('b_desc').value.trim(), blocks = VI.parseBody($('b_body').value);
  const words = blocks.map(x => [].concat(x[1]).flat().join(' ')).join(' ').split(/\s+/).filter(Boolean).length, h2 = blocks.filter(x => x[0] === 'h2').length, links = ($('b_body').value.match(/\]\(\//g) || []).length;
  $('b_desc_h').textContent = d.length + ' characters — aim for 120 to 160. This shows under the title on Google.';
  const ok = (c, txt) => '<li class="' + (c ? 'ok' : 'warn') + '">' + (c ? '✓ ' : '• ') + txt + '</li>';
  $('b_seo').innerHTML = '<b>Checklist</b><ul>' + ok(t.length >= 30 && t.length <= 70, 'Title ' + t.length + ' characters (30–70 is ideal)') + ok(d.length >= 120 && d.length <= 160, 'Description ' + d.length + ' characters (120–160)') +
    ok(words >= 400, words + ' words (400 or more ranks better)') + ok(h2 >= 3, h2 + ' headings (3 or more)') + ok(links >= 1, links + ' links to your own pages (add at least 1)') + '</ul>';
}
function savePost(e, id) {
  e.preventDefault(); const err = m => { $('bErr').textContent = m; $('bErr').hidden = false; $('bErr').scrollIntoView({ block: 'center' }); };
  const slug = $('b_slug').value.trim().toLowerCase(), body = VI.parseBody($('b_body').value);
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) return err('Web address: use only small letters, numbers and dashes.');
  if ((DB.blog || []).some(x => x.slug === slug && String(x.id) !== id)) return err('Another article already uses this web address.');
  if (!body.length) return err('Write the article first.');
  const d = { title: $('b_title').value.trim(), slug, desc: $('b_desc').value.trim(), category: $('b_cat').value.trim() || 'Tips', tags: $('b_tags').value.split(',').map(x => x.trim()).filter(Boolean), image: BDRAFT.image || BLOG_IMGS[0], author: $('b_author').value.trim(), date: $('b_date').value || new Date().toISOString().slice(0, 10), updated: new Date().toISOString().slice(0, 10), draft: $('b_draft').checked, body };
  DB.blog = DB.blog || [];
  if (id === 'new') DB.blog.unshift({ id: nextId(DB.blog), ...d }); else Object.assign(DB.blog.find(x => String(x.id) === id), d);
  markDirty('blog'); toast((id === 'new' ? 'Article added' : 'Article saved') + '. Press Publish blog to put it on the website.'); location.hash = 'blog';
}
