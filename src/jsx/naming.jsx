// Pure naming helpers (ES3, no Illustrator globals) so they can be unit tested under Node.

var NAMING_MAX_BASE_LENGTH = 120;
var NAMING_TOKEN_RE = /\{(doc|artboard|index|scale|format|date)\}/g;

// Replace characters illegal on Windows/macOS file systems, trim dots/spaces, avoid reserved names.
function sanitizeFileName(name) {
  var s = String(name === undefined || name === null ? "" : name);
  s = s.replace(/[\\\/:*?"<>|\x00-\x1f]/g, "_");
  s = s.replace(/^[\s.]+|[\s.]+$/g, "");
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(s)) s = "_" + s;
  return s;
}

function namingTruncate(name, max) {
  var limit = max || NAMING_MAX_BASE_LENGTH;
  return name.length > limit ? name.substring(0, limit).replace(/[\s.]+$/, "") : name;
}

// Strip the extension from a document name; fall back to "Untitled" for unsaved/empty names.
function documentBaseName(docName) {
  var s = sanitizeFileName(String(docName || "").replace(/\.[^.]*$/, ""));
  return s === "" ? "Untitled" : s;
}

// names: raw artboard names in index order. Returns sanitised names where any
// collision (after sanitising) is disambiguated by appending the 1-based index.
function uniqueArtboardNames(names) {
  var clean = [];
  var counts = {};
  var i;
  for (i = 0; i < names.length; i++) {
    var c = sanitizeFileName(names[i]);
    if (c === "") c = "Artboard";
    clean.push(c);
    var key = c.toLowerCase();
    counts[key] = (counts[key] || 0) + 1;
  }
  var used = {};
  for (i = 0; i < clean.length; i++) {
    if (counts[clean[i].toLowerCase()] === 1) used[clean[i].toLowerCase()] = true;
  }
  var out = [];
  for (i = 0; i < clean.length; i++) {
    var name = clean[i];
    if (counts[name.toLowerCase()] > 1) {
      name = name + "_" + (i + 1);
      // Keep going until the disambiguated name no longer matches any other artboard.
      while (used[name.toLowerCase()]) name = name + "_" + (i + 1);
      used[name.toLowerCase()] = true;
    }
    out.push(name);
  }
  return out;
}

function templateUsesScale(template) {
  return /\{scale\}/.test(template);
}

var NAMING_DEFAULT_TEMPLATE = "{doc}_{artboard}@{scale}x";

// Raster output with several scales and no {scale} token would collide, so "@{scale}x" is appended.
// Shared by the export engine and the panel's filename preview so they cannot drift apart.
function templateForScales(template, isRaster, scaleCount) {
  var tpl = template ? String(template) : "";
  if (isRaster && scaleCount > 1 && !templateUsesScale(tpl || NAMING_DEFAULT_TEMPLATE)) {
    return (tpl || "{doc}_{artboard}") + "@{scale}x";
  }
  return tpl;
}

function namingPad2(n) {
  return (n < 10 ? "0" : "") + n;
}

function namingFormatDate(d) {
  return d.getFullYear() + namingPad2(d.getMonth() + 1) + namingPad2(d.getDate());
}

// ctx: { doc, artboard (already unique+sanitised), index (1-based), scale, format, date }
function buildFileBaseName(template, ctx) {
  var tpl = template && String(template) !== "" ? String(template) : "{doc}_{artboard}@{scale}x";
  var base = tpl.replace(NAMING_TOKEN_RE, function (m, token) {
    return String(ctx[token]);
  });
  base = namingTruncate(sanitizeFileName(base));
  return base === "" ? "export" : base;
}

// Returns a path-free file name that does not collide with `exists(name)`; appends _1, _2, ...
function uniqueFileName(base, ext, exists) {
  var candidate = base + "." + ext;
  var n = 0;
  while (exists(candidate)) {
    n++;
    candidate = base + "_" + n + "." + ext;
  }
  return candidate;
}
