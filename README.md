# Server Info

Allows to easily add a `/health` endpoint to a Restify or Express server 
returning vital information about a service.

## Example output

```json
{
  "status": "ok", // overall server status
  "uptime": 3714, // uptime in seconds
  "upSince": "2017-05-12T03:13:06.462Z",
  "service": { // package.json meta data
    "name": "august-subscription-server",
    "description": "August Subscription Server",
    "version": "0.14.0",
    "repository": {
      "type": "git",
      "url": "git@bitbucket.org:august_team/august-subscription-server.git"
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
    "cwd": "/Users/example/august/foobarbaz-server"
  },
  "git": {
    "commitHash": "c5d7c311ac8b5de7e309e18b821225d471c2cf1d",
    "branchName": "server-info-integration",
    "tag": null
  }
}
```

## Usage

See example/server.js for a complete example.

```js
var restify = require('restify');
var serverInfo = require('august-server-info');

serverInfo.addConnectionCheck('database', function () {
  // determine whether database connection is up and functional
  return true;
});
serverInfo.addConnectionCheck('rabbitmq', function () {
  // determine whether RabbitMQ connection is up and functional
  return true;
});
serverInfo.addConnectionCheck('redis', function () {
  // determine whether Redis connection is up and functional
  return true;
});

var server = restify.createServer();
serverInfo.exposeHealthEndpoint(server);
server.listen(8080, function() {
  console.log('Listening on port 8080');
});
```

After adding the server info health endpoint to a service you can do quick check
on its status using `curl` and `jq`:  

```
> curl -s http://localhost:8080/health | jq '.status'
"ok"
```
