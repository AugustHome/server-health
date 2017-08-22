#!/usr/bin/env bash

# script: setup
# description: set up application for the first time after cloning.


set -e
[ -z "$DEBUG" ] || set -x

# make sure we're in the project root
cd "$(dirname "$0")/.."
APP_ROOT="$(pwd)"

npm run bootstrap
