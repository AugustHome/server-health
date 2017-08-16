'use strict';

var assert = require('chai').assert;
var sinon = require('sinon');
var restify = require('restify');
var http = require('http');

var serverHealth = require('../lib/health');


describe('server health', function () {

  describe('exposeHealthEndpoint', function () {

    it('adds a health endpoint', function () {
      var server = restify.createServer();
      serverHealth.exposeHealthEndpoint(server);

      assert.property(server.routes, 'gethealth');
    });

  });

  describe('healthHandler', function () {

    var server;
    var checkStubOne;
    var checkStubTwo;

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
