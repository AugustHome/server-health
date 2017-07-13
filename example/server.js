'use strict';

var restify = require('restify');
var Promise = require('bluebird');

var serverInfo = require('../index');


function init() {
  return Promise.all([
    // connect to database
    // connect to RabbitMQ
    // connect to Redis
  ]).
  then(function () {
    serverInfo.addConnectionCheck('database', function () {
      // determine whether database connection is up and functional
      return true;
    });
    serverInfo.addConnectionCheck('rabbitmq', function () {
      // determine whether database connection is up and functional
      return true;
    });
    serverInfo.addConnectionCheck('redis', function () {
      // determine whether database connection is up and functional
      return true;
    });
  })
}

function startServer() {
  var server = restify.createServer();

  serverInfo.exposePingEndpoint(server);

  // hello world
  server.get('/hello/:name', function (req, res, next) {
    res.send('hello ' + req.params.name);
    next();
  });

  return new Promise(function (resolve, reject) {
    server.listen(8080, function () {
      console.log('Listening on port 8080');
      resolve();
    })
  })
}


init().then(startServer);
