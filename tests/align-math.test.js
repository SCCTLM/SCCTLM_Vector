// Run: node --test tests/align-math.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadAlignEngine(mockApp) {
  const mathCode = fs.readFileSync(path.join(__dirname, '../src/app/jsx/align-math.jsx'), 'utf8');
  const engineCode = fs.readFileSync(path.join(__dirname, '../src/app/jsx/align-engine.jsx'), 'utf8');
  const sandbox = {
    app: mockApp || { documents: [] },
    engineErrorMessage: (e) => (e && e.message ? e.message : String(e))
  };
  vm.createContext(sandbox);
  vm.runInContext(mathCode, sandbox);
  vm.runInContext(engineCode, sandbox);
  return sandbox;
}

function approx(actual, expected, msg) {
  assert.ok(Math.abs(actual - expected) < 1e-6, `${msg || 'approx'}: expected ${expected}, got ${actual}`);
}

// Artboard: [left=0, top=500, right=400, bottom=0] -> width=400, height=500, cx=200, cy=250
const AB = [0, 500, 400, 0];

test('Align Objects: all 7 operations in Selection mode (N items)', () => {
  const { alignComputeDeltas } = loadAlignEngine();
  // Item 0: [10, 400, 50, 360] (w=40, h=40, cx=30, cy=380)
  // Item 1: [110, 200, 210, 100] (w=100, h=100, cx=160, cy=150)
  // Union: [10, 400, 210, 100] (w=200, h=300, cx=110, cy=250)
  const items = [[10, 400, 50, 360], [110, 200, 210, 100]];

  let r = alignComputeDeltas('left', items, { alignTo: 'selection', artboardRect: AB });
  assert.strictEqual(r.ok, true);
  approx(r.deltas[0].dx, 0); approx(r.deltas[0].dy, 0);
  approx(r.deltas[1].dx, -100); approx(r.deltas[1].dy, 0);

  r = alignComputeDeltas('h-center', items, { alignTo: 'selection', artboardRect: AB });
  approx(r.deltas[0].dx, 80); approx(r.deltas[0].dy, 0);
  approx(r.deltas[1].dx, -50); approx(r.deltas[1].dy, 0);

  r = alignComputeDeltas('right', items, { alignTo: 'selection', artboardRect: AB });
  approx(r.deltas[0].dx, 160); approx(r.deltas[1].dx, 0);

  r = alignComputeDeltas('center-both', items, { alignTo: 'selection', artboardRect: AB });
  approx(r.deltas[0].dx, 80); approx(r.deltas[0].dy, -130);
  approx(r.deltas[1].dx, -50); approx(r.deltas[1].dy, 100);

  r = alignComputeDeltas('top', items, { alignTo: 'selection', artboardRect: AB });
  approx(r.deltas[0].dy, 0); approx(r.deltas[1].dy, 200);

  r = alignComputeDeltas('v-center', items, { alignTo: 'selection', artboardRect: AB });
  approx(r.deltas[0].dy, -130); approx(r.deltas[1].dy, 100);

  r = alignComputeDeltas('bottom', items, { alignTo: 'selection', artboardRect: AB });
  approx(r.deltas[0].dy, -260); approx(r.deltas[1].dy, 0);
});

test('Align Objects: single item in Selection mode falls back to active Artboard', () => {
  const { alignComputeDeltas } = loadAlignEngine();
  // Item: [10, 400, 50, 360] (cx=30, cy=380), AB center = (200, 250)
  const r = alignComputeDeltas('center-both', [[10, 400, 50, 360]], { alignTo: 'selection', artboardRect: AB });
  assert.strictEqual(r.ok, true);
  approx(r.deltas[0].dx, 170);
  approx(r.deltas[0].dy, -130);
});

test('Align Objects: Artboard mode and Key Object mode', () => {
  const { alignComputeDeltas } = loadAlignEngine();
  const items = [[10, 400, 50, 360], [110, 200, 210, 100]];

  const abRes = alignComputeDeltas('center-both', items, { alignTo: 'artboard', artboardRect: AB });
  assert.strictEqual(abRes.ok, true);
  approx(abRes.deltas[0].dx, 170); approx(abRes.deltas[0].dy, -130);
  approx(abRes.deltas[1].dx, 40); approx(abRes.deltas[1].dy, 100);

  // Key mode: item 0 is key -> item 0 stays put, item 1 centers on item 0 (cx=30, cy=380)
  const keyRes = alignComputeDeltas('center-both', items, { alignTo: 'key', keyIndex: 0 });
  assert.strictEqual(keyRes.ok, true);
  approx(keyRes.deltas[0].dx, 0); approx(keyRes.deltas[0].dy, 0);
  approx(keyRes.deltas[1].dx, -130); approx(keyRes.deltas[1].dy, 230);
});

test('Distribute Objects: all 6 operations in Selection, Artboard, and Key modes', () => {
  const { alignComputeDeltas } = loadAlignEngine();
  // 3 items at different positions
  const items = [
    [0, 300, 20, 280],   // top=300, cy=290, bottom=280; left=0, cx=10, right=20
    [40, 260, 80, 220],  // top=260, cy=240, bottom=220; left=40, cx=60, right=80
    [180, 100, 200, 80]  // top=100, cy=90, bottom=80; left=180, cx=190, right=200
  ];

  // Selection mode: v-dist-top -> tops 300, 200, 100 (item 1 moves from 260 to 200 => dy=-60)
  let r = alignComputeDeltas('v-dist-top', items, { alignTo: 'selection', artboardRect: AB });
  assert.strictEqual(r.ok, true);
  approx(r.deltas[0].dy, 0); approx(r.deltas[1].dy, -60); approx(r.deltas[2].dy, 0);

  // v-dist-center -> cy 290, 190, 90 (item 1 moves from 240 to 190 => dy=-50)
  r = alignComputeDeltas('v-dist-center', items, { alignTo: 'selection', artboardRect: AB });
  approx(r.deltas[1].dy, -50);

  // v-dist-bottom -> bottom 280, 180, 80 (item 1 moves from 220 to 180 => dy=-40)
  r = alignComputeDeltas('v-dist-bottom', items, { alignTo: 'selection', artboardRect: AB });
  approx(r.deltas[1].dy, -40);

  // h-dist-left -> lefts 0, 90, 180 (item 1 moves from 40 to 90 => dx=+50)
  r = alignComputeDeltas('h-dist-left', items, { alignTo: 'selection', artboardRect: AB });
  approx(r.deltas[1].dx, 50);

  // h-dist-center -> cx 10, 100, 190 (item 1 moves from 60 to 100 => dx=+40)
  r = alignComputeDeltas('h-dist-center', items, { alignTo: 'selection', artboardRect: AB });
  approx(r.deltas[1].dx, 40);

  // h-dist-right -> right 20, 110, 200 (item 1 moves from 80 to 110 => dx=+30)
  r = alignComputeDeltas('h-dist-right', items, { alignTo: 'selection', artboardRect: AB });
  approx(r.deltas[1].dx, 30);

  // Artboard mode with 2 items: h-dist-left -> item0 left=0, item1 left=400-20=380
  const two = [[50, 300, 70, 280], [100, 200, 120, 180]];
  r = alignComputeDeltas('h-dist-left', two, { alignTo: 'artboard', artboardRect: AB });
  assert.strictEqual(r.ok, true);
  approx(r.deltas[0].dx, -50);
  approx(r.deltas[1].dx, 280);

  // Key mode keeps keyIndex=1 stationary
  r = alignComputeDeltas('h-dist-left', items, { alignTo: 'key', keyIndex: 1 });
  assert.strictEqual(r.ok, true);
  approx(r.deltas[1].dx, 0);
  approx(r.deltas[0].dx, -50);
  approx(r.deltas[2].dx, -50);
});

test('Distribute Spacing: auto even spacing and explicit numeric spacing', () => {
  const { alignComputeDeltas } = loadAlignEngine();
  // 3 items of width 20, height 20
  const items = [
    [0, 300, 20, 280],
    [30, 250, 50, 230],
    [100, 100, 120, 80]
  ];

  // Auto h-space in selection: span = 120 - 0 = 120, totalSize = 60, gap = 30
  // Positions: [0..20], [50..70], [100..120] => item 1 dx = +20
  let r = alignComputeDeltas('h-space', items, { alignTo: 'selection', spacingPt: null });
  assert.strictEqual(r.ok, true);
  approx(r.deltas[0].dx, 0); approx(r.deltas[1].dx, 20); approx(r.deltas[2].dx, 0);

  // Auto v-space in selection: span = 300 - 80 = 220, totalSize = 60, gap = 80
  // Tops: 300, 200, 100 => item 1 dy = -50
  r = alignComputeDeltas('v-space', items, { alignTo: 'selection', spacingPt: null });
  assert.strictEqual(r.ok, true);
  approx(r.deltas[0].dy, 0); approx(r.deltas[1].dy, -50); approx(r.deltas[2].dy, 0);

  // Explicit h-space = 10pt in selection: lefts 0, 30, 60 => item 2 dx = -40
  r = alignComputeDeltas('h-space', items, { alignTo: 'selection', spacingPt: 10 });
  assert.strictEqual(r.ok, true);
  approx(r.deltas[0].dx, 0); approx(r.deltas[1].dx, 0); approx(r.deltas[2].dx, -40);

  // Key mode with null spacing defaults to 0pt, keeping keyIndex=0 stationary
  r = alignComputeDeltas('v-space', [[0, 100, 20, 80], [0, 50, 20, 30]], { alignTo: 'key', keyIndex: 0 });
  assert.strictEqual(r.ok, true);
  approx(r.deltas[0].dy, 0);
  approx(r.deltas[1].dy, 30); // top moves from 50 to 80
});

test('Edge cases: negative coords, 0-width items, insufficient items, invalid op', () => {
  const { alignComputeDeltas } = loadAlignEngine();
  // Negative coordinates & 0-width vertical line
  const r = alignComputeDeltas('center-both', [[-100, -50, -100, -150]], {
    alignTo: 'selection',
    artboardRect: [-200, 0, 0, -200] // cx=-100, cy=-100
  });
  assert.strictEqual(r.ok, true);
  approx(r.deltas[0].dx, 0);
  approx(r.deltas[0].dy, 0);

  // Insufficient items for distribute
  assert.strictEqual(alignComputeDeltas('h-dist-left', [[0, 10, 10, 0], [20, 10, 30, 0]], { alignTo: 'selection' }).ok, false);
  // Invalid op
  assert.strictEqual(alignComputeDeltas('bogus', [[0, 10, 10, 0]], { alignTo: 'selection', artboardRect: AB }).ok, false);
});

test('align-engine: handles clipping masks, preview bounds, and locked items', () => {
  const moves = [];
  const clippedGroup = {
    typename: 'GroupItem',
    clipped: true,
    locked: false,
    hidden: false,
    visibleBounds: [-500, 500, 500, -500], // huge masked child
    geometricBounds: [-500, 500, 500, -500],
    pageItems: [
      { typename: 'PathItem', clipping: true, geometricBounds: [0, 100, 100, 0] }
    ],
    translate(dx, dy) { moves.push({ item: 'clipped', dx, dy }); }
  };
  const lockedItem = {
    typename: 'PathItem',
    locked: true,
    hidden: false,
    visibleBounds: [0, 10, 10, 0],
    translate() { moves.push({ item: 'locked' }); }
  };

  const mockApp = {
    documents: [{}],
    preferences: { getBooleanPreference: () => true },
    redraw() {},
    activeDocument: {
      selection: [clippedGroup, lockedItem],
      artboards: {
        0: { artboardRect: [0, 400, 400, 0] },
        getActiveArtboardIndex: () => 0
      }
    }
  };

  const { engineAlignObjects } = loadAlignEngine(mockApp);
  const res = JSON.parse(engineAlignObjects(JSON.stringify({ op: 'center-both', alignTo: 'selection' })));
  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.count, 1);
  assert.strictEqual(moves.length, 1);
  // Clipping path center is (50, 50), artboard center is (200, 200) -> dx=150, dy=150
  approx(moves[0].dx, 150);
  approx(moves[0].dy, 150);
});
