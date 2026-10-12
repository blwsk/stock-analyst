from datetime import UTC, date, datetime

import pytest
from fastapi.testclient import TestClient

from src.main import app
from src.services import stock_data

client = TestClient(app)


def _bar(ts: datetime) -> stock_data.Bar:
    return stock_data.Bar(timestamp=ts, open=1, high=2, low=0.5, close=1.5, volume=100)


def test_get_bars(monkeypatch):
    async def fake_get_bars(ticker: str, range_: str = "1M", timeframe: str = "1Day"):
        assert (ticker, range_, timeframe) == ("AAPL", "5D", "5Min")
        return [_bar(datetime(2026, 10, 9, tzinfo=UTC))]

    monkeypatch.setattr(stock_data, "get_bars", fake_get_bars)

    response = client.get("/stocks/AAPL/bars", params={"range": "5D", "timeframe": "5Min"})
    assert response.status_code == 200
    assert response.json() == [
        {"timestamp": "2026-10-09T00:00:00Z", "open": 1.0, "high": 2.0, "low": 0.5, "close": 1.5, "volume": 100}
    ]


def test_get_bars_rejects_unknown_params():
    assert client.get("/stocks/AAPL/bars", params={"timeframe": "3Day"}).status_code == 422
    assert client.get("/stocks/AAPL/bars", params={"range": "10Y"}).status_code == 422


def test_get_bars_rejects_timeframe_too_fine_for_range():
    response = client.get("/stocks/AAPL/bars", params={"range": "1Y", "timeframe": "1Min"})
    assert response.status_code == 422


@pytest.mark.parametrize(
    ("range_", "today", "expected"),
    [
        ("1M", date(2026, 10, 12), date(2026, 9, 12)),
        ("6M", date(2026, 8, 31), date(2026, 2, 28)),
        ("1Y", date(2026, 1, 15), date(2025, 1, 15)),
    ],
)
def test_start_date_for_month_ranges(range_, today, expected):
    assert stock_data._start_date(range_, today) == expected


def test_last_sessions_keeps_most_recent_trading_days():
    bars = [
        _bar(datetime(2026, 10, 8, 14, 0, tzinfo=UTC)),
        _bar(datetime(2026, 10, 9, 14, 0, tzinfo=UTC)),
        # 00:30 UTC on the 10th is still the evening of the 9th in New York.
        _bar(datetime(2026, 10, 10, 0, 30, tzinfo=UTC)),
        _bar(datetime(2026, 10, 12, 14, 0, tzinfo=UTC)),
    ]
    assert stock_data._last_sessions(bars, 2) == bars[1:]
