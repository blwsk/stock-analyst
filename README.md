# Stock Analyst

![A workspace charting EBAY and META over one day, with a note's tooltip, the price table and the notes list](docs/screenshot.png)

A full stack app for exploring S&P 500 stock price data.

- **Workspaces:** chart one or more tickers over a preset range or a window dragged out on the chart. Each workspace saves its chart options and refreshes prices every 15 seconds.
- **Table:** each ticker's live price, day change and volume, sortable by column.
- **Notes:** pinned to a point in time, drawn on the chart and listed below it.
- **AI:** describe what you want to analyze. An agent searches the web for the relevant tickers and dates, and creates a workspace for them.

## Prerequisites

- [uv](https://github.com/astral-sh/uv) (Python 3.12)
- [bun](https://bun.sh)
- [Docker](https://www.docker.com/) (runs Postgres)

You'll also need API keys for:

- [Alpaca](https://alpaca.markets): stock prices. A free account works; use the API key and secret from its dashboard.
- [OpenAI](https://platform.openai.com/api-keys): the AI agent's model.
- [Parallel](https://platform.parallel.ai): the AI agent's web search.

## Setup

1. Install dependencies:

   ```bash
   make deps
   ```

2. Create `backend/.env.local` with your Alpaca keys:

   ```bash
   ALPACA_CLIENT_ID=your-alpaca-api-key-id
   ALPACA_CLIENT_SECRET=your-alpaca-api-secret
   ```

3. Create `frontend/.env.local` with your OpenAI and Parallel keys:

   ```bash
   OPENAI_API_KEY=your-openai-key
   PARALLEL_API_KEY=your-parallel-key
   ```

   Both `.env.local` files are gitignored.

4. Start everything (Postgres, backend and frontend) in the gopm3 TUI:

   ```bash
   make dev
   ```

5. The first time, once Postgres is up, create the tables in another terminal:

   ```bash
   cd backend && make migrate
   ```

Then open http://localhost:3001/workspace.

- Frontend: http://localhost:3001
- Backend: http://localhost:8000 (Swagger UI at http://localhost:8000/docs)
- Postgres: `postgresql://postgres:postgres@localhost:5432/stock_analyst`

`make dev` uses the gopm3 binary for Apple Silicon Macs. Elsewhere, run each service in its own terminal:

```bash
cd backend && make db     # Postgres in Docker
cd backend && make run    # FastAPI on :8000
cd frontend && bun run dev  # Next.js on :3001
```

## Common Commands

```bash
make test                   # backend tests
make lint                   # ruff + mypy for the backend, tsc for the frontend
cd backend && make migrate  # apply new migrations
cd backend && make reset-db # drop all tables and re-create them (deletes all data)
```

To open a SQL shell on the database:

```bash
cd backend && docker compose exec postgres psql -U postgres -d stock_analyst
```

## Configuration

The backend reads settings from environment variables or `backend/.env.local`:

| Variable               | Default                                                       |
| ---------------------- | ------------------------------------------------------------- |
| `ALPACA_CLIENT_ID`     | (required)                                                    |
| `ALPACA_CLIENT_SECRET` | (required)                                                    |
| `DATABASE_URL`         | `postgresql://postgres:postgres@localhost:5432/stock_analyst` |
| `CORS_ORIGINS`         | `["http://localhost:3001"]`                                   |

The frontend reads `OPENAI_API_KEY` and `PARALLEL_API_KEY` from `frontend/.env.local`. It also reads `NEXT_PUBLIC_API_URL`, the backend's URL, which defaults to `http://localhost:8000`.

## Data Limitations

Alpaca's free plan only includes data from the IEX exchange:

- Price history starts on July 27, 2020. Windows before that, such as the COVID crash in early 2020, have no data.
- Volume counts only shares traded on IEX, a fraction of total market volume.

## Project Structure

```
.
├── backend/                  # FastAPI service (uv)
│   ├── alembic/versions/     # Database migrations
│   ├── src/
│   │   ├── config.py         # Settings
│   │   ├── constants.py      # Ranges, timeframes and their limits
│   │   ├── database.py       # asyncpg connection pool
│   │   ├── schemas.py        # Pydantic request/response models
│   │   ├── routers/          # /stocks (bars, snapshots) and /workspaces (+ notes)
│   │   ├── services/         # Alpaca client
│   │   └── main.py           # FastAPI app
│   ├── tests/
│   ├── docker-compose.yml    # Postgres
│   └── Makefile
├── frontend/                 # Next.js app (bun)
│   ├── app/
│   │   ├── api/chat/         # AI agent endpoint
│   │   └── workspace/        # Agent composer (/workspace) and workspaces (/workspace/[id])
│   ├── components/
│   └── lib/
│       ├── agent.ts          # AI agent and its tools
│       └── api.ts            # Backend client / SWR fetcher
├── gopm3.config.json         # Processes run by `make dev`
└── Makefile
```

## Tech Stack

**Backend:** FastAPI, Pydantic, asyncpg, Alembic, Postgres, pytest, ruff, mypy

**Frontend:** Next.js, React, TypeScript, Tailwind, SWR, Recharts, AI SDK (OpenAI + Parallel web search)
