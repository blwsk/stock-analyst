# Architecture

The basic frontend/backend split is as follows:

- FastAPI Python backend service using PostgreSQL + SQLAlchemy + Alembic for data persistence and schema migrations and Pydantic for data validation and schema illustration
  - Workspaces contain stock tickers and chart configration (time ranges, data precision)
  - Notes can be written directly to charts, allowing for annotation at particular points in time and are bound to single workspaces. Notes are not specific to individual tickers.
- Next.js + TypeScript + React + Tailwind CSS front-end application
  - Recharts is used for data visualization and charting
  - Vercel's AI SDK is used to facilitate workspace generation from an input user query and interacts with Parallel for web search, OpenAI for their gpt 6 luna model, and our internal workspace creation endpoint

## Data vendor chosen

I arrived at https://alpaca.markets to populate stock price data and some additional coarse per-stock data like price change, traded volume, etc.
