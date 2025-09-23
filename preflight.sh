#!/bin/bash

# preflight.sh: A script to run all CI checks locally.
# This script runs frontend and backend tests, type checks, and linting.
# It exits on the first failure.
#
# Prerequisites:
# - All dependencies must be installed (`uv sync --all-packages --all-extras --active` for python, `npm ci` for frontend).
# - You must be in the root of the repository to run this script.

set -e

# --- Helper Functions ---
step() {
  echo "🚀 === Starting: $1 ==="
}

success() {
  echo "✅ === Finished: $1 ==="
}

# --- Main Script ---

# 1. Frontend Linting (Quick)
step "Frontend Linting"
(cd frontend && npm run lint)
success "Frontend Linting"

# 2. Python Linting & Formatting (Quick)
step "Python Linting & Formatting"
nox -s format lint
success "Python Linting & Formatting"

# 3. Frontend Type Checking
step "Frontend Type Checking"
(cd frontend && npx tsc --noEmit)
success "Frontend Type Checking"

# 4. Python Type Checking
step "Python Type Checking"
nox -s typecheck
success "Python Type Checking"

# 5. Frontend Tests
step "Frontend Tests"
(cd frontend && npx jest --ci)
success "Frontend Tests"

# 6. Python Tests
step "Python Tests"
nox -s test
success "Python Tests"

# 7. Generate API Schema and Types (Slowest)
step "Generating API Schema and Types"
./scripts/generate-api-schema.sh
success "Generating API Schema and Types"

# 8. Check for uncommitted generated files
step "Checking for uncommitted generated files"
GENERATED_FILES=$(git diff --name-only | grep -E '\.(json|ts|tsx)$' | grep -E '(openapi/schema\.json|frontend/types/api)' || true)

if [[ -n "$GENERATED_FILES" ]]; then
  echo "❌ Generated files are out of date!"
  echo "The following generated files have been modified:"
  echo "$GENERATED_FILES"
  echo ""
  echo "Please commit the updated generated files."
  exit 1
else
  echo "✅ All generated files are up to date!"
fi
success "Checking for uncommitted generated files"

echo "🎉🎉🎉 All preflight checks passed! 🎉🎉🎉"
