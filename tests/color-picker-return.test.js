// Run: node --test tests/
// Tests the custom SCCTLM Vector CMYK color picker return-color mode for Offset Lab & Logo Lab,
// plus ensures normal Artboard/header picker mode remains unaffected.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function makeEventBus() {
  const listeners = new Map();
  const dispatched = [];
  return {
    dispatched,
    addEventListener(type, fn) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(fn);
    },
    dispatchEvent(ev) {
      dispatched.push(ev);
      const list = listeners.get(ev.type) || [];
      list.forEach((fn) => fn(ev));
    }
  };
}

function makeStorage() {
  const store = new Map();
  return {
    getItem(k) { return store.has(k) ? store.get(k) : null; },
    setItem(k, v) { store.set(k, String(v)); },
    removeItem(k) { store.delete(k); },
    _store: store
  };
}

function createPickerWindow({ bus, localStorage, colorContextResult, colorApplyResult }) {
  const elements = {};
  const listeners = {};
  let closeCount = 0;
  let applyCalls = [];

  function makeEl(id, extra) {
    const el = Object.assign({
      id,
      value: '',
      textContent: '',
      title: '',
      checked: false,
      disabled: false,
      hidden: false,
      style: {},
      dataset: {},
      listeners: {},
      classList: {
        classes: new Set(),
        toggle(c, on) { if (on) this.classes.add(c); else this.classes.delete(c); },
        contains(c) { return this.classes.has(c); }
      },
      addEventListener(t, fn) {
        if (!this.listeners[t]) this.listeners[t] = [];
        this.listeners[t].push(fn);
      },
      dispatch(t, ev) { (this.listeners[t] || []).forEach((fn) => fn.call(this, ev)); },
      appendChild() {}
    }, extra);
    elements[id] = el;
    return el;
  }

  function makeCanvas(w, h) {
    return {
      width: w,
      height: h,
      clientLeft: 0,
      clientTop: 0,
      clientWidth: w,
      clientHeight: h,
      getBoundingClientRect: () => ({ left: 0, top: 0, width: w, height: h }),
      getContext() {
        return {
          createImageData: (cw, ch) => ({ data: new Uint8ClampedArray(cw * ch * 4) }),
          putImageData() {},
          drawImage() {}
        };
      }
    };
  }

  [
    'field-box', 'slider-box', 'ring', 'arrows', 'sw-new', 'sw-cur',
    'warn', 'warn-btn', 'warn-sw', 'ok', 'cancel', 'target',
    'f-hsb-0', 'f-hsb-1', 'f-hsb-2',
    'f-rgb-0', 'f-rgb-1', 'f-rgb-2',
    'f-lab-0', 'f-lab-1', 'f-lab-2',
    'f-cmyk-0', 'f-cmyk-1', 'f-cmyk-2', 'f-cmyk-3',
    'f-hex', 'gamut-on', 'profile', 'pk-status'
  ].forEach((id) => makeEl(id));
  elements['field'] = makeCanvas(256, 256);
  elements['slider'] = makeCanvas(20, 256);

  let rafId = 0;
  const sandbox = {
    localStorage,
    location: { href: 'file:///C:/app/picker.html' },
    requestAnimationFrame(fn) {
      rafId += 1;
      queueMicrotask(fn);
      return rafId;
    },
    setTimeout() { return 1; },
    Theme: { watch() {} },
    Presets: { dataDir: () => '' },
    CSEvent: function (type, scope) { this.type = type; this.scope = scope; this.data = ''; },
    Bridge: {
      available: true,
      cs: {
        addEventListener(t, fn) { bus.addEventListener(t, fn); },
        dispatchEvent(ev) { bus.dispatchEvent(ev); },
        closeExtension() { closeCount++; }
      },
      colorContext() {
        return Promise.resolve(colorContextResult || {
          ok: true, hasDoc: true, isCmyk: false, fillActive: true, rgb: [10, 20, 30], cmyk: null
        });
      },
      colorApply(payload) {
        applyCalls.push(payload);
        return Promise.resolve(colorApplyResult || { ok: true });
      }
    },
    document: {
      activeElement: null,
      getElementById(id) { return elements[id] || null; },
      querySelector() { return null; },
      querySelectorAll() { return []; },
      createElement(tag) {
        if (tag === 'canvas') return makeCanvas(128, 128);
        return { tag, value: '', textContent: '' };
      },
      addEventListener(t, fn) { listeners[t] = fn; }
    },
    addEventListener(t, fn) { listeners['win:' + t] = fn; },
    close() { closeCount++; }
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);

  for (const f of ['color-math.js', 'color-gamut.js', 'color-field.js', 'picker.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../src/app', f), 'utf8'), sandbox);
  }

  return {
    elements,
    getCloseCount: () => closeCount,
    getApplyCalls: () => applyCalls,
    triggerBeforeUnload: () => { if (listeners['win:beforeunload']) listeners['win:beforeunload'](); }
  };
}

test('Picker return-color mode: initializes to requested hex, hides Fill/Stroke select, emits result on OK without calling Bridge.colorApply', async () => {
  const bus = makeEventBus();
  const localStorage = makeStorage();

  // Simulate panel launching picker for Offset Lab (#1FC8FF)
  const req = { requestId: 'pick-1', target: 'offset-color', hex: '#1FC8FF' };
  localStorage.setItem('scctlm.picker.request', JSON.stringify(req));

  const picker = createPickerWindow({
    bus,
    localStorage,
    colorContextResult: { ok: true, hasDoc: false, isCmyk: false, fillActive: true, rgb: [0, 0, 0], cmyk: null }
  });
  await new Promise((r) => setImmediate(r));

  // Target select hidden & disabled; OK enabled even when no Illustrator doc is open
  assert.strictEqual(picker.elements['target'].hidden, true);
  assert.strictEqual(picker.elements['target'].disabled, true);
  assert.strictEqual(picker.elements['ok'].disabled, false);
  assert.strictEqual(picker.elements['f-hex'].value.toLowerCase(), '1fc8ff');
  assert.strictEqual(picker.elements['sw-cur'].style.background, 'rgb(31,200,255)');

  // User types a new hex color and clicks OK
  picker.elements['f-hex'].value = 'ff3366';
  picker.elements['f-hex'].dispatch('input');
  picker.elements['ok'].onclick();

  assert.strictEqual(picker.getApplyCalls().length, 0, 'must NOT apply directly to Illustrator in return-color mode');
  assert.strictEqual(picker.getCloseCount(), 1, 'picker closes on OK');
  assert.strictEqual(localStorage.getItem('scctlm.picker.request'), null, 'clears stored request on OK');

  const resultEv = bus.dispatched.find((e) => e.type === 'vn.scctlm.picker.result');
  assert.ok(resultEv, 'dispatches vn.scctlm.picker.result event');
  assert.deepStrictEqual(JSON.parse(resultEv.data), {
    requestId: 'pick-1',
    target: 'offset-color',
    hex: '#FF3366'
  });
});

test('Picker return-color mode: Cancel clears request and closes without emitting result', async () => {
  const bus = makeEventBus();
  const localStorage = makeStorage();
  localStorage.setItem('scctlm.picker.request', JSON.stringify({
    requestId: 'pick-2', target: 'logo-lab-fill', hex: '#378EF0'
  }));

  const picker = createPickerWindow({ bus, localStorage });
  await new Promise((r) => setImmediate(r));

  picker.elements['cancel'].onclick();
  assert.strictEqual(picker.getCloseCount(), 1);
  assert.strictEqual(localStorage.getItem('scctlm.picker.request'), null);
  assert.strictEqual(bus.dispatched.filter((e) => e.type === 'vn.scctlm.picker.result').length, 0);
});

test('Picker normal mode (Artboard/header): shows Fill/Stroke select and applies directly to Illustrator on OK', async () => {
  const bus = makeEventBus();
  const localStorage = makeStorage();

  const picker = createPickerWindow({
    bus,
    localStorage,
    colorContextResult: { ok: true, hasDoc: true, isCmyk: false, fillActive: false, rgb: [12, 34, 56], cmyk: null }
  });
  await new Promise((r) => setImmediate(r));

  assert.strictEqual(picker.elements['target'].hidden, false);
  assert.strictEqual(picker.elements['target'].disabled, false);
  assert.strictEqual(picker.elements['target'].value, 'stroke');
  assert.strictEqual(picker.elements['ok'].disabled, false);

  picker.elements['ok'].onclick();
  await new Promise((r) => setImmediate(r));

  assert.strictEqual(picker.getApplyCalls().length, 1);
  assert.strictEqual(picker.getApplyCalls()[0].fill, false);
  assert.strictEqual(picker.getCloseCount(), 1);
  assert.strictEqual(bus.dispatched.filter((e) => e.type === 'vn.scctlm.picker.result').length, 0);
});

test('End-to-end launcher + picker: switching between return-color mode and normal mode when picker is already open', async () => {
  const bus = makeEventBus();
  const localStorage = makeStorage();
  const openCalls = [];

  // 1. Load launcher (panel side)
  const launcherSandbox = {
    localStorage,
    document: {
      getElementById(id) {
        if (id === 'open-picker' || id === 'open-picker-artboard') return { id, disabled: false, onclick: null };
        return null;
      }
    },
    CSEvent: function (type, scope) { this.type = type; this.scope = scope; this.data = ''; },
    Bridge: {
      cs: {
        requestOpenExtension(id, params) { openCalls.push({ id, params }); },
        addEventListener(t, fn) { bus.addEventListener(t, fn); },
        dispatchEvent(ev) { bus.dispatchEvent(ev); }
      }
    }
  };
  launcherSandbox.window = launcherSandbox;
  vm.createContext(launcherSandbox);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../src/app/color-picker-launcher.js'), 'utf8'), launcherSandbox);

  // 2. Open picker in normal mode first
  const picker = createPickerWindow({ bus, localStorage });
  await new Promise((r) => setImmediate(r));
  assert.strictEqual(picker.elements['target'].hidden, false);

  // 3. Now pick a color for Logo Lab Stroke while picker is already open
  let pickedHex = null;
  const started = launcherSandbox.ColorPickerLauncher.pick('logo-lab-stroke', '#00AA55', (hex) => {
    pickedHex = hex;
  });
  assert.strictEqual(started, true);
  assert.strictEqual(openCalls.length, 1);
  assert.strictEqual(openCalls[0].id, 'vn.scctlm.vector.picker');
  await new Promise((r) => setImmediate(r));

  assert.strictEqual(picker.elements['target'].hidden, true);
  assert.strictEqual(picker.elements['f-hex'].value.toLowerCase(), '00aa55');

  // Change color to #ABCDEF and press OK
  picker.elements['f-hex'].value = 'abcdef';
  picker.elements['f-hex'].dispatch('input');
  picker.elements['ok'].onclick();

  assert.strictEqual(pickedHex, '#ABCDEF');

  // 4. Open normally again from Artboard/header -> switches back to normal mode
  launcherSandbox.ColorPickerLauncher.open();
  await new Promise((r) => setImmediate(r));
  assert.strictEqual(picker.elements['target'].hidden, false);
  assert.strictEqual(localStorage.getItem('scctlm.picker.request'), null);
});
