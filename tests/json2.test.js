const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Run without native JSON so the polyfill is exercised.
const ctx = vm.createContext({ SyntaxError });
vm.runInContext(fs.readFileSync(path.join(__dirname, '../src/jsx/json2.jsx'), 'utf8'), ctx);
const run = (code) => vm.runInContext(code, ctx);

test('stringify and parse round-trip a job', () => {
  const out = run('JSON.stringify(JSON.parse(\'{"a":[1,"x\\\\"y"],"b":true,"c":null}\'))');
  assert.strictEqual(out, '{"a":[1,"x\\"y"],"b":true,"c":null}');
});

test('parse rejects non-JSON input', () => {
  assert.throws(() => run('JSON.parse("(function(){})()")'));
});
