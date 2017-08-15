'use strict';


/**
 * Checks the Redis connection using an instance of the "redis" npm package
 *
 * @param {Object} redisClient - "redis" package client instance
 * @return {Function} connection check to use with addConnectionCheck()
 */
module.exports.checkRedisConnection = function (redisClient) {
  return function () {
    return redisClient.connected;
  }
};

/**
 * Checks the MongoDB connection using an instance of "mongodb" npm package
 *
 * @param {Object} dbConnection - mongodb client "Db" instance
 * @return {Function} connection check to use with addConnectionCheck()
 * @see http://mongodb.github.io/node-mongodb-native/2.2/api/Db.html
 * @see https://docs.mongodb.com/manual/reference/command/ping/
 */
module.exports.checkMongoDbConnection = function (dbConnection) {
  return function () {
    return dbConnection.command({ ping: 1 }).
    then(function (pingResults) {
      return pingResults.every(function (pingResult) {
        return pingResult.ok === 1;
      });
    }).
    catch(function () {
      return false;
    });
  }
};
