'use strict';

var getRepoInfo = require('git-repo-info');

var extract = require('august-extract');

var config;
var model;
var startTime = new Date();
var serverInstance;
var serverPackage;
var serverRoutes;
var gitInfo;


/**
 * Initializes the ping module.
 * Loads the server's
 *
 * @param {Object} options
 * @param {Object} options.config - server configuration
 * @param {Object} options.model - instance of august-model
 * @param {Object} options.package - the server's package.json
 */
module.exports.init = function (options) {
  config = extract(options, 'config');
  model = extract(options, 'model');
  serverPackage = extract(options, 'package');

  gitInfo = getRepoInfo();
};

/**
 * ping controller
 *
 * @param {restify.Server} server - Restify server instance
 */
module.exports.exposePingEndpoint = function (server) {
  serverInstance = server;

  server.get('/ping', getPingHandler);
  serverRoutes = getServerRoutes(server);
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
    },
    server: {
      routes: serverRoutes
    }
  };

  if (config.db) {
    pingData.connections.mongo = isDatabaseConnected();
  }

  res.send(pingData);
  next();
}

/**
 * Extracts the server's routes into an array
 *
 * @param {restify.Server} server - Restify server instance
 * @return {string[]} array of routes: 'METHOD /path'
 */
function getServerRoutes(server) {
  var router = server.router;
  var routes = [];

  Object.keys(router.mounts).forEach(function (routeKey) {
    var spec = router.mounts[routeKey].spec;
    routes.push(spec.method + ' ' + spec.path);
  });

  return routes;
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
