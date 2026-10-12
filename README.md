# Stock Analyst

A full stack app for exploring S&P 500 stock price data.

## Prerequisites

- [uv](https://github.com/astral-sh/uv) (Python 3.12)
- [bun](https://bun.sh)

## Quick Start

```bash
make deps   # install root, backend and frontend dependencies
make dev    # run backend + frontend together in the gopm3 TUI
```

- Frontend: http://localhost:3001
- Backend: http://localhost:8000 (Swagger UI at http://localhost:8000/docs)

To run the services individually:

```bash
cd backend && make run
cd frontend && bun run dev
```

## Project Structure

```
.
├── backend/            # FastAPI service (uv)
│   ├── src/
│   │   ├── config.py   # Settings
│   │   └── main.py     # FastAPI app
│   ├── tests/
│   ├── Makefile
│   └── pyproject.toml
├── frontend/           # Next.js app (bun)
│   ├── app/
│   └── lib/api.ts      # API client / SWR fetcher
├── gopm3.config.json   # Processes run by `make dev`
└── Makefile
```

## Tech Stack

**Backend:** FastAPI, Pydantic, pytest, ruff, mypy

**Frontend:** Next.js, React, TypeScript, SWR
