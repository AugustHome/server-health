#!/usr/bin/env bash

# script: update
# description: update the application's required environment like database migrations and dependencies


set -e
[ -z "$DEBUG" ] || set -x

# make sure we're in the project root
cd "$(dirname "$0")/.."
APP_ROOT="$(pwd)"

npm run bootstrap
