<a name="unreleased"></a>
## [Unreleased]


<a name="0.4.2"></a>
## [0.4.2] - 2020-08-01
### Docs
- correct repo url ([#10](https://github.com/GoodwayGroup/lib-hapi-good-tracer/issues/10))


<a name="v0.4.1"></a>
## [v0.4.1] - 2020-07-24
### Tech Debt
- **cache:** adjusted default settings. Fixed bug with ttl setting. Deprecated orphaned callback in favor of node-cache TTL expiry ([#9](https://github.com/GoodwayGroup/lib-hapi-good-tracer/issues/9))


<a name="v0.4.0"></a>
## [v0.4.0] - 2020-07-23
### Bug Fixes
- **cache:** silence and log cache set errors to avoid nuking a requests ([#8](https://github.com/GoodwayGroup/lib-hapi-good-tracer/issues/8))


<a name="v0.3.0"></a>
## [v0.3.0] - 2020-07-21
### Chore
- updated README with expanded documentation

### Features
- **axios:** Add onPreHandler lifecycle method that provides axios client to request ([#5](https://github.com/GoodwayGroup/lib-hapi-good-tracer/issues/5))

### Pull Requests
- Merge pull request [#4](https://github.com/GoodwayGroup/lib-hapi-good-tracer/issues/4) from GoodwayGroup/release/v0.2.0


###### Squashed Commits:
```
0.2.0
```



<a name="v0.2.0"></a>
## [v0.2.0] - 2020-07-10
### Tech Debt
- **depth:** rename sequence to dpeth and update readme ([#3](https://github.com/GoodwayGroup/lib-hapi-good-tracer/issues/3))


<a name="v0.1.0"></a>
## v0.1.0 - 2020-07-09
### Chore
- bump circleci node version to 12
- **init:** setup bare repo with framework for packaging

### Features
- Initial build of header injection
- **good:** add stream transform for Good ([#1](https://github.com/GoodwayGroup/lib-hapi-good-tracer/issues/1))
- **specs:** added tests and :100: coverage

### Tech Debt
- **coverage:** add coveralls


[Unreleased]: https://github.com/GoodwayGroup/lib-hapi-good-tracer/compare/0.4.2...HEAD
[0.4.2]: https://github.com/GoodwayGroup/lib-hapi-good-tracer/compare/v0.4.1...0.4.2
[v0.4.1]: https://github.com/GoodwayGroup/lib-hapi-good-tracer/compare/v0.4.0...v0.4.1
[v0.4.0]: https://github.com/GoodwayGroup/lib-hapi-good-tracer/compare/v0.3.0...v0.4.0
[v0.3.0]: https://github.com/GoodwayGroup/lib-hapi-good-tracer/compare/v0.2.0...v0.3.0
[v0.2.0]: https://github.com/GoodwayGroup/lib-hapi-good-tracer/compare/v0.1.0...v0.2.0
