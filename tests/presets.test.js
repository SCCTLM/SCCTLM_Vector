// Run: node --test tests/
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');

// Load presets.js with `window` pointing at a sandbox and APPDATA redirected to a temp dir.
function loadPresets(appData) {
  const sandbox = { require, process: { platform: 'win32', env: { APPDATA: appData } } };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../src/app/presets.js'), 'utf8'), sandbox);
  return sandbox.Presets;
}

const settings = { formats: ['png', 'svg'], scales: [1, 2], template: '{doc}_{artboard}', outputDir: 'C:/out' };

test('save, list, rename, remove round-trip through the user data file', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vector-presets-'));
  const p = loadPresets(dir);
  assert.strictEqual(JSON.stringify(p.list()), "[]");
  p.saveAs('Web', settings);
  assert.strictEqual(p.list().length, 1);
  // A fresh load (simulating an app restart) still sees the preset.
  assert.strictEqual(JSON.stringify(loadPresets(dir).get("Web")), JSON.stringify(settings));
  p.rename('Web', 'Web2');
  assert.strictEqual(p.get('Web'), null);
  assert.ok(p.get('Web2'));
  p.remove('Web2');
  assert.strictEqual(JSON.stringify(p.list()), "[]");
  const saved = JSON.parse(fs.readFileSync(path.join(dir, 'vector-batch-export', 'presets.json'), 'utf8'));
  assert.strictEqual(saved.version, p.SCHEMA_VERSION);
});

test('saving an existing name overwrites; renaming onto another name is rejected', () => {
  const p = loadPresets(fs.mkdtempSync(path.join(os.tmpdir(), 'vector-presets-')));
  p.saveAs('A', settings);
  p.saveAs('A', Object.assign({}, settings, { scales: [3] }));
  assert.strictEqual(p.list().length, 1);
  assert.deepStrictEqual(Array.from(p.get('A').scales), [3]);
  p.saveAs('B', settings);
  assert.throws(() => p.rename('A', 'B'), /already exists/);
});

test('corrupt or unknown-shape files fall back to an empty store', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vector-presets-'));
  fs.mkdirSync(path.join(dir, 'vector-batch-export'));
  fs.writeFileSync(path.join(dir, 'vector-batch-export', 'presets.json'), '{not json');
  assert.strictEqual(JSON.stringify(loadPresets(dir).list()), "[]");
});

test('migrate drops invalid entries and normalises settings', () => {
  const p = loadPresets(fs.mkdtempSync(path.join(os.tmpdir(), 'vector-presets-')));
  const out = p.migrate({ presets: [{ name: 'ok', settings: { formats: ['gif'], scales: [-1] } }, { name: '' }, null] });
  assert.strictEqual(out.presets.length, 1);
  assert.deepStrictEqual(Array.from(out.presets[0].settings.formats), ['png']);
  assert.deepStrictEqual(Array.from(out.presets[0].settings.scales), [1]);
});
