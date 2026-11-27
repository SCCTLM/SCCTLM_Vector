// Unit tests for CEP & Illustrator performance optimizations:
// - Zero background setInterval polling in panel.js and offset-panel.js
// - Tab-gated & visibility-gated ExtendScript refreshes
// - In-flight evalScript deduplication in panel.js, offset-panel.js, and bridge.js
// - Strictly read-only and bounded passive inspection in offset-engine.jsx
// - Deferred YouTube thumbnail rendering in explore-panel.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');

function makePanelSandbox(initialTab) {
  const docListeners = {};
  const winListeners = {};
  let intervalCalls = 0;
  let listCalls = 0;
  let pendingResolvers = [];

  const sandbox = {
    Date,
    setInterval() { intervalCalls++; return 1; },
    clearInterval() {},
    addEventListener(evt, fn) { (winListeners[evt] = winListeners[evt] || []).push(fn); },
    CustomEvent: function (type, init) { this.type = type; this.detail = init && init.detail; },
    Theme: { watch() {} },
    Bridge: {
      available: true,
      listArtboards() {
        listCalls++;
        return new Promise((resolve) => {
          pendingResolvers.push(resolve);
        });
      }
    },
    document: {
      hidden: false,
      body: { dataset: { tab: initialTab } },
      getElementById() { return null; },
      addEventListener(evt, fn) { (docListeners[evt] = docListeners[evt] || []).push(fn); },
      dispatchEvent() {}
    }
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(root, 'src/app/panel.js'), 'utf8'), sandbox);

  const resolveAll = (payload) => {
    const res = payload || { ok: true, docName: 'doc.ai', docPath: '/doc.ai', colorSpace: 'RGB', artboards: [] };
    while (pendingResolvers.length) pendingResolvers.shift()(res);
  };

  return {
    sandbox,
    getIntervalCalls: () => intervalCalls,
    getListCalls: () => listCalls,
    resolveAll,
    fireDoc(evt, detail) {
      (docListeners[evt] || []).forEach(fn => fn({ detail }));
    },
    fireWin(evt) {
      (winListeners[evt] || []).forEach(fn => fn());
    }
  };
}

test('panel.js does not schedule background setInterval polling and skips listArtboards on daily/explore tabs', async () => {
  const env = makePanelSandbox('daily');
  assert.strictEqual(env.getIntervalCalls(), 0, 'panel.js must not use background setInterval polling');
  assert.strictEqual(env.getListCalls(), 0, 'must not call listArtboards on startup when daily tab is active');

  // Window focus on daily tab must still skip listArtboards
  env.fireWin('focus');
  assert.strictEqual(env.getListCalls(), 0, 'focus on daily tab must not call listArtboards');

  // Switching to explore tab must still skip listArtboards
  env.sandbox.document.body.dataset.tab = 'explore';
  env.fireDoc('tab-changed', 'explore');
  assert.strictEqual(env.getListCalls(), 0, 'explore tab must not call listArtboards');

  // Switching to artboard tab triggers listArtboards immediately
  env.sandbox.document.body.dataset.tab = 'artboard';
  env.fireDoc('tab-changed', 'artboard');
  assert.strictEqual(env.getListCalls(), 1, 'switching to artboard tab triggers listArtboards');

  // Overlapping call while in-flight must be deduplicated
  const p2 = env.sandbox.Panel.refreshArtboards();
  assert.strictEqual(env.getListCalls(), 1, 'concurrent refreshArtboards must reuse in-flight request');
  env.resolveAll();
  await p2;

  // Hidden panel blocks refresh; visibilitychange resumes when visible on pdf tab
  env.sandbox.document.body.dataset.tab = 'pdf';
  env.sandbox.document.hidden = true;
  env.fireDoc('tab-changed', 'pdf');
  assert.strictEqual(env.getListCalls(), 1, 'hidden panel must not call listArtboards');

  env.sandbox.document.hidden = false;
  env.fireDoc('visibilitychange');
  assert.strictEqual(env.getListCalls(), 2, 'becoming visible on pdf tab triggers listArtboards');
  env.resolveAll();
});

test('offset-panel.js does not schedule 800ms setInterval polling and gates inspectSelection by tab, visibility, and in-flight state', async () => {
  let intervalCalls = 0;
  let inspectCalls = 0;
  let pendingResolve = null;
  const docListeners = {};
  const cardListeners = {};

  const cardEl = {
    classList: { toggle() {} },
    addEventListener(evt, fn) { (cardListeners[evt] = cardListeners[evt] || []).push(fn); }
  };

  const sandbox = {
    Date,
    setInterval() { intervalCalls++; return 1; },
    clearInterval() {},
    addEventListener() {},
    document: {
      readyState: 'complete',
      hidden: false,
      body: { dataset: { tab: 'artboard' } },
      getElementById() { return null; },
      querySelector(sel) { return sel === '.offset-lab-card' ? cardEl : null; },
      querySelectorAll() { return []; },
      addEventListener(evt, fn) { (docListeners[evt] = docListeners[evt] || []).push(fn); }
    },
    Bridge: {
      offsetInspect() {
        inspectCalls++;
        return new Promise((resolve) => { pendingResolve = resolve; });
      }
    }
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(root, 'src/app/offset-panel.js'), 'utf8'), sandbox);

  assert.strictEqual(intervalCalls, 0, 'offset-panel.js must not schedule background setInterval polling');
  assert.strictEqual(inspectCalls, 0, 'must not call offsetInspect when artboard tab is active');

  // Switch to daily tab -> triggers inspectSelection
  sandbox.document.body.dataset.tab = 'daily';
  (docListeners['tab-changed'] || []).forEach(fn => fn({ detail: 'daily' }));
  assert.strictEqual(inspectCalls, 1, 'switching to daily tab triggers offsetInspect');

  // Concurrent call while in-flight is skipped
  sandbox.OffsetPanel.inspectSelection();
  assert.strictEqual(inspectCalls, 1, 'must not overlap in-flight offsetInspect calls');

  pendingResolve({ ok: true, hasSelection: false });
  await new Promise(r => setImmediate(r));

  // Hovering the offset card triggers refresh
  (cardListeners.mouseenter || []).forEach(fn => fn());
  assert.strictEqual(inspectCalls, 2, 'hovering offset card triggers offsetInspect');
  pendingResolve({ ok: true, hasSelection: false });
  await new Promise(r => setImmediate(r));
});

test('Bridge.loadEngine runs once and deduplicates concurrent passive evalScript reads', async () => {
  const evalCalls = [];
  const callbacks = [];
  const sandbox = {
    __adobe_cep__: {},
    location: { href: 'file:///C:/ext/app/index.html' },
    CSInterface: function () {
      this.evalScript = function (code, cb) {
        evalCalls.push(code);
        callbacks.push(cb);
      };
    }
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(root, 'src/app/bridge.js'), 'utf8'), sandbox);

  const p1 = sandbox.Bridge.listArtboards();
  const p2 = sandbox.Bridge.listArtboards();
  assert.strictEqual(p1, p2, 'concurrent Bridge.listArtboards() returns the same in-flight promise');

  // First evalScript is loadEngine()
  assert.strictEqual(evalCalls.length, 1);
  assert.ok(evalCalls[0].includes('jsx/engine.jsx'));
  callbacks.shift()('ok');
  await new Promise(r => setImmediate(r));

  // Second evalScript is the single deduplicated listArtboards()
  assert.strictEqual(evalCalls.length, 2);
  assert.strictEqual(evalCalls[1], 'listArtboards()');
  callbacks.shift()(JSON.stringify({ ok: true, artboards: [] }));

  const [r1, r2] = await Promise.all([p1, p2]);
  assert.strictEqual(r1.ok, true);
  assert.strictEqual(r2.ok, true);

  // Subsequent call after completion runs a fresh read without re-running loadEngine()
  const p3 = sandbox.Bridge.listArtboards();
  await new Promise(r => setImmediate(r));
  assert.strictEqual(evalCalls.length, 3);
  assert.strictEqual(evalCalls[2], 'listArtboards()');
  callbacks.shift()(JSON.stringify({ ok: true, artboards: [] }));
  await p3;
});

test('offset-engine passive inspection short-circuits on huge selections and never mutates TextFrame', () => {
  const JSX = path.join(root, 'src/app/jsx');
  function loadOffsetEngine(doc) {
    const ctx = {
      app: { documents: doc ? [doc] : [], activeDocument: doc || null },
      DocumentColorSpace: { RGB: 1, CMYK: 2 }
    };
    ctx.app.documents.length = doc ? 1 : 0;
    vm.createContext(ctx);
    for (const f of ['json2.jsx', 'naming.jsx', 'color-engine.jsx', 'offset-engine.jsx']) {
      vm.runInContext(fs.readFileSync(path.join(JSX, f), 'utf8'), ctx);
    }
    return (code) => JSON.parse(vm.runInContext(code, ctx));
  }

  // 1. Huge selection (> 50 items) must short-circuit immediately without iterating items
  let accessedItems = 0;
  const hugeSel = new Array(500).fill(null).map(() => ({
    get typename() { accessedItems++; return 'PathItem'; }
  }));
  const runHuge = loadOffsetEngine({ selection: hugeSel });
  const inspectRes = runHuge('offsetInspectSelection()');
  assert.strictEqual(inspectRes.ok, true);
  assert.strictEqual(inspectRes.tooMany, true);
  assert.strictEqual(inspectRes.offsetInfo.found, false);
  assert.strictEqual(inspectRes.shape.ok, false);
  assert.strictEqual(accessedItems, 0, 'huge selection must short-circuit before walking items');

  // 2. Passive inspection on a TextFrame must NEVER call duplicate(), createOutline(), or remove()
  let mutated = 0;
  const parent = { pageItems: [] };
  const textItem = {
    typename: 'TextFrame',
    geometricBounds: [10, 50, 110, 10],
    parent,
    duplicate() { mutated++; throw new Error('must not duplicate during passive inspect'); },
    createOutline() { mutated++; throw new Error('must not createOutline during passive inspect'); }
  };
  const bgItem = {
    typename: 'PathItem',
    geometricBounds: [0, 60, 120, 0],
    filled: true,
    fillColor: { typename: 'RGBColor', red: 255, green: 255, blue: 255 },
    parent
  };
  parent.pageItems.push(textItem, bgItem);

  const runText = loadOffsetEngine({ selection: [textItem] });
  const textRes = runText('offsetInspectSelection()');
  assert.strictEqual(textRes.ok, true);
  assert.strictEqual(mutated, 0, 'passive inspection must be strictly read-only on TextFrame');
});

test('explore-panel defers YouTube thumbnail rendering until Khám phá tab is opened', () => {
  const videosList = { innerHTML: '' };
  const searchInput = { value: '', addEventListener() {} };
  const chipsContainer = { innerHTML: '' };
  const explorePane = { addEventListener() {} };
  const docListeners = {};

  const sandbox = {
    document: {
      body: { dataset: { tab: 'daily' } },
      getElementById(id) {
        if (id === 'explore-videos') return videosList;
        if (id === 'explore-search') return searchInput;
        if (id === 'explore-chips') return chipsContainer;
        return null;
      },
      querySelector(sel) { return sel === '[data-pane="explore"]' ? explorePane : null; },
      addEventListener(evt, fn) { (docListeners[evt] = docListeners[evt] || []).push(fn); }
    },
    window: { open() {} },
    CSInterface: undefined,
    __adobe_cep__: undefined
  };
  sandbox.window.document = sandbox.document;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(root, 'src/app/explore-panel.js'), 'utf8'), sandbox);

  assert.strictEqual(videosList.innerHTML, '', 'video thumbnails must not render on boot while on daily tab');

  // Switching to explore tab renders the list with async-decoded lazy thumbnails
  sandbox.document.body.dataset.tab = 'explore';
  (docListeners['tab-changed'] || []).forEach(fn => fn({ detail: 'explore' }));
  assert.ok(videosList.innerHTML.includes('i.ytimg.com'), 'switching to explore tab renders video thumbnails');
  assert.ok(videosList.innerHTML.includes('decoding="async"'), 'thumbnails use decoding="async"');
});
