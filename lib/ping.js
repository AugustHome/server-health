'use strict';

var getRepoInfo = require('git-repo-info');

var extract = require('august-extract');

var config;
var model;
var startTime = new Date();
var serverInstance;
var serverPackage;
var gitInfo;
var connectionChecks = {};


/**
 * Initializes the ping module.
 * Loads the server's
 *
 * @param {Object} options
 * @param {Object} options.config - server configuration
 * @param {Object} options.model - instance of august-model
 */
module.exports.init = function (options) {
  config = extract(options, 'config');
  model = extract(options, 'model');

  var serverPackagePath = process.cwd() + '/package.json';
  serverPackage = require(serverPackagePath);

  gitInfo = getRepoInfo();
};

/**
 * ping controller
 *
 * @param {restify.Server} server - Restify server instance
 * @param {string} [endpointName=ping] - name of endpoint where to expose the status information
 */
module.exports.exposePingEndpoint = function (server, endpointName) {
  serverInstance = server;

  server.get('/' + (endpointName || 'ping'), getPingHandler);
};

/**
 * Provides the GET /ping endpoint
 *
 * @param {http.IncomingMessage} req - request object
 * @param {http.ServerResponse} res - response object
 * @param {Function} next
 */
function getPingHandler(req, res, next) {
  var pingData = {
    uptime: process.uptime(),
    upSince: startTime,
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

  if (config.db) {
    pingData.connections.mongodb = isDatabaseConnected();
  }

  Object.keys(connectionChecks).forEach(function (name) {
    pingData.connections[name] = connectionChecks[name]();
  });

  res.send(pingData);
  next();
}

/**
 * Checks whether the database connection is available
 *
 * @return {boolean}
 */
function isDatabaseConnected() {
  var augustDbConnected = false;
  var augustDbUrl = config.db.august.url;

  if (model.connections.length >= 1) {
    if (model.connections[0].s.options.url === augustDbUrl) {
      augustDbConnected = true;
    }
  }

  return augustDbConnected;
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
