// Run: node --test tests/
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

test('Daily tab: CMYK color picker section is removed and Logo Lab precedes Offset Lab', () => {
  const htmlPath = path.join(__dirname, '../src/app/index.html');
  const html = fs.readFileSync(htmlPath, 'utf8');

  // Verify open-picker-daily is completely gone
  assert.strictEqual(html.includes('id="open-picker-daily"'), false, 'open-picker-daily should be removed from index.html');
  assert.strictEqual(html.includes('Màu sắc CMYK'), false, 'CMYK section title should be removed from index.html');

  // Verify open-picker-artboard in Artboard tab is preserved
  assert.strictEqual(html.includes('id="open-picker-artboard"'), true, 'open-picker-artboard must remain in index.html');
  assert.strictEqual(html.includes('id="open-picker"'), true, 'header open-picker must remain in index.html');

  // Verify order in Daily tab: logo-lab-card comes before offset-lab-card
  const logoLabIndex = html.indexOf('class="logo-lab-card"');
  const offsetLabIndex = html.indexOf('class="offset-lab-card"');
  assert.ok(logoLabIndex > 0, 'logo-lab-card must exist');
  assert.ok(offsetLabIndex > 0, 'offset-lab-card must exist');
  assert.ok(logoLabIndex < offsetLabIndex, 'logo-lab-card must appear before offset-lab-card');
});

test('color-picker-launcher: initializes safely without open-picker-daily and binds header & artboard buttons', () => {
  const code = fs.readFileSync(path.join(__dirname, '../src/app/color-picker-launcher.js'), 'utf8');

  const elements = {
    'open-picker': { disabled: false, onclick: null },
    'open-picker-artboard': { disabled: false, onclick: null }
  };

  const dispatchedEvents = [];
  const openCalls = [];

  const sandbox = {
    document: {
      getElementById(id) {
        return elements[id] || null;
      }
    },
    Bridge: {
      cs: {
        requestOpenExtension(extId, params) {
          openCalls.push({ extId, params });
        },
        dispatchEvent(ev) {
          dispatchedEvents.push(ev);
        }
      }
    },
    CSEvent: function (type, scope) {
      this.type = type;
      this.scope = scope;
      this.data = null;
    }
  };

  vm.createContext(sandbox);
  assert.doesNotThrow(() => {
    vm.runInContext(code, sandbox);
  });

  assert.strictEqual(typeof elements['open-picker'].onclick, 'function');
  assert.strictEqual(typeof elements['open-picker-artboard'].onclick, 'function');

  // Trigger click on artboard picker
  elements['open-picker-artboard'].onclick();
  assert.strictEqual(openCalls.length, 1);
  assert.strictEqual(openCalls[0].extId, 'vn.scctlm.vector.picker');
  assert.strictEqual(dispatchedEvents.length, 1);
  assert.strictEqual(dispatchedEvents[0].type, 'vn.scctlm.picker.refresh');

  // Trigger click on header picker
  elements['open-picker'].onclick();
  assert.strictEqual(openCalls.length, 2);
  assert.strictEqual(dispatchedEvents.length, 2);
});

test('color-picker-launcher: disables buttons cleanly when Bridge.cs is absent', () => {
  const code = fs.readFileSync(path.join(__dirname, '../src/app/color-picker-launcher.js'), 'utf8');

  const elements = {
    'open-picker': { disabled: false, onclick: null },
    'open-picker-artboard': { disabled: false, onclick: null }
  };

  const sandbox = {
    document: {
      getElementById(id) {
        return elements[id] || null;
      }
    },
    Bridge: { cs: null },
    CSEvent: function () {}
  };

  vm.createContext(sandbox);
  assert.doesNotThrow(() => {
    vm.runInContext(code, sandbox);
  });

  assert.strictEqual(elements['open-picker'].disabled, true);
  assert.strictEqual(elements['open-picker-artboard'].disabled, true);
  assert.strictEqual(elements['open-picker'].onclick, null);
  assert.strictEqual(elements['open-picker-artboard'].onclick, null);
});
