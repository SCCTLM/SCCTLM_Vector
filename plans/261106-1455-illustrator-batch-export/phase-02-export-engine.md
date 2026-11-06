---
phase: 2
title: "ExtendScript export engine"
status: pending
priority: P1
effort: 2d
dependencies: [1]
---

# Phase 2: Export engine

## Goal
A pure ExtendScript module that, given a job description, exports the selected artboards in the selected formats and scales and returns a per-file result list.

## Files
- Create: `src/jsx/engine.jsx`, `src/jsx/naming.jsx`, `src/jsx/json2.jsx` (ES3 JSON polyfill)
- Create: `tests/fixtures/five-artboards.ai` (manual QA file)

## Job contract (JSON in, JSON out)
`{ artboards: [indexes|"all"], formats: ["png","jpg","svg","pdf"], scales: [1,2,3,4], template: "{doc}_{artboard}@{scale}x", outputDir: "..." }` returns `{ files: [{path, ok, error}] }`.

## Steps
1. List artboards (index, name) for the UI.
2. Export raster formats via `Document.exportForScreens` per scale; SVG and PDF are scale-independent, so export once and skip scale suffix duplication.
3. Naming tokens: `{doc}`, `{artboard}`, `{index}`, `{scale}`, `{format}`, `{date}`. Sanitise illegal filename characters, disambiguate duplicate artboard names with the index, truncate overlong names.
4. Handle unsaved document (no `{doc}` name), missing output folder, existing files (overwrite policy: suffix, not silent overwrite), and per-file failure without aborting the batch.
5. Return structured results; never show native alerts from the engine.

## Verification
- Manual QA on the fixture: 5 artboards x PNG,SVG x 1x,2x yields exactly 20 expected names (SVG appears per artboard once per scale only if template includes `{scale}`; document the rule and test it).
- Duplicate artboard names and artboard names with `/ : ?` handled.
- Engine contains no platform-specific path code beyond `Folder`/`File` objects.

## Risk
`exportForScreens` behaviour differs across Illustrator versions; confirm in the Phase 1 matrix and fall back to per-artboard `exportFile` with `ImageCaptureOptions`/`ExportOptionsPNG24` if scale handling is inconsistent.
