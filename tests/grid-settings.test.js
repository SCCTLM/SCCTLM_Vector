// Run: node --test tests/
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');

function loadSettings(appData) {
  const sandbox = { require, process: { platform: 'win32', env: { APPDATA: appData } } };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  for (const f of ['presets.js', 'grid-settings.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../src/app', f), 'utf8'), sandbox);
  }
  return sandbox.GridSettings;
}

const plain = (v) => JSON.parse(JSON.stringify(v));

test('missing file gives the defaults', () => {
  const g = loadSettings(fs.mkdtempSync(path.join(os.tmpdir(), 'grid-settings-')));
  assert.deepStrictEqual(plain(g.load()), plain(g.DEFAULTS));
});

test('bad values fall back or are clamped, good ones are kept', () => {
  const g = loadSettings(os.tmpdir());
  const s = plain(g.normalize({
    elements: { anchors: false, handles: 'yes' },
    style: { anchors: { size: 500, fill: 'red', stroke: '#ABCDEF' }, outlines: { fill: 'none' } },
    gridlines: { sensitivity: 140, margin: -5 },
    circles: { complexity: '70', mode: 'random', n: 0 }
  }));
  assert.strictEqual(s.elements.anchors, false);
  assert.strictEqual(s.elements.handles, g.DEFAULTS.elements.handles);
  assert.strictEqual(s.style.anchors.size, 100);
  assert.strictEqual(s.style.anchors.fill, g.DEFAULTS.style.anchors.fill);
  assert.strictEqual(s.style.anchors.stroke, '#abcdef');
  assert.strictEqual(s.style.outlines.fill, 'none');
  assert.deepStrictEqual(s.gridlines, { sensitivity: 100, margin: 0 });
  assert.deepStrictEqual(s.circles, { complexity: 70, mode: 'all', n: 1 });
  assert.deepStrictEqual(plain(g.normalize('garbage')), plain(g.DEFAULTS));
});

test('save then load round-trips through the user data dir', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'grid-settings-'));
  const g = loadSettings(dir);
  const s = plain(g.DEFAULTS);
  s.elements.circles = false;
  s.circles.mode = 'longest';
  g.save(s);
  assert.deepStrictEqual(plain(loadSettings(dir).load()), s);
  assert.ok(fs.existsSync(path.join(dir, 'vector-batch-export', 'grid-settings.json')));
});

test('an emptied number field keeps the previous value instead of saving the minimum', () => {
  const g = loadSettings(os.tmpdir());
  const prev = plain(g.DEFAULTS);
  prev.style.anchors.size = 7;
  prev.gridlines.margin = 33;
  prev.circles.n = 5;
  const s = g.normalize(prev);
  s.style.anchors.size = '';
  s.gridlines.margin = '';
  s.circles.n = '  ';
  const out = plain(g.normalize(s, prev));
  assert.strictEqual(out.style.anchors.size, 7);
  assert.strictEqual(out.gridlines.margin, 33);
  assert.strictEqual(out.circles.n, 5);
});
