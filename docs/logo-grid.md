# Grid tab: logo construction grid

The Grid tab draws a construction grid over the selected vector artwork. It never changes the artwork itself; everything goes on a layer named `SCCTLM Grid` at the top of the document.

## Use

1. Select the logo: paths, compound paths and groups (groups are searched inside). Outline text first; text, placed images, clipping masks, hidden items (including everything inside a hidden group) and other items are skipped and counted in the status line.
2. Open the **Grid** tab, turn on the elements you want and press **Generate**.
3. Press **Generate** again after changing options: the previous grid layer is replaced, even if it was locked or hidden. **Clear** removes it. If drawing fails, the previous grid stays and the partly drawn one is removed.

**Generate all** draws every element for that run without changing your toggles. When the anchor points plus the circles to draw exceed 2,000, the panel asks before running, because Illustrator stops responding while it draws. High circle complexity can produce many more circles than anchors.

Illustrator may record the drawing as many undo steps, so use **Clear** to remove a grid rather than Undo.

## Elements

| Element | What is drawn | Sublayer |
|---|---|---|
| Anchors | a square marker on every anchor point | Anchors |
| Handles | a line from each anchor to each direction point that is pulled out, plus a round marker at its end | Handles |
| Outlines | an unfilled copy of every path | Outlines |
| Gridlines | every straight segment extended across the artwork, plus horizontal and vertical lines through anchors whose handles are horizontal or vertical (the top, bottom and sides of curves) | Gridlines |
| Circles | circles that follow each curved segment | Circles |

Sublayers with nothing on them are removed. Each element has its own style (size, fill, stroke, stroke width, with **None** to turn fill or stroke off). Sizes and widths are in points. In CMYK documents the chosen colours are converted with the plain formula k = 1 − max(r, g, b).

## Options

- **Gridlines, Merge (Low to High):** how close two lines must be to count as one. At Low only identical lines merge; at High lines within 3 degrees and 2% of the logo size merge. Merged lines are drawn as their average. The default (50) merges the duplicate lines a square or a symmetric logo produces.
- **Gridlines, Margin:** how far the lines run past the artwork, in points.
- **Circles, Minimal to Complex:** how closely the circles must follow the curve. Each curve is first split where it changes bend direction (an S-curve becomes two pieces); a piece gets one circle through its start, middle and end and is halved again while the curve strays too far from that circle. Minimal allows 5% of the logo size, Complex 0.05%. Nearly straight pieces get no circle.
- **Circles, Per curve:** **All** circles, the **First** N from the start of each curve, or the N covering the **Longest** parts of it.

Settings are saved in `grid-settings.json` next to `presets.json` in the per-user data folder, so updates keep them.

## Code

- `src/app/jsx/grid-geometry.jsx`: maths only (segments, inflections, circle fitting, line clipping and merging), unit tested in `tests/grid-geometry.test.js`.
- `src/app/jsx/grid-engine.jsx`: reads the selection and draws the layer; `gridInspect`, `gridGenerate`, `gridClear`. Tested against stand-in Illustrator objects in `tests/grid-engine.test.js`.
- `src/app/grid-panel.js`, `src/app/grid-settings.js`, `src/app/tabs.js`: tab UI, saved settings and tab switching.
- `tests/fixtures/make-grid-test-doc.jsx`: builds and selects a sample logo for a manual check in Illustrator.

This feature is an original implementation written from a description of the behaviour. It contains no code or artwork from other grid tools.
