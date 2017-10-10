'use strict';

const Promise = require('bluebird');
const assert = require('chai').assert;
const sinon = require('sinon');
const restify = require('restify');
const http = require('http');

const serverHealth = require('../lib/health');


describe('server health', function () {

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

    return new Promise(function (resolve, reject) {
      http.get({
        host: 'localhost',
        port: 8080,
        path: path
      }, (response) => {
        let rawData = '';

        response.setEncoding('utf8');
        response.on('data', (chunk) => { rawData += chunk; });
        response.on('end', () => {
          try {
            response.body = JSON.parse(rawData);
            return resolve(response);
          } catch (err) {
            reject(err);
          }
        });

      }).on('error', function (err) {
        reject(err);
      });
    });
  }


  describe('exposeHealthEndpoint', () => {

    it('adds a health endpoint', () => {
      const server = restify.createServer();
      serverHealth.exposeHealthEndpoint(server);

      assert.property(server.routes, 'gethealth');
    });

  });

  describe('healthHandler', () => {

    let server;
    let checkStubOne;
    let checkStubTwo;

    beforeEach(function setupServer(done) {
      checkStubOne = sinon.stub().returns(true);
      serverHealth.addConnectionCheck('one', checkStubOne);
      checkStubTwo = sinon.stub().returns(true);
      serverHealth.addConnectionCheck('two', checkStubTwo);

      server = restify.createServer();
      server.use(restify.plugins.queryParser());
      serverHealth.exposeHealthEndpoint(server);
      server.listen(8080, function () {
        done();
      })
    });

    afterEach(function shutdownServer() {
      server.close();
    });

    it('calls all connection checks', () => {
      return getHealth()
      .then(() => {
        assert.isTrue(checkStubOne.called);
        assert.isTrue(checkStubTwo.called);
      });
    });

    it('returns a 200 if all connection checks succeed', () => {
      return getHealth()
      .then((response) => {
        assert.equal(response.statusCode, 200);
      });
    });

    it('returns a status=ok if all connection checks succeed', () => {
      return getHealth()
      .then((response) => {
        assert.equal(response.body.status, 'ok');
      });
    });

    describe('Property filtering', () => {

      it('returns all core properties when not filtered', () => {
        return getHealth()
        .then((response) => {
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
        return getHealth('filter=status')
        .then((response) => {
          const status = response.body;

          assert.lengthOf(Object.keys(status), 1);
          assert.property(status, 'status');
        });
      });

      it('returns all selected properties when filtering by multiple values', () => {
        return getHealth('filter=status,env.nodeEnv')
        .then((response) => {
          const status = response.body;

          assert.lengthOf(Object.keys(status), 2);
          assert.property(status, 'status');
          assert.nestedProperty(status, 'env.nodeEnv');
        });
      });

      it('returns a 400 error when filtering by an unknown property', () => {
        return getHealth('filter=foo')
        .then((response) => {
          assert.equal(response.statusCode, 400);
          assert.equal(response.body.message, 'Invalid filter path "foo"')
        });
      });

    });

    describe('unhealthy server', () => {

      before(function addUnhealthyCheck() {
        serverHealth.addConnectionCheck(
          'failingConnectionTest',
          sinon.stub().returns(false)
        );
      });

      it('returns a 500 if any connection check fails', () => {
        return getHealth()
        .then((response) => {
          assert.equal(response.statusCode, 500);
        });
      });

      it('returns a status=fail listing the failing connections', () => {
        return getHealth()
        .then((response) => {
          assert.equal(response.body.status, 'fail:failingConnectionTest');
        });
      });

    });
  });

});
