'use strict';

const restErrors = require('restify-errors');
const boom = require('boom');

const internals = {};

internals.lowerizeFirstLetter = str => {
  return str.charAt(0).toLowerCase() + str.slice(1);
};

module.exports = class BaseError extends Error {
  /**
   * Cast error to a restify error
   * @return {RestifyError} error - restify error instance
   */
  toRestifyError() {
    return new restErrors[this.name](this.message);
  }

  /**
   * Cast the error to a bomm error
   * Make sure the output payload match the restify error output
   * @return {Boom} error - boom error instance
   */
  toBoomError() {
    const code = this.name.replace('Error', '');
    const error = boom[internals.lowerizeFirstLetter(code)](this.message);
    error.output.payload = JSON.stringify({ code, message: this.message });

    return error;
  }
};
