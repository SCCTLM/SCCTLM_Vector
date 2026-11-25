// Pure alignment and distribution math for Adobe Illustrator (Y-up coordinates).
// Bounds format: [left, top, right, bottom] where left <= right and top >= bottom.
// ES3-compatible for ExtendScript and directly testable in Node.

function alignRectInfo(b) {
  var left = Number(b[0]);
  var top = Number(b[1]);
  var right = Number(b[2]);
  var bottom = Number(b[3]);
  var width = right - left;
  var height = top - bottom;
  return {
    left: left,
    top: top,
    right: right,
    bottom: bottom,
    width: width,
    height: height,
    cx: left + width / 2,
    cy: bottom + height / 2
  };
}

function alignUnionBounds(rects) {
  var minL = rects[0].left;
  var maxT = rects[0].top;
  var maxR = rects[0].right;
  var minB = rects[0].bottom;
  for (var i = 1; i < rects.length; i++) {
    if (rects[i].left < minL) minL = rects[i].left;
    if (rects[i].top > maxT) maxT = rects[i].top;
    if (rects[i].right > maxR) maxR = rects[i].right;
    if (rects[i].bottom < minB) minB = rects[i].bottom;
  }
  return alignRectInfo([minL, maxT, maxR, minB]);
}

function alignMakeZeroDeltas(n) {
  var out = [];
  for (var i = 0; i < n; i++) out.push({ dx: 0, dy: 0 });
  return out;
}

function alignShiftByKey(deltas, keyIndex) {
  if (keyIndex < 0 || keyIndex >= deltas.length) return;
  var kx = deltas[keyIndex].dx;
  var ky = deltas[keyIndex].dy;
  for (var i = 0; i < deltas.length; i++) {
    deltas[i].dx -= kx;
    deltas[i].dy -= ky;
  }
}

function alignSortedIndices(rects, keyFn, descending) {
  var list = [];
  for (var i = 0; i < rects.length; i++) {
    list.push({ index: i, val: keyFn(rects[i]) });
  }
  list.sort(function (a, b) {
    if (a.val !== b.val) return descending ? (b.val - a.val) : (a.val - b.val);
    return a.index - b.index;
  });
  var out = [];
  for (var j = 0; j < list.length; j++) out.push(list[j].index);
  return out;
}

// Computes { dx, dy } for each item in itemBounds.
// op:
//   Align: "left" | "h-center" | "right" | "center-both" | "top" | "v-center" | "bottom"
//   Distribute Objects: "v-dist-top" | "v-dist-center" | "v-dist-bottom" |
//                       "h-dist-left" | "h-dist-center" | "h-dist-right"
//   Distribute Spacing: "v-space" | "h-space"
// options: { alignTo: "selection"|"artboard"|"key", artboardRect?: [l,t,r,b], keyIndex?: 0, spacingPt?: number|null }
function alignComputeDeltas(op, itemBounds, options) {
  var opts = options || {};
  var alignTo = opts.alignTo || "selection";
  if (alignTo !== "selection" && alignTo !== "artboard" && alignTo !== "key") {
    alignTo = "selection";
  }

  if (!itemBounds || itemBounds.length === 0) {
    return { ok: false, error: "Ch\u1ecdn \u00edt nh\u1ea5t m\u1ed9t \u0111\u1ed1i t\u01b0\u1ee3ng" };
  }

  var n = itemBounds.length;
  var rects = [];
  var i;
  for (i = 0; i < n; i++) {
    rects.push(alignRectInfo(itemBounds[i]));
  }

  var ab = opts.artboardRect ? alignRectInfo(opts.artboardRect) : null;
  var keyIndex = typeof opts.keyIndex === "number" ? opts.keyIndex : 0;
  if (keyIndex < 0 || keyIndex >= n) keyIndex = 0;

  var deltas = alignMakeZeroDeltas(n);

  // 1. Align Objects (7 operations)
  if (
    op === "left" || op === "h-center" || op === "right" ||
    op === "center-both" ||
    op === "top" || op === "v-center" || op === "bottom"
  ) {
    var ref = null;
    if (alignTo === "artboard") {
      if (!ab) return { ok: false, error: "Kh\u00f4ng t\u00ecm th\u1ea5y Artboard \u0111ang ho\u1ea1t \u0111\u1ed9ng" };
      ref = ab;
    } else if (alignTo === "key") {
      if (n < 2) return { ok: false, error: "Ch\u1ecdn \u00edt nh\u1ea5t 2 \u0111\u1ed1i t\u01b0\u1ee3ng \u0111\u1ec3 c\u0103n theo \u0111\u1ed1i t\u01b0\u1ee3ng g\u1ed1c" };
      ref = rects[keyIndex];
    } else {
      // Selection mode: single item automatically aligns to the active Artboard (Illustrator behavior).
      if (n === 1) {
        if (!ab) return { ok: false, error: "Kh\u00f4ng t\u00ecm th\u1ea5y Artboard \u0111ang ho\u1ea1t \u0111\u1ed9ng" };
        ref = ab;
      } else {
        ref = alignUnionBounds(rects);
      }
    }

    for (i = 0; i < n; i++) {
      if (alignTo === "key" && i === keyIndex) continue;
      var r = rects[i];
      if (op === "left") {
        deltas[i].dx = ref.left - r.left;
      } else if (op === "h-center") {
        deltas[i].dx = ref.cx - r.cx;
      } else if (op === "right") {
        deltas[i].dx = ref.right - r.right;
      } else if (op === "center-both") {
        deltas[i].dx = ref.cx - r.cx;
        deltas[i].dy = ref.cy - r.cy;
      } else if (op === "top") {
        deltas[i].dy = ref.top - r.top;
      } else if (op === "v-center") {
        deltas[i].dy = ref.cy - r.cy;
      } else if (op === "bottom") {
        deltas[i].dy = ref.bottom - r.bottom;
      }
    }
    return { ok: true, deltas: deltas };
  }

  // 2. Distribute Objects (6 operations)
  if (
    op === "v-dist-top" || op === "v-dist-center" || op === "v-dist-bottom" ||
    op === "h-dist-left" || op === "h-dist-center" || op === "h-dist-right"
  ) {
    var isVertical = op.indexOf("v-") === 0;
    var minDist = alignTo === "artboard" ? 2 : 3;
    if (n < minDist) {
      return {
        ok: false,
        error: "C\u1ea7n \u00edt nh\u1ea5t " + minDist + " \u0111\u1ed1i t\u01b0\u1ee3ng \u0111\u1ec3 ph\u00e2n b\u1ed1"
      };
    }
    if (alignTo === "artboard" && !ab) {
      return { ok: false, error: "Kh\u00f4ng t\u00ecm th\u1ea5y Artboard \u0111ang ho\u1ea1t \u0111\u1ed9ng" };
    }

    var anchorFn;
    if (op === "v-dist-top") anchorFn = function (r) { return r.top; };
    else if (op === "v-dist-center") anchorFn = function (r) { return r.cy; };
    else if (op === "v-dist-bottom") anchorFn = function (r) { return r.bottom; };
    else if (op === "h-dist-left") anchorFn = function (r) { return r.left; };
    else if (op === "h-dist-center") anchorFn = function (r) { return r.cx; };
    else anchorFn = function (r) { return r.right; };

    var order = alignSortedIndices(rects, anchorFn, isVertical);
    var firstIdx = order[0];
    var lastIdx = order[n - 1];
    var startAnchor, endAnchor;

    if (alignTo === "artboard") {
      if (op === "v-dist-top") {
        startAnchor = ab.top;
        endAnchor = ab.bottom + rects[lastIdx].height;
      } else if (op === "v-dist-center") {
        startAnchor = ab.top - rects[firstIdx].height / 2;
        endAnchor = ab.bottom + rects[lastIdx].height / 2;
      } else if (op === "v-dist-bottom") {
        startAnchor = ab.top - rects[firstIdx].height;
        endAnchor = ab.bottom;
      } else if (op === "h-dist-left") {
        startAnchor = ab.left;
        endAnchor = ab.right - rects[lastIdx].width;
      } else if (op === "h-dist-center") {
        startAnchor = ab.left + rects[firstIdx].width / 2;
        endAnchor = ab.right - rects[lastIdx].width / 2;
      } else {
        startAnchor = ab.left + rects[firstIdx].width;
        endAnchor = ab.right;
      }
    } else {
      startAnchor = anchorFn(rects[firstIdx]);
      endAnchor = anchorFn(rects[lastIdx]);
    }

    var step = (endAnchor - startAnchor) / (n - 1);
    for (var k = 0; k < n; k++) {
      var idx = order[k];
      var target = startAnchor + step * k;
      var diff = target - anchorFn(rects[idx]);
      if (isVertical) deltas[idx].dy = diff;
      else deltas[idx].dx = diff;
    }

    if (alignTo === "key") {
      alignShiftByKey(deltas, keyIndex);
    }
    return { ok: true, deltas: deltas };
  }

  // 3. Distribute Spacing (2 operations)
  if (op === "v-space" || op === "h-space") {
    var hasSpacing = opts.spacingPt !== null && opts.spacingPt !== undefined && opts.spacingPt !== "" && !isNaN(Number(opts.spacingPt));
    var explicitGap = hasSpacing ? Number(opts.spacingPt) : null;

    // In Key Object mode without explicit spacing, default to 0 pt (Illustrator behavior).
    if (alignTo === "key" && explicitGap === null) {
      explicitGap = 0;
    }

    var isV = op === "v-space";
    var minSpace = (explicitGap !== null || alignTo === "artboard") ? 2 : 3;
    if (n < minSpace) {
      return {
        ok: false,
        error: "C\u1ea7n \u00edt nh\u1ea5t " + minSpace + " \u0111\u1ed1i t\u01b0\u1ee3ng \u0111\u1ec3 ph\u00e2n b\u1ed1 kho\u1ea3ng c\u00e1ch"
      };
    }
    if (alignTo === "artboard" && !ab) {
      return { ok: false, error: "Kh\u00f4ng t\u00ecm th\u1ea5y Artboard \u0111ang ho\u1ea1t \u0111\u1ed9ng" };
    }

    var sOrder = alignSortedIndices(
      rects,
      isV ? function (r) { return r.top; } : function (r) { return r.left; },
      isV
    );

    var gap;
    var cursor;

    if (explicitGap !== null) {
      gap = explicitGap;
      if (alignTo === "artboard") {
        cursor = isV ? ab.top : ab.left;
      } else {
        cursor = isV ? rects[sOrder[0]].top : rects[sOrder[0]].left;
      }
      for (var m = 0; m < n; m++) {
        var sIdx = sOrder[m];
        if (isV) {
          deltas[sIdx].dy = cursor - rects[sIdx].top;
          cursor -= rects[sIdx].height + gap;
        } else {
          deltas[sIdx].dx = cursor - rects[sIdx].left;
          cursor += rects[sIdx].width + gap;
        }
      }
      if (alignTo === "key") {
        alignShiftByKey(deltas, keyIndex);
      }
      return { ok: true, deltas: deltas };
    }

    // Auto even spacing between extremes (selection or artboard)
    var totalSize = 0;
    for (i = 0; i < n; i++) {
      totalSize += isV ? rects[i].height : rects[i].width;
    }

    var span;
    if (alignTo === "artboard") {
      span = isV ? (ab.top - ab.bottom) : (ab.right - ab.left);
      cursor = isV ? ab.top : ab.left;
    } else {
      var firstR = rects[sOrder[0]];
      var lastR = rects[sOrder[n - 1]];
      span = isV ? (firstR.top - lastR.bottom) : (lastR.right - firstR.left);
      cursor = isV ? firstR.top : firstR.left;
    }

    gap = (span - totalSize) / (n - 1);
    for (var p = 0; p < n; p++) {
      var pIdx = sOrder[p];
      if (isV) {
        deltas[pIdx].dy = cursor - rects[pIdx].top;
        cursor -= rects[pIdx].height + gap;
      } else {
        deltas[pIdx].dx = cursor - rects[pIdx].left;
        cursor += rects[pIdx].width + gap;
      }
    }
    return { ok: true, deltas: deltas };
  }

  return { ok: false, error: "Thao t\u00e1c c\u0103n ch\u1ec9nh kh\u00f4ng h\u1ee3p l\u1ec7: " + String(op) };
}
