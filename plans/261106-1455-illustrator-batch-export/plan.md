---
title: "Illustrator Batch Export panel (CEP) with one-click install and GitHub self-update"
description: "MVP CEP panel for batch artboard export, multi-format, naming templates, scale presets and saved presets; Windows/Mac installers; GitHub Releases self-update; no Rosetta on Apple Silicon."
status: pending
priority: P1
effort: 10d
tags: [illustrator, cep, extendscript, installer, auto-update]
blockedBy: []
blocks: []
created: 2026-11-06
---

# Illustrator Batch Export

## Outcome
A panel in Illustrator (Window > Extensions) that exports many artboards x many formats x many scales in one click, with a naming template and saved presets. Installed by one double-click per OS. Updates itself from GitHub Releases. Runs natively on Apple Silicon without Rosetta.

## Non-goals
Adobe Exchange listing, WebP/AVIF/optimisation, cloud upload, InDesign/Photoshop, preset sync across machines, UXP port.

## Key decisions
- **Tech:** CEP panel (HTML/JS UI) + ExtendScript engine calling `exportForScreens`. Chosen because UXP is not publicly available for Illustrator. Export engine stays behind a thin message interface so a later UXP port only replaces the shell.
- **No Rosetta (hard rule):** the shipped package contains zero native code. No `.node` modules, no bundled executables. Updater uses only Node built-ins plus a vendored pure-JS zip library. The Mac installer is a plain shell script (no compiled code). CI fails the build if any Mach-O, `.node`, `.dll` or `.exe` is found inside the extension package.
- **Update architecture:** the manifest points at a tiny stable `loader.html`. The real app lives in a versioned `app/` folder. An update is downloaded, verified, staged, and swapped in by the loader on next launch, with automatic rollback. The manifest and loader change only through a full reinstall.

## Phases
| # | Phase | Depends on | Status |
|---|---|---|---|
| 1 | [Spike: panel loads on target Illustrator, arm64 proof](phase-01-spike-and-toolchain.md) | none | pending |
| 2 | [ExtendScript export engine](phase-02-export-engine.md) | 1 | pending |
| 3 | [Panel UI, naming, presets](phase-03-panel-ui-naming-presets.md) | 2 | pending |
| 4 | [Installers (Windows exe, macOS shell script)](phase-04-installers.md) | 1 | pending |
| 5 | [GitHub self-update](phase-05-github-self-update.md) | 3, 4 | pending |
| 6 | [Release pipeline and verification](phase-06-release-pipeline-verification.md) | 2-5 | pending |

Phases 2 and 4 can run in parallel after Phase 1 (disjoint files: `jsx/` vs `installer/`).

## Acceptance criteria
1. 5 artboards, PNG+SVG, 1x+2x produces 20 files with names matching the template.
2. A saved preset survives quitting and reopening Illustrator.
3. On a clean Windows machine and a clean Apple Silicon Mac (Rosetta not installed), one installer run makes the panel appear under Window > Extensions.
4. Publishing a newer GitHub Release makes the installed panel offer an update; accepting it results in the new version after relaunch; a deliberately broken release rolls back to the previous version.
5. No Rosetta prompt at install or at runtime on Apple Silicon; CI native-code scan passes.

## Settled inputs (2026-11-06)
- **Target:** Illustrator 2022 (v26), CSXS 10/11. CEP is fully supported there, which removes most of the "CEP not loading" risk seen on 2026 builds. Manifest host range starts at `26.0`.
- **No Apple Developer ID and no Mac for testing:** the Mac installer is a **single shell script run by a copy-paste Terminal one-liner** (no `.pkg` in the MVP). It runs as the user (no root pitfalls), is not blocked by Gatekeeper (curl sets no quarantine flag), and can be tested for real on GitHub's `macos-14` arm64 runners. A signed `.pkg` is deferred until a Developer ID exists. Honest cost: Mac install is "copy one command" rather than "double-click".
- **Source repo:** `SCCTLM/SCCTLM_Ilus`, private, created. Source stays private.
- **Update source:** clients cannot read a private repo without an extractable token, so releases go to a separate **public, release-only repo** (`SCCTLM/SCCTLM_Ilus-releases`). **It is created only when the product is ready to go public to the community**; until then the update repo is a single constant (`UPDATE_REPO`), the updater is tested against a local mock of the GitHub Releases API, and early testers install by hand from private-repo release assets.
- **Mac verification without hardware:** CI on `macos-14` verifies the install script (files, `defaults` keys, no native code). Loading inside real Illustrator on Apple Silicon needs one community/beta tester; this is a known untested gap until then.

## Open questions
None blocking. Phase 1 needs an Illustrator 2022 machine (the Windows PC is enough for the first spike).
