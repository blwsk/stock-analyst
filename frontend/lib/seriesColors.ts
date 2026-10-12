// Distinct line colors for a workspace's tickers, in ticker order; reused past the end.
const COLORS = [
  "#2563eb", // blue
  "#dc2626", // red
  "#16a34a", // green
  "#d97706", // amber
  "#9333ea", // purple
  "#0891b2", // cyan
  "#db2777", // pink
  "#4b5563", // gray
];

export function seriesColor(index: number): string {
  return COLORS[index % COLORS.length];
}
