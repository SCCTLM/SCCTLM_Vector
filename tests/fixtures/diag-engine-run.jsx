// Diagnostic: runs the real engine functions (estimatePdf, runPdfExport) on the active saved document and
// returns their JSON replies. Output goes to .tmp-pdf-test/run (ignored by git).
#include "../../src/app/jsx/json2.jsx"
#include "../../src/app/jsx/naming.jsx"
#include "../../src/app/jsx/pdf-options.jsx"
#include "../../src/app/jsx/engine.jsx"

var out = Folder(File($.fileName).parent.parent.parent.fsName + '/.tmp-pdf-test/run').fsName.replace(/\\/g, '/');
var lines = [];
function step(label, fn) {
  var t = new Date().getTime();
  var r = fn();
  lines.push(label + ' (' + Math.round((new Date().getTime() - t) / 100) / 10 + ' s): ' + r);
}

step('estimate high', function () { return estimatePdf(JSON.stringify({ artboards: 'all', quality: 'high', modes: ['print', 'review'] })); });
step('estimate medium', function () { return estimatePdf(JSON.stringify({ artboards: 'all', quality: 'medium', modes: ['review'] })); });
step('export print single', function () { return runPdfExport(JSON.stringify({ artboards: 'all', mode: 'print', quality: 'high', layout: 'single', outputDir: out })); });
step('export review high single', function () { return runPdfExport(JSON.stringify({ artboards: 'all', mode: 'review', quality: 'high', layout: 'single', outputDir: out })); });
step('export review medium single', function () { return runPdfExport(JSON.stringify({ artboards: 'all', mode: 'review', quality: 'medium', layout: 'single', outputDir: out })); });
step('export review medium separate 1-3', function () { return runPdfExport(JSON.stringify({ artboards: [0, 1, 2], mode: 'review', quality: 'medium', layout: 'separate', outputDir: out })); });
step('export again (name collision)', function () { return runPdfExport(JSON.stringify({ artboards: 'all', mode: 'print', quality: 'high', layout: 'single', outputDir: out })); });
lines.join('\n');
