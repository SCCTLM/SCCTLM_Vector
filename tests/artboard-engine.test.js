// Run: node --test tests/
// The artboard engine runs inside Illustrator; these tests load engine.jsx with its #include lines
// stripped and stand-ins for the document and artboards, so validation, rollback and read-back are
// pinned without the host.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const JSX = path.join(__dirname, '../src/app/jsx');

function makeArtboard(name, rect, sink) {
  const ab = { name, rect: rect.slice(), setterCalls: 0, failNext: false, onSet: null, log: [] };
  Object.defineProperty(ab, 'artboardRect', {
    get() { return ab.rect.slice(); },
    set(value) {
      ab.setterCalls++;
      ab.log.push(value.slice());
      if (sink) sink.push({ name: ab.name, rect: value.slice() });
      if (ab.failNext) { ab.failNext = false; throw new Error('artboard is locked'); }
      ab.rect = (ab.onSet ? ab.onSet(value.slice()) : value).slice();
    }
  });
  return ab;
}

function load(artboards) {
  const doc = { name: 'test.ai', artboards: artboards || [] };
  const ctx = {
    app: { documents: { length: 1 }, activeDocument: doc }
  };
  vm.createContext(ctx);
  for (const f of ['json2.jsx', 'naming.jsx', 'artboard-size.jsx']) {
    vm.runInContext(fs.readFileSync(path.join(JSX, f), 'utf8'), ctx);
  }
  // ExtendScript concatenates the #include targets; strip the directives so node can load the entry.
  const engine = fs.readFileSync(path.join(JSX, 'engine.jsx'), 'utf8').replace(/^#include .*$/gm, '');
  vm.runInContext(engine, ctx);
  const run = (code) => JSON.parse(vm.runInContext(code, ctx));
  return { ctx, doc, run };
}

const job = (extra) => JSON.stringify(JSON.stringify(extra));
const rectOf = (ab) => Array.from(ab.rect);

test('resize changes every target, keeps the top-left corner and returns the new sizes', () => {
  const a = makeArtboard('One', [0, 842, 595, 0]);
  const b = makeArtboard('Two', [1000, 500, 1400, 200]);
  const { doc, run } = load([a, b]);
  const res = run('engineResizeArtboards(' + job({ artboards: 'all', widthPt: 300, heightPt: 200 }) + ')');
  assert.strictEqual(res.ok, true, res.error);
  assert.deepStrictEqual(rectOf(a), [0, 842, 300, 642]);
  assert.deepStrictEqual(rectOf(b), [1000, 500, 1300, 300]);
  assert.deepStrictEqual(res.artboards, [
    { index: 0, widthPt: 300, heightPt: 200 },
    { index: 1, widthPt: 300, heightPt: 200 }
  ]);
});

test('an explicit index list resizes only those artboards and ignores out-of-range indexes', () => {
  const a = makeArtboard('One', [0, 100, 100, 0]);
  const b = makeArtboard('Two', [200, 300, 300, 0]);
  const { run } = load([a, b]);
  const res = run('engineResizeArtboards(' + job({ artboards: [1, 9, -2, 1.5], widthPt: 50, heightPt: 60 }) + ')');
  assert.strictEqual(res.ok, true, res.error);
  assert.deepStrictEqual(rectOf(a), [0, 100, 100, 0]);
  assert.deepStrictEqual(rectOf(b), [200, 300, 250, 240]);
  assert.deepStrictEqual(res.artboards.map((x) => x.index), [1]);
});

test('missing, zero and negative sizes fail before the first write', () => {
  for (const bad of [{ widthPt: 0, heightPt: 10 }, { heightPt: 10 }, { widthPt: 10, heightPt: -5 }, { widthPt: '10', heightPt: 10 }]) {
    const a = makeArtboard('One', [0, 100, 100, 0]);
    const { run } = load([a]);
    const res = run('engineResizeArtboards(' + job(Object.assign({ artboards: [0] }, bad)) + ')');
    assert.strictEqual(res.ok, false, 'accepted ' + JSON.stringify(bad));
    assert.match(res.error, /l\u1edbn h\u01a1n 0/);
    assert.strictEqual(a.setterCalls, 0);
    assert.deepStrictEqual(rectOf(a), [0, 100, 100, 0]);
  }
});

test('an empty selection fails without writing anything', () => {
  const a = makeArtboard('One', [0, 100, 100, 0]);
  const { run } = load([a]);
  const res = run('engineResizeArtboards(' + job({ artboards: [], widthPt: 10, heightPt: 10 }) + ')');
  assert.strictEqual(res.ok, false);
  assert.match(res.error, /artboard/);
  assert.strictEqual(a.setterCalls, 0);
});

test('swap flips each artboard on its own and keeps the top-left corner', () => {
  const a = makeArtboard('Wide', [0, 500, 100, 450]);
  const b = makeArtboard('Tall', [200, 900, 400, 600]);
  const { run } = load([a, b]);
  const res = run('engineResizeArtboards(' + job({ artboards: 'all', swap: true }) + ')');
  assert.strictEqual(res.ok, true, res.error);
  assert.deepStrictEqual(rectOf(a), [0, 500, 50, 400]);
  assert.deepStrictEqual(rectOf(b), [200, 900, 500, 700]);
  assert.deepStrictEqual(res.artboards, [
    { index: 0, widthPt: 50, heightPt: 100 },
    { index: 1, widthPt: 300, heightPt: 200 }
  ]);
});

test('a host failure restores the artboards already written, in reverse order', () => {
  const order = [];
  const a = makeArtboard('One', [0, 100, 100, 0], order);
  const b = makeArtboard('Two', [200, 300, 300, 0], order);
  const c = makeArtboard('Three', [400, 500, 500, 0], order);
  c.failNext = true;
  const { run } = load([a, b, c]);
  const res = run('engineResizeArtboards(' + job({ artboards: 'all', widthPt: 10, heightPt: 20 }) + ')');
  assert.strictEqual(res.ok, false);
  assert.match(res.error, /artboard/);
  assert.deepStrictEqual(rectOf(a), [0, 100, 100, 0], 'first artboard rolled back');
  assert.deepStrictEqual(rectOf(b), [200, 300, 300, 0], 'second artboard rolled back');
  assert.deepStrictEqual(rectOf(c), [400, 500, 500, 0]);
  assert.deepStrictEqual(a.log.map((r) => r.join(',')), ['0,100,10,80', '0,100,100,0']);
  assert.deepStrictEqual(b.log.map((r) => r.join(',')), ['200,300,210,280', '200,300,300,0']);
  assert.deepStrictEqual(c.log.map((r) => r.join(',')), ['400,500,410,480'], 'only the failed write');
  // Shared order: the two restores happen newest first.
  assert.deepStrictEqual(order.map((e) => e.name), ['One', 'Two', 'Three', 'Two', 'One']);
});

test('a host that clamps the size is rolled back and reported', () => {
  const a = makeArtboard('One', [0, 100, 100, 0]);
  const b = makeArtboard('Two', [200, 300, 300, 0]);
  // A host clamp: asking for more than 400 pt wide silently yields 30 x 30.
  b.onSet = (rect) => (rect[2] - rect[0] > 400 ? [200, 300, 230, 270] : rect);
  const { run } = load([a, b]);
  const res = run('engineResizeArtboards(' + job({ artboards: [0, 1], widthPt: 500, heightPt: 600 }) + ')');
  assert.strictEqual(res.ok, false);
  assert.match(res.error, /artboard 2/);
  assert.match(res.error, /c\u00f2n 30 x 30 pt/);
  assert.deepStrictEqual(rectOf(a), [0, 100, 100, 0]);
  assert.deepStrictEqual(rectOf(b), [200, 300, 300, 0]);
});

test('a stale artboard count is rejected before any write', () => {
  const a = makeArtboard('One', [0, 100, 100, 0]);
  const { run } = load([a]);
  const res = run('engineResizeArtboards(' + job({ artboards: 'all', count: 3, swap: true }) + ')');
  assert.strictEqual(res.ok, false);
  assert.match(res.error, /thay \u0111\u1ed5i/);
  assert.strictEqual(a.setterCalls, 0);
});

test('a renamed artboard is refused before any write', () => {
  const a = makeArtboard('One', [0, 100, 100, 0]);
  const b = makeArtboard('Two', [200, 300, 300, 0]);
  b.name = 'Renamed';
  const { run } = load([a, b]);
  const res = run('engineResizeArtboards(' + job({
    artboards: [0, 1], count: 2,
    targets: [{ index: 0, name: 'One' }, { index: 1, name: 'Two' }],
    widthPt: 10, heightPt: 20
  }) + ')');
  assert.strictEqual(res.ok, false);
  assert.match(res.error, /h\u00e3y ch\u1ecdn l\u1ea1i artboard/);
  assert.strictEqual(a.setterCalls, 0);
  assert.strictEqual(b.setterCalls, 0);
});

test('a different document is refused before any write', () => {
  const a = makeArtboard('One', [0, 100, 100, 0]);
  const { run, doc } = load([a]);
  doc.fullName = { fsName: 'C:/work/B.ai' };
  const res = run('engineResizeArtboards(' + job({
    artboards: [0], count: 1, docPath: 'C:/work/A.ai', docName: 'A', widthPt: 10, heightPt: 20
  }) + ')');
  assert.strictEqual(res.ok, false);
  assert.match(res.error, /thay \u0111\u1ed5i/);
  assert.strictEqual(a.setterCalls, 0);
});

test('a sub-point difference from the host is not a clamp', () => {
  const a = makeArtboard('One', [0, 842, 595.2755905511812, 0]);
  // A host storing 32-bit coordinates returns 595.2755737304688 for the requested width.
  a.onSet = (rect) => [rect[0], rect[1], rect[0] + 595.2755737304688, rect[1] - 841.8897705078125];
  const { run } = load([a]);
  const res = run('engineResizeArtboards(' + job({
    artboards: [0], widthPt: 595.2755905511812, heightPt: 841.8897637795275
  }) + ')');
  assert.strictEqual(res.ok, true, res.error);
  assert.strictEqual(a.rect[2] - a.rect[0], 595.2755737304688);
});

test('a shifted origin from the host is rolled back', () => {
  const a = makeArtboard('One', [0, 100, 100, 0]);
  let writes = 0;
  // The host applies the requested size at a shifted origin, but only for the first write.
  a.onSet = (rect) => (++writes === 1 ? [rect[0] + 5, rect[1], rect[2] + 5, rect[3]] : rect);
  const { run } = load([a]);
  const res = run('engineResizeArtboards(' + job({ artboards: [0], widthPt: 10, heightPt: 20 }) + ')');
  assert.strictEqual(res.ok, false);
  assert.deepStrictEqual(rectOf(a), [0, 100, 100, 0]);
});

test('a clamp during swap is detected and rolled back', () => {
  const a = makeArtboard('Tall', [0, 6000, 150, 0]);
  // The host refuses widths above 2000 pt.
  a.onSet = (rect) => (rect[2] - rect[0] > 2000 ? [rect[0], rect[1], rect[0] + 2000, rect[1] - 150] : rect);
  const { run } = load([a]);
  const res = run('engineResizeArtboards(' + job({ artboards: [0], swap: true }) + ')');
  assert.strictEqual(res.ok, false);
  assert.match(res.error, /artboard 1/);
  assert.deepStrictEqual(rectOf(a), [0, 6000, 150, 0]);
});

test('restore failures are reported, not swallowed', () => {
  const a = makeArtboard('One', [0, 100, 100, 0]);
  const b = makeArtboard('Two', [200, 300, 300, 0]);
  // First write succeeds, the second throws, and restoring the first also throws.
  let phase = 0;
  const setA = a.onSet;
  a.onSet = (rect) => { phase += 1; if (phase > 1) throw new Error('locked now'); return setA ? setA(rect) : rect; };
  b.failNext = true;
  const { run } = load([a, b]);
  const res = run('engineResizeArtboards(' + job({ artboards: [0, 1], widthPt: 10, heightPt: 20 }) + ')');
  assert.strictEqual(res.ok, false);
  assert.match(res.error, /kh\u00f4ng kh\u00f4i ph\u1ee5c/);
});

test('listArtboards returns names in order with the sizes from the rectangles and reports colorSpace', () => {
  const a = makeArtboard('One', [0, 842, 595, 0]);
  const b = makeArtboard('Two', [700, 400, 900, 150]);
  const { doc, ctx, run } = load([a, b]);
  ctx.DocumentColorSpace = { CMYK: 'CMYK', RGB: 'RGB' };
  doc.documentColorSpace = 'CMYK';
  const res = run('listArtboards()');
  assert.strictEqual(res.ok, true, res.error);
  assert.strictEqual(res.colorSpace, 'CMYK');
  assert.deepStrictEqual(res.artboards, [
    { index: 0, name: 'One', widthPt: 595, heightPt: 842 },
    { index: 1, name: 'Two', widthPt: 200, heightPt: 250 }
  ]);
});

test('engineSetDocumentColorSpace executes menu commands and returns actual colorSpace', () => {
  const a = makeArtboard('One', [0, 100, 100, 0]);
  const { doc, ctx, run } = load([a]);
  ctx.DocumentColorSpace = { CMYK: 'CMYK', RGB: 'RGB' };
  doc.documentColorSpace = 'RGB';
  ctx.app.executeMenuCommand = (cmd) => {
    if (cmd === 'doc-color-cmyk') doc.documentColorSpace = 'CMYK';
    if (cmd === 'doc-color-rgb') doc.documentColorSpace = 'RGB';
  };
  const toCmyk = run('engineSetDocumentColorSpace("cmyk")');
  assert.strictEqual(toCmyk.ok, true);
  assert.strictEqual(toCmyk.colorSpace, 'CMYK');
  assert.strictEqual(doc.documentColorSpace, 'CMYK');

  const toRgb = run('engineSetDocumentColorSpace("RGB")');
  assert.strictEqual(toRgb.ok, true);
  assert.strictEqual(toRgb.colorSpace, 'RGB');
  assert.strictEqual(doc.documentColorSpace, 'RGB');

  const invalid = run('engineSetDocumentColorSpace("XYZ")');
  assert.strictEqual(invalid.ok, false);
});

test('no document returns an error instead of throwing', () => {
  const { ctx, run } = load([]);
  ctx.app.documents.length = 0;
  for (const code of ['listArtboards()', 'engineResizeArtboards(' + job({ artboards: 'all', swap: true }) + ')']) {
    const res = run(code);
    assert.strictEqual(res.ok, false);
    assert.match(res.error, /t\u00e0i li\u1ec7u/);
  }
});
