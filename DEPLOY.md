# OxyHyperbaric — Deploy & SEO

## Deploy automático (conectado a Git)

Proyecto activo: **oxyhyperbaric-page** (Worker con Git)  
URL: https://oxyhyperbaric-page.yarianc.workers.dev  
Repo: **yariancn/Oxyhyperbaric-page** · branch **main**

Cada `git push` a `main` despliega automáticamente — igual que OXYGENGDL.

### Dominio personalizado

En Cloudflare → proyecto **oxyhyperbaric-page** (el conectado a Git, no el Pages duplicado):
- Agregar custom domain: `oxyhyperbaric.com` y `www.oxyhyperbaric.com`

### Proyecto Pages duplicado (ignorar)

`oxyhyperbaric-page.pages.dev` fue creado con `deploy.sh` (upload manual) y **no tiene Git**.
No usarlo. Opcional: borrarlo en Cloudflare para evitar confusión.

### Deploy manual (solo emergencia)

```bash
bash deploy.sh
```

## Staging first (recommended)

1. Revisar en https://oxyhyperbaric-page.yarianc.workers.dev
2. Review EN (`/`) and ES (`/es/`)
3. Test booking: https://oxy-agenda.vercel.app/booking/us
4. When approved → point DNS from Durable to Cloudflare

## DNS cutover from Durable

1. Cloudflare → add domain `oxyhyperbaric.com` (or move DNS to Cloudflare)
2. Pages → Custom domains → attach domain
3. Redirect `www` → root
4. Cancel Durable subscription after Google indexes new site

## Google Search Console

1. Add property: `https://oxyhyperbaric.com`
2. Verify via DNS TXT record
3. Submit sitemap: `sitemap.xml`
4. Request indexing for `/` and `/es/`

## Google Business Profile

- Update website URL to `https://oxyhyperbaric.com`
- Confirm NAP: 256 Ed English Dr Bldg 4 Ste E, Shenandoah TX 77384
- Phone: (713) 591-3379

## Technical checklist (included)

- [x] Canonical URLs + hreflang EN/ES
- [x] Schema.org (business, offers, FAQ)
- [x] `llms.txt` EN + ES for AI crawlers
- [x] Valid XML sitemap
- [x] Booking integrated → OXY Agenda `/booking/us`
- [x] Reviews from current site
- [x] Wellness disclaimer + Medical Director Dr. James Hill
- [ ] Facility photos from Durable CDN → run `./download-images.sh`
- [ ] Search Console verified
- [ ] DNS migrated from Durable

## Images

Brand assets are in `assets/images/`. To pull remaining facility photos from the old Durable site:

```bash
chmod +x download-images.sh
./download-images.sh
```
