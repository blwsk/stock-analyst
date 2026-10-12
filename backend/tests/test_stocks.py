from datetime import UTC, date, datetime, timedelta

import pytest
from fastapi.testclient import TestClient

from src.constants import MARKET_TZ
from src.main import app
from src.services import stock_data

client = TestClient(app)


def _bar(ts: datetime) -> stock_data.Bar:
    return stock_data.Bar(timestamp=ts, open=1, high=2, low=0.5, close=1.5, volume=100)


def test_get_bars(monkeypatch):
    async def fake_get_bars(tickers, range_=None, timeframe="1Day", start=None, end=None):
        assert (tickers, range_, timeframe, start, end) == (["AAPL", "MSFT"], "5D", "5Min", None, None)
        return [
            stock_data.TickerBars(ticker="AAPL", data=[_bar(datetime(2026, 10, 9, tzinfo=UTC))]),
            stock_data.TickerBars(ticker="MSFT", data=[]),
        ]

    monkeypatch.setattr(stock_data, "get_bars", fake_get_bars)

    # Tickers are normalized and deduped, as for a workspace.
    response = client.get("/stocks/bars", params={"tickers": "aapl, MSFT,AAPL", "range": "5D", "timeframe": "5Min"})
    assert response.status_code == 200
    assert response.json() == [
        {
            "ticker": "AAPL",
            "data": [
                {"timestamp": "2026-10-09T00:00:00Z", "open": 1.0, "high": 2.0, "low": 0.5, "close": 1.5, "volume": 100}
            ],
        },
        {"ticker": "MSFT", "data": []},
    ]


def test_get_bars_rejects_unknown_params():
    assert client.get("/stocks/bars", params={"tickers": "AAPL", "timeframe": "3Day"}).status_code == 422
    assert client.get("/stocks/bars", params={"tickers": "AAPL", "range": "10Y"}).status_code == 422


@pytest.mark.parametrize("tickers", ["", " , ", "AAPL,NOT A TICKER"])
def test_get_bars_rejects_invalid_tickers(tickers):
    assert client.get("/stocks/bars", params={"tickers": tickers}).status_code == 422


def test_get_bars_passes_start_and_end(monkeypatch):
    async def fake_get_bars(tickers, range_=None, timeframe="1Day", start=None, end=None):
        assert (range_, start, end) == (None, datetime(2026, 9, 1, 9, 30), datetime(2026, 9, 2, 16, 0, tzinfo=UTC))
        return []

    monkeypatch.setattr(stock_data, "get_bars", fake_get_bars)

    response = client.get(
        "/stocks/bars",
        params={"tickers": "AAPL", "start": "2026-09-01T09:30:00", "end": "2026-09-02T16:00:00Z", "timeframe": "5Min"},
    )
    assert response.status_code == 200


def test_get_bars_rejects_timeframe_too_fine_for_range():
    response = client.get("/stocks/bars", params={"tickers": "AAPL", "range": "1Y", "timeframe": "1Min"})
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


NOW = datetime(2026, 10, 12, 12, 0, tzinfo=MARKET_TZ)


def test_window_for_range_counts_back_from_end():
    end = datetime(2026, 6, 15, 16, 0, tzinfo=MARKET_TZ)
    start, window_end = stock_data._window("1M", "1Day", None, end, NOW)
    assert (start, window_end) == (datetime(2026, 5, 15, tzinfo=MARKET_TZ), end)


def test_window_reads_naive_datetimes_as_market_time():
    start, end = stock_data._window(None, "5Min", datetime(2026, 10, 1, 9, 30), datetime(2026, 10, 2, 16, 0), NOW)
    assert start == datetime(2026, 10, 1, 9, 30, tzinfo=MARKET_TZ)
    assert end == datetime(2026, 10, 2, 16, 0, tzinfo=MARKET_TZ)


def test_window_allows_long_spans_for_daily_bars():
    start = datetime(2021, 1, 1, tzinfo=UTC)
    assert stock_data._window(None, "1Day", start, None, NOW) == (start, None)


@pytest.mark.parametrize(
    ("range_", "timeframe", "start", "end", "message"),
    [
        ("1M", "1Day", NOW - timedelta(days=3), None, "either range or start"),
        (None, "1Day", None, NOW, "either range or start"),
        (None, "1Day", NOW, NOW - timedelta(days=1), "before end"),
        (None, "1Min", NOW - timedelta(days=40), None, "at most 31 days"),
        (None, "1Hour", NOW - timedelta(days=400), None, "at most 366 days"),
        ("1Y", "1Min", None, None, "not supported for range"),
    ],
)
def test_window_rejects_invalid_queries(range_, timeframe, start, end, message):
    with pytest.raises(ValueError, match=message):
        stock_data._window(range_, timeframe, start, end, NOW)


def test_get_bars_rejects_range_with_start():
    response = client.get("/stocks/bars", params={"tickers": "AAPL", "range": "1M", "start": "2026-09-01T00:00:00"})
    assert response.status_code == 422


def test_get_snapshots(monkeypatch):
    async def fake_get_snapshots(tickers):
        assert tickers == ["AAPL", "MSFT"]
        return [stock_data.Snapshot(ticker="AAPL", price=101, day_change=1, day_change_percent=1, volume=500)]

    monkeypatch.setattr(stock_data, "get_snapshots", fake_get_snapshots)

    response = client.get("/stocks/snapshots", params={"tickers": "aapl,MSFT"})
    assert response.status_code == 200
    assert response.json()[0]["price"] == 101


@pytest.mark.parametrize("tickers", ["", "NOT A TICKER"])
def test_get_snapshots_rejects_invalid_tickers(tickers):
    assert client.get("/stocks/snapshots", params={"tickers": tickers}).status_code == 422


def test_snapshot_changes_from_previous_close():
    snapshot = stock_data._snapshot(
        "AAPL",
        {
            "latestTrade": {"p": 110.0, "t": "2026-10-12T18:00:00Z"},
            "dailyBar": {"v": 1234},
            "prevDailyBar": {"c": 100.0},
        },
    )
    assert (snapshot.price, snapshot.day_change, snapshot.day_change_percent, snapshot.volume) == (110, 10, 10, 1234)


def test_snapshot_is_empty_for_unknown_tickers():
    assert stock_data._snapshot("ZZZZ", None) == stock_data.Snapshot(ticker="ZZZZ")
