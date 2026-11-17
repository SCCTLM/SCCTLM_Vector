// Batch export engine. JSON string in, JSON string out; never shows native alerts.
#include "json2.jsx"
#include "naming.jsx"
#include "pdf-options.jsx"
#include "pdf-engine.jsx"
#include "grid-geometry.jsx"
#include "grid-engine.jsx"
#include "color-engine.jsx"
#include "artboard-size.jsx"

var ENGINE_FORMATS = {
  png: { ext: "png", raster: true, typeConst: "SE_PNG24" },
  jpg: { ext: "jpg", raster: true, typeConst: "SE_JPEG100" },
  svg: { ext: "svg", raster: false, typeConst: "SE_SVG" },
  pdf: { ext: "pdf", raster: false, typeConst: "SE_PDF" }
};

function engineErrorMessage(e) {
  return e && e.message ? e.message : String(e);
}

// Saved path tells apart same-named files from different folders; unsaved docs have no path.
function engineDocPath(doc) {
  try { return doc.fullName.fsName; } catch (ignore) { return ""; }
}

// Artboards for the UI: [{index (0-based), name, widthPt, heightPt}]
function listArtboards() {
  try {
    if (app.documents.length === 0) {
      return JSON.stringify({ ok: false, error: "Ch\u01b0a m\u1edf t\u00e0i li\u1ec7u n\u00e0o", artboards: [] });
    }
    var doc = app.activeDocument;
    var out = [];
    for (var i = 0; i < doc.artboards.length; i++) {
      var size = artboardSizeOf(doc.artboards[i].artboardRect);
      out.push({ index: i, name: doc.artboards[i].name, widthPt: size.width, heightPt: size.height });
    }
    var colorSpace = (typeof DocumentColorSpace !== "undefined" && doc.documentColorSpace === DocumentColorSpace.CMYK) ? "CMYK" : "RGB";
    return JSON.stringify({ ok: true, docName: documentBaseName(doc.name), docPath: engineDocPath(doc), colorSpace: colorSpace, artboards: out });
  } catch (e) {
    return JSON.stringify({ ok: false, error: engineErrorMessage(e), artboards: [] });
  }
}

function engineSetDocumentColorSpace(space) {
  try {
    if (app.documents.length === 0) {
      return JSON.stringify({ ok: false, error: "Ch\u01b0a m\u1edf t\u00e0i li\u1ec7u n\u00e0o" });
    }
    var doc = app.activeDocument;
    var target = String(space || "").toUpperCase();
    if (target === "RGB") {
      if (typeof DocumentColorSpace !== "undefined" && doc.documentColorSpace !== DocumentColorSpace.RGB) {
        app.executeMenuCommand("doc-color-rgb");
      }
    } else if (target === "CMYK") {
      if (typeof DocumentColorSpace !== "undefined" && doc.documentColorSpace !== DocumentColorSpace.CMYK) {
        app.executeMenuCommand("doc-color-cmyk");
      }
    } else {
      return JSON.stringify({ ok: false, error: "H\u1ec7 m\u00e0u kh\u00f4ng h\u1ee3p l\u1ec7" });
    }
    var actual = (typeof DocumentColorSpace !== "undefined" && app.activeDocument.documentColorSpace === DocumentColorSpace.CMYK) ? "CMYK" : "RGB";
    return JSON.stringify({ ok: true, colorSpace: actual });
  } catch (e) {
    return JSON.stringify({ ok: false, error: engineErrorMessage(e) });
  }
}

function engineResolveArtboards(spec, count) {
  var result = [];
  var i;
  if (spec === "all" || spec === undefined || spec === null) {
    for (i = 0; i < count; i++) result.push(i);
    return result;
  }
  if (Object.prototype.toString.call(spec) !== "[object Array]") {
    throw new Error('"artboards" ph\u1ea3i l\u00e0 "all" ho\u1eb7c m\u1ea3ng ch\u1ec9 s\u1ed1');
  }
  var seen = {};
  for (i = 0; i < spec.length; i++) {
    var n = Number(spec[i]);
    if (n >= 0 && n < count && n === Math.floor(n) && !seen[n]) {
      seen[n] = true;
      result.push(n);
    }
  }
  result.sort(function (a, b) { return a - b; });
  return result;
}

// job: { artboards: "all" | [indexes], swap?: true, widthPt?, heightPt? }
// Resizes or flips artboards in place; each keeps its top-left corner and no artwork is scaled.
// Every target is validated before the first write, and a host failure restores the ones already
// written. Sizes are read back from the document, so a host-side clamp cannot be reported as success.
function engineResizeArtboards(jobJson) {
  try {
    if (app.documents.length === 0) {
      return JSON.stringify({ ok: false, error: "Ch\u01b0a m\u1edf t\u00e0i li\u1ec7u n\u00e0o" });
    }
    var job = JSON.parse(jobJson || "{}");
    var doc = app.activeDocument;
    var i;
    var indexes = engineResolveArtboards(job.artboards, doc.artboards.length);
    if (indexes.length === 0) throw new Error("H\u00e3y ch\u1ecdn \u00edt nh\u1ea5t m\u1ed9t artboard");
    // The panel sends what it displayed (document, count and per-target names). Indexes are only
    // positional, so any mismatch means the document changed since that list was read.
    if (typeof job.docPath === "string" && job.docPath !== engineDocPath(doc)) {
      throw new Error("T\u00e0i li\u1ec7u \u0111\u00e3 thay \u0111\u1ed5i; h\u00e3y ch\u1ecdn l\u1ea1i artboard");
    }
    if (typeof job.docName === "string" && documentBaseName(doc.name) !== job.docName) {
      throw new Error("T\u00e0i li\u1ec7u \u0111\u00e3 thay \u0111\u1ed5i; h\u00e3y ch\u1ecdn l\u1ea1i artboard");
    }
    if (typeof job.count === "number" && job.count !== doc.artboards.length) {
      throw new Error("T\u00e0i li\u1ec7u \u0111\u00e3 thay \u0111\u1ed5i; h\u00e3y ch\u1ecdn l\u1ea1i artboard");
    }
    if (Object.prototype.toString.call(job.targets) === "[object Array]") {
      for (i = 0; i < job.targets.length; i++) {
        var target = job.targets[i];
        var targetIndex = target ? Number(target.index) : -1;
        if (targetIndex >= 0 && targetIndex < doc.artboards.length &&
            doc.artboards[targetIndex].name !== target.name) {
          throw new Error("T\u00e0i li\u1ec7u \u0111\u00e3 thay \u0111\u1ed5i; h\u00e3y ch\u1ecdn l\u1ea1i artboard");
        }
      }
    }
    var swap = !!job.swap;
    var sized = typeof job.widthPt === "number" && isFinite(job.widthPt) && job.widthPt > 0 &&
      typeof job.heightPt === "number" && isFinite(job.heightPt) && job.heightPt > 0;
    if (!swap && !sized) {
      throw new Error("Chi\u1ec1u r\u1ed9ng v\u00e0 chi\u1ec1u cao ph\u1ea3i l\u1edbn h\u01a1n 0");
    }
    var targets = [];
    for (i = 0; i < indexes.length; i++) {
      var r = doc.artboards[indexes[i]].artboardRect;
      var original = [r[0], r[1], r[2], r[3]];
      targets.push({
        index: indexes[i],
        original: original,
        next: swap ? artboardSwapRect(original) : artboardResizeRect(original, job.widthPt, job.heightPt)
      });
    }
    // One failure path: a throwing setter and a host that clamps instead of applying both end in a
    // rollback, so the document never keeps a size the caller was not told about. Every target is
    // verified against the rectangle that was written, swap included, and the origin is checked too.
    var written = [];
    var out = [];
    var failed = null;
    var unrestored = 0;
    try {
      for (i = 0; i < targets.length; i++) {
        doc.artboards[targets[i].index].artboardRect = targets[i].next;
        written.push(targets[i]);
      }
      for (i = 0; i < targets.length; i++) {
        var now = doc.artboards[targets[i].index].artboardRect;
        var size = artboardSizeOf(now);
        if (artboardRectDiffers(now, targets[i].next)) {
          failed = "Illustrator gi\u1edbi h\u1ea1n k\u00edch th\u01b0\u1edbc: artboard " + (targets[i].index + 1) +
            " c\u00f2n " + artboardFormatSize(size.width, "pt") + " x " +
            artboardFormatSize(size.height, "pt") + " pt";
          break;
        }
        out.push({ index: targets[i].index, widthPt: size.width, heightPt: size.height });
      }
    } catch (e) {
      failed = "Kh\u00f4ng \u0111\u1ed5i \u0111\u01b0\u1ee3c k\u00edch th\u01b0\u1edbc artboard: " + engineErrorMessage(e);
    }
    if (failed) {
      for (i = written.length - 1; i >= 0; i--) {
        try { doc.artboards[written[i].index].artboardRect = written[i].original; }
        catch (ignore) { unrestored++; }
      }
      if (unrestored > 0) {
        throw new Error(failed + " (kh\u00f4ng kh\u00f4i ph\u1ee5c \u0111\u01b0\u1ee3c " + unrestored + " artboard)");
      }
      throw new Error(failed);
    }
    return JSON.stringify({ ok: true, artboards: out });
  } catch (e) {
    return JSON.stringify({ ok: false, error: engineErrorMessage(e) });
  }
}

function engineCollectFiles(folder, acc) {
  var items = folder.getFiles();
  for (var i = 0; i < items.length; i++) {
    if (items[i] instanceof Folder) engineCollectFiles(items[i], acc);
    else acc.push(items[i]);
  }
  return acc;
}

function engineRemoveFolder(folder) {
  var items = folder.getFiles();
  for (var i = 0; i < items.length; i++) {
    if (items[i] instanceof Folder) engineRemoveFolder(items[i]);
    else items[i].remove();
  }
  folder.remove();
}

function engineBuildOptions(format, scale) {
  var opts;
  if (format === "png") {
    opts = new ExportForScreensOptionsPNG24();
  } else if (format === "jpg") {
    opts = new ExportForScreensOptionsJPEG();
  } else if (format === "svg") {
    opts = new ExportForScreensOptionsWebOptimizedSVG();
  } else {
    opts = new ExportForScreensPDFOptions();
  }
  if (ENGINE_FORMATS[format].raster) {
    opts.scaleType = ExportForScreensScaleType.SCALEBYFACTOR;
    opts.scaleTypeValue = scale;
  }
  return opts;
}

// Exports one artboard in one format into a fresh temp folder and returns the single produced File.
function engineExportOne(doc, artboardIndex, format, scale, tempRoot) {
  var type = ExportForScreensType[ENGINE_FORMATS[format].typeConst];
  if (type === undefined) {
    throw new Error("Phi\u00ean b\u1ea3n Illustrator n\u00e0y kh\u00f4ng h\u1ed7 tr\u1ee3 \u0111\u1ecbnh d\u1ea1ng " + format);
  }
  var tempDir = new Folder(tempRoot.fsName + "/" + format + "_" + artboardIndex + "_" + scale);
  if (tempDir.exists) engineRemoveFolder(tempDir);
  tempDir.create();

  var item = new ExportForScreensItemToExport();
  item.document = false;
  item.artboards = String(artboardIndex + 1);

  doc.exportForScreens(tempDir, type, engineBuildOptions(format, scale), item, "export");

  var produced = engineCollectFiles(tempDir, []);
  if (produced.length !== 1) {
    throw new Error("C\u1ea7n \u0111\u00fang 1 t\u1ec7p \u0111\u01b0\u1ee3c xu\u1ea5t, nh\u01b0ng c\u00f3 " + produced.length);
  }
  return produced[0];
}

function engineMoveUnique(source, outDir, base, ext) {
  var name = uniqueFileName(base, ext, function (candidate) {
    return new File(outDir.fsName + "/" + candidate).exists;
  });
  var target = new File(outDir.fsName + "/" + name);
  if (!source.copy(target)) {
    throw new Error("Kh\u00f4ng ghi \u0111\u01b0\u1ee3c " + target.fsName + ": " + source.error);
  }
  return target;
}

// job: { artboards: [index|...]|"all", formats: [...], scales: [...], template, outputDir }
// returns JSON: { ok, error?, files: [{path, ok, error}] }
function runExport(jobJson) {
  var files = [];
  var tempRoot = null;
  try {
    var job = typeof jobJson === "string" ? JSON.parse(jobJson) : jobJson;
    if (app.documents.length === 0) {
      return JSON.stringify({ ok: false, error: "Ch\u01b0a m\u1edf t\u00e0i li\u1ec7u n\u00e0o", files: files });
    }
    var doc = app.activeDocument;

    var outDir = new Folder(job.outputDir);
    if (!outDir.exists && !outDir.create()) {
      return JSON.stringify({ ok: false, error: "Kh\u00f4ng t\u1ea1o \u0111\u01b0\u1ee3c th\u01b0 m\u1ee5c xu\u1ea5t: " + job.outputDir, files: files });
    }

    var indexes = engineResolveArtboards(job.artboards, doc.artboards.length);
    var formats = [];
    var f;
    for (f = 0; f < (job.formats || []).length; f++) {
      if (ENGINE_FORMATS[job.formats[f]]) formats.push(job.formats[f]);
    }
    var scales = [];
    for (var sc = 0; sc < (job.scales || []).length; sc++) {
      var sv = job.scales[sc];
      if (typeof sv === "number" && isFinite(sv) && sv > 0) scales.push(sv);
    }
    if (scales.length === 0) scales.push(1);
    if (indexes.length === 0 || formats.length === 0) {
      return JSON.stringify({ ok: false, error: "Kh\u00f4ng c\u00f3 g\u00ec \u0111\u1ec3 xu\u1ea5t: h\u00e3y ch\u1ecdn artboard v\u00e0 \u0111\u1ecbnh d\u1ea1ng", files: files });
    }

    var rawNames = [];
    for (var a = 0; a < doc.artboards.length; a++) rawNames.push(doc.artboards[a].name);
    var names = uniqueArtboardNames(rawNames);
    var docName = documentBaseName(doc.name);
    var dateStr = namingFormatDate(new Date());
    var template = job.template;
    var scaleInTemplate = templateUsesScale(template || "{doc}_{artboard}@{scale}x");

    tempRoot = new Folder(Folder.temp.fsName + "/scctlm-vector-" + new Date().getTime());
    tempRoot.create();

    for (var ai = 0; ai < indexes.length; ai++) {
      var idx = indexes[ai];
      for (f = 0; f < formats.length; f++) {
        var format = formats[f];
        var spec = ENGINE_FORMATS[format];
        var cachedSource = null; // scale-independent formats are exported once per artboard

        for (var s = 0; s < scales.length; s++) {
          var scale = scales[s];
          // Scale-independent formats only repeat per scale when the template asks for {scale}.
          if (!spec.raster && s > 0 && !scaleInTemplate) continue;

          var base = buildFileBaseName(templateForScales(template, spec.raster, scales.length), {
            doc: docName,
            artboard: names[idx],
            index: idx + 1,
            scale: scale,
            format: spec.ext,
            date: dateStr
          });

          try {
            var source;
            if (spec.raster) {
              source = engineExportOne(doc, idx, format, scale, tempRoot);
            } else {
              if (!cachedSource) cachedSource = engineExportOne(doc, idx, format, 1, tempRoot);
              source = cachedSource;
            }
            var target = engineMoveUnique(source, outDir, base, spec.ext);
            files.push({ path: target.fsName, ok: true, error: "" });
          } catch (e) {
            files.push({ path: outDir.fsName + "/" + base + "." + spec.ext, ok: false, error: engineErrorMessage(e) });
          }
        }
      }
    }

    var failed = 0;
    for (var k = 0; k < files.length; k++) if (!files[k].ok) failed++;
    return JSON.stringify({ ok: failed === 0, files: files });
  } catch (err) {
    return JSON.stringify({ ok: false, error: engineErrorMessage(err), files: files });
  } finally {
    if (tempRoot && tempRoot.exists) {
      try { engineRemoveFolder(tempRoot); } catch (ignore) {}
    }
  }
}
