# Install and uninstall

The panel id is `vn.scctlm.vector`. Requires Illustrator 2022 (v26) or later.

## Windows

Run `SCCTLM-Vector-Setup.exe` from the release page. It installs for the current user (no administrator prompt) into `%APPDATA%\Adobe\CEP\extensions\vn.scctlm.vector` and sets `PlayerDebugMode=1` for `CSXS.9` to `CSXS.12` under `HKCU\Software\Adobe`. Restart Illustrator, then open **Window > Extensions > SCCTLM Vector**.

Uninstall from **Settings > Apps**. The registry keys are left in place because other panels may use them. Presets are kept.

The installer is a 32-bit stub; it runs on x64 and on Windows on ARM through the built-in emulation. The panel itself contains no native code.

## macOS

No `.pkg` yet (that needs an Apple Developer ID). Open **Terminal**, paste the command below, press Enter:

```
curl -fsSL https://github.com/SCCTLM/SCCTLM_Vector/releases/latest/download/install-mac.sh | bash
```

The script runs as you (no `sudo`), checks the SHA-256 of the download, installs into `~/Library/Application Support/Adobe/CEP/extensions/vn.scctlm.vector`, and runs `defaults write com.adobe.CSXS.<n> PlayerDebugMode 1` for 9 to 12. It uses only tools that ship with macOS, and the package has no native code, so Rosetta is not needed on Apple Silicon.

Uninstall: `bash install-mac.sh --uninstall`. Presets are kept.

The repository above has no release until the first tag is published. Until then testers download `install-mac.sh` and `vector-extension.zip` (plus its `.sha256`) from the private release and run `VECTOR_BASE_URL=file:///path/to/folder bash install-mac.sh`.

## Where things live

| What | Where |
|---|---|
| Panel files | the `extensions/vn.scctlm.vector` folder above |
| Presets and update state | `%APPDATA%\vector-batch-export` (Windows), `~/Library/Application Support/vector-batch-export` (macOS) |

Click **Kiểm tra cập nhật** in the panel footer to check for a new version; **Cài đặt** downloads it, and it takes effect when the panel is reopened. Updates replace only the `app` folder inside the panel folder; presets are never touched.

---

# Cài đặt và gỡ cài đặt

ID của panel là `vn.scctlm.vector`. Yêu cầu Illustrator 2022 (v26) trở lên.

## Windows

Chạy file `SCCTLM-Vector-Setup.exe` từ trang release. Nó sẽ cài đặt cho người dùng hiện tại (không yêu cầu quyền quản trị viên) vào thư mục `%APPDATA%\Adobe\CEP\extensions\vn.scctlm.vector` và thiết lập `PlayerDebugMode=1` cho `CSXS.9` đến `CSXS.12` trong `HKCU\Software\Adobe`. Khởi động lại Illustrator, sau đó mở **Window > Extensions > SCCTLM Vector**.

Gỡ cài đặt từ **Settings > Apps**. Các khóa registry được giữ nguyên vì các panel khác có thể sử dụng chúng. Các preset cài đặt sẵn được giữ lại.

Trình cài đặt là một stub 32-bit; nó chạy được trên x64 và Windows on ARM thông qua trình giả lập tích hợp sẵn. Bản thân panel không chứa mã native.

## macOS

Chưa có gói `.pkg` (vì cần Apple Developer ID). Mở **Terminal**, dán lệnh bên dưới và nhấn Enter:

```
curl -fsSL https://github.com/SCCTLM/SCCTLM_Vector/releases/latest/download/install-mac.sh | bash
```

Script chạy dưới quyền người dùng của bạn (không cần `sudo`), kiểm tra mã SHA-256 của file tải về, cài đặt vào `~/Library/Application Support/Adobe/CEP/extensions/vn.scctlm.vector`, và chạy `defaults write com.adobe.CSXS.<n> PlayerDebugMode 1` cho các phiên bản từ 9 đến 12. Script chỉ sử dụng các công cụ có sẵn trên macOS và gói cài đặt không có mã native, do đó không cần Rosetta trên máy Apple Silicon.

Gỡ cài đặt: `bash install-mac.sh --uninstall`. Các preset được giữ lại.

Kho lưu trữ ở trên chưa có bản phát hành nào cho đến khi tag đầu tiên được xuất bản. Cho đến lúc đó, người thử nghiệm có thể tải `install-mac.sh` và `vector-extension.zip` (kèm file `.sha256`) từ bản phát hành nội bộ và chạy `VECTOR_BASE_URL=file:///path/to/folder bash install-mac.sh`.

## Nơi lưu trữ dữ liệu

| Nội dung | Vị trí |
|---|---|
| Các file của Panel | thư mục `extensions/vn.scctlm.vector` ở trên |
| Preset và trạng thái cập nhật | `%APPDATA%\vector-batch-export` (Windows), `~/Library/Application Support/vector-batch-export` (macOS) |

Nhấn **Kiểm tra cập nhật** ở chân trang panel để kiểm tra phiên bản mới; **Cài đặt** sẽ tải về và có hiệu lực khi mở lại panel. Các bản cập nhật chỉ thay thế thư mục `app` bên trong thư mục panel; các preset không bao giờ bị đụng đến.
