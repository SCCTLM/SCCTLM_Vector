// PDF export through PDFSaveOptions (per-image compression, multi-page output, no editing data).
// Included by engine.jsx, which provides engineResolveArtboards, engineRemoveFolder and engineErrorMessage.

// Illustrator names the same setting differently across versions; each property is set on its own so one
// missing name cannot abort the export. Names that visibly failed are reported back (a silent no-op on an
// unknown name cannot be detected from script, so the manual spike checks the resulting sizes).
function pdfTrySet(opts, name, value, skipped) {
  try {
    opts[name] = value;
  } catch (e) {
    skipped.push(name);
  }
}

function pdfJpegConstant(level) {
  var keys = { maximum: "JPEGMAXIMUM", high: "JPEGHIGH", medium: "JPEGMEDIUM", low: "JPEGLOW", minimum: "JPEGMINIMUM" };
  var key = keys[level] || "JPEGMEDIUM";
  return CompressionQuality[key];
}

// descriptor: from pdfModeDescriptor. Returns { opts, skipped }.
function enginePdfOptions(descriptor, artboardRange) {
  var opts = new PDFSaveOptions();
  var skipped = [];
  pdfTrySet(opts, "pDFPreset", descriptor.preset, skipped);
  pdfTrySet(opts, "preserveEditability", descriptor.preserveEditability, skipped);
  pdfTrySet(opts, "viewAfterSaving", false, skipped);
  pdfTrySet(opts, "bleedLink", true, skipped);
  pdfTrySet(opts, "artboardRange", artboardRange, skipped);
  pdfTrySet(opts, "saveMultipleArtboards", false, skipped);

  // Downsampling first, compression last: measured on Illustrator 26, setting the downsampling properties after
  // the compression level changes the resulting JPEG quality.
  if (descriptor.downsample) {
    var bicubic = DownsampleMethod.BICUBICDOWNSAMPLE;
    pdfTrySet(opts, "colorDownsampling", descriptor.downsample.ppi, skipped);
    pdfTrySet(opts, "colorDownsamplingImageThreshold", descriptor.downsample.threshold, skipped);
    pdfTrySet(opts, "colorDownsamplingMethod", bicubic, skipped);
    pdfTrySet(opts, "grayscaleDownsampling", descriptor.downsample.ppi, skipped);
    pdfTrySet(opts, "grayscaleDownsamplingImageThreshold", descriptor.downsample.threshold, skipped);
    pdfTrySet(opts, "grayscaleDownsamplingMethod", bicubic, skipped);
  }
  var jpeg = pdfJpegConstant(descriptor.jpegQuality);
  pdfTrySet(opts, "colorCompression", jpeg, skipped);
  pdfTrySet(opts, "grayscaleCompression", jpeg, skipped);
  return { opts: opts, skipped: skipped };
}

// Identity of a document, used to prove the user's document was not touched.
function pdfDocIdentity(doc) {
  var path = "";
  try { path = doc.fullName.fsName; } catch (ignore) {}
  return doc.name + "|" + path + "|" + doc.saved;
}

// A PDF saveAs can re-link the document it runs on to the new file, so every save runs on a temporary copy
// of the saved file (next to the original, so relative links still resolve) that is closed without saving
// and deleted afterwards. The user's document is never the one being saved.
function enginePdfWithCopy(doc, work) {
  var src = null;
  try { src = doc.fullName; } catch (ignore) {}
  if (!src) throw new Error("H\u00e3y l\u01b0u t\u00e0i li\u1ec7u tr\u01b0\u1edbc: xu\u1ea5t PDF d\u00f9ng t\u1ec7p \u0111\u00e3 l\u01b0u");
  if (!doc.saved) throw new Error("T\u00e0i li\u1ec7u c\u00f3 thay \u0111\u1ed5i ch\u01b0a l\u01b0u. H\u00e3y l\u01b0u tr\u01b0\u1edbc \u0111\u1ec3 PDF kh\u1edbp v\u1edbi nh\u1eefng g\u00ec b\u1ea1n th\u1ea5y");

  var before = pdfDocIdentity(doc);
  var temp = new File(src.parent.fsName + "/~scctlm-" + new Date().getTime() + src.name.replace(/^[^.]*/, ""));
  if (!src.copy(temp)) throw new Error("Kh\u00f4ng t\u1ea1o \u0111\u01b0\u1ee3c b\u1ea3n sao t\u1ea1m c\u1ee7a t\u00e0i li\u1ec7u: " + src.error);

  var level = app.userInteractionLevel;
  var copyDoc = null;
  try {
    app.userInteractionLevel = UserInteractionLevel.DONTDISPLAYALERTS;
    copyDoc = app.open(temp);
    return work(copyDoc);
  } finally {
    if (copyDoc) { try { copyDoc.close(SaveOptions.DONOTSAVECHANGES); } catch (ignoreClose) {} }
    try { doc.activate(); } catch (ignoreActivate) {}
    app.userInteractionLevel = level;
    try { if (temp.exists) temp.remove(); } catch (ignoreRemove) {}
  }
}

function enginePdfSave(copyDoc, indexes, descriptor, target) {
  copyDoc.saveAs(target, enginePdfOptions(descriptor, pdfArtboardRange(indexes)).opts);
}

function enginePdfJob(jobJson) {
  var job = typeof jobJson === "string" ? JSON.parse(jobJson) : jobJson;
  var doc = app.activeDocument;
  var indexes = engineResolveArtboards(job.artboards, doc.artboards.length);
  if (indexes.length === 0) throw new Error("H\u00e3y ch\u1ecdn \u00edt nh\u1ea5t m\u1ed9t artboard");
  return { doc: doc, indexes: indexes, job: job, identity: pdfDocIdentity(doc) };
}

// Final safety net: the PDF work must leave the user's document exactly as it was.
function enginePdfAssertUntouched(p) {
  if (pdfDocIdentity(p.doc) !== p.identity) {
    throw new Error("T\u00e0i li\u1ec7u \u0111ang m\u1edf \u0111\u00e3 thay \u0111\u1ed5i trong l\u00fac xu\u1ea5t PDF; h\u00e3y ki\u1ec3m tra l\u1ea1i tr\u01b0\u1edbc khi l\u01b0u");
  }
}

var PDF_IMAGE_SCAN_LIMIT = 200;

function engineArtboardArea(ab) {
  var r = ab.artboardRect; // left, top, right, bottom
  return Math.abs((r[2] - r[0]) * (r[1] - r[3]));
}

function pdfSafeLength(collection) {
  try { return collection ? collection.length : 0; } catch (ignore) { return 0; }
}

// Estimates uncompressed pixel bytes for a RasterItem or PlacedItem at full resolution (print)
// and downsampled to 150 ppi when effective PPI exceeds 225 ppi (review).
function pdfMeasureImageBytes(item, defaultChannels) {
  var wPt = 0;
  var hPt = 0;
  try {
    wPt = Math.abs(Number(item.width) || 0);
    hPt = Math.abs(Number(item.height) || 0);
  } catch (ignore) {}
  if (!(wPt > 0 && hPt > 0)) return { printRaw: 0, reviewRaw: 0 };

  var channels = defaultChannels || 3;
  try {
    if (typeof ImageColorSpace !== "undefined" && item.imageColorSpace !== undefined) {
      if (item.imageColorSpace === ImageColorSpace.GrayScale) channels = 1;
      else if (item.imageColorSpace === ImageColorSpace.CMYK) channels = 4;
      else if (item.imageColorSpace === ImageColorSpace.RGB) channels = 3;
    }
  } catch (ignore) {}

  var ppi = 300;
  try {
    var m = item.matrix;
    if (m) {
      var sx = Math.sqrt(m.mValueA * m.mValueA + m.mValueB * m.mValueB);
      var sy = Math.sqrt(m.mValueC * m.mValueC + m.mValueD * m.mValueD);
      var scale = Math.min(sx, sy);
      if (isFinite(scale) && scale > 0.01) {
        ppi = 72 / scale;
        if (ppi < 72) ppi = 72;
        if (ppi > 1200) ppi = 1200;
      }
    }
  } catch (ignore) {}

  var pxW = wPt * (ppi / 72);
  var pxH = hPt * (ppi / 72);
  var printRaw = pxW * pxH * channels;
  var reviewRaw = printRaw;
  if (ppi > 225) {
    var downScale = 150 / ppi;
    reviewRaw = printRaw * downScale * downScale;
  }
  return { printRaw: printRaw, reviewRaw: reviewRaw };
}

// Fast, read-only document profiler: zero disk writes, zero temp copy, O(1) counts + bounded image scan.
function pdfCollectDocProfile(doc) {
  var areas = [];
  var totalArtboards = pdfSafeLength(doc.artboards);
  var i;
  for (i = 0; i < totalArtboards; i++) {
    try { areas.push(engineArtboardArea(doc.artboards[i])); }
    catch (ignore) { areas.push(0); }
  }

  var colorSpace = "RGB";
  try {
    if (typeof DocumentColorSpace !== "undefined" && doc.documentColorSpace === DocumentColorSpace.CMYK) {
      colorSpace = "CMYK";
    }
  } catch (ignore) {}
  var defaultChannels = colorSpace === "CMYK" ? 4 : 3;

  var rasterTotal = pdfSafeLength(doc.rasterItems);
  var rasterLimit = rasterTotal < PDF_IMAGE_SCAN_LIMIT ? rasterTotal : PDF_IMAGE_SCAN_LIMIT;
  var rasterRaw = 0;
  var rasterReviewRaw = 0;
  for (i = 0; i < rasterLimit; i++) {
    try {
      var rBytes = pdfMeasureImageBytes(doc.rasterItems[i], defaultChannels);
      rasterRaw += rBytes.printRaw;
      rasterReviewRaw += rBytes.reviewRaw;
    } catch (ignore) {}
  }
  if (rasterLimit > 0 && rasterTotal > rasterLimit) {
    var rScale = rasterTotal / rasterLimit;
    rasterRaw *= rScale;
    rasterReviewRaw *= rScale;
  }

  var placedTotal = pdfSafeLength(doc.placedItems);
  var placedLimit = placedTotal < PDF_IMAGE_SCAN_LIMIT ? placedTotal : PDF_IMAGE_SCAN_LIMIT;
  var placedRaw = 0;
  var placedReviewRaw = 0;
  var linkedFileBytes = 0;
  for (i = 0; i < placedLimit; i++) {
    try {
      var placed = doc.placedItems[i];
      var pBytes = pdfMeasureImageBytes(placed, defaultChannels);
      placedRaw += pBytes.printRaw;
      placedReviewRaw += pBytes.reviewRaw;
      try {
        if (placed.file && placed.file.exists && placed.file.length > 0) {
          linkedFileBytes += placed.file.length;
        }
      } catch (ignoreFile) {}
    } catch (ignore) {}
  }
  if (placedLimit > 0 && placedTotal > placedLimit) {
    var pScale = placedTotal / placedLimit;
    placedRaw *= pScale;
    placedReviewRaw *= pScale;
    linkedFileBytes *= pScale;
  }

  var sourceFileBytes = 0;
  try {
    var src = doc.fullName;
    if (src && src.exists && src.length > 0) sourceFileBytes = src.length;
  } catch (ignore) {}

  return {
    docIdentity: pdfDocIdentity(doc),
    totalArtboards: totalArtboards,
    artboardAreas: areas,
    colorSpace: colorSpace,
    pathCount: pdfSafeLength(doc.pathItems),
    textCount: pdfSafeLength(doc.textFrames),
    meshCount: pdfSafeLength(doc.meshItems),
    symbolCount: pdfSafeLength(doc.symbolItems),
    rasterTotalCount: rasterTotal,
    rasterRawBytes: Math.round(rasterRaw),
    rasterReviewRawBytes: Math.round(rasterReviewRaw),
    placedTotalCount: placedTotal,
    placedRawBytes: Math.round(placedRaw),
    placedReviewRawBytes: Math.round(placedReviewRaw),
    linkedFileBytes: Math.round(linkedFileBytes),
    sourceFileBytes: Math.round(sourceFileBytes),
    docSaved: !!doc.saved
  };
}

// Read-only document profile entry point for instant client-side PDF estimation.
// returns JSON: { ok, profile?, error? }
function profilePdfDoc() {
  try {
    if (app.documents.length === 0) return JSON.stringify({ ok: false, error: "Ch\u01b0a m\u1edf t\u00e0i li\u1ec7u n\u00e0o" });
    var doc = app.activeDocument;
    return JSON.stringify({ ok: true, profile: pdfCollectDocProfile(doc) });
  } catch (e) {
    return JSON.stringify({ ok: false, error: engineErrorMessage(e) });
  }
}

// job: { artboards, compression, layout?, modes?: ["print", "review"] }.
// Fast read-only analytical estimate (no temp copy, no saveAs, no Illustrator freeze).
// returns JSON: { ok, approx: true, profile?, sizes?: { print: bytes, review: bytes }, error? }
function estimatePdf(jobJson) {
  try {
    if (app.documents.length === 0) return JSON.stringify({ ok: false, error: "Ch\u01b0a m\u1edf t\u00e0i li\u1ec7u n\u00e0o" });
    var p = enginePdfJob(jobJson);
    var modes = p.job.modes || ["print", "review"];
    var layout = p.job.layout === "separate" ? "separate" : "single";
    var profile = pdfCollectDocProfile(p.doc);
    var sizes = {};
    for (var m = 0; m < modes.length; m++) {
      sizes[modes[m]] = pdfEstimateFromProfile(profile, modes[m], p.job.compression, layout, p.indexes);
    }
    return JSON.stringify({ ok: true, approx: true, profile: profile, sizes: sizes });
  } catch (e) {
    return JSON.stringify({ ok: false, error: engineErrorMessage(e) });
  }
}

// job: { artboards, mode, compression, layout: "single"|"separate", outputDir }
// returns JSON: { ok, error?, files: [{path, ok, error}] }
function runPdfExport(jobJson) {
  var files = [];
  try {
    if (app.documents.length === 0) return JSON.stringify({ ok: false, error: "Ch\u01b0a m\u1edf t\u00e0i li\u1ec7u n\u00e0o", files: files });
    var p = enginePdfJob(jobJson);
    var descriptor = pdfModeDescriptor(p.job.mode, p.job.compression);
    var outDir = new Folder(p.job.outputDir);
    if (!outDir.exists && !outDir.create()) {
      return JSON.stringify({ ok: false, error: "Kh\u00f4ng t\u1ea1o \u0111\u01b0\u1ee3c th\u01b0 m\u1ee5c xu\u1ea5t: " + p.job.outputDir, files: files });
    }
    var docName = documentBaseName(p.doc.name);
    var suffix = pdfModeSuffix(descriptor.mode);
    var existsIn = function (candidate) { return new File(outDir.fsName + "/" + candidate).exists; };

    var jobs = [];
    if (p.job.layout === "separate") {
      var rawNames = [];
      for (var a = 0; a < p.doc.artboards.length; a++) rawNames.push(p.doc.artboards[a].name);
      var names = uniqueArtboardNames(rawNames);
      for (var k = 0; k < p.indexes.length; k++) {
        jobs.push({ indexes: [p.indexes[k]], base: namingTruncate(docName + "_" + names[p.indexes[k]]) + suffix });
      }
    } else {
      jobs.push({ indexes: p.indexes, base: namingTruncate(docName) + suffix });
    }

    enginePdfWithCopy(p.doc, function (copyDoc) {
      for (var j = 0; j < jobs.length; j++) {
        var target = new File(outDir.fsName + "/" + uniqueFileName(jobs[j].base, "pdf", existsIn));
        try {
          enginePdfSave(copyDoc, jobs[j].indexes, descriptor, target);
          files.push({ path: target.fsName, ok: true, error: "" });
        } catch (e) {
          files.push({ path: target.fsName, ok: false, error: engineErrorMessage(e) });
        }
      }
    });
    enginePdfAssertUntouched(p);
    var failed = 0;
    for (var f = 0; f < files.length; f++) if (!files[f].ok) failed++;
    return JSON.stringify({ ok: failed === 0, files: files });
  } catch (err) {
    return JSON.stringify({ ok: false, error: engineErrorMessage(err), files: files });
  }
}
