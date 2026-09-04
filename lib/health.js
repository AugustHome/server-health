import _ from 'lodash';
import getRepoInfo from 'git-repo-info';
import http from 'node:http';
import url from 'node:url';
import fs from 'node:fs';

import { InternalError, BadRequestError } from './errors/index.js';

const defaultHealthConfig = {
  fields: null,
  exclude: null,
  custom: null,
  packageJsonPath: null,
  includeGit: true,
  allowQueryFilter: true,
};

let isInitialized = false;
const startTime = new Date();
let serverPackage;
let gitInfo;
let connectionChecks = [];
let healthConfig = { ...defaultHealthConfig };

/**
 * Loads package.json and optional git metadata.
 *
 * @return {undefined}
 */
function loadServerMetadata() {
  const packagePath = healthConfig.packageJsonPath ?? process.cwd() + '/package.json';

  try {
    serverPackage = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  } catch {
    serverPackage = { name: 'unknown', description: 'unknown', version: 'unknown' };
  }

  if (healthConfig.includeGit) {
    gitInfo = getRepoInfo();
  } else {
    gitInfo = { sha: null, branch: null, tag: null };
  }
}

/**
 * Ensures module metadata is loaded using default config when init() was not called.
 *
 * @return {undefined}
 */
function ensureInitialized() {
  if (!isInitialized) {
    healthConfig = { ...defaultHealthConfig };
    loadServerMetadata();
    isInitialized = true;
  }
}

/**
 * Initializes the health module with optional configuration.
 *
 * @param {Object} [config={}] - health endpoint configuration
 * @param {string[]} [config.fields] - whitelist of dot-path fields to include in responses
 * @param {string[]} [config.exclude] - dot-path fields to omit from responses (ignored when fields is set)
 * @param {Object.<string, Function>} [config.custom] - additional top-level fields computed per request
 * @param {string} [config.packageJsonPath] - path to package.json (defaults to cwd/package.json)
 * @param {boolean} [config.includeGit=true] - whether to load and expose git metadata
 * @param {boolean} [config.allowQueryFilter=true] - whether ?filter= query params are honored
 * @return {undefined}
 */
export function init(config = {}) {
  if (isInitialized) {
    throw new Error('server-health init() can only be called once');
  }

  healthConfig = {
    ...defaultHealthConfig,
    ...config,
  };

  loadServerMetadata();
  isInitialized = true;
}

/**
 * Resets module state. Intended for tests only.
 *
 * @return {undefined}
 */
export function resetForTesting() {
  isInitialized = false;
  healthConfig = { ...defaultHealthConfig };
  connectionChecks = [];
  serverPackage = undefined;
  gitInfo = undefined;
}

/**
 * @param {string} path - dot-path field name
 * @returns {boolean} whether the path would appear in the configured response
 */
function wouldIncludePath(path) {
  const { fields, exclude } = healthConfig;

  if (fields) {
    return fields.some((fieldPath) => fieldPath === path || fieldPath.startsWith(`${path}.`));
  }

  if (exclude) {
    return !exclude.some((fieldPath) => fieldPath === path || fieldPath.startsWith(`${path}.`));
  }

  return true;
}

/**
 * @param {Object} status - full health payload
 * @param {string[]} filterPaths - dot-path fields to keep
 * @returns {Object} filtered payload
 */
function applyPathFilter(status, filterPaths) {
  const filteredStatus = {};

  for (const filterPath of filterPaths) {
    if (!_.has(status, filterPath)) {
      throw new BadRequestError(`Invalid filter path "${filterPath}"`);
    }

    _.set(filteredStatus, filterPath, _.get(status, filterPath));
  }

  return filteredStatus;
}

/**
 * @param {Object} status - full health payload
 * @returns {Object} payload after init config is applied
 */
function applyConfigFilter(status) {
  const { fields, exclude } = healthConfig;

  if (fields) {
    return applyPathFilter(status, fields);
  }

  if (exclude) {
    const filteredStatus = _.cloneDeep(status);

    for (const excludePath of exclude) {
      _.unset(filteredStatus, excludePath);
    }

    return filteredStatus;
  }

  return status;
}

/**
 * @returns {boolean} whether dependency connection checks should run
 */
function shouldRunConnectionChecks() {
  if (!healthConfig.fields && !healthConfig.exclude) {
    return true;
  }

  return wouldIncludePath('status') || wouldIncludePath('connections');
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
  ensureInitialized();

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
 * @param {Object} [options={}] -
 * @param {requestListener} [options.requestListener] - callback for request/response
 * @param {string} [options.endpoint] - where to expose the status information
 * @returns {requestListener} - Used in node native http server
 */
export function generateRequestListener(options = {}) {
  const contentType = { 'Content-Type': 'application/json' };
  const endpoint = options.endpoint ?? '/health';
  const requestListener = options.requestListener ?? null;

  return (request, response) => {
    const parsedUrl = url.parse(request.url, true);
    if (parsedUrl.pathname !== endpoint) {
      if (requestListener) {
        return requestListener(request, response);
      }

      return;
    }

    const filter = parsedUrl.query?.filter;

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
  ensureInitialized();

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
  };

  if (healthConfig.includeGit && wouldIncludePath('git')) {
    status.git = {
      commitHash: gitInfo.sha,
      branchName: gitInfo.branch,
      tag: gitInfo.tag,
    };
  }

  const failedConnections = [];

  if (shouldRunConnectionChecks()) {
    await Promise.all(
      connectionChecks.map(async (connectionCheck) => {
        const name = connectionCheck.checkName;

        const connectionStatus = await connectionCheck();

        if (typeof connectionStatus !== 'boolean') {
          throw new InternalError(`connection check for ${name} must return boolean, got ${typeof connectionStatus}`);
        }

        status.connections[name] = connectionStatus ? 'ok' : 'fail';

        if (!connectionStatus) {
          failedConnections.push(name);
        }
      })
    );
  }

  let statusCode = 200;

  if (failedConnections.length > 0) {
    status.status = 'fail:' + failedConnections.join(',');
    statusCode = 500;
  } else {
    status.status = 'ok';
  }

  if (healthConfig.custom) {
    for (const [key, valueFn] of Object.entries(healthConfig.custom)) {
      status[key] = await valueFn();
    }
  }

  status = applyConfigFilter(status);

  if (filter && healthConfig.allowQueryFilter) {
    status = applyPathFilter(status, filter.split(','));
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
  init,
  exposeHealthEndpoint,
  generateRequestListener,
  createNodeHttpHealthCheckServer,
  addConnectionCheck,
  resetConnectionCheck,
  resetForTesting,
};
