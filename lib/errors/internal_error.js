'use strict';

const BaseError = require('./base_error');

module.exports = class InternalError extends BaseError {
  /**
   * Constructor
   * @param {string} message - error message
   */
  constructor(message) {
    super(message);
    this.name = 'InternalError';
  }
};
