const Stream = require('stream');
const Hapi = require('@hapi/hapi');
const Good = require('@hapi/good');
const plugin = require('../lib');

function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

describe('good-tracer log reporter stream', () => {
    let server;
    let logLines = [];

    beforeEach(async () => {
        server = new Hapi.Server({
            host: 'localhost',
            port: 8085
        });

        const get = () => 'Success!';

        const getWithLog = (request) => {
            request.log(['test'], 'This is a test!');
            return 'Success!';
        };

        const getError = () => {
            throw Error('oh no!');
        };

        server.route({
            method: 'GET',
            path: '/',
            handler: get
        });
        server.route({
            method: 'GET',
            path: '/log',
            handler: getWithLog
        });
        server.route({
            method: 'GET',
            path: '/error',
            handler: getError
        });

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
    });

    it('should not error or modify when a non-number is passed for a seqId', async () => {
        const options = {
            method: 'GET',
            url: '/',
            headers: {
                'x-gg-trace-seqid': 'not a number'
            }
        };

        await server.inject(options);
        expect(logLines.length).toBe(1);
        const l1 = JSON.parse(logLines[0]);
        expect(l1.event).toBe('response');
        expect(l1.tracer).toBeDefined();
        expect(l1.tracer.uuid).toBeDefined();
        expect(l1.tracer.seq).toBe('not a number');
    });

    describe('general logging', () => {
        it('should inject the tracer object into log events', async () => {
            await server.inject('/');
            expect(logLines.length).toBe(1);
            const l1 = JSON.parse(logLines[0]);
            expect(l1.event).toBe('response');
            expect(l1.tracer).toBeDefined();
            expect(l1.tracer.uuid).toBeDefined();
            expect(l1.tracer.seq).toBe(0);
        });

        it('custom trace headers w/ values', async () => {
            const options = {
                method: 'GET',
                url: '/',
                headers: {
                    'x-gg-trace-uuid': 'aCoolValue1234',
                    'x-gg-trace-seqid': 110
                }
            };

            await server.inject(options);
            expect(logLines.length).toBe(1);
            const l1 = JSON.parse(logLines[0]);
            expect(l1.event).toBe('response');
            expect(l1.tracer).toBeDefined();
            expect(l1.tracer.uuid).toBe('aCoolValue1234');
            expect(l1.tracer.seq).toBe(111);
        });
    });

    describe('error logging', () => {
        it('should inject the tracer object into log events', async () => {
            await server.inject('/error');

            expect(logLines.length).toBe(2);
            const stats = logLines.reduce((prev, line) => {
                const parsed = JSON.parse(line);
                expect(parsed.tracer).toBeDefined();
                expect(parsed.tracer.uuid).toBeDefined();
                expect(parsed.tracer.seq).toBe(0);

                prev[parsed.event] += 1;
                return prev;
            }, {
                error: 0, response: 0, request: 0, ops: 0
            });

            expect(stats).toEqual({
                error: 1, response: 1, request: 0, ops: 0
            });
        });

        it('custom trace headers w/ values', async () => {
            const options = {
                method: 'GET',
                url: '/error',
                headers: {
                    'x-gg-trace-uuid': 'aCoolValue1234',
                    'x-gg-trace-seqid': 110
                }
            };

            await server.inject(options);

            expect(logLines.length).toBe(2);
            const stats = logLines.reduce((prev, line) => {
                const parsed = JSON.parse(line);
                expect(parsed.tracer).toBeDefined();
                expect(parsed.tracer.uuid).toBe('aCoolValue1234');
                expect(parsed.tracer.seq).toBe(111);

                prev[parsed.event] += 1;
                return prev;
            }, {
                error: 0, response: 0, request: 0, ops: 0
            });

            expect(stats).toEqual({
                error: 1, response: 1, request: 0, ops: 0
            });
        });
    });

    describe('request.log', () => {
        it('should inject the tracer object into log events', async () => {
            await server.inject('/log');

            expect(logLines.length).toBe(2);
            const stats = logLines.reduce((prev, line) => {
                const parsed = JSON.parse(line);
                expect(parsed.tracer).toBeDefined();
                expect(parsed.tracer.uuid).toBeDefined();
                expect(parsed.tracer.seq).toBe(0);

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

    describe('Good ops log', () => {
        it('should not manipulate the ops log events', async () => {
            await server.start();

            await sleep(1000);

            await server.stop();

            expect(logLines.length).toBe(1);
            const stats = logLines.reduce((prev, line) => {
                const parsed = JSON.parse(line);
                expect(parsed.tracer).not.toBeDefined();

                prev[parsed.event] += 1;
                return prev;
            }, {
                error: 0, response: 0, request: 0, ops: 0
            });

            expect(stats).toEqual({
                error: 0, response: 0, request: 0, ops: 1
            });
        });
    });
});
