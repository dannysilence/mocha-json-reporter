/*
** based on https://github.com/mocha-community/json-file-reporter/blob/master/src/index.js
*/

const _ = require('lodash');
const fs = require('fs')
const path = require('path')
const Mocha = require('mocha')
const debug = require('debug')('mocha-json-reporter');
const md5 = require('md5');

const {
  EVENT_TEST_PASS,
  EVENT_TEST_FAIL,
  EVENT_TEST_END,
  EVENT_TEST_BEGIN, 
  EVENT_RUN_END,
  EVENT_TEST_PENDING,
  EVENT_SUITE_END,
  EVENT_SUITE_BEGIN
} = Mocha.Runner.constants

const DEFAULT_REPORT_PATH = 'report-[hash].json'

function MochaJsonReporter (runner, options) {
  console.log(JSON.stringify(options));
  if(options.reporterOptions.enabled === false) return;

  Mocha.reporters.Base.call(this, runner, options)
  const self = this
  const x = {};

  runner.on(EVENT_TEST_END, function (test) {
    const key = suiteTitle(test.suite);
    //x[key].tests.push(test);
    for(let i = 0;i<x[key].tests.length;i++){
      const item = x[key].tests[i];
      if(item.fullTitle() === test.fullTitle()) {
        x[key].tests[i] = test;
        break;
      } 
    } 
  })

  runner.on(EVENT_TEST_PASS, function (test) {
    const key = suiteTitle(test.suite);
    x[key].passes.push(test)
  })
  
  //runner.on(EVENT_TEST_BEGIN, function (test) {
  //  const key = suiteTitle(test.suite);
  //  x[key].passes.push(test)
  //})

  runner.on(EVENT_TEST_FAIL, function (test) {
    const key = suiteTitle(test.suite);
    x[key].failures.push(test)
  })

  runner.on(EVENT_TEST_PENDING, function (test) {
    const key = suiteTitle(test.suite);
    x[key].pending.push(test)
  })

  runner.on(EVENT_SUITE_BEGIN, function (suite) {
    const key = suiteTitle(suite);

    x[key] = {
      tests: [], 
      pending: [],
      failures: [],
      passes:[], 
    };
    
    suite.tests.forEach(test=>{
      x[key].tests.push({
        title: test.title,
        fullTitle: () => test.fullTitle() ,
        state:'skipped',
        fileName: test.invocationDetails?.relativeFile?? '',
        testConfig: testConfigList(test), 
        duration: test.duration,
        currentRetry: () => test.currentRetry(),
        err: cleanCycles(err),
      });
    }) 
  })

  runner.on(EVENT_SUITE_END, function (suite) {
    const key = suiteTitle(suite);
    
    const obj = {
      stats: self.stats,
      tests: x[key].tests.map(clean),
      pending: x[key].pending.map(clean),
      failures: x[key].failures.map(clean),
      passes: x[key].passes.map(clean)
    }

    runner.testResults = obj;

    if(obj.pending.length === 0 && obj.passes.length === 0 && obj.failures.length === 0) {
      //TODO
      return;
    }

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

  runner.once(EVENT_RUN_END, function () {
  })
}

function suiteTitle(suite) {
  let s = suite;
  let k = '';  
  
  while(s && s.root===false) {
    k = ''.concat(s.title, k);
    s = s.parent;
  }
  
  return k === '' ? 'root' : k.trim();
}

function testConfigList(test) {
  let x = {}, y = {};
  //console.log(JSON.stringify(test._testConfig.testConfigList));
  let overrides = test._testConfig && test._testConfig.testConfigList ? test._testConfig.testConfigList.map(e=>e.overrides) : [];
  overrides.forEach(override => {
    if(override && override.env) {
      let e = override.env;
      for (const key in e) {
        if (Object.hasOwnProperty.call(e, key)) {
          const element = e[key];
          if (Object.hasOwnProperty.call(x, key)) {
            let arr = x[key];
            let val = Array.isArray(element) ? [...element] : [element];
            val.forEach(v=>{
              arr.push(v);
            })
          } else {
            x[key] = Array.isArray(element) ? [...element] : [element];
          }
        }
      }
      // console.log(JSON.stringify(override));
    }
  });

  for (const key in x) {
    if (Object.hasOwnProperty.call(x, key)) {
      const element = x[key];
      y[key] = _.uniq(element);
    }
  }

  return y;
}

function clean (test) {
  var err = test.err || {}
  if (err instanceof Error) {
    err = errorJSON(err)
  }

  return {
    title: test.title,
    fullTitle: test.fullTitle(),
    fileName: test.invocationDetails.relativeFile,
    state: test.state,
    duration: test.duration,
    currentRetry: test.currentRetry(),
    err: cleanCycles(err),
    testConfig: testConfigList(test)
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

module.exports = MochaJsonReporter;
