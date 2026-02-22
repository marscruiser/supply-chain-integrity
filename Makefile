# ════════════════════════════════════════════════════════════════
#  SUPPLY CHAIN INTEGRITY SYSTEM — Makefile
# ════════════════════════════════════════════════════════════════
.PHONY: all install up down test clean report help run-vision run-api run-dashboard

SHELL := /bin/bash
PYTHON := python3
NPM := npm
DOCKER := docker compose

## Display help
help:
	@echo ""
	@echo "Supply Chain Integrity System — Available Commands"
	@echo "═══════════════════════════════════════════════════"
	@echo "  make install      Install all dependencies"
	@echo "  make up           Start all services via Docker"
	@echo "  make down         Stop all services"
	@echo "  make test         Run all tests"
	@echo "  make clean        Remove build artifacts"
	@echo "  make report       Generate system report"
	@echo "  make run-vision   Run Module A (Vision API)"
	@echo "  make run-api      Run Module C (FastAPI)"
	@echo "  make run-dashboard Run Module C (React Dashboard)"
	@echo "  make deploy-contracts Deploy smart contracts"
	@echo "  make db-seed      Seed the MongoDB database"
	@echo ""

## Install all dependencies
install:
	@echo "📦 Installing Module A (Vision) dependencies..."
	cd module_a_vision && $(PYTHON) -m pip install -r requirements.txt
	@echo "📦 Installing Module B (Blockchain) dependencies..."
	cd module_b_blockchain && $(NPM) install
	@echo "📦 Installing Module C (API) dependencies..."
	cd module_c_integration/api && $(PYTHON) -m pip install -r requirements.txt
	@echo "📦 Installing Module C (Dashboard) dependencies..."
	cd module_c_integration/dashboard && $(NPM) install
	@echo "✅ All dependencies installed."

## Start all services via Docker Compose
up:
	@echo "🚀 Starting all services..."
	$(DOCKER) up -d --build
	@echo "✅ Services running."
	@echo "   Dashboard:    http://localhost:3000"
	@echo "   API:          http://localhost:8000/docs"
	@echo "   Vision API:   http://localhost:8001/docs"
	@echo "   IPFS Gateway: http://localhost:8080"
	@echo "   Mongo Express:http://localhost:8081"

## Stop all services
down:
	@echo "🛑 Stopping all services..."
	$(DOCKER) down
	@echo "✅ Services stopped."

## Run Module A Vision API locally
run-vision:
	cd module_a_vision && uvicorn api:app --host 0.0.0.0 --port 8001 --reload

## Run Module C FastAPI Backend locally
run-api:
	cd module_c_integration/api && uvicorn main:app --host 0.0.0.0 --port 8000 --reload

## Run Module C React Dashboard locally
run-dashboard:
	cd module_c_integration/dashboard && $(NPM) run dev

## Deploy smart contracts to local blockchain
deploy-contracts:
	@echo "📝 Deploying smart contracts..."
	cd module_b_blockchain && npx hardhat run scripts/deploy.js --network localhost

## Seed MongoDB with initial data
db-seed:
	@echo "🌱 Seeding database..."
	cd module_c_integration && $(PYTHON) database/seed.py

## Run all tests
test: test-vision test-blockchain test-api test-dashboard
	@echo "✅ All tests completed."

test-vision:
	@echo "🧪 Testing Module A (Vision)..."
	cd module_a_vision && $(PYTHON) -m pytest tests/ -v --cov=. --cov-report=html

test-blockchain:
	@echo "🧪 Testing Module B (Blockchain)..."
	cd module_b_blockchain && npx hardhat test

test-api:
	@echo "🧪 Testing Module C (API)..."
	cd module_c_integration/api && $(PYTHON) -m pytest tests/ -v --cov=. --cov-report=html

test-dashboard:
	@echo "🧪 Testing Module C (Dashboard)..."
	cd module_c_integration/dashboard && $(NPM) test -- --watchAll=false

## Generate system performance report
report:
	@echo "📊 Generating system report..."
	cd module_a_vision && $(PYTHON) evaluation/generate_report.py
	cd module_b_blockchain && node scripts/benchmark.js

## Clean all build artifacts
clean:
	@echo "🧹 Cleaning build artifacts..."
	find . -type d -name "__pycache__" -exec rm -rf {} +
	find . -type d -name ".pytest_cache" -exec rm -rf {} +
	find . -type d -name "node_modules" -exec rm -rf {} +
	find . -type d -name "dist" -exec rm -rf {} +
	find . -type d -name "build" -exec rm -rf {} +
	find . -type d -name "cache" -exec rm -rf {} +
	find . -type d -name "artifacts" -exec rm -rf {} +
	@echo "✅ Clean complete."

## Lint all code
lint:
	@echo "🔍 Linting Python..."
	cd module_a_vision && flake8 . --max-line-length=120
	cd module_c_integration/api && flake8 . --max-line-length=120
	@echo "🔍 Linting Solidity..."
	cd module_b_blockchain && npx solhint 'contracts/**/*.sol'
	@echo "🔍 Linting TypeScript..."
	cd module_c_integration/dashboard && $(NPM) run lint
