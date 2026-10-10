# Buscador de rentas en Ajijic

## URL web (iPad / celular / cualquier navegador)

Después del deploy a Cloudflare:

- **Producción:** https://oxyhyperbaric.com/renta-ajijic/
- **Staging Worker:** https://oxyhyperbaric-page.yarianc.workers.dev/renta-ajijic/

Abre el enlace, toca **Buscar rentas** (o espera: carga sola) y verás resultados con resumen y link al anuncio. No necesitas instalar nada en el iPad.

También hay un CLI en Python (abajo) para uso local.

---

Programa en Python que busca casas en renta en **Ajijic, Jalisco** cerca de **$20,000 MXN**, las ordena por afinidad con zona **media-alta** y **fraccionamiento privado**, y genera un **resumen** de cada anuncio.

## Qué hace

1. Recolecta anuncios de **varias plataformas** (no solo una):
   - Scrapers directos: Ajijic Trinity, Casas y Terrenos
   - Búsqueda web multi-portal: Inmuebles24, Propiedades.com, Vivanuncios, Lamudi, Mercado Libre, Trovit, Mitula, Nestoria, Doorvel, FazWaz, EasyBroker/iCasas
   - Al final del reporte imprime enlaces de búsqueda en cada portal (varios bloquean scrapers)
2. Filtra por presupuesto (default $15,000–$25,000 MXN).
3. Puntúa zona media-alta (`La Floresta`, `Villa Nova`, `Rancho del Oro`, `Lago Encantado`, etc.) y señales de coto/privada/seguridad.
4. Resume cada opción en español: precio, recámaras, zona, si parece fraccionamiento privado y puntos clave.

## Instalación

```bash
cd renta-ajijic
python3 -m pip install -r requirements.txt
```

## Uso

```bash
python3 buscar.py
```

Solo casas (sin departamentos), presupuesto un poco más amplio y salida a archivos:

```bash
python3 buscar.py --solo-casas --min 15000 --max 28000 \
  --out reporte.txt --json resultados.json
```

### Opciones útiles

| Opción | Descripción |
|---|---|
| `--objetivo 20000` | Precio ideal en MXN |
| `--min` / `--max` | Rango de precio |
| `--solo-casas` | Excluye departamentos/habitaciones |
| `--usd-mxn 18` | Conversión para anuncios en USD |
| `--sin-enriquecer` | Más rápido; no abre fichas de detalle |
| `--out` / `--json` | Guarda reporte o JSON |

## Notas

- La oferta en Ajijic cerca de $20,000 MXN varía mucho; si hay pocos resultados, amplía `--max`.
- Varios portales grandes bloquean scrapers; el programa combina una fuente local scrapable con búsqueda web.
- Los scores son heurísticos (texto del anuncio), no una valuación inmobiliaria formal.
