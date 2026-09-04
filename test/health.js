import sinon from 'sinon';
import fastify from 'fastify';
import hapi from '@hapi/hapi';
import express from 'express';
import http from 'node:http';
import { assert } from 'chai';

import * as serverHealth from '../lib/health.js';

// restify uses process.binding('http_parser') which was removed in Node 24
let restify;
try {
  restify = (await import('restify')).default;
} catch {
  // restify not available on this Node version
}

describe('server health', () => {
  /**
   * Helper function to run requests against the health endpoint
   *
   * @param {string} [queryString] - optional query string
   * @return {Promise.<Object>} Resolves over the server response with parsed body
   */
  function getHealth(queryString) {
    let path = '/health';
    if (queryString) {
      path += '?' + queryString;
    }

    return new Promise((resolve, reject) => {
      http
        .get(
          {
            host: 'localhost',
            port: 8080,
            path: path,
          },
          (response) => {
            let rawData = '';

            response.setEncoding('utf8');
            response.on('data', (chunk) => {
              rawData += chunk;
            });
            response.on('end', () => {
              try {
                response.body = JSON.parse(rawData);
              } catch (err) {
                // ignore JSON parse errors, usually express returning a HTML error page

                console.error('JSON parse error', err);
              }

              return resolve(response);
            });
          }
        )
        .on('error', (err) => {
          reject(err);
        });
    });
  }

  describe('exposeHealthEndpoint', () => {
    it('adds a health endpoint with restify', function () {
      if (!restify) {
        return this.skip();
      }

      const server = restify.createServer();
      serverHealth.exposeHealthEndpoint(server);

      assert.property(server.router.getRoutes(), 'gethealth');
    });

    it('adds a health endpoint with express', () => {
      const app = express();
      serverHealth.exposeHealthEndpoint(app, '/health', 'express');

      // express v4 app._router
      // express v5 app.router
      const router = app.router || app._router;

      const routes = router.stack.filter((layer) => !!layer.route).map((layer) => layer.route.path);

      assert.include(routes, '/health');
    });

    it('adds a health endpoint with hapi', () => {
      const server = new hapi.Server({ port: 8080, host: 'localhost' });
      serverHealth.exposeHealthEndpoint(server, '/health', 'hapi');

      const hasHealthRoute = server.table()[0].path === '/health';
      assert.isTrue(hasHealthRoute);
    });
  });

  const servers = [
    {
      _server: null,
      name: 'fastify',
      start(done) {
        this._server = fastify();
        serverHealth.exposeHealthEndpoint(this._server, '/health', 'fastify');
        this._server.listen({ port: 8080 }, done);
      },
      stop(done) {
        this._server.close(done);
      },
    },
    restify && {
      _server: null,
      name: 'restify',
      start(done) {
        this._server = restify.createServer();
        this._server.use(restify.plugins.queryParser());
        serverHealth.exposeHealthEndpoint(this._server);
        this._server.listen(8080, done);
      },
      stop(done) {
        this._server.close(done);
      },
    },
    {
      _server: null,
      name: 'express',
      start(done) {
        // NOTE restify "pollutes" the Node-native request object with its own query parser by just loading restify
        //      undoing this so that express can pollute it with its own query parser^^
        delete http.IncomingMessage.prototype.query;
        delete http.IncomingMessage.prototype.getQuery;

        const app = express();
        serverHealth.exposeHealthEndpoint(app, '/health', 'express');
        this._server = app.listen(8080, done);
      },
      stop(done) {
        this._server.close(done);
      },
    },
    {
      _server: null,
      name: 'hapi',
      start(done) {
        this._server = hapi.Server({ port: 8080, host: 'localhost' });
        serverHealth.exposeHealthEndpoint(this._server, '/health', 'hapi');
        this._server.start().then(() => done());
      },
      stop(done) {
        this._server.stop().then(() => done());
      },
    },
    {
      _server: null,
      name: 'node-http',
      start(done) {
        const options = { endpoint: '/health' };
        this._server = serverHealth.createNodeHttpHealthCheckServer(options);
        this._server.listen(8080, done);
      },
      stop(done) {
        this._server.close(done);
      },
    },
  ];

  for (const server of servers.filter(Boolean)) {
    describe(`healthHandler for ${server.name}`, () => {
      let checkStubOne;
      let checkStubTwo;

      beforeEach(function setupServer(done) {
        checkStubOne = sinon.stub().returns(true);
        serverHealth.addConnectionCheck('one', checkStubOne);
        checkStubTwo = sinon.stub().returns(true);
        serverHealth.addConnectionCheck('two', checkStubTwo);

        server.start(done);
      });

      afterEach(function shutdownServer(done) {
        server.stop(done);
      });

      after(function resetServerHealth() {
        serverHealth.resetConnectionCheck();
      });

      it('calls all connection checks', () => {
        return getHealth().then(() => {
          assert.isTrue(checkStubOne.called);
          assert.isTrue(checkStubTwo.called);
        });
      });

      it('returns a 200 if all connection checks succeed', () => {
        return getHealth().then((response) => {
          assert.equal(response.statusCode, 200);
        });
      });

      it('returns a status=ok if all connection checks succeed', () => {
        return getHealth().then((response) => {
          assert.equal(response.body.status, 'ok');
        });
      });

      describe('Property filtering', () => {
        it('returns all core properties when not filtered', () => {
          return getHealth().then((response) => {
            const status = response.body;

            assert.property(status, 'status');
            assert.property(status, 'uptime');
            assert.property(status, 'upSince');

            assert.nestedProperty(status, 'service.name');
            assert.nestedProperty(status, 'service.description');
            assert.nestedProperty(status, 'service.version');

            assert.property(status, 'connections');
            assert.isObject(status.connections, 'object');

            assert.nestedProperty(status, 'env.nodeEnv');
            assert.nestedProperty(status, 'env.nodeVersion');
            assert.nestedProperty(status, 'env.processName');
            assert.nestedProperty(status, 'env.pid');
            assert.nestedProperty(status, 'env.cwd');

            assert.nestedProperty(status, 'git.commitHash');
            assert.nestedProperty(status, 'git.branchName');
            assert.nestedProperty(status, 'git.tag');
          });
        });

        it('returns only one selected property when filtering by one value', () => {
          return getHealth('filter=status').then((response) => {
            const status = response.body;

            assert.lengthOf(Object.keys(status), 1);
            assert.property(status, 'status');
          });
        });

        it('returns all selected properties when filtering by multiple values', () => {
          return getHealth('filter=status,env.nodeEnv').then((response) => {
            const status = response.body;

            assert.lengthOf(Object.keys(status), 2);
            assert.property(status, 'status');
            assert.nestedProperty(status, 'env.nodeEnv');
          });
        });

        it('returns a 400 error when filtering by an unknown property', () => {
          return getHealth('filter=foo').then((response) => {
            assert.equal(response.statusCode, 400);
            assert.deepEqual(response.body, {
              code: 'BadRequest',
              message: 'Invalid filter path "foo"',
            });
          });
        });
      });

      describe('unhealthy server', () => {
        before(function addUnhealthyCheck() {
          serverHealth.addConnectionCheck('failingConnectionTest', sinon.stub().returns(false));
        });

        it('returns a 500 if any connection check fails', () => {
          return getHealth().then((response) => {
            assert.equal(response.statusCode, 500);
          });
        });

        it('returns a status=fail listing the failing connections', () => {
          return getHealth().then((response) => {
            assert.equal(response.body.status, 'fail:failingConnectionTest');
          });
        });
      });

      describe('invalid health check response', () => {
        before(function addUnhealthyCheck() {
          serverHealth.addConnectionCheck('invalidHealthCheck', sinon.stub().returns('invalid response'));
        });

        it('returns a 500 if any connection check returns a non-boolean', () => {
          return getHealth().then((response) => {
            assert.equal(response.statusCode, 500);
          });
        });

        it('reports the invalid connection check', () => {
          return getHealth().then((response) => {
            assert.deepEqual(response.body, {
              code: 'Internal',
              message: 'connection check for invalidHealthCheck must return boolean, got string',
            });
          });
        });
      });
    });
  }

  describe('init config', () => {
    let server;

    /**
     * Helper function to run requests against the health endpoint on a custom port
     *
     * @param {number} port - server port
     * @param {string} [queryString] - optional query string
     * @return {Promise.<Object>} Resolves over the server response with parsed body
     */
    function getHealthOnPort(port, queryString) {
      let path = '/health';
      if (queryString) {
        path += '?' + queryString;
      }

      return new Promise((resolve, reject) => {
        http
          .get({ host: 'localhost', port, path }, (response) => {
            let rawData = '';

            response.setEncoding('utf8');
            response.on('data', (chunk) => {
              rawData += chunk;
            });
            response.on('end', () => {
              try {
                response.body = JSON.parse(rawData);
              } catch {
                // ignore JSON parse errors
              }

              resolve(response);
            });
          })
          .on('error', reject);
      });
    }

    afterEach((done) => {
      if (server) {
        server.close(() => {
          serverHealth.resetForTesting();
          done();
        });
      } else {
        serverHealth.resetForTesting();
        done();
      }
    });

    beforeEach(() => {
      serverHealth.resetForTesting();
      server = null;
    });

    it('limits the response to configured fields', (done) => {
      serverHealth.init({
        fields: ['status', 'service.version', 'connections'],
      });
      serverHealth.addConnectionCheck('redis', sinon.stub().returns(true));

      server = fastify();
      serverHealth.exposeHealthEndpoint(server, '/health', 'fastify');
      server.listen({ port: 8081 }, () => {
        getHealthOnPort(8081)
          .then((response) => {
            assert.equal(response.statusCode, 200);
            assert.deepEqual(Object.keys(response.body).sort(), ['connections', 'service', 'status']);
            assert.nestedProperty(response.body, 'service.version');
            assert.notProperty(response.body, 'uptime');
            assert.notProperty(response.body, 'env');
            assert.notProperty(response.body, 'git');
          })
          .then(() => done())
          .catch(done);
      });
    });

    it('excludes configured fields from the response', (done) => {
      serverHealth.init({
        exclude: ['env.cwd', 'env.pid', 'git', 'localTime'],
      });
      serverHealth.addConnectionCheck('redis', sinon.stub().returns(true));

      server = fastify();
      serverHealth.exposeHealthEndpoint(server, '/health', 'fastify');
      server.listen({ port: 8081 }, () => {
        getHealthOnPort(8081)
          .then((response) => {
            assert.equal(response.statusCode, 200);
            assert.notProperty(response.body, 'localTime');
            assert.notProperty(response.body, 'git');
            assert.nestedProperty(response.body, 'env.nodeEnv');
            assert.notNestedProperty(response.body, 'env.cwd');
            assert.notNestedProperty(response.body, 'env.pid');
          })
          .then(() => done())
          .catch(done);
      });
    });

    it('adds custom fields to the response', (done) => {
      serverHealth.init({
        fields: ['status', 'region'],
        custom: {
          region: () => 'us-west-2',
        },
      });

      server = fastify();
      serverHealth.exposeHealthEndpoint(server, '/health', 'fastify');
      server.listen({ port: 8081 }, () => {
        getHealthOnPort(8081)
          .then((response) => {
            assert.deepEqual(response.body, {
              status: 'ok',
              region: 'us-west-2',
            });
          })
          .then(() => done())
          .catch(done);
      });
    });

    it('narrows the init config further with query filter', (done) => {
      serverHealth.init({
        fields: ['status', 'uptime', 'env.nodeEnv'],
      });

      server = fastify();
      serverHealth.exposeHealthEndpoint(server, '/health', 'fastify');
      server.listen({ port: 8081 }, () => {
        getHealthOnPort(8081, 'filter=status,env.nodeEnv')
          .then((response) => {
            assert.deepEqual(Object.keys(response.body).sort(), ['env', 'status']);
            assert.property(response.body, 'status');
            assert.nestedProperty(response.body, 'env.nodeEnv');
            assert.notProperty(response.body, 'uptime');
          })
          .then(() => done())
          .catch(done);
      });
    });

    it('ignores query filter when allowQueryFilter is false', (done) => {
      serverHealth.init({
        fields: ['status', 'uptime'],
        allowQueryFilter: false,
      });

      server = fastify();
      serverHealth.exposeHealthEndpoint(server, '/health', 'fastify');
      server.listen({ port: 8081 }, () => {
        getHealthOnPort(8081, 'filter=status')
          .then((response) => {
            assert.property(response.body, 'uptime');
            assert.property(response.body, 'status');
          })
          .then(() => done())
          .catch(done);
      });
    });

    it('skips connection checks when neither status nor connections are exposed', (done) => {
      const checkStub = sinon.stub().returns(true);

      serverHealth.init({
        fields: ['uptime'],
      });
      serverHealth.addConnectionCheck('redis', checkStub);

      server = fastify();
      serverHealth.exposeHealthEndpoint(server, '/health', 'fastify');
      server.listen({ port: 8081 }, () => {
        getHealthOnPort(8081)
          .then((response) => {
            assert.isFalse(checkStub.called);
            assert.deepEqual(response.body, { uptime: response.body.uptime });
          })
          .then(() => done())
          .catch(done);
      });
    });

    it('throws when init is called more than once', () => {
      serverHealth.init({ fields: ['status'] });

      assert.throws(() => serverHealth.init({ fields: ['uptime'] }), /can only be called once/);
    });
  });
});
