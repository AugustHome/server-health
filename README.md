# Server Health

[![Build Status](https://travis-ci.org/AugustHome/server-health.svg?branch=master)](https://travis-ci.org/AugustHome/server-health)

[![NPM](https://nodei.co/npm/server-health.png?downloads=true)](https://nodei.co/npm/server-health/)

Allows to easily add a `/health` endpoint to a Restify, Express, Hapi 
or native node http server returning vital information about a service.

## Example output

```json
{
  "status": "ok", // overall server status
  "uptime": 3714, // uptime in seconds
  "upSince": "2017-05-12T03:13:06.462Z",
  "service": { // package.json meta data
    "name": "foobarbaz-server",
    "description": "Foo Bar Baz Server",
    "version": "0.14.0",
    "repository": {
      "type": "git",
      "url": "git@example.com:foobarbaz-server.git"
    }
  },
  "connections": { // plugable connection checks
    "mongodb": "ok",
    "redis": "ok",
    "rabbitmq": "ok"
  },
  "env": {
    "nodeEnv": "local",
    "nodeVersion": "v0.10.37",
    "processName": "foobarbazd",
    "pid": 10329,
    "cwd": "/Users/example/foobarbaz-server"
  },
  "git": {
    "commitHash": "c5d7c311ac8b5de7e309e18b821225d471c2cf1d",
    "branchName": "server-health-integration",
    "tag": null
  }
}
```

## Usage

### Adding the /health endpoint to a restify server 

See example/server.js for a complete example.

```js
const restify = require('restify');
const serverHealth = require('server-health');

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
const server = restify.createServer();
serverHealth.exposeHealthEndpoint(server);
server.listen(8080, function() {
  console.log('Listening on port 8080');
});
```

### Querying from the command line

After adding the server info health endpoint to a service you can do a quick check
on its status using `curl` and `jq`:  

```
> curl -s http://localhost:8080/health | jq '.status'
"ok"
```

### Filtering the response directly

Instead of filtering the whole response on the client the library also supports
filtering server side by specifying a "filter" query string parameter.  

Multiple properties can be queried by separating them by comma: `filter=status,env.nodeEnv`  

```
> curl -s http://localhost:8080/health?status
{"status":"ok"}
```

### Standalone Node Http Health Check Server

For services that do not have an existing Restify, Express, or Hapi Server, you can create a
native Node HTTP Server that only has one route, that also provides the same health
checks as Restify, Express, and Hapi servers.  

```javascript
const serverHealth = require('server-health');
serverHealth.addConnectionCheck('database', function () {
  // determine whether database connection is up and functional
  return true;
});
const options = {
  endpoint: '/health',  // optional and will default to `/health`
};
const nodeServer = serverHealth.createNodeHttpHealthCheckServer(options);
nodeServer.listen(8080);

```
