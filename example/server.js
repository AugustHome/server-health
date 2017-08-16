'use strict';

var restify = require('restify');
var Promise = require('bluebird');

var serverHealth = require('../index');


function init() {
  return Promise.all([
    // connect to database
    // connect to RabbitMQ
    // connect to Redis
  ]).
  then(function () {
    serverHealth.addConnectionCheck('database', function () {
      // determine whether database connection is up and functional
      return true;
    });
    serverHealth.addConnectionCheck('rabbitmq', function () {
      // determine whether RabbitMQ connection is up and functional
      return true;
    });
    serverHealth.addConnectionCheck('redis', function () {
      // determine whether Redis connection is up and functional
      return true;
    });
    serverHealth.addConnectionCheck('errorCheck', function () {
      // throws a sync Error
      throw new Error('foo');
    });
    serverHealth.addConnectionCheck('goodAsyncCheck', function () {
      // async check returning up/functional connection
      return new Promise(function (resolve) {
        setTimeout(function () {
          resolve(true);
        }, Math.random() * 1000);
      });
    });
    serverHealth.addConnectionCheck('badAsyncCheck', function () {
      // rejected async check
      return new Promise(function (resolve, reject) {
        setTimeout(function () {
          reject(new Error('bar'));
        }, Math.random() * 1000);
      });
    });
  })
}

function startServer() {
  var server = restify.createServer();

  serverHealth.exposeHealthEndpoint(server);

  // hello world
  server.get('/hello/:name', function (req, res, next) {
    res.send('hello ' + req.params.name);
    next();
  });

  return new Promise(function (resolve) {
    server.listen(8080, function () {
      // eslint-disable-next-line no-console
      console.log('Listening on port 8080');
      resolve();
    })
  })
}


init().then(startServer);
