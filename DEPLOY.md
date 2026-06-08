# OxyHyperbaric — Deploy & SEO

## Deploy automático (GitHub Actions)

Cada push a `main` dispara `.github/workflows/deploy.yml` → Cloudflare Pages.

### Configurar secrets (una sola vez)

1. Crear API token en Cloudflare:
   - https://dash.cloudflare.com/profile/api-tokens
   - **Create Token** → template **Edit Cloudflare Workers** (incluye Pages)
   - O custom: permiso **Account → Cloudflare Pages → Edit**
2. En GitHub: repo **Oxyhyperbaric-page** → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**
   - `CLOUDFLARE_API_TOKEN` → el token creado
   - `CLOUDFLARE_ACCOUNT_ID` → `a0d6591fc135a7069b2487a1f5fd5aa7`
3. Verificar en **Actions** que el workflow **Deploy to Cloudflare Pages** quede en verde.

Ya no hace falta correr `bash deploy.sh` manualmente.

## Cloudflare Pages (manual, opcional)

Proyecto: **oxyhyperbaric-page** → https://oxyhyperbaric-page.pages.dev

Custom domains pendientes: `oxyhyperbaric.com` y `www.oxyhyperbaric.com`

## Staging first (recommended)

1. Deploy to `oxyhyperbaric.pages.dev`
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
