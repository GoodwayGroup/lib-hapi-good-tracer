const Hapi = require('@hapi/hapi');
const Good = require('@hapi/good');
const plugin = require('../lib');

describe('good-tracer options', () => {
    let server;

    describe('custom header keys', () => {
        beforeEach(async () => {
            server = new Hapi.Server({
                host: 'localhost',
                port: 8085
            });

            const get = () => 'Success!';
            server.route({
                method: 'GET', path: '/', handler: get, config: { cors: true }
            });

            await server.register({
                plugin,
                options: {
                    traceUUIDHeader: 'x-custom-trace-uuid',
                    traceSeqIDHeader: 'x-custom-trace-seqid',
                    baseRoute: '/test-service',
                    cache: {
                        extendTTLOnGet: false
                    }
                }
            });

            await server.register({
                plugin: Good,
                options: {
                    reporters: {
                        console: [
                            server.plugins.goodTracer.GoodTracerStream
                        ]
                    }
                }
            });
        });

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

    describe('', () => {
        beforeEach(async () => {
            server = new Hapi.Server({
                host: 'localhost',
                port: 8085
            });

            const get = () => 'Success!';
            server.route({
                method: 'GET', path: '/', handler: get, config: { cors: true }
            });
        });

        it('should publish a stats route', async () => {
            await server.register({
                plugin,
                options: {
                    enableStatsRoute: true
                }
            });

            const result = await server.inject('/good-tracer/stats');
            expect(result.statusCode).toBe(200);
            expect(result.result).toEqual({
                hits: expect.any(Number),
                keys: expect.any(Number),
                ksize: expect.any(Number),
                misses: expect.any(Number),
                vsize: expect.any(Number)
            });
        });

        it('should publish a stats route with a custom base route', async () => {
            await server.register({
                plugin,
                options: {
                    enableStatsRoute: true,
                    baseRoute: '/test-service'
                }
            });

            const result = await server.inject('/test-service/good-tracer/stats');
            expect(result.statusCode).toBe(200);
            expect(result.result).toEqual({
                hits: expect.any(Number),
                keys: expect.any(Number),
                ksize: expect.any(Number),
                misses: expect.any(Number),
                vsize: expect.any(Number)
            });
        });
    });
});
