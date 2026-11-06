// Preset storage: JSON file in the per-user data dir, outside the extension folder so updates keep it.
(function (global) {
  'use strict';

  var SCHEMA_VERSION = 1;
  var fs = require('fs');
  var path = require('path');
  var os = require('os');

  var DEFAULT_SETTINGS = { formats: ['png'], scales: [1], template: '{doc}_{artboard}@{scale}x' };

  function dataDir() {
    var base = null;
    try {
      var cs = global.Bridge && global.Bridge.cs;
      if (cs) {
        var uri = cs.getSystemPath(SystemPath.USER_DATA);
        base = decodeURI(String(uri).replace(/^file:\/\/\//, ''));
        if (process.platform !== 'win32') base = '/' + base;
      }
    } catch (ignore) { /* fall through */ }
    if (!base) {
      base = process.platform === 'win32'
        ? (process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'))
        : path.join(os.homedir(), 'Library', 'Application Support');
    }
    return path.join(base, 'ilus-batch-export');
  }

  function filePath() { return path.join(dataDir(), 'presets.json'); }

  function emptyStore() { return { version: SCHEMA_VERSION, presets: [] }; }

  // Forward-migrate older/unknown shapes; never throws.
  function migrate(raw) {
    if (!raw || typeof raw !== 'object' || !Array.isArray(raw.presets)) return emptyStore();
    var presets = raw.presets.filter(function (p) {
      return p && typeof p.name === 'string' && p.name !== '' && p.settings && typeof p.settings === 'object';
    }).map(function (p) {
      return { name: p.name, settings: normalize(p.settings) };
    });
    return { version: SCHEMA_VERSION, presets: presets };
  }

  function normalize(s) {
    var formats = (s.formats || []).filter(function (f) { return ['png', 'jpg', 'svg', 'pdf'].indexOf(f) >= 0; });
    var scales = (s.scales || []).filter(function (n) { return typeof n === 'number' && n > 0; });
    return {
      formats: formats.length ? formats : DEFAULT_SETTINGS.formats.slice(),
      scales: scales.length ? scales : DEFAULT_SETTINGS.scales.slice(),
      template: typeof s.template === 'string' && s.template ? s.template : DEFAULT_SETTINGS.template,
      outputDir: typeof s.outputDir === 'string' ? s.outputDir : ''
    };
  }

  function load() {
    try {
      return migrate(JSON.parse(fs.readFileSync(filePath(), 'utf8')));
    } catch (e) {
      return emptyStore();
    }
  }

  // Atomic write: temp file then rename, so a crash never leaves a truncated presets file.
  function save(store) {
    var dir = dataDir();
    fs.mkdirSync(dir, { recursive: true });
    var target = filePath();
    var tmp = target + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(store, null, 2), 'utf8');
    fs.renameSync(tmp, target);
  }

  function indexOf(store, name) {
    for (var i = 0; i < store.presets.length; i++) if (store.presets[i].name === name) return i;
    return -1;
  }

  global.Presets = {
    SCHEMA_VERSION: SCHEMA_VERSION,
    DEFAULT_SETTINGS: DEFAULT_SETTINGS,
    dataDir: dataDir,
    migrate: migrate,
    list: function () { return load().presets; },
    // Insert or overwrite by name.
    saveAs: function (name, settings) {
      var store = load();
      var entry = { name: name, settings: normalize(settings) };
      var i = indexOf(store, name);
      if (i >= 0) store.presets[i] = entry; else store.presets.push(entry);
      save(store);
      return store.presets;
    },
    rename: function (oldName, newName) {
      var store = load();
      var i = indexOf(store, oldName);
      if (i < 0) throw new Error('Preset not found');
      var clash = indexOf(store, newName);
      if (clash >= 0 && clash !== i) throw new Error('A preset with that name already exists');
      store.presets[i].name = newName;
      save(store);
      return store.presets;
    },
    remove: function (name) {
      var store = load();
      var i = indexOf(store, name);
      if (i >= 0) { store.presets.splice(i, 1); save(store); }
      return store.presets;
    },
    get: function (name) {
      var store = load();
      var i = indexOf(store, name);
      return i >= 0 ? store.presets[i].settings : null;
    }
  };
}(window));
