# SCCTLM Ilus

An Adobe Illustrator panel (CEP) for batch exporting artboards: many artboards, many formats and many scales in one click, with naming templates and saved presets.

> Status: early development. Only the loading spike exists so far; the export features are planned.

## Planned features

- Export multiple artboards to PNG and SVG at several scales (for example 1x and 2x).
- Naming templates and saved presets.
- One-step install on Windows and macOS.
- Self-update from GitHub Releases.
- Native on Apple Silicon: the package ships no native code, so Rosetta is not needed.

## Requirements

- Adobe Illustrator 2022 (v26) or later.

## Try the spike by hand

The panel id is `vn.scctlm.ilus`. Until installers exist, copy the contents of `src/` into the CEP extensions folder and enable unsigned panels.

1. Enable debug mode for CSXS 9 to 12.
   - Windows: set `HKCU\Software\Adobe\CSXS.<n>` value `PlayerDebugMode` (string) to `1`.
   - macOS: `defaults write com.adobe.CSXS.<n> PlayerDebugMode 1`.
2. Copy `src/*` to:
   - Windows: `%APPDATA%\Adobe\CEP\extensions\vn.scctlm.ilus`
   - macOS: `~/Library/Application Support/Adobe/CEP/extensions/vn.scctlm.ilus`
3. Restart Illustrator and open **Window > Extensions > SCCTLM Ilus**.

The panel shows the Illustrator version and `process.arch`. Test results are tracked in [docs/spike-results.md](docs/spike-results.md).

## Layout

| Path | Purpose |
|---|---|
| `src/CSXS/manifest.xml` | CEP manifest |
| `src/loader.html` | Stable shell that hosts the app |
| `src/app/` | Panel UI |
| `src/jsx/` | ExtendScript run inside Illustrator |
| `docs/` | Project documentation |

## License

Licensed under the [Apache License 2.0](LICENSE). Copyright 2026 SCCTLM.
