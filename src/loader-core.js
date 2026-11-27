// Fixed shell logic: swap a staged update in, track its health, roll back when it fails.
// Changes to this file ship only through a full reinstall. Node built-ins only.
'use strict';

var fs = require('fs');
var path = require('path');

var LOADER_VERSION = 4; // 4: safe rollback/retry and in-panel notice (3: notice window, 2: colour picker)
var MAX_BOOT_ATTEMPTS = 3;
var DEFAULT_RENAME_RETRIES = 5;
var DEFAULT_RENAME_DELAY_MS = 50;

function isLockError(err) {
  if (!err) return false;
  var code = err.code || '';
  if (code === 'EPERM' || code === 'EBUSY' || code === 'EACCES') return true;
  return /\b(EPERM|EBUSY|EACCES)\b/.test(String(err.message || ''));
}

function sleepSync(ms) {
  if (!ms || ms <= 0) return;
  try {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
    return;
  } catch (e) { /* SharedArrayBuffer may be unavailable in CEP mixed-context */ }
  var end = Date.now() + ms;
  while (Date.now() < end) { /* bounded spin fallback */ }
}

// Retries fs.renameSync on transient Windows file-lock errors (EPERM/EBUSY).
function renameWithRetry(from, to, opts) {
  opts = opts || {};
  var maxAttempts = opts.maxAttempts || DEFAULT_RENAME_RETRIES;
  var delayMs = opts.delayMs === undefined ? DEFAULT_RENAME_DELAY_MS : opts.delayMs;
  var sleep = opts.sleep || sleepSync;
  var lastErr;
  for (var attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      fs.renameSync(from, to);
      return;
    } catch (e) {
      lastErr = e;
      if (!isLockError(e) || attempt >= maxAttempts) throw e;
      sleep(delayMs * attempt);
    }
  }
  throw lastErr;
}

function rmrf(target) {
  var st;
  try { st = fs.lstatSync(target); } catch (e) { return; }
  if (st.isDirectory()) {
    fs.readdirSync(target).forEach(function (f) { rmrf(path.join(target, f)); });
    fs.rmdirSync(target);
  } else {
    fs.unlinkSync(target);
  }
}

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return fallback; }
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value), 'utf8');
}

function stateFile(dataDir) { return path.join(dataDir, 'update-state.json'); }

function appVersion(dir) {
  var v = readJson(path.join(dir, 'version.json'), null);
  return v && typeof v.version === 'string' ? v.version : null;
}

// Swap app.staging in when its ".ready" marker is present. Renames happen before any app file is
// open, which avoids Windows file locks. Returns { applied, version } or { applied: false }.
function applyPending(extDir, dataDir, opts) {
  var app = path.join(extDir, 'app');
  var prev = path.join(extDir, 'app.prev');
  var staging = path.join(extDir, 'app.staging');
  if (!fs.existsSync(path.join(staging, '.ready'))) {
    rmrf(staging); // half-written or abandoned download
    return { applied: false };
  }
  // An update still on probation must be confirmed or rolled back first, so app.prev is always a
  // version that was known to start. The staged folder is kept for a later launch.
  if (readJson(stateFile(dataDir), {}).pending) return { applied: false, deferred: true };
  var version = appVersion(staging);
  var hasIndex = fs.existsSync(path.join(staging, 'index.html'));
  if (!version || !hasIndex) { rmrf(staging); return { applied: false }; }

  rmrf(prev);
  var hadApp = fs.existsSync(app);
  if (hadApp) renameWithRetry(app, prev, opts);
  try {
    renameWithRetry(staging, app, opts);
  } catch (e) {
    if (hadApp) { rmrf(app); renameWithRetry(prev, app, opts); }
    return { applied: false, error: e && (e.code || e.message) };
  }
  try { fs.unlinkSync(path.join(app, '.ready')); } catch (e) { /* marker already gone */ }

  var state = readJson(stateFile(dataDir), {});
  state.pending = { version: version, attempts: 0 };
  writeJson(stateFile(dataDir), state);
  return { applied: true, version: version };
}

// Called once per launch before the app loads. When an applied update has failed to confirm it
// started for too many launches, it is undone here.
function checkBootHealth(extDir, dataDir, opts) {
  var state = readJson(stateFile(dataDir), {});
  if (!state.pending) return { rolledBack: false };
  state.pending.attempts = (state.pending.attempts || 0) + 1;
  if (state.pending.attempts > MAX_BOOT_ATTEMPTS) return rollback(extDir, dataDir, opts);
  writeJson(stateFile(dataDir), state);
  return { rolledBack: false };
}

function markHealthy(dataDir) {
  var state = readJson(stateFile(dataDir), {});
  if (state.pending) { delete state.pending; writeJson(stateFile(dataDir), state); }
}

function hasPending(dataDir) {
  return !!readJson(stateFile(dataDir), {}).pending;
}

// Undo a pending update: restore app.prev and remember the failed version so it is never offered
// again. Does nothing when no update is pending. Directory renames fail whole rather than halfway,
// and the state only changes once the previous app is back in place.
function rollback(extDir, dataDir, opts) {
  var app = path.join(extDir, 'app');
  var prev = path.join(extDir, 'app.prev');
  var failedDir = path.join(extDir, 'app.failed');
  var state = readJson(stateFile(dataDir), {});
  if (!state.pending) return { rolledBack: false };
  var failedVersion = state.pending.version;
  var restored = false;

  if (fs.existsSync(prev)) {
    rmrf(failedDir);
    renameWithRetry(app, failedDir, opts);
    try {
      renameWithRetry(prev, app, opts);
      restored = true;
    } catch (e) {
      renameWithRetry(failedDir, app, opts);
      throw e;
    }
  }

  state.failed = (state.failed || []).filter(function (v) { return v !== failedVersion; }).concat(failedVersion);
  delete state.pending;
  writeJson(stateFile(dataDir), state);
  try { rmrf(failedDir); } catch (e) { /* cleaned on a later rollback */ }
  return { rolledBack: restored, version: failedVersion };
}

module.exports = {
  LOADER_VERSION: LOADER_VERSION,
  MAX_BOOT_ATTEMPTS: MAX_BOOT_ATTEMPTS,
  applyPending: applyPending,
  checkBootHealth: checkBootHealth,
  hasPending: hasPending,
  markHealthy: markHealthy,
  renameWithRetry: renameWithRetry,
  rollback: rollback
};
