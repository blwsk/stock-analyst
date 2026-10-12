.PHONY: deps dev local-backend local-frontend test lint

deps: ## Install backend and frontend dependencies
	bun install
	cd backend && uv sync
	cd frontend && bun install

dev: ## Run backend and frontend together in the gopm3 TUI
	node_modules/@hspak/gopm3/bin/gen-gopm3-darwin-arm64

local-backend:
	cd backend && make run

local-frontend:
	cd frontend && bun run dev

test:
	cd backend && make test

lint:
	cd backend && make lint
	cd frontend && bun run typecheck
