# Helper targets for Animator Studio workflows
# Run `make` with no arguments (or `make help`) to see available commands.

SHELL := /bin/bash
NPM ?= npm
NPX ?= npx
PLAYWRIGHT ?= $(NPX) playwright
HTTP_SERVER ?= $(NPX) http-server
ROOT_DIR := $(CURDIR)

.DEFAULT_GOAL := help

.PHONY: all help install browsers test test-ui test-debug run clean-reports

all: help

help: ## Show available commands
	@printf "Animator Studio helpers:\n"
	@printf "  %-18s %s\n" "make help" "Show available commands"
	@printf "  %-18s %s\n" "make install" "Install npm dependencies"
	@printf "  %-18s %s\n" "make browsers" "Download Playwright browser bundle"
	@printf "  %-18s %s\n" "make test" "Run the headless regression suite"
	@printf "  %-18s %s\n" "make test-ui" "Open the Playwright UI runner"
	@printf "  %-18s %s\n" "make test-debug" "Launch Playwright in debug mode"
	@printf "  %-18s %s\n" "make run" "Start a static dev server on localhost:4173"
	@printf "  %-18s %s\n" "make clean-reports" "Remove Playwright reports and artifacts"

install: ## Install npm dependencies
	$(NPM) install

browsers: ## Download Playwright browser bundle
	$(PLAYWRIGHT) install

# End-to-end regression suite (depends on Playwright browsers being present).
test: browsers ## Run the headless regression suite
	$(NPM) test

# Launch the interactive Playwright UI runner.
test-ui: browsers ## Open the Playwright UI runner
	$(NPM) run test:ui

# Launch the Playwright debugger.
test-debug: browsers ## Launch Playwright in debug mode
	$(NPM) run test:debug

# Serve the app locally via http-server (Ctrl+C to stop).
run: ## Start a static dev server on http://localhost:4173
	$(HTTP_SERVER) $(ROOT_DIR) -c-1 -p 4173

# Remove generated reports from previous runs.
clean-reports: ## Remove Playwright reports and artifacts
	rm -rf $(ROOT_DIR)/playwright-report $(ROOT_DIR)/test-results
