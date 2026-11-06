// Batch export engine. JSON string in, JSON string out; never shows native alerts.
#include "json2.jsx"
#include "naming.jsx"
#include "pdf-options.jsx"
#include "pdf-engine.jsx"

var ENGINE_FORMATS = {
  png: { ext: "png", raster: true, typeConst: "SE_PNG24" },
  jpg: { ext: "jpg", raster: true, typeConst: "SE_JPEG100" },
  svg: { ext: "svg", raster: false, typeConst: "SE_SVG" },
  pdf: { ext: "pdf", raster: false, typeConst: "SE_PDF" }
};

function engineErrorMessage(e) {
  return e && e.message ? e.message : String(e);
}

// Artboards for the UI: [{index (0-based), name}]
function listArtboards() {
  try {
    if (app.documents.length === 0) {
      return JSON.stringify({ ok: false, error: "No open document", artboards: [] });
    }
    var doc = app.activeDocument;
    var out = [];
    for (var i = 0; i < doc.artboards.length; i++) {
      out.push({ index: i, name: doc.artboards[i].name });
    }
    // Saved path tells apart same-named files from different folders; unsaved docs have no path.
    var docPath = "";
    try { docPath = doc.fullName.fsName; } catch (ignore) {}
    return JSON.stringify({ ok: true, docName: documentBaseName(doc.name), docPath: docPath, artboards: out });
  } catch (e) {
    return JSON.stringify({ ok: false, error: engineErrorMessage(e), artboards: [] });
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
    throw new Error('"artboards" must be "all" or an array of indexes');
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
    throw new Error("Format " + format + " is not supported by this Illustrator version");
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
    throw new Error("Expected 1 exported file, found " + produced.length);
  }
  return produced[0];
}

function engineMoveUnique(source, outDir, base, ext) {
  var name = uniqueFileName(base, ext, function (candidate) {
    return new File(outDir.fsName + "/" + candidate).exists;
  });
  var target = new File(outDir.fsName + "/" + name);
  if (!source.copy(target)) {
    throw new Error("Could not write " + target.fsName + ": " + source.error);
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
      return JSON.stringify({ ok: false, error: "No open document", files: files });
    }
    var doc = app.activeDocument;

    var outDir = new Folder(job.outputDir);
    if (!outDir.exists && !outDir.create()) {
      return JSON.stringify({ ok: false, error: "Cannot create output folder: " + job.outputDir, files: files });
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
      return JSON.stringify({ ok: false, error: "Nothing to export: select artboards and formats", files: files });
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
