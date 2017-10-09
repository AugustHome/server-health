'use strict';

var getRepoInfo = require('git-repo-info');
var Promise = require('bluebird');

var isInitialized = false;
var startTime = new Date();
var serverPackage;
var gitInfo;
var connectionChecks = [];


/**
 * Initializes the health module.
 * Loads the server's package.json
 *
 */
function init() {
  serverPackage = require(process.cwd() + '/package.json');
  gitInfo = getRepoInfo();

  isInitialized = true;
}

/**
 * Health controller
 *
 * @param {Server} server - Restify server instance
 * @param {string} [endpoint=/health] - name of endpoint where to expose the status information
 */
module.exports.exposeHealthEndpoint = function (server, endpoint) {
  if (!isInitialized) {
    init();
  }

  server.get((endpoint || '/health'), healthHandler);
};

/**
 * Provides the GET /health endpoint
 *
 * @param {http.IncomingMessage} req - request object
 * @param {http.ServerResponse} res - response object
 * @param {Function} next
 */
function healthHandler(req, res, next) {
  var status = {
    status: 'fail',
    uptime: process.uptime(),
    upSince: startTime,
    localTime: new Date(),
    service: {
      name: serverPackage.name,
      description: serverPackage.description,
      version: serverPackage.version,
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
  Promise.map(connectionChecks, function (connectionCheck, index) {
    var name = connectionChecks[index].checkName;

    // execute connection check, may be sync or async (Promise)
    return Promise.try(connectionCheck).
    then(function (result) {
      var connectionStatus = result;

      if (typeof connectionStatus !== 'boolean') {
        throw new Error('connection check for ' + name + ' must return boolean, got ' + typeof connectionStatus)
      }

      status.connections[name] = connectionStatus ? 'ok' : 'fail';

      if (!connectionStatus) {
        failedConnections.push(name);
      }
    }).
    catch(function () {
      status.connections[name] = 'fail';
      failedConnections.push(name);
    });
  }).
  then(function () {
    // update status if any connection failed
    if (failedConnections.length > 0) {
      status.status = 'fail:' + failedConnections.join(',');
    } else {
      status.status = 'ok';
    }

    res.send(status);
    next();
  }).
  catch(function (err) {
    next(err);
  });
}

/**
 * Adds a check for dependency service availability
 *
 * @param {string} name - name used under the connections in the /health endpoint
 * @param {Function} connectionCheck - function to execute to check a connection
 */
module.exports.addConnectionCheck = function (name, connectionCheck) {
  connectionCheck.checkName = name;
  connectionChecks.push(connectionCheck);
};
