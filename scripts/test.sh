#!/usr/bin/env bash

# script: test
# description: Run the test suite, optionally with coverage report.

clear

export NODE_ENV=test
export BLUEBIRD_DEBUG=1
set -e
[ -z "$DEBUG" ] || set -x

# make sure we're in the project root
cd "$(dirname "$0")/.."
APP_ROOT="$(pwd)"

# find Node if it hasn't been set through npm
if [ -z "$NODE" ]; then
  NODE="$(which node)"
fi


# read options
USE_COVERAGE=""
TEST_FILE=""

while getopts ":ct:" opt; do
  case ${opt} in
    c)
      USE_COVERAGE=true
      ;;
    t)
      TEST_FILE=$OPTARG
      ;;
  esac
done


MOCHA="$PWD/node_modules/.bin/mocha"
MOCHA_OPTS="--exit \
 --timeout 10000 \
 --colors \
 --ui bdd \
 --reporter=list"

if [ ${CI} ]; then
  # Running in CI
  MOCHA_OPTS="${MOCHA_OPTS} \
    --forbid-only \
    --reporter=mocha-multi \
    --reporter-options list=-,xunit=./test-results/mocha.xml"
fi

# what to test
if [ ${TEST_FILE} ]; then
  # just one specific test file
  MOCHA_OPTS="${MOCHA_OPTS} ${TEST_FILE}"
else
  # run all tests
  MOCHA_OPTS="${MOCHA_OPTS} --recursive ./test/"
fi

# create coverage report?
if [ ${USE_COVERAGE} ]; then
  MOCHA="$PWD/node_modules/.bin/nyc --reporter=html --reporter=text mocha"
fi

# environment information
echo "Node.js version: $(${NODE} --version)"
echo "npm version: $(npm -v)"
echo "Mocha version: $(${MOCHA} --version)"
echo "NODE_ENV=${NODE_ENV}"
echo ""

# start tests
echo "===> Running tests ..."
${MOCHA} ${MOCHA_OPTS}
