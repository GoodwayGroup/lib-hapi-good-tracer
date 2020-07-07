# lib-hapi-trace-headers

[![CircleCI](https://circleci.com/gh/GoodwayGroup/lib-hapi-trace-headers.svg?style=svg)](https://circleci.com/gh/GoodwayGroup/lib-hapi-trace-headers)

> Please do not run this plugin within tests in your application

## Usage

This plugin will send metrics regarding route performance on every request to the Hapi server.

For the `prefix`, please the name of the service that you are integrating with (neato-service, cool-api, etc)

```
$ npm install -S @goodwaygroup/lib-hapi-trace-headers
```

In your `index.js` for the Hapi server, register the plugin:

```js
await server.register({
    plugin: require('@goodwaygroup/lib-hapi-good-tracer'),
    options: {
        traceUUIDHeader: 'x-custom-trace-uuid', // optional defaults to 'x-gg-trace-uuid'
        traceSeqIDHeader: 'x-custom-trace-seqid', // optional defaults to 'x-gg-trace-seqid'
        cache: {
            ttl: 10 // 10 seconds
        }
    }
});

// add stream to Good log reporters
const logReporters = {
    console: [
        server.plugins.goodTracer.GoodSourceTracer, // Stream Transform that will inject the tracer object
        {
            module: 'good-squeeze',
            name: 'Squeeze',
            args: [{
                response: { exclude: 'healthcheck' },
                log: '*',
                request: '*',
                error: '*',
                ops: '*'
            }]
        }, {
            module: 'good-squeeze',
            name: 'SafeJson'
        }, 'stdout']
};

await server.register({
    plugin: Good,
    options: {
        reporters: logReporters
    }
});
```

## Configuration Options

> When passing a configuration option, it will overwrite the defaults.

- `traceUUIDHeader`: defaults to 'x-gg-trace-uuid'. The header that is used for the Trace ID
- `traceSeqIDHeader`: defaults to 'x-gg-trace-seqid' The header that is used for the Sequence ID
- `cache`: internal memory cache settings. See [node-cache](https://github.com/node-cache/node-cache)
    - `ttl`: default 120 seconds
    - `checkPeriod`: default 5 minutes
    - `maxKeys`: default `5000`
    - `useClones`: default `false`
    - `extendTTLOnGet`: This feature will reset the TTL to the global TTL when a successful `get` occurs. This will extend the life of an item in the cache as a result. default `true`

## Running Tests

To run tests, just run the following:

```
npm test
```

All commits are tested on [CircleCI](https://circleci.com/gh/GoodwayGroup/workflows/lib-hapi-trace-headers)

## Linting

To run `eslint`:

```
npm run lint
```

To auto-resolve:

```
npm run lint:fix
```

## Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details on our code of conduct, and the process for submitting pull requests to us.

## Versioning

We use milestones and `npm` version to bump versions. We also employ [git-chglog](https://github.com/git-chglog/git-chglog) to manage the [CHANGELOG.md](CHANGELOG.md). For the versions available, see the [tags on this repository](https://github.com/GoodwayGroup/lib-hapi-trace-headers/tags).

To initiate a version change:

```
npm version minor
```

## Authors

* **Derek Smith** - *Initial work* - [@clok](https://github.com/clok)

See also the list of [contributors](https://github.com/GoodwayGroup/lib-hapi-trace-headers/contributors) who participated in this project.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details

## Acknowledgments

## Sponsors

[![goodwaygroup][goodwaygroup]](https://goodwaygroup.com)

[goodwaygroup]: https://s3.amazonaws.com/gw-crs-assets/goodwaygroup/logos/ggLogo_sm.png "Goodway Group"
