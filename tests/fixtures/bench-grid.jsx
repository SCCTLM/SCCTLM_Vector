// Benchmark for the Logo Lab grid engine. Run in Illustrator: File > Scripts > Other Script...
// For each logo size it draws one wavy closed path with N smooth anchors, then times gridInspect,
// gridGenerate and gridRestyle for several element sets, and returns one line per run (also shown in an alert).
// A new document is created and closed without saving. Times are wall clock on this machine, so compare
// runs of the same script only; repeat a few times and take the median.
#include "../../src/app/jsx/engine.jsx"

var SIZES = [50, 500, 2000];
var RUNS = [
  ['anchors', { anchors: true }],
  ['handles', { handles: true }],
  ['outlines', { outlines: true }],
  ['gridlines', { gridlines: true }],
  ['circles c30', { circles: true }, { complexity: 30 }],
  ['circles c100', { circles: true }, { complexity: 100 }],
  ['all', { anchors: true, handles: true, outlines: true, gridlines: true, circles: true }]
];

function now() { return new Date().getTime(); }

// A closed blob: radius wobbles around 150pt, handles follow the tangent.
function makeLogo(doc, n) {
  var cx = 300, cy = 200, pts = [], i;
  for (i = 0; i < n; i++) {
    var t = (i / n) * 2 * Math.PI;
    var r = 150 + 25 * Math.sin(5 * t);
    pts.push([cx + r * Math.cos(t), cy + r * Math.sin(t)]);
  }
  var path = doc.pathItems.add();
  path.setEntirePath(pts);
  path.closed = true;
  for (i = 0; i < n; i++) {
    var p = path.pathPoints[i], a = pts[(i + n - 1) % n], b = pts[(i + 1) % n];
    var k = 0.18;
    p.leftDirection = [pts[i][0] - (b[0] - a[0]) * k, pts[i][1] - (b[1] - a[1]) * k];
    p.rightDirection = [pts[i][0] + (b[0] - a[0]) * k, pts[i][1] + (b[1] - a[1]) * k];
  }
  path.filled = true;
  path.stroked = false;
  return path;
}

var doc = app.documents.add(DocumentColorSpace.RGB, 800, 600);
var lines = ['anchors | run | inspect ms | generate ms | restyle ms | drawn'];
try {
  for (var s = 0; s < SIZES.length; s++) {
    var path = makeLogo(doc, SIZES[s]);
    for (var r = 0; r < RUNS.length; r++) {
      doc.selection = [path];
      var job = {
        elements: { anchors: false, handles: false, outlines: false, gridlines: false, circles: false },
        style: {},
        gridlines: { sensitivity: 50, margin: 20, scope: 'selection' },
        circles: RUNS[r][2] ? { complexity: RUNS[r][2].complexity, mode: 'all', n: 2 } : { complexity: 30, mode: 'all', n: 2 }
      };
      for (var k in RUNS[r][1]) job.elements[k] = RUNS[r][1][k];
      var t0 = now();
      var info = JSON.parse(gridInspect(JSON.stringify(job)));
      var t1 = now();
      var res = JSON.parse(gridGenerate(JSON.stringify(job)));
      var t2 = now();
      JSON.parse(gridRestyle(JSON.stringify(job)));
      var t3 = now();
      var c = res.ok ? res.counts : null;
      var drawn = c ? (c.anchors + c.handles + (c.outlines || 0) + c.gridlines + c.circles) : ('error: ' + res.error);
      lines.push(SIZES[s] + ' | ' + RUNS[r][0] + ' | ' + (t1 - t0) + ' | ' + (t2 - t1) + ' | ' + (t3 - t2) + ' | ' + drawn +
        (info.ok && info.circles ? ' (circles ' + info.circles + ')' : ''));
      gridClear();
    }
    path.remove();
  }
} finally {
  doc.close(SaveOptions.DONOTSAVECHANGES);
}
var report = lines.join('\n');
alert(report);
report;
