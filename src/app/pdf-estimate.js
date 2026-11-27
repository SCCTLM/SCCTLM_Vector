// Fast analytical PDF size estimator (pure, ES3-safe, works in CEP browser and Node tests).
// Replaces slow full trial saveAs exports with sub-millisecond estimation from a lightweight
// read-only document profile.
(function (global) {
  'use strict';

  var BASE_FILE_OVERHEAD = 18 * 1024;   // ~18 KB per PDF file (header, catalog, ICC, xref)
  var PER_PAGE_OVERHEAD = 4 * 1024;     // ~4 KB per artboard page dictionary & resources
  var BYTES_PER_PATH = 95;              // Flate-compressed bezier path average
  var BYTES_PER_TEXT = 420;             // Text frame + amortized subset font glyphs
  var BYTES_PER_MESH = 4500;            // Gradient mesh shading dictionary
  var BYTES_PER_SYMBOL = 160;           // XObject form reference

  function num(v) {
    var n = Number(v);
    return (isFinite(n) && n > 0) ? n : 0;
  }

  function clampCompression(compression) {
    var c = Number(compression);
    if (!isFinite(c)) return 50;
    if (c < 0) return 0;
    if (c > 100) return 100;
    return c;
  }

  // Smooth, strictly decreasing JPEG compression ratio (compressed / raw uncompressed pixels).
  // c = 0 (max quality) -> ~0.180 (~5.5:1), c = 20 -> ~0.110, c = 50 -> ~0.056,
  // c = 80 -> ~0.033, c = 100 (min quality) -> ~0.026 (~38:1).
  function jpegCompressionRatio(compression) {
    var c = clampCompression(compression);
    return 0.016 + 0.164 * Math.exp(-0.028 * c);
  }

  function computeSelectionRatio(profile, selectedArtboards, selectedCount, totalArtboards) {
    var countRatio = Math.min(1, selectedCount / totalArtboards);
    var areas = profile && profile.artboardAreas;
    if (areas && areas.length > 0 && selectedArtboards && selectedArtboards.length > 0) {
      var totalArea = 0;
      var i;
      for (i = 0; i < areas.length; i++) totalArea += num(areas[i]);
      if (totalArea > 0) {
        var selectedArea = 0;
        var seen = {};
        for (i = 0; i < selectedArtboards.length; i++) {
          var idx = Number(selectedArtboards[i]);
          if (idx >= 0 && idx < areas.length && idx === Math.floor(idx) && !seen[idx]) {
            seen[idx] = true;
            selectedArea += num(areas[idx]);
          }
        }
        var areaRatio = Math.min(1, selectedArea / totalArea);
        return 0.6 * areaRatio + 0.4 * countRatio;
      }
    }
    return countRatio;
  }

  // opts: { docProfile, mode: "print"|"review", compression: 0..100, layout: "single"|"separate",
  //         selectedArtboardCount?, selectedArtboards? }
  // Returns estimated total PDF bytes (integer >= 0).
  function estimatePdfBytes(opts) {
    opts = opts || {};
    var profile = opts.docProfile || {};
    var mode = opts.mode === 'review' ? 'review' : 'print';
    var layout = opts.layout === 'separate' ? 'separate' : 'single';
    var c = clampCompression(opts.compression);

    var selectedList = opts.selectedArtboards;
    var selectedCount = (typeof opts.selectedArtboardCount === 'number' && isFinite(opts.selectedArtboardCount))
      ? Math.max(0, Math.floor(opts.selectedArtboardCount))
      : (selectedList && selectedList.length ? selectedList.length : 0);

    if (selectedCount <= 0) return 0;

    var totalArtboards = Math.max(selectedCount, Math.floor(num(profile.totalArtboards)) || 1);
    var selectionRatio = computeSelectionRatio(profile, selectedList, selectedCount, totalArtboards);

    // 1. PDF structural overhead (single multi-page file vs N separate files)
    var overheadBytes = layout === 'separate'
      ? selectedCount * (BASE_FILE_OVERHEAD + PER_PAGE_OVERHEAD)
      : BASE_FILE_OVERHEAD + selectedCount * PER_PAGE_OVERHEAD;

    // 2. Vector & text content (Flate-compressed, independent of JPEG slider)
    var vectorTotal =
      num(profile.pathCount) * BYTES_PER_PATH +
      num(profile.textCount) * BYTES_PER_TEXT +
      num(profile.meshCount) * BYTES_PER_MESH +
      num(profile.symbolCount) * BYTES_PER_SYMBOL;
    var vectorBytes = vectorTotal * selectionRatio;

    // 3. Raster & placed image content (JPEG-compressed, downsampled in review mode)
    var rawPrint = num(profile.rasterRawBytes) + num(profile.placedRawBytes);
    var rawReview = num(profile.rasterReviewRawBytes) + num(profile.placedReviewRawBytes);
    var linkedBytes = num(profile.linkedFileBytes);

    if (rawPrint <= 0 && linkedBytes > 0) {
      rawPrint = linkedBytes * 3.5;
      rawReview = linkedBytes * 1.4;
    }
    if (rawReview <= 0 && rawPrint > 0) {
      // If profiler didn't separate review pixels, estimate moderate downsampling reduction.
      rawReview = rawPrint * 0.5;
    }
    rawReview = Math.min(rawReview, rawPrint);

    var rawModeBytes = mode === 'review' ? rawReview : rawPrint;
    var ratio = jpegCompressionRatio(c);
    var rasterBytes = rawModeBytes * ratio * selectionRatio;

    var contentBytes = vectorBytes + rasterBytes;

    // 4. Calibration from saved source .ai file size (accounts for live effects, embedded fonts,
    //    opacity masks, etc., while stripping ~58% Illustrator Private Data stream).
    var sourceFileBytes = num(profile.sourceFileBytes);
    if (sourceFileBytes > 0) {
      var hasRaster = rawPrint > 0 || linkedBytes > 0 || num(profile.rasterTotalCount) > 0 || num(profile.placedTotalCount) > 0;
      var aiPdfBaseline = sourceFileBytes * 0.42 * selectionRatio;
      var modeFactor = mode === 'review' ? (hasRaster ? 0.55 : 0.88) : 1.0;
      var maxRatio = jpegCompressionRatio(0);
      var compFactor = 0.45 + 0.55 * (ratio / maxRatio);
      var calibrated = aiPdfBaseline * modeFactor * compFactor;
      if (calibrated > contentBytes) {
        contentBytes = 0.5 * contentBytes + 0.5 * calibrated;
      }
    }

    return Math.max(1024, Math.round(overheadBytes + contentBytes));
  }

  var api = {
    BASE_FILE_OVERHEAD: BASE_FILE_OVERHEAD,
    PER_PAGE_OVERHEAD: PER_PAGE_OVERHEAD,
    jpegCompressionRatio: jpegCompressionRatio,
    estimatePdfBytes: estimatePdfBytes
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.PdfEstimate = api;
}(typeof window !== 'undefined' ? window : globalThis));
