from __future__ import annotations

import re
from typing import Optional
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

from ..models import Listing
from ..prices import parse_price_to_mxn

SEARCH_URL = "https://www.casasyterrenos.com/jalisco/chapala/ajijic/casa/renta"
SESSION = requests.Session()
SESSION.headers.update(
    {
        "User-Agent": (
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
            "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        ),
        "Accept-Language": "es-MX,es;q=0.9,en;q=0.8",
    }
)


def fetch_casasyterrenos_listings(*, usd_mxn: float = 18.0) -> list[Listing]:
    response = SESSION.get(SEARCH_URL, timeout=40)
    response.raise_for_status()
    soup = BeautifulSoup(response.text, "lxml")
    listings: list[Listing] = []
    seen: set[str] = set()

    for a in soup.select('a[href*="/propiedad/"]'):
        href = urljoin(SEARCH_URL, a.get("href", ""))
        if href in seen:
            continue
        text = a.get_text(" ", strip=True)
        if not text or len(text) < 20:
            continue
        if "local" in text.lower() and "casa" not in text.lower():
            continue
        seen.add(href)

        price_mxn, currency, raw = parse_price_to_mxn(text, usd_mxn=usd_mxn)
        bedrooms = _first_int(r"(\d+)\s*Rec\.?", text)
        bathrooms = _first_float(r"(\d+(?:\.\d+)?)\s*Baños?", text)
        title = _clean_title(text)

        listings.append(
            Listing(
                title=title,
                url=href,
                price_mxn=price_mxn,
                source="casasyterrenos.com",
                address=_guess_address(text),
                property_type="House" if re.search(r"\bcasa\b", text, re.I) else "",
                bedrooms=bedrooms,
                bathrooms=bathrooms,
                description=text,
                raw_price_text=raw,
                currency=currency or "MXN",
            )
        )
    return listings


def _clean_title(text: str) -> str:
    text = re.sub(r"\s+", " ", text).strip()
    # Quitar precio y métricas finales para dejar un título legible.
    text = re.split(r"\$\s*[\d,.]+", text, maxsplit=1)[0].strip(" -,")
    text = re.sub(r"^(Chapala|Jocotepec|Ajijic)\s*,\s*Jalisco\s*", "", text, flags=re.I)
    return (text[:110] or "Casa en renta en Ajijic").strip()


def _guess_address(text: str) -> str:
    m = re.search(r"(Ajijic|San Juan Cosal[aá]|Chapala|Jocotepec)[^$]{0,40}", text, re.I)
    return m.group(0).strip() if m else "Ajijic, Jalisco"


def _first_int(pattern: str, text: str) -> Optional[int]:
    m = re.search(pattern, text, re.I)
    return int(m.group(1)) if m else None


def _first_float(pattern: str, text: str) -> Optional[float]:
    m = re.search(pattern, text, re.I)
    return float(m.group(1)) if m else None
