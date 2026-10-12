export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// At most one refresh of the same market data per 15s. Alpaca's free plan allows 200 requests a minute, and a
// refresh is one request per page of bars.
export const POLL_MS = 15_000;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, init);
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText}`);
  }
  return res.json();
}

export function fetcher<T>(path: string): Promise<T> {
  return request(path);
}

function sendJSON<T>(method: string, path: string, body: unknown): Promise<T> {
  return request(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export const postJSON = <T>(path: string, body: unknown) =>
  sendJSON<T>("POST", path, body);

export const patchJSON = <T>(path: string, body: unknown) =>
  sendJSON<T>("PATCH", path, body);
