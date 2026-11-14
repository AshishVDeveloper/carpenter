# Vishwakarma Interior — website & admin panel

Home, office, shop, showroom and mall interiors, plus a furniture shop — on contract basis or labour basis.
Mumbai · Thane · Navi Mumbai · Uttar Pradesh.

**Live site:** https://ashishvdeveloper.github.io/carpenter/
**Admin panel:** https://ashishvdeveloper.github.io/carpenter/admin.html

## What's inside

| Path | What it is |
|---|---|
| `index.html`, `assets/store.js`, `assets/store.css` | The public website: services, our work, furniture shop with cart, quote form, contact |
| `admin.html` | Admin panel: business details, services, locations, project sites, products & photos, categories, reviews, orders, password |
| `data/*.json` | All website content. The admin panel edits these files |
| `images/products/`, `images/work/` | Product and project photos uploaded from the admin panel |

## How orders work

There is no server. Cart orders, quote requests and contact messages open **WhatsApp** with all details filled in,
and a copy is emailed through FormSubmit (click the one-time *Activate* email the first time).

## Publishing from the admin panel

Admin → **Publishing** → paste a GitHub fine-grained token with *Contents: Read and write* on this repository.
After that, every **Publish** button and photo upload updates the live site in about a minute.

Hosted free on GitHub Pages.
