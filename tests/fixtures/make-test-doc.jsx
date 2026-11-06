// Creates a 5-artboard test document for the batch export panel and saves it next to this script.
// Run in Illustrator: File > Scripts > Other Script...
// Expected export: 5 artboards x PNG+SVG x 1x+2x = 20 files (raster formats get a scale suffix).
var names = ['Home Page', 'About/Us', 'Logo: dark', 'Icon*set', 'Banner'];
var colors = [[230, 60, 60], [60, 160, 230], [40, 40, 40], [250, 190, 40], [90, 200, 120]];
var doc = app.documents.add(DocumentColorSpace.RGB, 400, 300, 5, DocumentArtboardLayout.GridByRow, 20, 5);
for (var i = 0; i < names.length; i++) {
  var ab = doc.artboards[i];
  ab.name = names[i];
  var r = ab.artboardRect; // left, top, right, bottom
  var c = new RGBColor();
  c.red = colors[i][0]; c.green = colors[i][1]; c.blue = colors[i][2];
  var rect = doc.pathItems.rectangle(r[1] - 40, r[0] + 40, (r[2] - r[0]) - 80, (r[1] - r[3]) - 80);
  rect.fillColor = c;
  rect.stroked = false;
  var label = doc.textFrames.add();
  label.contents = names[i];
  label.position = [r[0] + 60, r[1] - 120];
  label.textRange.characterAttributes.size = 28;
}
var outFile = new File(File($.fileName).parent.fsName + '/vector-test-5-artboards.ai');
doc.saveAs(outFile);
'saved ' + outFile.fsName;
