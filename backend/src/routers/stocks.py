from datetime import datetime

import httpx
from fastapi import APIRouter, HTTPException, Query
from pydantic import TypeAdapter

from src.constants import Range, Timeframe
from src.schemas import Tickers
from src.services import stock_data

router = APIRouter(prefix="/stocks", tags=["stocks"])

# Same rules as a workspace's tickers: normalized, deduped and at most 20.
TICKERS = TypeAdapter(Tickers)

TICKERS_QUERY = Query(description="Comma-separated, e.g. AAPL,MSFT")


def _parse_tickers(tickers: str) -> list[str]:
    # A pydantic ValidationError is a ValueError, so callers report bad tickers as 422s.
    symbols = TICKERS.validate_python([t for t in tickers.split(",") if t.strip()])
    if not symbols:
        raise ValueError("Pass at least one ticker")
    return symbols


@router.get("/bars", response_model=list[stock_data.TickerBars])
async def get_bars(
    tickers: str = TICKERS_QUERY,
    range_: Range | None = Query(None, alias="range"),
    timeframe: Timeframe = "1Day",
    start: datetime | None = None,
    end: datetime | None = None,
):
    """Bars per ticker for either a preset `range` (default 1M) or a custom `start`/`end` window.

    `start` and `end` are ISO 8601 datetimes; values without an offset are read as New York time.
    """
    try:
        return await stock_data.get_bars(
            _parse_tickers(tickers), range_=range_, timeframe=timeframe, start=start, end=end
        )
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=502, detail=f"Alpaca error: {e.response.status_code} {e.response.text}") from e


@router.get("/snapshots", response_model=list[stock_data.Snapshot])
async def get_snapshots(tickers: str = TICKERS_QUERY):
    """Each ticker's latest price, day change and latest session's volume."""
    try:
        return await stock_data.get_snapshots(_parse_tickers(tickers))
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=502, detail=f"Alpaca error: {e.response.status_code} {e.response.text}") from e
