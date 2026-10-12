export type Bar = {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export const TIMEFRAMES = ["1Min", "5Min", "15Min", "1Hour", "1Day"] as const;

export type Timeframe = (typeof TIMEFRAMES)[number];

export const RANGES = ["1D", "5D", "1M", "6M", "1Y"] as const;

export type Range = (typeof RANGES)[number];

// Mirrors ALLOWED_TIMEFRAMES in backend/src/constants.py.
export const ALLOWED_TIMEFRAMES: Record<Range, readonly Timeframe[]> = {
  "1D": ["1Min", "5Min", "15Min", "1Hour"],
  "5D": ["1Min", "5Min", "15Min", "1Hour", "1Day"],
  "1M": ["1Min", "5Min", "15Min", "1Hour", "1Day"],
  "6M": ["1Hour", "1Day"],
  "1Y": ["1Hour", "1Day"],
};

// Used when switching to a range that doesn't support the current timeframe.
export const DEFAULT_TIMEFRAME: Record<Range, Timeframe> = {
  "1D": "5Min",
  "5D": "15Min",
  "1M": "1Day",
  "6M": "1Day",
  "1Y": "1Day",
};

/** Mirrors ChartConfig in backend/src/schemas.py: a preset range, or a custom start/end window. */
export type ChartConfig = {
  range: Range | null;
  timeframe: Timeframe;
  start: string | null;
  end: string | null;
};

export type Workspace = {
  id: string;
  name: string;
  tickers: string[];
  chart: ChartConfig | null;
  created_at: string;
  updated_at: string;
};
