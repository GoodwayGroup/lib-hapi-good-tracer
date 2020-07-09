const Stream = require('stream');
const Hapi = require('@hapi/hapi');
const Good = require('@hapi/good');
const plugin = require('../lib');

describe('good-tracer log reporter stream', () => {
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
    });

    describe('cache get failure', () => {
        it('should not inject the tracer object', async () => {
            const NodeCache = require('node-cache'); // eslint-disable-line global-require
            const getSpy = jest.spyOn(NodeCache.prototype, 'get').mockReturnValue(undefined);
            const setSpy = jest.spyOn(NodeCache.prototype, 'set').mockReturnValue(true);

            await server.register({
                plugin,
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
                    ops: {
                        interval: 900
                    },
                    includes: {
                        request: ['headers'],
                        response: ['headers']
                    }
                }
            });

            await server.inject('/log');

            expect(setSpy).toHaveBeenCalledTimes(1);
            expect(getSpy).toHaveBeenCalledTimes(2);
            expect(logLines.length).toBe(2);
            const stats = logLines.reduce((prev, line) => {
                const parsed = JSON.parse(line);
                expect(parsed.tracer).not.toBeDefined();

                prev[parsed.event] += 1;
                return prev;
            }, {
                error: 0, response: 0, request: 0, ops: 0
            });

            expect(stats).toEqual({
                error: 0, response: 1, request: 1, ops: 0
            });
        });
    });
});
