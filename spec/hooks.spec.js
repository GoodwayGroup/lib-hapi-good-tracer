const { set } = require('lodash');
const { addAxiosRoutePreHook } = require('../lib');
const axiosFactory = require('../lib/axiosFactory');

describe('addAxiosRoutePreHook', () => {
    it('assign to axios', () => {
        expect(addAxiosRoutePreHook.assign).toBe('axios');
    });

    it('return an axios client with default headers', () => {
        const traceUUIDHeader = 'trace';
        const traceDepthHeader = 'depth';
        const config = {
            headers: {
                common: {
                    'user-agent': 'test-mctestings'
                }
            }
        };
        const request = {};
        set(request, 'server.plugins.goodTracer.axiosFactory', axiosFactory);
        set(request, 'server.plugins.goodTracer.axiosConfig', {
            traceUUIDHeader,
            traceDepthHeader,
            config
        });
        set(request, 'plugins.goodTracer.trace', '1-2-3-4');
        set(request, 'plugins.goodTracer.depth', 1234);
        const ret = addAxiosRoutePreHook.method(request);
        expect(ret.interceptors.request).toBeDefined();
        expect(ret.interceptors.response).toBeDefined();
        expect(ret.defaults.headers.common).toEqual({
            Accept: 'application/json, text/plain, */*',
            trace: '1-2-3-4',
            depth: 1234,
            'user-agent': 'test-mctestings'
        });
    });
});
