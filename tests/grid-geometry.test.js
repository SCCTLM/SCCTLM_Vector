// Run: node --test tests/
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ctx = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(__dirname, '../src/app/jsx/grid-geometry.jsx'), 'utf8'), ctx);
const call = (name, ...args) => JSON.parse(vm.runInContext(
  'JSON.stringify(' + name + '.apply(null, ' + JSON.stringify(args) + '))', ctx));

const corner = (x, y) => ({ a: [x, y], l: [x, y], r: [x, y] });
const square = { closed: true, points: [corner(0, 0), corner(100, 0), corner(100, 100), corner(0, 100)] };
const K = 0.5522847498;
const quarter = (r) => ({ p0: [r, 0], c1: [r, K * r], c2: [K * r, r], p3: [0, r], straight: false });
const sCurve = { p0: [0, 0], c1: [100, 100], c2: [200, -100], p3: [300, 0], straight: false };
const near = (a, b, tol) => assert.ok(Math.abs(a - b) <= tol, `${a} not within ${tol} of ${b}`);

test('square gives four straight segments including the closing one', () => {
  const segs = call('gridSegments', square);
  assert.strictEqual(segs.length, 4);
  assert.ok(segs.every((s) => s.straight));
  assert.deepStrictEqual(segs[3].p0, [0, 100]);
  assert.deepStrictEqual(segs[3].p3, [0, 0]);
});

test('open path has no closing segment and zero-length segments are skipped', () => {
  const open = { closed: false, points: [corner(0, 0), corner(0, 0), corner(50, 0)] };
  const segs = call('gridSegments', open);
  assert.strictEqual(segs.length, 1);
  assert.deepStrictEqual(segs[0].p3, [50, 0]);
});

test('handles lying on the chord still count as straight; bent handles do not', () => {
  const onChord = { closed: false, points: [{ a: [0, 0], l: [0, 0], r: [30, 0] }, { a: [90, 0], l: [60, 0], r: [90, 0] }] };
  assert.strictEqual(call('gridSegments', onChord)[0].straight, true);
  const bent = { closed: false, points: [{ a: [0, 0], l: [0, 0], r: [30, 20] }, corner(90, 0)] };
  assert.strictEqual(call('gridSegments', bent)[0].straight, false);
});

test('quarter circle fits one circle with radius within 1%', () => {
  const circles = call('fitCircles', quarter(100), 1, 6, 10000);
  assert.strictEqual(circles.length, 1);
  near(circles[0].r, 100, 1);
  near(circles[0].cx, 0, 1);
  near(circles[0].cy, 0, 1);
  near(circles[0].arcLength, Math.PI * 50, 0.5);
});

test('S-curve is split at its inflection', () => {
  const t = call('inflections', sCurve);
  assert.strictEqual(t.length, 1);
  near(t[0], 0.5, 1e-9);
  const loose = call('fitCircles', sCurve, 1000, 0, 1e6);
  assert.strictEqual(loose.length, 2);
  near(loose[0].t1, 0.5, 1e-9);
});

test('circle count grows with complexity', () => {
  const size = 300;
  const minimal = call('fitCircles', sCurve, call('complexityToTolerance', 0, size), 6, 1e6).length;
  const complex = call('fitCircles', sCurve, call('complexityToTolerance', 100, size), 6, 1e6).length;
  assert.ok(complex > minimal, `${complex} should exceed ${minimal}`);
});

test('nearly straight curve yields no circle', () => {
  const flat = { p0: [0, 0], c1: [30, 0.001], c2: [60, 0.001], p3: [90, 0], straight: false };
  assert.deepStrictEqual(call('fitCircles', flat, 0.1, 6, 1000), []);
});

test('collinear points have no circle', () => {
  assert.strictEqual(call('circleFrom3', [0, 0], [1, 1], [2, 2]), null);
  const c = call('circleFrom3', [1, 0], [0, 1], [-1, 0]);
  near(c.cx, 0, 1e-9); near(c.cy, 0, 1e-9); near(c.r, 1, 1e-9);
});

test('pickCircles: all, first n, longest n in curve order', () => {
  const circles = [
    { t0: 0, arcLength: 5 }, { t0: 0.25, arcLength: 20 }, { t0: 0.5, arcLength: 1 }, { t0: 0.75, arcLength: 10 }
  ];
  assert.strictEqual(call('pickCircles', circles, 'all', 1).length, 4);
  assert.deepStrictEqual(call('pickCircles', circles, 'first', 2).map((c) => c.t0), [0, 0.25]);
  assert.deepStrictEqual(call('pickCircles', circles, 'longest', 2).map((c) => c.t0), [0.25, 0.75]);
  assert.deepStrictEqual(call('pickCircles', circles, 'first', 0), []);
});

const rect = { left: 0, top: 100, right: 200, bottom: 0 };

test('extendLine clips to every rectangle edge', () => {
  assert.deepStrictEqual(call('extendLine', [10, 50], [20, 50], rect), [[0, 50], [200, 50]]);
  assert.deepStrictEqual(call('extendLine', [30, 10], [30, 20], rect), [[30, 0], [30, 100]]);
  const diag = call('extendLine', [0, 0], [1, 1], rect);
  assert.deepStrictEqual(diag, [[0, 0], [100, 100]]);
});

test('extendLine returns null for a miss or a zero-length input', () => {
  assert.strictEqual(call('extendLine', [0, 150], [10, 150], rect), null);
  assert.strictEqual(call('extendLine', [5, 5], [5, 5], rect), null);
  assert.strictEqual(call('extendLine', [300, 0], [301, -1], rect), null);
});

test("a square's 8 candidate lines in both directions merge to 4, in any input order", () => {
  const segs = call('gridSegments', square);
  const lines = [];
  for (const s of segs) {
    lines.push({ p: s.p0, d: [s.p3[0] - s.p0[0], s.p3[1] - s.p0[1]] });
    lines.push({ p: s.p3, d: [s.p0[0] - s.p3[0], s.p0[1] - s.p3[1]] });
  }
  const tol = call('sensitivityToTolerances', 50, 141);
  const merged = call('mergeLines', lines, tol.angle, tol.offset);
  assert.strictEqual(merged.length, 4);
  const reversed = call('mergeLines', lines.slice().reverse(), tol.angle, tol.offset);
  assert.deepStrictEqual(reversed, merged);
  const horizontal = merged.filter((l) => Math.abs(l.d[1]) < 1e-9).length;
  assert.strictEqual(horizontal, 2);
});

test('sensitivity 0 keeps nearby lines apart; 100 merges them', () => {
  const lines = [{ p: [0, 0], d: [1, 0] }, { p: [0, 1], d: [1, 0] }];
  const low = call('sensitivityToTolerances', 0, 100);
  const high = call('sensitivityToTolerances', 100, 100);
  assert.strictEqual(call('mergeLines', lines, low.angle, low.offset).length, 2);
  assert.strictEqual(call('mergeLines', lines, high.angle, high.offset).length, 1);
});

test('a loop segment that returns to its start still gets circles', () => {
  const loop = { p0: [0, 0], c1: [100, 100], c2: [-100, 100], p3: [0, 0], straight: false };
  assert.ok(call('fitCircles', loop, 1, 6, 1e6).length >= 2);
});

test('a merged cluster is drawn as its average line', () => {
  const lines = [{ p: [0, 0], d: [1, 0] }, { p: [0, 2], d: [1, 0] }];
  const merged = call('mergeLines', lines, 0.01, 5);
  assert.strictEqual(merged.length, 1);
  near(merged[0].p[1], 1, 1e-9);
});

test('lines near angle 0 and near pi merge across the seam', () => {
  const lines = [{ p: [0, 10], d: [1, 0.0001] }, { p: [0, 10], d: [1, -0.0001] }];
  assert.strictEqual(call('mergeLines', lines, 0.01, 0.5).length, 1);
});

test('axisLines: horizontal and vertical tangents give lines, corners do not', () => {
  const circleish = { closed: true, points: [
    { a: [100, 0], l: [100, -55], r: [100, 55] },
    { a: [0, 100], l: [55, 100], r: [-55, 100] },
    corner(-50, -50)
  ] };
  const lines = call('axisLines', [circleish], 0.01);
  assert.strictEqual(lines.length, 2);
  assert.deepStrictEqual(lines[0], { p: [100, 0], d: [0, 1] });
  assert.deepStrictEqual(lines[1], { p: [0, 100], d: [1, 0] });
});
