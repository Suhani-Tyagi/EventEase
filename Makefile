.PHONY: help install run test lint format check clean

VENV ?= ./venv
PYTHON = $(VENV)/bin/python
ifeq ($(OS),Windows_NT)
    PYTHON = $(VENV)/Scripts/python.exe
endif

help:
	@echo "Available commands:"
	@echo "  make install  - Install pinned dependencies"
	@echo "  make run      - Run application server locally"
	@echo "  make test     - Run pytest with coverage >= 90%"
	@echo "  make lint     - Run ruff linter and mypy type checker"
	@echo "  make format   - Run ruff formatting and fixes"
	@echo "  make clean    - Remove build artifacts and caches"

install:
	$(PYTHON) -m pip install -r requirements.txt

run:
	$(PYTHON) -m uvicorn app.main:create_app --factory --host 127.0.0.1 --port 8000 --reload

test:
	$(PYTHON) -m pytest

lint:
	$(PYTHON) -m ruff check app tests
	$(PYTHON) -m mypy app tests

format:
	$(PYTHON) -m ruff check --fix app tests
	$(PYTHON) -m ruff format app tests

clean:
	rm -rf .pytest_cache .ruff_cache .mypy_cache .coverage htmlcov
