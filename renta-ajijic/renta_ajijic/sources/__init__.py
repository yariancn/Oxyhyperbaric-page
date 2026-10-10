from __future__ import annotations

from .casasyterrenos import fetch_casasyterrenos_listings
from .duckduckgo import search_web_listings
from .trinity import fetch_trinity_listings

# Portales que el programa intenta cubrir (scrapers + búsqueda web + links).
PLATAFORMAS = [
    "Ajijic Trinity",
    "Casas y Terrenos",
    "Inmuebles24",
    "Propiedades.com",
    "Vivanuncios",
    "Lamudi",
    "Mercado Libre Inmuebles",
    "Trovit",
    "Mitula",
    "Nestoria",
    "Doorvel",
    "FazWaz",
    "EasyBroker / iCasas",
]


def collect_listings(*, usd_mxn: float = 18.0, enrich: bool = True):
    listings = []
    for fetcher in (
        lambda: fetch_trinity_listings(usd_mxn=usd_mxn, enrich=enrich),
        lambda: fetch_casasyterrenos_listings(usd_mxn=usd_mxn),
        lambda: search_web_listings(usd_mxn=usd_mxn),
    ):
        try:
            listings.extend(fetcher())
        except Exception:
            continue
    return _dedupe(listings)


def _dedupe(listings):
    seen = set()
    unique = []
    for listing in listings:
        key = (listing.url.rstrip("/").lower(), listing.price_mxn, listing.title.strip().lower())
        if key in seen:
            continue
        seen.add(key)
        unique.append(listing)
    return unique
