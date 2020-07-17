const nock = require('nock');
const axiosFactory = require('../lib/axiosFactory');

describe('axiosFactory', () => {
    it('return an axios client', () => {
        const client = axiosFactory({ headers: { common: { 'user-agent': 'test-mctestings' } } });
        expect(client.interceptors.request).toBeDefined();
        expect(client.interceptors.response).toBeDefined();
        expect(client.defaults.headers.common).toEqual({
            Accept: 'application/json, text/plain, */*',
            'user-agent': 'test-mctestings'
        });
    });

    it('passthrough a good response', async () => {
        const client = axiosFactory({ headers: { common: { 'user-agent': 'test-mctestings' } } });

        nock('http://test.com')
            .get('/test')
            .reply(200, 'success');

        const ret = await client.get('http://test.com/test');
        expect(ret.status).toBe(200);
        expect(ret.data).toBe('success');
    });

    it('generate boom error on bad repsonse', async (done) => {
        const client = axiosFactory({ headers: { common: { 'user-agent': 'test-mctestings' } } });

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
        const client = axiosFactory();

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
