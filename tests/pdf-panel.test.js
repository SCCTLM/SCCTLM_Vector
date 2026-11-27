// Run: node --test tests/pdf-panel.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const PdfFormat = require('../src/app/pdf-format.js');
const PdfEstimate = require('../src/app/pdf-estimate.js');

test('index.html & panel.css: redesigned Dung lượng dự đoán row and pdf-estimate.js script', () => {
  const html = fs.readFileSync(path.join(__dirname, '../src/app/index.html'), 'utf8');
  const css = fs.readFileSync(path.join(__dirname, '../src/app/panel.css'), 'utf8');

  assert.ok(html.includes('<script src="pdf-estimate.js"></script>'), 'pdf-estimate.js must be loaded in index.html');
  assert.ok(html.indexOf('pdf-format.js') < html.indexOf('pdf-estimate.js'), 'pdf-estimate.js loads after pdf-format.js');
  assert.ok(html.indexOf('pdf-estimate.js') < html.indexOf('pdf-panel.js'), 'pdf-estimate.js loads before pdf-panel.js');

  assert.ok(html.includes('class="pdf-size-meta"'), 'label and value are grouped in .pdf-size-meta');
  assert.ok(html.includes('class="pdf-size-label">Dung lượng dự đoán</span>'));
  assert.ok(html.includes('id="pdf-size">—</span>'), 'initial readout shows em-dash');
  assert.ok(html.includes('id="pdf-recalc" class="pdf-recalc-btn"'), 'compact recalc button exists');
  assert.ok(html.includes('class="pdf-recalc-icon"'), 'recalc button has inline SVG icon');

  assert.match(css, /\.pdf-size-val\s*\{[^}]*font-variant-numeric:\s*tabular-nums;/);
  assert.match(css, /\.pdf-size-row\s*\{[^}]*background:\s*var\(--field\);/);
  assert.match(css, /button\.pdf-recalc-btn\s*\{[^}]*border-radius:\s*999px;/);
});

function createPanelHarness(profileImpl) {
  const docListeners = {};
  function makeEl(id, extra) {
    const classes = new Set();
    const attrs = {};
    const listeners = {};
    const el = Object.assign({
      id,
      textContent: '',
      value: '',
      title: '',
      disabled: false,
      dataset: {},
      style: { setProperty() {} },
      classList: {
        toggle(c, on) {
          const next = on === undefined ? !classes.has(c) : !!on;
          if (next) classes.add(c); else classes.delete(c);
          return next;
        },
        add(c) { classes.add(c); },
        remove(c) { classes.delete(c); },
        contains(c) { return classes.has(c); }
      },
      setAttribute(k, v) { attrs[k] = String(v); },
      getAttribute(k) { return attrs[k]; },
      addEventListener(ev, fn) { (listeners[ev] = listeners[ev] || []).push(fn); },
      dispatch(ev, payload) { (listeners[ev] || []).forEach((fn) => fn.call(el, payload || {})); },
      querySelectorAll() { return []; }
    }, extra);
    return el;
  }

  const artboardChecks = [
    { value: '0', checked: true },
    { value: '1', checked: true }
  ];
  const artboardsBox = makeEl('artboards', {
    querySelectorAll(sel) {
      if (sel === 'input:checked') return artboardChecks.filter((c) => c.checked);
      return artboardChecks;
    }
  });

  const modePrint = makeEl('mode-print', { dataset: { mode: 'print' }, closest: () => modePrint });
  modePrint.setAttribute('data-mode', 'print');
  const modeReview = makeEl('mode-review', { dataset: { mode: 'review' }, closest: () => modeReview });
  modeReview.setAttribute('data-mode', 'review');
  const modesBox = makeEl('pdf-modes', { querySelectorAll: () => [modePrint, modeReview] });

  const qLow = makeEl('q-low', { dataset: { compression: '80' } });
  qLow.setAttribute('data-compression', '80');
  const qMid = makeEl('q-mid', { dataset: { compression: '50' } });
  qMid.setAttribute('data-compression', '50');
  const qHigh = makeEl('q-high', { dataset: { compression: '20' } });
  qHigh.setAttribute('data-compression', '20');
  const qualityBox = makeEl('pdf-quality-row', { querySelectorAll: () => [qLow, qMid, qHigh] });

  const laySingle = makeEl('lay-single', { dataset: { layout: 'single' } });
  laySingle.setAttribute('data-layout', 'single');
  const laySep = makeEl('lay-sep', { dataset: { layout: 'separate' } });
  laySep.setAttribute('data-layout', 'separate');
  const layoutBox = makeEl('pdf-layout', { querySelectorAll: () => [laySingle, laySep] });

  const els = {
    'artboards': artboardsBox,
    'ab-all': makeEl('ab-all'),
    'ab-none': makeEl('ab-none'),
    'pdf-modes': modesBox,
    'pdf-quality-row': qualityBox,
    'pdf-compression': makeEl('pdf-compression', { value: '20' }),
    'pdf-compression-input': makeEl('pdf-compression-input', { value: '20' }),
    'pdf-compression-val': makeEl('pdf-compression-val', { textContent: '20%' }),
    'pdf-layout': layoutBox,
    'pdf-size': makeEl('pdf-size', { textContent: '—' }),
    'pdf-recalc': makeEl('pdf-recalc'),
    'pdf-estimate-note': makeEl('pdf-estimate-note'),
    'pdf-export': makeEl('pdf-export', { textContent: 'Xuất PDF' }),
    'outdir': makeEl('outdir', { value: 'C:/out' }),
    'status': makeEl('status'),
    'results': makeEl('results')
  };

  let profileCalls = 0;
  const sandbox = {
    PdfFormat,
    PdfEstimate,
    Bridge: {
      available: true,
      profilePdfDoc() {
        profileCalls++;
        return profileImpl(profileCalls);
      },
      runPdfJob: () => Promise.resolve({ ok: true, files: [] })
    },
    document: {
      body: { dataset: { tab: 'pdf' } },
      activeElement: null,
      getElementById(id) { return els[id] || null; },
      addEventListener(ev, fn) { (docListeners[ev] = docListeners[ev] || []).push(fn); }
    },
    fireDoc(ev, detail) {
      (docListeners[ev] || []).forEach((fn) => fn({ detail }));
    }
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../src/app/pdf-panel.js'), 'utf8'), sandbox);

  return {
    sandbox,
    els,
    artboardChecks,
    modeReview,
    modePrint,
    qLow,
    laySep,
    getProfileCalls: () => profileCalls
  };
}

test('pdf-panel: caches profile on Tính toán and updates instantaneously on slider/mode/layout/artboard changes', async () => {
  const sampleProfile = {
    docIdentity: 'Poster.ai|C:/Poster.ai|true',
    totalArtboards: 2,
    artboardAreas: [600 * 800, 600 * 800],
    pathCount: 800,
    textCount: 20,
    meshCount: 0,
    symbolCount: 5,
    rasterTotalCount: 4,
    rasterRawBytes: 4 * 2400 * 1800 * 4,
    rasterReviewRawBytes: 4 * 1200 * 900 * 4,
    placedTotalCount: 0,
    placedRawBytes: 0,
    placedReviewRawBytes: 0,
    linkedFileBytes: 0,
    sourceFileBytes: 25 * 1024 * 1024
  };

  let resolveProfile;
  const h = createPanelHarness(() => new Promise((res) => { resolveProfile = res; }));

  // Trigger Tính toán -> enters loading state
  h.els['pdf-recalc'].onclick();
  assert.strictEqual(h.getProfileCalls(), 1);
  assert.strictEqual(h.els['pdf-size'].textContent, 'Đang tính…');
  assert.ok(h.els['pdf-size'].classList.contains('is-loading'));
  assert.ok(h.els['pdf-recalc'].disabled);
  assert.ok(h.els['pdf-recalc'].classList.contains('is-loading'));

  // Resolve profile -> shows ~ formatted estimate
  resolveProfile({ ok: true, profile: sampleProfile });
  await new Promise((r) => setImmediate(r));

  const initialText = h.els['pdf-size'].textContent;
  assert.match(initialText, /^~ \d+\.\d+ (KB|MB)$/);
  assert.ok(h.els['pdf-size'].classList.contains('is-ready'));
  assert.strictEqual(h.els['pdf-recalc'].disabled, false);

  // Drag slider to 80% -> updates instantaneously with 0 additional ExtendScript calls
  h.els['pdf-compression'].value = '80';
  h.els['pdf-compression'].dispatch('input');
  assert.strictEqual(h.getProfileCalls(), 1);
  assert.notStrictEqual(h.els['pdf-size'].textContent, initialText);

  // Switch to Xuất Duyệt -> updates instantaneously with 0 additional ExtendScript calls
  const beforeReview = h.els['pdf-size'].textContent;
  h.els['pdf-modes'].onclick({ target: h.modeReview });
  assert.strictEqual(h.getProfileCalls(), 1);
  assert.notStrictEqual(h.els['pdf-size'].textContent, beforeReview);

  // Toggle layout to Lẻ từng trang -> updates instantaneously with 0 additional ExtendScript calls
  h.els['pdf-layout'].onclick({ target: h.laySep });
  assert.strictEqual(h.getProfileCalls(), 1);
  assert.match(h.els['pdf-size'].textContent, /^~ /);

  // Uncheck one artboard -> updates instantaneously with 0 additional ExtendScript calls
  const twoAbText = h.els['pdf-size'].textContent;
  h.artboardChecks[1].checked = false;
  h.els['artboards'].dispatch('change');
  assert.strictEqual(h.getProfileCalls(), 1);
  assert.notStrictEqual(h.els['pdf-size'].textContent, twoAbText);

  // Uncheck all artboards -> shows em-dash and helpful Vietnamese note
  h.artboardChecks[0].checked = false;
  h.els['artboards'].dispatch('change');
  assert.strictEqual(h.els['pdf-size'].textContent, '—');
  assert.match(h.els['pdf-estimate-note'].textContent, /ít nhất một artboard/);

  // Document switch invalidates cache
  h.artboardChecks[0].checked = true;
  h.sandbox.fireDoc('artboards-changed', { docName: 'Other', docPath: 'C:/Other.ai', artboards: [{ index: 0 }] });
  assert.strictEqual(h.sandbox.PdfPanel.getCachedProfile(), null);
  assert.strictEqual(h.els['pdf-size'].textContent, '—');
});

test('pdf-panel: shows clear Vietnamese error when profilePdfDoc fails', async () => {
  const h = createPanelHarness(() => Promise.resolve({ ok: false, error: 'Chưa mở tài liệu nào' }));
  h.els['pdf-recalc'].onclick();
  await new Promise((r) => setImmediate(r));
  assert.strictEqual(h.els['pdf-size'].textContent, 'Không rõ');
  assert.ok(h.els['pdf-size'].classList.contains('fail'));
  assert.strictEqual(h.els['pdf-estimate-note'].textContent, 'Chưa mở tài liệu nào');
});
