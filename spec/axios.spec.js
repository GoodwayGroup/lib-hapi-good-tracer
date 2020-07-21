const nock = require('nock');
const Boom = require('@hapi/boom');
const { factory, handleError } = require('../lib/axios');

describe('factory', () => {
    it('return an axios client', () => {
        const client = factory({ headers: { common: { 'user-agent': 'test-mctestings' } } });
        expect(client.interceptors.request).toBeDefined();
        expect(client.interceptors.response).toBeDefined();
        expect(client.defaults.headers.common).toEqual({
            Accept: 'application/json, text/plain, */*',
            'user-agent': 'test-mctestings'
        });
    });

    it('passthrough a good response', async () => {
        const client = factory({ headers: { common: { 'user-agent': 'test-mctestings' } } });

        nock('http://test.com')
            .get('/test')
            .reply(200, 'success');

        const ret = await client.get('http://test.com/test');
        expect(ret.status).toBe(200);
        expect(ret.data).toBe('success');
    });

    it('generate boom error on bad repsonse', async (done) => {
        const client = factory({ headers: { common: { 'user-agent': 'test-mctestings' } } });

        nock('http://test.com')
            .get('/test')
            .reply(404, 'nope');

        try {
            await client.get('http://test.com/test');
            done.fail();
        } catch (e) {
            expect(e.message).toBe('Request failed with status code 404');
            expect(e).toMatchSnapshot();
            done();
        }
    });

    it('generate boom error on bad repsonse [DEV_EXPOSE_AXIOS_ERRORS enabled]', async (done) => {
        process.env.DEV_EXPOSE_AXIOS_ERRORS = true;
        const client = factory();

        nock('http://test.com')
            .get('/test')
            .reply(404, 'nope');

        try {
            await client.get('http://test.com/test');
            done.fail();
        } catch (e) {
            expect(e.message).toBe('Request failed with status code 404');
            expect(e).toMatchSnapshot();
            done();
        }
        delete process.env.DEV_EXPOSE_AXIOS_ERRORS;
    });
});

describe('handleError', () => {
    it('should inject a place holder getHeaders stub if none is found', (done) => {
        try {
            handleError(new Boom.Boom('i made an error', {
                decorate: {
                    response: {
                        data: {
                            message: 'a deeper meaning',
                            nested: 'data'
                        }
                    }
                }
            }));
            done.fail();
        } catch (e) {
            expect(e.message).toBe('i made an error');
            expect(e.output.statusCode).toBe(500);
            expect(e.data.data).toEqual({
                message: 'a deeper meaning',
                nested: 'data'
            });
            expect(e.data.requestHeaders).toBe('');
            done();
        }
    });

    it('add extra data when DEV_EXPOSE_AXIOS_ERRORS is enabled', (done) => {
        process.env.DEV_EXPOSE_AXIOS_ERRORS = true;
        try {
            handleError(new Boom.Boom('i made an error', {
                decorate: {
                    response: {
                        status: 410,
                        data: {
                            message: 'a deeper meaning',
                            nested: 'data'
                        },
                        request: {
                            getHeaders: () => ({ stuff: 'things' })
                        }
                    }
                }
            }));
            done.fail();
        } catch (e) {
            expect(e.message).toBe('a deeper meaning: i made an error');
            expect(e.output.statusCode).toBe(410);
            expect(e.data.data).toEqual({
                message: 'a deeper meaning',
                nested: 'data'
            });
            expect(e.data.requestHeaders).toEqual({ stuff: 'things' });
            done();
        }
        delete process.env.DEV_EXPOSE_AXIOS_ERRORS;
    });
});
