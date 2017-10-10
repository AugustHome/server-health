'use strict';

const assert = require('chai').assert;
const sinon = require('sinon');
const restify = require('restify');
const http = require('http');

const serverHealth = require('../lib/health');


describe('server health', function () {

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

    before(function setupServer(done) {
      checkStubOne = sinon.stub().returns(true);
      serverHealth.addConnectionCheck('one', checkStubOne);
      checkStubTwo = sinon.stub().returns(true);
      serverHealth.addConnectionCheck('two', checkStubTwo);

      server = restify.createServer();
      serverHealth.exposeHealthEndpoint(server);
      server.listen(8080, function () {
        done();
      })
    });

    after(function shutdownServer() {
      server.close();
    });

    it('calls all connection checks', function (done) {
      http.get({
        host: 'localhost',
        port: 8080,
        path: '/health'
      }, function (response) {
        assert.equal(response.statusCode, 200);

        assert.isTrue(checkStubOne.called);
        assert.isTrue(checkStubTwo.called);
        done();
      });
    });

  });

});
