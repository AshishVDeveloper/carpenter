// Builds one static, search-friendly HTML page per route from /data/*.json.
// Run: node tools/build.mjs   (also runs automatically on GitHub when data changes)
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const VI = require(path.join(ROOT, 'assets/render.js'));
const VS = require(path.join(ROOT, 'assets/structure.js'));
const read = f => JSON.parse(fs.readFileSync(path.join(ROOT, 'data', f), 'utf8'));
const D = VI.prep({ S: read('settings.json'), CATS: read('categories.json'), PRODUCTS: read('products.json'), WORK: read('projects.json'), QUOTES: fs.existsSync(path.join(ROOT, 'data/testimonials.json')) ? read('testimonials.json') : [], BLOG: fs.existsSync(path.join(ROOT, 'data/blog.json')) ? read('blog.json') : [], GUIDES: fs.existsSync(path.join(ROOT, 'data/guides.json')) ? read('guides.json') : [], CATALOGUE: fs.existsSync(path.join(ROOT, 'data/catalogue.json')) ? read('catalogue.json') : [], BANNERS: fs.existsSync(path.join(ROOT, 'data/banners.json')) ? read('banners.json') : {} });
const S = D.S, esc = VI.esc;
const I18N = fs.existsSync(path.join(ROOT, 'data/i18n.json')) ? read('i18n.json') : {};
const V = Date.now().toString(36);

/* every shop/site photo needs 600 px (-sm) and 400 px (-xs) copies, team photos a 320 px (-xs) copy; made here for new uploads */
{
  let sharp = null; try { sharp = (await import('sharp')).default; } catch (e) { }
  const want = [];
  for (const dir of ['images/products', 'images/site', 'images/team', 'images/blog', 'images/catalogue', 'images/banners']) {
    const abs = path.join(ROOT, dir); if (!fs.existsSync(abs)) continue;
    for (const f of fs.readdirSync(abs)) {
      if (!/\.webp$/.test(f) || /-xs\.webp$/.test(f)) continue;
      const full = path.join(abs, f);
      if (dir === 'images/team') { want.push([full, full.replace(/\.webp$/, '-xs.webp'), 320]); continue; }
      if (/-sm\.webp$/.test(f)) { want.push([full, full.replace(/-sm\.webp$/, '-xs.webp'), 400]); continue; }
      want.push([full, full.replace(/\.webp$/, '-sm.webp'), 600], [full, full.replace(/\.webp$/, '-xs.webp'), 400]);
    }
  }
  let made = 0;
  for (const [from, to, w] of want) {
    if (fs.existsSync(to)) continue;
    try { if (sharp) await sharp(from).resize({ width: w, withoutEnlargement: true }).webp({ quality: 78 }).toFile(to); else fs.copyFileSync(from, to); made++; }
    catch (e) { try { fs.copyFileSync(from, to); made++; } catch (x) { } }
  }
  if (made) console.log('Made ' + made + ' smaller photo copies' + (sharp ? '' : ' (copied — install sharp to resize)'));
}
/* minified copies of the site scripts (made with terser when it is installed; otherwise the readable files are used) */
/* one script file for the whole site: render.js + store.js joined (minified with terser when it is installed) */
const JSFILE = 'site.min.js';
{
  const src = ['structure.js', 'render.js', 'store.js'].map(f => fs.readFileSync(path.join(ROOT, 'assets', f), 'utf8')).join(';\n');
  let terser = null; try { terser = await import('terser'); } catch (e) { }
  const out = terser ? (await terser.minify(src, { compress: true, mangle: true, format: { comments: false } })).code : src;
  fs.writeFileSync(path.join(ROOT, 'assets', JSFILE), out + '\n');
  for (const f of ['render.min.js', 'store.min.js']) try { fs.unlinkSync(path.join(ROOT, 'assets', f)); } catch (e) { }
}
/* fonts: fewer files (one variable font per family), loaded without blocking the first paint */
const FONTS = lang => 'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600..800&family=Figtree:wght@400..700' + (lang === 'en' ? '' : '&family=Noto+Sans+Devanagari:wght@400..800') + '&display=swap';
/* page CSS goes inside each page, so the browser can draw it without waiting for another file */
const FONTCSS = fs.readFileSync(path.join(ROOT, 'assets/fonts/fonts.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\n/g, '');
/* page CSS + fonts in one cacheable file, loaded without blocking (the loading screen covers the page until it is ready) */
const CSSFILE = 'site.css';
const CSS = fs.readFileSync(path.join(ROOT, 'assets/store.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ').replace(/\s*([{};,])\s*/g, '$1').replace(/;}/g, '}').replace(/<\/style/gi, '').trim();
{
  let css = FONTCSS + CSS;
  try { const csso = (await import('csso')).default; css = csso.minify(css, { restructure: true }).css; } catch (e) { }
  fs.writeFileSync(path.join(ROOT, 'assets', CSSFILE), css + '\n');
}
/* optional Google Analytics (Business details → Google Analytics ID) */
const GA_ID = /^G-[A-Z0-9]{4,14}$/.test(String(S.ga_id || '').trim()) ? S.ga_id.trim() : '';
const GA = GA_ID ? `\n<script async src="https://www.googletagmanager.com/gtag/js?id=${GA_ID}"></script>\n<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${GA_ID}',{anonymize_ip:true})</script>` : '';
/* images get a title (same as their alt text); repeated icons are stored once and reused with <use> */
function tidy(html) {
  html = html.replace(/<img\b(?![^>]*\stitle=)([^>]*?)\salt="([^"]+)"([^>]*)>/g, '<img$1 alt="$2" title="$2"$3>');
  const body = html.indexOf('<body>'); if (body < 0) return html;
  const svgs = html.slice(body).match(/<svg\b[^>]*>[\s\S]*?<\/svg>/g) || [], cnt = {};
  svgs.forEach(x => cnt[x] = (cnt[x] || 0) + 1);
  const syms = []; let n = 0;
  for (const [x, c] of Object.entries(cnt)) {
    if (c < 2) continue;
    const m = x.match(/^<svg\b([^>]*)>([\s\S]*)<\/svg>$/), vb = (m[1].match(/viewBox="[^"]*"/) || ['viewBox="0 0 24 24"'])[0], id = 'i' + (++n);
    syms.push('<symbol id="' + id + '" ' + vb + '>' + m[2] + '</symbol>');
    html = html.slice(0, body) + html.slice(body).split(x).join('<svg' + m[1] + '><use href="#' + id + '"/></svg>');
  }
  return syms.length ? html.replace('<body>', '<body>\n<svg class="sr" width="0" height="0" aria-hidden="true" focusable="false">' + syms.join('') + '</svg>') : html;
}
/* keep email addresses out of reach of simple spam scrapers: &#64; in HTML, @ inside scripts (browsers and Google read both normally) */
const hideMail = html => html.replace(/(<script[^>]*>)([\s\S]*?)(<\/script>)/g, (m, a, b, c) => a + b.replace(/([A-Za-z0-9._%+-]+)@([A-Za-z0-9.-]+\.[a-z]{2,})/g, '$1\\u0040$2') + c)
  .replace(/(^|>)([^<]*)/g, (m, a, t) => a + t.replace(/([A-Za-z0-9._%+-]+)@([A-Za-z0-9.-]+\.[a-z]{2,})/g, '$1&#64;$2'))
  .replace(/(href="mailto:[^"@]+)@/g, '$1&#64;').replace(/(content="[^"@]*?[A-Za-z0-9._%+-])@([A-Za-z0-9.-]+\.[a-z]{2,})/g, '$1&#64;$2');
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
<html lang="${lang === 'en' ? 'en-IN' : lang + '-IN'}"${['home', 'service', 'area', 'guide'].includes(view) ? ' class="ovl"' : ''}>
<head>
<meta charset="UTF-8"/>
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline'${S.ga_id ? ' https://www.googletagmanager.com' : ''}; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data: https:; connect-src 'self' https://formsubmit.co https://*.workers.dev${S.ga_id ? ' https://*.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com' : ''}; object-src 'none'; base-uri 'self'; form-action 'self' https://formsubmit.co; upgrade-insecure-requests"/>
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
<link rel="preload" href="/assets/fonts/bricolage-grotesque-latin-wght-normal.woff2" as="font" type="font/woff2" crossorigin/>
<link rel="preload" href="/assets/fonts/figtree-latin-wght-normal.woff2" as="font" type="font/woff2" crossorigin/>
<link rel="preload" href="/assets/${CSSFILE}?v=${V}" as="style" onload="this.onload=null;this.rel='stylesheet'"/>
<noscript><link rel="stylesheet" href="/assets/${CSSFILE}?v=${V}"/></noscript>${GA}
<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>
<style>#ldr{position:fixed;inset:0;z-index:999;display:grid;place-items:center;background:#F2F3EE;transition:opacity .45s ease,visibility .45s}html.dark #ldr{background:#0F1511}#ldr.done{opacity:0;visibility:hidden}
#ldr .lb{display:flex;flex-direction:column;align-items:center;gap:1.1rem;width:min(320px,78vw)}#ldr .logo-i{display:block;background:url(/assets/logo-88.webp) center/cover no-repeat;width:76px;height:76px;border-radius:18px;box-shadow:0 14px 30px -14px rgba(0,0,0,.5);animation:ldrPop .6s cubic-bezier(.2,.8,.2,1) both}
#ldr .lt{position:relative;width:100%;height:30px;border-radius:3px;overflow:hidden;background:repeating-linear-gradient(90deg,rgba(31,42,34,.85) 0 1.5px,transparent 1.5px 2%) bottom/100% 8px no-repeat,repeating-linear-gradient(90deg,rgba(31,42,34,.9) 0 2px,transparent 2px 10%) bottom/100% 15px no-repeat,#E9C46A;box-shadow:0 8px 20px -10px rgba(0,0,0,.45);animation:ldrTape 1.4s cubic-bezier(.6,0,.3,1) infinite}
#ldr .lt span{position:absolute;top:2px;margin-left:3px;font:800 10px/1 system-ui,sans-serif;color:#3a3016}#ldr .lt span:nth-child(1){left:0%}#ldr .lt span:nth-child(2){left:10%}#ldr .lt span:nth-child(3){left:20%}#ldr .lt span:nth-child(4){left:30%}#ldr .lt span:nth-child(5){left:40%}#ldr .lt span:nth-child(6){left:50%}#ldr .lt span:nth-child(7){left:60%}#ldr .lt span:nth-child(8){left:70%}#ldr .lt span:nth-child(9){left:80%}#ldr .lt span:nth-child(10){left:90%}#ldr p{font:700 15px/1 'Bricolage Grotesque',system-ui,sans-serif;letter-spacing:.01em;color:#1F2A22}html.dark #ldr p{color:#E6ECE6}
@keyframes ldrTape{0%{clip-path:inset(0 100% 0 0)}55%{clip-path:inset(0 0 0 0)}80%{clip-path:inset(0 0 0 0)}100%{clip-path:inset(0 0 0 100%)}}@keyframes ldrPop{from{opacity:0;transform:scale(.8)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){#ldr .lt,#ldr .logo-i{display:block;background:url(/assets/logo-88.webp) center/cover no-repeat;animation:none}}</style>
</head>
<body>
<div id="ldr" aria-hidden="true"><div class="lb"><span class="logo-i"></span><div class="lt">${[0,1,2,3,4,5,6,7,8,9].map(i => `<span>${i * 10}</span>`).join('')}</div><p>${esc(S.name)}</p></div></div>
<script>(function(){var l=document.getElementById('ldr'),t0=Date.now(),h=function(){setTimeout(function(){l.classList.add('done');setTimeout(function(){l.remove()},600)},Math.max(0,700-(Date.now()-t0)))};if(document.readyState==='complete')h();else{addEventListener('load',h);setTimeout(h,3500)}})()</script>
<div id="hdr" data-sig="${VI.sig(hdr)}">${hdr}</div>
<main id="app" tabindex="-1" data-sig="${VI.sig(p.body)}">
${p.body}
</main>
<div id="ftr" data-sig="${VI.sig(ftr)}">${ftr}</div>
<script>window.VI_LANG=${view === 'notfound' ? "(location.pathname.match(/^\\/(hi|mr)(?=\\/|$)/)||[])[1]||'en'" : JSON.stringify(lang)}</script>
<script src="/assets/${JSFILE}?v=${V}" defer></script>
</body>
</html>
`;
}

// remove old generated folders (keep source folders)
const KEEP = new Set(['admin', 'assets', 'data', 'images', 'tools', '.github', '.git', 'node_modules']);
for (const f of ['hi', 'mr', 'services', 'furniture', 'our-work', 'about', 'contact', 'get-quote', 'quote-list', 'thanks', 'areas', 'terms-of-use', 'privacy-policy', 'copyright-policy', 'hyperlinking-policy', 'disclaimer', 'refund-and-cancellation', 'accessibility-statement', 'grievance', 'help', 'sitemap', 'guides', 'catalogue', 'blog', 'wishlist', 'pay']) fs.rmSync(path.join(ROOT, f), { recursive: true, force: true });

const routes = VI.routes(D);
for (const r of routes) {
  const [route, view, ...args] = r;
  const dir = path.join(ROOT, route);
  if (KEEP.has(route.split('/')[1])) throw new Error('route clashes with a source folder: ' + route);
  for (const lang of ['en', 'hi', 'mr']) {
    const d = path.join(ROOT, lang === 'en' ? '' : lang, route);
    fs.mkdirSync(d, { recursive: true });
    fs.writeFileSync(path.join(d, 'index.html'), hideMail(tidy(page(route, view, args, lang))));
  }
}
/* structure sketches: one SVG picture per catalogue design (shown as the 2nd image after the photo) */
for (const c of D.CATALOGUE) for (const [f, doc] of [['structure.svg', VS.docOf(c)], ['structure-card.svg', VS.docOf(c, 1)]]) fs.writeFileSync(path.join(ROOT, 'catalogue', c.slug, f), '<?xml version="1.0" encoding="UTF-8"?>\n' + VS.svg(doc, { label: 'Structure sketch of ' + c.name + ' with sizes' }).replace(/font-family="[^"]*"/, 'font-family="Segoe UI, Roboto, Helvetica, Arial, sans-serif"') + '\n');
fs.writeFileSync(path.join(ROOT, '404.html'), hideMail(tidy(page('/404/', 'notfound', [], 'en'))));

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

// payment page (/pay/?am=12000&n=PR-2026-001&f=Advance): QR code + "open UPI app" for the business UPI ID only (Admin → Payment requests).
// The UPI ID is fixed here at build time, so a link can never be made to show someone else's UPI ID.
{
  const P = S.payment || {}, upi = /^[\w.\-]{2,256}@[a-zA-Z][\w.\-]{1,64}$/.test(String(P.upi || '').trim()) ? String(P.upi).trim() : '', payee = String(P.name || (S.letterhead || {}).title || S.name).trim();
  const phone = String(S.phone || '').replace(/\D/g, '').slice(-10), wa = String(S.whatsapp || '91' + phone).replace(/\D/g, '');
  fs.mkdirSync(path.join(ROOT, 'pay'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'pay', 'index.html'), `<!DOCTYPE html>
<html lang="en-IN">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<meta name="robots" content="noindex,nofollow"/>
<meta name="referrer" content="no-referrer"/>
<meta name="theme-color" content="#1F2A22"/>
<title>Pay ${esc(S.name)} by UPI</title>
<link rel="icon" href="/favicon.ico" sizes="any"/>
<link rel="preload" href="/assets/fonts/bricolage-grotesque-latin-wght-normal.woff2" as="font" type="font/woff2" crossorigin/>
<style>
@font-face{font-family:'Bricolage Grotesque';src:url(/assets/fonts/bricolage-grotesque-latin-wght-normal.woff2) format('woff2');font-weight:200 800;font-display:swap}
@font-face{font-family:'Figtree';src:url(/assets/fonts/figtree-latin-wght-normal.woff2) format('woff2');font-weight:300 900;font-display:swap}
:root{--bg:#F2F3EE;--ink:#1F2A22;--muted:#56635A;--line:#DCE0D6;--forest:#2F4A3A;--tape:#E9C46A;--green:#1F8F4E}
*{box-sizing:border-box}body{margin:0;min-height:100vh;background:var(--bg);color:var(--ink);font:400 1rem/1.55 'Figtree',system-ui,-apple-system,'Segoe UI',sans-serif;display:flex;flex-direction:column;align-items:center;padding:1.2rem 1rem 2rem}
.top{display:flex;align-items:center;gap:.7rem;text-decoration:none;color:var(--ink);margin:.4rem 0 1.2rem}.top img{width:44px;height:44px;border-radius:10px}.top b{font:800 1.25rem 'Bricolage Grotesque',sans-serif}.top small{display:block;color:var(--muted);font-size:.8rem}
main{width:100%;max-width:440px;background:#fff;border:1px solid var(--line);border-radius:20px;overflow:hidden;box-shadow:0 18px 40px -24px rgba(0,0,0,.35)}
.head{background:linear-gradient(135deg,#1F2A22,#2F4A3A);color:#fff;padding:1.3rem 1.4rem 1.2rem;position:relative}
.head::after{content:"";position:absolute;left:0;right:0;bottom:0;height:6px;background:repeating-linear-gradient(90deg,rgba(0,0,0,.35) 0 1px,transparent 1px 7px) bottom/100% 4px no-repeat,var(--tape)}
.k{color:var(--tape);font-weight:700;font-size:.82rem;letter-spacing:.06em;text-transform:uppercase}
.amt{font:800 2.6rem/1.1 'Bricolage Grotesque',sans-serif;margin:.35rem 0 .2rem;font-variant-numeric:tabular-nums}
.to{color:#D7E1D9;font-size:.95rem}.for{margin-top:.35rem;font-size:.9rem;color:#fff;opacity:.9}
.body{padding:1.3rem 1.4rem 1.4rem;text-align:center}
.btn{display:flex;align-items:center;justify-content:center;gap:.5rem;width:100%;min-height:54px;border-radius:14px;border:0;font:700 1.05rem 'Figtree',sans-serif;text-decoration:none;cursor:pointer}
.pay{background:var(--green);color:#fff;box-shadow:0 10px 20px -12px rgba(31,143,78,.8)}.pay:active{transform:translateY(1px)}
.alt{background:#fff;color:var(--ink);border:1.5px solid var(--line);margin-top:.6rem}
.or{display:flex;align-items:center;gap:.8rem;color:var(--muted);font-size:.85rem;margin:1.1rem 0}.or::before,.or::after{content:"";flex:1;height:1px;background:var(--line)}
.qr{display:inline-block;padding:10px;border:1px solid var(--line);border-radius:16px;background:#fff}.qr img{display:block;width:216px;height:216px;image-rendering:pixelated}
.upi{margin:.8rem 0 .2rem;font-size:.95rem}.upi b{background:#F7F3E6;border:1px dashed #D9B655;border-radius:8px;padding:.2rem .5rem;font-variant-numeric:tabular-nums}
.apps{color:var(--muted);font-size:.85rem;margin:.6rem 0 0}
.after{border-top:1px solid var(--line);margin-top:1.2rem;padding-top:1rem;font-size:.9rem;color:var(--muted)}
.wa{background:#fff;color:var(--green);border:1.5px solid #BFDCC9;margin-top:.6rem}
.set{display:grid;gap:.5rem;text-align:left;margin:0 0 1rem}[hidden]{display:none!important}.set label{font-weight:700;font-size:.9rem}.set input{font:700 1.4rem 'Figtree',sans-serif;padding:.6rem .8rem;border:1.5px solid var(--line);border-radius:12px;width:100%}
.note{font-size:.8rem;color:var(--muted);margin-top:1rem;text-align:center;max-width:440px}
.desk #payBox>.pay{display:none}.desk .or{display:none}
.rej{background:#FBE3E0;border-bottom:1px solid #F1C4BE;color:#8A2A1E;padding:.9rem 1.4rem;display:grid;gap:.15rem}.rej b{font-size:1rem}.rej small{color:#8A2A1E;opacity:.85}
.after{text-align:center}.ah{display:block;color:var(--ink);font-size:1rem;margin-bottom:.2rem}
.up{background:var(--forest);color:#fff;margin-top:.7rem}
.pf{text-align:left;display:grid;gap:.4rem;margin-top:.9rem}.pf label{font-weight:700;font-size:.9rem}.pf label small{font-weight:400;color:var(--muted)}
.pf input:not([type=file]){font:500 1rem 'Figtree',sans-serif;padding:.65rem .8rem;border:1.5px solid var(--line);border-radius:12px;width:100%}
.drop{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:.5rem;border:2px dashed #C9CFC3;border-radius:14px;padding:1rem;cursor:pointer;background:#FAFBF8;min-height:90px;font-weight:700!important;color:var(--forest)}
.drop img{max-width:100%;max-height:240px;border-radius:8px}
.pfErr{color:#A33A2B;font-size:.9rem;margin:.2rem 0 0;min-height:0}.pfErr:empty{display:none}
.hp{position:absolute;left:-9999px;width:1px;height:1px;opacity:0}
.timer{font:800 2.4rem/1 'Bricolage Grotesque',sans-serif;font-variant-numeric:tabular-nums;letter-spacing:.04em;color:var(--forest);margin:.2rem 0 1rem}
.clock{background:#FBF1DC;color:#7A5410}.small{font-size:.85rem;color:var(--muted);margin:0 0 1rem}
#rev .btn+.btn{margin-top:.6rem}
.done{padding:1.6rem 1.4rem}.done h1{font:800 1.5rem 'Bricolage Grotesque',sans-serif;margin:.4rem 0 .4rem}.done p{color:var(--muted);margin:0 0 1.2rem}.tick{width:64px;height:64px;border-radius:50%;background:#E8F3EC;color:var(--green);font:800 2rem/64px sans-serif;margin:0 auto}
@media (prefers-color-scheme:dark){:root{--bg:#0F1511}.top{color:#E6ECE6}.top small,.note{color:#A5B3A8}}
</style>
</head>
<body>
<a class="top" href="/"><img src="/assets/logo-96.png" alt=""/><span><b>${esc(S.name)}</b><small>Interiors &amp; custom furniture</small></span></a>
<main id="m">${upi ? `
<div class="head"><div class="k">Payment request <span id="no"></span></div><div class="amt" id="amt">Enter amount</div><div class="to">to <b>${esc(payee)}</b></div><div class="for" id="for" hidden></div></div>
<div class="rej" id="rej" hidden><b>Payment not confirmed</b><span id="rejWhy"></span><small>Please check and pay again, or upload the correct screenshot below.</small></div>
<div class="body" id="payBox">
<div class="set" id="set" hidden><label for="am">Amount to pay (₹)</label><input id="am" type="number" min="1" step="1" inputmode="numeric" placeholder="e.g. 10000"/></div>
<a class="btn pay" id="pay" href="#">Pay with a UPI app</a>
<div class="or">or scan with any UPI app</div>
<div class="qr"><img id="qr" alt="UPI QR code to pay ${esc(payee)}"/></div>
<p class="upi">UPI ID: <b id="vpa">${esc(upi)}</b></p>
<button class="btn alt" id="copy" type="button">Copy UPI ID</button>
<p class="apps">Google Pay · PhonePe · Paytm · BHIM · any bank UPI app</p>
<div class="after" id="after"><b class="ah">Already paid?</b> Upload the payment screenshot so we can confirm it.
<form id="pf" class="pf" hidden novalidate>
<label class="drop" for="pfImg" id="pfDrop"><span id="pfTxt">📷 Choose the payment screenshot</span><img id="pfPrev" alt="" hidden/></label><input id="pfImg" type="file" accept="image/*" hidden/>
<label for="pfUtr">UTR / UPI reference number <small>(optional, 12 digits in your UPI app)</small></label><input id="pfUtr" inputmode="numeric" maxlength="30" autocomplete="off" placeholder="e.g. 431245678901"/>
<label for="pfName">Your name <small>(optional)</small></label><input id="pfName" maxlength="60" autocomplete="name"/>
<input class="hp" name="_honey" id="pfHoney" tabindex="-1" autocomplete="off" aria-hidden="true"/>
<p class="pfErr" id="pfErr" role="alert"></p>
<button class="btn pay" id="pfBtn" type="submit">Send screenshot</button></form>
<button class="btn up" id="pfOpen" type="button">Upload payment screenshot</button>
<a class="btn wa" id="wa" href="https://wa.me/${wa}" target="_blank" rel="noopener">Or send it on WhatsApp</a></div>
</div>
<div class="body done" id="rev" hidden><div class="tick clock">⏱</div><h1>Payment under review</h1><p id="revTxt">We are checking your payment. You will get a confirmation within</p><div class="timer" id="timer" aria-live="off">24:00:00</div><p class="small" id="revMeta"></p><button class="btn alt" id="again" type="button">Upload a different screenshot</button><a class="btn wa" href="https://wa.me/${wa}" target="_blank" rel="noopener">WhatsApp us</a></div>` : `<div class="body"><h1 style="font:800 1.4rem 'Bricolage Grotesque',sans-serif">Online payment is not set up yet</h1><p>Please call or WhatsApp us on <a href="tel:+91${phone}">+91 ${esc(S.phone)}</a> for payment details.</p></div>`}
</main>
<p class="note">This page always pays <b>${esc(payee || S.name)}</b>${upi ? ` (UPI ID ${esc(upi)})` : ''}. Check the name in your UPI app before you pay.</p>
${upi ? `<script src="/assets/vendor/qrcode.js"></script>
<script>
(function(){var Q=new URLSearchParams(location.search),VPA=${JSON.stringify(upi)},PN=${JSON.stringify(payee.slice(0, 40))},no=(Q.get('n')||'').replace(/[^\\w\\-\\/]/g,'').slice(0,30),fr=(Q.get('f')||'').replace(/[^\\w .,\\-\\/&()]/g,'').slice(0,60),am=parseFloat(Q.get('am')),$=function(i){return document.getElementById(i)},API=null,TICK=0;
var mob=/Android|iPhone|iPad|iPod/i.test(navigator.userAgent);if(!mob)document.body.classList.add('desk');
if(no)$('no').textContent='· '+no;if(fr||no){$('for').hidden=false;$('for').textContent=(fr?'For: '+fr:'')+(no?(fr?' · ':'')+'Ref. '+no:'')}
function fmt(n){return '₹'+n.toLocaleString('en-IN',{maximumFractionDigits:2})}
var ok=am>0&&am<=1000000;am=ok?Math.round(am*100)/100:0;
function draw(a){var g=a>0&&a<=1000000,u='upi://pay?pa='+VPA+'&pn='+encodeURIComponent(PN)+(g?'&am='+a.toFixed(2):'')+'&cu=INR'+(no?'&tn='+encodeURIComponent((no+' '+fr).trim().slice(0,50))+'&tr='+encodeURIComponent(no):'');
 $('amt').textContent=g?fmt(a):'Enter amount';$('pay').href=u;$('pay').textContent=g?'Pay '+fmt(a)+' with a UPI app':'Pay with a UPI app';
 var q=qrcode(0,'M');q.addData(u);q.make();$('qr').src=q.createDataURL(8,2);
 $('wa').href='https://wa.me/${wa}?text='+encodeURIComponent('Hi, I have paid '+(g?fmt(a):'')+(no?' for '+no:'')+' to '+VPA+'. Screenshot attached.')}
if(!ok){$('set').hidden=false;$('am').oninput=function(){draw(parseFloat(this.value))}}
draw(am);
$('copy').onclick=function(){var b=this;(navigator.clipboard?navigator.clipboard.writeText(VPA):Promise.reject()).then(function(){b.textContent='Copied ✓';setTimeout(function(){b.textContent='Copy UPI ID'},1800)},function(){prompt('UPI ID',VPA)})};
/* screens */
function done(html){clearInterval(TICK);$('m').innerHTML=html;document.querySelector('.note').hidden=true}
function paid(d){var dd=d?new Date(d+'T00:00:00').toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}):'';done('<div class="head"><div class="k">Payment request · '+no+'</div><div class="amt">'+fmt(am)+'</div><div class="to">Paid to <b>'+PN.replace(/[<>&]/g,'')+'</b></div></div><div class="body done"><div class="tick">✓</div><h1>Payment received</h1><p>Received with thanks'+(dd?' on <b>'+dd+'</b>':'')+'. No need to pay again.</p><div id="rcBox"></div><a class="btn alt" href="/">Visit our website</a></div>');receipt()}
function receipt(){var q='?n='+encodeURIComponent(no)+'&am='+am;api().then(function(a){return fetch(a+'/pay/status'+q).then(function(r){return r.json()}).then(function(s){$('rcBox').innerHTML=s.rc?'<a class="btn pay" href="'+a+'/pay/receipt'+q+'">⬇ Download receipt (PDF)</a>':'<p class="small">Your receipt will be ready here soon. Need it now? <a href="https://wa.me/${wa}?text='+encodeURIComponent('Hi, please send the receipt for '+no)+'">WhatsApp us</a>.</p>'})}).catch(function(){})}
function cancelled(){done('<div class="body done"><h1>This payment request was cancelled</h1><p>Please do not pay using this link. Call or WhatsApp us if you have a question.</p><a class="btn wa" href="https://wa.me/${wa}">WhatsApp us</a></div>')}
function review(st){$('payBox').hidden=true;$('rej').hidden=true;$('rev').hidden=false;
 $('revMeta').textContent='Screenshot sent '+new Date(st.t).toLocaleString('en-IN',{day:'numeric',month:'short',hour:'numeric',minute:'2-digit'})+(st.utr?' · UTR '+st.utr:'');
 var end=st.t+864e5;clearInterval(TICK);(function tick(){var r=end-Date.now();if(r<=0){clearInterval(TICK);$('revTxt').textContent='Sorry, this is taking longer than usual. We will confirm it soon — or WhatsApp us and we will check right away.';$('timer').hidden=true;return}
  var h=Math.floor(r/36e5),m=Math.floor(r%36e5/6e4),s=Math.floor(r%6e4/1e3),z=function(x){return(x<10?'0':'')+x};$('timer').textContent=z(h)+':'+z(m)+':'+z(s)})();TICK=setInterval(function(){var r=end-Date.now();if(r<=0){$('timer').hidden=true;$('revTxt').textContent='Sorry, this is taking longer than usual. We will confirm it soon — or WhatsApp us and we will check right away.';clearInterval(TICK);return}var h=Math.floor(r/36e5),m=Math.floor(r%36e5/6e4),s=Math.floor(r%6e4/1e3),z=function(x){return(x<10?'0':'')+x};$('timer').textContent=z(h)+':'+z(m)+':'+z(s)},1000)}
function rejected(st){$('rej').hidden=false;$('rejWhy').textContent=st.reason||'We could not find this payment in our account.';showForm()}
function showForm(){$('pf').hidden=false;$('pfOpen').hidden=true}
$('pfOpen').onclick=showForm;$('again').onclick=function(){clearInterval(TICK);$('rev').hidden=true;$('payBox').hidden=false;showForm();$('pfImg').click()};
/* screenshot: shrink to a JPEG of at most 1400 px before sending */
var IMG='';$('pfImg').onchange=function(){var f=this.files[0];$('pfErr').textContent='';if(!f)return;if(!/^image\\//.test(f.type)){$('pfErr').textContent='Please choose a photo or screenshot.';return}
 var u=URL.createObjectURL(f),im=new Image();im.onload=function(){var s=Math.min(1,1400/Math.max(im.width,im.height)),c=document.createElement('canvas');c.width=Math.round(im.width*s);c.height=Math.round(im.height*s);var g=c.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,c.width,c.height);g.drawImage(im,0,0,c.width,c.height);IMG=c.toDataURL('image/jpeg',.82);$('pfPrev').src=IMG;$('pfPrev').hidden=false;$('pfTxt').textContent='Change screenshot';URL.revokeObjectURL(u)};im.onerror=function(){$('pfErr').textContent='This picture could not be opened. Try a screenshot (PNG or JPG).'};im.src=u};
$('pf').onsubmit=function(e){e.preventDefault();var err=$('pfErr');err.textContent='';
 if(!no||!(am>0)){err.textContent='This payment link is not complete. Please WhatsApp us the screenshot.';return}
 if(!IMG){err.textContent='Please choose the payment screenshot first.';return}
 var b=$('pfBtn');b.disabled=true;b.textContent='Sending…';
 api().then(function(a){return fetch(a+'/pay/proof',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({n:no,am:am,img:IMG,utr:$('pfUtr').value,name:$('pfName').value,_honey:$('pfHoney').value})})}).then(function(r){return r.json().then(function(j){if(!r.ok)throw new Error(j.message||'Could not send');return j})})
 .then(function(j){review({t:j.t||Date.now(),utr:$('pfUtr').value.replace(/[^\\w\\-]/g,'')});window.scrollTo(0,0)}).catch(function(x){err.textContent=x.message+'. You can also send the screenshot on WhatsApp.'}).then(function(){b.disabled=false;b.textContent='Send screenshot'})};
function api(){return API?Promise.resolve(API):fetch('/data/api.json').then(function(r){return r.json()}).then(function(j){API=j.url;return API})}
/* current status: paid / cancelled (published by the admin) or the screenshot review */
function hk(){return crypto.subtle.digest('SHA-256',new TextEncoder().encode(no+'|'+am.toFixed(2))).then(function(b){return Array.from(new Uint8Array(b)).map(function(x){return x.toString(16).padStart(2,'0')}).join('').slice(0,24)})}
if(no&&am>0&&window.crypto&&crypto.subtle){Promise.all([fetch('/data/payreq.json?t='+Date.now()).then(function(r){return r.ok?r.json():{}}).catch(function(){return{}}),hk()]).then(function(x){var st=x[0][x[1]];if(st&&st.s==='paid')return paid(st.d);if(st&&st.s==='cancelled')return cancelled();
 return api().then(function(a){return fetch(a+'/pay/status?n='+encodeURIComponent(no)+'&am='+am)}).then(function(r){return r.json()}).then(function(s){if(s.s==='paid')paid(s.d);else if(s.s==='review')review(s);else if(s.s==='rejected')rejected(s)})}).catch(function(){})}
})();
</script>` : ''}
</body>
</html>
`);
}

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
const index = routes.filter(r => !['list', 'thanks', 'wish'].includes(r[1]));
const pri = v => ({ guides: '0.7', guide: '0.7', home: '1.0', services: '0.9', service: '0.9', furniture: '0.8', category: '0.7', catalogue: '0.8', catitem: '0.6', area: '0.8', product: '0.6' }[v] || '0.5');
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
Disallow: /pay/

Sitemap: ${S.site_url}/sitemap.xml
`);
console.log('Built', routes.length * 3, 'pages + 404, sitemap.xml, robots.txt');
