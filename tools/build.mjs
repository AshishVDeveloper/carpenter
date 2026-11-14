// Builds one static, search-friendly HTML page per route from /data/*.json.
// Run: node tools/build.mjs   (also runs automatically on GitHub when data changes)
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const VI = require(path.join(ROOT, 'assets/render.js'));
const read = f => JSON.parse(fs.readFileSync(path.join(ROOT, 'data', f), 'utf8'));
const D = VI.prep({ S: read('settings.json'), CATS: read('categories.json'), PRODUCTS: read('products.json'), WORK: read('projects.json'), QUOTES: fs.existsSync(path.join(ROOT, 'data/testimonials.json')) ? read('testimonials.json') : [] });
const S = D.S, esc = VI.esc;
const V = Date.now().toString(36);

function page(route, view, args) {
  const p = VI.render(D, view, args);
  const url = S.site_url + (view === 'notfound' ? '/' : route);
  const img = S.site_url + (p.image || '/images/site/og.jpg');
  const ld = [VI.orgLD(D)].concat(p.ld || []);
  const hdr = VI.header(D, view === 'notfound' ? '' : route), ftr = VI.footer(D);
  return `<!DOCTYPE html>
<html lang="en-IN">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${esc(p.title)}</title>
<meta name="description" content="${esc(p.desc)}"/>
${p.noindex ? '<meta name="robots" content="noindex,follow"/>' : `<link rel="canonical" href="${esc(url)}"/>`}
<meta name="theme-color" content="#2F4A3A"/>
<meta property="og:type" content="website"/>
<meta property="og:site_name" content="${esc(S.name)}"/>
<meta property="og:title" content="${esc(p.title)}"/>
<meta property="og:description" content="${esc(p.desc)}"/>
<meta property="og:url" content="${esc(url)}"/>
<meta property="og:image" content="${esc(img)}"/>
<meta property="og:locale" content="en_IN"/>
<meta name="twitter:card" content="summary_large_image"/>
<meta name="geo.region" content="IN-MH"/>
<meta name="geo.placename" content="Airoli, Navi Mumbai"/>
<link rel="icon" href="/assets/logo.svg" type="image/svg+xml"/>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700;12..96,800&family=Figtree:wght@400;500;600;700&display=swap" rel="stylesheet"/>
<link rel="stylesheet" href="/assets/store.css?v=${V}"/>
<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>
</head>
<body>
<div id="hdr" data-sig="${VI.sig(hdr)}">${hdr}</div>
<main id="app" tabindex="-1" data-sig="${VI.sig(p.body)}">
${p.body}
</main>
<div id="ftr" data-sig="${VI.sig(ftr)}">${ftr}</div>
<script src="/assets/render.js?v=${V}"></script>
<script src="/assets/store.js?v=${V}"></script>
</body>
</html>
`;
}

// remove old generated folders (keep source folders)
const KEEP = new Set(['assets', 'data', 'images', 'tools', '.github', '.git', 'node_modules']);
for (const f of ['services', 'furniture', 'our-work', 'about', 'contact', 'get-quote', 'quote-list', 'thanks', 'areas']) fs.rmSync(path.join(ROOT, f), { recursive: true, force: true });

const routes = VI.routes(D);
for (const r of routes) {
  const [route, view, ...args] = r;
  const dir = path.join(ROOT, route);
  if (KEEP.has(route.split('/')[1])) throw new Error('route clashes with a source folder: ' + route);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), page(route, view, args));
}
fs.writeFileSync(path.join(ROOT, '404.html'), page('/404/', 'notfound', []));

const today = new Date().toISOString().slice(0, 10);
const index = routes.filter(r => !['list', 'thanks'].includes(r[1]));
const pri = v => ({ home: '1.0', services: '0.9', service: '0.9', furniture: '0.8', category: '0.7', area: '0.8', product: '0.6' }[v] || '0.5');
fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${index.map(r => `  <url><loc>${S.site_url}${r[0]}</loc><lastmod>${today}</lastmod><priority>${pri(r[1])}</priority></url>`).join('\n')}
</urlset>
`);
fs.writeFileSync(path.join(ROOT, 'robots.txt'), `User-agent: *
Allow: /
Disallow: /admin.html
Disallow: /quote-list/
Disallow: /thanks/

Sitemap: ${S.site_url}/sitemap.xml
`);
console.log('Built', routes.length, 'pages + 404, sitemap.xml, robots.txt');
