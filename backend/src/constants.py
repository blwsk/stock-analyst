from datetime import timedelta
from typing import Literal
from zoneinfo import ZoneInfo

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

# Longest custom start/end span per timeframe, matching the coarsest range each timeframe is allowed for above.
MAX_SPAN: dict[Timeframe, timedelta | None] = {
    "1Min": timedelta(days=31),
    "5Min": timedelta(days=31),
    "15Min": timedelta(days=31),
    "1Hour": timedelta(days=366),
    "1Day": None,
}

MARKET_TZ = ZoneInfo("America/New_York")
