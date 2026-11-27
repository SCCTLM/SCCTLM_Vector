// Run: node --test tests/
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const core = require('../src/loader-core.js');

function setup() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vector-loader-'));
  const ext = path.join(root, 'ext');
  const data = path.join(root, 'data');
  fs.mkdirSync(data, { recursive: true });
  writeApp(path.join(ext, 'app'), '1.0.0');
  return { ext, data };
}

function writeApp(dir, version, { ready = false } = {}) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'version.json'), JSON.stringify({ version }));
  fs.writeFileSync(path.join(dir, 'index.html'), '<html></html>');
  if (ready) fs.writeFileSync(path.join(dir, '.ready'), version);
}

const versionOf = (dir) => JSON.parse(fs.readFileSync(path.join(dir, 'version.json'), 'utf8')).version;
const stateOf = (data) => JSON.parse(fs.readFileSync(path.join(data, 'update-state.json'), 'utf8'));

test('applies a ready staging folder and keeps the previous app', () => {
  const { ext, data } = setup();
  writeApp(path.join(ext, 'app.staging'), '1.1.0', { ready: true });
  const res = core.applyPending(ext, data);
  assert.deepStrictEqual(res, { applied: true, version: '1.1.0' });
  assert.strictEqual(versionOf(path.join(ext, 'app')), '1.1.0');
  assert.strictEqual(versionOf(path.join(ext, 'app.prev')), '1.0.0');
  assert.ok(!fs.existsSync(path.join(ext, 'app', '.ready')));
  assert.strictEqual(stateOf(data).pending.version, '1.1.0');
});

test('ignores and removes staging without a ready marker', () => {
  const { ext, data } = setup();
  writeApp(path.join(ext, 'app.staging'), '1.1.0');
  assert.strictEqual(core.applyPending(ext, data).applied, false);
  assert.ok(!fs.existsSync(path.join(ext, 'app.staging')));
  assert.strictEqual(versionOf(path.join(ext, 'app')), '1.0.0');
});

test('rejects a ready staging folder missing index.html', () => {
  const { ext, data } = setup();
  writeApp(path.join(ext, 'app.staging'), '1.1.0', { ready: true });
  fs.unlinkSync(path.join(ext, 'app.staging', 'index.html'));
  assert.strictEqual(core.applyPending(ext, data).applied, false);
  assert.strictEqual(versionOf(path.join(ext, 'app')), '1.0.0');
});

test('markHealthy clears the pending update', () => {
  const { ext, data } = setup();
  writeApp(path.join(ext, 'app.staging'), '1.1.0', { ready: true });
  core.applyPending(ext, data);
  core.markHealthy(data);
  assert.strictEqual(stateOf(data).pending, undefined);
  assert.strictEqual(core.checkBootHealth(ext, data).rolledBack, false);
});

test('rollback restores the previous app and records the failed version', () => {
  const { ext, data } = setup();
  writeApp(path.join(ext, 'app.staging'), '1.1.0', { ready: true });
  core.applyPending(ext, data);
  const res = core.rollback(ext, data);
  assert.deepStrictEqual(res, { rolledBack: true, version: '1.1.0' });
  assert.strictEqual(versionOf(path.join(ext, 'app')), '1.0.0');
  assert.deepStrictEqual(stateOf(data).failed, ['1.1.0']);
  assert.strictEqual(stateOf(data).pending, undefined);
});

test('an update that never confirms is rolled back after repeated launches', () => {
  const { ext, data } = setup();
  writeApp(path.join(ext, 'app.staging'), '1.1.0', { ready: true });
  core.applyPending(ext, data);
  for (let i = 0; i < core.MAX_BOOT_ATTEMPTS; i++) assert.strictEqual(core.checkBootHealth(ext, data).rolledBack, false);
  assert.strictEqual(core.checkBootHealth(ext, data).rolledBack, true);
  assert.strictEqual(versionOf(path.join(ext, 'app')), '1.0.0');
});

test('presets in the data dir are untouched by apply and rollback', () => {
  const { ext, data } = setup();
  fs.writeFileSync(path.join(data, 'presets.json'), '{"keep":true}');
  writeApp(path.join(ext, 'app.staging'), '1.1.0', { ready: true });
  core.applyPending(ext, data);
  core.rollback(ext, data);
  assert.strictEqual(fs.readFileSync(path.join(data, 'presets.json'), 'utf8'), '{"keep":true}');
});

test('rollback without a pending update leaves the app alone', () => {
  const { ext, data } = setup();
  writeApp(path.join(ext, 'app.prev'), '0.9.0');
  const res = core.rollback(ext, data);
  assert.strictEqual(res.rolledBack, false);
  assert.strictEqual(versionOf(path.join(ext, 'app')), '1.0.0');
  assert.ok(!core.hasPending(data));
});

test('a failed restore keeps the current app and the pending state for a retry', () => {
  const { ext, data } = setup();
  writeApp(path.join(ext, 'app.staging'), '1.1.0', { ready: true });
  core.applyPending(ext, data);
  const realRename = fs.renameSync;
  fs.renameSync = (from, to) => {
    if (path.basename(from) === 'app.prev') throw new Error('EBUSY');
    return realRename(from, to);
  };
  try { assert.throws(() => core.rollback(ext, data), /EBUSY/); } finally { fs.renameSync = realRename; }
  assert.strictEqual(versionOf(path.join(ext, 'app')), '1.1.0');
  assert.ok(core.hasPending(data));
  assert.strictEqual(core.rollback(ext, data).rolledBack, true);
  assert.strictEqual(versionOf(path.join(ext, 'app')), '1.0.0');
});

test('a staged update waits while an earlier update is still unconfirmed', () => {
  const { ext, data } = setup();
  writeApp(path.join(ext, 'app.staging'), '1.1.0', { ready: true });
  core.applyPending(ext, data);
  writeApp(path.join(ext, 'app.staging'), '1.2.0', { ready: true });
  assert.strictEqual(core.applyPending(ext, data).applied, false);
  assert.strictEqual(versionOf(path.join(ext, 'app')), '1.1.0');
  assert.strictEqual(versionOf(path.join(ext, 'app.prev')), '1.0.0');
  assert.ok(fs.existsSync(path.join(ext, 'app.staging', '.ready')));
  core.markHealthy(data);
  assert.strictEqual(core.applyPending(ext, data).version, '1.2.0');
});

test('renameWithRetry retries transient EPERM/EBUSY errors and succeeds once unlocked', () => {
  const { ext } = setup();
  const src = path.join(ext, 'app');
  const dst = path.join(ext, 'app.renamed');
  const realRename = fs.renameSync;
  let attempts = 0;
  fs.renameSync = (from, to) => {
    attempts++;
    if (attempts === 1) { const e = new Error('busy'); e.code = 'EBUSY'; throw e; }
    if (attempts === 2) { const e = new Error('perm'); e.code = 'EPERM'; throw e; }
    return realRename(from, to);
  };
  try {
    core.renameWithRetry(src, dst, { maxAttempts: 4, delayMs: 0, sleep: () => {} });
  } finally {
    fs.renameSync = realRename;
  }
  assert.strictEqual(attempts, 3);
  assert.ok(fs.existsSync(dst));
});

test('renameWithRetry does not retry non-lock errors like ENOENT', () => {
  const { ext } = setup();
  let attempts = 0;
  const realRename = fs.renameSync;
  fs.renameSync = () => {
    attempts++;
    const e = new Error('missing');
    e.code = 'ENOENT';
    throw e;
  };
  try {
    assert.throws(() => core.renameWithRetry(path.join(ext, 'a'), path.join(ext, 'b'), { maxAttempts: 5, delayMs: 0, sleep: () => {} }), /missing/);
  } finally {
    fs.renameSync = realRename;
  }
  assert.strictEqual(attempts, 1);
});

test('applyPending and rollback survive transient EBUSY/EPERM lock errors', () => {
  const { ext, data } = setup();
  writeApp(path.join(ext, 'app.staging'), '1.1.0', { ready: true });
  const realRename = fs.renameSync;
  let applyFailures = 0;
  fs.renameSync = (from, to) => {
    if (path.basename(from) === 'app' && applyFailures < 2) {
      applyFailures++;
      const e = new Error('locked');
      e.code = 'EBUSY';
      throw e;
    }
    return realRename(from, to);
  };
  try {
    const applied = core.applyPending(ext, data, { maxAttempts: 4, delayMs: 0, sleep: () => {} });
    assert.deepStrictEqual(applied, { applied: true, version: '1.1.0' });
  } finally {
    fs.renameSync = realRename;
  }

  let rollbackFailures = 0;
  fs.renameSync = (from, to) => {
    if (path.basename(from) === 'app.prev' && rollbackFailures < 2) {
      rollbackFailures++;
      const e = new Error('locked');
      e.code = 'EPERM';
      throw e;
    }
    return realRename(from, to);
  };
  try {
    const rb = core.rollback(ext, data, { maxAttempts: 4, delayMs: 0, sleep: () => {} });
    assert.deepStrictEqual(rb, { rolledBack: true, version: '1.1.0' });
    assert.strictEqual(versionOf(path.join(ext, 'app')), '1.0.0');
  } finally {
    fs.renameSync = realRename;
  }
});
