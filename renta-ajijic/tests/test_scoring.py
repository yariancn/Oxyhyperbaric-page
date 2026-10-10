from renta_ajijic.models import Listing
from renta_ajijic.prices import parse_price_to_mxn
from renta_ajijic.scoring import filter_and_rank, score_listing
from renta_ajijic.summarize import summarize_listing


def test_parse_mxn_and_usd():
    mxn, currency, _ = parse_price_to_mxn("$20,000/MXN")
    assert mxn == 20_000
    assert currency == "MXN"

    usd, currency, _ = parse_price_to_mxn("$850/USD", usd_mxn=18)
    assert usd == 15_300
    assert currency == "USD"


def test_private_fraccionamiento_scores_higher():
    basic = Listing(
        title="Casa sencilla",
        url="https://example.com/a",
        price_mxn=20_000,
        source="test",
        property_type="House",
        bedrooms=2,
        description="Casa en Ajijic centro",
    )
    premium = Listing(
        title="Casa Villa Nova",
        url="https://example.com/b",
        price_mxn=20_000,
        source="test",
        property_type="House",
        bedrooms=3,
        description="Casa en fraccionamiento privado Villa Nova con seguridad 24 horas",
    )
    score_listing(basic)
    score_listing(premium)
    assert premium.score > basic.score
    assert "villa nova" in premium.neighborhood_hits


def test_filter_price_range_and_summary():
    listings = [
        Listing(title="Cara", url="u1", price_mxn=40_000, source="t", property_type="House"),
        Listing(
            title="18 casas en renta en Ajijic alrededor de $ 20,000",
            url="https://casas.trovit.com.mx/renta-casa-ajijic-20000-pesos",
            price_mxn=20_000,
            source="trovit",
            property_type="House",
        ),
        Listing(
            title="Restaurant Equipales",
            url="https://example.com/restaurant",
            price_mxn=25_000,
            source="t",
            property_type="Commercial",
        ),
        Listing(
            title="Casa Floresta",
            url="u2",
            price_mxn=22_000,
            source="t",
            property_type="House",
            bedrooms=2,
            bathrooms=2,
            description="En La Floresta, fraccionamiento residencial",
        ),
    ]
    ranked = filter_and_rank(listings, min_price=15_000, max_price=25_000)
    assert len(ranked) == 1
    summary = summarize_listing(ranked[0])
    assert "22,000" in summary or "22000" in summary
    assert "Floresta" in summary or "media-alta" in summary
