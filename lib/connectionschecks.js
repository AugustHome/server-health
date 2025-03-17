/**
 * Checks the Redis connection using an instance of the "redis" npm package
 *
 * @param {Object} redisClient - "redis" package client instance
 * @returns {Function} connection check to use with addConnectionCheck()
 */
export function checkRedisConnection(redisClient) {
  return () => redisClient.connected;
}

/**
 * Checks the MongoDB connection using an instance of "mongodb" npm package
 *
 * @param {Object} dbConnection - mongodb client "Db" instance
 * @returns {Function} connection check to use with addConnectionCheck()
 * @see http://mongodb.github.io/node-mongodb-native/2.2/api/Db.html
 * @see https://docs.mongodb.com/manual/reference/command/ping/
 */
export function checkMongoDbConnection(dbConnection) {
  return async () => {
    try {
      const pingResults = await dbConnection.command({ ping: 1 });

      return pingResults.every((pingResult) => pingResult.ok === 1);
    } catch {
      return false;
    }
  };
}
