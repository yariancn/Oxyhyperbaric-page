"""Enlaces de búsqueda directa en portales inmobiliarios (aunque el scraper no pueda leerlos)."""

from __future__ import annotations

from urllib.parse import quote


def portal_search_links(*, min_price: int, max_price: int) -> list[tuple[str, str]]:
    q = "casa renta Ajijic"
    return [
        (
            "Inmuebles24",
            "https://www.inmuebles24.com/casas-en-renta-en-ajijic.html",
        ),
        (
            "Propiedades.com",
            "https://propiedades.com/ajijic-centro-chapala/casas-renta",
        ),
        (
            "Vivanuncios",
            "https://www.vivanuncios.com.mx/s-casas-en-renta/jalisco/en+ajijic/v1c1299l1013q0p1",
        ),
        (
            "Lamudi",
            "https://www.lamudi.com.mx/jalisco/chapala/casa/for-rent/",
        ),
        (
            "Mercado Libre Inmuebles",
            "https://inmuebles.mercadolibre.com.mx/jalisco/casas/renta/ajijic/",
        ),
        (
            "Trovit",
            "https://casas.trovit.com.mx/renta-casa-ajijic-20000-pesos",
        ),
        (
            "Mitula",
            "https://casas.mitula.mx/casas/renta-casas-ajijic",
        ),
        (
            "Nestoria",
            "https://www.nestoria.mx/ajijic-centro/casa/renta",
        ),
        (
            "Casas y Terrenos",
            "https://www.casasyterrenos.com/jalisco/chapala/ajijic/casa/renta",
        ),
        (
            "Ajijic Trinity",
            "https://www.ajijictrinity.com/rent/",
        ),
        (
            "Doorvel",
            "https://www.doorvel.com/home/propiedades/casas/en-renta/mexico/jalisco/chapala",
        ),
        (
            "FazWaz",
            "https://www.fazwaz.com.mx/es/propiedad-e-Inmueble-alquiler/jalisco/chapala",
        ),
        (
            "Búsqueda web (Google)",
            "https://www.google.com/search?q="
            + quote(
                f'casa en renta Ajijic OR "Villa Nova" OR "La Floresta" '
                f"${min_price}..${max_price} fraccionamiento"
            ),
        ),
    ]
