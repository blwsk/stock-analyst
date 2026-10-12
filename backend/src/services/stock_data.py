from calendar import monthrange
from datetime import date, datetime, timedelta
from typing import Literal
from zoneinfo import ZoneInfo

import httpx
from pydantic import BaseModel

from src.config import settings

Timeframe = Literal["1Min", "5Min", "15Min", "1Hour", "1Day"]
Range = Literal["1D", "5D", "1M", "6M", "1Y"]

# Timeframes allowed for each range, keeping responses to at most ~10k bars so charts stay usable.
ALLOWED_TIMEFRAMES: dict[Range, list[Timeframe]] = {
    "1D": ["1Min", "5Min", "15Min", "1Hour"],
    "5D": ["1Min", "5Min", "15Min", "1Hour", "1Day"],
    "1M": ["1Min", "5Min", "15Min", "1Hour", "1Day"],
    "6M": ["1Hour", "1Day"],
    "1Y": ["1Hour", "1Day"],
}

# Day ranges count trading sessions rather than calendar days, so "1D" is the latest session even on a weekend.
TRADING_DAY_RANGES: dict[Range, int] = {"1D": 1, "5D": 5}
MONTH_RANGES: dict[Range, int] = {"1M": 1, "6M": 6, "1Y": 12}

MARKET_TZ = ZoneInfo("America/New_York")


class Bar(BaseModel):
    timestamp: datetime
    open: float
    high: float
    low: float
    close: float
    volume: int


def _months_ago(d: date, months: int) -> date:
    years, month_index = divmod(d.month - 1 - months, 12)
    year, month = d.year + years, month_index + 1
    return date(year, month, min(d.day, monthrange(year, month)[1]))


def _start_date(range_: Range, today: date) -> date:
    if range_ in TRADING_DAY_RANGES:
        # Over-fetch to cover weekends and holidays; trimmed to the last N sessions afterwards.
        return today - timedelta(days=TRADING_DAY_RANGES[range_] * 2 + 4)
    return _months_ago(today, MONTH_RANGES[range_])


def _last_sessions(bars: list[Bar], sessions: int) -> list[Bar]:
    dates = sorted({bar.timestamp.astimezone(MARKET_TZ).date() for bar in bars})
    keep = set(dates[-sessions:])
    return [bar for bar in bars if bar.timestamp.astimezone(MARKET_TZ).date() in keep]


async def get_bars(ticker: str, range_: Range = "1M", timeframe: Timeframe = "1Day") -> list[Bar]:
    """Fetch `timeframe` bars for `ticker` covering `range_` from Alpaca."""
    if timeframe not in ALLOWED_TIMEFRAMES[range_]:
        raise ValueError(f"Timeframe {timeframe} is not supported for range {range_}")

    params: dict[str, str | int] = {
        "timeframe": timeframe,
        "start": _start_date(range_, datetime.now(MARKET_TZ).date()).isoformat(),
        "limit": 10000,
        # The free plan only allows the IEX feed for recent data.
        "feed": "iex",
    }
    bars: list[Bar] = []

    async with httpx.AsyncClient(
        base_url=settings.alpaca_data_url,
        headers={
            "APCA-API-KEY-ID": settings.alpaca_client_id,
            "APCA-API-SECRET-KEY": settings.alpaca_client_secret,
        },
    ) as client:
        while True:
            response = await client.get(f"/v2/stocks/{ticker.upper()}/bars", params=params)
            response.raise_for_status()
            body = response.json()
            bars.extend(
                Bar(timestamp=b["t"], open=b["o"], high=b["h"], low=b["l"], close=b["c"], volume=b["v"])
                for b in body["bars"] or []
            )
            if not body.get("next_page_token"):
                break
            params["page_token"] = body["next_page_token"]

    if range_ in TRADING_DAY_RANGES:
        return _last_sessions(bars, TRADING_DAY_RANGES[range_])
    return bars
