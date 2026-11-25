// Align & Distribute engine for Adobe Illustrator.
// JSON string in, JSON string out; never shows native alerts.

function alignUsePreviewBounds() {
  try {
    return app.preferences.getBooleanPreference("includeStrokeInBounds") === true;
  } catch (e) {
    return true;
  }
}

function alignFindClippingPath(groupItem) {
  try {
    var items = groupItem.pageItems;
    for (var i = 0; i < items.length; i++) {
      var child = items[i];
      if (child.typename === "PathItem" && child.clipping) {
        return child;
      }
      if (child.typename === "CompoundPathItem" && child.pathItems && child.pathItems.length > 0) {
        if (child.pathItems[0].clipping) {
          return child;
        }
      }
    }
  } catch (e) {}
  return null;
}

function alignGetItemBounds(item, usePreview) {
  if (item && item.typename === "GroupItem" && item.clipped) {
    var clip = alignFindClippingPath(item);
    if (clip && clip.geometricBounds) {
      return clip.geometricBounds;
    }
  }
  if (usePreview && item && item.visibleBounds) {
    return item.visibleBounds;
  }
  return item.geometricBounds;
}

function alignItemIsEditable(item) {
  try {
    if (!item || item.locked || item.hidden) return false;
    if (item.layer && (item.layer.locked || !item.layer.visible)) return false;
  } catch (e) {}
  return true;
}

// jobJson: { op: string, alignTo: "selection"|"artboard"|"key", spacingPt?: number|null }
function engineAlignObjects(jobJson) {
  try {
    if (app.documents.length === 0) {
      return JSON.stringify({ ok: false, error: "Ch\u01b0a m\u1edf t\u00e0i li\u1ec7u n\u00e0o" });
    }
    var doc = app.activeDocument;
    var sel = doc.selection;
    if (!sel || sel.length === 0 || typeof sel === "string") {
      return JSON.stringify({ ok: false, error: "Ch\u1ecdn \u00edt nh\u1ea5t m\u1ed9t \u0111\u1ed1i t\u01b0\u1ee3ng" });
    }

    var job = typeof jobJson === "string" ? JSON.parse(jobJson) : (jobJson || {});
    var op = String(job.op || "");
    var alignTo = String(job.alignTo || "selection");

    var items = [];
    for (var i = 0; i < sel.length; i++) {
      if (alignItemIsEditable(sel[i])) {
        items.push(sel[i]);
      }
    }
    if (items.length === 0) {
      return JSON.stringify({ ok: false, error: "\u0110\u1ed1i t\u01b0\u1ee3ng \u0111ang b\u1ecb kh\u00f3a ho\u1eb7c \u1ea9n" });
    }

    var usePreview = alignUsePreviewBounds();
    var boundsList = [];
    for (var b = 0; b < items.length; b++) {
      boundsList.push(alignGetItemBounds(items[b], usePreview));
    }

    var artboardRect = null;
    try {
      var abIdx = doc.artboards.getActiveArtboardIndex();
      artboardRect = doc.artboards[abIdx].artboardRect;
    } catch (eAb) {}

    var spacingPt = (job.spacingPt !== undefined && job.spacingPt !== null && job.spacingPt !== "")
      ? Number(job.spacingPt)
      : null;

    var res = alignComputeDeltas(op, boundsList, {
      alignTo: alignTo,
      artboardRect: artboardRect,
      keyIndex: 0,
      spacingPt: spacingPt
    });

    if (!res.ok) {
      return JSON.stringify({ ok: false, error: res.error });
    }

    var moved = 0;
    for (var m = 0; m < items.length; m++) {
      var d = res.deltas[m];
      if (Math.abs(d.dx) > 1e-6 || Math.abs(d.dy) > 1e-6) {
        items[m].translate(d.dx, d.dy);
        moved++;
      }
    }

    if (typeof app.redraw === "function") {
      try { app.redraw(); } catch (eRd) {}
    }

    return JSON.stringify({
      ok: true,
      op: op,
      alignTo: alignTo,
      count: items.length,
      moved: moved
    });
  } catch (err) {
    return JSON.stringify({ ok: false, error: engineErrorMessage(err) });
  }
}
