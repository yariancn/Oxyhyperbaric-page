from __future__ import annotations

import re
from urllib.parse import urlparse

from ..models import Listing
from ..prices import parse_price_to_mxn

QUERIES = [
    "casa en renta Ajijic Jalisco 20000 pesos",
    "casa renta Ajijic fraccionamiento privado",
    'casa renta Ajijic "Villa Nova" OR "La Floresta" OR "Rancho del Oro" OR "Lago Encantado"',
    "casa en renta Ajijic 18000 OR 22000 OR 25000",
]

PORTAL_HINTS = (
    "inmuebles24.com",
    "propiedades.com",
    "vivanuncios.com.mx",
    "icasas.mx",
    "doorvel.com",
    "fazwaz.com",
    "lamudi.com.mx",
    "trovit.com.mx",
    "mitula.mx",
    "nestoria.mx",
    "ajijictrinity.com",
    "easybroker.com",
    "mercadolibre.com.mx",
)


def search_web_listings(*, usd_mxn: float = 18.0, max_per_query: int = 8) -> list[Listing]:
    try:
        from ddgs import DDGS
    except ImportError:
        return []

    listings: list[Listing] = []
    seen_urls: set[str] = set()

    with DDGS() as ddgs:
        for query in QUERIES:
            try:
                results = list(ddgs.text(query, region="mx-es", max_results=max_per_query))
            except Exception:
                continue
            for result in results:
                listing = _from_result(result, usd_mxn=usd_mxn)
                if not listing:
                    continue
                key = listing.url.rstrip("/").lower()
                if key in seen_urls:
                    continue
                seen_urls.add(key)
                listings.append(listing)
    return listings


def _from_result(result: dict, *, usd_mxn: float) -> Listing | None:
    title = (result.get("title") or "").strip()
    url = (result.get("href") or result.get("url") or "").strip()
    body = (result.get("body") or result.get("snippet") or "").strip()
    if not url or not title:
        return None

    host = urlparse(url).netloc.lower()
    if not any(h in host for h in PORTAL_HINTS):
        # Conservar resultados relevantes aunque no sean del portal conocido.
        blob = f"{title} {body}".lower()
        if "ajijic" not in blob and "chapala" not in blob:
            return None
        if "renta" not in blob and "rent" not in blob and "alquiler" not in blob:
            return None

    if "ajijictrinity.com/rent" in url.rstrip("/") + "/":
        return None  # Ya se cubre con el scraper dedicado.

    title = _clean_title(title)
    price_mxn, currency, raw = parse_price_to_mxn(f"{title} {body}", usd_mxn=usd_mxn)
    bedrooms = _guess_int(r"(\d+)\s*(?:rec[aá]maras?|habitaciones?|beds?|bedrooms?)", f"{title} {body}")
    bathrooms = _guess_float(r"(\d+(?:\.\d+)?)\s*(?:baños?|baths?|bathrooms?)", f"{title} {body}")

    return Listing(
        title=title[:120],
        url=url,
        price_mxn=price_mxn,
        source=_source_name(host),
        address=_guess_address(f"{title} {body}"),
        property_type="House" if re.search(r"\bcasa\b", f"{title} {body}", re.I) else "",
        bedrooms=bedrooms,
        bathrooms=bathrooms,
        description=body,
        raw_price_text=raw,
        currency=currency or "MXN",
    )


def _clean_title(title: str) -> str:
    title = re.sub(r"\s+", " ", title).strip()
    # A veces el agregador pega varios títulos juntos.
    title = re.split(r"\d{2,}\s+Casas?\b", title, maxsplit=1)[0].strip(" -|")
    title = re.split(r"\bMitula\b|\bTrovit\b|\bNestoria\b", title, maxsplit=1)[0].strip(" -|")
    return title or "Casa en renta en Ajijic"


def _source_name(host: str) -> str:
    host = host.replace("www.", "")
    for hint in PORTAL_HINTS:
        if hint in host:
            return hint
    return host or "web"


def _guess_address(text: str) -> str:
    m = re.search(
        r"(Ajijic[^.]{0,60}|La Floresta|Villa Nova|Rancho del Oro|Lago Encantado|Chapala)",
        text,
        re.I,
    )
    return m.group(0).strip() if m else "Ajijic, Jalisco"


def _guess_int(pattern: str, text: str):
    m = re.search(pattern, text, re.I)
    return int(m.group(1)) if m else None


def _guess_float(pattern: str, text: str):
    m = re.search(pattern, text, re.I)
    return float(m.group(1)) if m else None
