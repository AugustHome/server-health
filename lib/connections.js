'use strict';


/**
 * Checks the Redis connection using an instance of the "redis" npm package
 *
 * @param {Object} redisClient - "redis" package client instance
 * @return {Function} connection checking function to use with addConnectionCheck()
 */
module.exports.checkRedisConnection = function (redisClient) {
  return function () {
    return redisClient.connected;
  }
};

/**
 * Checks the RabbitMQ connection using an instance of "august-messages".
 * august-messages internally uses amqplib to connect to RabbitMQ
 *
 * @param {Object} messenger - "august-messages" instance
 * @return {Function} connection checking function to use with addConnectionCheck()
 */
module.exports.checkRabbitmqConnection = function (messenger) {
  return function () {
    return (
      messenger.channel.connection.recvSinceLastCheck &&
      messenger.channel.connection.sentSinceLastCheck
    );
  };
};
