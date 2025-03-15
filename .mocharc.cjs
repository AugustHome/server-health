'use strict';

// Using .cjs to make it easier to run mocha under Node 18
// once we drop Node 18, we can change this to ESM, too

process.env.NODE_ENV = 'test';

const defaultConfig = {
  // spec: 'test/**/*.js',
  recursive: true,
  timeout: 10000,
  colors: true,
  ui: 'bdd',
  reporter: 'list',
  exit: true,
};

if (process.version.startsWith('v18')) {
  // Fastify v5 requires Node 20
  // monkey-patching diagnostics_channel in Node 18 to make it run under Node 18
  defaultConfig.require = [
    './test/mock-diagnostics-channel.cjs',
  ];
}

let ciConfigOverride = {};
if (process.env.CI) {
  ciConfigOverride = {
    forbidOnly: true,
    reporter: 'mocha-multi',
    reporterOptions: {
      list: '-',
      xunit: './test-results/mocha.xml',
    },
  };
}

const mergedConfig = Object.assign({}, defaultConfig, ciConfigOverride);

// export default mergedConfig
module.exports = mergedConfig;
