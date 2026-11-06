# Install and uninstall

The panel id is `vn.scctlm.ilus`. Requires Illustrator 2022 (v26) or later.

## Windows

Run `SCCTLM-Ilus-Setup.exe` from the release page. It installs for the current user (no administrator prompt) into `%APPDATA%\Adobe\CEP\extensions\vn.scctlm.ilus` and sets `PlayerDebugMode=1` for `CSXS.9` to `CSXS.12` under `HKCU\Software\Adobe`. Restart Illustrator, then open **Window > Extensions > SCCTLM Ilus**.

Uninstall from **Settings > Apps**. The registry keys are left in place because other panels may use them. Presets are kept.

The installer is a 32-bit stub; it runs on x64 and on Windows on ARM through the built-in emulation. The panel itself contains no native code.

## macOS

No `.pkg` yet (that needs an Apple Developer ID). Open **Terminal**, paste the command below, press Enter:

```
curl -fsSL https://github.com/SCCTLM/SCCTLM_Ilus-releases/releases/latest/download/install-mac.sh | bash
```

The script runs as you (no `sudo`), checks the SHA-256 of the download, installs into `~/Library/Application Support/Adobe/CEP/extensions/vn.scctlm.ilus`, and runs `defaults write com.adobe.CSXS.<n> PlayerDebugMode 1` for 9 to 12. It uses only tools that ship with macOS, and the package has no native code, so Rosetta is not needed on Apple Silicon.

Uninstall: `bash install-mac.sh --uninstall`. Presets are kept.

The release-only repository above does not exist until public launch. Until then testers download `install-mac.sh` and `ilus-extension.zip` (plus its `.sha256`) from the private release and run `ILUS_BASE_URL=file:///path/to/folder bash install-mac.sh`.

## Where things live

| What | Where |
|---|---|
| Panel files | the `extensions/vn.scctlm.ilus` folder above |
| Presets and update state | `%APPDATA%\ilus-batch-export` (Windows), `~/Library/Application Support/ilus-batch-export` (macOS) |

Updates replace only the `app` folder inside the panel folder; presets are never touched.
