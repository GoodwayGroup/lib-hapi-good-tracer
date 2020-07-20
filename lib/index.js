const Stream = require('stream');
const Hoek = require('@hapi/hoek');
const debug = require('debug')('hapi:plugins:good-tracer');
const NodeCache = require('node-cache');
const { v4: uuidv4 } = require('uuid');
const { get, set, isNaN } = require('lodash');
const { factory: axiosFactory } = require('./axios');

const NAME = 'goodTracer';

const DEFAULTS = {
    traceUUIDHeader: 'x-gg-trace-uuid',
    traceDepthHeader: 'x-gg-trace-depth',
    baseRoute: '',
    enableStatsRoute: false,
    cache: {
        ttl: 2 * 60, // 2 minutes
        checkPeriod: 5 * 60, // 5 minutes
        maxKeys: 5000,
        extendTTLOnGet: true, // extend TTL on cache get
        useClones: false
    },
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
        debug('event type: %s', data.event);

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
    const cache = new NodeCache(internals.settings.cache);
    server.expose('cache', cache);

    // Establish Good reporter stream
    server.expose('GoodTracerStream', internals.goodTracerStreamFactory(cache, internals.settings));

    const {
        traceUUIDHeader, traceDepthHeader, enableStatsRoute, baseRoute, axios
    } = internals.settings;

    // Expose axiosFactory
    server.expose('axiosFactory', axiosFactory);
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
        scopedCache.set(requestId, {
            uuid: tracerUUID,
            depth: get(request, ['plugins', NAME, traceDepthHeader])
        });

        debug('Request Trace headers: %o', {
            [traceUUIDHeader]: get(request, ['plugins', NAME, traceUUIDHeader]),
            [traceDepthHeader]: get(request, ['plugins', NAME, traceDepthHeader])
        });

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
    // End Trace Setup

    // Add stats route to view cache metrics
    if (enableStatsRoute) {
        server.route({
            method: 'GET',
            path: `${baseRoute}/good-tracer/stats`,
            handler: (request) => get(request, ['server', 'plugins', NAME, 'cache']).getStats()
        });
    }
};

exports.addAxiosRoutePreHookFactory = (assign = 'axios') => ({
    assign,
    method: (request) => {
        const factory = get(request, ['server', 'plugins', NAME, 'axiosFactory']);
        const { traceUUIDHeader, traceDepthHeader, config } = get(request, ['server', 'plugins', NAME, 'axiosConfig'], {});

        // provide axios client to request
        const axiosConfig = Hoek.applyToDefaults(config, {
            headers: {
                common: {
                    [traceUUIDHeader]: get(request, ['plugins', NAME, traceUUIDHeader]),
                    [traceDepthHeader]: get(request, ['plugins', NAME, traceDepthHeader])
                }
            }
        });

        return factory(axiosConfig);
    }
});

exports.addAxiosRoutePreHook = exports.addAxiosRoutePreHookFactory();
