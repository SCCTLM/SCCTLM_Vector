// Run: node --test tests/
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ctx = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(__dirname, '../src/app/jsx/pdf-options.jsx'), 'utf8'), ctx);
const run = (code) => vm.runInContext(code, ctx);
const json = (code) => JSON.parse(run('JSON.stringify(' + code + ')'));

test('print mode keeps preset resolution and drops editing data', () => {
  assert.deepStrictEqual(json('pdfModeDescriptor("print", 10)'), {
    mode: 'print', preset: '[High Quality Print]', preserveEditability: false, downsample: null, jpegQuality: 'maximum'
  });
  assert.strictEqual(json('pdfModeDescriptor("print", 90)').downsample, null);
});

test('review mode downsamples to 150 ppi and follows the compression ratio', () => {
  const d = json('pdfModeDescriptor("review", 30)');
  assert.deepStrictEqual(d.downsample, { ppi: 150, threshold: 225 });
  assert.strictEqual(d.jpegQuality, 'high');
  assert.strictEqual(d.preserveEditability, false);
});

test('compression ratio maps to a JPEG level, defaulting to medium', () => {
  const lv = (c) => run('pdfJpegLevel(' + c + ')');
  assert.deepStrictEqual([0, 20, 21, 40].map(lv), ['maximum', 'maximum', 'high', 'high']);
  assert.deepStrictEqual([41, 50, 60, 61, 80].map(lv), ['medium', 'medium', 'medium', 'low', 'low']);
  assert.deepStrictEqual([81, 100].map(lv), ['minimum', 'minimum']);
  assert.strictEqual(run('pdfJpegLevel()'), 'medium');
});

test('unknown mode throws', () => {
  assert.throws(() => run('pdfModeDescriptor("draft")'), /Chế độ PDF không hợp lệ/);
});

test('mode suffix differs per mode', () => {
  assert.strictEqual(run('pdfModeSuffix("print")'), '_print');
  assert.strictEqual(run('pdfModeSuffix("review")'), '_review');
});

test('artboard range is 1-based with runs collapsed', () => {
  assert.strictEqual(run('pdfArtboardRange([0])'), '1');
  assert.strictEqual(run('pdfArtboardRange([0, 1, 2, 4])'), '1-3,5');
  assert.strictEqual(run('pdfArtboardRange([4, 0, 2, 1, 2])'), '1-3,5');
  assert.strictEqual(run('pdfArtboardRange([0, 2, 4])'), '1,3,5');
  assert.strictEqual(run('pdfArtboardRange([])'), '');
  assert.strictEqual(run('pdfArtboardRange([-1, 1.5, 3])'), '4');
});

test('representative artboard is the median by area', () => {
  assert.strictEqual(run('pdfPickRepresentative([30, 10, 20])'), 2);
  assert.strictEqual(run('pdfPickRepresentative([5])'), 0);
  assert.strictEqual(run('pdfPickRepresentative([10, 40, 20, 30])'), 2);
  assert.strictEqual(run('pdfPickRepresentative([])'), -1);
});

test('estimate scales a sample to the full artboard count', () => {
  assert.strictEqual(run('pdfScaleEstimate(1000, 1, 30)'), 30000);
  assert.strictEqual(run('pdfScaleEstimate(1000, 4, 4)'), 1000);
  assert.strictEqual(run('pdfScaleEstimate(1000, 0, 4)'), 0);
});

test('sample limit is 20 artboards', () => {
  assert.strictEqual(run('PDF_SAMPLE_LIMIT'), 20);
});
