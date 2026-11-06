// Manual spike for the PDF tab. Open a SAVED, image-heavy .ai document, then run:
// File > Scripts > Other Script... Results are written next to this script as spike-pdf-saveas.txt.
// It checks: (1) the open document is untouched, (2) a saveAs on the temporary copy re-links the copy
// (expected, which is why the engine never saves from the user's document), (3) Print vs Review sizes,
// (4) property names that visibly failed. Also open the Review PDF in Acrobat and check image ppi.
#include "../../src/app/jsx/json2.jsx"
#include "../../src/app/jsx/naming.jsx"
#include "../../src/app/jsx/pdf-options.jsx"
#include "../../src/app/jsx/engine.jsx"

var lines = [];
function log(s) { lines.push(s); }

var doc = app.activeDocument;
var tmp = new Folder(Folder.temp.fsName + '/scctlm-spike-pdf');
tmp.create();
var all = [];
for (var i = 0; i < doc.artboards.length; i++) all.push(i);

log('Illustrator ' + app.version + ', doc "' + doc.name + '", artboards ' + all.length);
log('open document before: ' + pdfDocIdentity(doc));

var variants = [['print', 'high'], ['review', 'high'], ['review', 'medium']];
enginePdfWithCopy(doc, function (copyDoc) {
  for (var v = 0; v < variants.length; v++) {
    var d = pdfModeDescriptor(variants[v][0], variants[v][1]);
    var built = enginePdfOptions(d, pdfArtboardRange(all));
    var f = new File(tmp.fsName + '/' + variants[v].join('_') + '.pdf');
    copyDoc.saveAs(f, built.opts);
    log(variants[v].join('/') + ': ' + f.length + ' bytes; properties that threw: [' + built.skipped.join(', ') + ']');
    log('  copy after save: ' + pdfDocIdentity(copyDoc));
  }
});
log('open document after:  ' + pdfDocIdentity(doc));
log('trial output kept in ' + tmp.fsName);

var out = new File(File($.fileName).parent.fsName + '/spike-pdf-saveas.txt');
out.open('w');
out.write(lines.join('\n'));
out.close();
lines.join('\n');
