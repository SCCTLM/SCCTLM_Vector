// Run: node --test tests/
// The grid engine runs inside Illustrator; these tests load it against small stand-ins for the Illustrator
// objects it touches, so layer handling, collection and drawing calls are pinned without the app.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function collection(items) {
  const c = items || [];
  return c;
}

function makeLayer(name, parent) {
  const layer = {
    typename: 'Layer', name, parent, locked: false, visible: true, removed: false,
    layers: collection([]), drawn: [],
    remove() {
      if (this.locked || !this.visible) throw new Error('layer is locked or hidden');
      if (parent.layers.length === 1) throw new Error('cannot remove the last layer');
      for (const l of this.layers) if (l.locked || !l.visible) throw new Error('sublayer is locked or hidden');
      const list = parent.layers;
      list.splice(list.indexOf(this), 1);
      this.removed = true;
    }
  };
  layer.layers.add = () => { const l = makeLayer('Layer', layer); layer.layers.unshift(l); return l; };
  const draw = (kind, extra) => {
    const item = Object.assign({ typename: 'PathItem', kind, layer, locked: false, pathPoints: [] }, extra);
    item.setEntirePath = (pts) => { item.entire = pts; item.pathPoints = pts.map((a) => ({ anchor: a })); };
    layer.drawn.push(item);
    return item;
  };
  layer.pathItems = {
    add: () => draw('path'),
    ellipse: (top, left, w, h) => draw('ellipse', { top, left, w, h, width: w, height: h, position: [left, top], geometricBounds: [left, top, left + w, top - h] }),
    rectangle: (top, left, w, h) => draw('rect', { top, left, w, h, width: w, height: h, position: [left, top], geometricBounds: [left, top, left + w, top - h] })
  };
  Object.defineProperty(layer, 'pageItems', { get: () => layer.drawn });
  return layer;
}

function sourcePath(layer, points, closed) {
  const xs = points.map((p) => p[0]), ys = points.map((p) => p[1]);
  return {
    typename: 'PathItem', layer, guides: false, closed, selected: true,
    pathPoints: points.map((p) => ({ anchor: p, leftDirection: p, rightDirection: p })),
    geometricBounds: [Math.min(...xs), Math.max(...ys), Math.max(...xs), Math.min(...ys)]
  };
}

function load({ cmyk } = {}) {
  const doc = { layers: [], documentColorSpace: cmyk ? 'cmyk' : 'rgb' };
  doc.layers.add = () => { const l = makeLayer('Layer', doc); doc.layers.unshift(l); return l; };
  const art = makeLayer('Artwork', doc);
  doc.layers.push(art);
  doc.activeLayer = art;
  const ctx = {
    app: { documents: { length: 1 }, activeDocument: doc },
    DocumentColorSpace: { CMYK: 'cmyk', RGB: 'rgb' },
    RGBColor: function () { this.kind = 'rgb'; },
    CMYKColor: function () { this.kind = 'cmyk'; },
    engineErrorMessage: (e) => (e && e.message ? e.message : String(e))
  };
  vm.createContext(ctx);
  for (const f of ['json2.jsx', 'grid-geometry.jsx', 'grid-engine.jsx']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../src/app/jsx', f), 'utf8'), ctx);
  }
  const call = (code) => JSON.parse(vm.runInContext(code, ctx));
  return { ctx, doc, art, call };
}

const all = { anchors: true, handles: true, outlines: true, gridlines: true, circles: true };
const job = (extra) => JSON.stringify(Object.assign({ elements: all, gridlines: { sensitivity: 50 } }, extra));
const squarePts = [[0, 0], [100, 0], [100, 100], [0, 100]];

test('square: draws on its own layer with one sublayer per element that has items', () => {
  const { doc, art, call } = load();
  const sq = sourcePath(art, squarePts, true);
  doc.selection = [sq];
  const res = call('gridGenerate(' + JSON.stringify(job()) + ')');
  assert.strictEqual(res.ok, true, res.error);
  assert.deepStrictEqual(res.counts, { anchors: 4, handles: 0, outlines: 1, gridlines: 4, circles: 0 });
  const grid = doc.layers[0];
  assert.strictEqual(grid.name, 'SCCTLM Grid');
  assert.deepStrictEqual(grid.layers.map((l) => l.name), ['Anchors', 'Outlines', 'Gridlines']);
  assert.strictEqual(art.drawn.length, 0, 'source layer untouched');
  assert.deepStrictEqual(sq.pathPoints.map((p) => p.anchor), squarePts, 'source path untouched');
  assert.strictEqual(sq.selected, true, 'selection restored');
  assert.strictEqual(doc.activeLayer, art);
});

test('anchor markers are centred on the anchor', () => {
  const { doc, art, call } = load();
  doc.selection = [sourcePath(art, squarePts, true)];
  call('gridGenerate(' + JSON.stringify(job({ elements: { anchors: true }, style: { anchors: { size: 6 } } })) + ')');
  const m = doc.layers[0].layers[0].drawn[0];
  assert.deepStrictEqual([m.top, m.left, m.w, m.h], [3, -3, 6, 6]);
});

test('gridlines extend past the artwork by the margin', () => {
  const { doc, art, call } = load();
  doc.selection = [sourcePath(art, squarePts, true)];
  call('gridGenerate(' + JSON.stringify(job({ elements: { gridlines: true }, gridlines: { sensitivity: 50, margin: 10 } })) + ')');
  const lines = doc.layers[0].layers[0].drawn.map((d) => d.entire);
  const xs = lines.flat().map((p) => p[0]);
  assert.strictEqual(Math.min(...xs), -10);
  assert.strictEqual(Math.max(...xs), 110);
});

test('generating again replaces a locked, hidden earlier grid instead of stacking', () => {
  const { doc, art, call } = load();
  const sq = sourcePath(art, squarePts, true);
  doc.selection = [sq];
  call('gridGenerate(' + JSON.stringify(job()) + ')');
  const first = doc.layers[0];
  first.locked = true;
  first.layers[0].visible = false;
  doc.selection = [sq]; // the stand-in does not rebuild doc.selection from item.selected
  const res = call('gridGenerate(' + JSON.stringify(job()) + ')');
  assert.strictEqual(res.ok, true, res.error);
  assert.strictEqual(first.removed, true);
  assert.strictEqual(doc.layers.filter((l) => l.name === 'SCCTLM Grid').length, 1);
});

test('items on the grid layer are not read as artwork', () => {
  const { doc, art, call } = load();
  doc.selection = [sourcePath(art, squarePts, true)];
  call('gridGenerate(' + JSON.stringify(job()) + ')');
  const marker = doc.layers[0].layers[0].drawn[0];
  marker.typename = 'PathItem';
  marker.geometricBounds = [0, 0, 0, 0];
  doc.selection = [marker];
  const res = call('gridGenerate(' + JSON.stringify(job()) + ')');
  assert.strictEqual(res.ok, false);
});

test('groups and compound paths are entered; text and images are reported as skipped', () => {
  const { doc, art, call } = load();
  const inner = sourcePath(art, squarePts, true);
  const compound = { typename: 'CompoundPathItem', layer: art, pathItems: [sourcePath(art, [[0, 0], [50, 50]], false)] };
  const group = { typename: 'GroupItem', layer: art, pageItems: [inner, compound, { typename: 'TextFrame', layer: art }] };
  doc.selection = [group, { typename: 'PlacedItem', layer: art }];
  const res = call('gridInspect()');
  assert.deepStrictEqual(res, { ok: true, paths: 2, anchors: 6, circles: 0, skipped: { text: 1, raster: 1, other: 0 } });
});

test('nothing usable selected returns an error and draws nothing', () => {
  const { doc, call } = load();
  doc.selection = [];
  const res = call('gridGenerate(' + JSON.stringify(job()) + ')');
  assert.strictEqual(res.ok, false);
  assert.strictEqual(doc.layers.length, 1);
});

test('CMYK documents get CMYK colours; "none" turns fill off', () => {
  const { doc, art, call } = load({ cmyk: true });
  doc.selection = [sourcePath(art, squarePts, true)];
  call('gridGenerate(' + JSON.stringify(job({ elements: { anchors: true }, style: { anchors: { fill: 'none', stroke: '#ff0000' } } })) + ')');
  const m = doc.layers[0].layers[0].drawn[0];
  assert.strictEqual(m.filled, false);
  assert.strictEqual(m.strokeColor.kind, 'cmyk');
  assert.strictEqual(m.strokeColor.magenta, 100);
  assert.strictEqual(m.strokeColor.yellow, 100);
  assert.strictEqual(m.strokeColor.black, 0);
});

test('clear removes the grid layer', () => {
  const { doc, art, call } = load();
  doc.selection = [sourcePath(art, squarePts, true)];
  call('gridGenerate(' + JSON.stringify(job()) + ')');
  assert.deepStrictEqual(call('gridClear()'), { ok: true, removed: true });
  assert.deepStrictEqual(call('gridClear()'), { ok: true, removed: false });
  assert.strictEqual(doc.layers.length, 1);
});

test('clipping masks and hidden paths are not read as artwork', () => {
  const { doc, art, call } = load();
  const mask = Object.assign(sourcePath(art, squarePts, true), { clipping: true });
  const hidden = Object.assign(sourcePath(art, squarePts, true), { hidden: true });
  doc.selection = [mask, hidden, sourcePath(art, squarePts, true)];
  const res = call('gridInspect()');
  assert.strictEqual(res.paths, 1);
  assert.strictEqual(res.skipped.other, 2);
});

test('inspect estimates circles for a job that draws them', () => {
  const { doc, art, call } = load();
  const K = 0.5523;
  const circle = {
    typename: 'PathItem', layer: art, closed: true, geometricBounds: [-50, 50, 50, -50],
    pathPoints: [[50, 0], [0, 50], [-50, 0], [0, -50]].map(([x, y]) => ({
      anchor: [x, y], leftDirection: [x - y * K, y + x * K], rightDirection: [x + y * K, y - x * K]
    }))
  };
  doc.selection = [circle];
  const res = call('gridInspect(' + JSON.stringify(job({ circles: { complexity: 0, mode: 'all' } })) + ')');
  assert.strictEqual(res.circles, 4);
  assert.strictEqual(call('gridInspect()').circles, 0);
});

test('clear works when the grid is the only layer left', () => {
  const { doc, art, call } = load();
  doc.selection = [sourcePath(art, squarePts, true)];
  call('gridGenerate(' + JSON.stringify(job()) + ')');
  doc.layers.splice(doc.layers.indexOf(art), 1);
  assert.deepStrictEqual(call('gridClear()'), { ok: true, removed: true });
  assert.strictEqual(doc.layers.length, 1);
  assert.notStrictEqual(doc.layers[0].name, 'SCCTLM Grid');
});

test('a failure while drawing keeps the earlier grid, removes the partial one and restores state', () => {
  const { ctx, doc, art, call } = load();
  const sq = sourcePath(art, squarePts, true);
  doc.selection = [sq];
  call('gridGenerate(' + JSON.stringify(job()) + ')');
  const first = doc.layers[0];
  doc.selection = [sq];
  sq.selected = false;
  doc.activeLayer = art;
  ctx.RGBColor = function () { throw new Error('paint failed'); };
  const res = call('gridGenerate(' + JSON.stringify(job()) + ')');
  assert.strictEqual(res.ok, false);
  assert.strictEqual(res.error, 'paint failed');
  assert.deepStrictEqual(doc.layers.filter((l) => l.name === 'SCCTLM Grid'), [first], 'earlier grid kept, partial one gone');
  assert.strictEqual(first.removed, false);
  assert.strictEqual(doc.activeLayer, art);
  assert.strictEqual(sq.selected, true, 'selection restored');
});

test('paths inside hidden groups and hidden compound paths are not read as artwork', () => {
  const { doc, art, call } = load();
  const hiddenGroup = { typename: 'GroupItem', layer: art, hidden: true, pageItems: [sourcePath(art, squarePts, true)] };
  const hiddenCompound = { typename: 'CompoundPathItem', layer: art, hidden: true, pathItems: [sourcePath(art, squarePts, true)] };
  const group = { typename: 'GroupItem', layer: art, pageItems: [hiddenGroup, hiddenCompound, sourcePath(art, squarePts, true)] };
  doc.selection = [group];
  const res = call('gridInspect()');
  assert.strictEqual(res.paths, 1);
  assert.strictEqual(res.skipped.other, 2);
});

test('engine default styles match the panel defaults', () => {
  const { ctx } = load();
  const panelSrc = fs.readFileSync(path.join(__dirname, '../src/app/grid-settings.js'), 'utf8');
  const sandbox = { require, window: {} };
  sandbox.window.Presets = { dataDir: () => '' };
  vm.createContext(sandbox);
  vm.runInContext(panelSrc, sandbox);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(ctx.GRID_DEFAULT_STYLE)), JSON.parse(JSON.stringify(sandbox.window.GridSettings.DEFAULTS.style)));
});


test('gridRestyle updates existing grid layer styles in place without recalculating', () => {
  const { doc, art, call } = load();
  const sq = sourcePath(art, squarePts, true);
  doc.selection = [sq];
  call('gridGenerate(' + JSON.stringify(job()) + ')');

  const restyleJob = {
    style: {
      anchors: { size: 16, fill: '#ff0000', stroke: '#00ff00', strokeWidth: 2 },
      gridlines: { stroke: '#123456', strokeWidth: 5 },
      outlines: { fill: '#abcdef', stroke: '#654321', strokeWidth: 1.5 }
    }
  };
  const res = call('gridRestyle(' + JSON.stringify(JSON.stringify(restyleJob)) + ')');
  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.restyled, true);

  const grid = doc.layers[0];
  const anchorsLayer = grid.layers.find((l) => l.name === 'Anchors');
  const aMarker = anchorsLayer.drawn[0];
  assert.strictEqual(aMarker.width, 16);
  assert.strictEqual(aMarker.height, 16);
  assert.strictEqual(aMarker.strokeWidth, 2);
  assert.strictEqual(aMarker.filled, true);
  assert.strictEqual(aMarker.fillColor.red, 255);
  assert.strictEqual(aMarker.stroked, true);
  assert.strictEqual(aMarker.strokeColor.green, 255);

  const gridlinesLayer = grid.layers.find((l) => l.name === 'Gridlines');
  assert.strictEqual(gridlinesLayer.drawn[0].strokeWidth, 5);
  assert.strictEqual(gridlinesLayer.drawn[0].strokeColor.red, 0x12);

  const outlinesLayer = grid.layers.find((l) => l.name === 'Outlines');
  assert.strictEqual(outlinesLayer.drawn[0].filled, true);
  assert.strictEqual(outlinesLayer.drawn[0].fillColor.red, 0xab);
  assert.strictEqual(outlinesLayer.drawn[0].strokeColor.red, 0x65);
  assert.strictEqual(outlinesLayer.drawn[0].strokeWidth, 1.5);
});

test('gridRestyle returns missing: true and error if no grid layer exists', () => {
  const { call } = load();
  const res = call('gridRestyle(' + JSON.stringify(JSON.stringify({})) + ')');
  assert.strictEqual(res.ok, false);
  assert.strictEqual(res.missing, true);
  assert.strictEqual(res.error, 'Tài liệu này không có layer lưới');
});

test('gridRestyle preserves geometric size, strokeWidth and center when Preview Bounds and Scale Strokes are active', () => {
  const { doc, art, call } = load();
  doc.selection = [sourcePath(art, [[100, 50], [200, 50]], false)];
  call('gridGenerate(' + JSON.stringify(job({ elements: { anchors: true }, style: { anchors: { size: 10, fill: '#378ef0', stroke: '#ffffff', strokeWidth: 4 } } })) + ')');

  const grid = doc.layers[0];
  const aMarker = grid.layers[0].drawn[0];
  // Simulate Illustrator Use Preview Bounds + Scale Strokes & Effects when item.stroked is true:
  // While stroked, width/height include strokeWidth (10 + 4 = 14) and assigning width scales strokeWidth!
  let geoW = 10, geoH = 10;
  Object.defineProperty(aMarker, 'width', {
    get() { return this.stroked ? geoW + (this.strokeWidth || 0) : geoW; },
    set(v) {
      const oldW = this.width;
      const factor = v / oldW;
      geoW *= factor;
      if (this.stroked && this.strokeWidth) this.strokeWidth *= factor;
    }
  });
  Object.defineProperty(aMarker, 'height', {
    get() { return this.stroked ? geoH + (this.strokeWidth || 0) : geoH; },
    set(v) {
      const oldH = this.height;
      const factor = v / oldH;
      geoH *= factor;
    }
  });
  aMarker.position = [100 - 7, 50 + 7]; // preview bounds top-left with 4pt stroke

  const res = call('gridRestyle(' + JSON.stringify(JSON.stringify({
    style: { anchors: { size: 20, fill: '#ff0000', stroke: '#00ff00', strokeWidth: 2 } }
  })) + ')');
  assert.strictEqual(res.ok, true);
  assert.strictEqual(geoW, 20, 'geometric width is exact 20pt without preview-bounds distortion');
  assert.strictEqual(geoH, 20, 'geometric height is exact 20pt');
  assert.strictEqual(aMarker.strokeWidth, 2, 'strokeWidth is not corrupted by resize');
  assert.deepStrictEqual(Array.from(aMarker.position), [90, 60], 'marker remains centered at (100, 50)');
});

test('gridRestyle safely skips non-PathItem entries and unlocks/relocks individual locked items and hidden sublayers', () => {
  const { doc, art, call } = load();
  doc.selection = [sourcePath(art, squarePts, true)];
  call('gridGenerate(' + JSON.stringify(job()) + ')');

  const grid = doc.layers[0];
  const anchorsLayer = grid.layers.find((l) => l.name === 'Anchors');
  anchorsLayer.visible = false;
  anchorsLayer.drawn[0].locked = true;
  anchorsLayer.drawn.push({ typename: 'GroupItem', locked: false });

  const res = call('gridRestyle(' + JSON.stringify(JSON.stringify({
    style: { anchors: { size: 14, fill: '#112233', stroke: 'none', strokeWidth: 1 } }
  })) + ')');
  assert.strictEqual(res.ok, true);
  assert.strictEqual(anchorsLayer.visible, false, 'hidden sublayer restored');
  assert.strictEqual(anchorsLayer.drawn[0].locked, true, 'locked item relocked after restyle');
  assert.strictEqual(anchorsLayer.drawn[0].width, 14);
  assert.strictEqual(anchorsLayer.drawn[0].stroked, false);
});

test('outlines copy bezier direction points, closed flag and fill/stroke style', () => {
  const { doc, art, call } = load();
  const curved = {
    typename: 'PathItem', layer: art, closed: false, geometricBounds: [0, 50, 100, 0],
    pathPoints: [
      { anchor: [0, 0], leftDirection: [-10, 0], rightDirection: [20, 30] },
      { anchor: [100, 50], leftDirection: [80, 50], rightDirection: [110, 50] }
    ]
  };
  doc.selection = [curved];
  const res = call('gridGenerate(' + JSON.stringify(job({
    elements: { anchors: false, handles: false, outlines: true, gridlines: false, circles: false },
    style: { outlines: { fill: '#123456', stroke: '#abcdef', strokeWidth: 2.5 } }
  })) + ')');
  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.counts.outlines, 1);
  const oLayer = doc.layers[0].layers.find((l) => l.name === 'Outlines');
  const oItem = oLayer.drawn[0];
  assert.strictEqual(oItem.closed, false);
  assert.strictEqual(oItem.filled, true);
  assert.strictEqual(oItem.stroked, true);
  assert.strictEqual(oItem.strokeWidth, 2.5);
  assert.deepStrictEqual(oItem.pathPoints[0].rightDirection, [20, 30]);
  assert.deepStrictEqual(oItem.pathPoints[1].leftDirection, [80, 50]);
});

test('gridlines clamp negative margin to 0, default blank margin to 20, and guard out-of-range active artboard index', () => {
  const { doc, art, call } = load();
  doc.artboards = [{ artboardRect: [-200, 300, 400, -300] }];
  doc.artboards.getActiveArtboardIndex = () => 99; // out of range
  doc.selection = [sourcePath(art, squarePts, true)];
  const res = call('gridGenerate(' + JSON.stringify(job({
    elements: { gridlines: true },
    gridlines: { sensitivity: 50, margin: -15, scope: 'artboard' }
  })) + ')');
  assert.strictEqual(res.ok, true);
  const glLayer = doc.layers[0].layers.find((l) => l.name === 'Gridlines');
  const hLine = glLayer.drawn.find((l) => Math.abs(l.entire[0][1]) < 1e-4 && Math.abs(l.entire[1][1]) < 1e-4);
  const xs = [hLine.entire[0][0], hLine.entire[1][0]].sort((a, b) => a - b);
  assert.deepStrictEqual(xs, [-200, 400], 'negative margin clamps to 0 and out-of-range artboard index falls back to 0');
});

test('gridlines with scope artboard clips to active artboard rect', () => {
  const { doc, art, call } = load();
  doc.artboards = [{ artboardRect: [-200, 300, 400, -300] }];
  doc.artboards.getActiveArtboardIndex = () => 0;
  doc.selection = [sourcePath(art, squarePts, true)];
  const res = call('gridGenerate(' + JSON.stringify(job({ elements: { gridlines: true }, gridlines: { sensitivity: 50, margin: 15, scope: 'artboard' } })) + ')');
  assert.strictEqual(res.ok, true);
  const glLayer = doc.layers[0].layers.find((l) => l.name === 'Gridlines');
  const lines = glLayer.drawn;
  const hLine = lines.find((l) => Math.abs(l.entire[0][1]) < 1e-4 && Math.abs(l.entire[1][1]) < 1e-4);
  assert.ok(hLine, 'horizontal line at y=0 found');
  const xs = [hLine.entire[0][0], hLine.entire[1][0]].sort((a, b) => a - b);
  assert.deepStrictEqual(xs, [-215, 415]);
});

test('gridRestyle restyles a locked grid layer and keeps it locked', () => {
  const { doc, art, call } = load();
  const sq = sourcePath(art, squarePts, true);
  doc.selection = [sq];
  call('gridGenerate(' + JSON.stringify(job()) + ')');

  const grid = doc.layers[0];
  grid.locked = true;

  const restyleJob = {
    style: {
      anchors: { size: 12, fill: '#00ffff', stroke: 'none', strokeWidth: 1 }
    }
  };
  const res = call('gridRestyle(' + JSON.stringify(JSON.stringify(restyleJob)) + ')');
  assert.strictEqual(res.ok, true);
  assert.strictEqual(grid.locked, true);
  assert.strictEqual(grid.visible, true);
});

test('gridlines with scope artboard handles inverted artboard rect', () => {
  const { doc, art, call } = load();
  doc.artboards = [{ artboardRect: [400, -300, -200, 300] }]; // inverted [right, bottom, left, top]
  doc.artboards.getActiveArtboardIndex = () => 0;
  doc.selection = [sourcePath(art, squarePts, true)];
  const res = call('gridGenerate(' + JSON.stringify(job({ elements: { gridlines: true }, gridlines: { sensitivity: 50, margin: 15, scope: 'artboard' } })) + ')');
  assert.strictEqual(res.ok, true);
  const glLayer = doc.layers[0].layers.find((l) => l.name === 'Gridlines');
  const lines = glLayer.drawn;
  const hLine = lines.find((l) => Math.abs(l.entire[0][1]) < 1e-4 && Math.abs(l.entire[1][1]) < 1e-4);
  assert.ok(hLine, 'horizontal line at y=0 found');
  const xs = [hLine.entire[0][0], hLine.entire[1][0]].sort((a, b) => a - b);
  assert.deepStrictEqual(xs, [-215, 415]);
});

test('gridRestyle updates handles and circles on curved paths and preserves marker center', () => {
  const { doc, art, call } = load();
  const K = 0.5522847498;
  const curvedPath = {
    typename: 'PathItem', layer: art, closed: true, geometricBounds: [-50, 50, 50, -50],
    pathPoints: [[50, 0], [0, 50], [-50, 0], [0, -50]].map(([x, y]) => ({
      anchor: [x, y], leftDirection: [x - y * K, y + x * K], rightDirection: [x + y * K, y - x * K]
    }))
  };
  doc.selection = [curvedPath];
  call('gridGenerate(' + JSON.stringify(job({ elements: { handles: true, circles: true }, style: { handles: { size: 10, fill: '#112233' } } })) + ')');

  const grid = doc.layers[0];
  const handlesLayer = grid.layers.find((l) => l.name === 'Handles');
  const circlesLayer = grid.layers.find((l) => l.name === 'Circles');
  assert.ok(handlesLayer && handlesLayer.drawn.length > 0, 'handles drawn');
  assert.ok(circlesLayer && circlesLayer.drawn.length > 0, 'circles drawn');

  // Find a handle marker (ellipse with width/height)
  const hMarker = handlesLayer.drawn.find((item) => item.kind === 'ellipse');
  const initialCx = hMarker.position[0] + hMarker.width / 2;
  const initialCy = hMarker.position[1] - hMarker.height / 2;

  // Restyle handles and circles
  const restyleJob = {
    style: {
      handles: { size: 24, fill: '#aabbcc', stroke: '#ffffff', strokeWidth: 3 },
      circles: { stroke: '#123123', strokeWidth: 7 }
    }
  };
  const res = call('gridRestyle(' + JSON.stringify(JSON.stringify(restyleJob)) + ')');
  assert.strictEqual(res.ok, true);

  // Verify handle marker resized and center preserved
  assert.strictEqual(hMarker.width, 24);
  assert.strictEqual(hMarker.height, 24);
  const newCx = hMarker.position[0] + hMarker.width / 2;
  const newCy = hMarker.position[1] - hMarker.height / 2;
  assert.ok(Math.abs(newCx - initialCx) < 1e-4, 'center x preserved');
  assert.ok(Math.abs(newCy - initialCy) < 1e-4, 'center y preserved');

  // Verify circle style
  const circleItem = circlesLayer.drawn[0];
  assert.strictEqual(circleItem.strokeWidth, 7);
});
