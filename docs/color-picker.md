# Colour picker window: CMYK gamut warning

Illustrator's own Color Picker only shows a small warning triangle when a colour cannot be printed. This window shows the whole printable area: every colour in the field that falls outside the CMYK gamut is painted grey, and the grey area updates while you drag.

## Use

1. Select what you want to colour (paths, compound paths, text, groups) and press **Màu CMYK** in the panel header. The window opens with the colour of the active fill or stroke (the one in front in Illustrator's toolbar), or with the document default when nothing is selected. Pressing the button again while the window is open reloads the colour of the current selection.
2. Pick a colour:
   - Drag in the big square or on the vertical slider.
   - Choose which channel runs along the slider with the radio buttons: **H S B**, **R G B** or **L a b**. In H mode (the default) saturation runs left to right and brightness bottom to top.
   - Type values in any field. Arrow keys step by 1, Shift+arrow by 10. You can also type a hex code after **#**.
   - Type **C M Y K** to set the exact ink values. Typed CMYK is applied exactly as typed.
3. When the colour is outside the gamut, a warning triangle appears under the swatches with a small swatch of the nearest printable colour. Click either one to switch to that colour.
4. **OK** (or Enter) paints the colour and closes the window. **Huỷ** (Cancel) or Esc closes without changes. The **Fill / Stroke** menu picks which one is painted. It starts on the one active in Illustrator.

What OK changes:
- Selected paths, compound paths and text frames, including those inside groups, get the colour on their fill or stroke. Locked items, placed images and other objects are skipped.
- With nothing selected, the colour becomes the document's default fill or stroke.
- CMYK documents receive a CMYK colour; RGB documents receive an RGB colour.

The footer has a **Cảnh báo gamut** (gamut warning) switch for the grey area. It also shows which profile the check uses:
- CMYK documents use the document's own profile, so the profile menu is locked.
- RGB documents use the profile you pick in that menu. The default is the installed profile whose name contains FOGRA39, for example *Coated FOGRA39 (ISO 12647-2:2004)*. The window remembers your choice, the mode and the switch in `color-picker.json` next to `presets.json`.

## How it works

- **CMYK numbers.** In CMYK documents the C, M, Y and K fields come from Illustrator itself (`app.convertSampleColor`), recomputed while you drag. They are the numbers OK applies, using the document profile and your Illustrator colour settings. In RGB documents they come from the ICC engine for the chosen profile, so they are a guide only, because OK applies RGB.
- **Gamut check.** A colour is out of gamut when converting it sRGB → CMYK → sRGB through the profile moves it by more than ΔE 3. The conversion uses Relative Colorimetric intent with black point compensation, Illustrator's default. On 60 test colours this check gave the same answer as Illustrator for every colour. The engine is [jsColorEngine](https://github.com/glennwilton/jsColorEngine) (MPL-2.0), bundled unmodified in `src/app/lib/jscolorengine/` with its licence.
- **Speed.** When a profile loads, the window builds a 49 × 49 × 49 table of the round-trip difference (about 0.2 s). The grey area is read from that table with interpolation. Inside Illustrator 2022 (Chromium 88) a full 256 × 256 field with the mask takes 8–20 ms depending on the mode. While you drag, the field is drawn at half resolution (1–3 ms) and scaled up, so dragging keeps 60 fps. The full-resolution field is redrawn when you let go. The table agrees with the exact check on about 99.75% of colours. The rare disagreements are only on the border of the grey area.
- **Profiles.** The window reads every `.icc` / `.icm` file in these folders and matches each one by the name stored inside the file, not by its file name. Folders that do not exist are skipped:
  - Windows: `Common Files\Adobe\Color\Profiles` (and its `Recommended` folder) under `Program Files (x86)` and `Program Files`, `%APPDATA%\Adobe\Color\Profiles`, and `C:\Windows\System32\spool\drivers\color`.
  - macOS: `/Library/Application Support/Adobe/Color/Profiles` (and `Recommended`), `/Library/ColorSync/Profiles`, and the same two folders under `~/Library`.
  - Any `.icc` / `.icm` file placed in `src/app/profiles/` ships with the extension. Installed profiles win when both have the same name. The repository does not include one, because Adobe's profiles are not ours to redistribute; add a profile there only if its licence allows redistribution.

  When the window cannot check gamut it says why: no CMYK profile is installed, the CMYK document has no profile, or the document's profile is not installed. Picking and applying colours still works.
- **Lab** values are D50, computed from sRGB, and match Illustrator within about 0.6.

Code: `src/app/picker.*` (window), `src/app/color-math.js`, `color-gamut.js`, `color-field.js` (pure, tested in `tests/color-picker-core.test.js`), `src/app/jsx/color-engine.jsx` (Illustrator side, tested in `tests/color-engine.test.js`).

## Limits

- The window is a second CEP extension (`vn.scctlm.vector.picker`), so it needs the manifest from this version. Existing installs must run the installer once, because the auto-updater refuses this version on an older install. See [release-process.md](release-process.md).
- Spot colours are read as their tinted process equivalent. OK always applies a process colour, never a spot or global swatch.
- Gradients, patterns and "Only Web Colors" are not supported.
