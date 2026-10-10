from __future__ import annotations

from .duckduckgo import search_web_listings
from .trinity import fetch_trinity_listings


def collect_listings(*, usd_mxn: float = 18.0, enrich: bool = True):
    listings = []
    listings.extend(fetch_trinity_listings(usd_mxn=usd_mxn, enrich=enrich))
    listings.extend(search_web_listings(usd_mxn=usd_mxn))
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
