const Hapi = require('@hapi/hapi');
const plugin = require('../lib');

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
