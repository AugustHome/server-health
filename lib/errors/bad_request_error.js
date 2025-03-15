import BaseError from './base_error.js';

/**
 * BadRequestError
 */
export default class BadRequestError extends BaseError {
  /**
   * Constructor
   * @param {string} message - error message
   */
  constructor(message) {
    super(message);

    this.name = 'BadRequestError';
    this.statusCode = 400;
  }
}
