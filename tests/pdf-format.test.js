// Run: node --test tests/
const test = require('node:test');
const assert = require('node:assert');
const { formatBytes } = require('../src/app/pdf-format.js');

test('formats bytes, KB, MB and GB with one decimal above bytes', () => {
  assert.strictEqual(formatBytes(0), '0 B');
  assert.strictEqual(formatBytes(512), '512 B');
  assert.strictEqual(formatBytes(1536), '1.5 KB');
  assert.strictEqual(formatBytes(15 * 1024 * 1024), '15.0 MB');
  assert.strictEqual(formatBytes(2.5 * 1024 * 1024 * 1024), '2.5 GB');
});

test('promotes the unit when rounding reaches 1024', () => {
  assert.strictEqual(formatBytes(1024 * 1024 - 1), '1.0 MB');
  assert.strictEqual(formatBytes(1024 * 1024 * 1024 - 1), '1.0 GB');
});

test('large values stay in GB and bad input gives a dash', () => {
  assert.strictEqual(formatBytes(1500 * 1024 * 1024 * 1024), '1500.0 GB');
  assert.strictEqual(formatBytes(-1), '-');
  assert.strictEqual(formatBytes(NaN), '-');
  assert.strictEqual(formatBytes(undefined), '-');
});
