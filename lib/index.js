const Hoek = require('@hapi/hoek');
const debug = require('debug')('hapi:plugins:trace-headers');
const { v4: uuidv4 } = require('uuid');
const { get, set, merge } = require('lodash');

const defaults = {
    traceUUIDHeader: 'x-gg-trace-uuid',
    traceSeqIDHeader: 'x-gg-trace-seqid',
};

exports.injectHeaders = ({ request, headers = [] }) => {
    const ogHeaders = get(request, 'headers', {});
    set(request, 'headers', merge(ogHeaders, headers));
    return true;
};

exports.incrementSeqID = ({ request, key }) => {
    const ogSeqId = Number(get(request, ['headers', key], 0));
    set(request, ['headers', key], ogSeqId + 1);
    return true;
};

exports.register = (server, options) => {
    const settings = Hoek.applyToDefaults(defaults, options || {});
    debug('Initialized with settings: %o', settings);

    // Ensure Trace Header is in place
    //
    // We want to inject the header on the request if it does not already exist
    // BEFORE reaching the handler
    server.ext('onRequest', (request, h) => {
        if (!get(request, ['headers', settings.traceUUIDHeader])) {
            set(request, ['headers', settings.traceUUIDHeader], uuidv4());
        }

        return h.continue;
    });

    // before reposnse, set the header on the response object for logging and downstream use.
    server.ext('onPreResponse', (request, h) => {
        // if trace header on request, add it to response
        const traceId = get(request, ['headers', settings.traceUUIDHeader]);
        if (traceId) {
            set(request, ['response', 'headers', settings.traceUUIDHeader], traceId);
        }

        return h.continue;
    });
    // End Trace Setup
};

exports.pkg = require('../package.json');
