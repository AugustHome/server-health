'use strict';

var extract = require('august-extract');

var config;
var model;
var startTime = new Date();
var serverInstance;
var serverPackage;


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
};

/**
 * ping controller
 *
 * @param {restify.Server} server - Restify server instance
 */
module.exports.exposePingEndpoint = function (server) {
  serverInstance = server;

  server.get('/ping', getPingHandler);
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
    version: serverPackage.version,
    connections: {},
    env: {
      nodeEnv: process.env.NODE_ENV,
      nodeVersion: process.version,
      processName: process.title,
      pid: process.pid
    }
  };

  // TODO add routes from server
  // TODO add git info if available


  if (config.db) {
    pingData.connections.mongo = isDatabaseConnected();
  }

  res.send(pingData);
  return next();
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
