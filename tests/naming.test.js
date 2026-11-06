// Run: node --test tests/
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ctx = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(__dirname, '../src/app/jsx/naming.jsx'), 'utf8'), ctx);
const run = (code) => vm.runInContext(code, ctx);

test('sanitises illegal characters and reserved names', () => {
  assert.strictEqual(run('sanitizeFileName("a/b:c?d")'), 'a_b_c_d');
  assert.strictEqual(run('sanitizeFileName("CON")'), '_CON');
  assert.strictEqual(run('sanitizeFileName("  x. ")'), 'x');
});

test('duplicate artboard names get the index', () => {
  assert.deepStrictEqual(JSON.parse(run('JSON.stringify(uniqueArtboardNames(["A","B","A","a/b","a:b"]))')),
    ['A_1', 'B', 'A_3', 'a_b_4', 'a_b_5']);
});

test('unsaved/empty document falls back to Untitled', () => {
  assert.strictEqual(run('documentBaseName("")'), 'Untitled');
  assert.strictEqual(run('documentBaseName("Logo.ai")'), 'Logo');
});

test('templateForScales appends the scale only where files would collide', () => {
  assert.strictEqual(run('templateForScales("{doc}_{artboard}", true, 2)'), '{doc}_{artboard}@{scale}x');
  assert.strictEqual(run('templateForScales("", true, 2)'), '');
  assert.strictEqual(run('templateForScales("{doc}_{scale}", true, 2)'), '{doc}_{scale}');
  assert.strictEqual(run('templateForScales("{doc}", true, 1)'), '{doc}');
  assert.strictEqual(run('templateForScales("{doc}", false, 3)'), '{doc}');
});

test('template tokens and truncation', () => {
  assert.strictEqual(
    run('buildFileBaseName("{doc}_{artboard}@{scale}x", {doc:"Logo",artboard:"Icon",index:1,scale:2,format:"png",date:"20261106"})'),
    'Logo_Icon@2x');
  assert.strictEqual(run('buildFileBaseName("{artboard}", {artboard:new Array(300).join("x")}).length'), 120);
});

test('existing files get a numeric suffix, never overwritten', () => {
  assert.strictEqual(
    run('uniqueFileName("a","png",function(n){return n==="a.png"||n==="a_1.png";})'), 'a_2.png');
});

test('disambiguated names never collide with another artboard', () => {
  assert.deepStrictEqual(JSON.parse(run('JSON.stringify(uniqueArtboardNames(["A","A","A_1"]))')),
    ['A_1_1', 'A_2', 'A_1']);
});
