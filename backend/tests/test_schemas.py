from datetime import UTC, datetime

import pytest
from pydantic import ValidationError

from src.schemas import ChartConfig, WorkspaceCreate, WorkspaceUpdate


def test_tickers_are_normalized_and_deduped():
    workspace = WorkspaceCreate(name="Tech", tickers=[" aapl", "brk.b", "AAPL", "MSFT"])
    assert workspace.tickers == ["AAPL", "BRK.B", "MSFT"]


@pytest.mark.parametrize("ticker", ["", "TOOLONG", "AA PL", "BRK.BB", "123"])
def test_tickers_reject_invalid_symbols(ticker):
    with pytest.raises(ValidationError):
        WorkspaceCreate(name="Tech", tickers=[ticker])


def test_tickers_are_limited():
    with pytest.raises(ValidationError):
        WorkspaceCreate(name="Tech", tickers=[f"A{chr(65 + i // 26)}{chr(65 + i % 26)}" for i in range(21)])


def test_chart_accepts_range_or_custom_window():
    assert ChartConfig(range="1M", timeframe="1Day").range == "1M"
    window = ChartConfig(
        timeframe="5Min", start=datetime(2026, 10, 1, tzinfo=UTC), end=datetime(2026, 10, 2, tzinfo=UTC)
    )
    assert window.range is None


@pytest.mark.parametrize(
    ("chart", "message"),
    [
        ({"timeframe": "1Day"}, "either range"),
        (
            {"range": "1M", "timeframe": "1Day", "start": "2026-10-01T00:00:00Z", "end": "2026-10-02T00:00:00Z"},
            "either range",
        ),
        ({"timeframe": "1Day", "start": "2026-10-01T00:00:00Z"}, "both start and end"),
        ({"range": "1Y", "timeframe": "1Min"}, "not supported for range"),
        ({"timeframe": "1Day", "start": "2026-10-02T00:00:00Z", "end": "2026-10-01T00:00:00Z"}, "before end"),
        ({"timeframe": "1Min", "start": "2026-08-01T00:00:00Z", "end": "2026-10-01T00:00:00Z"}, "at most 31 days"),
    ],
)
def test_chart_rejects_invalid_options(chart, message):
    with pytest.raises(ValidationError, match=message):
        ChartConfig.model_validate(chart)


def test_update_only_sets_sent_fields():
    assert WorkspaceUpdate.model_validate({"chart": None}).model_dump(exclude_unset=True) == {"chart": None}
    with pytest.raises(ValidationError, match="name can't be null"):
        WorkspaceUpdate.model_validate({"name": None})
