// Colour picker window: read the starting colour, convert through Illustrator's own colour management,
// and paint the chosen colour on the selection. JSON string in, JSON string out.

function colorRound(v, digits) {
  var f = Math.pow(10, digits || 0);
  return Math.round(v * f) / f;
}

function colorConvertValues(from, values, to) {
  return app.convertSampleColor(from, values, to, ColorConvertPurpose.defaultpurpose);
}

// Illustrator colour -> { rgb, cmyk? } (rgb 0-255, cmyk 0-100), or null for none, gradients and patterns.
function colorRead(c) {
  if (!c) return null;
  var t = c.typename;
  if (t === "RGBColor") return { rgb: [c.red, c.green, c.blue] };
  if (t === "CMYKColor") {
    var k = [c.cyan, c.magenta, c.yellow, c.black];
    return { rgb: colorConvertValues(ImageColorSpace.CMYK, k, ImageColorSpace.RGB), cmyk: k };
  }
  if (t === "GrayColor") {
    var g = 255 * (1 - c.gray / 100);
    return { rgb: [g, g, g] };
  }
  if (t === "SpotColor") {
    var base = colorRead(c.spot.color), tint = (c.tint === undefined ? 100 : c.tint) / 100;
    if (!base) return null;
    if (base.cmyk) {
      var tk = [base.cmyk[0] * tint, base.cmyk[1] * tint, base.cmyk[2] * tint, base.cmyk[3] * tint];
      return { rgb: colorConvertValues(ImageColorSpace.CMYK, tk, ImageColorSpace.RGB), cmyk: tk };
    }
    return { rgb: [255 - (255 - base.rgb[0]) * tint, 255 - (255 - base.rgb[1]) * tint, 255 - (255 - base.rgb[2]) * tint] };
  }
  return null;
}

function colorFillActive() {
  try { return app.isFillActive(); } catch (e) { return true; }
}

function colorSelection(doc) {
  var sel = doc.selection;
  if (!sel) return [];
  if (sel.typename === "TextRange") return [sel];
  var out = [];
  for (var i = 0; i < sel.length; i++) out.push(sel[i]);
  return out;
}

// The object that carries fill and stroke for an item, or null when the item has none we can paint.
function colorTarget(item) {
  var t = item.typename;
  if (t === "PathItem") return { kind: "path", obj: item };
  if (t === "CompoundPathItem") return item.pathItems.length ? { kind: "path", obj: item.pathItems[0] } : null;
  if (t === "TextFrame") return { kind: "text", obj: item.textRange.characterAttributes };
  if (t === "TextRange") return { kind: "text", obj: item.characterAttributes };
  return null;
}

function colorFirstTarget(items) {
  for (var i = 0; i < items.length; i++) {
    if (items[i].typename === "GroupItem") {
      var inner = colorFirstTarget(items[i].pageItems);
      if (inner) return inner;
      continue;
    }
    var t = colorTarget(items[i]);
    if (t) return t;
  }
  return null;
}

// Returns { ok, hasDoc, isCmyk, profileName, fillActive, rgb, cmyk? }. The colour comes from the active
// fill or stroke of the first paintable selected item, else from the document defaults.
function colorPickerContext() {
  try {
    var fill = colorFillActive();
    if (app.documents.length === 0) return JSON.stringify({ ok: true, hasDoc: false, fillActive: fill, rgb: [255, 255, 255] });
    var doc = app.activeDocument;
    var isCmyk = doc.documentColorSpace === DocumentColorSpace.CMYK;
    var target = colorFirstTarget(colorSelection(doc)), c = null;
    if (target) {
      if (target.kind === "path") c = fill ? (target.obj.filled ? target.obj.fillColor : null) : (target.obj.stroked ? target.obj.strokeColor : null);
      else c = fill ? target.obj.fillColor : target.obj.strokeColor;
    } else {
      c = fill ? doc.defaultFillColor : doc.defaultStrokeColor;
    }
    var read = colorRead(c) || { rgb: fill ? [255, 255, 255] : [0, 0, 0] };
    var out = { ok: true, hasDoc: true, isCmyk: isCmyk, profileName: "", fillActive: fill, rgb: read.rgb };
    try { out.profileName = doc.colorProfileName; } catch (e1) { /* untagged document */ }
    if (read.cmyk) out.cmyk = read.cmyk;
    else if (isCmyk) out.cmyk = colorConvertValues(ImageColorSpace.RGB, read.rgb, ImageColorSpace.CMYK);
    return JSON.stringify(out);
  } catch (e) {
    return JSON.stringify({ ok: false, error: engineErrorMessage(e) });
  }
}

// jobJson: { rgb: [r,g,b] } or { cmyk: [c,m,y,k] }. Returns { ok, rgb, cmyk } through Illustrator's colour
// settings, so the picker shows the numbers Illustrator would apply.
function colorConvert(jobJson) {
  try {
    var job = JSON.parse(jobJson);
    if (job.cmyk) {
      return JSON.stringify({ ok: true, cmyk: job.cmyk, rgb: colorConvertValues(ImageColorSpace.CMYK, job.cmyk, ImageColorSpace.RGB) });
    }
    return JSON.stringify({ ok: true, rgb: job.rgb, cmyk: colorConvertValues(ImageColorSpace.RGB, job.rgb, ImageColorSpace.CMYK) });
  } catch (e) {
    return JSON.stringify({ ok: false, error: engineErrorMessage(e) });
  }
}

function colorMake(isCmyk, job) {
  var c, i;
  if (isCmyk) {
    var k = job.cmyk || colorConvertValues(ImageColorSpace.RGB, job.rgb, ImageColorSpace.CMYK);
    for (i = 0; i < 4; i++) k[i] = Math.max(0, Math.min(100, colorRound(k[i], 2)));
    c = new CMYKColor();
    c.cyan = k[0]; c.magenta = k[1]; c.yellow = k[2]; c.black = k[3];
    return { color: c, cmyk: k };
  }
  c = new RGBColor();
  c.red = Math.max(0, Math.min(255, Math.round(job.rgb[0])));
  c.green = Math.max(0, Math.min(255, Math.round(job.rgb[1])));
  c.blue = Math.max(0, Math.min(255, Math.round(job.rgb[2])));
  return { color: c };
}

function colorPaint(items, made, fill, counts) {
  for (var i = 0; i < items.length; i++) {
    var item = items[i];
    if (item.typename === "GroupItem") { colorPaint(item.pageItems, made, fill, counts); continue; }
    var t = colorTarget(item);
    if (!t || item.locked) { counts.skipped++; continue; }
    if (t.kind === "path") {
      if (fill) { t.obj.filled = true; t.obj.fillColor = made.color; }
      else { t.obj.stroked = true; t.obj.strokeColor = made.color; }
    } else if (fill) {
      t.obj.fillColor = made.color;
    } else {
      t.obj.strokeColor = made.color;
    }
    counts.painted++;
  }
}

// jobJson: { rgb: [r,g,b], cmyk?: [c,m,y,k] (typed by the user, kept as is), fill: bool }.
// Paints the selection, or sets the document default when nothing is selected.
// Returns { ok, target: "selection" | "default", painted, skipped, cmyk? }.
function colorApply(jobJson) {
  try {
    if (app.documents.length === 0) return JSON.stringify({ ok: false, error: "Chưa mở tài liệu nào" });
    var job = JSON.parse(jobJson);
    var doc = app.activeDocument;
    var made = colorMake(doc.documentColorSpace === DocumentColorSpace.CMYK, job);
    var fill = job.fill !== false;
    var items = colorSelection(doc);
    var out = { ok: true, target: "selection", painted: 0, skipped: 0 };
    if (made.cmyk) out.cmyk = made.cmyk;
    if (!items.length) {
      if (fill) { doc.defaultFilled = true; doc.defaultFillColor = made.color; }
      else { doc.defaultStroked = true; doc.defaultStrokeColor = made.color; }
      out.target = "default";
      return JSON.stringify(out);
    }
    colorPaint(items, made, fill, out);
    if (!out.painted) out.error = "Không có đối tượng nào tô được màu (path, văn bản)";
    out.ok = out.painted > 0;
    return JSON.stringify(out);
  } catch (e) {
    return JSON.stringify({ ok: false, error: engineErrorMessage(e) });
  }
}
