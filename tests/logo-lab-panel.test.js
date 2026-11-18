// Run: node --test tests/
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// No document in the sandbox, so only the pure helpers are exposed.
function loadLab() {
  const sandbox = {};
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../src/app/logo-lab-panel.js'), 'utf8'), sandbox);
  return sandbox.LogoLab;
}

const settings = () => ({
  elements: { anchors: true, handles: false, outlines: true, gridlines: true, circles: false },
  style: { anchors: { size: 10 } },
  gridlines: { sensitivity: 50, margin: 20 },
  circles: { complexity: 30, mode: 'all', n: 2 }
});

test('the job never draws outlines and follows the four toggles', () => {
  const job = loadLab().buildJob(settings());
  assert.deepStrictEqual(JSON.parse(JSON.stringify(job.elements)),
    { outlines: false, anchors: true, handles: false, circles: false, gridlines: true });
  assert.strictEqual(job.style.anchors.size, 10);
  assert.strictEqual(job.gridlines.margin, 20);
});

test('the preview sample has anchors, handles, four gridlines and one circle', () => {
  const m = loadLab().previewModel(settings());
  assert.strictEqual(m.anchors.length, 5);
  assert.ok(m.handleDots.length > 0 && m.handleLines.length > 0);
  assert.strictEqual(m.lines.length, 4);
  assert.ok(m.d.split(' Z').length === 3);
  assert.ok(m.circle.r > 0);
  assert.ok(/^M .* Z$/.test(m.d));
});
