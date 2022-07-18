# mocha-json-reporter

[![Node.js Package](https://github.com/dannysilence/mocha-json-reporter/actions/workflows/npm-publish-github-packages.yml/badge.svg?branch=main&event=registry_package)](https://github.com/dannysilence/mocha-json-reporter/actions/workflows/npm-publish-github-packages.yml)

## Overview

Mainly same as default mocha json reporter, but also contains hashing function to _randomize_ output file names so running multiple mocha processes sequentially won't overwrite the output.

## Install via NPM

```shell
npm i @dannysilence/mocha-json-reporter
```

## Example

There is an example of using this reporter together with `cypress` and `cypress-multi-reporters` available [here](https://github.com/dannysilence/cypress-components-tests).

For mocha specifically, in short, say if you have spec as follows
```js
describe('Components class', function() {
    context(' for simple <H1> element', function() {
        it(' should be located by tag', function() {
            expect(1).to.eq(1);
        })        
    });
});
```
and let's say you define the following config
```json
{
    "ReporterOptions": {
        "enabled": true,
        "output": "cypress/results/[hash].json"
    }
}
```
then `@dannysilence/mocha-json-reporter` produces the result for each spec container separately as follows:
```json
{
  "stats": {
    "suites": 2,
    "tests": 1,
    "passes": 1,
    "pending": 0,
    "failures": 0,
    "start": "2022-07-18T05:51:24.586Z"
  },
  "tests": [
    {
      "title": " should be located by tag",
      "fullTitle": "Components class  for simple <H1> element  should be located by tag",
      "duration": 123,
      "currentRetry": 0,
      "err": {},
      "testConfig": {}
    }
  ],
  "pending": [],
  "failures": [],
  "passes": [
    {
      "title": " should be located by tag",
      "fullTitle": "Components class  for simple <H1> element  should be located by tag",
      "duration": 123,
      "currentRetry": 0,
      "err": {},
      "testConfig": {}
    }
  ]
}
````

## Links
- [Package](https://www.npmjs.com/package/@dannysilence/mocha-json-reporter) at npmjs.org 
- [Package](https://github.com/dannysilence?tab=packages&repo_name=mocha-json-reporter) at github.com