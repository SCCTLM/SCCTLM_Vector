# Spike results: CEP panel load test

Status: partially complete. Spike files are written and copied to the Windows CEP folder; the load checks need Illustrator 2022 (v26) opened by a person.

## Setup used
- Manifest: host `ILST` `[26.0,99.9]`, `RequiredRuntime CSXS 10.0`, params `--enable-nodejs --mixed-context`.
- Debug mode: `HKCU\Software\Adobe\CSXS.9` to `CSXS.12`, `PlayerDebugMode=1` (set on the dev Windows PC). Mac equivalent: `defaults write com.adobe.CSXS.<n> PlayerDebugMode 1`.
- Panel copied by hand to `%APPDATA%\Adobe\CEP\extensions\vn.scctlm.vector`.
- Illustrator was not found under `C:\Program Files\Adobe` on the dev PC at check time, so no load test has run yet.

## Matrix

| Cell | Panel visible | Illustrator version shown | `process.arch` | Result |
|---|---|---|---|---|
| Windows x Illustrator 2022 (v26) | not run | not run | expected `x64` | pending |
| Apple Silicon x Illustrator 2022 (v26), no Rosetta | not run | not run | must be `arm64` | pending |

## Mac checks (to record)
- `pgrep oahd` prints nothing and `/Library/Apple/usr/share/rosetta` is missing.
- Panel still loads; `process.arch` reports `arm64`.

## CSXS versions and keys actually required
To be recorded after the run (which `CSXS.n` key made the panel load).

## Notes
- The plan listed the host range as `[27.0,99.9]` in one place and `26.0` in another; `26.0` is used because the target is Illustrator 2022 (v26).
- If the panel fails on the target version, fall back to a ScriptUI dialog per the phase risk section.

## PDF export on a real document (Illustrator 26.0.2, Windows)

Document: 13 artboards, 39 raster images, about 1070 paths, 349 MB `.ai`. Measured with `tests/fixtures/spike-pdf-saveas.jsx` and `diag-engine-run.jsx`.

| Result | Value |
|---|---|
| Open document after any export or estimate | unchanged (name, path, saved flag); temporary copy deleted |
| `saveAs` PDF on the temporary copy | copy keeps its `.ai` name, so the copy is not re-linked on this version |
| PDF with editing data kept | 326 MB |
| Print (editing data removed, JPEG maximum) | 5.24 MB |
| Review, JPEG high | 5.52 MB (larger than Print on this file) |
| Review, JPEG medium | 3.50 MB |
| Estimate vs real file | identical to within a few dozen bytes (both come from the same save) |
| Time for one estimate (Print + Review) | about 47 s; one export 23-31 s |
| Per-artboard review PDFs (artboards 1-3, medium) | 0.33 to 0.38 MB each |

Findings that shaped the code:
- Setting `pDFPreset` does not fill in the compression and downsampling values; they must be set explicitly.
- Set the downsampling properties before the compression level, otherwise the JPEG level comes out wrong.
- `CompressionQuality.JPEGMAXIMUM` and `JPEGHIGH` gave the same size here; `JPEGMEDIUM`, `JPEGLOW` and `JPEGMINIMUM` give progressively smaller files.
- Downsampling to 150 ppi only matters for images above 225 ppi; this document mostly gains from removing editing data and from JPEG level.
