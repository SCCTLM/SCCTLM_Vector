---
phase: 3
title: "Panel UI, naming, presets"
status: pending
priority: P1
effort: 2d
dependencies: [2]
---

# Phase 3: Panel UI and presets

## Goal
HTML panel that drives the engine: artboard checklist, format and scale toggles, naming template with live preview, output folder, export button with progress, and saved presets.

## Files
- Create: `src/app/index.html`, `src/app/panel.js`, `src/app/panel.css`, `src/app/bridge.js` (wraps `CSInterface.evalScript`, JSON in/out), `src/app/presets.js`
- Vendor: `src/app/lib/CSInterface.js`

## Steps
1. Bridge: single `runJob(job)` and `listArtboards()` API; all engine calls go through it.
2. UI: "All / None" artboards, format checkboxes, scale chips 1x-4x, template input with token buttons and live example filename, folder picker (`cep.fs.showOpenDialogEx`), Export button, result list with per-file status.
3. Presets: JSON stored at the user data dir (`SystemPath.USER_DATA`/`ilus-batch-export/presets.json`), outside the extension folder so updates never erase them. Save, rename, delete, apply; schema has `version` for forward migration.
4. Match Illustrator UI theme (listen to `ThemeColorChanged`).
5. Refresh artboard list on document change.

## Verification
- Acceptance criteria 1 and 2 pass manually on Windows and Apple Silicon.
- Presets file survives an app update simulation (Phase 5) and reinstall.
- No Node native modules are required (`require` only `fs`, `path`, `os`).
