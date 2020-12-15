const Stream = require('stream');
const Hoek = require('@hapi/hoek');
const debug = require('debug')('hapi:plugins:good-tracer');
const NodeCache = require('node-cache');
const { v4: uuidv4 } = require('uuid');
const {
    get, set, isNaN, isPlainObject
} = require('lodash');
const { factory } = require('./axios');

const cacheDebug = debug.extend('cache');

const NAME = 'goodTracer';

const DEFAULTS = {
    traceUUIDHeader: 'x-gg-trace-uuid',
    traceDepthHeader: 'x-gg-trace-depth',
    baseRoute: '',
    enableStatsRoute: false,
    cache: { // Any node-cache config option. See: https://github.com/node-cache/node-cache#options
        stdTTL: 60 * 60, // 1 hour
        checkperiod: 60, // 1 minute
        maxKeys: -1,
        extendTTLOnGet: true, // extend TTL on cache get
        useClones: false
    },
    postResponseCleanup: {}, // You can pass a `delay`, will default to 1 second
    axios: {} // You can pass any axios configuration here
};

const internals = {};

internals.incrementDepth = ({ request, key }) => {
    if (get(request, ['headers', key]) === undefined) {
        set(request, ['plugins', NAME, key], 0);
        return true;
    }

    const ogDepth = Number(get(request, ['headers', key], 0));

    if (isNaN(ogDepth)) {
        debug('Depth is NaN: %o', get(request, ['headers', key]));
        set(request, ['plugins', NAME, key], get(request, ['headers', key]));
        return true;
    }

    debug('Depth before: %d', ogDepth);
    set(request, ['plugins', NAME, key], ogDepth + 1);
    debug('Depth after: %d', get(request, ['plugins', NAME, key]));
    return true;
};

internals.GoodTracerStream = class GoodSourceTracer extends Stream.Transform {
    constructor(cache, options) {
        super({ objectMode: true });

        this._cache = cache;

        this._settings = Hoek.applyToDefaults(internals.settings, options);
    }

    _transform(data, enc, next) {
        return next(null, this.injectTracerObject(data));
    }

    injectTracerObject(data) {
        debug('log event type: %s', data.event);

        // If we have a request, we can look for tracer info
        const requestID = get(data, 'id');
        if (requestID) {
            debug('found request id: %s', requestID);

            // Lookup info from cache
            const value = this._cache.get(requestID);
            if (value) {
                debug('found value in cache: %o', value);

                // Set the tracer object
                set(data, 'tracer', value);
                if (this._settings.cache.extendTTLOnGet) {
                    // Reset TTL on cached value
                    cacheDebug('reset ttl for %s', requestID);
                    this._cache.ttl(requestID);
                }
            }
        }

        return data;
    }
};

internals.goodTracerStreamFactory = (server, options) => new internals.GoodTracerStream(server, options);

exports.name = NAME;

exports.register = (server, options) => {
    internals.settings = Hoek.applyToDefaults(DEFAULTS, options);
    debug('Initialized with settings: %o', internals.settings);

    // Establish cache
    cacheDebug('establishing cache with settings: %o', internals.settings.cache);
    const cache = new NodeCache(internals.settings.cache);

    cache.on('set', (key, value) => {
        cacheDebug('event: [SET] key: %s value: %o', key, value);
    });

    cache.on('del', (key) => {
        cacheDebug('event: [DEL] key: %s', key);
    });

    cache.on('expired', (key) => {
        cacheDebug('event: [EXP] key: %s', key);
    });

    server.expose('cache', cache);

    // Establish Good reporter stream
    server.expose('GoodTracerStream', internals.goodTracerStreamFactory(cache, internals.settings));

    const {
        traceUUIDHeader, traceDepthHeader, enableStatsRoute, baseRoute, axios, postResponseCleanup
    } = internals.settings;

    // Expose server level axiosConfig
    server.expose('axiosConfig', { traceUUIDHeader, traceDepthHeader, config: axios });

    // Ensure Tracer is in place
    server.ext('onRequest', (request, h) => {
        const tracerUUID = get(request, ['headers', traceUUIDHeader], uuidv4());
        set(request, ['plugins', NAME, traceUUIDHeader], tracerUUID);
        internals.incrementDepth({
            request,
            key: traceDepthHeader
        });

        // set tracer info in memory cache
        const requestId = get(request, 'info.id', 'NOOP');
        const scopedCache = get(request, ['server', 'plugins', NAME, 'cache']);
        try {
            scopedCache.set(requestId, {
                uuid: tracerUUID,
                depth: get(request, ['plugins', NAME, traceDepthHeader])
            });
        } catch (e) {
            request.log(['error', 'good-tracer', 'cache'], {
                error: e.name,
                message: e.message,
                cacheStats: get(request, ['server', 'plugins', NAME, 'cache']).getStats()
            });
        }

        debug('Request Trace headers: %o', {
            [traceUUIDHeader]: get(request, ['plugins', NAME, traceUUIDHeader]),
            [traceDepthHeader]: get(request, ['plugins', NAME, traceDepthHeader])
        });

        return h.continue;
    });

    server.ext('onPreAuth', (request, h) => {
        const axiosConfigs = {
            ...(options.axios || {}),
            ...get(request, ['route', 'settings', 'plugins', NAME, 'axios'], {})
        };

        for (const [key, config] of Object.entries(axiosConfigs)) {
            if (config === true || isPlainObject(config)) {
                const baseConfig = config === true ? {} : config;

                // provide axios client to request
                const axiosConfig = Hoek.applyToDefaults(baseConfig, {
                    headers: {
                        common: {
                            [traceUUIDHeader]: get(request, ['plugins', NAME, traceUUIDHeader]),
                            [traceDepthHeader]: get(request, ['plugins', NAME, traceDepthHeader])
                        }
                    }
                });

                const instance = factory(axiosConfig);
                set(request, ['plugins', NAME, 'axios', key], instance);
            }
        }

        return h.continue;
    });

    // before response, set the header on the response object for logging and downstream use.
    server.ext('onPreResponse', (request, h) => {
        let headerPath;
        if (request.response.isBoom) {
            headerPath = ['response', 'output', 'headers'];
        } else {
            headerPath = ['response', 'headers'];
        }

        set(request, [...headerPath, traceUUIDHeader], get(request, ['plugins', NAME, traceUUIDHeader]));
        set(request, [...headerPath, traceDepthHeader], get(request, ['plugins', NAME, traceDepthHeader]));

        debug('Response Trace headers: %o', {
            [traceUUIDHeader]: get(request, [...headerPath, traceUUIDHeader]),
            [traceDepthHeader]: get(request, [...headerPath, traceDepthHeader])
        });

        return h.continue;
    });

    if (postResponseCleanup) {
        debug('enabling post response cleanup');
        server.events.on('response', (request) => {
            const requestId = get(request, 'info.id', 'NOOP');
            const scopedCache = get(request, ['server', 'plugins', NAME, 'cache']);

            // default delay is 1 second
            const delay = get(postResponseCleanup, 'delay', 1);

            // clean up cache
            cacheDebug('set ttl for %s to %d sec', requestId, delay);
            scopedCache.ttl(requestId, delay);
        });
    }
    // End Trace Setup

    // Add stats route to view cache metrics
    if (enableStatsRoute) {
        debug('enabling stats route: %s', `${baseRoute}/good-tracer/stats`);
        server.route({
            method: 'GET',
            path: `${baseRoute}/good-tracer/stats`,
            handler: (request) => get(request, ['server', 'plugins', NAME, 'cache']).getStats()
        });
    }
};
