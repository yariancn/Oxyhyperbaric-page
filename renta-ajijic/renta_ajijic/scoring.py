from __future__ import annotations

import re
import unicodedata
from typing import Iterable

from .models import Listing

# Zonas / fraccionamientos de perfil media-alta en Ajijic y ribera cercana.
PREFERRED_NEIGHBORHOODS: dict[str, int] = {
    "la floresta": 35,
    "floresta": 30,
    "villa nova": 35,
    "villanova": 35,
    "rancho del oro": 35,
    "lago encantado": 32,
    "chula vista": 28,
    "las casitas": 26,
    "lomas de ajijic": 28,
    "lomas": 18,
    "pedregal": 24,
    "vista del lago": 26,
    "balcones de ajijic": 26,
    "balcones": 16,
    "la cristina": 24,
    "hacienda del tepeyac": 28,
    "tepeyac": 18,
    "senderos del lago": 22,
    "riberas del pilar": 20,
    "riberas": 14,
    "san antonio tlayacapan": 16,
    "terrazas": 18,
    "privada lago": 24,
}

PRIVATE_COMMUNITY_PATTERNS: list[tuple[str, int]] = [
    (r"\bfraccionamiento\b", 18),
    (r"\bfracc\.?\b", 14),
    (r"\bprivada\b", 16),
    (r"\bcoto\b", 16),
    (r"\bcondominio\b", 14),
    (r"\bgated community\b", 16),
    (r"\bgated\b", 10),
    (r"\bacceso controlado\b", 14),
    (r"\bseguridad\s*24", 14),
    (r"\bvigilancia\b", 10),
    (r"\bport[oó]n el[eé]ctrico\b", 10),
    (r"\bcasa club\b", 8),
    (r"\balberca comunitaria\b", 6),
    (r"\bhoa\b", 8),
    (r"\bmantenimiento del condominio\b", 8),
]

HOUSE_TYPES = {"house", "casa", "home", "villa", "residential"}
SKIP_TYPES = {"room", "studio", "habitacion", "habitación", "commercial", "restaurant", "local"}


def normalize(text: str) -> str:
    text = unicodedata.normalize("NFKD", text or "")
    text = "".join(c for c in text if not unicodedata.combining(c))
    return re.sub(r"\s+", " ", text.lower()).strip()


def extract_neighborhood_hits(text: str) -> list[str]:
    norm = normalize(text)
    hits = []
    for name in sorted(PREFERRED_NEIGHBORHOODS, key=len, reverse=True):
        if name in norm:
            # Evitar doble conteo (p.ej. "la floresta" y "floresta").
            if any(name in h or h in name for h in hits):
                continue
            hits.append(name)
    return hits


def extract_private_hits(text: str) -> list[str]:
    norm = normalize(text)
    hits = []
    for pattern, _ in PRIVATE_COMMUNITY_PATTERNS:
        if re.search(pattern, norm, re.I):
            hits.append(pattern.strip(r"\b"))
    return hits


def price_score(price_mxn: int | None, target: int, min_price: int, max_price: int) -> float:
    if price_mxn is None:
        return 0.0
    if price_mxn < min_price or price_mxn > max_price:
        return -100.0
    distance = abs(price_mxn - target)
    # 0 pesos de diferencia = 40 pts; cae linealmente hasta 0 en el borde del rango.
    span = max(target - min_price, max_price - target, 1)
    return max(0.0, 40.0 * (1.0 - distance / span))


def score_listing(
    listing: Listing,
    *,
    target_price: int = 20_000,
    min_price: int = 15_000,
    max_price: int = 25_000,
    prefer_private: bool = True,
) -> Listing:
    blob = listing.text_blob()
    listing.neighborhood_hits = extract_neighborhood_hits(blob)
    listing.private_hits = extract_private_hits(blob)

    score = price_score(listing.price_mxn, target_price, min_price, max_price)

    for name in listing.neighborhood_hits:
        score += PREFERRED_NEIGHBORHOODS.get(name, 0)

    private_bonus = 0.0
    for pattern, pts in PRIVATE_COMMUNITY_PATTERNS:
        if re.search(pattern, normalize(blob), re.I):
            private_bonus += pts
    if prefer_private:
        score += min(private_bonus, 40.0)
    else:
        score += min(private_bonus, 20.0)

    ptype = normalize(listing.property_type)
    title_n = normalize(listing.title)
    if any(t in ptype for t in HOUSE_TYPES) or "casa" in title_n:
        score += 12
    if any(t in ptype for t in SKIP_TYPES) or any(t in title_n for t in SKIP_TYPES):
        score -= 40
    if "apartment" in ptype or "departamento" in ptype:
        score -= 8

    if listing.bedrooms and listing.bedrooms >= 2:
        score += 6
    if listing.bedrooms and listing.bedrooms >= 3:
        score += 4
    if listing.bathrooms and listing.bathrooms >= 2:
        score += 3

    loc = normalize(f"{listing.address} {listing.title} {listing.description}")
    if "ajijic" in loc:
        score += 15
    elif "riberas del pilar" in loc or "riberas" in loc:
        score += 6
    elif "san juan cosala" in loc or "jocotepec" in loc or "chapala" in loc:
        score += 2

    # Señales de zona media-alta genéricas.
    for kw, pts in (
        ("amueblada", 3),
        ("furnished", 3),
        ("jardin", 3),
        ("terraza", 3),
        ("alberca", 4),
        ("vista", 2),
        ("estacionamiento", 2),
        ("cochera", 2),
    ):
        if kw in normalize(blob):
            score += pts

    listing.score = round(score, 1)
    return listing


def filter_and_rank(
    listings: Iterable[Listing],
    *,
    target_price: int = 20_000,
    min_price: int = 15_000,
    max_price: int = 25_000,
    prefer_private: bool = True,
    houses_only: bool = False,
) -> list[Listing]:
    ranked: list[Listing] = []
    for listing in listings:
        score_listing(
            listing,
            target_price=target_price,
            min_price=min_price,
            max_price=max_price,
            prefer_private=prefer_private,
        )
        if listing.price_mxn is None:
            continue
        if listing.price_mxn < min_price or listing.price_mxn > max_price:
            continue
        ptype = normalize(listing.property_type)
        title_n = normalize(listing.title)
        if any(t in ptype for t in SKIP_TYPES) or any(t in title_n for t in ("restaurant", "comercial", "local comercial")):
            continue
        if houses_only and ("apartment" in ptype or "departamento" in ptype or "room" in ptype):
            continue
        # Evitar páginas índice de agregadores sin ficha individual.
        if _looks_like_index_page(listing):
            continue
        ranked.append(listing)

    ranked.sort(key=lambda x: (-x.score, abs((x.price_mxn or target_price) - target_price)))
    return ranked


def _looks_like_index_page(listing: Listing) -> bool:
    title = normalize(listing.title)
    url = listing.url.lower()
    if re.search(r"^\d+\s+casas?\b", title):
        return True
    if "alrededor de" in title and "renta" in title:
        return True
    index_hosts = ("trovit.com", "mitula.", "nestoria.")
    if any(h in url for h in index_hosts) and "/propiedad" not in url and "/property" not in url:
        return True
    if "propiedades.com" in url and "/inmuebles/" not in url:
        return True
    return False
