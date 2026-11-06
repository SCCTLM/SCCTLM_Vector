// Run: node --test tests/
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const core = require('../src/loader-core.js');

function setup() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ilus-loader-'));
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
