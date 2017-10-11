'use strict';

const _ = require('lodash');
const getRepoInfo = require('git-repo-info');
const Promise = require('bluebird');
const restErrors = require('restify-errors');

let isInitialized = false;
const startTime = new Date();
let serverPackage;
let gitInfo;
const connectionChecks = [];


/**
 * Initializes the health module.
 * Loads the server's package.json
 *
 * @return {undefined}
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
 * @return {undefined}
 */
module.exports.exposeHealthEndpoint = (server, endpoint) => {
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
 * @param {Function} next - next handler in request handler chain
 * @return {undefined}
 */
function healthHandler(req, res, next) {
  let status = {
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

  const failedConnections = [];
  Promise.map(connectionChecks, (connectionCheck, index) => {
    const name = connectionChecks[index].checkName;

    // execute connection check, may be sync or async (Promise)
    return Promise.try(connectionCheck).
    then((result) => {
      let connectionStatus = result;

      if (typeof connectionStatus !== 'boolean') {
        throw new restErrors.InternalError(`connection check for ${name} must return boolean, got ${typeof connectionStatus}`);
      }

      status.connections[name] = connectionStatus ? 'ok' : 'fail';

      if (!connectionStatus) {
        status.connections[name] = 'fail';
        failedConnections.push(name);
      }
    });
  }).
  then(() => {
    let statusCode = 200;

    // update status if any connection failed
    if (failedConnections.length > 0) {
      status.status = 'fail:' + failedConnections.join(',');
      statusCode = new restErrors.InternalError().statusCode;
    } else {
      status.status = 'ok';
    }

    // filter, return only selected values
    if (req.query.filter) {
      const filters = req.query.filter.split(',');
      status = filters.reduce((acc, filterPath) => {
        if (!_.has(status, filterPath)) {
          throw new restErrors.BadRequestError(`Invalid filter path "${filterPath}"`);
        }

        const val = _.get(status, filterPath);
        if (val) {
          _.set(acc, filterPath, val);
        }

        return acc;
      }, {})
    }

    res.send(statusCode, status);
    next();
  }).
  catch((err) => {
    next(err);
  });
}

/**
 * Adds a check for dependency service availability
 *
 * @param {string} name - name used under the connections in the /health endpoint
 * @param {Function} connectionCheck - function to execute to check a connection
 * @return {undefined}
 */
module.exports.addConnectionCheck = (name, connectionCheck) => {
  connectionCheck.checkName = name;
  connectionChecks.push(connectionCheck);
};
