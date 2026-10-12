from calendar import monthrange
from datetime import date, datetime, time, timedelta

import httpx
from pydantic import BaseModel

from src.config import settings
from src.constants import ALLOWED_TIMEFRAMES, MARKET_TZ, MAX_SPAN, MONTH_RANGES, TRADING_DAY_RANGES, Range, Timeframe


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


def _as_market_time(dt: datetime) -> datetime:
    """Treat naive datetimes as New York time."""
    return dt.replace(tzinfo=MARKET_TZ) if dt.tzinfo is None else dt


def _window(
    range_: Range | None,
    timeframe: Timeframe,
    start: datetime | None,
    end: datetime | None,
    now: datetime,
) -> tuple[datetime, datetime | None]:
    """Resolve the query to an explicit (start, end) window, validating it along the way.

    Exactly one of `range_` and `start` must be given. `end` defaults to now; with a range, the range counts back
    from `end`.
    """
    if (range_ is None) == (start is None):
        raise ValueError("Pass either range or start, not both")
    end = _as_market_time(end) if end is not None else None

    if range_ is not None:
        if timeframe not in ALLOWED_TIMEFRAMES[range_]:
            raise ValueError(f"Timeframe {timeframe} is not supported for range {range_}")
        anchor = (end or now).astimezone(MARKET_TZ).date()
        return datetime.combine(_start_date(range_, anchor), time(), MARKET_TZ), end

    assert start is not None
    start = _as_market_time(start)
    if start >= (end or now):
        raise ValueError("start must be before end")
    max_span = MAX_SPAN[timeframe]
    if max_span is not None and (end or now) - start > max_span:
        raise ValueError(f"Timeframe {timeframe} supports spans of at most {max_span.days} days")
    return start, end


async def get_bars(
    ticker: str,
    range_: Range | None = None,
    timeframe: Timeframe = "1Day",
    start: datetime | None = None,
    end: datetime | None = None,
) -> list[Bar]:
    """Fetch `timeframe` bars for `ticker` from Alpaca, covering either `range_` or `start`–`end`.

    With neither `range_` nor `start`, defaults to the last month.
    """
    if range_ is None and start is None:
        range_ = "1M"
    window_start, window_end = _window(range_, timeframe, start, end, datetime.now(MARKET_TZ))

    params: dict[str, str | int] = {
        "timeframe": timeframe,
        "start": window_start.isoformat(),
        "limit": 10000,
        # The free plan only allows the IEX feed for recent data.
        "feed": "iex",
    }
    if window_end is not None:
        params["end"] = window_end.isoformat()
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
