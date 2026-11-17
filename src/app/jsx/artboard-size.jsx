// Pure artboard size math for the panel and the ExtendScript engine (ES3, no Illustrator globals, no
// DOM) so the same file loads in the engine, in the panel page and under Node for tests.
// An artboard rectangle is [left, top, right, bottom] in points, with top > bottom.
// Illustrator has no orientation property: portrait and landscape are only a comparison of the sides.

var ARTBOARD_UNITS = ["pt", "mm", "cm", "in", "px"];

// 72 points per inch. Illustrator treats one pixel as one point, so px and pt share a factor.
var ARTBOARD_PT_PER_UNIT = { pt: 1, mm: 72 / 25.4, cm: 72 / 2.54, "in": 72, px: 1 };

function artboardPtPerUnit(unit) {
  if (typeof unit !== "string") return null;
  return ARTBOARD_PT_PER_UNIT.hasOwnProperty(unit) ? ARTBOARD_PT_PER_UNIT[unit] : null;
}

// Digits with an optional decimal part; a comma is accepted because the panel is Vietnamese.
var ARTBOARD_SIZE_RE = /^[0-9]+(?:[.,][0-9]+)?$/;

// Positive finite size from a number or a typed string; null when the text is not one.
function artboardParseSize(text) {
  if (typeof text === "number") return text > 0 && isFinite(text) ? text : null;
  if (typeof text !== "string") return null;
  var s = text.replace(/^\s+|\s+$/g, "").replace(",", ".");
  if (!ARTBOARD_SIZE_RE.test(s)) return null;
  var n = parseFloat(s);
  return n > 0 && isFinite(n) ? n : null;
}

// Accepts "70cm x 30cm", "70 x 30 cm", "70x30", "21,5cm x 29,7cm", "1000px * 800px", etc.
function artboardParseCombinedSize(text, defaultUnit) {
  if (typeof text !== "string") return null;
  var s = text.replace(/^\s+|\s+$/g, "");
  var m = s.match(/^([0-9]+(?:[.,][0-9]+)?)\s*(cm|mm|in|pt|px)?\s*(?:[xX*×]|\s+)\s*([0-9]+(?:[.,][0-9]+)?)\s*(cm|mm|in|pt|px)?$/i);
  if (!m) return null;
  var w = artboardParseSize(m[1]);
  var h = artboardParseSize(m[3]);
  if (w === null || h === null) return null;
  var u = (m[2] || m[4] || defaultUnit || "cm").toLowerCase();
  if (!ARTBOARD_PT_PER_UNIT.hasOwnProperty(u)) return null;
  return { width: w, height: h, unit: u };
}

function artboardToPt(value, unit) {
  var factor = artboardPtPerUnit(unit);
  if (factor === null || typeof value !== "number" || !isFinite(value)) return null;
  return value * factor;
}

function artboardFromPt(pt, unit) {
  var factor = artboardPtPerUnit(unit);
  if (factor === null || typeof pt !== "number" || !isFinite(pt)) return null;
  return pt / factor;
}

function artboardSizeOf(rect) {
  return { width: rect[2] - rect[0], height: rect[1] - rect[3] };
}

function artboardOrientation(width, height) {
  if (width > height) return "landscape";
  if (width < height) return "portrait";
  return "square";
}

// A new rectangle of the given size that keeps the top-left corner where it is.
function artboardResizeRect(rect, widthPt, heightPt) {
  return [rect[0], rect[1], rect[0] + widthPt, rect[1] - heightPt];
}

// Swaps the sides of one rectangle, again keeping its top-left corner. Swapping twice is the identity.
function artboardSwapRect(rect) {
  var size = artboardSizeOf(rect);
  return artboardResizeRect(rect, size.height, size.width);
}

// Display text: at most two decimals, no trailing zeros. Points in, string out.
function artboardFormatSize(pt, unit) {
  var value = artboardFromPt(pt, unit);
  if (value === null) return null;
  return String(Math.round(value * 100) / 100);
}

function artboardSizesEqual(a, b) {
  if (!a || !b) return false;
  return Math.abs(a.width - b.width) <= 1e-6 && Math.abs(a.height - b.height) <= 1e-6;
}

// Illustrator stores artboard coordinates at limited precision (and may snap them), so a small
// difference between the requested and the reported rectangle is not a clamp. 0.5 pt = 0.18 mm.
var ARTBOARD_RECT_EPS = 0.5;

// True when any edge of the reported rectangle is further than the tolerance from the requested one.
function artboardRectDiffers(actual, expected, eps) {
  var tolerance = typeof eps === "number" && eps > 0 ? eps : ARTBOARD_RECT_EPS;
  for (var i = 0; i < 4; i++) {
    if (Math.abs(actual[i] - expected[i]) > tolerance) return true;
  }
  return false;
}
