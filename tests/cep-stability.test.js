// Unit tests for CEP stability fixes: duplicate install detection, in-panel notice UI,
// panel.js error deduplication, loader.js safe rollback, and installer checks.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');

function loadUpdater() {
  const sandbox = { require, Buffer, URL, Promise, process };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(root, 'src/app/updater.js'), 'utf8'), sandbox);
  return sandbox.Updater;
}

test('Updater.findDuplicateInstall detects Windows Common Files duplicates and excludes current extDir', () => {
  const Updater = loadUpdater();
  const userDir = 'C:\\Users\\alice\\AppData\\Roaming\\Adobe\\CEP\\extensions\\vn.scctlm.vector';
  const cf32Dir = 'C:\\Program Files (x86)\\Common Files\\Adobe\\CEP\\extensions\\vn.scctlm.vector';
  const cf64Dir = 'C:\\Program Files\\Common Files\\Adobe\\CEP\\extensions\\vn.scctlm.vector';
  const existing = new Set([userDir.toLowerCase(), cf32Dir.toLowerCase()]);

  const dupes = Updater.findDuplicateInstall(userDir.toUpperCase(), {
    platform: 'win32',
    homedir: 'C:\\Users\\alice',
    env: {
      APPDATA: 'C:\\Users\\alice\\AppData\\Roaming',
      'CommonProgramFiles(x86)': 'C:\\Program Files (x86)\\Common Files',
      CommonProgramFiles: 'C:\\Program Files\\Common Files'
    },
    existsSync: (p) => existing.has(p.toLowerCase())
  });
  assert.deepStrictEqual(Array.from(dupes), [cf32Dir]);

  // No duplicate when only the active folder exists
  const none = Updater.findDuplicateInstall(userDir, {
    platform: 'win32',
    homedir: 'C:\\Users\\alice',
    env: {
      APPDATA: 'C:\\Users\\alice\\AppData\\Roaming',
      'CommonProgramFiles(x86)': 'C:\\Program Files (x86)\\Common Files',
      CommonProgramFiles: 'C:\\Program Files\\Common Files'
    },
    existsSync: (p) => p.toLowerCase() === userDir.toLowerCase()
  });
  assert.deepStrictEqual(Array.from(none), []);

  // Detects both 32-bit and 64-bit Common Files duplicates
  const both = Updater.findDuplicateInstall(userDir, {
    platform: 'win32',
    homedir: 'C:\\Users\\alice',
    env: {
      APPDATA: 'C:\\Users\\alice\\AppData\\Roaming',
      'CommonProgramFiles(x86)': 'C:\\Program Files (x86)\\Common Files',
      CommonProgramFiles: 'C:\\Program Files\\Common Files'
    },
    existsSync: () => true
  });
  assert.deepStrictEqual(Array.from(both), [cf32Dir, cf64Dir]);
});

test('Updater.findDuplicateInstall detects macOS /Library duplicate from user install', () => {
  const Updater = loadUpdater();
  const userDir = '/Users/alice/Library/Application Support/Adobe/CEP/extensions/vn.scctlm.vector';
  const sysDir = '/Library/Application Support/Adobe/CEP/extensions/vn.scctlm.vector';
  const existing = new Set([userDir, sysDir]);

  const dupes = Updater.findDuplicateInstall(userDir, {
    platform: 'darwin',
    homedir: '/Users/alice',
    env: {},
    existsSync: (p) => existing.has(p)
  });
  assert.deepStrictEqual(Array.from(dupes), [sysDir]);
});

test('panel.js deduplicates consecutive identical errors in refreshArtboards()', async () => {
  let statusWrites = [];
  const statusEl = {
    _text: '',
    get textContent() { return this._text; },
    set textContent(v) { this._text = v; statusWrites.push(v); }
  };
  let mode = 'reject-a';
  const sandbox = {
    setInterval() { return 1; },
    clearInterval() {},
    addEventListener() {},
    CustomEvent: function (type, init) { this.type = type; this.detail = init && init.detail; },
    Theme: { watch() {} },
    Bridge: {
      available: true,
      listArtboards() {
        if (mode === 'reject-a') return Promise.reject(new Error('EvalScript error.'));
        if (mode === 'reject-b') return Promise.reject(new Error('Host busy.'));
        return Promise.resolve({ ok: true, docName: 'doc.ai', docPath: '/doc.ai', colorSpace: 'RGB', artboards: [] });
      }
    },
    document: {
      hidden: false,
      getElementById(id) { return id === 'status' ? statusEl : null; },
      addEventListener() {},
      dispatchEvent() {}
    }
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(root, 'src/app/panel.js'), 'utf8'), sandbox);

  // Initial init() call already ran refreshArtboards() once
  await new Promise(r => setImmediate(r));
  await sandbox.Panel.refreshArtboards();
  await sandbox.Panel.refreshArtboards();
  assert.deepStrictEqual(statusWrites, ['EvalScript error.'], 'identical consecutive errors write #status only once');

  mode = 'reject-b';
  await sandbox.Panel.refreshArtboards();
  assert.deepStrictEqual(statusWrites, ['EvalScript error.', 'Host busy.'], 'new error message updates #status');

  mode = 'ok';
  await sandbox.Panel.refreshArtboards();
  assert.strictEqual(statusEl.textContent, '', '#status clears when refreshArtboards recovers');
});

test('in-panel Notice.show renders toast and modal without spawning any CEP extension', () => {
  function makeEl(id) {
    const attrs = {};
    const listeners = {};
    return {
      id,
      hidden: true,
      textContent: '',
      onclick: null,
      setAttribute(k, v) { attrs[k] = v; },
      getAttribute(k) { return attrs[k]; },
      addEventListener(evt, fn) { (listeners[evt] = listeners[evt] || []).push(fn); },
      dispatch(evt, arg) { (listeners[evt] || []).forEach(fn => fn(arg)); }
    };
  }
  const els = {};
  for (const id of ['notice-toast', 'notice-toast-text', 'notice-toast-close', 'notice-modal', 'notice-dialog', 'notice-modal-title', 'notice-modal-body', 'notice-modal-action', 'notice-modal-close', 'notice-modal-x', 'status']) {
    els[id] = makeEl(id);
  }
  const docListeners = {};
  let scheduledTimers = [];
  const sandbox = {
    setTimeout(fn, ms) { const id = scheduledTimers.length + 1; scheduledTimers.push({ id, fn, ms, cleared: false }); return id; },
    clearTimeout(id) { const t = scheduledTimers.find(x => x.id === id); if (t) t.cleared = true; },
    document: {
      getElementById(id) { return els[id] || null; },
      addEventListener(evt, fn) { (docListeners[evt] = docListeners[evt] || []).push(fn); }
    }
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(root, 'src/app/notice-launcher.js'), 'utf8'), sandbox);

  // Toast mode for simple status messages
  sandbox.Notice.show('Đã tạo viền 20px');
  assert.strictEqual(els['notice-toast'].hidden, false);
  assert.strictEqual(els['notice-modal'].hidden, true);
  assert.strictEqual(els['notice-toast-text'].textContent, 'Đã tạo viền 20px');
  assert.strictEqual(els['notice-toast'].getAttribute('data-kind'), 'info');
  assert.strictEqual(scheduledTimers.length, 1);

  // Dismiss toast via close button
  els['notice-toast-close'].onclick();
  assert.strictEqual(els['notice-toast'].hidden, true);

  // Error toast does not auto-dismiss
  scheduledTimers = [];
  sandbox.Notice.show('Lỗi: không có đối tượng');
  assert.strictEqual(els['notice-toast'].getAttribute('data-kind'), 'error');
  assert.strictEqual(scheduledTimers.length, 0);

  // Modal mode for updates with action button
  let actionCount = 0;
  sandbox.Notice.show('Có bản cập nhật 0.2.0.', { title: 'Cập nhật mới', label: 'Cài đặt', run: () => { actionCount++; } });
  assert.strictEqual(els['notice-modal'].hidden, false);
  assert.strictEqual(els['notice-toast'].hidden, true);
  assert.strictEqual(els['notice-modal-title'].textContent, 'Cập nhật mới');
  assert.strictEqual(els['notice-modal-action'].hidden, false);
  assert.strictEqual(els['notice-modal-action'].textContent, 'Cài đặt');
  assert.strictEqual(els['notice-modal-close'].textContent, 'Để sau');

  els['notice-modal-action'].onclick();
  assert.strictEqual(actionCount, 1);
  assert.strictEqual(els['notice-modal'].hidden, true);

  // Modal dismissed by Escape
  sandbox.Notice.show('Cảnh báo trùng lặp', { modal: true, kind: 'warning' });
  assert.strictEqual(els['notice-modal'].hidden, false);
  assert.strictEqual(els['notice-dialog'].getAttribute('data-kind'), 'warning');
  (docListeners.keydown || []).forEach(fn => fn({ key: 'Escape' }));
  assert.strictEqual(els['notice-modal'].hidden, true);
});

test('loader.js unloads iframe to about:blank and broadcasts vn.scctlm.close before rollback', () => {
  const events = [];
  const srcHistory = [];
  const frame = {
    _src: '',
    contentWindow: {},
    get src() { return this._src; },
    set src(v) { this._src = v; srcHistory.push(v); }
  };
  let timers = [];
  let rollbackCalls = 0;
  const fakeCore = {
    applyPending() { return { applied: false }; },
    checkBootHealth() { return { rolledBack: false }; },
    hasPending() { return true; },
    markHealthy() {},
    rollback() {
      rollbackCalls++;
      assert.strictEqual(frame.src, 'about:blank', 'iframe must be unloaded before core.rollback runs');
      return { rolledBack: true, version: '0.2.0' };
    }
  };
  const sandbox = {
    process,
    require(id) {
      if (id === 'fs') return { existsSync: () => false };
      if (id === 'path') return path;
      if (id === 'os') return require('os');
      if (id.endsWith('loader-core.js')) return fakeCore;
      throw new Error('unexpected require ' + id);
    },
    setTimeout(fn, ms) { timers.push({ fn, ms }); return timers.length; },
    clearTimeout() {},
    addEventListener() {},
    __adobe_cep__: { dispatchEvent(ev) { events.push(ev); } },
    location: { href: 'file:///C:/ext/loader.html' },
    document: { getElementById(id) { return id === 'app' ? frame : null; } }
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(root, 'src/loader.js'), 'utf8'), sandbox);

  assert.strictEqual(frame.src, 'app/index.html');
  assert.strictEqual(timers.length, 1);

  // Fire probation timeout -> should broadcast close, set about:blank, schedule rollback delay
  timers[0].fn();
  assert.strictEqual(events.length, 1);
  assert.strictEqual(events[0].type, 'vn.scctlm.close');
  assert.strictEqual(frame.src, 'about:blank');
  assert.strictEqual(rollbackCalls, 0);
  assert.strictEqual(timers.length, 2);

  // Fire unload delay -> should run rollback and load ?rolledback=1
  timers[1].fn();
  assert.strictEqual(rollbackCalls, 1);
  assert.strictEqual(frame.src, 'app/index.html?rolledback=1');
});

test('installers configure CSXS.13/14 and warn on duplicate system-wide installs', () => {
  const iss = fs.readFileSync(path.join(root, 'installer/windows/setup.iss'), 'utf8');
  assert.match(iss, /Software\\Adobe\\CSXS\.13/);
  assert.match(iss, /Software\\Adobe\\CSXS\.14/);
  assert.match(iss, /\{commoncf32\}\\Adobe\\CEP\\extensions\\vn\.scctlm\.vector/);
  assert.match(iss, /\{commoncf64\}\\Adobe\\CEP\\extensions\\vn\.scctlm\.vector/);
  assert.match(iss, /SuppressibleMsgBox/);

  const mac = fs.readFileSync(path.join(root, 'installer/macos/install-mac.sh'), 'utf8');
  assert.match(mac, /for n in 9 10 11 12 13 14;/);
  assert.match(mac, /\/Library\/Application Support\/Adobe\/CEP\/extensions\/\$EXT_ID/);
  assert.match(mac, /sudo rm -rf "\/Library\/Application Support\/Adobe\/CEP\/extensions\/vn\.scctlm\.vector"/);
});
