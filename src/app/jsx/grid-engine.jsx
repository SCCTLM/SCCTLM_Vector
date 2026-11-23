// Logo construction grid: reads the selected paths and draws anchors, handles, outlines, gridlines and fitted
// circles on one dedicated layer. Source artwork is never modified. Included by engine.jsx, which provides
// engineErrorMessage; the maths lives in grid-geometry.jsx.

var GRID_LAYER = "SCCTLM Grid";
// Bottom to top: lines under circles under outlines under markers.
var GRID_SUBLAYERS = [
  ["gridlines", "Gridlines"], ["circles", "Circles"], ["outlines", "Outlines"], ["handles", "Handles"], ["anchors", "Anchors"]
];
var GRID_MAX_DEPTH = 6;

// Sizes and stroke widths are in points.
var GRID_DEFAULT_STYLE = {
  anchors: { size: 10, fill: "#378ef0", stroke: "#ffffff", strokeWidth: 4 },
  handles: { size: 20, fill: "#378ef0", stroke: "none", strokeWidth: 1 },
  outlines: { fill: "none", stroke: "#ff2d55", strokeWidth: 0.5 },
  gridlines: { stroke: "#8e8e93", strokeWidth: 4 },
  circles: { fill: "none", stroke: "#ff9500", strokeWidth: 4 }
};

function gridFindLayer(doc) {
  for (var i = 0; i < doc.layers.length; i++) {
    if (doc.layers[i].name === GRID_LAYER) return doc.layers[i];
  }
  return null;
}

// A locked or hidden layer cannot be removed, nor can one that holds locked or hidden sublayers.
function gridUnlock(layer) {
  layer.locked = false;
  layer.visible = true;
  for (var i = 0; i < layer.layers.length; i++) gridUnlock(layer.layers[i]);
}

// Locked and visible flags of a layer tree, so a restyle can put them back after unlocking.
function gridLayerState(layer) {
  var state = { layer: layer, locked: layer.locked, visible: layer.visible, subs: [] };
  for (var i = 0; i < layer.layers.length; i++) state.subs.push(gridLayerState(layer.layers[i]));
  return state;
}

function gridRestoreLayerState(state) {
  for (var i = 0; i < state.subs.length; i++) gridRestoreLayerState(state.subs[i]);
  state.layer.visible = state.visible;
  state.layer.locked = state.locked;
}

// Illustrator refuses to remove a document's last layer, so an empty one is added first when needed.
function gridRemoveLayer(doc, layer) {
  if (!layer) return false;
  gridUnlock(layer);
  if (doc.layers.length === 1) doc.layers.add();
  layer.remove();
  return true;
}

// Compared by the top-level layer's name: script object identity across DOM reads is not guaranteed.
function gridIsOnGridLayer(item) {
  var l = item.layer;
  while (l && l.parent && l.parent.typename === "Layer") l = l.parent;
  return !!l && l.name === GRID_LAYER;
}

function gridSelection(doc) {
  var sel = doc.selection;
  // A text cursor makes the selection a TextRange instead of an array of items.
  if (!sel || typeof sel.length !== "number" || sel.typename === "TextRange") return [];
  var out = [];
  for (var i = 0; i < sel.length; i++) out.push(sel[i]);
  return out;
}

// Flattens the selection into path items; groups and compound paths are entered. Items already on the grid
// layer are ignored so a previous grid is never measured as artwork.
function gridCollect(items, acc) {
  for (var i = 0; i < items.length; i++) {
    var it = items[i];
    if (gridIsOnGridLayer(it)) continue;
    var type = it.typename;
    if (it.hidden) {
      // Hidden items, including everything inside a hidden group or compound path, are not part of the visible logo.
      acc.skipped.other++;
    } else if (type === "PathItem") {
      // Guides and clipping masks are not part of the visible logo either.
      if (it.guides || it.clipping) acc.skipped.other++;
      else acc.paths.push(it);
    } else if (type === "CompoundPathItem") {
      gridCollect(it.pathItems, acc);
    } else if (type === "GroupItem") {
      gridCollect(it.pageItems, acc);
    } else if (type === "TextFrame") {
      acc.skipped.text++;
    } else if (type === "RasterItem" || type === "PlacedItem") {
      acc.skipped.raster++;
    } else {
      acc.skipped.other++;
    }
  }
  return acc;
}

// Every pathPoints access is a cross-process call, so each path is read once into plain data.
function gridReadPath(item) {
  var pts = item.pathPoints;
  var n = pts.length;
  var points = [];
  for (var i = 0; i < n; i++) {
    var p = pts[i];
    points.push({ a: p.anchor, l: p.leftDirection, r: p.rightDirection });
  }
  var b = item.geometricBounds; // left, top, right, bottom
  return { closed: item.closed, points: points, bounds: [b[0], b[1], b[2], b[3]] };
}

function gridReadSelection(doc) {
  var acc = gridCollect(gridSelection(doc), { paths: [], skipped: { text: 0, raster: 0, other: 0 } });
  var paths = [];
  var anchors = 0;
  for (var i = 0; i < acc.paths.length; i++) {
    var data = gridReadPath(acc.paths[i]);
    anchors += data.points.length;
    paths.push(data);
  }
  return { paths: paths, anchors: anchors, skipped: acc.skipped };
}

function gridBounds(paths) {
  var r = null;
  for (var i = 0; i < paths.length; i++) {
    var b = paths[i].bounds;
    if (!r) { r = { left: b[0], top: b[1], right: b[2], bottom: b[3] }; continue; }
    r.left = Math.min(r.left, b[0]);
    r.top = Math.max(r.top, b[1]);
    r.right = Math.max(r.right, b[2]);
    r.bottom = Math.min(r.bottom, b[3]);
  }
  return r;
}

function gridHexToRgb(hex) {
  var m = /^#?([0-9a-f]{6})$/i.exec(String(hex));
  if (!m) return null;
  var v = parseInt(m[1], 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

// Hex colours from the panel; CMYK documents get the plain conversion k = 1 - max(r, g, b).
function gridColor(hex, isCmyk) {
  var rgb = hex === "none" ? null : gridHexToRgb(hex);
  if (!rgb) return null;
  if (!isCmyk) {
    var c = new RGBColor();
    c.red = rgb[0]; c.green = rgb[1]; c.blue = rgb[2];
    return c;
  }
  var r = rgb[0] / 255, g = rgb[1] / 255, b = rgb[2] / 255;
  var k = 1 - Math.max(r, g, b);
  var cmyk = new CMYKColor();
  cmyk.black = k * 100;
  cmyk.cyan = k >= 1 ? 0 : (1 - r - k) / (1 - k) * 100;
  cmyk.magenta = k >= 1 ? 0 : (1 - g - k) / (1 - k) * 100;
  cmyk.yellow = k >= 1 ? 0 : (1 - b - k) / (1 - k) * 100;
  return cmyk;
}

// Merge the job's style for one element over the defaults.
function gridStyle(job, key) {
  var base = GRID_DEFAULT_STYLE[key];
  var given = (job.style && job.style[key]) || {};
  var out = {};
  for (var p in base) {
    if (base.hasOwnProperty(p)) out[p] = given[p] !== undefined && given[p] !== null && given[p] !== "" ? given[p] : base[p];
  }
  return out;
}

function gridPaint(item, style, isCmyk) {
  var fill = style.fill === undefined ? null : gridColor(style.fill, isCmyk);
  item.filled = !!fill;
  if (fill) item.fillColor = fill;
  var stroke = gridColor(style.stroke, isCmyk);
  item.stroked = !!stroke;
  if (stroke) {
    item.strokeColor = stroke;
    item.strokeWidth = Math.max(0.01, Number(style.strokeWidth) || 0.25);
  }
}

// pathItems.ellipse and rectangle take (top, left, width, height), not a centre.
function gridMarker(layer, p, size, round, style, isCmyk) {
  var r = Math.max(0.1, Number(size) || 1) / 2;
  var item = round
    ? layer.pathItems.ellipse(p[1] + r, p[0] - r, 2 * r, 2 * r)
    : layer.pathItems.rectangle(p[1] + r, p[0] - r, 2 * r, 2 * r);
  gridPaint(item, style, isCmyk);
  return item;
}

function gridSegmentItem(layer, a, b, style, isCmyk) {
  var item = layer.pathItems.add();
  item.setEntirePath([a, b]);
  gridPaint(item, { stroke: style.stroke, strokeWidth: style.strokeWidth }, isCmyk);
  return item;
}

function gridCircleItem(layer, c, style, isCmyk) {
  var item = layer.pathItems.ellipse(c.cy + c.r, c.cx - c.r, 2 * c.r, 2 * c.r);
  gridPaint(item, style, isCmyk);
  return item;
}

function gridOutlineItem(layer, path, style, isCmyk) {
  var item = layer.pathItems.add();
  var anchors = [];
  for (var i = 0; i < path.points.length; i++) anchors.push(path.points[i].a);
  item.setEntirePath(anchors);
  for (var j = 0; j < path.points.length; j++) {
    var pp = item.pathPoints[j];
    pp.leftDirection = path.points[j].l;
    pp.rightDirection = path.points[j].r;
  }
  item.closed = path.closed;
  gridPaint(item, style, isCmyk);
  return item;
}

function gridNewLayers(doc) {
  var top = doc.layers.add();
  top.name = GRID_LAYER;
  var subs = {};
  for (var i = 0; i < GRID_SUBLAYERS.length; i++) {
    var l = top.layers.add();
    l.name = GRID_SUBLAYERS[i][1];
    subs[GRID_SUBLAYERS[i][0]] = l;
  }
  return { top: top, subs: subs };
}

// Candidate infinite lines: every straight segment plus the horizontal and vertical curve extremes, merged.
function gridLines(paths, sensitivity, size) {
  var lines = [];
  for (var i = 0; i < paths.length; i++) {
    var segs = gridSegments(paths[i]);
    for (var j = 0; j < segs.length; j++) {
      if (segs[j].straight) {
        var l = gridLine(segs[j].p0, segs[j].p3);
        if (l) lines.push(l);
      }
    }
  }
  lines = lines.concat(axisLines(paths, 0.01));
  var tol = sensitivityToTolerances(sensitivity, size);
  return mergeLines(lines, tol.angle, tol.offset);
}

function gridCircles(paths, opts, size) {
  var tolerance = complexityToTolerance(opts.complexity, size);
  var out = [];
  for (var i = 0; i < paths.length; i++) {
    var segs = gridSegments(paths[i]);
    for (var j = 0; j < segs.length; j++) {
      if (segs[j].straight) continue;
      var fitted = fitCircles(segs[j], tolerance, GRID_MAX_DEPTH, size * 10);
      out = out.concat(pickCircles(fitted, opts.mode, opts.n));
    }
  }
  return out;
}

function gridRestoreSelection(doc, items) {
  try { doc.selection = null; } catch (ignore) {}
  for (var i = 0; i < items.length; i++) {
    try { items[i].selected = true; } catch (ignore2) {} // item may now be locked or hidden
  }
}

function gridRestoreState(doc, activeLayer, selected) {
  if (activeLayer) { try { doc.activeLayer = activeLayer; } catch (ignore) {} } // gone if it was the old grid layer
  gridRestoreSelection(doc, selected);
}

function gridSize(bounds) {
  return Math.sqrt(Math.pow(bounds.right - bounds.left, 2) + Math.pow(bounds.top - bounds.bottom, 2)) || 1;
}

// Counts for the current selection, so the panel can warn before a large run. With a job that draws circles,
// the circle count is computed too (maths only, nothing is drawn): at high complexity it can dwarf the anchors.
function gridInspect(jobJson) {
  try {
    if (app.documents.length === 0) return JSON.stringify({ ok: false, error: "Ch\u01b0a m\u1edf t\u00e0i li\u1ec7u n\u00e0o" });
    var read = gridReadSelection(app.activeDocument);
    var job = jobJson ? JSON.parse(jobJson) : {};
    var circles = 0;
    if (read.paths.length && job.elements && job.elements.circles) {
      circles = gridCircles(read.paths, job.circles || {}, gridSize(gridBounds(read.paths))).length;
    }
    return JSON.stringify({ ok: true, paths: read.paths.length, anchors: read.anchors, circles: circles, skipped: read.skipped });
  } catch (e) {
    return JSON.stringify({ ok: false, error: engineErrorMessage(e) });
  }
}

// jobJson: { elements: { anchors, handles, outlines, gridlines, circles }, style: { <element>: {...} },
//   gridlines: { sensitivity, margin }, circles: { complexity, mode, n } }
// Returns { ok, error?, counts, skipped }. Replaces any earlier grid; on failure the earlier grid is kept and
// the partly drawn one is removed.
function gridGenerate(jobJson) {
  var doc = null, selected = [], activeLayer = null, layers = null;
  try {
    if (app.documents.length === 0) return JSON.stringify({ ok: false, error: "Ch\u01b0a m\u1edf t\u00e0i li\u1ec7u n\u00e0o" });
    var job = JSON.parse(jobJson);
    var el = job.elements || {};
    doc = app.activeDocument;
    selected = gridSelection(doc);
    var read = gridReadSelection(doc);
    if (!read.paths.length) {
      return JSON.stringify({ ok: false, error: "H\u00e3y ch\u1ecdn c\u00e1c path vector tr\u01b0\u1edbc (outline v\u0103n b\u1ea3n n\u1ebfu c\u00f3)", skipped: read.skipped });
    }
    var isCmyk = doc.documentColorSpace === DocumentColorSpace.CMYK;
    var paths = read.paths;
    var bounds = gridBounds(paths);
    var size = gridSize(bounds);
    var counts = { anchors: 0, handles: 0, outlines: 0, gridlines: 0, circles: 0 };
    activeLayer = doc.activeLayer;

    // The old grid comes out only after the new one is fully drawn, so a failure leaves it in place.
    var oldLayer = gridFindLayer(doc);
    layers = gridNewLayers(doc);
    var i, j;

    if (el.gridlines) {
      var g = job.gridlines || {};
      var rawMargin = g.margin !== undefined && g.margin !== null && g.margin !== "" && !isNaN(Number(g.margin)) ? Number(g.margin) : 20;
      var margin = Math.max(0, rawMargin);
      var area;
      if (g.scope === "artboard" && doc.artboards && doc.artboards.length) {
        var abIdx = (typeof doc.artboards.getActiveArtboardIndex === "function") ? doc.artboards.getActiveArtboardIndex() : 0;
        if (!(abIdx >= 0 && abIdx < doc.artboards.length)) abIdx = 0;
        var ab = doc.artboards[abIdx];
        var r = ab.artboardRect;
        var abX1 = Math.min(r[0], r[2]);
        var abX2 = Math.max(r[0], r[2]);
        var abY1 = Math.max(r[1], r[3]);
        var abY2 = Math.min(r[1], r[3]);
        area = { left: abX1 - margin, top: abY1 + margin, right: abX2 + margin, bottom: abY2 - margin };
      } else {
        area = { left: bounds.left - margin, top: bounds.top + margin, right: bounds.right + margin, bottom: bounds.bottom - margin };
      }
      var gStyle = gridStyle(job, "gridlines");
      var lines = gridLines(paths, g.sensitivity, size);
      for (i = 0; i < lines.length; i++) {
        var p = lines[i].p, d = lines[i].d;
        var clip = extendLine(p, [p[0] + d[0], p[1] + d[1]], area);
        if (!clip) continue;
        gridSegmentItem(layers.subs.gridlines, clip[0], clip[1], gStyle, isCmyk);
        counts.gridlines++;
      }
    }

    if (el.circles) {
      var cStyle = gridStyle(job, "circles");
      var circles = gridCircles(paths, job.circles || {}, size);
      for (i = 0; i < circles.length; i++) gridCircleItem(layers.subs.circles, circles[i], cStyle, isCmyk);
      counts.circles = circles.length;
    }

    if (el.outlines) {
      var oStyle = gridStyle(job, "outlines");
      for (i = 0; i < paths.length; i++) {
        if (paths[i].points.length < 2) continue;
        gridOutlineItem(layers.subs.outlines, paths[i], oStyle, isCmyk);
        counts.outlines++;
      }
    }

    if (el.handles) {
      var hStyle = gridStyle(job, "handles");
      var lineStyle = { stroke: hStyle.stroke !== "none" ? hStyle.stroke : hStyle.fill, strokeWidth: hStyle.strokeWidth };
      for (i = 0; i < paths.length; i++) {
        for (j = 0; j < paths[i].points.length; j++) {
          var pt = paths[i].points[j];
          var dirs = [pt.l, pt.r];
          for (var k = 0; k < 2; k++) {
            if (gridSame(dirs[k], pt.a)) continue;
            gridSegmentItem(layers.subs.handles, pt.a, dirs[k], lineStyle, isCmyk);
            gridMarker(layers.subs.handles, dirs[k], hStyle.size, true, hStyle, isCmyk);
            counts.handles++;
          }
        }
      }
    }

    if (el.anchors) {
      var aStyle = gridStyle(job, "anchors");
      for (i = 0; i < paths.length; i++) {
        for (j = 0; j < paths[i].points.length; j++) {
          gridMarker(layers.subs.anchors, paths[i].points[j].a, aStyle.size, false, aStyle, isCmyk);
          counts.anchors++;
        }
      }
    }

    // Drop sublayers nothing was drawn on, so the Layers panel only lists what is there.
    for (i = GRID_SUBLAYERS.length - 1; i >= 0; i--) {
      var sub = layers.subs[GRID_SUBLAYERS[i][0]];
      if (sub.pageItems.length === 0) sub.remove();
    }
    gridRemoveLayer(doc, oldLayer);
    layers = null;
    gridRestoreState(doc, activeLayer, selected);
    return JSON.stringify({ ok: true, counts: counts, skipped: read.skipped });
  } catch (e) {
    if (layers) { try { gridRemoveLayer(doc, layers.top); } catch (ignore) {} }
    if (doc) gridRestoreState(doc, activeLayer, selected);
    return JSON.stringify({ ok: false, error: engineErrorMessage(e) });
  }
}

// Restyles the existing SCCTLM Grid layer without recalculating geometry.
// Updates fill, stroke, strokeWidth, and marker sizes for whatever elements are present.
function gridRestyle(jobJson) {
  var layerState = null;
  try {
    if (app.documents.length === 0) return JSON.stringify({ ok: false, error: "Ch\u01b0a m\u1edf t\u00e0i li\u1ec7u n\u00e0o" });
    var doc = app.activeDocument;
    var top = gridFindLayer(doc);
    if (!top) return JSON.stringify({ ok: false, missing: true, error: "T\u00e0i li\u1ec7u n\u00e0y kh\u00f4ng c\u00f3 layer l\u01b0\u1edbi" });
    layerState = gridLayerState(top);
    gridUnlock(top);
    var job = jobJson ? JSON.parse(jobJson) : {};
    var isCmyk = doc.documentColorSpace === DocumentColorSpace.CMYK;

    var subs = {};
    for (var i = 0; i < top.layers.length; i++) {
      subs[top.layers[i].name] = top.layers[i];
    }

    function resizeMarker(item, newSize) {
      if (!item || newSize === undefined || newSize === null) return;
      var sz = Math.max(0.1, Number(newSize) || 1);
      if (typeof item.width === "number" && typeof item.height === "number") {
        var gb = item.geometricBounds;
        var pos = item.position;
        var cx, cy;
        if (gb && gb.length === 4) {
          cx = (gb[0] + gb[2]) / 2;
          cy = (gb[1] + gb[3]) / 2;
        } else if (pos && typeof pos[0] === "number" && typeof pos[1] === "number") {
          cx = pos[0] + (item.width || sz) / 2;
          cy = pos[1] - (item.height || sz) / 2;
        } else {
          return;
        }
        // Turn stroke off before resizing so Preview Bounds and Scale Strokes & Effects cannot skew width/position/strokeWidth.
        item.stroked = false;
        item.width = sz;
        item.height = sz;
        item.position = [cx - sz / 2, cy + sz / 2];
        if (gb && gb.length === 4) {
          item.geometricBounds = [cx - sz / 2, cy + sz / 2, cx + sz / 2, cy - sz / 2];
        }
      }
    }

    function eachPathItem(subLayer, fn) {
      if (!subLayer || !subLayer.pageItems) return;
      var items = subLayer.pageItems;
      for (var idx = 0; idx < items.length; idx++) {
        var it = items[idx];
        if (!it || (it.typename && it.typename !== "PathItem")) continue;
        var wasLocked = !!it.locked;
        if (wasLocked) it.locked = false;
        try { fn(it); } finally { if (wasLocked) it.locked = true; }
      }
    }

    if (subs["Anchors"]) {
      var aStyle = gridStyle(job, "anchors");
      eachPathItem(subs["Anchors"], function (aItem) {
        resizeMarker(aItem, aStyle.size);
        gridPaint(aItem, aStyle, isCmyk);
      });
    }

    if (subs["Handles"]) {
      var hStyle = gridStyle(job, "handles");
      var lineStyle = { stroke: hStyle.stroke !== "none" ? hStyle.stroke : hStyle.fill, strokeWidth: hStyle.strokeWidth };
      eachPathItem(subs["Handles"], function (hItem) {
        if (hItem.pathPoints && hItem.pathPoints.length === 2) {
          gridPaint(hItem, lineStyle, isCmyk);
        } else {
          resizeMarker(hItem, hStyle.size);
          gridPaint(hItem, hStyle, isCmyk);
        }
      });
    }

    if (subs["Outlines"]) {
      var oStyle = gridStyle(job, "outlines");
      eachPathItem(subs["Outlines"], function (oItem) {
        gridPaint(oItem, oStyle, isCmyk);
      });
    }

    if (subs["Gridlines"]) {
      var gStyle = gridStyle(job, "gridlines");
      eachPathItem(subs["Gridlines"], function (gItem) {
        gridPaint(gItem, gStyle, isCmyk);
      });
    }

    if (subs["Circles"]) {
      var cStyle = gridStyle(job, "circles");
      eachPathItem(subs["Circles"], function (cItem) {
        gridPaint(cItem, cStyle, isCmyk);
      });
    }

    gridRestoreLayerState(layerState);
    return JSON.stringify({ ok: true, restyled: true });
  } catch (e) {
    if (layerState) { try { gridRestoreLayerState(layerState); } catch (ignore) {} }
    return JSON.stringify({ ok: false, error: engineErrorMessage(e) });
  }
}

function gridClear() {
  try {
    if (app.documents.length === 0) return JSON.stringify({ ok: false, error: "Ch\u01b0a m\u1edf t\u00e0i li\u1ec7u n\u00e0o" });
    var doc = app.activeDocument;
    return JSON.stringify({ ok: true, removed: gridRemoveLayer(doc, gridFindLayer(doc)) });
  } catch (e) {
    return JSON.stringify({ ok: false, error: engineErrorMessage(e) });
  }
}
