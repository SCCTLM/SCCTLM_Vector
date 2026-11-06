---
phase: 1
title: "Spike: panel loads on target Illustrator, arm64 proof"
status: pending
priority: P1
effort: 1d
dependencies: []
---

# Phase 1: Spike and toolchain

## Goal
Prove, before building features, that a hand-copied CEP panel loads in the user's Illustrator on Windows and Apple Silicon, with no Rosetta.

## Why first
Reports about CEP failing to load concern Illustrator 2026; the target here is Illustrator 2022 (v26), where CEP is supported, so risk is lower. The spike still confirms it on real machines, including Apple Silicon without Rosetta. Use CSXS 10/11 and set `PlayerDebugMode` for `CSXS.10` and `CSXS.11` (keep 9-12 for safety). Manifest host version range starts at `26.0`.

## Files to create
- `src/CSXS/manifest.xml` (ExtensionBundleId, host `ILST` version range `[27.0,99.9]`, CSXS 11 and 12 runtime, `--enable-nodejs` and `--mixed-context` CEF params)
- `src/loader.html`, `src/app/index.html` (shows version, runs one `evalScript` returning `app.version`)
- `src/jsx/ping.jsx`
- `package.json`, repo skeleton, `.gitignore`

## Steps
1. Create minimal panel that displays Illustrator version and OS arch (`process.arch` from Node).
2. Copy by hand to the user CEP extensions folder (`%APPDATA%\Adobe\CEP\extensions`, `~/Library/Application Support/Adobe/CEP/extensions`); set `PlayerDebugMode=1` for `CSXS.9`-`CSXS.12`.
3. Test matrix: Windows x target Illustrator version; Apple Silicon Mac x target Illustrator version.
4. On the Mac confirm Rosetta is absent (`pgrep oahd` returns nothing; `/Library/Apple/usr/share/rosetta` missing) and the panel still loads; confirm `process.arch` reports `arm64`.
5. Record which CSXS versions and registry keys were actually required.

## Verification
- Panel visible and shows `process.arch = arm64` on Apple Silicon with no Rosetta.
- Written result in `docs/spike-results.md`: pass/fail per cell of the matrix.

## Risk and rollback
If the panel will not load on the target version, stop and re-brief: fallback is a ScriptUI dialog (`.jsx` only) with the same engine, losing the nicer UI and the loader-based updater.
