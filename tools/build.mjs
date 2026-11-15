// Builds one static, search-friendly HTML page per route from /data/*.json.
// Run: node tools/build.mjs   (also runs automatically on GitHub when data changes)
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const VI = require(path.join(ROOT, 'assets/render.js'));
const read = f => JSON.parse(fs.readFileSync(path.join(ROOT, 'data', f), 'utf8'));
const D = VI.prep({ S: read('settings.json'), CATS: read('categories.json'), PRODUCTS: read('products.json'), WORK: read('projects.json'), QUOTES: fs.existsSync(path.join(ROOT, 'data/testimonials.json')) ? read('testimonials.json') : [], GUIDES: fs.existsSync(path.join(ROOT, 'data/guides.json')) ? read('guides.json') : [] });
const S = D.S, esc = VI.esc;
const I18N = fs.existsSync(path.join(ROOT, 'data/i18n.json')) ? read('i18n.json') : {};
const V = Date.now().toString(36);

function page(route, view, args, lang) {
  VI.setLang(lang, I18N);
  const pre = lang === 'en' ? '' : '/' + lang;
  const p = VI.render(D, view, args);
  const url = S.site_url + pre + (view === 'notfound' ? '/' : route);
  const alts = view === 'notfound' ? '' : VI.LANGS.map(l => `<link rel="alternate" hreflang="${l[0]}" href="${S.site_url}${l[0] === 'en' ? '' : '/' + l[0]}${route}"/>`).join('\n') + `\n<link rel="alternate" hreflang="x-default" href="${S.site_url}${route}"/>`;
  const img = S.site_url + (p.image || '/images/site/og.jpg');
  const ld = [VI.orgLD(D)].concat(p.ld || []);
  const hdr = VI.header(D, view === 'notfound' ? '/' : route), ftr = VI.footer(D);
  return `<!DOCTYPE html>
<html lang="${lang === 'en' ? 'en-IN' : lang + '-IN'}">
<head>
<meta charset="UTF-8"/>
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' https://formsubmit.co; object-src 'none'; base-uri 'self'; form-action 'self' https://formsubmit.co; upgrade-insecure-requests"/>
<meta name="referrer" content="strict-origin-when-cross-origin"/>
<script>if(location.protocol==='http:'&&/(^|\\.)mumbai-interior\\.in$/.test(location.hostname))location.replace('https://www.mumbai-interior.in'+location.pathname+location.search+location.hash);if(top!==self){document.documentElement.style.display='none';try{top.location=self.location.href}catch(e){}}</script>
<script>try{var t=localStorage.getItem("vi_theme");if(t==="dark"||(!t&&matchMedia("(prefers-color-scheme: dark)").matches))document.documentElement.classList.add("dark")}catch(e){}</script>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${esc(p.title)}</title>
<meta name="description" content="${esc(p.desc)}"/>
${p.noindex ? '<meta name="robots" content="noindex,follow"/>' : `<link rel="canonical" href="${esc(url)}"/>`}
${S.google_verification ? `<meta name="google-site-verification" content="${esc(S.google_verification)}"/>\n` : ''}${S.bing_verification ? `<meta name="msvalidate.01" content="${esc(S.bing_verification)}"/>\n` : ''}<meta name="theme-color" content="#242421"/>
<meta property="og:type" content="website"/>
<meta property="og:site_name" content="${esc(S.name)}"/>
<meta property="og:title" content="${esc(p.title)}"/>
<meta property="og:description" content="${esc(p.desc)}"/>
<meta property="og:url" content="${esc(url)}"/>
<meta property="og:image" content="${esc(img)}"/>
<meta property="og:locale" content="${lang}_IN"/>
${alts}
<meta name="twitter:card" content="summary_large_image"/>
<meta name="geo.region" content="IN-MH"/>
<meta name="geo.placename" content="Airoli, Navi Mumbai"/>
<link rel="icon" href="/favicon.ico" sizes="any"/>
<link rel="icon" href="/icon-192.png" type="image/png" sizes="192x192"/>
<link rel="apple-touch-icon" href="/apple-touch-icon.png"/>
<link rel="manifest" href="/site.webmanifest"/>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700;12..96,800&family=Figtree:wght@400;500;600;700${lang === 'en' ? '' : '&family=Noto+Sans+Devanagari:wght@400;500;600;700;800'}&display=swap" rel="stylesheet"/>
<link rel="stylesheet" href="/assets/store.css?v=${V}"/>
<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>
<style>#ldr{position:fixed;inset:0;z-index:999;display:grid;place-items:center;background:#F2F3EE;transition:opacity .45s ease,visibility .45s}html.dark #ldr{background:#0F1511}#ldr.done{opacity:0;visibility:hidden}
#ldr .lb{display:flex;flex-direction:column;align-items:center;gap:1.1rem;width:min(320px,78vw)}#ldr img{width:76px;height:76px;border-radius:18px;box-shadow:0 14px 30px -14px rgba(0,0,0,.5);animation:ldrPop .6s cubic-bezier(.2,.8,.2,1) both}
#ldr .lt{position:relative;width:100%;height:30px;border-radius:3px;overflow:hidden;background:repeating-linear-gradient(90deg,rgba(31,42,34,.85) 0 1.5px,transparent 1.5px 2%) bottom/100% 8px no-repeat,repeating-linear-gradient(90deg,rgba(31,42,34,.9) 0 2px,transparent 2px 10%) bottom/100% 15px no-repeat,#E9C46A;box-shadow:0 8px 20px -10px rgba(0,0,0,.45);animation:ldrTape 1.4s cubic-bezier(.6,0,.3,1) infinite}
#ldr .lt span{position:absolute;top:2px;margin-left:3px;font:800 10px/1 system-ui,sans-serif;color:#3a3016}#ldr p{font:700 15px/1 'Bricolage Grotesque',system-ui,sans-serif;letter-spacing:.01em;color:#1F2A22}html.dark #ldr p{color:#E6ECE6}
@keyframes ldrTape{0%{clip-path:inset(0 100% 0 0)}55%{clip-path:inset(0 0 0 0)}80%{clip-path:inset(0 0 0 0)}100%{clip-path:inset(0 0 0 100%)}}@keyframes ldrPop{from{opacity:0;transform:scale(.8)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){#ldr .lt,#ldr img{animation:none}}</style>
</head>
<body>
<div id="ldr" aria-hidden="true"><div class="lb"><img src="/assets/logo-96.png" alt="${esc(S.name)}" width="76" height="76"/><div class="lt">${[0,1,2,3,4,5,6,7,8,9].map(i => `<span style="left:${i * 10}%">${i * 10}</span>`).join('')}</div><p>${esc(S.name)}</p></div></div>
<script>(function(){var l=document.getElementById('ldr'),t0=Date.now(),h=function(){setTimeout(function(){l.classList.add('done');setTimeout(function(){l.remove()},600)},Math.max(0,700-(Date.now()-t0)))};if(document.readyState==='complete')h();else{addEventListener('load',h);setTimeout(h,3500)}})()</script>
<div id="hdr" data-sig="${VI.sig(hdr)}">${hdr}</div>
<main id="app" tabindex="-1" data-sig="${VI.sig(p.body)}">
${p.body}
</main>
<div id="ftr" data-sig="${VI.sig(ftr)}">${ftr}</div>
<script>window.VI_LANG=${JSON.stringify(lang)}</script>
<script src="/assets/render.js?v=${V}"></script>
<script src="/assets/store.js?v=${V}"></script>
</body>
</html>
`;
}

// remove old generated folders (keep source folders)
const KEEP = new Set(['admin', 'assets', 'data', 'images', 'tools', '.github', '.git', 'node_modules']);
for (const f of ['hi', 'mr', 'services', 'furniture', 'our-work', 'about', 'contact', 'get-quote', 'quote-list', 'thanks', 'areas', 'terms-of-use', 'privacy-policy', 'copyright-policy', 'hyperlinking-policy', 'disclaimer', 'refund-and-cancellation', 'accessibility-statement', 'grievance', 'help', 'sitemap', 'guides']) fs.rmSync(path.join(ROOT, f), { recursive: true, force: true });

const routes = VI.routes(D);
for (const r of routes) {
  const [route, view, ...args] = r;
  const dir = path.join(ROOT, route);
  if (KEEP.has(route.split('/')[1])) throw new Error('route clashes with a source folder: ' + route);
  for (const lang of ['en', 'hi', 'mr']) {
    const d = path.join(ROOT, lang === 'en' ? '' : lang, route);
    fs.mkdirSync(d, { recursive: true });
    fs.writeFileSync(path.join(d, 'index.html'), page(route, view, args, lang));
  }
}
fs.writeFileSync(path.join(ROOT, '404.html'), page('/404/', 'notfound', [], 'en'));

const today = new Date().toISOString().slice(0, 10);
const index = routes.filter(r => !['list', 'thanks'].includes(r[1]));
const pri = v => ({ guides: '0.7', guide: '0.7', home: '1.0', services: '0.9', service: '0.9', furniture: '0.8', category: '0.7', area: '0.8', product: '0.6' }[v] || '0.5');
fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${index.flatMap(r => ['', '/hi', '/mr'].map(pre => `  <url><loc>${S.site_url}${pre}${r[0]}</loc><lastmod>${today}</lastmod><priority>${pre ? (pri(r[1]) - 0.1).toFixed(1) : pri(r[1])}</priority></url>`)).join('\n')}
</urlset>
`);
fs.writeFileSync(path.join(ROOT, 'robots.txt'), `User-agent: *
Allow: /
Disallow: /admin.html
Disallow: /admin/
Disallow: /quote-list/
Disallow: /thanks/

Sitemap: ${S.site_url}/sitemap.xml
`);
console.log('Built', routes.length * 3, 'pages + 404, sitemap.xml, robots.txt');
