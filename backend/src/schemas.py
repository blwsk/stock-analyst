from datetime import datetime
from typing import Annotated, Self
from uuid import UUID

from pydantic import (
    AfterValidator,
    BaseModel,
    BeforeValidator,
    ConfigDict,
    Field,
    StringConstraints,
    model_validator,
)

from src.constants import ALLOWED_TIMEFRAMES, MAX_SPAN, Range, Timeframe


def _normalize(ticker: object) -> object:
    return ticker.strip().upper() if isinstance(ticker, str) else ticker


# Normalized before matching (StringConstraints' own to_upper runs after the pattern check), so " brk.b" is stored as
# "BRK.B". Share classes use a dot suffix, as Alpaca expects.
Ticker = Annotated[
    str,
    BeforeValidator(_normalize),
    StringConstraints(pattern=r"^[A-Z]{1,5}(\.[A-Z])?$"),
]


def _dedupe(tickers: list[str]) -> list[str]:
    return list(dict.fromkeys(tickers))


Tickers = Annotated[list[Ticker], Field(max_length=20), AfterValidator(_dedupe)]


class ChartConfig(BaseModel):
    """Chart options: a preset range, or a custom start/end window dragged out on the chart."""

    range: Range | None = None
    timeframe: Timeframe
    start: datetime | None = None
    end: datetime | None = None

    @model_validator(mode="after")
    def check_window(self) -> Self:
        if (self.start is None) != (self.end is None):
            raise ValueError("Pass both start and end, or neither")
        if (self.range is None) == (self.start is None):
            raise ValueError("Pass either range, or start and end")
        if self.range is not None and self.timeframe not in ALLOWED_TIMEFRAMES[self.range]:
            raise ValueError(f"Timeframe {self.timeframe} is not supported for range {self.range}")
        if self.start is not None and self.end is not None:
            if self.start >= self.end:
                raise ValueError("start must be before end")
            max_span = MAX_SPAN[self.timeframe]
            if max_span is not None and self.end - self.start > max_span:
                raise ValueError(f"Timeframe {self.timeframe} supports spans of at most {max_span.days} days")
        return self


class WorkspaceCreate(BaseModel):
    name: str = Field(min_length=1)
    tickers: Tickers = []
    chart: ChartConfig | None = None


class WorkspaceUpdate(BaseModel):
    """Omitted fields are left unchanged. `chart` can be set to null to clear it; the others can't be null."""

    name: str | None = Field(None, min_length=1)
    tickers: Tickers | None = None
    chart: ChartConfig | None = None

    @model_validator(mode="after")
    def check_not_null(self) -> Self:
        for field in ("name", "tickers"):
            if field in self.model_fields_set and getattr(self, field) is None:
                raise ValueError(f"{field} can't be null")
        return self


class Workspace(BaseModel):
    id: UUID
    name: str
    tickers: list[str]
    chart: ChartConfig | None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
