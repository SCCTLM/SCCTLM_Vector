// Creates a sample logo for the Grid tab and selects it: a square, a circle, an S-curve, a compound path
// (ring) and a group. Run in Illustrator: File > Scripts > Other Script..., then press Generate in the panel.
var doc = app.documents.add(DocumentColorSpace.RGB, 600, 400);
var black = new RGBColor();
black.red = 30; black.green = 30; black.blue = 30;

function paint(item) { item.filled = true; item.fillColor = black; item.stroked = false; return item; }

var square = paint(doc.pathItems.rectangle(350, 40, 120, 120));
var circle = paint(doc.pathItems.ellipse(350, 200, 120, 120));

var s = doc.pathItems.add();
s.setEntirePath([[360, 290], [520, 290]]);
s.pathPoints[0].rightDirection = [400, 370];
s.pathPoints[1].leftDirection = [480, 210];
s.filled = false; s.stroked = true; s.strokeColor = black; s.strokeWidth = 4;

var ring = doc.compoundPathItems.add();
paint(ring.pathItems.ellipse(180, 40, 140, 140));
var hole = ring.pathItems.ellipse(140, 80, 60, 60);
hole.polarity = PolarityValues.NEGATIVE;

var group = doc.groupItems.add();
paint(group.pathItems.rectangle(180, 260, 80, 40));
paint(group.pathItems.ellipse(130, 270, 60, 60));

doc.selection = [square, circle, s, ring, group];
'grid sample ready: ' + doc.selection.length + ' items selected';
