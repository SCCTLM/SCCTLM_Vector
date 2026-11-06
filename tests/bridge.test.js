// Run: node --test tests/
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const sandbox = {};
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../src/app/bridge.js'), 'utf8'), sandbox);

test('literal round-trips quotes, backslashes, newlines and line separators', () => {
  const raw = ['a', String.fromCharCode(0x2028), 'b"c', String.fromCharCode(92), 'd\n', String.fromCharCode(0x2029)].join('');
  const text = sandbox.Bridge.literal(raw);
  assert.ok(text.indexOf(String.fromCharCode(0x2028)) < 0, 'U+2028 must be escaped');
  assert.ok(text.indexOf(String.fromCharCode(0x2029)) < 0, 'U+2029 must be escaped');
  assert.strictEqual(vm.runInNewContext(text), raw);
});
