// Run: node --test tests/
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// The app page in CEP comes from a file:// URL; the loader may hand it a transient query.
function load(href) {
  const sandbox = {
    location: {
      href: href,
      replaced: null,
      replace(url) { this.replaced = url; }
    }
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../src/app/reload.js'), 'utf8'), sandbox);
  return sandbox;
}

test('reloadUrl keeps the page path and replaces any old query with a fresh stamp', () => {
  const s = load('file:///C:/Users/me/AppData/Roaming/Adobe/CEP/extensions/vn.scctlm.vector/app/index.html?rolledback=1');
  assert.strictEqual(
    s.PanelReload.reloadUrl(s.location.href, 1234),
    'file:///C:/Users/me/AppData/Roaming/Adobe/CEP/extensions/vn.scctlm.vector/app/index.html?r=1234'
  );
});

test('reload navigates the page to a distinct stamped URL each time', () => {
  const s = load('file:///Users/me/CEP/vn.scctlm.vector/app/index.html');
  s.PanelReload.reload(1);
  const first = s.location.replaced;
  s.PanelReload.reload(2);
  assert.strictEqual(first, 'file:///Users/me/CEP/vn.scctlm.vector/app/index.html?r=1');
  assert.notStrictEqual(s.location.replaced, first);
});
