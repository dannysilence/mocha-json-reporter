/*
** based on https://github.com/mocha-community/json-file-reporter/blob/master/src/index.js
*/

const fs = require('fs')
const path = require('path')
const Mocha = require('mocha')
const debug = require('debug')('mocha-json-reporter');
const md5 = require('md5');

const {
  EVENT_TEST_PASS,
  EVENT_TEST_FAIL,
  EVENT_TEST_END,
  EVENT_RUN_END,
  EVENT_TEST_PENDING
} = Mocha.Runner.constants

const DEFAULT_REPORT_PATH = 'report-[hash].json'

function Reporter (runner, options) {
  Mocha.reporters.Base.call(this, runner, options)
  const self = this

  const tests = []
  const pending = []
  const failures = []
  const passes = []

  runner.on(EVENT_TEST_END, function (test) {
    tests.push(test)
  })

  runner.on(EVENT_TEST_PASS, function (test) {
    passes.push(test)
  })

  runner.on(EVENT_TEST_FAIL, function (test) {
    failures.push(test)
  })

  runner.on(EVENT_TEST_PENDING, function (test) {
    pending.push(test)
  })

  runner.once(EVENT_RUN_END, function () {
    const obj = {
      stats: self.stats,
      tests: tests.map(clean),
      pending: pending.map(clean),
      failures: failures.map(clean),
      passes: passes.map(clean)
    }
    runner.testResults = obj
    const json = JSON.stringify(obj, null, 2)
    let fn = DEFAULT_REPORT_PATH
    const { reporterOptions } = options
    if (reporterOptions) {
      const { output } = reporterOptions
      if (output) {
        fn = output
      }
    }
    
    writeJson(json, fn);
  })
}

function clean (test) {
  var err = test.err || {}
  if (err instanceof Error) {
    err = errorJSON(err)
  }

  return {
    title: test.title,
    fullTitle: test.fullTitle(),
    duration: test.duration,
    currentRetry: test.currentRetry(),
    err: cleanCycles(err)
  }
}

function cleanCycles (obj) {
  const cache = []
  return JSON.parse(
    JSON.stringify(obj, function (key, value) {
      if (typeof value === 'object' && value !== null) {
        if (cache.indexOf(value) !== -1) {
          return '' + value
        }
        cache.push(value)
      }
      return value
    })
  )
}

/**
 * Writes a JUnit test report XML document.
 * @param {string} xml - xml string
 * @param {string} filePath - path to output file
 */
function writeJson(json, filePath){
  if (filePath) {
    if (filePath.indexOf('[hash]') !== -1) {
      filePath = filePath.replace('[hash]', md5(json));
    }

    debug('writing file to', filePath);
    fs.mkdirSync(path.dirname(filePath),{recursive :true});

    try {
        fs.writeFileSync(filePath, json, 'utf-8');
    } catch (exc) {
        debug('problem writing results: ' + exc);
    }
    debug('results written successfully');
  }
};

function errorJSON (err) {
  const res = {}
  Object.getOwnPropertyNames(err).forEach(function (key) {
    res[key] = err[key]
  }, err)
  return res
}

module.exports = Reporter
