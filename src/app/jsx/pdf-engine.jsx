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
  var key = level === "maximum" ? "JPEGMAXIMUM" : level === "medium" ? "JPEGMEDIUM" : "JPEGHIGH";
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
  if (!src) throw new Error("Save the document first: PDF export works from the saved file");
  if (!doc.saved) throw new Error("The document has unsaved changes. Save it first so the PDF matches what you see");

  var before = pdfDocIdentity(doc);
  var temp = new File(src.parent.fsName + "/~scctlm-" + new Date().getTime() + src.name.replace(/^[^.]*/, ""));
  if (!src.copy(temp)) throw new Error("Could not create a temporary copy of the document: " + src.error);

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
  if (indexes.length === 0) throw new Error("Select at least one artboard");
  return { doc: doc, indexes: indexes, job: job, identity: pdfDocIdentity(doc) };
}

// Final safety net: the PDF work must leave the user's document exactly as it was.
function enginePdfAssertUntouched(p) {
  if (pdfDocIdentity(p.doc) !== p.identity) {
    throw new Error("The open document changed during the PDF export; please check it before saving");
  }
}

function engineArtboardArea(ab) {
  var r = ab.artboardRect; // left, top, right, bottom
  return Math.abs((r[2] - r[0]) * (r[1] - r[3]));
}

// job: { artboards, quality, modes: ["print", "review"] }. Saves real trial PDFs into a temp folder and measures them.
// returns JSON: { ok, approx?, sizes?: { print: bytes, review: bytes }, error? }
function estimatePdf(jobJson) {
  var tempRoot = null;
  try {
    if (app.documents.length === 0) return JSON.stringify({ ok: false, error: "No open document" });
    var p = enginePdfJob(jobJson);
    var modes = p.job.modes || ["print", "review"];
    var sample = p.indexes;
    var approx = false;
    if (p.indexes.length > PDF_SAMPLE_LIMIT) {
      var areas = [];
      for (var i = 0; i < p.indexes.length; i++) areas.push(engineArtboardArea(p.doc.artboards[p.indexes[i]]));
      sample = [p.indexes[pdfPickRepresentative(areas)]];
      approx = true;
    }
    tempRoot = new Folder(Folder.temp.fsName + "/scctlm-ilus-pdf-" + new Date().getTime());
    tempRoot.create();
    var sizes = enginePdfWithCopy(p.doc, function (copyDoc) {
      var out = {};
      for (var m = 0; m < modes.length; m++) {
        var target = new File(tempRoot.fsName + "/estimate_" + modes[m] + ".pdf");
        enginePdfSave(copyDoc, sample, pdfModeDescriptor(modes[m], p.job.quality), target);
        out[modes[m]] = approx ? pdfScaleEstimate(target.length, sample.length, p.indexes.length) : target.length;
      }
      return out;
    });
    enginePdfAssertUntouched(p);
    return JSON.stringify({ ok: true, approx: approx, sizes: sizes });
  } catch (e) {
    return JSON.stringify({ ok: false, error: engineErrorMessage(e) });
  } finally {
    if (tempRoot && tempRoot.exists) {
      try { engineRemoveFolder(tempRoot); } catch (ignore) {}
    }
  }
}

// job: { artboards, mode, quality, layout: "single"|"separate", outputDir }
// returns JSON: { ok, error?, files: [{path, ok, error}] }
function runPdfExport(jobJson) {
  var files = [];
  try {
    if (app.documents.length === 0) return JSON.stringify({ ok: false, error: "No open document", files: files });
    var p = enginePdfJob(jobJson);
    var descriptor = pdfModeDescriptor(p.job.mode, p.job.quality);
    var outDir = new Folder(p.job.outputDir);
    if (!outDir.exists && !outDir.create()) {
      return JSON.stringify({ ok: false, error: "Cannot create output folder: " + p.job.outputDir, files: files });
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
