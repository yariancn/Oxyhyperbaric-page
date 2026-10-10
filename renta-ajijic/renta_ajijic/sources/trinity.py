from __future__ import annotations

import re
from typing import Optional
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

from ..models import Listing
from ..prices import parse_price_to_mxn

BASE = "https://www.ajijictrinity.com/rent/"
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


def fetch_trinity_listings(*, usd_mxn: float = 18.0, enrich: bool = True) -> list[Listing]:
    response = SESSION.get(BASE, timeout=40)
    response.raise_for_status()
    soup = BeautifulSoup(response.text, "lxml")
    listings: list[Listing] = []

    for item in soup.select(".item-wrap"):
        listing = _parse_card(item, usd_mxn=usd_mxn)
        if listing:
            listings.append(listing)

    if enrich:
        for listing in listings:
            try:
                _enrich_from_detail(listing, usd_mxn=usd_mxn)
            except Exception:
                # Mantener el anuncio básico si falla el detalle.
                continue
    return listings


def _parse_card(item, *, usd_mxn: float) -> Optional[Listing]:
    links = item.select("a[href*='/property/']")
    if not links:
        return None

    url = urljoin(BASE, links[0].get("href", ""))
    title = None
    for a in links:
        text = a.get_text(" ", strip=True)
        if not text or text.startswith("$") or text.lower() in {"for rent", "rented", "whatsapp"}:
            continue
        title = text
        break
    if not title:
        title = url.rstrip("/").split("/")[-1].replace("-", " ").replace("_", " ").title()

    price_el = item.select_one(".item-price, .price")
    raw_price = price_el.get_text(" ", strip=True) if price_el else ""
    price_mxn, currency, raw = parse_price_to_mxn(raw_price, usd_mxn=usd_mxn)

    address_el = item.select_one(".item-address, address")
    address = address_el.get_text(" ", strip=True) if address_el else ""

    meta_text = item.get_text(" ", strip=True)
    bedrooms = _first_int(r"Beds?:\s*(\d+)", meta_text)
    bathrooms = _first_float(r"Baths?:\s*([\d.]+)", meta_text)
    property_type = ""
    for label in ("House", "Apartment", "Villa", "Studio", "Room", "Home"):
        if re.search(rf"\b{label}\b", meta_text):
            property_type = label
            break

    return Listing(
        title=title,
        url=url,
        price_mxn=price_mxn,
        source="Ajijic Trinity",
        address=address,
        property_type=property_type,
        bedrooms=bedrooms,
        bathrooms=bathrooms,
        raw_price_text=raw or raw_price,
        currency=currency or "MXN",
    )


def _enrich_from_detail(listing: Listing, *, usd_mxn: float) -> None:
    response = SESSION.get(listing.url, timeout=40)
    response.raise_for_status()
    soup = BeautifulSoup(response.text, "lxml")

    h1 = soup.select_one("h1")
    if h1 and h1.get_text(strip=True):
        listing.title = h1.get_text(strip=True)

    desc = soup.select_one("#property-description-wrap .block-content-wrap, .property-description")
    if desc:
        text = desc.get_text(" ", strip=True)
        text = re.sub(r"^Description\s*", "", text, flags=re.I)
        listing.description = text

    features = []
    for li in soup.select(
        ".detail-wrap li, .list-3-cols li, .property-features-list li, ul.list-2-cols li"
    ):
        t = li.get_text(" ", strip=True)
        if t:
            features.append(t)
    listing.features = features

    details = _parse_detail_map(features)
    if listing.bedrooms is None and "bedrooms" in details:
        listing.bedrooms = _first_int(r"(\d+)", details["bedrooms"])
    if listing.bedrooms is None and "bedroom" in details:
        listing.bedrooms = _first_int(r"(\d+)", details["bedroom"])
    if listing.bathrooms is None and "bathrooms" in details:
        listing.bathrooms = _first_float(r"([\d.]+)", details["bathrooms"])
    if listing.bathrooms is None and "bathroom" in details:
        listing.bathrooms = _first_float(r"([\d.]+)", details["bathroom"])
    if "property type" in details:
        listing.property_type = details["property type"].split(",")[0].strip()

    addr_bits = []
    for key in ("address", "area", "city"):
        if key in details:
            addr_bits.append(details[key])
    if addr_bits:
        listing.address = ", ".join(addr_bits)

    price_el = soup.select_one(".item-price, .price")
    if price_el:
        price_mxn, currency, raw = parse_price_to_mxn(price_el.get_text(" ", strip=True), usd_mxn=usd_mxn)
        if price_mxn is not None:
            listing.price_mxn = price_mxn
            listing.currency = currency
            listing.raw_price_text = raw


def _parse_detail_map(features: list[str]) -> dict[str, str]:
    details: dict[str, str] = {}
    for feat in features:
        if ":" not in feat:
            continue
        key, value = feat.split(":", 1)
        key = key.strip().lower()
        value = value.strip()
        if key and value:
            details[key] = value
    return details


def _first_int(pattern: str, text: str) -> Optional[int]:
    m = re.search(pattern, text, re.I)
    return int(m.group(1)) if m else None


def _first_float(pattern: str, text: str) -> Optional[float]:
    m = re.search(pattern, text, re.I)
    return float(m.group(1)) if m else None
