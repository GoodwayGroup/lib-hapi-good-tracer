const Boom = require('@hapi/boom');
const axios = require('axios');
const debug = require('debug')('hapi:plugins:good-tracer:axiosFactory');
const { get } = require('lodash');

/**
 * handleError will take an incoming error and `throw` ad Boom.Boomify instance of that error.
 *
 * Depending on the state of the DEV_EXPOSE_AXIOS_ERRORS environment variable, more metadata will be added to the thrown error.
 * @param {Error} error
 */
exports.handleError = (error) => {
    const customData = {
        config: get(error, 'config'),
        status: get(error, 'response.status'),
        data: get(error, 'response.data', {}),
        requestMethod: get(error, 'response.request.method'),
        requestPath: get(error, 'response.request.path'),
        requestHeaders: get(error, 'response.request', { getHeaders: () => '' }).getHeaders()
    };

    if (get(process, 'env.DEV_EXPOSE_AXIOS_ERRORS', false)) {
        /* eslint-disable-next-line no-console */
        console.log('DEV_EXPOSE_AXIOS_ERRORS is set, error is Boomified');
        throw Boom.boomify(error, { statusCode: customData.status, message: customData.data.message, data: customData });
    } else {
        throw Boom.boomify(error, { data: customData });
    }
};

/**
 * factory generates an AxiosInstance that has an error interceptor to help decorate the Boomified error with useful metdata.
 *
 * @param {Object} config Any supported axios configuration
 * @returns {AxiosInstance}
 */
exports.factory = (config = {}) => {
    debug('Creating axios client with config: %o', config);
    const instance = axios.create(config);

    instance.interceptors.response.use(
        // Nothing needs to be done with a healthy response
        (response) => response,
        (error) => exports.handleError(error)
    );

    return instance;
};
