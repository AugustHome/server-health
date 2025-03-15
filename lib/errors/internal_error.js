import BaseError from './base_error.js';

/**
 * InternalError
 */
export default class InternalError extends BaseError {
  /**
   * Constructor
   * @param {string} message - error message
   */
  constructor(message) {
    super(message);

    this.name = 'InternalError';
    this.statusCode = 500;
  }
}
