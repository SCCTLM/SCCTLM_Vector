// Run: node --test tests/align-panel.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

test('index.html: Align card is at the bottom of Daily tab after Offset Lab with all 15+3 buttons', () => {
  const html = fs.readFileSync(path.join(__dirname, '../src/app/index.html'), 'utf8');

  const offsetIdx = html.indexOf('class="offset-lab-card"');
  const alignIdx = html.indexOf('class="align-card"');
  const artboardsIdx = html.indexOf('class="artboards-shared"');

  assert.ok(offsetIdx > 0, 'offset-lab-card must exist');
  assert.ok(alignIdx > offsetIdx, 'align-card must appear after offset-lab-card');
  assert.ok(alignIdx < artboardsIdx, 'align-card must appear before artboards-shared');
  assert.ok(html.includes('data-pane="daily" class="align-card"'), 'align-card must belong to Daily tab');
  assert.ok(html.includes('<script src="align-panel.js"></script>'), 'align-panel.js script must be included');

  // Verify exact order of the 7 Align Objects buttons with center-both in the middle
  const alignOps = ['left', 'h-center', 'right', 'center-both', 'top', 'v-center', 'bottom'];
  let prev = -1;
  for (const op of alignOps) {
    const pos = html.indexOf(`data-align-op="${op}"`);
    assert.ok(pos > prev, `data-align-op="${op}" must appear in order`);
    prev = pos;
  }

  // Verify all 6 Distribute Objects + 2 Distribute Spacing + 3 Align To buttons
  for (const op of ['v-dist-top', 'v-dist-center', 'v-dist-bottom', 'h-dist-left', 'h-dist-center', 'h-dist-right', 'v-space', 'h-space']) {
    assert.ok(html.includes(`data-align-op="${op}"`), `missing data-align-op="${op}"`);
  }
  for (const mode of ['artboard', 'selection', 'key']) {
    assert.ok(html.includes(`data-align-to="${mode}"`), `missing data-align-to="${mode}"`);
  }
});

test('AlignPanel: wires buttons, persists alignTo, and calls Bridge.alignObjects', async () => {
  const storage = {};
  const calls = [];
  const notices = [];

  function makeBtn(dataset) {
    const classes = new Set();
    const attrs = {};
    return {
      dataset,
      disabled: false,
      onclick: null,
      classList: {
        toggle(c, on) { if (on) classes.add(c); else classes.delete(c); },
        contains(c) { return classes.has(c); }
      },
      setAttribute(k, v) { attrs[k] = v; },
      getAttribute(k) { return attrs[k]; }
    };
  }

  const centerBtn = makeBtn({ alignOp: 'center-both' });
  const hSpaceBtn = makeBtn({ alignOp: 'h-space' });
  const toArtboard = makeBtn({ alignTo: 'artboard' });
  const toSelection = makeBtn({ alignTo: 'selection' });
  const toKey = makeBtn({ alignTo: 'key' });
  const spacingInput = { value: '', placeholder: '', oninput: null };
  const statusEl = { textContent: '' };

  const sandbox = {
    localStorage: {
      getItem: (k) => (k in storage ? storage[k] : null),
      setItem: (k, v) => { storage[k] = String(v); }
    },
    Notice: { show: (m) => notices.push(m) },
    Bridge: {
      alignObjects(job) {
        calls.push(job);
        if (job.op === 'fail-case') return Promise.resolve({ ok: false, error: 'Chọn ít nhất 2 đối tượng' });
        return Promise.resolve({ ok: true, count: 2, moved: 2 });
      }
    },
    document: {
      readyState: 'complete',
      getElementById(id) {
        if (id === 'align-spacing') return spacingInput;
        if (id === 'status') return statusEl;
        return null;
      },
      querySelectorAll(sel) {
        if (sel === '.align-btn') return [centerBtn, hSpaceBtn];
        if (sel === '.align-to-btn') return [toArtboard, toSelection, toKey];
        return [];
      },
      addEventListener() {}
    }
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../src/app/align-panel.js'), 'utf8'), sandbox);

  // Default is selection
  assert.strictEqual(sandbox.AlignPanel.state.alignTo, 'selection');
  assert.ok(toSelection.classList.contains('on'));
  assert.strictEqual(spacingInput.placeholder, 'Auto');

  // Switch to key object
  toKey.onclick();
  assert.strictEqual(sandbox.AlignPanel.state.alignTo, 'key');
  assert.strictEqual(storage['scctlm.alignTo'], 'key');
  assert.strictEqual(spacingInput.placeholder, '0');

  // Click center-both
  await sandbox.AlignPanel.runAlign('center-both');
  assert.deepStrictEqual({ ...calls[0] }, { op: 'center-both', alignTo: 'key' });

  // Enter spacing and run h-space
  spacingInput.value = '12.5';
  await sandbox.AlignPanel.runAlign('h-space');
  assert.deepStrictEqual({ ...calls[1] }, { op: 'h-space', alignTo: 'key', spacingPt: 12.5 });
  assert.strictEqual(notices.length, 0);

  // Error from Illustrator reports via global.Notice.show
  await sandbox.AlignPanel.runAlign('fail-case');
  assert.deepStrictEqual(notices, ['Chọn ít nhất 2 đối tượng']);
});
