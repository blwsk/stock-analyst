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


@router.get("/bars", response_model=list[stock_data.TickerBars])
async def get_bars(
    tickers: str = Query(description="Comma-separated, e.g. AAPL,MSFT"),
    range_: Range | None = Query(None, alias="range"),
    timeframe: Timeframe = "1Day",
    start: datetime | None = None,
    end: datetime | None = None,
):
    """Bars per ticker for either a preset `range` (default 1M) or a custom `start`/`end` window.

    `start` and `end` are ISO 8601 datetimes; values without an offset are read as New York time.
    """
    try:
        # A pydantic ValidationError is a ValueError, so bad tickers are reported as 422s below.
        symbols = TICKERS.validate_python([t for t in tickers.split(",") if t.strip()])
        if not symbols:
            raise ValueError("Pass at least one ticker")
        return await stock_data.get_bars(symbols, range_=range_, timeframe=timeframe, start=start, end=end)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=502, detail=f"Alpaca error: {e.response.status_code} {e.response.text}") from e
