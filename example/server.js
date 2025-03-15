import restify from 'restify';
import serverHealth from '../index.js';

/**
 * Initializes any connections and libraries
 *
 * @returns {Promise} Resolves after initialization
 */
function init() {
  return Promise.all([
    // connect to database
    // connect to RabbitMQ
    // connect to Redis
  ]).then(() => {
    serverHealth.addConnectionCheck('database', () => {
      // determine whether database connection is up and functional
      return true;
    });
    serverHealth.addConnectionCheck('rabbitmq', () => {
      // determine whether RabbitMQ connection is up and functional
      return true;
    });
    serverHealth.addConnectionCheck('redis', () => {
      // determine whether Redis connection is up and functional
      return true;
    });
    serverHealth.addConnectionCheck('errorCheck', () => {
      // throws a sync Error
      throw new Error('foo');
    });
    serverHealth.addConnectionCheck('goodAsyncCheck', () => {
      // async check returning up/functional connection
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve(true);
        }, Math.random() * 1000);
      });
    });
    serverHealth.addConnectionCheck('badAsyncCheck', () => {
      // rejected async check
      return new Promise((resolve, reject) => {
        setTimeout(() => {
          reject(new Error('bar'));
        }, Math.random() * 1000);
      });
    });
  });
}

/**
 * Starts the server
 *
 * @return {void}
 */
function startServer() {
  const server = restify.createServer();
  server.use(restify.plugins.queryParser());

  serverHealth.exposeHealthEndpoint(server);

  // hello world
  server.get('/hello/:name', (req, res, next) => {
    res.send('hello ' + req.params.name);
    next();
  });

  return new Promise((resolve) => {
    server.listen(8080, () => {
      console.log('Listening on port 8080');
      resolve();
    });
  });
}

init().then(startServer);
