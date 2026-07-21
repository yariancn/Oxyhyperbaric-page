# OxyHyperbaric — Deploy & SEO

## Deploy automático

Proyecto activo: **oxyhyperbaric-page** (Cloudflare Worker)  
URL staging: https://oxyhyperbaric-page.yarianc.workers.dev  
Dominio: `oxyhyperbaric.com` y `www.oxyhyperbaric.com`  
Repo: **yariancn/Oxyhyperbaric-page** · branch **main**

Cada `git push` a `main` dispara **GitHub Actions** (`.github/workflows/deploy.yml`) que ejecuta `npx wrangler deploy`.

### Secretos requeridos en GitHub (una sola vez)

En https://github.com/yariancn/Oxyhyperbaric-page/settings/secrets/actions:

| Secreto | Valor |
|---------|-------|
| `CLOUDFLARE_API_TOKEN` | Token de API con permiso **Workers Scripts → Edit** ([crear aquí](https://dash.cloudflare.com/profile/api-tokens)) |

### Proyecto Pages duplicado (eliminado)

El proyecto Pages `oxyhyperbaric-page` (creado con `deploy.sh`, sin Git) fue **eliminado** el 2 jul 2026. Solo queda el Worker con el dominio.

### Deploy manual (solo emergencia)

```bash
npx wrangler deploy
```

### Funnel Meta Ads — `/hyperbaric/`

Landing de captación (como InfraBaldan): https://oxyhyperbaric.com/hyperbaric/

Flujo: el visitante llena nombre, teléfono, email y objetivo → `POST /api/funnel-lead` → notificación al equipo → botón para elegir hora en oxy-agenda.

**Meta Pixel (`1934798400510737`):** `assets/js/meta-pixel.js` se carga en el `<head>` de todas las páginas HTML (PageView + ViewContent en `/hyperbaric/` e `/infrabaldan/`). El form dispara `Lead` vía `funnel-booking-embed.js`. Booking en oxy-agenda dispara `PageView` + `Schedule` al confirmar.

**Variables del Worker** (Cloudflare Dashboard → Workers → oxyhyperbaric-page → Settings → Variables):

| Variable | Tipo | Para qué |
|----------|------|----------|
| `LEAD_WEBHOOK_URL` | Secret | URL POST (Zapier, Make, Slack, Discord) — recibe JSON del lead |
| `RESEND_API_KEY` | Secret | Email vía [Resend](https://resend.com) |
| `LEAD_NOTIFY_TO` | Plain | Emails destino separados por coma (default: `hello@oxyhyperbaric.com`) |
| `TELEGRAM_BOT_TOKEN` | Secret | Bot de Telegram para alertas instantáneas |
| `TELEGRAM_CHAT_ID` | Plain | Chat ID donde llegan los leads |
| `TWILIO_ACCOUNT_SID` | Secret | Misma cuenta Twilio que oxy-agenda (Shenandoah) |
| `TWILIO_AUTH_TOKEN` | Secret | Token de Twilio |
| `TWILIO_PHONE_NUMBER` | Plain | Número remitente Twilio (+1...) — copiar de Vercel oxy-agenda-gdl |
| `TWILIO_MESSAGING_SERVICE_SID` | Plain | Opcional: Messaging Service A2P (MG...) si no usas número directo |
| `LEAD_NOTIFY_SMS_TO` | Plain | Celular(es) del equipo en E.164, separados por coma (default: `+17135913379`) |
| `FUNNEL_LEAD_SECRET` | Secret | Token compartido con oxy-agenda (SMS) **y** Predictacore Ads (guardar leads en el panel) |
| `OXY_AGENDA_FUNNEL_NOTIFY_URL` | Plain | Opcional; default `https://oxy-agenda.vercel.app/api/public/funnel-lead-notify` |
| `PREDICTACORE_OXY_LEADS_URL` | Plain | Opcional; default `https://predictacore.ai/ads/api/oxy/funnel-leads` |
| `OXY_LEADS_SECRET` | Secret | Opcional; alias del secret para Predictacore (si no, usa `FUNNEL_LEAD_SECRET`) |

Configura **al menos uno** (webhook, Resend, Telegram, Twilio directo, o **FUNNEL_LEAD_SECRET** con oxy-agenda). Sin variables, el lead se registra en logs del Worker pero no llega notificación.

**Persistencia en Predictacore Ads (reporte de leads):** con `FUNNEL_LEAD_SECRET` (o `OXY_LEADS_SECRET`) el Worker guarda cada lead de `/hyperbaric/` e `/infrabaldan/` en `oxy_funnel_leads`. Se ven en el panel del cliente Oxy → sección de leads del funnel.

En Railway (Predictacore Ads) define el **mismo** valor:

- `FUNNEL_LEAD_SECRET` o `OXY_LEADS_SECRET`
- `DATABASE_URL` (Neon) ya debe existir

**SMS vía oxy-agenda + Twilio (recomendado):** reutiliza la cuenta Twilio ya configurada en oxy-agenda. El Worker llama a `/api/public/funnel-lead-notify` y oxy-agenda envía el SMS a los teléfonos de alerta staff (`staff_alert_phones` en Admin) o a `+17135913379` como respaldo.

1. En Vercel → **oxy-agenda-gdl** → Environment Variables → `FUNNEL_LEAD_SECRET` (mismo valor en ambos lados)
2. En Cloudflare Worker → `FUNNEL_LEAD_SECRET` (secret)
3. En Railway → **predictacore-ads** → el mismo `FUNNEL_LEAD_SECRET` (o `OXY_LEADS_SECRET`)
4. Redeploy oxy-agenda, Predictacore Ads y el Worker

Al enviar el formulario en `/hyperbaric/`, recibes un SMS con nombre, teléfono, email y objetivo. El mensaje indica que **aún no reservó en línea** — si completan la cita en oxy-agenda, recibirás la alerta de cita nueva por separado (Admin → alertas staff).

**Emails al visitante (automáticos):**

| Momento | Qué recibe |
|---------|------------|
| Al dar nombre / teléfono / email | Email de gracias + botón **Pick your time** (desde `inf@oxyhyperbaric.com` vía oxy-agenda / Resend) |
| Si sale sin agendar (beacon) o ~20 min después (cron) | Email nudge **Finish booking** + SMS al staff |

No hace falta `RESEND_API_KEY` en el Worker para el correo al visitante: usa el Resend ya configurado en **oxy-agenda** (`FUNNEL_LEAD_SECRET` + endpoint `/api/public/funnel-visitor-email`).

`RESEND_API_KEY` en el Worker sigue siendo opcional solo para **alertas por email al equipo** (`LEAD_NOTIFY_TO`).

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

Solo **git push** a `main` — GitHub Actions despliega al Worker automáticamente. Emergencia: `npx wrangler deploy`.

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
