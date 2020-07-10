const Stream = require('stream');
const Hoek = require('@hapi/hoek');
const debug = require('debug')('hapi:plugins:good-tracer');
const NodeCache = require('node-cache');
const { v4: uuidv4 } = require('uuid');
const { get, set, isNaN } = require('lodash');
const axiosFactory = require('./axiosFactory');

const NAME = 'goodTracer';

const DEFAULTS = {
    traceUUIDHeader: 'x-gg-trace-uuid',
    traceSeqIDHeader: 'x-gg-trace-seqid',
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

internals.incrementSeqID = ({ request, key }) => {
    if (get(request, ['headers', key]) === undefined) {
        set(request, ['plugins', NAME, key], 0);
        return true;
    }

    const ogSeqId = Number(get(request, ['headers', key], 0));

    if (isNaN(ogSeqId)) {
        debug('SeqId is NaN: %o', get(request, ['headers', key]));
        set(request, ['plugins', NAME, key], get(request, ['headers', key]));
        return true;
    }

    debug('SeqId before: %d', ogSeqId);
    set(request, ['plugins', NAME, key], ogSeqId + 1);
    debug('SeqId after: %d', get(request, ['plugins', NAME, key]));
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
        traceUUIDHeader, traceSeqIDHeader, enableStatsRoute, baseRoute, axios
    } = internals.settings;

    // Expose axiosFactory
    server.expose('axiosFactory', axiosFactory);
    server.expose('axiosConfig', { traceUUIDHeader, traceSeqIDHeader, config: axios });

    // Ensure Tracer is in place
    server.ext('onRequest', (request, h) => {
        const tracerUUID = get(request, ['headers', traceUUIDHeader], uuidv4());
        set(request, ['plugins', NAME, traceUUIDHeader], tracerUUID);
        internals.incrementSeqID({
            request,
            key: traceSeqIDHeader
        });

        // set tracer info in memory cache
        const requestId = get(request, 'info.id', 'NOOP');
        const scopedCache = get(request, ['server', 'plugins', NAME, 'cache']);
        scopedCache.set(requestId, {
            uuid: tracerUUID,
            seq: get(request, ['plugins', NAME, traceSeqIDHeader])
        });

        debug('Request Trace headers: %o', {
            [traceUUIDHeader]: get(request, ['plugins', NAME, traceUUIDHeader]),
            [traceSeqIDHeader]: get(request, ['plugins', NAME, traceSeqIDHeader])
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
        set(request, [...headerPath, traceSeqIDHeader], get(request, ['plugins', NAME, traceSeqIDHeader]));

        debug('Response Trace headers: %o', {
            [traceUUIDHeader]: get(request, [...headerPath, traceUUIDHeader]),
            [traceSeqIDHeader]: get(request, [...headerPath, traceSeqIDHeader])
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

exports.addAxiosRoutePreHook = [{
    method: (request) => {
        const factory = get(request, ['plugins', NAME, 'axiosFactory']);
        const { traceUUIDHeader, traceSeqIDHeader, config } = get(request, ['plugins', NAME, 'axiosConfig'], {});

        // provide axios client to request
        const axiosConfig = Hoek.applyToDefaults(config, {
            headers: {
                common: {
                    [traceUUIDHeader]: get(request, ['plugins', NAME, traceUUIDHeader]),
                    [traceSeqIDHeader]: get(request, ['plugins', NAME, traceSeqIDHeader])
                }
            }
        });

        return factory(axiosConfig);
    },
    assign: 'axios'
}];
