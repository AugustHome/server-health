import _ from 'lodash';
import getRepoInfo from 'git-repo-info';
import http from 'node:http';
import url from 'node:url';
import fs from 'node:fs';

import { InternalError, BadRequestError } from './errors/index.js';

let isInitialized = false;
const startTime = new Date();
let serverPackage;
let gitInfo;
let connectionChecks = [];

/**
 * Initializes the health module.
 * Loads the server's package.json
 *
 * @return {undefined}
 */
function init() {
  // In ESM we need to handle package.json loading differently since process.cwd() + '/package.json'
  // can't be directly imported with dynamic imports due to security restrictions
  try {
    serverPackage = JSON.parse(fs.readFileSync(process.cwd() + '/package.json', 'utf8'));
  } catch {
    // Fallback to a default object if package.json cannot be loaded
    serverPackage = { name: 'unknown', description: 'unknown', version: 'unknown' };
  }
  gitInfo = getRepoInfo();
  isInitialized = true;
}

/**
 * Health controller
 *
 * @param {Server} server - Restify/Hapi server instance
 * @param {string} [endpoint="/health"] - name of endpoint where to expose the status information
 * @param {string} [framework="restify"] - type of framework, right now support "restify", "express", and "hapi"
 * @return {undefined}
 */
export function exposeHealthEndpoint(server, endpoint = '/health', framework = 'restify') {
  if (!isInitialized) {
    init();
  }

  switch (framework) {
    case 'hapi':
      server.route({
        method: 'GET',
        path: endpoint,
        handler: async (request, h) => {
          try {
            const { statusCode, status } = await healthHandler(request.query.filter);

            return h.response(status).code(statusCode);
          } catch (err) {
            return err.toBoomError();
          }
        },
      });
      break;

    case 'express':
      server.get(endpoint, (req, res) => {
        healthHandler(req.query.filter)
          .then(({ statusCode, status }) => {
            res.status(statusCode).json(status);
          })
          .catch((err) => res.status(err.statusCode).json(err));
      });
      break;

    case 'fastify':
      server.get(endpoint, async (req, res) => {
        try {
          const { statusCode, status } = await healthHandler(req.query.filter);

          res.code(statusCode).send(status);
        } catch (err) {
          res.code(err.statusCode).send(err.toJSON());
        }
      });
      break;

    case 'restify':
    // intended fallthrough
    default:
      server.get(endpoint, (req, res, next) => {
        healthHandler(req.query.filter)
          .then(({ statusCode, status }) => {
            res.send(statusCode, status);
            next();
          })
          .catch((err) => next(err.toRestifyError()));
      });
  }
}

/**
 * Function callback for requestListener.  Used in node native http server
 * JSDoc added for warning suppression and to describe return/arg values
 * in used functions
 *
 * @callback requestListener
 * @param {http.ClientRequest} request
 * @param {http.ServerResponse} response
 */

/**
 * Generates a request/response listener function that calls the healthHandler
 * or calls the requestListener based upon the request url.
 *
 * Used with native node http server in order to add health checks.
 * Uses requestListener for all other request not to health checks
 *  if it exists
 *
 * @param {Object} [options] -
 * @param {requestListener} [options.requestListener] - callback for request/response
 * @param {string} [options.endpoint] - where to expose the status information
 * @returns {requestListener} - Used in node native http server
 */
export function generateRequestListener(options) {
  const contentType = { 'Content-Type': 'application/json' };
  const endpoint = _.get(options, 'endpoint', '/health');
  const requestListener = _.get(options, 'requestListener', null);

  return (request, response) => {
    const parsedUrl = url.parse(request.url, true);
    if (parsedUrl.pathname !== endpoint) {
      if (requestListener) {
        return requestListener(request, response);
      }

      return;
    }

    const filter = _.get(parsedUrl, 'query.filter');

    return healthHandler(filter)
      .then(({ statusCode, status }) => {
        response.writeHead(statusCode, contentType);
        response.end(JSON.stringify(status));
      })
      .catch((err) => {
        response.writeHead(err.statusCode || 500, contentType);
        response.end(JSON.stringify(err));
      });
  };
}

/**
 * Create native node http server that calls the healthHandler if
 * request is for the health check endpoint.  Routes all other requests
 * to the request listener if it exists
 *
 * @param {Object} [options] -
 * @param {requestListener} [options.requestListener] - callback for request/response
 * @param {string} [options.endpoint] - where to expose the status information
 * @returns {http.Server} - node http server (not started)
 */
export function createNodeHttpHealthCheckServer(options) {
  if (!isInitialized) {
    init();
  }

  const requestListenerWrapper = generateRequestListener(options);

  return http.createServer(requestListenerWrapper);
}

/**
 * Provides the GET /health endpoint
 *
 * @param {string} [filter] - filter query string parameter
 * @returns {Promise} - resolve success payload or reject error
 */
async function healthHandler(filter) {
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
      cwd: process.cwd(),
    },
    git: {
      commitHash: gitInfo.sha,
      branchName: gitInfo.branch,
      tag: gitInfo.tag,
    },
  };

  const failedConnections = [];

  await Promise.all(
    connectionChecks.map(async (connectionCheck) => {
      const name = connectionCheck.checkName;

      // execute connection check, may be sync or async
      const connectionStatus = await connectionCheck();

      if (typeof connectionStatus !== 'boolean') {
        throw new InternalError(`connection check for ${name} must return boolean, got ${typeof connectionStatus}`);
      }

      _.set(status, `connections.${name}`, connectionStatus ? 'ok' : 'fail');

      if (!connectionStatus) {
        failedConnections.push(name);
      }
    })
  );

  let statusCode = 200;

  // update status if any connection failed
  if (failedConnections.length > 0) {
    status.status = 'fail:' + failedConnections.join(',');
    statusCode = 500;
  } else {
    status.status = 'ok';
  }

  // filter, return only selected values
  if (filter) {
    const filters = filter.split(',');

    const filteredStatus = {};
    for (const filterPath of filters) {
      if (!_.has(status, filterPath)) {
        throw new BadRequestError(`Invalid filter path "${filterPath}"`);
      }

      // transfer value from overall status to filtered status
      _.set(filteredStatus, filterPath, _.get(status, filterPath));
    }
    status = filteredStatus;
  }

  return { statusCode, status };
}

/**
 * Adds a check for dependency service availability
 *
 * @param {string} name - name used under the connections in the /health endpoint
 * @param {Function} connectionCheck - function to execute to check a connection
 * @return {undefined}
 */
export function addConnectionCheck(name, connectionCheck) {
  connectionCheck.checkName = name;
  connectionChecks.push(connectionCheck);
}

/**
 * Reset checks for dependency service availability
 *
 * @return {undefined}
 */
export function resetConnectionCheck() {
  connectionChecks = [];
}

// Default export for backwards compatibility
export default {
  exposeHealthEndpoint,
  generateRequestListener,
  createNodeHttpHealthCheckServer,
  addConnectionCheck,
  resetConnectionCheck,
};
