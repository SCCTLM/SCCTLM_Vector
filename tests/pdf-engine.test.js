// Run: node --test tests/
// The engine runs inside Illustrator; these tests load it against small recording stand-ins for the
// Illustrator objects it touches, to pin the behaviour that was learned from real runs.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function load(overrides) {
  const assigned = [];
  const ctx = {
    CompressionQuality: { JPEGMAXIMUM: 'jpeg-max', JPEGHIGH: 'jpeg-high', JPEGMEDIUM: 'jpeg-medium' },
    DownsampleMethod: { BICUBICDOWNSAMPLE: 'bicubic' },
    UserInteractionLevel: { DONTDISPLAYALERTS: 'quiet' },
    SaveOptions: { DONOTSAVECHANGES: 'dont-save' },
    PDFSaveOptions: function () {
      return new Proxy({}, {
        set(target, key, value) {
          if (overrides && overrides.throwOn === key) throw new Error('unsupported');
          assigned.push([key, value]);
          target[key] = value;
          return true;
        }
      });
    }
  };
  vm.createContext(ctx);
  for (const f of ['pdf-options.jsx', 'pdf-engine.jsx']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../src/app/jsx', f), 'utf8'), ctx);
  }
  return { ctx, assigned, run: (code) => vm.runInContext(code, ctx) };
}

const names = (assigned) => assigned.map((a) => a[0]);

test('compression is assigned after downsampling', () => {
  const { assigned, run } = load();
  run('enginePdfOptions(pdfModeDescriptor("review", "medium"), "1-3")');
  const order = names(assigned);
  assert.ok(order.indexOf('colorCompression') > order.lastIndexOf('colorDownsamplingMethod'));
  assert.ok(order.indexOf('grayscaleCompression') > order.lastIndexOf('grayscaleDownsamplingMethod'));
});

test('review mode sets 150 ppi / 225 threshold bicubic and the chosen JPEG level', () => {
  const { assigned, run } = load();
  run('enginePdfOptions(pdfModeDescriptor("review", "medium"), "1-3")');
  const get = (k) => assigned.find((a) => a[0] === k)[1];
  assert.strictEqual(get('colorDownsampling'), 150);
  assert.strictEqual(get('colorDownsamplingImageThreshold'), 225);
  assert.strictEqual(get('colorDownsamplingMethod'), 'bicubic');
  assert.strictEqual(get('colorCompression'), 'jpeg-medium');
  assert.strictEqual(get('preserveEditability'), false);
  assert.strictEqual(get('artboardRange'), '1-3');
});

test('print mode sets no downsampling and JPEG maximum', () => {
  const { assigned, run } = load();
  run('enginePdfOptions(pdfModeDescriptor("print"), "2")');
  assert.ok(!names(assigned).some((n) => /Downsampling/.test(n)));
  assert.strictEqual(assigned.find((a) => a[0] === 'colorCompression')[1], 'jpeg-max');
  assert.strictEqual(assigned.find((a) => a[0] === 'preserveEditability')[1], false);
});

test('a property that throws is reported and does not stop the others', () => {
  const { run } = load({ throwOn: 'saveMultipleArtboards' });
  const skipped = JSON.parse(run('JSON.stringify(enginePdfOptions(pdfModeDescriptor("print"), "1").skipped)'));
  assert.deepStrictEqual(skipped, ['saveMultipleArtboards']);
});

function fakeDoc(extra) {
  const log = [];
  const temp = { exists: true, remove() { this.exists = false; log.push('temp removed'); }, name: 'x' };
  const src = {
    name: 'Doc.ai',
    parent: { fsName: 'C:/work' },
    copy() { log.push('copied'); return true; }
  };
  const doc = Object.assign({ name: 'Doc.ai', saved: true, fullName: src, activate() { log.push('activated'); } }, extra);
  return { doc, log, temp };
}

function loadWithApp(appExtra) {
  const l = load();
  const copyDoc = { close(opt) { l.log.push('closed:' + opt); } };
  l.log = [];
  l.ctx.app = Object.assign({ userInteractionLevel: 'normal', open() { l.log.push('opened'); return copyDoc; } }, appExtra);
  l.ctx.File = function () { return { exists: true, remove() { l.log.push('temp removed'); } }; };
  return l;
}

test('saving works on a temporary copy that is closed, deleted and leaves alerts restored', () => {
  const l = loadWithApp();
  const { doc, log } = fakeDoc();
  l.ctx.doc = doc;
  l.ctx.log = log;
  l.ctx.app.open = () => { log.push('opened'); return { close(o) { log.push('closed:' + o); } }; };
  l.ctx.File = function () { return { exists: true, remove() { log.push('temp removed'); } }; };
  const result = l.run('enginePdfWithCopy(doc, function (c) { return "done"; })');
  assert.strictEqual(result, 'done');
  assert.deepStrictEqual(log, ['copied', 'opened', 'closed:dont-save', 'activated', 'temp removed']);
  assert.strictEqual(l.ctx.app.userInteractionLevel, 'normal');
});

test('copy is cleaned up even when the work throws', () => {
  const l = loadWithApp();
  const { doc, log } = fakeDoc();
  l.ctx.doc = doc;
  l.ctx.app.open = () => { log.push('opened'); return { close() { log.push('closed'); } }; };
  l.ctx.File = function () { return { exists: true, remove() { log.push('temp removed'); } }; };
  assert.throws(() => l.run('enginePdfWithCopy(doc, function () { throw new Error("boom"); })'), /boom/);
  assert.ok(log.includes('closed') && log.includes('temp removed'));
  assert.strictEqual(l.ctx.app.userInteractionLevel, 'normal');
});

test('an unsaved or never-saved document is refused before anything is opened', () => {
  const l = loadWithApp();
  l.ctx.app.open = () => { throw new Error('must not open'); };
  l.ctx.dirty = { name: 'Doc.ai', saved: false, fullName: { name: 'Doc.ai', parent: { fsName: 'C:/work' } } };
  assert.throws(() => l.run('enginePdfWithCopy(dirty, function () {})'), /thay đổi chưa lưu/);
  l.ctx.fresh = { name: 'Untitled-1', saved: false, get fullName() { throw new Error('no file'); } };
  assert.throws(() => l.run('enginePdfWithCopy(fresh, function () {})'), /Hãy lưu tài liệu trước/);
});

test('a failed copy is reported', () => {
  const l = loadWithApp();
  l.ctx.broken = { name: 'Doc.ai', saved: true, fullName: { name: 'Doc.ai', parent: { fsName: 'C:/work' }, copy() { return false; }, error: 'denied' } };
  l.ctx.File = function () { return { exists: false }; };
  assert.throws(() => l.run('enginePdfWithCopy(broken, function () {})'), /bản sao tạm.*denied/);
});
