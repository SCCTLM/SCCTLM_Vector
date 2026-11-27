// Offset Path engine for Adobe Illustrator.
// JSON string in, JSON string out; never shows native alerts.

// Adobe Offset Path "jntp" values, confirmed against Illustrator output:
// 0 = round, 1 = bevel, 2 = miter.
function offsetParseJoin(val) {
  if (val === "miter" || val === 2 || val === "2") return 2;
  if (val === "bevel" || val === 1 || val === "1") return 1;
  return 0; // "round"
}

function offsetEffectXML(ofst, jntp, mlim) {
  return '<LiveEffect name="Adobe Offset Path">' +
         '<Dict data="I jntp ' + jntp + ' R mlim ' + mlim + ' R ofst ' + ofst + '"/>' +
         '</LiveEffect>';
}

function offsetForceUpdate() {
  try {
    app.executeMenuCommand('edge');
    app.executeMenuCommand('edge');
  } catch (e1) {}
  if (typeof app.redraw === "function") {
    try { app.redraw(); } catch (e2) {}
  }
}

function offsetExpandAppearance() {
  offsetForceUpdate();
  try {
    app.executeMenuCommand('expandStyle');
  } catch (eExp) {}
  offsetForceUpdate();
}

// Tag prefix stored in the item's Note field to identify offset results.
var OFFSET_TAG_PREFIX = "SCCTLM_OFFSET:";

function offsetWriteTag(item, params) {
  try {
    item.note = OFFSET_TAG_PREFIX + JSON.stringify(params);
  } catch (e) {}
}

function offsetReadTag(item) {
  try {
    var n = item.note;
    if (!n || n.indexOf(OFFSET_TAG_PREFIX) !== 0) return null;
    return JSON.parse(n.substring(OFFSET_TAG_PREFIX.length));
  } catch (e) { return null; }
}

function offsetSetFillColor(item, color) {
  if (!item || !color) return;
  var t = item.typename;
  if (t === "GroupItem") {
    var children = item.pageItems;
    for (var i = 0; i < children.length; i++) {
      offsetSetFillColor(children[i], color);
    }
    return;
  }
  if (t === "PathItem") {
    item.filled = true;
    item.fillColor = color;
    item.stroked = false;
  } else if (t === "CompoundPathItem") {
    for (var j = 0; j < item.pathItems.length; j++) {
      item.pathItems[j].filled = true;
      item.pathItems[j].fillColor = color;
      item.pathItems[j].stroked = false;
    }
  }
}

// Places an offset result behind or in front of the original artwork.
function offsetPlaceResult(item, refs, behind) {
  if (!refs || refs.length === 0) return;
  try {
    if (behind) {
      var last = refs[refs.length - 1];
      if (item !== last) item.move(last, ElementPlacement.PLACEAFTER);
    } else if (item !== refs[0]) {
      item.move(refs[0], ElementPlacement.PLACEBEFORE);
    }
  } catch (eMove) {}
}

// Name of the group that keeps the original artwork and its offset border together.
var OFFSET_GROUP_NAME = "Offset Group";

function offsetIsOffsetGroup(item) {
  try { return item && item.typename === "GroupItem" && item.name === OFFSET_GROUP_NAME; } catch (e) { return false; }
}

// Groups the original artwork and its offset result into one group, keeping their stacking order.
// Skips when the originals already live in an offset group (e.g. after a rebuild).
function offsetGroupPair(doc, sources, results) {
  try {
    var all = [];
    var i;
    for (i = 0; i < sources.length; i++) all.push(sources[i]);
    for (i = 0; i < results.length; i++) all.push(results[i]);
    if (all.length < 2) return;
    if (offsetIsOffsetGroup(all[0].parent)) return;
    doc.selection = null;
    for (i = 0; i < all.length; i++) {
      try { all[i].selected = true; } catch (eSel) {}
    }
    app.executeMenuCommand("group");
    var made = doc.selection;
    if (made && made.length === 1 && made[0].typename === "GroupItem") {
      made[0].name = OFFSET_GROUP_NAME;
    }
  } catch (eGrp) {}
}

function offsetConvertOutline(item) {
  if (!item) return item;
  if (item.typename === "TextFrame") {
    try {
      var outlined = item.createOutline();
      if (outlined) return outlined;
    } catch (e) {}
  }
  return item;
}

function engineOffsetPath(jobJson) {
  try {
    if (app.documents.length === 0) {
      return JSON.stringify({ ok: false, error: "Ch\u01b0a m\u1edf t\u00e0i li\u1ec7u n\u00e0o" });
    }
    var doc = app.activeDocument;
    var sel = doc.selection;
    if (!sel || sel.length === 0) {
      return JSON.stringify({ ok: false, error: "Ch\u1ecdn \u00edt nh\u1ea5t m\u1ed9t \u0111\u1ed1i t\u01b0\u1ee3ng" });
    }

    var job = typeof jobJson === "string" ? JSON.parse(jobJson) : (jobJson || {});
    var ofst = Number(job.offsetPt !== undefined ? job.offsetPt : (job.offset !== undefined ? job.offset : 20));
    if (isNaN(ofst)) ofst = 20;

    var jntp = offsetParseJoin(job.join);
    var mlim = Math.max(1, Number(job.miterLimit || 4));
    if (isNaN(mlim)) mlim = 4;

    var mode = job.mode || (job.unite ? "sticker" : (job.sticker !== false ? "sticker" : "standard"));
    var placeBehind = job.placeBehind !== false;
    var keepOriginal = job.keepOriginal !== false;
    // Standard mode keeps the original appearance like Object > Path > Offset Path;
    // sticker mode paints the border unless told otherwise.
    var applyColor = mode === "sticker" ? job.applyColor !== false : job.applyColor === true;

    var isCmyk = typeof DocumentColorSpace !== "undefined" && doc.documentColorSpace === DocumentColorSpace.CMYK;
    var colorJob = job.color || { rgb: [31, 200, 255] };
    var made = colorMake(isCmyk, colorJob);

    var xml = offsetEffectXML(ofst, jntp, mlim);

    if (mode === "sticker") {
      // 1. Duplicate original selection
      var duplicates = [];
      for (var i = 0; i < sel.length; i++) {
        var item = sel[i];
        try {
          var dup = item.duplicate(item, ElementPlacement.PLACEAFTER);
          dup = offsetConvertOutline(dup);
          duplicates.push(dup);
        } catch (eDup) {}
      }

      if (duplicates.length === 0) {
        return JSON.stringify({ ok: false, error: "Kh\u00f4ng nh\u00e2n b\u1ea3n \u0111\u01b0\u1ee3c \u0111\u1ed1i t\u01b0\u1ee3ng" });
      }

      // 2. Select only duplicates
      doc.selection = null;
      for (var d = 0; d < duplicates.length; d++) {
        duplicates[d].selected = true;
      }

      // 3. Group duplicates if more than 1
      if (duplicates.length > 1) {
        try {
          app.executeMenuCommand("group");
        } catch (eGrp) {}
      }

      // 4. Outline any live strokes on duplicates
      try {
        app.executeMenuCommand("Live Outline Stroke");
        offsetExpandAppearance();
      } catch (eStroke) {}

      // 5. Unite all duplicate shapes into a unified base silhouette
      try {
        app.executeMenuCommand("Live Pathfinder Add");
        offsetExpandAppearance();
      } catch (eAdd1) {}

      // 6. Apply Adobe Offset Path to the silhouette
      var applied = 0;
      var unitedSel = doc.selection;
      if (unitedSel && unitedSel.length > 0) {
        for (var u = 0; u < unitedSel.length; u++) {
          try { unitedSel[u].applyEffect(xml); applied++; } catch (eEff1) {}
        }
      } else {
        for (var d2 = 0; d2 < duplicates.length; d2++) {
          try { duplicates[d2].applyEffect(xml); applied++; } catch (eEff2) {}
        }
      }
      if (applied === 0) {
        for (var c1 = 0; c1 < duplicates.length; c1++) {
          try { duplicates[c1].remove(); } catch (eClean1) {}
        }
        return JSON.stringify({ ok: false, error: "Kh\u00f4ng offset \u0111\u01b0\u1ee3c \u0111\u1ed1i t\u01b0\u1ee3ng" });
      }

      // 7. Expand appearance of the offset effect
      offsetExpandAppearance();

      // 8. Seal any internal gap artifacts with Pathfinder Add
      try {
        app.executeMenuCommand("Live Pathfinder Add");
        offsetExpandAppearance();
      } catch (eAdd2) {}

      // 9. Apply color, tag and arrange behind original artwork
      var offsetId = "off_" + (new Date().getTime());
      var tagParams = {
        id: offsetId,
        offsetPt: ofst,
        join: jntp,
        miterLimit: mlim,
        mode: "sticker",
        colorHex: colorJob.hex || null,
        colorRgb: colorJob.rgb || null,
        role: "offset"
      };
      var srcTagParams = {
        id: offsetId,
        offsetPt: ofst,
        join: jntp,
        miterLimit: mlim,
        mode: "sticker",
        colorHex: colorJob.hex || null,
        colorRgb: colorJob.rgb || null,
        role: "source"
      };
      var newSel = doc.selection;
      if (newSel && newSel.length > 0) {
        for (var s = 0; s < newSel.length; s++) {
          if (applyColor && made && made.color) {
            offsetSetFillColor(newSel[s], made.color);
          }
          offsetWriteTag(newSel[s], tagParams);
          offsetPlaceResult(newSel[s], sel, placeBehind);
        }
      }

      // If keepOriginal is true, also tag the original items so selecting them detects the offset
      if (keepOriginal && sel && sel.length > 0) {
        for (var o = 0; o < sel.length; o++) {
          offsetWriteTag(sel[o], srcTagParams);
        }
      }

      // 10. Remove original items if keepOriginal is false
      if (!keepOriginal) {
        for (var k = 0; k < sel.length; k++) {
          try { sel[k].remove(); } catch (eRem) {}
        }
      }

      if (keepOriginal) offsetGroupPair(doc, sel, newSel || []);

      return JSON.stringify({
        ok: true,
        message: "\u0110\u00e3 t\u1ea1o vi\u1ec1n",
        mode: "sticker",
        offsetPt: ofst,
        join: jntp,
        miterLimit: mlim
      });

    } else {
      // Standard Offset Path Mode: applies to each selected path/compound path individually
      var targets = [];
      for (var j = 0; j < sel.length; j++) {
        var it = sel[j];
        if (keepOriginal) {
          try {
            var dupStd = it.duplicate(it, ElementPlacement.PLACEAFTER);
            dupStd = offsetConvertOutline(dupStd);
            targets.push(dupStd);
          } catch (eDupStd) {}
        } else {
          var conv = offsetConvertOutline(it);
          targets.push(conv);
        }
      }

      if (targets.length === 0) {
        return JSON.stringify({ ok: false, error: "Kh\u00f4ng c\u00f3 \u0111\u1ed1i t\u01b0\u1ee3ng h\u1ee3p l\u1ec7" });
      }

      doc.selection = null;
      for (var t = 0; t < targets.length; t++) {
        targets[t].selected = true;
      }

      var appliedStd = 0;
      for (var a = 0; a < targets.length; a++) {
        try {
          targets[a].applyEffect(xml);
          appliedStd++;
        } catch (eEffStd) {}
      }
      if (appliedStd === 0) {
        if (keepOriginal) {
          for (var c2 = 0; c2 < targets.length; c2++) {
            try { targets[c2].remove(); } catch (eClean2) {}
          }
        }
        return JSON.stringify({ ok: false, error: "Kh\u00f4ng offset \u0111\u01b0\u1ee3c \u0111\u1ed1i t\u01b0\u1ee3ng" });
      }

      offsetExpandAppearance();

      var stdSel = doc.selection;
      var stdOffsetId = "off_std_" + (new Date().getTime());
      var stdTagParams = {
        id: stdOffsetId,
        offsetPt: ofst,
        join: jntp,
        miterLimit: mlim,
        mode: "standard",
        colorHex: colorJob.hex || null,
        colorRgb: colorJob.rgb || null,
        role: "offset"
      };
      var stdSrcTagParams = {
        id: stdOffsetId,
        offsetPt: ofst,
        join: jntp,
        miterLimit: mlim,
        mode: "standard",
        colorHex: colorJob.hex || null,
        colorRgb: colorJob.rgb || null,
        role: "source"
      };
      if (stdSel && stdSel.length > 0) {
        for (var m = 0; m < stdSel.length; m++) {
          if (applyColor && made && made.color) {
            offsetSetFillColor(stdSel[m], made.color);
          }
          offsetWriteTag(stdSel[m], stdTagParams);
          if (keepOriginal) offsetPlaceResult(stdSel[m], sel, placeBehind);
        }
      }
      if (keepOriginal && sel && sel.length > 0) {
        for (var so = 0; so < sel.length; so++) {
          offsetWriteTag(sel[so], stdSrcTagParams);
        }
      }

      if (keepOriginal) offsetGroupPair(doc, sel, stdSel || []);

      return JSON.stringify({
        ok: true,
        message: "\u0110\u00e3 offset",
        mode: "standard",
        offsetPt: ofst,
        join: jntp,
        miterLimit: mlim
      });
    }

  } catch (err) {
    return JSON.stringify({ ok: false, error: engineErrorMessage(err) });
  }
}

// Limits for passive inspection so selecting thousands of paths never stalls Illustrator's UI thread.
var OFFSET_INSPECT_MAX_SEL = 50;
var OFFSET_MAX_SIBLING_SCAN = 500;
var OFFSET_MAX_TAG_DEPTH = 6;

// Flattens the current selection into one SVG path string for the panel preview.
// Strictly read-only: never duplicates, outlines, or mutates document items. Y is flipped so the SVG renders upright.
function offsetShapeFromSelection() {
  try {
    if (app.documents.length === 0) return JSON.stringify({ ok: false });
    var sel = app.activeDocument.selection;
    if (!sel || sel.length === 0 || typeof sel === "string") return JSON.stringify({ ok: false });
    if (sel.length > OFFSET_INSPECT_MAX_SEL) return JSON.stringify({ ok: false, tooMany: true });

    var MAX_POINTS = 4000;
    var state = { d: "", points: 0, minX: 1e9, minY: 1e9, maxX: -1e9, maxY: -1e9, over: false };

    var addPoint = function (x, y) {
      if (x < state.minX) state.minX = x;
      if (x > state.maxX) state.maxX = x;
      if (y < state.minY) state.minY = y;
      if (y > state.maxY) state.maxY = y;
    };
    var fmt = function (n) { return Math.round(n * 100) / 100; };

    var addPath = function (p) {
      var pts = p.pathPoints, n = pts.length;
      if (n === 0 || p.guides || p.clipping) return;
      state.points += n;
      if (state.points > MAX_POINTS) { state.over = true; return; }
      var first = pts[0].anchor;
      state.d += "M" + fmt(first[0]) + " " + fmt(-first[1]);
      addPoint(first[0], -first[1]);
      var count = p.closed ? n : n - 1;
      for (var i = 0; i < count; i++) {
        var a = pts[i], b = pts[(i + 1) % n];
        var c1 = a.rightDirection, c2 = b.leftDirection, e = b.anchor;
        state.d += "C" + fmt(c1[0]) + " " + fmt(-c1[1]) + " " + fmt(c2[0]) + " " + fmt(-c2[1]) +
                   " " + fmt(e[0]) + " " + fmt(-e[1]);
        addPoint(e[0], -e[1]);
        addPoint(c1[0], -c1[1]);
        addPoint(c2[0], -c2[1]);
      }
      if (p.closed) state.d += "Z";
    };

    var walk = function (item, depth) {
      if (state.over || depth > 8) return;
      var t = item.typename;
      if (t === "PathItem") {
        addPath(item);
      } else if (t === "CompoundPathItem") {
        for (var i = 0; i < item.pathItems.length; i++) {
          if (state.over) return;
          addPath(item.pathItems[i]);
        }
      } else if (t === "GroupItem") {
        for (var j = 0; j < item.pageItems.length; j++) {
          if (state.over) return;
          var childTag = offsetReadTag(item.pageItems[j]);
          if (childTag && childTag.role === "offset") continue;
          walk(item.pageItems[j], depth + 1);
        }
      }
      // TextFrame is intentionally skipped here: duplicating/outlining live text mutates the
      // document, pollutes Illustrator's Undo history, and stalls the main thread.
    };

    for (var s = 0; s < sel.length; s++) {
      var shapeItem = sel[s];
      var shapeTag = offsetReadTag(shapeItem);
      if (shapeTag && shapeTag.role === "offset") {
        var srcItem = offsetFindCounterpart(shapeItem, "source", shapeTag.id);
        if (srcItem) shapeItem = srcItem;
      }
      walk(shapeItem, 0);
    }

    if (state.over || state.d === "") return JSON.stringify({ ok: false });
    return JSON.stringify({
      ok: true,
      d: state.d,
      x: state.minX,
      y: state.minY,
      w: Math.max(1, state.maxX - state.minX),
      h: Math.max(1, state.maxY - state.minY)
    });
  } catch (err) {
    return JSON.stringify({ ok: false });
  }
}


// Converts RGB [r, g, b] array (0-255) to hex #RRGGBB string.
function colorRgbToHex(rgb) {
  if (!rgb || rgb.length < 3) return "#000000";
  var r = Math.max(0, Math.min(255, Math.round(rgb[0]))).toString(16).toUpperCase();
  var g = Math.max(0, Math.min(255, Math.round(rgb[1]))).toString(16).toUpperCase();
  var b = Math.max(0, Math.min(255, Math.round(rgb[2]))).toString(16).toUpperCase();
  if (r.length === 1) r = "0" + r;
  if (g.length === 1) g = "0" + g;
  if (b.length === 1) b = "0" + b;
  return "#" + r + g + b;
}

// Extracts the fill color info { rgb, hex } from an item, checking compound paths and groups.
function offsetGetItemFillColor(item) {
  if (!item) return null;
  var t = item.typename;
  var p = null;
  if (t === "PathItem") {
    p = item;
  } else if (t === "CompoundPathItem" && item.pathItems && item.pathItems.length > 0) {
    p = item.pathItems[0];
  } else if (t === "GroupItem" && item.pageItems) {
    for (var i = 0; i < item.pageItems.length; i++) {
      var c = offsetGetItemFillColor(item.pageItems[i]);
      if (c) return c;
    }
    return null;
  }
  if (p && p.filled) {
    var cInfo = colorRead(p.fillColor);
    if (cInfo && cInfo.rgb) {
      return { rgb: cInfo.rgb, hex: colorRgbToHex(cInfo.rgb) };
    }
  }
  return null;
}

// Finds the sibling item immediately behind (direction=1) or in front (direction=-1).
function offsetGetItemSibling(item, direction) {
  try {
    var parent = item.parent;
    if (!parent || !parent.pageItems) return null;
    var len = parent.pageItems.length;
    if (len > OFFSET_MAX_SIBLING_SCAN) return null;
    for (var i = 0; i < len; i++) {
      if (parent.pageItems[i] === item) {
        var targetIdx = i + direction;
        if (targetIdx >= 0 && targetIdx < len) {
          return parent.pageItems[targetIdx];
        }
        return null;
      }
    }
  } catch (e) {}
  return null;
}

// Reads an offset tag, ignoring a stale one: a copy of the artwork keeps its "source" tag but
// has no border next to it, so it must not be treated as an existing offset.
function offsetReadLiveTag(item) {
  var tag = offsetReadTag(item);
  if (tag && tag.role === "source" && !offsetFindCounterpart(item, "offset", tag.id)) return null;
  return tag;
}

// Recursively checks an item, its group children, or its adjacent siblings for an offset tag.
function offsetFindItemTag(item, depth) {
  if (!item || (depth || 0) > OFFSET_MAX_TAG_DEPTH) return null;

  // 1. Tag directly on the item
  var tag = offsetReadLiveTag(item);
  if (tag) return { item: item, tag: tag };

  // 2. Item is a GroupItem: inspect children (bounded so huge groups cannot stall Illustrator)
  if (item.typename === "GroupItem" && item.pageItems) {
    var limit = Math.min(item.pageItems.length, OFFSET_INSPECT_MAX_SEL);
    for (var i = 0; i < limit; i++) {
      var childRes = offsetFindItemTag(item.pageItems[i], (depth || 0) + 1);
      if (childRes) return childRes;
    }
  }

  // 3. Check sibling behind (item placed after original in z-order)
  var behind = offsetGetItemSibling(item, 1);
  if (behind) {
    var bTag = offsetReadLiveTag(behind);
    if (bTag) return { item: behind, tag: bTag, sourceItem: item };
  }

  // 4. Check sibling in front
  var front = offsetGetItemSibling(item, -1);
  if (front) {
    var fTag = offsetReadLiveTag(front);
    if (fTag) return { item: item, tag: fTag, sourceItem: front };
  }

  return null;
}

// Bounds [left, top, right, bottom] of the artwork. Strictly read-only (never duplicates/outlines text).
function offsetVisualBounds(item) {
  return item.geometricBounds;
}

// Returns the uniform border thickness when outer encloses inner evenly on all four sides
// (the signature of an offset border); 0 for unrelated artwork.
function offsetUniformMargin(inner, outer) {
  if (!inner || !outer) return 0;
  var m = [inner[0] - outer[0], outer[2] - inner[2], outer[1] - inner[1], inner[3] - outer[3]];
  var min = m[0], max = m[0], sum = 0;
  for (var i = 0; i < 4; i++) {
    if (m[i] < min) min = m[i];
    if (m[i] > max) max = m[i];
    sum += m[i];
  }
  var mean = sum / 4;
  if (min < 0.5 || mean > 500) return 0;
  if (max - min > Math.max(2, mean * 0.1)) return 0;
  return mean;
}

// Heuristic fallback for offsets made before tagging existed. Only matches when a filled
// sibling surrounds the item evenly; any other overlap is treated as unrelated artwork.
function offsetDetectHeuristic(item) {
  if (!item) return null;
  try {
    var behind = offsetGetItemSibling(item, 1);
    if (behind && !offsetReadTag(behind)) {
      var bColor = offsetGetItemFillColor(behind);
      if (bColor) {
        var pt = Math.round(offsetUniformMargin(offsetVisualBounds(item), behind.geometricBounds));
        if (pt > 0) {
          return {
            offsetItem: behind,
            sourceItem: item,
            tag: { offsetPt: pt, join: 0, miterLimit: 4, mode: "sticker", colorHex: bColor.hex, colorRgb: bColor.rgb },
            color: bColor
          };
        }
      }
    }

    var front = offsetGetItemSibling(item, -1);
    if (front && !offsetReadTag(front)) {
      var myColor = offsetGetItemFillColor(item);
      if (myColor) {
        var pt2 = Math.round(offsetUniformMargin(offsetVisualBounds(front), item.geometricBounds));
        if (pt2 > 0) {
          return {
            offsetItem: item,
            sourceItem: front,
            tag: { offsetPt: pt2, join: 0, miterLimit: 4, mode: "sticker", colorHex: myColor.hex, colorRgb: myColor.rgb },
            color: myColor
          };
        }
      }
    }
  } catch (eH) {}
  return null;
}

// Detects whether the current selection contains item(s) that are tagged offset results or have offset contours.
// Returns { ok, found, params: { offsetPt, join, miterLimit, mode, colorHex, colorRgb }, currentColor }
function offsetDetectExisting() {
  try {
    if (app.documents.length === 0) return JSON.stringify({ ok: true, found: false });
    var sel = app.activeDocument.selection;
    if (!sel || sel.length === 0 || typeof sel === "string") return JSON.stringify({ ok: true, found: false });
    if (sel.length > OFFSET_INSPECT_MAX_SEL) return JSON.stringify({ ok: true, found: false, tooMany: true });

    for (var i = 0; i < sel.length; i++) {
      var item = sel[i];

      // 1. Try finding by tag (item, group children, or siblings)
      var tagged = offsetFindItemTag(item);
      if (tagged) {
        var offsetItem = tagged.item;
        if (tagged.tag.role === "source") {
          offsetItem = offsetFindCounterpart(tagged.item, "offset", tagged.tag.id) || offsetItem;
        }
        var curColor = offsetGetItemFillColor(offsetItem);
        if (!curColor && tagged.tag.colorRgb) {
          curColor = { rgb: tagged.tag.colorRgb, hex: tagged.tag.colorHex || colorRgbToHex(tagged.tag.colorRgb) };
        }
        return JSON.stringify({
          ok: true,
          found: true,
          params: tagged.tag,
          currentColor: curColor
        });
      }

      // 2. Try heuristic detection from siblings
      var heur = offsetDetectHeuristic(item);
      if (heur) {
        // Tag both items for deterministic future tracking
        offsetWriteTag(heur.offsetItem, heur.tag);
        if (heur.sourceItem) {
          var srcTag = {};
          for (var k in heur.tag) srcTag[k] = heur.tag[k];
          srcTag.role = "source";
          offsetWriteTag(heur.sourceItem, srcTag);
        }
        return JSON.stringify({
          ok: true,
          found: true,
          params: heur.tag,
          currentColor: heur.color
        });
      }
    }

    return JSON.stringify({ ok: true, found: false });
  } catch (err) {
    return JSON.stringify({ ok: true, found: false });
  }
}

// Finds the sibling carrying the opposite role (same offset id) next to a tagged item.
function offsetFindCounterpart(item, wantRole, id) {
  try {
    var parent = item.parent;
    if (!parent || !parent.pageItems) return null;
    for (var i = 0; i < parent.pageItems.length; i++) {
      var cand = parent.pageItems[i];
      if (cand === item) continue;
      var t = offsetReadTag(cand);
      if (t && t.role === wantRole && (!id || !t.id || t.id === id)) return cand;
    }
  } catch (e) {}
  return null;
}

// Resolves both the offsetItem and the sourceItem from the current selection.
// A selected source (original artwork) is mapped to its offset sibling, never colored itself.
function offsetFindOffsetAndSource(sel) {
  var offsetItem = null;
  var sourceItem = null;
  var tag = null;

  for (var i = 0; i < sel.length; i++) {
    var item = sel[i];
    var tagged = offsetFindItemTag(item);
    if (tagged) {
      tag = tagged.tag;
      var tagId = tagged.tag.id;
      if (tagged.tag.role === "source") {
        sourceItem = tagged.item;
        offsetItem = offsetFindCounterpart(sourceItem, "offset", tagId);
      } else {
        offsetItem = tagged.item;
        sourceItem = tagged.sourceItem || offsetFindCounterpart(offsetItem, "source", tagId);
      }
      break;
    }
  }

  if (!offsetItem) {
    for (var j = 0; j < sel.length; j++) {
      var heur = offsetDetectHeuristic(sel[j]);
      if (heur) {
        offsetItem = heur.offsetItem;
        sourceItem = heur.sourceItem;
        tag = heur.tag;
        break;
      }
    }
  }

  return { offsetItem: offsetItem, sourceItem: sourceItem, tag: tag };
}

// Updates the selected offset result in-place.
// jobJson: { color?, join?, miterLimit?, offsetPt?, rebuild? }
// rebuild=true regenerates the border geometry from the source artwork; otherwise only the color changes.
function offsetUpdateExisting(jobJson) {
  try {
    if (app.documents.length === 0) {
      return JSON.stringify({ ok: false, error: "Ch\u01b0a m\u1edf t\u00e0i li\u1ec7u n\u00e0o" });
    }
    var doc = app.activeDocument;
    var sel = doc.selection;
    if (!sel || sel.length === 0) {
      return JSON.stringify({ ok: false, error: "Ch\u1ecdn \u00edt nh\u1ea5t m\u1ed9t \u0111\u1ed1i t\u01b0\u1ee3ng" });
    }

    var job = typeof jobJson === "string" ? JSON.parse(jobJson) : (jobJson || {});
    var isCmyk = typeof DocumentColorSpace !== "undefined" && doc.documentColorSpace === DocumentColorSpace.CMYK;

    var targets = offsetFindOffsetAndSource(sel);
    var offsetItem = targets.offsetItem;
    var sourceItem = targets.sourceItem;

    if (!offsetItem) {
      return JSON.stringify({ ok: false, error: "Kh\u00f4ng t\u00ecm th\u1ea5y vi\u1ec1n offset \u0111\u1ec3 c\u1eadp nh\u1eadt" });
    }

    var currentTag = offsetReadTag(offsetItem) || targets.tag || {};
    if (job.color) {
      currentTag.colorHex = job.color.hex || currentTag.colorHex;
      currentTag.colorRgb = job.color.rgb || currentTag.colorRgb;
    }
    if (job.join !== undefined) currentTag.join = offsetParseJoin(job.join);
    if (job.miterLimit !== undefined) currentTag.miterLimit = Math.max(1, Number(job.miterLimit));
    if (job.offsetPt !== undefined) currentTag.offsetPt = Number(job.offsetPt);

    if (job.rebuild) {
      if (!sourceItem) {
        return JSON.stringify({ ok: false, error: "Kh\u00f4ng t\u00ecm th\u1ea5y \u0111\u1ed1i t\u01b0\u1ee3ng g\u1ed1c c\u1ee7a vi\u1ec1n; h\u00e3y ch\u1ecdn l\u1ea1i ch\u1eef/h\u00ecnh g\u1ed1c" });
      }
      // Regenerate the border from the source artwork, replacing the old border.
      var colorForRebuild = job.color || (currentTag.colorRgb ? { rgb: currentTag.colorRgb, hex: currentTag.colorHex } : null);
      try { offsetItem.remove(); } catch (eRm) {
        return JSON.stringify({ ok: false, error: "Kh\u00f4ng x\u00f3a \u0111\u01b0\u1ee3c vi\u1ec1n c\u0169" });
      }
      doc.selection = null;
      sourceItem.selected = true;
      var rebuilt = JSON.parse(engineOffsetPath({
        offsetPt: currentTag.offsetPt,
        join: currentTag.join,
        miterLimit: currentTag.miterLimit,
        mode: "sticker",
        applyColor: true,
        keepOriginal: true,
        placeBehind: true,
        color: colorForRebuild || { rgb: [31, 200, 255] }
      }));
      if (!rebuilt.ok) return JSON.stringify(rebuilt);
      try { doc.selection = null; sourceItem.selected = true; } catch (eSel) {}
      return JSON.stringify({ ok: true, message: "\u0110\u00e3 t\u1ea1o l\u1ea1i vi\u1ec1n " + currentTag.offsetPt + " pt", updated: 1, rebuilt: true });
    }

    if (job.color) {
      var made = colorMake(isCmyk, job.color);
      if (made && made.color) offsetSetFillColor(offsetItem, made.color);
    }
    currentTag.role = "offset";
    offsetWriteTag(offsetItem, currentTag);
    if (sourceItem) {
      var srcTag = {};
      for (var k in currentTag) srcTag[k] = currentTag[k];
      srcTag.role = "source";
      offsetWriteTag(sourceItem, srcTag);
    }

    offsetForceUpdate();
    return JSON.stringify({ ok: true, message: "\u0110\u00e3 c\u1eadp nh\u1eadt", updated: 1 });
  } catch (err) {
    return JSON.stringify({ ok: false, error: engineErrorMessage(err) });
  }
}

// Unified inspection: detects selection, returns both SVG preview shape and offset parameters.
function offsetInspectSelection() {
  try {
    if (app.documents.length === 0) {
      return JSON.stringify({ ok: true, hasDoc: false, hasSelection: false });
    }
    var doc = app.activeDocument;
    var sel = doc.selection;
    if (!sel || sel.length === 0 || typeof sel === "string") {
      return JSON.stringify({ ok: true, hasDoc: true, hasSelection: false });
    }
    if (sel.length > OFFSET_INSPECT_MAX_SEL) {
      return JSON.stringify({
        ok: true,
        hasDoc: true,
        hasSelection: true,
        tooMany: true,
        selectionKey: "s_many_" + sel.length,
        offsetInfo: { ok: true, found: false, tooMany: true },
        shape: { ok: false, tooMany: true }
      });
    }

    var offsetInfo = JSON.parse(offsetDetectExisting());
    var shapeInfo = JSON.parse(offsetShapeFromSelection());

    var selFingerprint = "s_" + sel.length;
    for (var i = 0; i < Math.min(sel.length, 4); i++) {
      try {
        var it = sel[i];
        selFingerprint += "_" + it.typename + "_" + Math.round(it.left || 0) + "_" + Math.round(it.top || 0);
      } catch (eF) {}
    }

    return JSON.stringify({
      ok: true,
      hasDoc: true,
      hasSelection: true,
      selectionKey: selFingerprint,
      offsetInfo: offsetInfo,
      shape: shapeInfo
    });
  } catch (err) {
    return JSON.stringify({ ok: false, error: engineErrorMessage(err) });
  }
}
