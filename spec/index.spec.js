const Hapi = require('@hapi/hapi');
const Good = require('@hapi/good');
const { set } = require('lodash');
const plugin = require('../lib');

describe('good-tracer plugin', () => {
    let server;

    beforeEach(async () => {
        server = new Hapi.Server({
            host: 'localhost',
            port: 8085
        });

        const get = () => 'Success!';
        server.route({
            method: 'GET', path: '/', handler: get, config: { cors: true }
        });

        return server.register({
            plugin
        });
    });

    describe.each([
        { desc: 'no headers passed', expectedId: 0 },
        { desc: 'seqId header passed', passedId: 0, expectedId: 1 },
        { desc: 'seqId header passed', passedId: '1336', expectedId: 1337 },
        { desc: 'trace header passed', expectedId: 0, passedTrace: 'iCanBeANYTHING' },
    ])('general use cases', ({
        desc, expectedId, passedId, passedTrace
    }) => {
        it(`${desc}: Id ${passedId} -> ${expectedId} UUID ${passedTrace || 'generated'}`, async () => {
            const options = {
                method: 'GET',
                url: '/'
            };

            if (passedId !== undefined) {
                set(options, 'headers.x-gg-trace-seqid', passedId);
            }

            if (passedTrace !== undefined) {
                set(options, 'headers.x-gg-trace-uuid', passedTrace);
            }

            const result = await server.inject(options);
            expect(result.headers['x-gg-trace-uuid']).toBeDefined();
            if (passedTrace !== undefined) {
                expect(result.headers['x-gg-trace-uuid']).toBe(passedTrace);
            } else {
                expect(result.headers['x-gg-trace-uuid']).toMatch(/\w+-\w+-\w+-\w+-\w+/);
            }
            expect(result.headers['x-gg-trace-seqid']).toBeDefined();
            expect(result.headers['x-gg-trace-seqid']).toBe(expectedId);
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

        const result = await server.inject(options);
        expect(result.headers['x-gg-trace-uuid']).toBeDefined();
        expect(result.headers['x-gg-trace-uuid']).toMatch(/\w+-\w+-\w+-\w+-\w+/);
        expect(result.headers['x-gg-trace-seqid']).toBeDefined();
        expect(result.headers['x-gg-trace-seqid']).toBe('not a number');
    });
});

describe('good-tracer options', () => {
    let server;

    beforeEach(async () => {
        server = new Hapi.Server({
            host: 'localhost',
            port: 8085
        });

        const get = () => 'Success!';
        server.route({
            method: 'GET', path: '/', handler: get, config: { cors: true }
        });

        return server.register({
            plugin,
            options: {
                traceUUIDHeader: 'x-custom-trace-uuid',
                traceSeqIDHeader: 'x-custom-trace-seqid',
            }
        });
    });

    describe('custom header keys', () => {
        it('custom trace headers', async () => {
            const result = await server.inject('/');
            expect(result.headers['x-gg-trace-uuid']).not.toBeDefined();
            expect(result.headers['x-custom-trace-uuid']).toBeDefined();
            expect(result.headers['x-custom-trace-uuid']).toMatch(/\w+-\w+-\w+-\w+-\w+/);
            expect(result.headers['x-gg-trace-seqid']).not.toBeDefined();
            expect(result.headers['x-custom-trace-seqid']).toBeDefined();
            expect(result.headers['x-custom-trace-seqid']).toBe(0);
        });

        it('custom trace headers w/ values', async () => {
            const options = {
                method: 'GET',
                url: '/',
                headers: {
                    'x-custom-trace-uuid': 'aCoolValue1234',
                    'x-custom-trace-seqid': 110
                }
            };

            const result = await server.inject(options);
            expect(result.headers['x-gg-trace-uuid']).not.toBeDefined();
            expect(result.headers['x-custom-trace-uuid']).toBeDefined();
            expect(result.headers['x-gg-trace-seqid']).not.toBeDefined();
            expect(result.headers['x-custom-trace-seqid']).toBeDefined();
            expect(result.headers['x-custom-trace-seqid']).toBe(111);
        });
    });
});

describe('good-tracer log reporter stream', () => {
    let server;

    beforeEach(async () => {
        server = new Hapi.Server({
            host: 'localhost',
            port: 8085
        });

        const get = (request) => {
            request.log(['test'], 'This is a test!');
            return 'Success!';
        };

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
                }, 'stdout']
        };

        await server.register({
            plugin: Good,
            options: {
                reporters: logReporters,
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

        const result = await server.inject(options);
        expect(result.headers['x-gg-trace-uuid']).toBeDefined();
        expect(result.headers['x-gg-trace-uuid']).toMatch(/\w+-\w+-\w+-\w+-\w+/);
        expect(result.headers['x-gg-trace-seqid']).toBeDefined();
        expect(result.headers['x-gg-trace-seqid']).toBe('not a number');
    });

    describe('general logging', () => {
        it('custom trace headers', async () => {
            const result = await server.inject('/');
            expect(result.headers['x-gg-trace-uuid']).toBeDefined();
            expect(result.headers['x-gg-trace-uuid']).toMatch(/\w+-\w+-\w+-\w+-\w+/);
            expect(result.headers['x-gg-trace-seqid']).toBeDefined();
            expect(result.headers['x-gg-trace-seqid']).toBe(0);
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

            const result = await server.inject(options);
            expect(result.headers['x-gg-trace-uuid']).toBeDefined();
            expect(result.headers['x-gg-trace-uuid']).toBe('aCoolValue1234');
            expect(result.headers['x-gg-trace-seqid']).toBeDefined();
            expect(result.headers['x-gg-trace-seqid']).toBe(111);
        });
    });

    describe('error logging', () => {
        it('custom trace headers', async () => {
            const result = await server.inject('/error');
            expect(result.headers['x-gg-trace-uuid']).toBeDefined();
            expect(result.headers['x-gg-trace-uuid']).toMatch(/\w+-\w+-\w+-\w+-\w+/);
            expect(result.headers['x-gg-trace-seqid']).toBeDefined();
            expect(result.headers['x-gg-trace-seqid']).toBe(0);
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

            const result = await server.inject(options);
            expect(result.headers['x-gg-trace-uuid']).toBeDefined();
            expect(result.headers['x-gg-trace-uuid']).toBe('aCoolValue1234');
            expect(result.headers['x-gg-trace-seqid']).toBeDefined();
            expect(result.headers['x-gg-trace-seqid']).toBe(111);
        });
    });

    describe('request.log', () => {
        it('custom trace headers', async () => {
            const result = await server.inject('/log');
            expect(result.headers['x-gg-trace-uuid']).toBeDefined();
            expect(result.headers['x-gg-trace-uuid']).toMatch(/\w+-\w+-\w+-\w+-\w+/);
            expect(result.headers['x-gg-trace-seqid']).toBeDefined();
            expect(result.headers['x-gg-trace-seqid']).toBe(0);
        });
    });
});
