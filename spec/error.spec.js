const Stream = require('stream');
const Hapi = require('@hapi/hapi');
const Good = require('@hapi/good');
const { get } = require('lodash');
const plugin = require('../lib');

function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

describe('cache max keys error', () => {
    let server;
    let logLines = [];

    beforeEach(async () => {
        server = new Hapi.Server({
            host: 'localhost',
            port: 8085
        });

        const getWithLog = (request) => {
            request.log(['test'], 'This is a test!');
            return 'Success!';
        };

        server.route({
            method: 'GET',
            path: '/log',
            handler: getWithLog
        });

        const getWithSleep = async () => {
            await sleep(500);
            return 'Success!';
        };

        server.route({
            method: 'GET',
            path: '/sleep',
            handler: getWithSleep
        });

        await server.register({
            plugin,
            options: {
                cache: {
                    maxKeys: 1
                }
            }
        });

        const LogEvents = class extends Stream.Transform {
            constructor() {
                super({ objectMode: true });
                logLines = [];
                this.once('end', () => {
                    this._finalized = true;
                });
            }

            _transform(value, enc, next) { // eslint-disable-line class-methods-use-this
                logLines.push(value);
                next(null, value);
            }
        };

        const logReporters = {
            console: [
                server.plugins.goodTracer.GoodTracerStream,
                {
                    module: '@hapi/good-squeeze',
                    name: 'Squeeze',
                    args: [{
                        response: '*',
                        log: '*',
                        request: '*',
                        error: '*',
                        ops: '*'
                    }]
                }, {
                    module: '@hapi/good-squeeze',
                    name: 'SafeJson'
                },
                new LogEvents()
            ]
        };

        await server.register({
            plugin: Good,
            options: {
                reporters: logReporters,
            }
        });
    });

    it('should catch the error and log out stats', async () => {
        await Promise.all([
            server.inject('/sleep'),
            server.inject('/log'),
        ]);

        // find the error
        const errLogStr = logLines.filter((l) => {
            const lp = JSON.parse(l);
            return get(lp, 'tags[0]', null) === 'error';
        })[0];
        const errLog = JSON.parse(errLogStr);
        // const errLog = JSON.parse(logLines[2]);
        expect(errLog.tags).toEqual(['error', 'good-tracer', 'cache']);
        expect(errLog.data).toEqual({
            error: 'ECACHEFULL',
            message: 'Cache max keys amount exceeded',
            cacheStats: {
                hits: expect.any(Number),
                misses: 1,
                keys: 1,
                ksize: expect.any(Number),
                vsize: expect.any(Number)
            }
        });

        const stats = logLines.reduce((prev, line) => {
            const parsed = JSON.parse(line);

            prev[parsed.event] += 1;
            if (parsed.event === 'request') {
                prev[parsed.tags[0]] += 1;
            }
            return prev;
        }, {
            error: 0, response: 0, request: 0, ops: 0, test: 0
        });

        expect(stats).toEqual({
            error: 1, response: 2, request: 2, ops: 0, test: 1
        });
    });
});
