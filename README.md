# SCCTLM Vector

An Adobe Illustrator panel (CEP) for batch exporting artboards: many artboards, many formats and many scales in one click, with naming templates and saved presets. The panel UI is in Vietnamese.

> Status: early development. Only the loading spike exists so far; the export features are planned.

## Planned features

- Export multiple artboards to PNG and SVG at several scales (for example 1x and 2x).
- PDF tab with Print and Review modes, multi-page or per-artboard output, and a predicted file size. See [docs/pdf-export.md](docs/pdf-export.md).
- Artboard size and orientation controls: resize or flip the ticked artboards in place, in pt/mm/cm/in/px, without rebuilding the document. See [docs/artboard-size.md](docs/artboard-size.md).
- Grid tab that draws a logo construction grid (anchors, handles, outlines, gridlines, fitted circles) from the selected paths. See [docs/logo-grid.md](docs/logo-grid.md).
- Colour picker window with a live CMYK gamut warning: out-of-gamut colours are greyed across the whole field, using the document's ICC profile, and OK paints the selection. See [docs/color-picker.md](docs/color-picker.md).
- Naming templates and saved presets.
- One-step install on Windows and macOS.
- Self-update from GitHub Releases.
- Native on Apple Silicon: the package ships no native code, so Rosetta is not needed.

## Requirements

- Adobe Illustrator 2022 (v26) or later.

See [docs/install.md](docs/install.md) to install and [docs/release-process.md](docs/release-process.md) to release.

## Try the spike by hand

The panel id is `vn.scctlm.vector`. Until installers exist, copy the contents of `src/` into the CEP extensions folder and enable unsigned panels.

1. Enable debug mode for CSXS 9 to 12.
   - Windows: set `HKCU\Software\Adobe\CSXS.<n>` value `PlayerDebugMode` (string) to `1`.
   - macOS: `defaults write com.adobe.CSXS.<n> PlayerDebugMode 1`.
2. Copy `src/*` to:
   - Windows: `%APPDATA%\Adobe\CEP\extensions\vn.scctlm.vector`
   - macOS: `~/Library/Application Support/Adobe/CEP/extensions/vn.scctlm.vector`
3. Restart Illustrator and open **Window > Extensions > SCCTLM Vector**.

After editing anything under `src/app/`, click **↻ Tải lại** in the panel footer (or close and reopen the panel) to reload the UI and the ExtendScript engine; Illustrator keeps running. The reload is a fresh page document, so unsaved panel state (ticked artboards, output folder) resets; presets are kept. The colour picker is a separate window: close and reopen it to reload its code. Changes to `CSXS/manifest.xml`, `loader.html`, `picker-loader.html`, `loader.js` or `loader-core.js` still need Illustrator restarted and the files copied again.

The panel shows the Illustrator version and `process.arch`. Test results are tracked in [docs/spike-results.md](docs/spike-results.md).

## Layout

| Path | Purpose |
|---|---|
| `src/CSXS/manifest.xml` | CEP manifest |
| `src/loader.html` | Stable shell that hosts the app |
| `src/picker-loader.html` | Stable shell for the colour picker window (`app/picker.html`) |
| `src/app/` | Panel UI |
| `src/app/jsx/` | ExtendScript run inside Illustrator (part of the updatable app) |
| `src/loader*.js` | Fixed shell: applies updates, rolls back on failure |
| `installer/` | Windows (Inno Setup) and macOS (shell script) installers |
| `scripts/` | Packaging, signing and native-code scan |
| `docs/` | Project documentation |

## License

Licensed under the [Apache License 2.0](LICENSE). Copyright 2026 SCCTLM.
