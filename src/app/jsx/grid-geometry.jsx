// Pure geometry for the logo construction grid (ES3, no Illustrator globals) so it can be unit tested
// under Node. Points are [x, y] in document coordinates (y grows upwards, as Illustrator reports them).
// A path is { closed: Boolean, points: [{ a: anchor, l: left direction, r: right direction }] }.

// Distances below this (in points) count as zero: handles pulled less than this are not real handles.
var GRID_EPS = 0.01;

function gridSub(p, q) { return [p[0] - q[0], p[1] - q[1]]; }
function gridCross(u, v) { return u[0] * v[1] - u[1] * v[0]; }
function gridDot(u, v) { return u[0] * v[0] + u[1] * v[1]; }
function gridDist(p, q) { var dx = p[0] - q[0], dy = p[1] - q[1]; return Math.sqrt(dx * dx + dy * dy); }
function gridSame(p, q) { return gridDist(p, q) < GRID_EPS; }

// Distance from point p to the infinite line through a and b (a and b distinct).
function gridDistToLine(p, a, b) {
  return Math.abs(gridCross(gridSub(b, a), gridSub(p, a))) / gridDist(a, b);
}

// True when the control point c lies on the chord a-b (not beyond its ends), so it does not bend the segment.
function gridOnChord(c, a, b) {
  if (gridSame(c, a) || gridSame(c, b)) return true;
  if (gridDistToLine(c, a, b) >= GRID_EPS) return false;
  var len2 = gridDot(gridSub(b, a), gridSub(b, a));
  var t = gridDot(gridSub(c, a), gridSub(b, a)) / len2;
  return t >= -1e-9 && t <= 1 + 1e-9;
}

// Cubic segments of a path, including the closing one of a closed path. Zero-length segments are skipped.
function gridSegments(path) {
  var pts = path.points || [];
  var out = [];
  var n = pts.length;
  var last = path.closed ? n : n - 1;
  for (var i = 0; i < last && n > 1; i++) {
    var from = pts[i], to = pts[(i + 1) % n];
    var seg = { p0: from.a, c1: from.r, c2: to.l, p3: to.a, straight: false };
    if (gridSame(seg.p0, seg.p3) && gridSame(seg.c1, seg.p0) && gridSame(seg.c2, seg.p3)) continue;
    // A segment that returns to its own start is a loop, so it stays a curve.
    if (!gridSame(seg.p0, seg.p3)) {
      seg.straight = gridOnChord(seg.c1, seg.p0, seg.p3) && gridOnChord(seg.c2, seg.p0, seg.p3);
    }
    out.push(seg);
  }
  return out;
}

function bezierPoint(seg, t) {
  var u = 1 - t;
  var b0 = u * u * u, b1 = 3 * u * u * t, b2 = 3 * u * t * t, b3 = t * t * t;
  return [
    b0 * seg.p0[0] + b1 * seg.c1[0] + b2 * seg.c2[0] + b3 * seg.p3[0],
    b0 * seg.p0[1] + b1 * seg.c1[1] + b2 * seg.c2[1] + b3 * seg.p3[1]
  ];
}

// Arc length between t0 and t1 (default the whole segment), by sampling.
function bezierLength(seg, t0, t1) {
  if (t0 === undefined) t0 = 0;
  if (t1 === undefined) t1 = 1;
  var steps = 32, total = 0, prev = bezierPoint(seg, t0);
  for (var i = 1; i <= steps; i++) {
    var p = bezierPoint(seg, t0 + (t1 - t0) * i / steps);
    total += gridDist(prev, p);
    prev = p;
  }
  return total;
}

// Inflection parameters in (0, 1), ascending. With B'(t)/3 = A + 2tD + t^2 E and B''(t)/6 = D + tE,
// cross(B', B'') is proportional to cross(A,D) + t cross(A,E) + t^2 cross(D,E).
function inflections(seg) {
  var A = gridSub(seg.c1, seg.p0);
  var B = gridSub(seg.c2, seg.c1);
  var C = gridSub(seg.p3, seg.c2);
  var D = gridSub(B, A);
  var E = [C[0] - 2 * B[0] + A[0], C[1] - 2 * B[1] + A[1]];
  var q2 = gridCross(D, E), q1 = gridCross(A, E), q0 = gridCross(A, D);
  var scale = Math.max(Math.abs(q2), Math.abs(q1), Math.abs(q0));
  var roots = [];
  if (scale < 1e-12) return roots;
  if (Math.abs(q2) < scale * 1e-9) {
    if (Math.abs(q1) >= scale * 1e-9) roots.push(-q0 / q1);
  } else {
    var disc = q1 * q1 - 4 * q2 * q0;
    if (disc >= 0) {
      var s = Math.sqrt(disc);
      roots.push((-q1 - s) / (2 * q2));
      roots.push((-q1 + s) / (2 * q2));
    }
  }
  var out = [];
  for (var i = 0; i < roots.length; i++) {
    if (roots[i] > 1e-6 && roots[i] < 1 - 1e-6) out.push(roots[i]);
  }
  out.sort(function (a, b) { return a - b; });
  if (out.length === 2 && out[1] - out[0] < 1e-9) out.pop();
  return out;
}

// Circle through three points: { cx, cy, r }, or null when they are (nearly) collinear.
function circleFrom3(a, b, c) {
  var ax = a[0], ay = a[1], bx = b[0], by = b[1], cx = c[0], cy = c[1];
  var d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
  var span = Math.max(gridDist(a, b), gridDist(b, c), gridDist(a, c));
  if (span < GRID_EPS || Math.abs(d) < span * span * 1e-9) return null;
  var a2 = ax * ax + ay * ay, b2 = bx * bx + by * by, c2 = cx * cx + cy * cy;
  var ux = (a2 * (by - cy) + b2 * (cy - ay) + c2 * (ay - by)) / d;
  var uy = (a2 * (cx - bx) + b2 * (ax - cx) + c2 * (bx - ax)) / d;
  return { cx: ux, cy: uy, r: gridDist([ux, uy], a) };
}

// Circles approximating a curved segment. The segment is split at its inflections, then each piece gets a circle
// through its start, middle and end; a piece is halved again while the curve strays more than `tolerance` from
// that circle (up to maxDepth halvings). Circles larger than maxRadius describe a nearly straight piece and are
// dropped. Results: [{ cx, cy, r, t0, t1, arcLength }] ordered by t0.
function fitCircles(seg, tolerance, maxDepth, maxRadius) {
  var out = [];
  if (seg.straight) return out;
  var cuts = [0].concat(inflections(seg), [1]);

  function fit(t0, t1, depth) {
    var pa = bezierPoint(seg, t0), pm = bezierPoint(seg, (t0 + t1) / 2), pb = bezierPoint(seg, t1);
    if (gridDist(pa, pm) + gridDist(pm, pb) < GRID_EPS) return;
    var circ = circleFrom3(pa, pm, pb);
    if (!circ && gridSame(pa, pb) && depth < maxDepth) {
      // A loop returns to its start, so its three points give no circle; its halves do.
      fit(t0, (t0 + t1) / 2, depth + 1);
      fit((t0 + t1) / 2, t1, depth + 1);
      return;
    }
    if (!circ || (maxRadius > 0 && circ.r > maxRadius)) return;
    var worst = 0, samples = 8;
    for (var i = 1; i < samples; i++) {
      if (i === samples / 2) continue;
      var p = bezierPoint(seg, t0 + (t1 - t0) * i / samples);
      var dev = Math.abs(gridDist(p, [circ.cx, circ.cy]) - circ.r);
      if (dev > worst) worst = dev;
    }
    if (worst > tolerance && depth < maxDepth) {
      var tm = (t0 + t1) / 2;
      fit(t0, tm, depth + 1);
      fit(tm, t1, depth + 1);
      return;
    }
    out.push({ cx: circ.cx, cy: circ.cy, r: circ.r, t0: t0, t1: t1, arcLength: bezierLength(seg, t0, t1) });
  }

  for (var k = 0; k < cuts.length - 1; k++) fit(cuts[k], cuts[k + 1], 0);
  return out;
}

// Which circles of one curved segment to draw: "all", "first" n from the segment start, or the n that cover
// the longest parts of the curve. The result keeps curve order.
function pickCircles(circles, mode, n) {
  var list = circles.slice(0);
  if (mode !== "first" && mode !== "longest") return list;
  var count = Math.max(0, Math.floor(Number(n) || 0));
  if (mode === "longest") {
    list.sort(function (a, b) { return b.arcLength - a.arcLength || a.t0 - b.t0; });
    list = list.slice(0, count);
  } else {
    list = list.slice(0, count);
  }
  list.sort(function (a, b) { return a.t0 - b.t0; });
  return list;
}

// An infinite line through p in direction d: { p, d }. Null for a zero direction.
function gridLine(p, q) {
  var d = gridSub(q, p);
  if (Math.sqrt(gridDot(d, d)) < GRID_EPS) return null;
  return { p: p, d: d };
}

// Clip the infinite line through p and q to rect { left, top, right, bottom }. Returns [[x, y], [x, y]] or null.
function extendLine(p, q, rect) {
  var line = gridLine(p, q);
  if (!line) return null;
  var xmin = Math.min(rect.left, rect.right), xmax = Math.max(rect.left, rect.right);
  var ymin = Math.min(rect.top, rect.bottom), ymax = Math.max(rect.top, rect.bottom);
  var lo = -Infinity, hi = Infinity;
  var pd = [[line.d[0], line.p[0], xmin, xmax], [line.d[1], line.p[1], ymin, ymax]];
  for (var i = 0; i < 2; i++) {
    var dir = pd[i][0], from = pd[i][1], mn = pd[i][2], mx = pd[i][3];
    if (Math.abs(dir) < 1e-12) {
      if (from < mn - 1e-9 || from > mx + 1e-9) return null;
      continue;
    }
    var t1 = (mn - from) / dir, t2 = (mx - from) / dir;
    if (t1 > t2) { var tmp = t1; t1 = t2; t2 = tmp; }
    if (t1 > lo) lo = t1;
    if (t2 < hi) hi = t2;
  }
  if (lo > hi) return null;
  var a = [line.p[0] + line.d[0] * lo, line.p[1] + line.d[1] * lo];
  var b = [line.p[0] + line.d[0] * hi, line.p[1] + line.d[1] * hi];
  if (gridSame(a, b)) return null;
  return [a, b];
}

// Horizontal and vertical lines through the curve extremes of the paths: anchors whose handles are horizontal
// (a top or bottom of a curve) or vertical (a left or right side). Corner anchors without handles are left to
// the straight-segment lines. Returns infinite lines { p, d }.
function axisLines(paths, angleTol) {
  var tol = angleTol > 0 ? angleTol : 0.01;
  var out = [];
  for (var i = 0; i < paths.length; i++) {
    var pts = paths[i].points || [];
    for (var j = 0; j < pts.length; j++) {
      var pt = pts[j];
      var t = !gridSame(pt.r, pt.a) ? gridSub(pt.r, pt.a) : (!gridSame(pt.l, pt.a) ? gridSub(pt.a, pt.l) : null);
      if (!t) continue;
      var ang = Math.abs(Math.atan2(t[1], t[0])); // 0..pi
      if (ang < tol || Math.PI - ang < tol) out.push({ p: pt.a, d: [1, 0] });
      else if (Math.abs(ang - Math.PI / 2) < tol) out.push({ p: pt.a, d: [0, 1] });
    }
  }
  return out;
}

// Normal form of an infinite line: angle in [0, pi) and the signed distance of the line from the origin,
// so the same line drawn in either direction compares equal.
function gridNormalForm(line) {
  var theta = Math.atan2(line.d[1], line.d[0]);
  if (theta < 0) theta += Math.PI;
  if (theta >= Math.PI - 1e-12) theta -= Math.PI;
  var off = -Math.sin(theta) * line.p[0] + Math.cos(theta) * line.p[1];
  return { theta: theta, off: off };
}

// Merge lines that are the same within the tolerances (radians, points). Lines are sorted by their normal
// form first and each joins the first cluster whose first line it matches, so the result does not depend on
// input order. Each cluster is drawn as its average line, which sits between the edges it stands for.
// Returns { p, d } with d of unit length.
function mergeLines(lines, angleTol, offsetTol) {
  var items = [];
  var i;
  for (i = 0; i < lines.length; i++) {
    if (!lines[i]) continue;
    var nf = gridNormalForm(lines[i]);
    items.push({ theta: nf.theta, off: nf.off });
  }
  items.sort(function (a, b) { return a.theta - b.theta || a.off - b.off; });
  var reps = [];
  for (i = 0; i < items.length; i++) {
    var it = items[i], matched = null;
    for (var k = 0; k < reps.length && !matched; k++) {
      var r = reps[k];
      var dt = Math.abs(it.theta - r.theta);
      if (dt <= angleTol && Math.abs(it.off - r.off) <= offsetTol) {
        matched = { rep: r, theta: it.theta, off: it.off };
      } else if (Math.PI - dt <= angleTol && Math.abs(it.off + r.off) <= offsetTol) {
        // Angles near 0 and near pi are almost the same direction; the offset flips sign across that seam.
        matched = { rep: r, theta: it.theta + (it.theta < r.theta ? Math.PI : -Math.PI), off: -it.off };
      }
    }
    if (matched) {
      matched.rep.sumTheta += matched.theta;
      matched.rep.sumOff += matched.off;
      matched.rep.count++;
    } else {
      reps.push({ theta: it.theta, off: it.off, sumTheta: it.theta, sumOff: it.off, count: 1 });
    }
  }
  var out = [];
  for (i = 0; i < reps.length; i++) {
    var theta = reps[i].sumTheta / reps[i].count, off = reps[i].sumOff / reps[i].count;
    var c = Math.cos(theta), s = Math.sin(theta);
    out.push({ p: [-s * off, c * off], d: [c, s] });
  }
  return out;
}

function gridClampLevel(level) {
  var n = Number(level);
  if (isNaN(n)) n = 50;
  return Math.max(0, Math.min(100, n));
}

// Gridline sensitivity 0..100 to merge tolerances. `size` is the selection diagonal, so the result does not
// depend on document scale. At 0 only exact duplicates merge; at 100 lines within 3 degrees and 2% of the
// logo size merge.
function sensitivityToTolerances(level, size) {
  var f = gridClampLevel(level) / 100;
  var s = size > 0 ? size : 100;
  return {
    angle: (0.05 + 2.95 * f) * Math.PI / 180,
    offset: Math.max(GRID_EPS, s * (0.0005 + 0.0195 * f))
  };
}

// Circle complexity 0..100 to the allowed deviation of a curve from its circle: 5% of the logo size at
// "minimal" down to 0.05% at "complex", on a log scale.
function complexityToTolerance(level, size) {
  var f = gridClampLevel(level) / 100;
  var s = size > 0 ? size : 100;
  return Math.max(GRID_EPS / 10, s * 0.05 * Math.pow(0.01, f));
}
