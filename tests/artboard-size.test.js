// Run: node --test tests/
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ctx = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(__dirname, '../src/app/jsx/artboard-size.jsx'), 'utf8'), ctx);
const call = (name, ...args) => JSON.parse(vm.runInContext(
  'JSON.stringify(' + name + '.apply(null, ' + JSON.stringify(args) + '))', ctx));

const near = (a, b, tol) => assert.ok(Math.abs(a - b) <= tol, `${a} not within ${tol} of ${b}`);

test('unit factors: 72 pt = 1 in = 25.4 mm = 2.54 cm, and 1 px = 1 pt', () => {
  near(call('artboardToPt', 1, 'in'), 72, 1e-9);
  near(call('artboardToPt', 25.4, 'mm'), 72, 1e-9);
  near(call('artboardToPt', 2.54, 'cm'), 72, 1e-9);
  assert.strictEqual(call('artboardToPt', 1, 'pt'), 1);
  assert.strictEqual(call('artboardToPt', 1, 'px'), 1);
  assert.strictEqual(Array.from(vm.runInContext('ARTBOARD_UNITS', ctx)).join(','), 'pt,mm,cm,in,px');
});

test('round trip through every unit stays within 1e-6 points', () => {
  for (const unit of ['pt', 'mm', 'cm', 'in', 'px']) {
    const back = call('artboardFromPt', call('artboardToPt', 595.2755905511812, unit), unit);
    near(back, 595.2755905511812, 1e-6);
  }
});

test('parse accepts numbers, dots and a comma decimal, and trims spaces', () => {
  assert.strictEqual(call('artboardParseSize', 210), 210);
  assert.strictEqual(call('artboardParseSize', '210'), 210);
  assert.strictEqual(call('artboardParseSize', ' 210,5 '), 210.5);
  assert.strictEqual(call('artboardParseSize', 1.5), 1.5);
  assert.strictEqual(call('artboardParseSize', '0,5'), 0.5);
});

test('parse rejects zero, negatives, junk and non-strings', () => {
  for (const bad of ['', '0', '-5', '1.2.3', 'abc', '1e3', 'NaN', '1,2,3', null, {}, []]) {
    assert.strictEqual(call('artboardParseSize', bad), null, 'accepted ' + JSON.stringify(bad));
  }
  // undefined cannot travel through JSON, so it is evaluated inside the vm.
  assert.strictEqual(vm.runInContext('artboardParseSize(undefined)', ctx), null);
});

test('an unknown unit yields null from every unit-taking function', () => {
  assert.strictEqual(call('artboardPtPerUnit', 'furlong'), null);
  assert.strictEqual(call('artboardToPt', 1, 'furlong'), null);
  assert.strictEqual(call('artboardFromPt', 72, 'furlong'), null);
  assert.strictEqual(call('artboardFormatSize', 72, 'furlong'), null);
  assert.strictEqual(call('artboardToPt', 1, 'toString'), null);
});

test('orientation compares the sides, including the square case', () => {
  assert.strictEqual(call('artboardOrientation', 200, 100), 'landscape');
  assert.strictEqual(call('artboardOrientation', 100, 200), 'portrait');
  assert.strictEqual(call('artboardOrientation', 100, 100), 'square');
});

test('resize keeps the top-left corner and does not mutate its input', () => {
  assert.deepStrictEqual(call('artboardResizeRect', [10, 500, 110, 400], 300, 200), [10, 500, 310, 300]);
  // Built inside the vm so the assertion sees the array the function actually received.
  const after = JSON.parse(vm.runInContext(
    'JSON.stringify((function () { var r = [10, 500, 110, 400]; artboardResizeRect(r, 300, 200); return r; }()))', ctx));
  assert.deepStrictEqual(after, [10, 500, 110, 400]);
});

test('swap exchanges the sides, and swapping twice restores the rectangle', () => {
  const rect = [10, 500, 110, 450];
  const swapped = call('artboardSwapRect', rect);
  assert.deepStrictEqual(swapped, [10, 500, 60, 400]);
  assert.deepStrictEqual(call('artboardSwapRect', swapped), rect);
});

test('format shows at most two decimals without trailing zeros', () => {
  assert.strictEqual(call('artboardFormatSize', 595.2755905511812, 'mm'), '210');
  assert.strictEqual(call('artboardFormatSize', 596.6929133858268, 'mm'), '210.5');
  assert.strictEqual(call('artboardFormatSize', 0.75 * 72 / 25.4, 'mm'), '0.75');
  assert.strictEqual(call('artboardFormatSize', 72, 'pt'), '72');
  assert.strictEqual(call('artboardFormatSize', 108, 'in'), '1.5');
});

test('sizes compare within 1e-6 points', () => {
  assert.strictEqual(call('artboardSizesEqual', { width: 100, height: 200 }, { width: 100.0000005, height: 200 }), true);
  assert.strictEqual(call('artboardSizesEqual', { width: 100, height: 200 }, { width: 100.001, height: 200 }), false);
  assert.strictEqual(call('artboardSizesEqual', null, { width: 1, height: 1 }), false);
});

test('rects compare with the host tolerance, default 0.5 pt', () => {
  const want = [0, 842, 595.2755905511812, 0];
  // A 32-bit host returns slightly different coordinates: not a clamp.
  assert.strictEqual(call('artboardRectDiffers', [0, 842, 595.2755737304688, 0], want), false);
  assert.strictEqual(call('artboardRectDiffers', [0.4, 842, 595.2755905511812, -0.4], want), false);
  assert.strictEqual(call('artboardRectDiffers', [0.6, 842, 595.2755905511812, 0], want), true);
  assert.strictEqual(call('artboardRectDiffers', [0, 842, 596, 0], want), true);
  assert.strictEqual(call('artboardRectDiffers', [0, 842, 595.2755905511812, 0], want, 0.01), false);
});
