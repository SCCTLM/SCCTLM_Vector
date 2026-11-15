const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Run without native JSON so the polyfill is exercised.
const ctx = vm.createContext({ SyntaxError });
vm.runInContext(fs.readFileSync(path.join(__dirname, '../src/app/jsx/json2.jsx'), 'utf8'), ctx);
const run = (code) => vm.runInContext(code, ctx);

test('stringify and parse round-trip a job', () => {
  const out = run('JSON.stringify(JSON.parse(\'{"a":[1,"x\\\\"y"],"b":true,"c":null}\'))');
  assert.strictEqual(out, '{"a":[1,"x\\"y"],"b":true,"c":null}');
});

test('parse rejects non-JSON input', () => {
  assert.throws(() => run('JSON.parse("(function(){})()")'));
});

test('re-evaluating the file replaces both functions so edits take effect', () => {
  const src = fs.readFileSync(path.join(__dirname, '../src/app/jsx/json2.jsx'), 'utf8');
  const ctx = vm.createContext({ SyntaxError });
  vm.runInContext(src, ctx);
  assert.strictEqual(vm.runInContext('JSON.stringify({a:1})', ctx), '{"a":1}');
  const edited = src.replace('var s = String(text);', 'var s = String(text); throw new SyntaxError("edited");');
  assert.notStrictEqual(edited, src, 'fixture line must exist in json2.jsx');
  vm.runInContext(edited, ctx);
  assert.throws(() => vm.runInContext('JSON.parse("{}")', ctx), /edited/);
});
