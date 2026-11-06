# Release process

## One-time setup
1. Generate the signing keys: `node scripts/sign-release.mjs --generate-key private.pem public.pem`.
2. Commit `public.pem` as `src/update-pubkey.pem`. Store the contents of `private.pem` as the repository secret `VECTOR_SIGNING_KEY` and keep an offline copy. Never commit it.
3. Key rotation: a new public key can only reach users through a full reinstall (the key lives outside the updatable `app` folder).

## Cut a release
1. Tag and push: `git tag vX.Y.Z && git push origin vX.Y.Z`.
2. The `ci-release` workflow runs tests, the native-code scan, the macOS install test on `macos-14`, builds the Windows installer, signs `app-vX.Y.Z.zip`, and publishes a GitHub Release with:
   `app-vX.Y.Z.zip` (+ `.sha256`, `.sig`) for the updater, and `vector-extension.zip` (+ `.sha256`), `SCCTLM-Vector-Setup.exe`, `install-mac.sh` for installs.
3. The release job fails if `src/update-pubkey.pem` or the signing secret is missing.

## Going public
Updates stay off until `UPDATE_REPO` in `src/app/config.js` is set. At public launch: create `SCCTLM/SCCTLM_Vector-releases`, publish releases there (token scoped to that repo only), set `UPDATE_REPO` to `SCCTLM/SCCTLM_Vector-releases`, and ship that build.

## What needs a full reinstall
Changes to `CSXS/manifest.xml`, `loader.html`, `loader.js`, `loader-core.js`, or `update-pubkey.pem`. An update whose `version.json` has a higher `minLoaderVersion` than the installed loader is refused with a prompt to run the installer.

## Release gate (manual)
- Clean Windows machine: install, export a fixture, publish a higher version, accept the update, relaunch, confirm the new version; publish a deliberately broken version and confirm rollback.
- Apple Silicon Mac without Rosetta: same sequence; confirm no Rosetta prompt and `process.arch` is `arm64`. Mac support is not verified until this passes (needs a beta tester).
