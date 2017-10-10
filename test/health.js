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
        const contentType = response.headers['content-type'];
        let error;
        let rawData = '';

        if (response.statusCode !== 200) {
          error = new Error(`Request Failed. Status Code: ${response.statusCode}`);
        } else if (!/^application\/json/.test(contentType)) {
          error = new Error('Invalid content-type.\n' +
            `Expected application/json but received ${contentType}`);
        }

        if (error) {
          reject(error.message);
          response.resume();
          return;
        }

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

    it('calls all connection checks', () => {
      return getHealth()
      .then((response) => {
        assert.equal(response.statusCode, 200);

        assert.isTrue(checkStubOne.called);
        assert.isTrue(checkStubTwo.called);
      });
    });

  });

});
