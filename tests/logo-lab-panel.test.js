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

test('the job follows all five element toggles including outlines', () => {
  const job = loadLab().buildJob(settings());
  assert.deepStrictEqual(JSON.parse(JSON.stringify(job.elements)),
    { anchors: true, handles: false, outlines: true, circles: false, gridlines: true });
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

function loadInteractiveLab(initialSettings) {
  const elements = {};
  const toggles = [];
  let savedCount = 0;
  let lastSaved = null;

  function makeElem(id, extra) {
    const el = Object.assign({
      id,
      value: '',
      min: '0',
      max: '100',
      textContent: '',
      title: '',
      hidden: false,
      disabled: false,
      blurred: false,
      firstChild: null,
      children: [],
      options: [],
      style: {
        props: {},
        setProperty(k, v) { this.props[k] = v; }
      },
      dataset: {},
      classList: {
        classes: new Set(),
        toggle(cls, on) {
          if (on === undefined) on = !this.classes.has(cls);
          if (on) this.classes.add(cls); else this.classes.delete(cls);
        },
        contains(cls) { return this.classes.has(cls); }
      },
      attrs: {},
      setAttribute(k, v) { this.attrs[k] = String(v); },
      getAttribute(k) { return this.attrs[k]; },
      appendChild(child) {
        this.children.push(child);
        if (child.tag === 'option') this.options.push(child);
        this.firstChild = this.children[0] || null;
        return child;
      },
      removeChild(child) {
        const idx = this.children.indexOf(child);
        if (idx >= 0) this.children.splice(idx, 1);
        this.firstChild = this.children[0] || null;
      },
      blur() { this.blurred = true; }
    }, extra);
    elements[id] = el;
    return el;
  }

  [
    'll-generate', 'll-generate-all', 'll-restyle', 'll-clear', 'll-expand', 'll-more',
    'll-confirm', 'll-confirm-text', 'll-confirm-ok', 'll-confirm-cancel', 'status',
    'll-pv-shape', 'll-pv-outlines', 'll-pv-gridlines', 'll-pv-circles', 'll-pv-handles', 'll-pv-anchors',
    'll-fill', 'll-fill-none', 'll-fill-chip', 'll-stroke', 'll-stroke-none', 'll-stroke-chip', 'll-swap',
    'll-stroke-width', 'll-anchor-size', 'll-anchor-size-val', 'll-handle-size', 'll-handle-size-val',
    'll-circle-stroke', 'll-circle-stroke-chip', 'll-circle-width', 'll-circle-mode', 'll-circle-n-wrap', 'll-circle-n',
    'll-circle-complexity', 'll-circle-complexity-val',
    'll-grid-stroke', 'll-grid-stroke-chip', 'll-grid-width', 'll-grid-sensitivity', 'll-grid-scope', 'll-grid-margin',
    'll-outline-stroke', 'll-outline-stroke-none', 'll-outline-stroke-chip', 'll-outline-width',
    'll-outline-fill', 'll-outline-fill-none', 'll-outline-fill-chip'
  ].forEach((id) => makeElem(id));

  elements['ll-more'].hidden = true;
  elements['ll-confirm'].hidden = true;
  elements['ll-anchor-size'].min = '1';
  elements['ll-anchor-size'].max = '40';
  elements['ll-handle-size'].min = '1';
  elements['ll-handle-size'].max = '40';
  elements['ll-grid-sensitivity'].options = [{ value: '0' }, { value: '50' }, { value: '100' }];

  ['anchors', 'handles', 'outlines', 'circles', 'gridlines'].forEach((k) => {
    const btn = makeElem('toggle-' + k);
    btn.dataset.el = k;
    toggles.push(btn);
  });

  const sandbox = {
    require,
    process: { platform: 'win32', env: { APPDATA: '' } },
    Presets: { dataDir: () => '' },
    document: {
      activeElement: null,
      getElementById(id) { return elements[id] || null; },
      querySelectorAll(sel) { return sel === '.ll-toggle' ? toggles : []; },
      createElement(tag) { return { tag, value: '', textContent: '' }; },
      createElementNS(ns, tag) {
        return {
          tag,
          attrs: {},
          setAttribute(k, v) { this.attrs[k] = String(v); }
        };
      }
    },
    Bridge: {
      inspectResult: { ok: true, paths: 1, anchors: 10, circles: 0, skipped: {} },
      generateResult: { ok: true, counts: { anchors: 10, handles: 4, outlines: 1, gridlines: 2, circles: 1 }, skipped: {} },
      restyleResult: { ok: true, restyled: true },
      lastInspectJob: null,
      lastGenerateJob: null,
      lastRestyleJob: null,
      gridInspect(job) { this.lastInspectJob = job; return Promise.resolve(this.inspectResult); },
      gridGenerate(job) { this.lastGenerateJob = job; return Promise.resolve(this.generateResult); },
      gridRestyle(job) { this.lastRestyleJob = job; return Promise.resolve(this.restyleResult); },
      gridClear() { return Promise.resolve({ ok: true, removed: true }); }
    }
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../src/app/grid-settings.js'), 'utf8'), sandbox);

  let current = sandbox.GridSettings.normalize(initialSettings || {});
  sandbox.GridSettings.load = () => JSON.parse(JSON.stringify(current));
  sandbox.GridSettings.save = (s) => {
    savedCount++;
    current = sandbox.GridSettings.normalize(s);
    lastSaved = JSON.parse(JSON.stringify(current));
  };

  vm.runInContext(fs.readFileSync(path.join(__dirname, '../src/app/logo-lab-panel.js'), 'utf8'), sandbox);
  return {
    sandbox,
    elements,
    toggles,
    getSavedCount: () => savedCount,
    getLastSaved: () => lastSaved
  };
}

test('UI sync: swap button swaps fill/stroke and syncs handles.strokeWidth; circle mode toggles count visibility; custom sensitivity adds option', () => {
  const { elements, getLastSaved } = loadInteractiveLab({
    gridlines: { sensitivity: 35, margin: 20, scope: 'artboard' }
  });

  // Custom sensitivity option inserted and selected
  assert.strictEqual(elements['ll-grid-sensitivity'].value, '35');
  assert.ok(elements['ll-grid-sensitivity'].options.some((o) => o.value === '35'));
  assert.strictEqual(elements['ll-grid-scope'].value, 'artboard');

  // Circle mode 'all' hides count input; changing to 'longest' shows it
  assert.strictEqual(elements['ll-circle-n-wrap'].style.display, 'none');
  elements['ll-circle-mode'].value = 'longest';
  elements['ll-circle-mode'].onchange();
  assert.strictEqual(elements['ll-circle-n-wrap'].style.display, '');

  // Swap button swaps fill and stroke and syncs handles.strokeWidth with anchors.strokeWidth
  elements['ll-swap'].onclick();
  const saved = getLastSaved();
  assert.strictEqual(saved.style.anchors.fill, '#ffffff');
  assert.strictEqual(saved.style.anchors.stroke, '#378ef0');
  assert.strictEqual(saved.style.handles.fill, '#ffffff');
  assert.strictEqual(saved.style.handles.stroke, '#378ef0');
  assert.strictEqual(saved.style.handles.strokeWidth, saved.style.anchors.strokeWidth);
});

test('sliders do not save to disk on oninput, do not blur on onchange, and auto-width skips sliders and pill-sm inputs', () => {
  const { elements, getSavedCount, getLastSaved } = loadInteractiveLab();

  // Range sliders and .ll-pill-sm inputs must not receive inline ch width overrides
  assert.strictEqual(elements['ll-anchor-size'].style.width, undefined);
  assert.strictEqual(elements['ll-stroke-width'].style.width, undefined);
  assert.strictEqual(elements['ll-circle-n'].style.width, undefined);
  assert.ok(String(elements['ll-anchor-size-val'].style.width).endsWith('ch'));

  const beforeSaves = getSavedCount();
  elements['ll-anchor-size'].value = '18';
  elements['ll-anchor-size'].oninput();
  assert.strictEqual(getSavedCount(), beforeSaves, 'dragging slider does not write to disk on every pixel');
  assert.strictEqual(Number(elements['ll-anchor-size-val'].value), 18);

  elements['ll-anchor-size'].onchange();
  assert.strictEqual(getSavedCount(), beforeSaves + 1, 'releasing slider saves once');
  assert.strictEqual(elements['ll-anchor-size'].blurred, false, 'slider keeps keyboard focus after change');
  assert.strictEqual(getLastSaved().style.anchors.size, 18);
});

test('Generate All runs all 5 elements without mutating saved toggles; Restyle invokes Bridge.gridRestyle; Handles-only large job triggers confirm', async () => {
  const { sandbox, elements, getLastSaved } = loadInteractiveLab({
    elements: { anchors: false, handles: true, outlines: false, circles: false, gridlines: false }
  });

  // Generate All sends all 5 elements true without turning on the UI toggles in settings
  elements['ll-generate-all'].onclick();
  await new Promise((r) => setImmediate(r));
  assert.deepStrictEqual(JSON.parse(JSON.stringify(sandbox.Bridge.lastGenerateJob.elements)), {
    anchors: true, handles: true, outlines: true, circles: true, gridlines: true
  });
  assert.strictEqual(getLastSaved(), null, 'Generate All does not overwrite saved element toggles');

  // Restyle calls Bridge.gridRestyle
  elements['ll-restyle'].onclick();
  await new Promise((r) => setImmediate(r));
  assert.ok(sandbox.Bridge.lastRestyleJob);
  assert.strictEqual(elements['status'].textContent, 'Đã cập nhật kiểu dáng lưới.');

  // Handles-only run with > 2000 anchors triggers confirmation instead of freezing Illustrator
  sandbox.Bridge.lastGenerateJob = null;
  sandbox.Bridge.inspectResult = { ok: true, paths: 1, anchors: 2500, circles: 0, skipped: {} };
  elements['ll-generate'].onclick();
  await new Promise((r) => setImmediate(r));
  assert.strictEqual(elements['ll-confirm'].hidden, false, 'confirm dialog shown for handles-only > 2000 anchors');
  assert.strictEqual(sandbox.Bridge.lastGenerateJob, null, 'draw deferred until user confirms');
});
