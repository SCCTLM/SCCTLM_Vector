---
phase: 4
title: "Installers (Windows, macOS) with no Rosetta"
status: pending
priority: P1
effort: 2d
dependencies: [1]
---

# Phase 4: Installers

## Goal
One double-click installs the panel for the current user on each OS. No admin password on Windows, no Rosetta on Apple Silicon.

## Files
- Create: `installer/windows/setup.iss` (Inno Setup, per-user, `PrivilegesRequired=lowest`)
- Create: `installer/macos/build-pkg.sh`, `installer/macos/scripts/postinstall`, `installer/macos/distribution.xml`
- Create: `installer/uninstall notes` in `docs/`

## Windows
1. Install to `{userappdata}\Adobe\CEP\extensions\com.ilus.batchexport`.
2. Write `HKCU\Software\Adobe\CSXS.9`..`CSXS.12` `PlayerDebugMode=1` (string).
3. Uninstaller removes the folder and leaves the registry keys (other extensions may rely on them).
4. Inno output is a 32-bit x86 stub; it runs on x64 and on Windows on ARM via built-in emulation. Acceptable, noted in docs.

## macOS
MVP is a single `installer/macos/install-mac.sh`, run as `curl -fsSL <release url> | bash`. No `.pkg` until a Developer ID exists.
1. Runs as the current user: no root, so no wrong-home-directory bug.
2. Downloads the extension zip, verifies SHA-256 (and the ed25519 signature when the key is present), extracts to `~/Library/Application Support/Adobe/CEP/extensions/com.ilus.batchexport`.
3. `defaults write com.adobe.CSXS.N PlayerDebugMode 1` for N in 9..12, then `killall cfprefsd`.
4. Idempotent, prints clear success/failure, handles an existing install (keeps `presets.json`), and a `--uninstall` flag.
5. Uses only tools present on stock macOS (`curl`, `unzip`/`ditto`, `shasum`, `defaults`); no Rosetta-dependent tooling. The zip contains no native code (guarded in Phase 6).
6. Docs page gives the command in a copy button plus a short "open Terminal, paste, press Enter" guide.
7. Deferred: a signed and notarized `.pkg` when a Developer ID is available; it would reuse this script's logic.

## Verification
- Windows: clean VM, run `.exe`, panel appears after restarting Illustrator; uninstall removes it.
- macOS (no Mac available): GitHub Actions `macos-14` job runs `install-mac.sh` against a local file server, then asserts the extension folder contents, the `defaults read com.adobe.CSXS.11 PlayerDebugMode` value, idempotent re-run, `--uninstall`, and `shellcheck` cleanliness.
- Real-Illustrator load on Apple Silicon is verified by a beta tester (Phase 6 gate), not by us.
- Reinstall over an existing version keeps `presets.json`.

## Risk
Cannot confirm panel loading in Illustrator on a real Mac ourselves; the CEP behaviour is identical to Windows apart from the preference key, which CI does check.
