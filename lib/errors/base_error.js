import restErrors from 'restify-errors';
import * as boom from '@hapi/boom';

/**
 * BaseError class extends the native Error class to provide additional functionality
 * for converting errors to Restify and Boom error formats, as well as JSON representation.
 *
 * @class BaseError
 * @extends {Error}
 * @example
 * // Creating a new BaseError instance
 * const error = new BaseError('Something went wrong');
 *
 * // Converting to Restify error
 * const restifyError = error.toRestifyError();
 *
 * // Converting to Boom error
 * const boomError = error.toBoomError();
 *
 * // Getting JSON representation
 * const jsonError = error.toJSON();
 */
export default class BaseError extends Error {
  /**
   * Constructor
   * @param {string} message - error message
   */
  constructor(message) {
    super(message);
    this.name = this.constructor.name;
  }

  /**
   * Cast error to a restify error
   *
   * @returns {RestError} error - restify error instance
   */
  toRestifyError() {
    return new restErrors[this.name](this.message);
  }

  /**
   * Cast the error to a boom error
   * Make sure the output payload match the restify error output
   *
   * @returns {boom.Boom} error - boom error instance
   */
  toBoomError() {
    let errorName = this.name.replace('Error', '');
    errorName = errorName.charAt(0).toLowerCase() + errorName.slice(1);

    const error = boom[errorName](this.message);
    error.output.payload = JSON.stringify(this);

    return error;
  }

  // TODO - add toFastifyError

  /**
   * Json formatted object
   *
   * @returns {{message: string, name: string, code}} -
   */
  toJSON() {
    const code = this.name.replace('Error', '');

    return {
      message: this.message,
      code: code,
    };
  }
}
