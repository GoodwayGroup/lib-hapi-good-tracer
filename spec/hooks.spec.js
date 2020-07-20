const { set } = require('lodash');
const { addAxiosRoutePreHook, addAxiosRoutePreHookFactory } = require('../lib');
const { factory } = require('../lib/axios');

describe('addAxiosRoutePreHook', () => {
    it('should assign to axios', () => {
        expect(addAxiosRoutePreHook.assign).toBe('axios');
        expect(addAxiosRoutePreHook.method).toBeDefined();
        expect(addAxiosRoutePreHook.method).toBeInstanceOf(Function);
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
        set(request, 'server.plugins.goodTracer.axiosFactory', factory);
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

describe('addAxiosRoutePreHookFactory', () => {
    it('should assign to axios by default', () => {
        const result = addAxiosRoutePreHookFactory();
        expect(result.assign).toBe('axios');
        expect(result.method).toBeDefined();
        expect(result.method).toBeInstanceOf(Function);
    });

    it('should assign to the passed in string', () => {
        const result = addAxiosRoutePreHookFactory('yolo');
        expect(result.assign).toBe('yolo');
        expect(result.method).toBeDefined();
        expect(result.method).toBeInstanceOf(Function);
    });
});
