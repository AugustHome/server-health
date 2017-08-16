#!/usr/bin/env bash

# script: cibuild
# description: Sets up the CI environment and runs the test suite


set -e
[ -z "$DEBUG" ] || set -x

# make sure we're in the project root
cd "$(dirname "$0")/.."
APP_ROOT="$(pwd)"

./scripts/bootstrap.sh
./scripts/test.sh
