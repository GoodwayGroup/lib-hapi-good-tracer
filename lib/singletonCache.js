const NodeCache = require('node-cache');

class SingletonCache {
    constructor(config) {
        if (!SingletonCache.instance) {
            SingletonCache.instance = new NodeCache(config);
        }

        this.getInstance = () => SingletonCache.instance;
    }
}

module.exports = SingletonCache;
