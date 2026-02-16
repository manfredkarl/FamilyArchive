#!/bin/bash
set -e

# Install npm dependencies
npm install
cd src/web && npm install && cd ../..
cd src/api && npm install && cd ../..

# Install Playwright browsers and system dependencies
npx playwright install-deps
npx playwright install

# Install Python docs tooling
pip install mkdocs mkdocs-material
