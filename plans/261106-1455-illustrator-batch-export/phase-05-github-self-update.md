---
phase: 5
title: "GitHub self-update (safe, reversible, pure JS)"
status: pending
priority: P1
effort: 2d
dependencies: [3, 4]
---

# Phase 5: GitHub self-update

## Goal
The installed panel finds a newer GitHub Release, downloads it, verifies it, and switches to it on next launch, rolling back automatically if the new version fails to start.

## Layout on disk
```
com.ilus.batchexport/
  CSXS/manifest.xml     (fixed; changes only via reinstall)
  loader.html           (fixed; swap + health check + rollback)
  app/                  (current version; replaced by updates)
  app.prev/             (previous version, kept for rollback)
user data dir/ilus-batch-export/
  staging/              (downloaded + verified new app)
  presets.json          (never touched by updates)
```

## Files
- Create: `src/loader.html`, `src/loader.js`, `src/app/updater.js`, `src/app/lib/fflate.js` (vendored pure-JS zip, no native code)
- Create: `src/update-pubkey.pem` (ed25519 public key)

## Steps
1. **Check:** `https.get` (Node built-in) to `https://api.github.com/repos/${UPDATE_REPO}/releases/latest`, where `UPDATE_REPO` is one constant in `src/app/config.js`, set to `SCCTLM/SCCTLM_Ilus-releases` at public launch (the private source repo is never contacted by clients). Until the public repo exists the updater stays disabled in shipped builds and is exercised against a local mock of the Releases API (a test-only base-URL override that is stripped from release builds); send a `User-Agent`; compare semver with `app/version.json`. Run at most once per 24h plus a manual "Check for updates" button, to stay under the unauthenticated 60/hour rate limit. Offline or API errors fail silently with a status line.
2. **Download:** release assets `app-vX.Y.Z.zip`, `app-vX.Y.Z.zip.sha256`, `app-vX.Y.Z.zip.sig`. Follow redirects (GitHub asset URLs redirect to a CDN).
3. **Verify:** SHA-256 via Node `crypto`, then ed25519 signature over the zip using the embedded public key (Node `crypto.verify`). Reject on any mismatch. The private key lives offline or in a protected CI secret, never in the repo.
4. **Extract safely:** fflate into `staging/`; reject entries with `..` or absolute paths (zip-slip); require `version.json` and `index.html` present; enforce a size cap.
5. **Apply on next launch:** `loader.js` sees `staging/ready` marker, renames `app` to `app.prev`, moves `staging` to `app`, then loads `app/index.html`. Renames happen before any app file is open, which avoids Windows file-lock problems.
6. **Health check / rollback:** the new app must post a `ready` message to the loader within N seconds; otherwise the loader restores `app.prev`, records the failed version, and does not retry that version.
7. **UX:** non-blocking banner "Update 1.2.0 available, Install" and "Restart panel to finish"; show release notes from the release body. Never auto-install without a click.
8. **Out-of-scope for updates:** manifest/loader changes. The version file declares `minLoaderVersion`; if an update needs a newer loader, the panel links to the full installer instead.

## Verification
- Publish a test release with higher version: banner appears, update applies, version label changes.
- Tampered zip (flipped byte), wrong signature, zip-slip entry, and truncated download are each rejected with no change on disk.
- Release containing a deliberately crashing `app/` rolls back and the old version still works.
- Presets unchanged across update and rollback.
- Update path uses no process spawning and no native modules (works identically on Apple Silicon without Rosetta).

## Risks
- GitHub API limits and offline use: handled by throttling and silent failure.
- Private source repo: clients read only the public release-only repo, so no token ships in the panel.
- Key loss: keep a documented key-rotation path (new public key can only ship via full installer).
