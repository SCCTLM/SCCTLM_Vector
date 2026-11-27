// Run: node --test tests/pdf-estimate.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { estimatePdfBytes, jpegCompressionRatio, BASE_FILE_OVERHEAD } = require('../src/app/pdf-estimate.js');

const rasterHeavyProfile = {
  totalArtboards: 4,
  artboardAreas: [600 * 800, 600 * 800, 600 * 800, 600 * 800],
  pathCount: 1200,
  textCount: 40,
  meshCount: 2,
  symbolCount: 10,
  rasterTotalCount: 8,
  rasterRawBytes: 8 * 2500 * 1800 * 4,       // ~144 MB uncompressed CMYK at 300 ppi
  rasterReviewRawBytes: 8 * 1250 * 900 * 4,  // ~36 MB downsampled to 150 ppi
  placedTotalCount: 2,
  placedRawBytes: 2 * 2000 * 1500 * 3,
  placedReviewRawBytes: 2 * 1000 * 750 * 3,
  linkedFileBytes: 4 * 1024 * 1024,
  sourceFileBytes: 60 * 1024 * 1024
};

const vectorOnlyProfile = {
  totalArtboards: 2,
  artboardAreas: [595 * 842, 595 * 842],
  pathCount: 3500,
  textCount: 120,
  meshCount: 4,
  symbolCount: 25,
  rasterTotalCount: 0,
  rasterRawBytes: 0,
  rasterReviewRawBytes: 0,
  placedTotalCount: 0,
  placedRawBytes: 0,
  placedReviewRawBytes: 0,
  linkedFileBytes: 0,
  sourceFileBytes: 0
};

test('jpegCompressionRatio is smooth and strictly decreasing from 0 to 100', () => {
  let prev = jpegCompressionRatio(0);
  for (let c = 1; c <= 100; c++) {
    const cur = jpegCompressionRatio(c);
    assert.ok(cur < prev, `ratio(${c})=${cur} must be < ratio(${c - 1})=${prev}`);
    assert.ok(cur > 0 && cur < 1);
    prev = cur;
  }
  assert.strictEqual(jpegCompressionRatio(-10), jpegCompressionRatio(0));
  assert.strictEqual(jpegCompressionRatio(150), jpegCompressionRatio(100));
});

test('estimatePdfBytes is monotonically non-increasing across compression 0..100 for both modes', () => {
  for (const mode of ['print', 'review']) {
    let prev = Infinity;
    for (let c = 0; c <= 100; c += 5) {
      const bytes = estimatePdfBytes({
        docProfile: rasterHeavyProfile,
        mode,
        compression: c,
        layout: 'single',
        selectedArtboards: [0, 1, 2, 3],
        selectedArtboardCount: 4
      });
      assert.ok(bytes <= prev, `mode=${mode} c=${c}: ${bytes} should be <= ${prev}`);
      prev = bytes;
    }
    const at0 = estimatePdfBytes({ docProfile: rasterHeavyProfile, mode, compression: 0, layout: 'single', selectedArtboardCount: 4 });
    const at100 = estimatePdfBytes({ docProfile: rasterHeavyProfile, mode, compression: 100, layout: 'single', selectedArtboardCount: 4 });
    assert.ok(at100 < at0, `mode=${mode}: 100% compression must be strictly smaller than 0%`);
  }
});

test('review mode is smaller than print mode for raster-heavy documents', () => {
  for (const c of [0, 20, 50, 80, 100]) {
    const printBytes = estimatePdfBytes({ docProfile: rasterHeavyProfile, mode: 'print', compression: c, layout: 'single', selectedArtboardCount: 4 });
    const reviewBytes = estimatePdfBytes({ docProfile: rasterHeavyProfile, mode: 'review', compression: c, layout: 'single', selectedArtboardCount: 4 });
    assert.ok(reviewBytes < printBytes, `c=${c}: review (${reviewBytes}) must be < print (${printBytes})`);
  }
});

test('separate layout adds per-file PDF overhead when multiple artboards are selected', () => {
  const single4 = estimatePdfBytes({ docProfile: vectorOnlyProfile, mode: 'print', compression: 20, layout: 'single', selectedArtboardCount: 2 });
  const sep4 = estimatePdfBytes({ docProfile: vectorOnlyProfile, mode: 'print', compression: 20, layout: 'separate', selectedArtboardCount: 2 });
  assert.strictEqual(sep4 - single4, BASE_FILE_OVERHEAD);

  const single1 = estimatePdfBytes({ docProfile: vectorOnlyProfile, mode: 'print', compression: 20, layout: 'single', selectedArtboardCount: 1 });
  const sep1 = estimatePdfBytes({ docProfile: vectorOnlyProfile, mode: 'print', compression: 20, layout: 'separate', selectedArtboardCount: 1 });
  assert.strictEqual(sep1, single1, 'single artboard has identical overhead for single vs separate');
});

test('scales proportionally with selected artboard count and artboard areas', () => {
  const oneOfFour = estimatePdfBytes({ docProfile: rasterHeavyProfile, mode: 'print', compression: 20, layout: 'single', selectedArtboards: [0], selectedArtboardCount: 1 });
  const twoOfFour = estimatePdfBytes({ docProfile: rasterHeavyProfile, mode: 'print', compression: 20, layout: 'single', selectedArtboards: [0, 1], selectedArtboardCount: 2 });
  const allFour = estimatePdfBytes({ docProfile: rasterHeavyProfile, mode: 'print', compression: 20, layout: 'single', selectedArtboards: [0, 1, 2, 3], selectedArtboardCount: 4 });
  assert.ok(oneOfFour < twoOfFour && twoOfFour < allFour);

  // Unequal artboards: selecting the large artboard estimates more than selecting the small one
  const unequal = Object.assign({}, rasterHeavyProfile, { totalArtboards: 2, artboardAreas: [100 * 100, 2000 * 2000] });
  const smallAb = estimatePdfBytes({ docProfile: unequal, mode: 'print', compression: 20, layout: 'single', selectedArtboards: [0], selectedArtboardCount: 1 });
  const largeAb = estimatePdfBytes({ docProfile: unequal, mode: 'print', compression: 20, layout: 'single', selectedArtboards: [1], selectedArtboardCount: 1 });
  assert.ok(largeAb > smallAb, `large artboard (${largeAb}) should estimate > small artboard (${smallAb})`);
});

test('handles vector-only, unsaved/empty, and 0-artboard edge cases sensibly', () => {
  assert.strictEqual(estimatePdfBytes({ docProfile: vectorOnlyProfile, mode: 'print', compression: 20, layout: 'single', selectedArtboardCount: 0 }), 0);

  const emptyDoc = estimatePdfBytes({ docProfile: { totalArtboards: 1 }, mode: 'print', compression: 20, layout: 'single', selectedArtboardCount: 1 });
  assert.ok(emptyDoc >= 18 * 1024 && emptyDoc <= 30 * 1024, `empty unsaved doc should return sensible header overhead, got ${emptyDoc}`);

  const vecBytes = estimatePdfBytes({ docProfile: vectorOnlyProfile, mode: 'print', compression: 20, layout: 'single', selectedArtboardCount: 2 });
  assert.ok(vecBytes > 200 * 1024 && vecBytes < 2 * 1024 * 1024, `vector doc estimate should be realistic, got ${vecBytes}`);

  // Missing profile object does not throw
  const missing = estimatePdfBytes({ mode: 'review', compression: NaN, layout: 'single', selectedArtboardCount: 1 });
  assert.ok(missing >= 1024);
});

test('pdfEstimateFromProfile in pdf-options.jsx matches estimatePdfBytes in pdf-estimate.js', () => {
  const ctx = vm.createContext({});
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../src/app/jsx/pdf-options.jsx'), 'utf8'), ctx);
  ctx.profile = rasterHeavyProfile;
  for (const mode of ['print', 'review']) {
    for (const c of [0, 20, 50, 80, 100]) {
      for (const layout of ['single', 'separate']) {
        const jsVal = estimatePdfBytes({
          docProfile: rasterHeavyProfile,
          mode,
          compression: c,
          layout,
          selectedArtboards: [0, 2],
          selectedArtboardCount: 2
        });
        const jsxVal = vm.runInContext(`pdfEstimateFromProfile(profile, "${mode}", ${c}, "${layout}", [0, 2])`, ctx);
        assert.strictEqual(jsxVal, jsVal, `mismatch for ${mode}/${c}/${layout}`);
      }
    }
  }
});
