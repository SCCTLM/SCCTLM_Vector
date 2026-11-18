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
      return JSON.stringify({ ok: false, error: "Chưa mở tài liệu nào" });
    }
    var doc = app.activeDocument;
    var sel = doc.selection;
    if (!sel || sel.length === 0) {
      return JSON.stringify({ ok: false, error: "Chọn ít nhất một đối tượng" });
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
        return JSON.stringify({ ok: false, error: "Không nhân bản được đối tượng" });
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
        return JSON.stringify({ ok: false, error: "Không offset được đối tượng" });
      }

      // 7. Expand appearance of the offset effect
      offsetExpandAppearance();

      // 8. Seal any internal gap artifacts with Pathfinder Add
      try {
        app.executeMenuCommand("Live Pathfinder Add");
        offsetExpandAppearance();
      } catch (eAdd2) {}

      // 9. Apply color and arrange behind original artwork
      var newSel = doc.selection;
      if (newSel && newSel.length > 0) {
        for (var s = 0; s < newSel.length; s++) {
          if (applyColor && made && made.color) {
            offsetSetFillColor(newSel[s], made.color);
          }
          offsetPlaceResult(newSel[s], sel, placeBehind);
        }
      }

      // 10. Remove original items if keepOriginal is false
      if (!keepOriginal) {
        for (var k = 0; k < sel.length; k++) {
          try { sel[k].remove(); } catch (eRem) {}
        }
      }

      return JSON.stringify({
        ok: true,
        message: "Đã tạo viền",
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
        return JSON.stringify({ ok: false, error: "Không có đối tượng hợp lệ" });
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
        return JSON.stringify({ ok: false, error: "Không offset được đối tượng" });
      }

      offsetExpandAppearance();

      var stdSel = doc.selection;
      if (stdSel && stdSel.length > 0) {
        for (var m = 0; m < stdSel.length; m++) {
          if (applyColor && made && made.color) {
            offsetSetFillColor(stdSel[m], made.color);
          }
          if (keepOriginal) offsetPlaceResult(stdSel[m], sel, placeBehind);
        }
      }

      return JSON.stringify({
        ok: true,
        message: "Đã offset",
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

// Flattens the current selection into one SVG path string for the panel preview.
// Read-only: it never touches the document. Y is flipped so the SVG renders upright.
function offsetShapeFromSelection() {
  try {
    if (app.documents.length === 0) return JSON.stringify({ ok: false });
    var sel = app.activeDocument.selection;
    if (!sel || sel.length === 0 || typeof sel === "string") return JSON.stringify({ ok: false });

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
        for (var i = 0; i < item.pathItems.length; i++) addPath(item.pathItems[i]);
      } else if (t === "GroupItem") {
        for (var j = 0; j < item.pageItems.length; j++) walk(item.pageItems[j], depth + 1);
      }
    };

    for (var s = 0; s < sel.length; s++) walk(sel[s], 0);

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
