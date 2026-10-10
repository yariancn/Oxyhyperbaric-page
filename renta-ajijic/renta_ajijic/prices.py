from __future__ import annotations

import re
from typing import Optional

# Tipo de cambio aproximado para anuncios en USD (ajustable por CLI).
DEFAULT_USD_MXN = 18.0


def parse_price_to_mxn(text: str, usd_mxn: float = DEFAULT_USD_MXN) -> tuple[Optional[int], str, str]:
    """Extrae precio y lo convierte a MXN. Retorna (mxn, moneda_original, texto_crudo)."""
    if not text:
        return None, "", ""

    cleaned = re.sub(r"\s+", " ", text).strip()
    patterns = [
        r"\$?\s*([\d]{1,3}(?:[.,]\d{3})+|\d+)\s*(?:/\s*)?(MXN|mxn|pesos?)?",
        r"(MXN|USD|US\$|\$)?\s*([\d]{1,3}(?:[.,]\d{3})+|\d+)\s*(MXN|USD|U\.?S\.?D\.?|pesos?)?",
    ]

    currency = "MXN"
    amount = None
    raw = cleaned

    # Preferir menciones explícitas.
    m = re.search(
        r"\$?\s*([\d]{1,3}(?:[,\s]\d{3})+|\d+(?:\.\d+)?)\s*/?\s*(MXN|USD|U\.?S\.?D\.?|pesos?)",
        cleaned,
        re.I,
    )
    if not m:
        m = re.search(r"(MXN|USD)\s*\$?\s*([\d]{1,3}(?:,\d{3})+|\d+)", cleaned, re.I)
        if m:
            currency = m.group(1).upper()
            amount = _to_int(m.group(2))
            raw = m.group(0)
    else:
        amount = _to_int(m.group(1))
        currency = (m.group(2) or "MXN").upper()
        raw = m.group(0)

    if amount is None:
        m = re.search(r"\$\s*([\d]{1,3}(?:,\d{3})+|\d+)", cleaned)
        if m:
            amount = _to_int(m.group(1))
            raw = m.group(0)

    if amount is None:
        return None, "", raw

    if currency.startswith("US") or currency == "USD":
        return int(round(amount * usd_mxn)), "USD", raw
    if "PESO" in currency:
        currency = "MXN"
    return amount, currency if currency in {"MXN", "USD"} else "MXN", raw


def _to_int(num: str) -> int:
    num = num.replace(" ", "").replace(",", "")
    if "." in num and num.count(".") == 1 and len(num.split(".")[-1]) in {1, 2}:
        return int(float(num))
    num = num.replace(".", "")
    return int(float(num))
