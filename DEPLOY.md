# OxyHyperbaric — Deploy & SEO

## Deploy automático (conectado a Git)

Proyecto activo: **oxyhyperbaric-page** (Worker con Git)  
URL staging: https://oxyhyperbaric-page.yarianc.workers.dev  
Repo: **yariancn/Oxyhyperbaric-page** · branch **main**

Cada `git push` a `main` despliega automáticamente — igual que OXYGENGDL.

### Proyecto Pages duplicado (ignorar)

`oxyhyperbaric-page.pages.dev` fue creado con `deploy.sh` (upload manual) y **no tiene Git**.
No usarlo. Opcional: borrarlo en Cloudflare para evitar confusión.

---

## Migrar dominio: Namecheap (Canva) → Cloudflare

Mismo proceso que **oxygengdl.com**. Hoy el dominio está en **Namecheap** y apunta a **Canva**. El objetivo es que `oxyhyperbaric.com` y `www.oxyhyperbaric.com` sirvan el sitio en Cloudflare.

### Resumen del flujo

| Paso | Dónde | Qué haces |
|------|--------|-----------|
| 1 | Cloudflare | Agregar el dominio `oxyhyperbaric.com` |
| 2 | Namecheap | Cambiar nameservers a los de Cloudflare |
| 3 | Cloudflare | Conectar dominio al proyecto **oxyhyperbaric-page** |
| 4 | Cloudflare | Redirigir `www` → raíz |
| 5 | Canva | Desconectar el dominio personalizado |
| 6 | Google | Search Console + actualizar Google Business |

---

### Paso 1 — Agregar dominio en Cloudflare

1. Entra a https://dash.cloudflare.com
2. Clic en **Add a site** (o **Add domain**)
3. Escribe: `oxyhyperbaric.com`
4. Plan: **Free**
5. Cloudflare escaneará los registros DNS actuales (verás los de Canva)
6. **No actives** proxy en registros viejos de Canva — los borrarás después
7. Cloudflare te mostrará **2 nameservers**, por ejemplo:
   ```
   ada.ns.cloudflare.com
   bob.ns.cloudflare.com
   ```
   (Los tuyos pueden ser distintos — copia los que te dé tu cuenta.)

---

### Paso 2 — Cambiar nameservers en Namecheap

1. https://www.namecheap.com → **Domain List** → **oxyhyperbaric.com** → **Manage**
2. Sección **Nameservers** → **Custom DNS**
3. Pega los 2 nameservers de Cloudflare (Paso 1)
4. Guardar
5. Espera propagación: suele ser **15 min – 4 h** (máx. 24–48 h)
6. En Cloudflare el dominio debe pasar a **Active** (check verde)

> **Importante:** Mientras propagan los NS, el sitio puede seguir mostrando Canva unas horas. Es normal.

---

### Paso 3 — Conectar dominio al proyecto (solo Dashboard, sin Wrangler)

Igual que OXYGENGDL: todo desde https://dash.cloudflare.com — **no** hace falta terminal ni Wrangler.

1. Menú lateral → **Workers & Pages**
2. Abre **oxyhyperbaric-page** (conectado a GitHub `yariancn/Oxyhyperbaric-page`)
3. Pestaña **Settings** → **Domains & Routes** → **Add custom domain**
4. Agrega: `oxyhyperbaric.com` y luego `www.oxyhyperbaric.com`
5. Cloudflare creará los registros DNS del sitio nuevo automáticamente

### Paso 3b — Limpiar DNS (pantalla que tienes abierta: DNS → Records)

**Tu DNS hoy (11 registros) — qué tocar:**

| Registro | Acción |
|----------|--------|
| **A** `oxyhyperbaric.com` → `162.255.119.122` (Proxied) | **BORRAR** — apunta al hosting viejo (Durable) |
| **A** `oxyhyperbaric.com` → `172.66.0.42` (Proxied) | **BORRAR** — conflicto con el sitio viejo |
| **CNAME** `_acme-challenge` | Dejar (certificados SSL) |
| **CNAME** `autoconfig` / `autodiscover` / `mail` → `privateemail.com` | **NO BORRAR** — correo Namecheap |
| **MX** → `mx1` / `mx2.privateemail.com` | **NO BORRAR** — correo |
| **SRV** `_autodiscover._tcp` | **NO BORRAR** — correo |
| **TXT** SPF y DKIM (`default._domainkey`) | **NO BORRAR** — correo |

Después de agregar el custom domain en el Paso 3, en DNS deberías ver **nuevos** registros hacia `oxyhyperbaric-page` (Workers). Solo entonces borra los dos **A** viejos.

**No borres nada de email** (`privateemail.com`, MX, TXT).

---

### Paso 4 — Redirigir www → raíz

**Estado verificado (2026-06-10):** `https://www.oxyhyperbaric.com/` ya responde **308** → `https://oxyhyperbaric.com/`. No hace falta crear otra regla si sigue así.

Respaldo en el repo (`_redirects`):

```
https://www.oxyhyperbaric.com/* https://oxyhyperbaric.com/:splat 301
```

Si en el futuro dejara de redirigir, crea en Cloudflare → **Rules** → **Redirect Rules**:
- Hostname equals `www.oxyhyperbaric.com`
- Redirect 301 → `https://oxyhyperbaric.com/${uri.path}${uri.query}`

---

### Paso 5 — Desconectar Canva

1. En **Canva** → tu sitio web → **Configuración de dominio** / **Domain settings**
2. **Desconectar** o **Remove** `oxyhyperbaric.com` y `www.oxyhyperbaric.com`
3. Opcional: cancelar plan de sitio web Canva si ya no lo usas

Si no desconectas Canva, puede haber conflicto o confusión aunque el DNS ya apunte a Cloudflare.

---

### Paso 6 — Verificar que funciona

**Cómo saber que el cutover está bien:** `https://oxyhyperbaric.com/` debe mostrar el sitio **nuevo** (reseñas James Bittick / Sara Campus / Ken McCleary), **no** el de Durable (Emily Carter / Next.js).

Abre en incógnito:

- [ ] https://oxyhyperbaric.com/ → sitio nuevo Cloudflare
- [ ] https://oxyhyperbaric.com/es/
- [x] https://www.oxyhyperbaric.com/ → redirige a raíz (308, verificado)
- [ ] https://oxyhyperbaric.com/sitemap.xml → XML válido
- [ ] https://oxyhyperbaric.com/llms.txt → texto plano
- [ ] Booking: https://oxy-agenda.vercel.app/booking/us

Staging (referencia del sitio correcto): https://oxyhyperbaric-page.yarianc.workers.dev

---

## Google Search Console (después del cutover)

1. https://search.google.com/search-console
2. Agregar propiedad: `https://oxyhyperbaric.com`
3. Verificar por **registro DNS TXT** en Cloudflare (mismo método que OXYGENGDL):
   - DNS → Add record → TXT → Name `@` → Content `google-site-verification=...`
4. **Sitemaps** → enviar: `sitemap.xml`
5. **Inspección de URLs** → `https://oxyhyperbaric.com/` → **Solicitar indexación**
6. Repetir para `https://oxyhyperbaric.com/es/`

### Si el sitemap falla en Search Console

- Security → **Bot Fight Mode** → Off (o regla WAF: permitir `Googlebot`)
- Reenviar `sitemap.xml` tras 5 minutos

---

## Google Business Profile

1. https://business.google.com → **OXYHYPERBARIC**
2. Sitio web → `https://oxyhyperbaric.com`
3. Confirmar NAP: 256 Ed English Dr Bldg 4 Ste E, Shenandoah TX 77384
4. Teléfono: (713) 591-3379

---

## Apagar sitios viejos (esta semana)

| Origen viejo | Acción |
|--------------|--------|
| Canva (`oxyhyperbaric.com`) | Desconectar dominio ✓ (Paso 5) |
| Durable (`oxyhyperbaric.com` builder) | Cancelar suscripción cuando Google indexe el sitio nuevo |
| `oxyhyperbaric-page.pages.dev` (duplicado) | Ignorar o borrar en Cloudflare |

Comprobar en Google: `site:oxyhyperbaric.com` — debe mostrar solo el sitio Cloudflare.

---

## Checklist técnico del sitio

- [x] Canonical URLs + hreflang EN/ES
- [x] Schema.org (business, offers, FAQ)
- [x] `llms.txt` EN + ES
- [x] `sitemap.xml` + `robots.txt`
- [x] Booking → OXY Agenda `/booking/us`
- [x] Google Reviews (5.0 + reseñas reales + link a Maps)
- [x] Wellness disclaimer + Dr. James Hill
- [x] Dominio en Cloudflare (NS activos; tráfico pasa por Cloudflare)
- [ ] Custom domain `oxyhyperbaric.com` en **oxyhyperbaric-page** ← **pendiente (hoy apunta a Durable)**
- [x] Redirect www → raíz (308 verificado)
- [ ] Canva desconectado ← **pendiente**
- [ ] Search Console verificado ← **pendiente**
- [ ] GBP con URL nueva ← **pendiente**

---

## Deploy

Solo **git push** a `main` — Cloudflare despliega solo (como OXYGENGDL). No uses Wrangler ni `deploy.sh` salvo emergencia.

## Imágenes adicionales desde Durable

```bash
chmod +x download-images.sh
./download-images.sh
```

## Sync reseñas Google (opcional, requiere API key)

```bash
export GOOGLE_PLACES_API_KEY="AIzaSy..."
python3 scripts/sync-google-reviews.py
```
