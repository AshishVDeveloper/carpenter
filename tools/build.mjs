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
<script>window.VI_LANG=${view === 'notfound' ? "(location.pathname.match(/^\\/(hi|mr)(?=\\/|$)/)||[])[1]||'en'" : JSON.stringify(lang)}</script>
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

// offline page (served by /sw.js when there is no internet) — standalone, works without other files
fs.mkdirSync(path.join(ROOT, 'offline'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'offline', 'index.html'), `<!DOCTYPE html>
<html lang="en-IN">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<meta name="robots" content="noindex"/>
<meta name="theme-color" content="#242421"/>
<title>You're offline | ${esc(S.name)}</title>
<link rel="icon" href="/favicon.ico" sizes="any"/>
<style>
:root{--bg:#F2F3EE;--surface:#fff;--ink:#1F2A22;--muted:#56635A;--line:#D9DDD2;--forest:#2F4A3A;--tape:#E9C46A}
@media (prefers-color-scheme:dark){:root{--bg:#0F1511;--surface:#18211B;--ink:#E6ECE6;--muted:#A5B3A8;--line:#2A372E;--forest:#3B6A4E}}
*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:var(--bg);color:var(--ink);font:400 1rem/1.6 system-ui,-apple-system,'Segoe UI',sans-serif;padding:1.5rem}
main{max-width:440px;text-align:center}img{width:72px;height:72px}
.tape{height:14px;max-width:220px;margin:1.2rem auto;border-radius:3px;background:repeating-linear-gradient(90deg,#3a3016 0 1.5px,transparent 1.5px 9px) bottom/100% 6px no-repeat,var(--tape);opacity:.9}
h1{font-size:1.7rem;line-height:1.2;margin:.2rem 0 .6rem}p{color:var(--muted);margin:0 0 1.4rem}
.b{display:flex;gap:.6rem;justify-content:center;flex-wrap:wrap}
a,button{display:inline-flex;align-items:center;justify-content:center;min-height:48px;padding:.8rem 1.3rem;border-radius:12px;font:700 .97rem system-ui,sans-serif;text-decoration:none;cursor:pointer;border:1.5px solid var(--line);background:var(--surface);color:var(--ink)}
button{background:var(--forest);border-color:var(--forest);color:#fff}
</style>
</head>
<body>
<main>
<img src="/assets/logo-96.png" alt="${esc(S.name)}" width="72" height="72"/>
<div class="tape" aria-hidden="true"></div>
<h1 id="h">You're offline</h1>
<p id="t">This page needs the internet. Check your mobile data or Wi-Fi, then try again. You can still call us — calls don't need internet.</p>
<div class="b"><button type="button" id="r">Try again</button><a id="c" href="tel:+91${String(S.phone).replace(/\D/g, '').slice(-10)}">Call ${esc(S.phone)}</a></div>
</main>
<script>
(function(){var L=(location.pathname.match(/^\\/(hi|mr)(?=\\/|$)/)||[])[1],T={
hi:["आप ऑफ़लाइन हैं","इस पेज के लिए इंटरनेट चाहिए। मोबाइल डेटा या वाई-फ़ाई जाँचें और फिर कोशिश करें। आप हमें कॉल कर सकते हैं — कॉल के लिए इंटरनेट नहीं चाहिए।","फिर कोशिश करें","कॉल करें"],
mr:["तुम्ही ऑफलाइन आहात","या पानासाठी इंटरनेट हवे. मोबाइल डेटा किंवा वाय-फाय तपासा आणि पुन्हा प्रयत्न करा. तुम्ही आम्हाला कॉल करू शकता — कॉलसाठी इंटरनेट लागत नाही.","पुन्हा प्रयत्न करा","कॉल करा"]}[L];
if(T){document.documentElement.lang=L+'-IN';h.textContent=T[0];t.textContent=T[1];r.textContent=T[2];c.textContent=T[3]+' ${esc(S.phone)}';document.title=T[0]+' | ${esc(S.name)}'}
r.onclick=function(){location.reload()};addEventListener('online',function(){location.reload()})})();
</script>
</body>
</html>
`);

// service worker: only shows /offline/ when a page can't load; it caches nothing else, so updates are never stale
fs.writeFileSync(path.join(ROOT, 'sw.js'), `const C = 'mi-offline-${V}', OFF = '/offline/';
self.addEventListener('install', e => { e.waitUntil(caches.open(C).then(c => c.addAll([OFF, '/assets/logo-96.png', '/favicon.ico']))); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(k => Promise.all(k.filter(n => n !== C).map(n => caches.delete(n)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (u.origin !== location.origin) return;
  if (r.mode === 'navigate') { e.respondWith(fetch(r).catch(() => caches.match(OFF))); return; }
  if (u.pathname === '/assets/logo-96.png' || u.pathname === '/favicon.ico') e.respondWith(fetch(r).catch(() => caches.match(u.pathname)));
});
`);

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
