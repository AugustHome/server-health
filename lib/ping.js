'use strict';

var getRepoInfo = require('git-repo-info');

var isInitialized = false;
var startTime = new Date();
var serverPackage;
var gitInfo;
var connectionChecks = {};


/**
 * Initializes the ping module.
 * Loads the server's package.json
 *
 */
function init() {
  serverPackage = require(process.cwd() + '/package.json');
  gitInfo = getRepoInfo();

  isInitialized = true;
}

/**
 * ping controller
 *
 * @param {Server} server - Restify server instance
 * @param {string} [endpoint=/ping] - name of endpoint where to expose the status information
 */
module.exports.exposePingEndpoint = function (server, endpoint) {
  if (!isInitialized) {
    init();
  }

  server.get((endpoint || '/ping'), pingHandler);
};

/**
 * Provides the GET /ping endpoint
 *
 * @param {http.IncomingMessage} req - request object
 * @param {http.ServerResponse} res - response object
 * @param {Function} next
 */
function pingHandler(req, res, next) {
  var status = {
    status: 'fail',
    uptime: process.uptime(),
    upSince: startTime,
    localTime: new Date(),
    service: {
      name: serverPackage.name,
      description: serverPackage.description,
      version: serverPackage.version,
      repository: serverPackage.repository
    },
    connections: {},
    env: {
      nodeEnv: process.env.NODE_ENV,
      nodeVersion: process.version,
      processName: process.title,
      pid: process.pid,
      cwd: process.cwd()
    },
    git: {
      commitHash: gitInfo.sha,
      branchName: gitInfo.branch,
      tag: gitInfo.tag
    }
  };

  var failedConnections = [];
  Object.keys(connectionChecks).forEach(function (name) {
    var connectionStatus = connectionChecks[name]();

    status.connections[name] = connectionStatus ? 'ok' : 'fail';

    if (!connectionStatus) {
      failedConnections.push(name);
    }
  });

  // update status if any connection failed
  if (failedConnections.length > 0) {
    status.status = 'fail:' + failedConnections.join(',');
  } else {
    status.status = 'ok';
  }

  res.send(status);
  next();
}

/**
 * Adds a check for dependency service availability
 *
 * @param {string} name - name used under the connections in the /ping endpoint
 * @param {Function} check - function to execute to check a connection
 */
module.exports.addConnectionCheck = function (name, check) {
  connectionChecks[name] = check;
};
