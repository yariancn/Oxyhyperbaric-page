from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional


@dataclass
class Listing:
    title: str
    url: str
    price_mxn: Optional[int]
    source: str
    address: str = ""
    property_type: str = ""
    bedrooms: Optional[int] = None
    bathrooms: Optional[float] = None
    description: str = ""
    features: list[str] = field(default_factory=list)
    neighborhood_hits: list[str] = field(default_factory=list)
    private_hits: list[str] = field(default_factory=list)
    score: float = 0.0
    summary: str = ""
    raw_price_text: str = ""
    currency: str = "MXN"

    def text_blob(self) -> str:
        parts = [
            self.title,
            self.address,
            self.property_type,
            self.description,
            " ".join(self.features),
        ]
        return " ".join(p for p in parts if p)
