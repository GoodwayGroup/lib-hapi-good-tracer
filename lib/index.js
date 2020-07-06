const Hoek = require('@hapi/hoek');
const debug = require('debug')('hapi:plugins:trace-headers');
const { v4: uuidv4 } = require('uuid');
const { get, set, isNaN } = require('lodash');

const defaults = {
    traceUUIDHeader: 'x-gg-trace-uuid',
    traceSeqIDHeader: 'x-gg-trace-seqid',
};

exports.incrementSeqID = ({ request, key }) => {
    const ogSeqId = Number(get(request, ['headers', key], 0));

    if (isNaN(ogSeqId)) {
        debug('SeqId is NaN: %o', get(request, ['headers', key]));
        return true;
    }

    debug('SeqId before: %d', ogSeqId);
    set(request, ['headers', key], ogSeqId + 1);
    debug('SeqId after: %d', get(request, ['headers', key]));
    return true;
};

exports.register = (server, options) => {
    const settings = Hoek.applyToDefaults(defaults, options);
    debug('Initialized with settings: %o', settings);

    // Ensure Trace Header is in place
    //
    // We want to inject the header on the request if it does not already exist
    // BEFORE reaching the handler
    server.ext('onRequest', (request, h) => {
        if (!get(request, ['headers', settings.traceUUIDHeader])) {
            set(request, ['headers', settings.traceUUIDHeader], uuidv4());
        }

        if (get(request, ['headers', settings.traceSeqIDHeader]) === undefined) {
            set(request, ['headers', settings.traceSeqIDHeader], 0);
        } else {
            exports.incrementSeqID({ request, key: settings.traceSeqIDHeader });
        }

        debug('Request Trace headers: %o', {
            [settings.traceUUIDHeader]: get(request, ['headers', settings.traceUUIDHeader]),
            [settings.traceSeqIDHeader]: get(request, ['headers', settings.traceSeqIDHeader])
        });

        return h.continue;
    });

    // before response, set the header on the response object for logging and downstream use.
    server.ext('onPreResponse', (request, h) => {
        set(request, ['response', 'headers', settings.traceUUIDHeader], get(request, ['headers', settings.traceUUIDHeader]));
        set(request, ['response', 'headers', settings.traceSeqIDHeader], get(request, ['headers', settings.traceSeqIDHeader]));

        debug('Response Trace headers: %o', {
            [settings.traceUUIDHeader]: get(request, ['response', 'headers', settings.traceUUIDHeader]),
            [settings.traceSeqIDHeader]: get(request, ['response', 'headers', settings.traceSeqIDHeader])
        });

        return h.continue;
    });
    // End Trace Setup
};

exports.pkg = require('../package.json');
