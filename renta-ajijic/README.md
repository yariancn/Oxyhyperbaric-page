# Predictacore · Rentas Ajijic

Buscador web de casas en renta en **Ajijic, Jalisco** (~$20,000 MXN), con resumen y fotos.  
**Independiente de OxyHyperbaric** — branding y hosting Predictacore.

## URL (iPad / Safari)

Tras el deploy del Worker standalone:

```text
https://predictacore-renta-ajijic.<cuenta>.workers.dev/
```

Abre el link → ves resultados con **2 fotos**, precio, resumen y botón al anuncio. No instalas nada.

## Deploy (solo este mini-sitio)

```bash
cd renta-ajijic
mkdir -p web-dist && cp index.html web-dist/index.html
npx wrangler@4 deploy --config wrangler.web.toml
```

No modifica el Worker de OxyHyperbaric.

## Qué busca

- Scrapers: Ajijic Trinity, Casas y Terrenos (con fotos)
- Búsqueda web: Inmuebles24, Propiedades, Vivanuncios, Lamudi, Mercado Libre, Trovit, etc.
- Filtro ~$15k–$28k, zona media-alta / fraccionamiento privado

## CLI opcional (Python)

```bash
python3 -m pip install -r requirements.txt
python3 buscar.py --solo-casas --min 15000 --max 28000
```
