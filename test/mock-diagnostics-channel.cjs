// scripts/mock-diagnostics-channel.cjs
const diagnostics = require('node:diagnostics_channel');

if (!diagnostics.tracingChannel) {
  diagnostics.tracingChannel = function() {
    return {
      asyncStart: { publish: () => {} },
      asyncEnd: { publish: () => {} },
      error: { publish: () => {} }
    };
  };
}
