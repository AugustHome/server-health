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
 * Checks the Redis connection using an instance of the "ioredis" npm package
 *
 * @param {Object} ioRedisClient - "ioredis" package client instance
 * @return {Function} connection check to use with addConnectionCheck()
 */
module.exports.checkIoRedisConnection = function (ioRedisClient) {

};

/**
 * Checks the RabbitMQ connection using an instance of "august-messages".
 * august-messages internally uses amqplib to connect to RabbitMQ
 *
 * @param {Object} messenger - "august-messages" instance
 * @return {Function} connection check to use with addConnectionCheck()
 */
module.exports.checkRabbitmqConnection = function (messenger) {
  // TODO add a method to august-messages that provides this check
  // so that august-messages could change the amqp client if needed

  return function () {
    // TODO return messenger.isConnected();
    return (
      messenger.channel.connection.recvSinceLastCheck &&
      messenger.channel.connection.sentSinceLastCheck
    );
  };
};


// mongo has a ping command that can be used to check connection


/**
 * Checks the MongoDB connection using an instance of "mongodb" npm package
 *
 * @param {Object} mongoDbClient - "mongodb" instance
 * @return {Function} connection check to use with addConnectionCheck()
 */
module.exports.checkMongoDbConnection = function (mongoDbClient) {

};

/**
 * Checks whether the database connection is available
 *
 * @return {boolean}
 */
function isDatabaseConnected() {
  var augustDbConnected = false;
  var augustDbUrl = config.db.august.url;

  if (model.connections.length >= 1) {
    if (model.connections[0].s.options.url === augustDbUrl) {
      augustDbConnected = true;
    }
  }

  return augustDbConnected;
}
