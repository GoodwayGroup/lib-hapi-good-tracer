const Stream = require('stream');
const Hoek = require('@hapi/hoek');
const NodeCache = require('node-cache');
const debug = require('debug')('hapi:plugins:good-tracer');
const { v4: uuidv4 } = require('uuid');
const { get, set, isNaN } = require('lodash');

const NAME = 'goodTracer';

const DEFAULTS = {
    traceUUIDHeader: 'x-gg-trace-uuid',
    traceSeqIDHeader: 'x-gg-trace-seqid',
    cache: {
        ttl: 2 * 60, // 2 minutes
        checkPeriod: 5 * 60, // 5 minutes
        maxKeys: 5000,
        extendTTLOnGet: true, // extend TTL on cache get
        useClones: false
    }
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

internals.injectTracerObject = (data) => {
    debug('event type: %s', data.event);
    // lookup info from cache
    const requestID = get(data, 'id');
    if (requestID) {
        debug('found request id: %s', requestID);
        const value = internals.cache.get(requestID);
        if (value) {
            debug('found value in cache: %o', value);
            set(data, 'tracer', value);
            if (internals.settings.cache.extendTTLOnGet) {
                // reset TTL on cached value
                internals.cache.ttl(requestID);
            }
        }
    }

    return data;
};

internals.GoodTracerStream = class GoodSourceTracer extends Stream.Transform {
    constructor(options) {
        super({ objectMode: true });

        this._settings = Hoek.applyToDefaults(internals.settings, options);
    }

    _transform(data, enc, next) { // eslint-disable-line class-methods-use-this
        return next(null, internals.injectTracerObject(data));
    }
};

exports.register = (server, options) => {
    internals.settings = Hoek.applyToDefaults(DEFAULTS, options);
    debug('Initialized with settings: %o', internals.settings);

    internals.cache = new NodeCache(internals.settings.cache);

    // Establish cache
    server.expose('GoodTracerStream', new internals.GoodTracerStream());

    const { traceUUIDHeader, traceSeqIDHeader } = internals.settings;

    // Ensure Tracer is in place
    server.ext('onRequest', (request, h) => {
        const tracerUUID = get(request, ['headers', traceUUIDHeader], uuidv4());
        set(request, ['plugins', NAME, traceUUIDHeader], tracerUUID);
        internals.incrementSeqID({
            request,
            key: traceSeqIDHeader
        });

        // set tracer info in memory cache
        const requestId = get(request, 'info.id');
        if (requestId) {
            internals.cache.set(requestId, {
                uuid: tracerUUID,
                seq: get(request, ['plugins', NAME, traceSeqIDHeader])
            });
        }

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
};

exports.name = NAME;
