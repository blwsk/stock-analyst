from datetime import datetime

import httpx
from fastapi import APIRouter, HTTPException, Query

from src.services import stock_data

router = APIRouter(prefix="/stocks", tags=["stocks"])


@router.get("/{ticker}/bars", response_model=list[stock_data.Bar])
async def get_bars(
    ticker: str,
    range_: stock_data.Range | None = Query(None, alias="range"),
    timeframe: stock_data.Timeframe = "1Day",
    start: datetime | None = None,
    end: datetime | None = None,
):
    """Bars for either a preset `range` (default 1M) or a custom `start`/`end` window.

    `start` and `end` are ISO 8601 datetimes; values without an offset are read as New York time.
    """
    try:
        return await stock_data.get_bars(ticker, range_=range_, timeframe=timeframe, start=start, end=end)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=502, detail=f"Alpaca error: {e.response.status_code} {e.response.text}") from e
