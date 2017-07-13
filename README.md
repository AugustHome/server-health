# Server Info

Allows to easily add a `/ping` endpoint to a Restify or Express server 
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

// TODO
