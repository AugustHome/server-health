'use strict';

const BaseError = require('./base_error');

module.exports = class BadRequestError extends BaseError {
  /**
   * Constructor
   * @param {string} message - error message
   */
  constructor(message) {
    super(message);
    this.name = 'BadRequestError';
  }
};
