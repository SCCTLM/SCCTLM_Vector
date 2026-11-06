# Spike results: CEP panel load test

Status: partially complete. Spike files are written and copied to the Windows CEP folder; the load checks need Illustrator 2022 (v26) opened by a person.

## Setup used
- Manifest: host `ILST` `[26.0,99.9]`, `RequiredRuntime CSXS 10.0`, params `--enable-nodejs --mixed-context`.
- Debug mode: `HKCU\Software\Adobe\CSXS.9` to `CSXS.12`, `PlayerDebugMode=1` (set on the dev Windows PC). Mac equivalent: `defaults write com.adobe.CSXS.<n> PlayerDebugMode 1`.
- Panel copied by hand to `%APPDATA%\Adobe\CEP\extensions\vn.scctlm.ilus`.
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
