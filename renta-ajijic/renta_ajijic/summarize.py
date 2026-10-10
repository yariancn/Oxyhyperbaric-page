from __future__ import annotations

import re

from .models import Listing
from .portales import portal_search_links
from .scoring import normalize


def _mxn(amount: int | None) -> str:
    if amount is None:
        return "precio no disponible"
    return f"${amount:,.0f} MXN".replace(",", ",")


def _rooms(listing: Listing) -> str:
    parts = []
    if listing.bedrooms is not None:
        parts.append(f"{listing.bedrooms} recámara{'s' if listing.bedrooms != 1 else ''}")
    if listing.bathrooms is not None:
        baths = listing.bathrooms
        if baths == int(baths):
            baths_txt = str(int(baths))
        else:
            baths_txt = str(baths)
        parts.append(f"{baths_txt} baño{'s' if baths != 1 else ''}")
    return ", ".join(parts) if parts else "distribución no especificada"


def _zone_phrase(listing: Listing) -> str:
    if listing.neighborhood_hits:
        names = ", ".join(h.title() for h in listing.neighborhood_hits[:2])
        return f"zona media-alta ({names})"
    addr = listing.address or "Ajijic"
    # Acortar dirección ruidosa.
    addr = re.split(r",\s*Región|,?\s*Jalisco", addr)[0].strip()
    return f"ubicación en {addr}"


def _private_phrase(listing: Listing) -> str:
    if listing.private_hits or any(
        k in normalize(listing.text_blob())
        for k in (
            "fraccionamiento",
            "privada",
            "coto",
            "condominio",
            "seguridad 24",
            "gated community",
            "acceso controlado",
        )
    ):
        return "parece estar en fraccionamiento/coto o con acceso controlado"
    return "no se confirma fraccionamiento privado en el anuncio"


def _feature_highlights(listing: Listing, limit: int = 4) -> str:
    interesting = []
    keywords = (
        "alberca",
        "pool",
        "jardín",
        "jardin",
        "yard",
        "terraza",
        "terrace",
        "balcony",
        "amuebl",
        "furnished",
        "estacionamiento",
        "cochera",
        "parking",
        "vista",
        "view",
        "hoa",
        "seguridad",
        "privada",
        "coto",
        "gated",
    )
    seen = set()
    # Primero amenidades cortas del listado; luego frases de la descripción.
    candidates = list(listing.features) + [
        p.strip() for p in re.split(r"[.!;]", listing.description) if p.strip()
    ]
    for feat in candidates:
        f = feat.strip()
        if len(f) < 3 or len(f) > 70:
            continue
        n = normalize(f)
        if n.startswith("address") or n.startswith("city") or n.startswith("zip"):
            continue
        if re.search(r":\s*no\b", n) or n.endswith(" no"):
            continue
        if any(k in n for k in keywords) and n not in seen:
            seen.add(n)
            interesting.append(f.rstrip("."))
        if len(interesting) >= limit:
            break
    if interesting:
        return "; ".join(interesting)
    if listing.description:
        short = re.sub(r"\s+", " ", listing.description).strip()
        return short[:160] + ("…" if len(short) > 160 else "")
    return "sin descripción detallada"


def summarize_listing(listing: Listing) -> str:
    tipo_raw = (listing.property_type or "propiedad").split(",")[0].strip()
    tipo_n = normalize(tipo_raw)
    if tipo_n in {"house", "home", "residential"}:
        tipo = "casa"
    elif "apartment" in tipo_n or "departamento" in tipo_n:
        tipo = "departamento"
    else:
        tipo = tipo_raw.lower()

    summary = (
        f"{listing.title}: {tipo} en renta por {_mxn(listing.price_mxn)} mensuales, "
        f"con {_rooms(listing)}. {_zone_phrase(listing).capitalize()}; "
        f"{_private_phrase(listing)}. Destaca: {_feature_highlights(listing)}."
    )
    listing.summary = summary
    return summary


def summarize_all(listings: list[Listing]) -> list[Listing]:
    for listing in listings:
        summarize_listing(listing)
    return listings


def format_report(listings: list[Listing], *, target_price: int, min_price: int, max_price: int) -> str:
    lines = [
        "Búsqueda de casas en renta — Ajijic, Jalisco",
        (
            f"Presupuesto objetivo: {_mxn(target_price)} "
            f"(rango {_mxn(min_price)} – {_mxn(max_price)})"
        ),
        "Prioridad: zona media-alta y, de preferencia, fraccionamiento privado.",
        "Cobertura: múltiples portales (no solo Mercado Libre).",
        "",
    ]
    if not listings:
        lines.append("No se encontraron anuncios que cumplan el rango y filtros actuales.")
        lines.append("Prueba ampliar el presupuesto (--min / --max) o quitar --solo-casas.")
    else:
        lines.append(f"Resultados ordenados por afinidad ({len(listings)}):")
        lines.append("")
        for i, listing in enumerate(listings, 1):
            private = "sí" if listing.private_hits else "no confirmado"
            zone = ", ".join(h.title() for h in listing.neighborhood_hits) or "Ajijic / ribera"
            lines.extend(
                [
                    f"{i}. {listing.title}",
                    f"   Precio: {_mxn(listing.price_mxn)} | Score: {listing.score}",
                    f"   Zona: {zone} | Fracc./privado: {private}",
                    f"   Tipo: {listing.property_type or 'N/D'} | {_rooms(listing)}",
                    f"   Resumen: {listing.summary}",
                    f"   Fuente: {listing.source}",
                    f"   Link: {listing.url}",
                    "",
                ]
            )

    lines.append("Portales para revisar manualmente (cobertura multiplataforma):")
    for name, url in portal_search_links(min_price=min_price, max_price=max_price):
        lines.append(f"- {name}: {url}")
    lines.append("")
    return "\n".join(lines)
