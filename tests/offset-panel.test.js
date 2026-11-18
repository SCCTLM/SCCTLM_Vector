// Run: node --test tests/
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadPanel() {
  const elements = {};
  function makeElem(id) {
    const el = {
      id,
      value: '',
      textContent: '',
      style: {},
      dataset: {},
      classList: {
        classes: new Set(),
        toggle(cls, on) {
          if (on === undefined) on = !this.classes.has(cls);
          if (on) this.classes.add(cls); else this.classes.delete(cls);
        },
        contains(cls) { return this.classes.has(cls); }
      },
      setAttribute(k, v) { el[k] = v; },
      getAttribute(k) { return el[k]; },
      removeAttribute(k) { delete el[k]; },
      click() { if (el.onclick) el.onclick(); }
    };
    return el;
  }

  const ids = [
    'offset-width-slider',
    'offset-width-input',
    'offset-width-val',
    'offset-miter-input',
    'offset-color-btn',
    'offset-color-native',
    'offset-hex-input',
    'offset-eyedropper-btn',
    'offset-opt-behind',
    'offset-opt-keep',
    'offset-opt-color',
    'offset-apply',
    'offset-preview-outline',
    'status'
  ];
  ids.forEach(id => { elements[id] = makeElem(id); });

  const joinRound = makeElem('offset-join-round');
  joinRound.dataset.join = 'round';
  const joinMiter = makeElem('offset-join-miter');
  joinMiter.dataset.join = 'miter';
  const joinBevel = makeElem('offset-join-bevel');
  joinBevel.dataset.join = 'bevel';

  const modeSticker = makeElem('offset-mode-sticker');
  modeSticker.dataset.mode = 'sticker';
  const modeStandard = makeElem('offset-mode-standard');
  modeStandard.dataset.mode = 'standard';

  const swatch1 = makeElem('swatch-1');
  swatch1.dataset.color = '#4295D1';

  const sandbox = {
    document: {
      readyState: 'complete',
      getElementById(id) { return elements[id] || null; },
      querySelectorAll(selector) {
        if (selector === '.offset-join-btn') return [joinRound, joinMiter, joinBevel];
        if (selector === '.offset-mode-btn') return [modeSticker, modeStandard];
        if (selector === '.offset-swatch') return [swatch1];
        return [];
      },
      addEventListener() {}
    },
    Bridge: {
      lastJob: null,
      offsetCreate(job) {
        this.lastJob = job;
        return Promise.resolve({ ok: true, message: 'Đã tạo viền' });
      }
    }
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);

  const code = fs.readFileSync(path.join(__dirname, '../src/app/offset-panel.js'), 'utf8');
  vm.runInContext(code, sandbox);

  return { sandbox, elements, joinRound, joinMiter, joinBevel, swatch1 };
}

test('OffsetPanel initializes with correct defaults from mockup', () => {
  const { sandbox, elements, joinRound } = loadPanel();
  const state = sandbox.OffsetPanel.state;
  assert.strictEqual(state.offset, 20);
  assert.strictEqual(state.join, 'round');
  assert.strictEqual(state.miterLimit, 4);
  assert.strictEqual(state.color, '#1FC8FF');
  assert.deepStrictEqual(Array.from(state.rgb), [31, 200, 255]);
  assert.strictEqual(elements['offset-width-val'].textContent, '20px');
  assert.strictEqual(elements['offset-hex-input'].value, '#1FC8FF');
  assert.ok(joinRound.classList.contains('on'));
});

test('OffsetPanel color conversions work for 3-digit and 6-digit hex', () => {
  const { sandbox } = loadPanel();
  assert.deepStrictEqual(Array.from(sandbox.OffsetPanel.hexToRgb('#1FC8FF')), [31, 200, 255]);
  assert.deepStrictEqual(Array.from(sandbox.OffsetPanel.hexToRgb('#FFF')), [255, 255, 255]);
  assert.strictEqual(sandbox.OffsetPanel.rgbToHex(31, 200, 255), '#1FC8FF');
});

test('OffsetPanel setColor updates color, rgb and preview outline attributes', () => {
  const { sandbox, elements } = loadPanel();
  sandbox.OffsetPanel.setColor('#5EC093');
  assert.strictEqual(sandbox.OffsetPanel.state.color, '#5EC093');
  assert.strictEqual(elements['offset-hex-input'].value, '#5EC093');
  assert.strictEqual(elements['offset-color-btn'].style.backgroundColor, '#5EC093');
  assert.strictEqual(elements['offset-preview-outline']['stroke'], '#5EC093');
});

test('OffsetPanel setJoin updates active class and preview join style', () => {
  const { sandbox, elements, joinRound, joinMiter } = loadPanel();
  sandbox.OffsetPanel.setJoin('miter');
  assert.strictEqual(sandbox.OffsetPanel.state.join, 'miter');
  assert.strictEqual(joinRound.classList.contains('on'), false);
  assert.strictEqual(joinMiter.classList.contains('on'), true);
  assert.strictEqual(elements['offset-preview-outline']['stroke-linejoin'], 'miter');
});

test('OffsetPanel apply triggers Bridge.offsetCreate with current state', async () => {
  const { sandbox, elements } = loadPanel();
  sandbox.OffsetPanel.setOffset(25);
  sandbox.OffsetPanel.setJoin('bevel');
  sandbox.OffsetPanel.setColor('#F15A41');

  elements['offset-apply'].click();
  await new Promise(r => setImmediate(r));

  assert.ok(sandbox.Bridge.lastJob);
  assert.strictEqual(sandbox.Bridge.lastJob.offsetPt, 25);
  assert.strictEqual(sandbox.Bridge.lastJob.join, 'bevel');
  assert.strictEqual(sandbox.Bridge.lastJob.color.hex, '#F15A41');
});

test('OffsetPanel setMode switches between sticker and standard offset', () => {
  const { sandbox, elements } = loadPanel();
  assert.strictEqual(elements['offset-apply'].textContent, 'Tạo viền');

  sandbox.OffsetPanel.setMode('standard');
  assert.strictEqual(sandbox.OffsetPanel.state.mode, 'standard');
  assert.strictEqual(elements['offset-apply'].textContent, 'Offset Path');

  sandbox.OffsetPanel.setOffset(-8);
  assert.strictEqual(sandbox.OffsetPanel.state.offset, -8);
  assert.strictEqual(elements['offset-preview-outline']['fill'], 'none');
  assert.strictEqual(elements['offset-preview-outline']['clip-path'], 'url(#offset-preview-clip)');
  assert.strictEqual(elements['offset-preview-outline']['stroke-width'], 16);
});

test('OffsetPanel enterEditMode switches to edit state and updates UI and apply button', async () => {
  const { sandbox, elements } = loadPanel();
  let updatedJob = null;
  sandbox.Bridge.offsetUpdate = function(job) {
    updatedJob = job;
    return Promise.resolve({ ok: true, message: 'Đã cập nhật' });
  };

  sandbox.OffsetPanel.enterEditMode({
    offsetPt: 35,
    join: 1, // bevel
    miterLimit: 6,
    mode: 'sticker',
    colorHex: '#FDB716'
  }, { rgb: [253, 183, 22] });

  assert.strictEqual(sandbox.OffsetPanel.state.editing, true);
  assert.strictEqual(sandbox.OffsetPanel.state.offset, 35);
  assert.strictEqual(sandbox.OffsetPanel.state.join, 'bevel');
  assert.strictEqual(sandbox.OffsetPanel.state.color, '#FDB716');
  assert.strictEqual(elements['offset-apply'].textContent, 'Cập nhật viền');

  // Triggering apply calls Bridge.offsetUpdate instead of offsetCreate
  elements['offset-apply'].click();
  await new Promise(r => setImmediate(r));

  assert.ok(updatedJob);
  assert.strictEqual(updatedJob.offsetPt, 35);
  assert.strictEqual(updatedJob.join, 'bevel');
  assert.strictEqual(updatedJob.color.hex, '#FDB716');

  // Exiting edit mode restores normal state
  sandbox.OffsetPanel.exitEditMode();
  assert.strictEqual(sandbox.OffsetPanel.state.editing, false);
  assert.strictEqual(elements['offset-apply'].textContent, 'Tạo viền');
});

test('OffsetPanel inspectSelection updates panel values to match the selected object', async () => {
  const { sandbox, elements, joinMiter } = loadPanel();

  // Mock inspect returning an object with 42px width, miter join, black color
  sandbox.Bridge.offsetInspect = function() {
    return Promise.resolve({
      ok: true,
      hasSelection: true,
      selectionKey: 'item_lorem_ipsum',
      shape: { ok: true, d: 'M0 0 L10 10 Z', x: 0, y: 0, w: 10, h: 10 },
      offsetInfo: {
        found: true,
        params: {
          offsetPt: 42,
          join: 'miter',
          miterLimit: 5,
          mode: 'sticker',
          colorHex: '#000000'
        },
        currentColor: { rgb: [0, 0, 0], hex: '#000000' }
      }
    });
  };

  sandbox.OffsetPanel.inspectSelection();
  await new Promise(r => setImmediate(r));

  assert.strictEqual(sandbox.OffsetPanel.state.offset, 42);
  assert.strictEqual(sandbox.OffsetPanel.state.join, 'miter');
  assert.strictEqual(sandbox.OffsetPanel.state.color, '#000000');
  assert.strictEqual(elements['offset-width-slider'].value, 42);
  assert.strictEqual(elements['offset-width-input'].value, 42);
  assert.strictEqual(elements['offset-hex-input'].value, '#000000');
  assert.strictEqual(joinMiter.classList.contains('on'), true);
  assert.strictEqual(elements['offset-apply'].textContent, 'Cập nhật viền');
});
