// Run: node --test tests/
// The colour picker engine runs inside Illustrator; these tests load it against stand-ins for the objects it
// touches. convertSampleColor is faked with the naive formula, which is enough to see which path was taken.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function RGBColor() { this.typename = 'RGBColor'; }
function CMYKColor() { this.typename = 'CMYKColor'; }
const rgb = (r, g, b) => Object.assign(new RGBColor(), { red: r, green: g, blue: b });
const cmyk = (c, m, y, k) => Object.assign(new CMYKColor(), { cyan: c, magenta: m, yellow: y, black: k });
const pathItem = (extra) => Object.assign({ typename: 'PathItem', filled: false, stroked: false, locked: false }, extra);

function fakeConvert(from, v, to) {
  if (from === to) return v.slice();
  if (from === 'rgb' && to === 'cmyk') {
    const [r, g, b] = v.map((x) => x / 255), k = 1 - Math.max(r, g, b);
    return k >= 1 ? [0, 0, 0, 100] : [(1 - r - k) / (1 - k) * 100, (1 - g - k) / (1 - k) * 100, (1 - b - k) / (1 - k) * 100, k * 100];
  }
  if (from === 'cmyk' && to === 'rgb') return [0, 1, 2].map((i) => 255 * (1 - v[i] / 100) * (1 - v[3] / 100));
  throw new Error('unexpected conversion');
}

function load({ docs = 1, cmykDoc = true, selection = [], fillActive = true } = {}) {
  const doc = {
    documentColorSpace: cmykDoc ? 'cmyk' : 'rgb', colorProfileName: 'U.S. Web Coated (SWOP) v2', selection,
    defaultFillColor: rgb(255, 255, 255), defaultStrokeColor: rgb(0, 0, 0), defaultFilled: false, defaultStroked: false
  };
  const ctx = {
    app: {
      documents: { length: docs }, activeDocument: doc, convertSampleColor: fakeConvert,
      isFillActive: () => fillActive
    },
    DocumentColorSpace: { CMYK: 'cmyk', RGB: 'rgb' },
    ImageColorSpace: { RGB: 'rgb', CMYK: 'cmyk' },
    ColorConvertPurpose: { defaultpurpose: 'default' },
    RGBColor, CMYKColor,
    engineErrorMessage: (e) => (e && e.message ? e.message : String(e))
  };
  vm.createContext(ctx);
  for (const f of ['json2.jsx', 'color-engine.jsx']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../src/app/jsx', f), 'utf8'), ctx);
  }
  const call = (code) => JSON.parse(vm.runInContext(code, ctx));
  return { doc, call };
}

const plain = (v) => JSON.parse(JSON.stringify(v));

test('context reads the active fill of the first selected path', () => {
  const p = pathItem({ filled: true, fillColor: cmyk(100, 87, 3, 0), stroked: true, strokeColor: rgb(1, 2, 3) });
  const { call } = load({ selection: [p] });
  const res = call('colorPickerContext()');
  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.isCmyk, true);
  assert.strictEqual(res.profileName, 'U.S. Web Coated (SWOP) v2');
  assert.deepStrictEqual(res.cmyk, [100, 87, 3, 0]);
  assert.deepStrictEqual(res.rgb.map(Math.round), [0, 33, 247]);
});

test('context follows the active stroke and looks inside groups and compound paths', () => {
  const inner = pathItem({ stroked: true, strokeColor: rgb(10, 20, 30) });
  const group = { typename: 'GroupItem', pageItems: [{ typename: 'PlacedItem' }, { typename: 'CompoundPathItem', pathItems: [inner] }] };
  const { call } = load({ selection: [group], fillActive: false, cmykDoc: false });
  const res = call('colorPickerContext()');
  assert.strictEqual(res.fillActive, false);
  assert.deepStrictEqual(res.rgb, [10, 20, 30]);
  assert.strictEqual(res.cmyk, undefined);
});

test('context without selection uses the document default; without a document it still answers', () => {
  assert.deepStrictEqual(load({ cmykDoc: false }).call('colorPickerContext()').rgb, [255, 255, 255]);
  const none = load({ docs: 0 }).call('colorPickerContext()');
  assert.strictEqual(none.ok, true);
  assert.strictEqual(none.hasDoc, false);
});

test('convert goes through Illustrator in both directions', () => {
  const { call } = load();
  assert.deepStrictEqual(call('colorConvert(' + JSON.stringify(JSON.stringify({ rgb: [255, 0, 0] })) + ')').cmyk, [0, 100, 100, 0]);
  assert.deepStrictEqual(call('colorConvert(' + JSON.stringify(JSON.stringify({ cmyk: [0, 0, 0, 100] })) + ')').rgb, [0, 0, 0]);
});

const apply = (call, job) => call('colorApply(' + JSON.stringify(JSON.stringify(job)) + ')');

test('apply paints the fill of paths, compound paths, text and grouped items in a CMYK document', () => {
  const a = pathItem(), inner = pathItem(), text = { typename: 'TextFrame', textRange: { characterAttributes: {} } };
  const group = { typename: 'GroupItem', pageItems: [{ typename: 'CompoundPathItem', pathItems: [inner] }, text] };
  const placed = { typename: 'PlacedItem' }, locked = pathItem({ locked: true });
  const { call } = load({ selection: [a, group, placed, locked] });
  const res = apply(call, { rgb: [255, 0, 0], fill: true });
  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.painted, 3);
  assert.strictEqual(res.skipped, 2);
  assert.deepStrictEqual(res.cmyk, [0, 100, 100, 0]);
  for (const target of [a, inner]) {
    assert.strictEqual(target.filled, true);
    assert.deepStrictEqual(plain(target.fillColor), { typename: 'CMYKColor', cyan: 0, magenta: 100, yellow: 100, black: 0 });
  }
  assert.strictEqual(text.textRange.characterAttributes.fillColor.typename, 'CMYKColor');
  assert.strictEqual(locked.filled, false);
});

test('typed CMYK is applied as typed, not re-converted', () => {
  const a = pathItem();
  const { call } = load({ selection: [a] });
  const res = apply(call, { rgb: [0, 0, 0], cmyk: [12.345, 0, 0, 100], fill: true });
  assert.deepStrictEqual(res.cmyk, [12.35, 0, 0, 100]);
  assert.strictEqual(a.fillColor.cyan, 12.35);
});

test('apply in an RGB document paints the stroke with a rounded RGB colour', () => {
  const a = pathItem();
  const { call } = load({ cmykDoc: false, selection: [a] });
  const res = apply(call, { rgb: [30.4, 64.6, 300], fill: false });
  assert.strictEqual(res.ok, true);
  assert.strictEqual(a.stroked, true);
  assert.deepStrictEqual(plain(a.strokeColor), { typename: 'RGBColor', red: 30, green: 65, blue: 255 });
  assert.strictEqual(a.filled, false);
});

test('apply without selection sets the document default; nothing paintable is an error', () => {
  const { doc, call } = load({ cmykDoc: false });
  const res = apply(call, { rgb: [1, 2, 3], fill: true });
  assert.strictEqual(res.target, 'default');
  assert.strictEqual(doc.defaultFilled, true);
  assert.strictEqual(doc.defaultFillColor.red, 1);
  const only = load({ selection: [{ typename: 'PlacedItem' }] }).call;
  const bad = apply(only, { rgb: [1, 2, 3], fill: true });
  assert.strictEqual(bad.ok, false);
  assert.ok(bad.error);
  assert.strictEqual(load({ docs: 0 }).call('colorApply("{}")').ok, false);
});
