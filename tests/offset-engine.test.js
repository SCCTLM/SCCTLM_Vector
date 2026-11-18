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

test('offsetDetectExisting detects tagged item and reads stored parameters', () => {
  const mockOffsetItem = {
    typename: 'PathItem',
    filled: true,
    fillColor: { typename: 'RGBColor', red: 31, green: 200, blue: 255 },
    note: 'SCCTLM_OFFSET:{"offsetPt":20,"join":0,"miterLimit":4,"mode":"sticker","colorHex":"#1FC8FF"}'
  };
  const doc = {
    selection: [mockOffsetItem]
  };
  const { run } = loadEngine(doc);
  const res = run('offsetDetectExisting()');
  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.found, true);
  assert.strictEqual(res.params.offsetPt, 20);
  assert.strictEqual(res.params.colorHex, '#1FC8FF');
});

test('offsetDetectExisting detects offset via sibling behind source item', () => {
  const parent = { pageItems: [] };
  const sourceItem = {
    typename: 'PathItem',
    width: 80,
    height: 100,
    geometricBounds: [20, 120, 100, 20],
    parent: parent
  };
  const offsetItem = {
    typename: 'PathItem',
    width: 120,
    height: 140,
    geometricBounds: [0, 140, 120, 0],
    filled: true,
    fillColor: { typename: 'RGBColor', red: 0, green: 0, blue: 0 },
    parent: parent
  };
  parent.pageItems.push(sourceItem, offsetItem);

  const doc = {
    selection: [sourceItem]
  };
  const { run } = loadEngine(doc);
  const res = run('offsetDetectExisting()');
  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.found, true);
  assert.strictEqual(res.params.offsetPt, 20); // (120 - 80) / 2 = 20
  assert.strictEqual(res.params.colorHex, '#000000');
});

test('offsetInspectSelection returns unified shape, offset and selection key', () => {
  const pt = (x, y) => ({ anchor: [x, y], leftDirection: [x, y], rightDirection: [x, y] });
  const mockItem = {
    typename: 'PathItem',
    closed: true,
    pathPoints: [pt(0, 0), pt(10, 0), pt(10, 20)],
    note: 'SCCTLM_OFFSET:{"offsetPt":15,"join":2,"miterLimit":5,"mode":"standard","colorHex":"#FF0000"}'
  };
  const doc = {
    selection: [mockItem]
  };
  const { run } = loadEngine(doc);
  const res = run('offsetInspectSelection()');
  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.hasSelection, true);
  assert.ok(res.selectionKey);
  assert.strictEqual(res.offsetInfo.found, true);
  assert.strictEqual(res.offsetInfo.params.offsetPt, 15);
  assert.strictEqual(res.shape.ok, true);
});

test('offsetGroupPair groups artwork with its offset and names the group', () => {
  const named = { typename: 'GroupItem', name: '' };
  const doc = { selection: null };
  const { ctx } = loadEngine(doc);
  ctx.app.executeMenuCommand = (cmd) => {
    ctx.menuCommandLog.push(cmd);
    if (cmd === 'group') doc.selection = [named];
  };
  const source = { typename: 'PathItem', selected: false, parent: { typename: 'Layer' } };
  const result = { typename: 'PathItem', selected: false, parent: { typename: 'Layer' } };
  ctx.__args = [doc, [source], [result]];
  vm.runInContext('offsetGroupPair(__args[0], __args[1], __args[2])', ctx);
  assert.ok(ctx.menuCommandLog.includes('group'));
  assert.strictEqual(source.selected, true);
  assert.strictEqual(result.selected, true);
  assert.strictEqual(named.name, 'Offset Group');
});

test('offsetGroupPair leaves artwork already inside an offset group alone', () => {
  const doc = { selection: null };
  const { ctx } = loadEngine(doc);
  const inGroup = { typename: 'GroupItem', name: 'Offset Group' };
  const source = { typename: 'PathItem', selected: false, parent: inGroup };
  const result = { typename: 'PathItem', selected: false, parent: inGroup };
  ctx.__args = [doc, [source], [result]];
  vm.runInContext('offsetGroupPair(__args[0], __args[1], __args[2])', ctx);
  assert.ok(!ctx.menuCommandLog.includes('group'));
});

test('offsetDetectExisting ignores unrelated artwork that merely overlaps', () => {
  const parent = { pageItems: [] };
  const small = { typename: 'PathItem', width: 80, height: 80, geometricBounds: [100, -100, 180, -180], parent };
  const big = {
    typename: 'PathItem', width: 300, height: 200, geometricBounds: [50, -50, 350, -250],
    filled: true, fillColor: { typename: 'RGBColor', red: 200, green: 200, blue: 0 }, parent
  };
  parent.pageItems.push(small, big);
  const { run } = loadEngine({ selection: [small] });
  const res = run('offsetDetectExisting()');
  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.found, false);
});

test('offsetDetectExisting ignores a copied source tag with no border beside it', () => {
  const layer = { typename: 'Layer', pageItems: [] };
  const copy = {
    typename: 'TextFrame', width: 100, height: 40, geometricBounds: [0, 40, 100, 0], parent: layer,
    note: 'SCCTLM_OFFSET:{"id":"off_1","offsetPt":10,"role":"source"}'
  };
  layer.pageItems.push(copy);
  const { run } = loadEngine({ selection: [copy] });
  const res = run('offsetDetectExisting()');
  assert.strictEqual(res.found, false);
});
