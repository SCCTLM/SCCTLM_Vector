---
phase: 6
title: "Release pipeline and verification"
status: pending
priority: P2
effort: 1d
dependencies: [2, 3, 4, 5]
---

# Phase 6: Release pipeline

## Goal
A tagged push builds, scans, signs and publishes everything needed by installers and the updater.

## Files
- Create: `.github/workflows/release.yml`
- Create: `scripts/package-app.mjs`, `scripts/sign-release.mjs`, `scripts/scan-native.mjs`
- Create: `docs/release-process.md` (short: tag, publish, key handling, installer rebuild rules)

## Steps
1. Trigger on `v*` tag. Version from tag is written into `version.json` and `manifest.xml`.
2. `package-app.mjs`: zip `app/` into `app-vX.Y.Z.zip`, produce `.sha256`.
3. `scan-native.mjs` (**Rosetta guard**): fail if the package or `app/` contains any `.node`, `.dll`, `.exe`, `.dylib`, `.so`, or any file whose magic bytes are Mach-O/PE/ELF.
4. `sign-release.mjs`: ed25519 signature `.sig` using a CI secret.
5. Jobs: `windows-latest` builds the Inno installer; `macos-14` (arm64) runs the `install-mac.sh` integration test and the native-code scan; no `.pkg` until a Developer ID exists.
6. Before public launch: publish installers, zip, `.sha256`, `.sig` as a GitHub Release on the private `SCCTLM/SCCTLM_Ilus` repo for hand-installing testers. At public launch: create `SCCTLM/SCCTLM_Ilus-releases` and publish there instead (cross-repo token as a secret scoped to that repo only), and flip `UPDATE_REPO` on.

## End-to-end verification (release gate)
1. Clean Windows VM: install, export fixture, publish a higher version, update succeeds.
2. Apple Silicon Mac without Rosetta (needs a beta tester, since there is no in-house Mac): same sequence; confirm no Rosetta prompt and `process.arch` is `arm64`. Do not call Mac support verified until this passes.
3. Acceptance criteria 1-5 in `plan.md` all checked.

## Risk
Releasing a broken `app/` is the main failure mode; the Phase 5 rollback is the mitigation, and CI should run the zip-structure checks before publishing.
