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
    const item = Object.assign({ kind, layer, pathPoints: [] }, extra);
    item.setEntirePath = (pts) => { item.entire = pts; item.pathPoints = pts.map((a) => ({ anchor: a })); };
    layer.drawn.push(item);
    return item;
  };
  layer.pathItems = {
    add: () => draw('path'),
    ellipse: (top, left, w, h) => draw('ellipse', { top, left, w, h }),
    rectangle: (top, left, w, h) => draw('rect', { top, left, w, h })
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
