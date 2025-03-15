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

export default Object.assign({}, defaultConfig, ciConfigOverride);
