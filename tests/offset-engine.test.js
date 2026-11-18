// Run: node --test tests/
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const JSX = path.join(__dirname, '../src/app/jsx');

function loadEngine(doc) {
  const ctx = {
    app: {
      documents: doc ? [doc] : [],
      activeDocument: doc || null,
      redraw() {},
      executeMenuCommand(cmd) {
        if (ctx.menuCommandLog) ctx.menuCommandLog.push(cmd);
      },
      convertSampleColor(from, val, to) {
        return val.length === 4 ? [255, 255, 255] : [0, 0, 0, 0];
      }
    },
    ElementPlacement: { PLACEAFTER: 1, PLACEBEFORE: 2, INSIDE: 3 },
    DocumentColorSpace: { RGB: 1, CMYK: 2 },
    ImageColorSpace: { RGB: 1, CMYK: 2 },
    ColorConvertPurpose: { defaultpurpose: 1 },
    menuCommandLog: [],
    RGBColor: function () { this.typename = 'RGBColor'; this.red = 0; this.green = 0; this.blue = 0; },
    CMYKColor: function () { this.typename = 'CMYKColor'; this.cyan = 0; this.magenta = 0; this.yellow = 0; this.black = 0; }
  };
  ctx.app.documents.length = doc ? 1 : 0;
  vm.createContext(ctx);

  for (const f of ['json2.jsx', 'naming.jsx', 'color-engine.jsx', 'offset-engine.jsx']) {
    vm.runInContext(fs.readFileSync(path.join(JSX, f), 'utf8'), ctx);
  }

  const run = (code) => JSON.parse(vm.runInContext(code, ctx));
  return { ctx, run };
}

test('offsetParseJoin maps strings and integers to Illustrator join constants', () => {
  const { ctx } = loadEngine(null);
  assert.strictEqual(vm.runInContext('offsetParseJoin("round")', ctx), 0);
  assert.strictEqual(vm.runInContext('offsetParseJoin("miter")', ctx), 2);
  assert.strictEqual(vm.runInContext('offsetParseJoin("bevel")', ctx), 1);
  assert.strictEqual(vm.runInContext('offsetParseJoin(0)', ctx), 0);
  assert.strictEqual(vm.runInContext('offsetParseJoin(1)', ctx), 1);
  assert.strictEqual(vm.runInContext('offsetParseJoin(2)', ctx), 2);
  assert.strictEqual(vm.runInContext('offsetParseJoin("other")', ctx), 0);
});

test('offsetEffectXML formats the exact Adobe Offset Path dictionary string', () => {
  const { ctx } = loadEngine(null);
  const xml = vm.runInContext('offsetEffectXML(20, 1, 4)', ctx);
  assert.strictEqual(
    xml,
    '<LiveEffect name="Adobe Offset Path"><Dict data="I jntp 1 R mlim 4 R ofst 20"/></LiveEffect>'
  );
});

test('engineOffsetPath returns error when no document is open', () => {
  const { run } = loadEngine(null);
  const res = run('engineOffsetPath("{}")');
  assert.strictEqual(res.ok, false);
  assert.ok(res.error.includes('Chưa mở tài liệu nào'));
});

test('engineOffsetPath returns error when selection is empty', () => {
  const doc = { selection: [] };
  const { run } = loadEngine(doc);
  const res = run('engineOffsetPath("{}")');
  assert.strictEqual(res.ok, false);
  assert.ok(res.error.includes('Chọn ít nhất một đối tượng'));
});

test('engineOffsetPath duplicates selection, applies effect XML, expands and colors', () => {
  let dupCalls = 0;
  let applyEffectCalls = 0;
  let effectXml = '';
  let moveCalls = 0;

  const mockItem = {
    typename: 'PathItem',
    filled: true,
    fillColor: null,
    stroked: false,
    selected: true,
    duplicate(dest, placement) {
      dupCalls++;
      const dup = {
        typename: 'PathItem',
        filled: false,
        fillColor: null,
        stroked: true,
        selected: false,
        applyEffect(xml) {
          applyEffectCalls++;
          effectXml = xml;
        },
        move(target, placement) {
          moveCalls++;
        }
      };
      return dup;
    }
  };

  const doc = {
    documentColorSpace: 1, // RGB
    selection: [mockItem]
  };

  const { ctx, run } = loadEngine(doc);
  const job = {
    offsetPt: 25,
    join: 'round',
    miterLimit: 4,
    color: { rgb: [31, 200, 255] }
  };

  const res = run('engineOffsetPath(' + JSON.stringify(JSON.stringify(job)) + ')');
  assert.strictEqual(res.ok, true, res.error);
  assert.strictEqual(res.offsetPt, 25);
  assert.strictEqual(res.join, 0);
  assert.strictEqual(res.miterLimit, 4);

  assert.strictEqual(dupCalls, 1);
  assert.strictEqual(applyEffectCalls, 1);
  assert.ok(effectXml.includes('R ofst 25'));
  assert.ok(effectXml.includes('I jntp 0'));
  assert.ok(ctx.menuCommandLog.includes('expandStyle'));
});

test('engineOffsetPath handles TextFrame by creating outlines', () => {
  let createOutlineCalled = false;
  const mockTextFrame = {
    typename: 'TextFrame',
    duplicate() {
      return {
        typename: 'TextFrame',
        createOutline() {
          createOutlineCalled = true;
          return {
            typename: 'GroupItem',
            pageItems: [],
            applyEffect() {},
            move() {}
          };
        }
      };
    }
  };

  const doc = {
    documentColorSpace: 1,
    selection: [mockTextFrame]
  };

  const { run } = loadEngine(doc);
  const res = run('engineOffsetPath(' + JSON.stringify(JSON.stringify({ offset: 15 })) + ')');
  assert.strictEqual(res.ok, true, res.error);
  assert.strictEqual(createOutlineCalled, true);
});

test('engineOffsetPath supports negative offset (inset) and standard mode', () => {
  let appliedXml = '';
  const mockPath = {
    typename: 'PathItem',
    filled: true,
    stroked: false,
    selected: true,
    duplicate() {
      return {
        typename: 'PathItem',
        applyEffect(xml) {
          appliedXml = xml;
        },
        move() {}
      };
    }
  };

  const doc = {
    documentColorSpace: 1,
    selection: [mockPath]
  };

  const { run } = loadEngine(doc);
  const res = run('engineOffsetPath(' + JSON.stringify(JSON.stringify({
    offsetPt: -5.5,
    mode: 'standard',
    join: 'bevel',
    miterLimit: 8
  })) + ')');

  assert.strictEqual(res.ok, true, res.error);
  assert.strictEqual(res.mode, 'standard');
  assert.strictEqual(res.offsetPt, -5.5);
  assert.strictEqual(res.join, 1); // bevel
  assert.strictEqual(res.miterLimit, 8);
  assert.ok(appliedXml.includes('R ofst -5.5'));
  assert.ok(appliedXml.includes('I jntp 1'));
  assert.ok(appliedXml.includes('R mlim 8'));
});


test('offsetShapeFromSelection flattens selected paths into one upright SVG path', () => {
  const pt = (x, y) => ({ anchor: [x, y], leftDirection: [x, y], rightDirection: [x, y] });
  const doc = {
    selection: [
      { typename: 'PathItem', closed: true, pathPoints: [pt(0, 0), pt(10, 0), pt(10, 20)] },
      { typename: 'TextFrame' }
    ]
  };
  const { run } = loadEngine(doc);
  const res = run('offsetShapeFromSelection()');
  assert.strictEqual(res.ok, true);
  assert.ok(res.d.startsWith('M0 0C'));
  assert.ok(res.d.endsWith('Z'));
  assert.strictEqual(res.w, 10);
  assert.strictEqual(res.h, 20);
  assert.ok(res.d.includes('10 -20'), 'y axis is flipped for SVG');
});

test('offsetShapeFromSelection reports no shape for an empty selection', () => {
  const { run } = loadEngine({ selection: [] });
  assert.strictEqual(run('offsetShapeFromSelection()').ok, false);
});
