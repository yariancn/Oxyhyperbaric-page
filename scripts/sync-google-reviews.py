#!/usr/bin/env python3
"""Sync Google Business reviews into assets/google-reviews.json.

Requires a Google Cloud API key with Places API (New) enabled:
  export GOOGLE_PLACES_API_KEY="AIza..."
  python3 scripts/sync-google-reviews.py

Get a key: Google Cloud Console → APIs & Services → Credentials → Create API key
Enable: "Places API (New)" for the project.
"""

import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Optional

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "google-reviews.json"

QUERY = "OXYHYPERBARIC 256 Ed English Dr Bldg 4 Ste E Shenandoah TX 77384"
PLACEHOLDER_KEYS = {"tu-api-key", "your-key", "your_api_key", "AIza...", "changeme"}

SEARCH_FIELD_MASK = ",".join([
    "places.id",
    "places.displayName",
    "places.rating",
    "places.userRatingCount",
    "places.googleMapsUri",
])

DETAILS_FIELD_MASK = ",".join([
    "id",
    "displayName",
    "rating",
    "userRatingCount",
    "googleMapsUri",
    "reviews",
    "reviews.rating",
    "reviews.text",
    "reviews.authorAttribution",
    "reviews.relativePublishTimeDescription",
])


def api_request(method: str, url: str, api_key: str, field_mask: str, body: Optional[Dict] = None) -> dict:
    headers = {
        "X-Goog-Api-Key": api_key,
        "X-Goog-FieldMask": field_mask,
    }
    data = None
    if body is not None:
        headers["Content-Type"] = "application/json"
        data = json.dumps(body).encode("utf-8")

    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        print(f"Google Places API error {exc.code}: {exc.reason}", file=sys.stderr)
        if detail:
            print(detail, file=sys.stderr)
        if exc.code in (400, 403) and api_key in PLACEHOLDER_KEYS:
            print(
                "\nYou used the example placeholder key. Export your real key, e.g.:\n"
                '  export GOOGLE_PLACES_API_KEY="AIzaSy..."',
                file=sys.stderr,
            )
        elif exc.code == 403:
            print(
                "\nCheck that Places API (New) is enabled and billing is active on the project.",
                file=sys.stderr,
            )
        raise SystemExit(1) from exc


def main() -> int:
    api_key = os.environ.get("GOOGLE_PLACES_API_KEY", "").strip()
    if not api_key:
        print("Set GOOGLE_PLACES_API_KEY with Places API (New) enabled.", file=sys.stderr)
        return 1
    if api_key in PLACEHOLDER_KEYS:
        print(
            'GOOGLE_PLACES_API_KEY is still the placeholder ("tu-api-key"). '
            "Use your real API key from Google Cloud Console.",
            file=sys.stderr,
        )
        return 1

    search = api_request(
        "POST",
        "https://places.googleapis.com/v1/places:searchText",
        api_key,
        SEARCH_FIELD_MASK,
        {"textQuery": QUERY, "maxResultCount": 1},
    )
    places = search.get("places") or []
    if not places:
        print("No place found for query.", file=sys.stderr)
        return 1

    summary = places[0]
    place_id = summary.get("id", "")
    if not place_id:
        print("Place found but missing id.", file=sys.stderr)
        return 1

    place = api_request(
        "GET",
        f"https://places.googleapis.com/v1/{place_id}",
        api_key,
        DETAILS_FIELD_MASK,
    )

    rating = place.get("rating", summary.get("rating"))
    count = place.get("userRatingCount", summary.get("userRatingCount"))
    maps_uri = place.get("googleMapsUri") or summary.get("googleMapsUri") or "https://maps.app.goo.gl/nj8cXrgnqekB8pTC7"

    reviews_out = []
    for item in place.get("reviews") or []:
        text = (item.get("text") or {}).get("text") or ""
        author = (item.get("authorAttribution") or {}).get("displayName") or "Google user"
        reviews_out.append({
            "author": author,
            "rating": item.get("rating") or 5,
            "text": text.strip(),
            "relativeTime": item.get("relativePublishTimeDescription") or "",
        })

    existing = {}
    if OUT.exists():
        existing = json.loads(OUT.read_text(encoding="utf-8"))

    q = urllib.parse.quote("OXYHYPERBARIC")
    all_reviews_url = f"https://search.google.com/local/reviews?placeid={place_id}&q={q}&hl=en"

    out = {
        "source": "google",
        "businessName": (place.get("displayName") or summary.get("displayName") or {}).get("text") or "OXYHYPERBARIC",
        "placeId": place_id,
        "rating": rating,
        "reviewCount": count,
        "lastSynced": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "mapsUrl": maps_uri,
        "allReviewsUrl": all_reviews_url,
        "placeHex": existing.get("placeHex"),
        "reviews": reviews_out,
    }

    OUT.write_text(json.dumps(out, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wrote {OUT}")
    print(f"Rating: {rating} · Reviews: {count} · Synced cards: {len(reviews_out)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
