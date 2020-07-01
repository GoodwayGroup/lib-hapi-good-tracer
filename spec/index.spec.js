const Hapi = require('@hapi/hapi');
const plugin = require('../lib');

describe('hapi-trace-headers plugin tests', () => {
    describe('general use case', () => {
        let server;

        beforeEach(async () => {
            server = new Hapi.Server({
                host: 'localhost',
                port: 8085
            });

            const get = () => 'Success!';

            const err = () => new Error();

            server.route({
                method: ['GET', 'OPTIONS'], path: '/', handler: get, config: { cors: true }
            });
            server.route({
                method: 'GET', path: '/throwError', handler: err, config: { cors: true }
            });
            server.route({ method: 'GET', path: '/test/withtags', handler: get });
            server.route({
                method: 'GET', path: '/test/{param}', handler: get, config: { cors: true }
            });

            return server.register({
                plugin
            });
        });

        it('should report stats for root path', async () => {
            const result = await server.inject('/');
            expect(result).toBeDefined();
        });
    });

    // describe('options', () => {
    //
    // });
});
