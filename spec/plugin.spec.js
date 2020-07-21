const Hapi = require('@hapi/hapi');
const { set } = require('lodash');
const plugin = require('../lib');

describe('good-tracer plugin', () => {
    let server;

    async function registerPlugin(options = {}) {
        return server.register({
            plugin,
            options
        });
    }

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

    describe.each([
        { desc: 'no headers passed', expectedId: 0 },
        { desc: 'depth header passed', passedId: 0, expectedId: 1 },
        { desc: 'depth header passed', passedId: '1336', expectedId: 1337 },
        { desc: 'trace header passed', expectedId: 0, passedTrace: 'iCanBeANYTHING' },
    ])('general use cases', ({
        desc, expectedId, passedId, passedTrace
    }) => {
        it(`${desc}: Id ${passedId} -> ${expectedId} UUID ${passedTrace || 'generated'}`, async () => {
            await registerPlugin();

            const options = {
                method: 'GET',
                url: '/'
            };

            if (passedId !== undefined) {
                set(options, 'headers.x-gg-trace-depth', passedId);
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
            expect(result.headers['x-gg-trace-depth']).toBeDefined();
            expect(result.headers['x-gg-trace-depth']).toBe(expectedId);
        });
    });

    it('should not error or modify when a non-number is passed for a depth', async () => {
        await registerPlugin();

        const options = {
            method: 'GET',
            url: '/',
            headers: {
                'x-gg-trace-depth': 'not a number'
            }
        };

        const result = await server.inject(options);
        expect(result.headers['x-gg-trace-uuid']).toBeDefined();
        expect(result.headers['x-gg-trace-uuid']).toMatch(/\w+-\w+-\w+-\w+-\w+/);
        expect(result.headers['x-gg-trace-depth']).toBeDefined();
        expect(result.headers['x-gg-trace-depth']).toBe('not a number');
    });

    it('should not publish a stats route', async () => {
        await registerPlugin();
        const result = await server.inject('/good-tracer/stats');
        expect(result.statusCode).toBe(404);
    });

    it('should expose axios if configured at the plugin level', async () => {
        await registerPlugin({
            axios: {
                main: true,
                second: { baseUrl: 'http://localhost' }
            }
        });

        const handler = jest.fn().mockResolvedValue({ cool: 1337 });

        server.route({
            method: 'GET',
            path: '/check-plugin-axios',
            handler,
            config: { cors: true }
        });

        const options = {
            method: 'GET',
            url: '/check-plugin-axios',
            headers: {
                'x-gg-trace-depth': '2'
            }
        };

        const result = await server.inject(options);
        expect(handler.mock.calls[0][0].plugins[plugin.name].axios.main).toHaveProperty('request');
        expect(handler.mock.calls[0][0].plugins[plugin.name].axios.second).toHaveProperty('request');
        expect(handler.mock.calls[0][0].plugins[plugin.name].axios.second.defaults).toHaveProperty('baseUrl', 'http://localhost');
        expect(result.headers['x-gg-trace-uuid']).toBeDefined();
        expect(result.headers['x-gg-trace-uuid']).toMatch(/\w+-\w+-\w+-\w+-\w+/);
        expect(result.headers['x-gg-trace-depth']).toBeDefined();
        expect(result.headers['x-gg-trace-depth']).toBe(3);
    });

    it('should expose axios if configured at the route level', async () => {
        await registerPlugin();

        const handler = jest.fn().mockResolvedValue({ cool: 1337 });

        server.route({
            method: 'GET',
            path: '/check-route-axios',
            handler,
            config: {
                cors: true,
                plugins: {
                    [plugin.name]: {
                        axios: {
                            main: true,
                            second: false
                        }
                    }
                }
            }
        });

        const options = {
            method: 'GET',
            url: '/check-route-axios',
            headers: {
                'x-gg-trace-depth': '2'
            }
        };

        const result = await server.inject(options);
        expect(handler.mock.calls[0][0].plugins[plugin.name].axios.main).toHaveProperty('request');
        expect(handler.mock.calls[0][0].plugins[plugin.name].axios).not.toHaveProperty('second');
        expect(result.headers['x-gg-trace-uuid']).toBeDefined();
        expect(result.headers['x-gg-trace-uuid']).toMatch(/\w+-\w+-\w+-\w+-\w+/);
        expect(result.headers['x-gg-trace-depth']).toBeDefined();
        expect(result.headers['x-gg-trace-depth']).toBe(3);
    });
});
