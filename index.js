/*
** based on https://github.com/mocha-community/json-file-reporter/blob/master/src/index.js
*/

const _ = require('lodash');
const fs = require('fs')
const path = require('path')
const Mocha = require('mocha')
const debug = require('debug')('mocha-json-reporter');
const md5 = require('md5');
const { isFunction } = require('lodash');
const { textSpanIntersection } = require('typescript');


const {
  EVENT_TEST_PASS,
  EVENT_TEST_FAIL,
  EVENT_TEST_END,
  EVENT_TEST_BEGIN, 
  EVENT_RUN_BEGIN,
  EVENT_RUN_END,
  EVENT_TEST_PENDING,
  EVENT_SUITE_END,
  EVENT_SUITE_BEGIN
} = Mocha.Runner.constants

const DEFAULT_REPORT_PATH = 'report-[hash].json'

let debugO = false, minimal = false, x = {};

function MochaJsonReporter (runner, options) {
  info(options);
  if(options.reporterOptions.enabled === false) return;
  minimal = (options.reporterOptions.minimal === true);
  debugO = (options.reporterOptions.debug === true);

  Mocha.reporters.Base.call(this, runner, options)
  const self = this
  x = {};

  runner.on(EVENT_TEST_END, function (test) {
    pushIfNone(test, x.tests);
    // removeSkipped(test);
  })

  runner.on(EVENT_TEST_PASS, function (test) {
    pushIfNone(test, x.passes);//.push(test)
    // removeSkipped(test);
  })
  
  runner.on(EVENT_TEST_BEGIN, function (test) {
    
  })

  runner.on(EVENT_TEST_FAIL, function (test) {
    //console.warn('\n\n' + JSON.stringify(cleanCycles(test)) + '\n\n');
    let f = test.fullTitle();
    if(f.includes('"before each" hook') || f.includes('"before all" hook')) return;
    pushIfNone(test, x.failures);
    // removeSkipped(test);
  })

  runner.on(EVENT_TEST_PENDING, function (test) {
    // console.warn(`      TEST is PENDING: ${test.fullTitle()}`);

    pushIfNone(test,x.pending);
  })

  runner.on(EVENT_RUN_BEGIN, function() {
    x = {
      tests: [], 
      pending: [],
      skipped: [],
      _all: [],
      failures: [],
      passes:[], 
    };
  })

  runner.on(EVENT_SUITE_BEGIN, function (suite) {
    suite.tests.forEach(test=>{
        let z = clean(test);
        // console.warn('TEST: ' + JSON.stringify(cleanCycles(test)) + '\n\n');

        // console.warn(`      TEST is NOT YET executed: ${fnOrVal(z.fullTitle, z)}, testConfig: ${JSON.stringify(z.testConfig)}`);


        pushIfNone(z, x._all);
    });
  })

  runner.on(EVENT_RUN_END, function () {
    const obj = {
      stats: self.stats,
      pending: x.pending.map(clean),
      failures: x.failures.map(clean),
      passes: x.passes.map(clean)
    }
    obj.skipped = _.uniqBy(x._all.filter(test => isExecuted(test,obj) === false).map(e=>{console.warn(`    TEST  IS SKIPPED ${e.fullTitle}`); return e;}), e=>fnOrVal(e.fullTitle,e)),
    obj.tests = _.union(obj.passes, obj.failures, obj.pending, obj.skipped);
    obj.stats.tests = obj.tests.length;
    obj.stats.failures = obj.failures.length;
    obj.stats.pending = obj.pending.length;
    obj.stats.skipped = obj.skipped.length;

    runner.testResults = obj;

    if(obj.pending.length === 0 && obj.passes.length === 0 && obj.failures.length === 0 && obj.skipped.length === 0) { return; }

    const json = JSON.stringify(obj, null, minimal ? 0 : 2)
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

  runner.once(EVENT_SUITE_END, function (suite) {
    suite.tests.forEach(test=>{
      let z = clean(test);
      // console.warn(`      TEST is executed: ${z.fullTitle}`);
   });

  })
}

function fnOrVal(x, y = null) {
  if(x === null) return null;

  return isFunction(x) ? x.call(y) : x;
}

function pushIfNone(t, arr) {
  let test = clean(t), w = false;
  for(let i = 0; i < arr.length; i++) {
     if(arr[i] && fnOrVal(arr[i].fullTitle, arr[i]) === fnOrVal(test.fullTitle, test)) { w = true; break; }
  }

  if(w === false) {
    arr.push(test);
  }
}

function isExecuted(test, o) {
  let z = test.fullTitle, y = '', w = false;

  for(let i = 0; i < o.passes.length; i++) {
    let q = o.passes[i];

    if(fnOrVal(q.fullTitle, q) === z) { w = true; y = z; break; }
  }

  if(w !== true) {
    for(let i = 0; i < o.failures.length; i++) {
      let q = o.failures[i];

      if(fnOrVal(q.fullTitle, q) === z) { w = true; y = z; break; }
    }
  }

  if(w !== true) {
    for(let i = 0; i < o.pending.length; i++) {
      let q = o.pending[i];

      if(fnOrVal(q.fullTitle, q) === z) { w = true; y = z; break; }
    }
  }

  // console.warn('    Test ' + z + ' ' + 'and test ' + y + ' is executed? = ' + w);

  return w;
}

function warn(x) {
  if(debugO === true) {
    if(x.type==='test') {
      let y = {
        name: x.title,
        state: x.state
      }
      console.warn(cleanCycles(y)); 
    }
  }
}

function info(x) {
  if(debugO === true) {
    if(x.type==='test') {
      let y = {
        name: x.title,
        state: x.state
      }
      console.info(cleanCycles(y)); 
    }
  }
}

let _file = '', _line = 0, _configs={};

function readTestConfig(info) {
  // console.warn('PARSE: ' + JSON.stringify(info) + '\n\n');

  let x = {}, fn = info.full;

  if(_configs[fn] && _configs[fn] !== {}) return _configs[fn];

  if(info.file !== '') {
    _file = info.file; 
    _line = info.line;

    let line = _line;
    let ctx = fs.readFileSync(_file).toString().split('\n');
    for(let i = _line; i < ctx.length; i++) { 
      if(ctx[i].includes(info.test)) { line = i; break; }
    }

    let z = ctx.slice(Math.max(line-1, 0));
    let y = 0;
    for(let i = 0; i < z.length; i++) {
      if(z[i].includes('}')) {
        y = i;
        break;
      }
    }
    let w = ''.concat(z.slice(0,y+1));
    let p0 = w.indexOf(info.test) + info.test.length;
    w = w.substring(p0);
    p0 = w.indexOf(',');
    if(p0 !== -1 && p0 < w.indexOf('{')) w = w.substring(p0); else w = ``;
    let p1 = w.lastIndexOf(',');
    
    if(p0 !== p1) {
      w = w.substring(p0 + 1, p1 - p0 + 1).replaceAll(/\{\s*/g, '{"').replaceAll(/\:\s*/g, '":').replaceAll(/\s*\'\s*/g, '"').replaceAll(/\"\s*/g, '"').replaceAll(/\s*\"/g, '"');
      // console.warn('READ: \n' + w);

      let e = {};
      try {
        e = JSON.parse(w)?.env;
      } catch(e)
      {

      }
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
    }    

    _configs[fn] = x;
  }

  // console.warn('CONFIGS: ' + JSON.stringify(_configs) + '\n\n');

  return x;
}

function testConfigList(test) {
  let x = readTestConfig({ file:  test.file ?? '', line: test.line ?? 0, full: fnOrVal(test.fullTitle, test), test: test.title }), y = {};
  //if(z.file !== '' && /*z.suite !== '' &&*/ z.test !== '') console.log('\n\n'+z.file + '  =>  ' +  z.suite + ' => ' +  z.test +'\n\n');
  // console.warn(JSON.stringify(x));

  let overrides = test._testConfig && test._testConfig.testConfigList ? test._testConfig.testConfigList.map(e=>e.overrides) : [];
  // console.log('\n\n'+JSON.stringify(cleanCycles(overrides))+'\n\n');
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
    fullTitle: fnOrVal(test.fullTitle, test),
    // fullTitle: ()=>test.fullTitle(),
    fileName: test.invocationDetails?.relativeFile?? '',
    file: test.invocationDetails?.absoluteFile ?? test.parent?.invocationDetails?.absoluteFile ?? '',
    line: test.invocationDetails?.line ?? test.parent?.invocationDetails?.line ?? 0,
    state: test.state,
    duration: test.duration,
    currentRetry: fnOrVal(test.currentRetry, test),
    // currentRetry: ()=>test.currentRetry(),
    err: cleanCycles(err),
    testConfig: testConfigList(test),
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
