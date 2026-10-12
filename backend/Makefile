.PHONY: help install db migrate reset-db run test format lint clean

help:
	@echo "Available commands:"
	@echo "  make install    - Install dependencies"
	@echo "  make db         - Run postgres in a container (foreground)"
	@echo "  make migrate    - Run database migrations"
	@echo "  make reset-db   - Downgrade all migrations and re-run them"
	@echo "  make run        - Start the development server"
	@echo "  make test       - Run tests"
	@echo "  make format     - Format code with ruff"
	@echo "  make lint       - Lint code with ruff and mypy"
	@echo "  make clean      - Remove generated files"

install:
	uv sync

db:
	docker compose up postgres

migrate:
	uv run alembic upgrade head

reset-db:
	uv run alembic downgrade base
	uv run alembic upgrade head

run:
	uv run uvicorn src.main:app --reload --host 0.0.0.0 --port 8000

test:
	uv run pytest tests/ -v

format:
	uv run ruff format .
	uv run ruff check --fix .

lint:
	uv run ruff check .
	uv run mypy src

clean:
	rm -rf .venv
	rm -rf **/__pycache__
	rm -rf .pytest_cache
	rm -rf .ruff_cache
	rm -rf .mypy_cache
