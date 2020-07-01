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
    plugin: require('@goodwaygroup/lib-hapi-trace-headers'),
    options: {
        // TODO: add docs for options
    }
});
```

## Configuration Options

> When passing a configuration option, it will overwrite the defaults.

- TODO: add docs for options


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

We use milestones and `npm` version to bump versions. We also employ [git-chglog](https://www.npmjs.com/package/auto-changelog) to manage the [CHANGELOG.md](CHANGELOG.md). For the versions available, see the [tags on this repository](https://github.com/GoodwayGroup/lib-hapi-trace-headers/tags).

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
