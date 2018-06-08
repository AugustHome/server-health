#!/usr/bin/env bash

# script: bootstrap
# description: resolve all dependencies required for the app to run.


set -e
[ -z "$DEBUG" ] || set -x

# make sure we're in the project root
cd "$(dirname "$0")/.."
APP_ROOT="$(pwd)"

if [ -f ".nvmrc" ]; then
  HAS_NVM=false

  # if started through `npm run` we need to unset this to use nvm
  unset npm_config_prefix

  if [ -f "$HOME/.nvm/nvm.sh" ]; then
    . "$HOME/.nvm/nvm.sh"
    HAS_NVM=true
  elif [ -n "$(which brew)" ] && [ -f "$(brew --prefix nvm)/nvm.sh" ]; then
    . "$(brew --prefix nvm)/nvm.sh"
    HAS_NVM=true
  fi

  if [ "$HAS_NVM" = true ]; then
    echo "===> Installing Node.js ..."
    nvm install "$(< .nvmrc)"
  fi
fi

echo ""
echo "===> Installing Dependencies ..."
echo ""
npm install
echo ""
