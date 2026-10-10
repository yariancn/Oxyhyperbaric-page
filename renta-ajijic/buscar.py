#!/usr/bin/env python3
"""Busca casas en renta en Ajijic (~$20,000 MXN), prioriza zona media-alta y fraccionamientos."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from renta_ajijic.prices import DEFAULT_USD_MXN
from renta_ajijic.scoring import filter_and_rank
from renta_ajijic.sources import collect_listings
from renta_ajijic.summarize import format_report, summarize_all


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        description=(
            "Busca casas en renta en Ajijic, Jalisco cerca de $20,000 MXN. "
            "Prioriza zona media-alta y fraccionamientos privados."
        )
    )
    p.add_argument("--objetivo", type=int, default=20_000, help="Precio objetivo en MXN (default: 20000)")
    p.add_argument("--min", dest="min_price", type=int, default=15_000, help="Precio mínimo MXN")
    p.add_argument("--max", dest="max_price", type=int, default=25_000, help="Precio máximo MXN")
    p.add_argument(
        "--usd-mxn",
        type=float,
        default=DEFAULT_USD_MXN,
        help=f"Tipo de cambio USD→MXN (default: {DEFAULT_USD_MXN})",
    )
    p.add_argument("--solo-casas", action="store_true", help="Excluir departamentos y habitaciones")
    p.add_argument(
        "--sin-enriquecer",
        action="store_true",
        help="No abrir páginas de detalle (más rápido, menos contexto)",
    )
    p.add_argument("--json", dest="json_path", type=Path, help="Guardar resultados en JSON")
    p.add_argument("--out", dest="out_path", type=Path, help="Guardar reporte de texto")
    p.add_argument("--limite", type=int, default=20, help="Máximo de resultados a mostrar")
    return p


def listings_to_dict(listings) -> list[dict]:
    rows = []
    for item in listings:
        rows.append(
            {
                "title": item.title,
                "price_mxn": item.price_mxn,
                "score": item.score,
                "summary": item.summary,
                "url": item.url,
                "source": item.source,
                "address": item.address,
                "property_type": item.property_type,
                "bedrooms": item.bedrooms,
                "bathrooms": item.bathrooms,
                "neighborhood_hits": item.neighborhood_hits,
                "private_hits": item.private_hits,
                "features": item.features,
            }
        )
    return rows


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)

    if args.min_price > args.max_price:
        print("Error: --min no puede ser mayor que --max", file=sys.stderr)
        return 2

    print("Buscando anuncios en Ajijic…", file=sys.stderr)
    try:
        raw = collect_listings(usd_mxn=args.usd_mxn, enrich=not args.sin_enriquecer)
    except Exception as exc:
        print(f"Error al recolectar anuncios: {exc}", file=sys.stderr)
        return 1

    ranked = filter_and_rank(
        raw,
        target_price=args.objetivo,
        min_price=args.min_price,
        max_price=args.max_price,
        prefer_private=True,
        houses_only=args.solo_casas,
    )
    ranked = summarize_all(ranked)[: args.limite]
    report = format_report(
        ranked,
        target_price=args.objetivo,
        min_price=args.min_price,
        max_price=args.max_price,
    )
    print(report)

    if args.out_path:
        args.out_path.write_text(report + "\n", encoding="utf-8")
        print(f"\nReporte guardado en {args.out_path}", file=sys.stderr)

    if args.json_path:
        args.json_path.write_text(
            json.dumps(listings_to_dict(ranked), ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        print(f"JSON guardado en {args.json_path}", file=sys.stderr)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
