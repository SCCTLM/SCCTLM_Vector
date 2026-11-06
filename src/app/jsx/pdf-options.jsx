// Pure PDF export helpers (ES3, no Illustrator globals) so they can be unit tested under Node.

// More artboards than this are estimated from one representative artboard instead of all of them.
var PDF_SAMPLE_LIMIT = 20;

// Descriptor for one export mode. The engine turns it into a PDFSaveOptions; keeping it plain data
// means the trial save behind the size estimate and the real export always use the same settings.
//   print:  no downsampling at all (images keep their resolution), JPEG maximum. Setting the preset name alone
//           does not fill in downsampling or compression values (measured), so none are implied by it.
//   review: images above 225 ppi are downsampled to 150 ppi, JPEG high (or medium).
// Both modes drop Illustrator editing data, the main source of oversized PDFs.
function pdfModeDescriptor(mode, quality) {
  if (mode === "print") {
    return { mode: "print", preset: "[High Quality Print]", preserveEditability: false, downsample: null, jpegQuality: "maximum" };
  }
  if (mode === "review") {
    return {
      mode: "review",
      preset: "[High Quality Print]",
      preserveEditability: false,
      downsample: { ppi: 150, threshold: 225 },
      jpegQuality: quality === "medium" ? "medium" : "high"
    };
  }
  throw new Error("Unknown PDF mode: " + mode);
}

// Suffix that keeps the two modes from overwriting each other when exported into the same folder.
function pdfModeSuffix(mode) {
  return mode === "review" ? "_review" : "_print";
}

// 0-based artboard indexes -> Illustrator's 1-based range string, runs collapsed: [0,1,2,4] -> "1-3,5".
function pdfArtboardRange(indexes) {
  var seen = {};
  var list = [];
  var i;
  for (i = 0; i < indexes.length; i++) {
    var n = Number(indexes[i]);
    if (n >= 0 && n === Math.floor(n) && !seen[n]) {
      seen[n] = true;
      list.push(n + 1);
    }
  }
  list.sort(function (a, b) { return a - b; });
  var parts = [];
  var start = 0;
  while (start < list.length) {
    var end = start;
    while (end + 1 < list.length && list[end + 1] === list[end] + 1) end++;
    parts.push(end > start ? list[start] + "-" + list[end] : String(list[start]));
    start = end + 1;
  }
  return parts.join(",");
}

// Position of the median-area artboard in `areas` (ties and even counts take the lower one).
function pdfPickRepresentative(areas) {
  var order = [];
  var i;
  for (i = 0; i < areas.length; i++) order.push(i);
  order.sort(function (a, b) { return areas[a] - areas[b] || a - b; });
  return order.length ? order[Math.floor((order.length - 1) / 2)] : -1;
}

// Size of `total` artboards from a measured sample of `sampleCount` artboards.
function pdfScaleEstimate(sampleBytes, sampleCount, total) {
  if (!(sampleCount > 0)) return 0;
  return Math.round(sampleBytes * (total / sampleCount));
}
