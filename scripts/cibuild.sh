#!/usr/bin/env bash

# script: cibuild
# description: Sets up the CI environment and runs the test suite


set -e
[ -z "$DEBUG" ] || set -x

# make sure we're in the project root
cd "$(dirname "$0")/.."
APP_ROOT="$(pwd)"

echo ""
echo "===> Installing Dependencies ..."
echo ""
npm ci
echo ""

echo "===> Running Linter ..."
npm run lint --silent 2>&1
if [ "$?" -gt "0" ]; then
  echo "Lint error(s) found in above file(s)."
  exit 1
fi

# run tests
./scripts/test.sh -c
