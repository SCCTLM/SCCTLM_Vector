# Release process

## One-time setup
1. Generate the signing keys: `node scripts/sign-release.mjs --generate-key private.pem public.pem`.
2. Commit `public.pem` as `src/update-pubkey.pem`. Store the contents of `private.pem` as the repository secret `VECTOR_SIGNING_KEY` and keep an offline copy. Never commit it.
3. Key rotation: a new public key can only reach users through a full reinstall (the key lives outside the updatable `app` folder).

## Cut a release
1. Tag and push: `git tag vX.Y.Z && git push origin vX.Y.Z`.
2. The `ci-release` workflow runs tests, the native-code scan, the macOS install test on `macos-15`, builds the Windows installer, signs `app-vX.Y.Z.zip`, and publishes a GitHub Release with:
   `app-vX.Y.Z.zip` (+ `.sha256`, `.sig`) for the updater, and `vector-extension.zip` (+ `.sha256`), `SCCTLM-Vector-Setup.exe`, `install-mac.sh` for installs.
3. The release job fails if `src/update-pubkey.pem` or the signing secret is missing.

## Going public
Updates stay off until `UPDATE_REPO` in `src/app/config.js` is set. At public launch: create `SCCTLM/SCCTLM_Vector-releases`, publish releases there (token scoped to that repo only), set `UPDATE_REPO` to `SCCTLM/SCCTLM_Vector-releases`, and ship that build.

## What needs a full reinstall
Changes to `CSXS/manifest.xml`, `loader.html`, `picker-loader.html`, `notice-loader.html`, `loader.js`, `loader-core.js`, or `update-pubkey.pem`. An update whose `version.json` has a higher `minLoaderVersion` than the installed loader is refused with a prompt to run the installer.

When one of these files changes, raise `LOADER_VERSION` in `loader-core.js` and `minLoaderVersion` in `app/version.json` together. Loader version 2 added the colour picker window (a second extension in the manifest), so every install from before it needs the installer once. Loader version 3 added the notice window (a third extension), which shows the panel's status messages.

Changes under `app/` can be tested in place: copy the files into the installed `app/` folder and click the panel footer's **↻ Tải lại** button, which reloads the panel page and re-evaluates `jsx/engine.jsx`; it is refused while an export, PDF job, artboard resize or grid run is in flight. The colour picker window and ExtendScript globals are not reset by a reload, and the files listed above still need the installer.

## Release gate (manual)
- Clean Windows machine: install, export a fixture, publish a higher version, accept the update, relaunch, confirm the new version; publish a deliberately broken version and confirm rollback.
- Apple Silicon Mac without Rosetta: same sequence; confirm no Rosetta prompt and `process.arch` is `arm64`. Mac support is not verified until this passes (needs a beta tester).

---

# Quy trình phát hành (Release process)

## Thiết lập một lần duy nhất
1. Tạo các khóa ký: `node scripts/sign-release.mjs --generate-key private.pem public.pem`.
2. Commit `public.pem` dưới tên `src/update-pubkey.pem`. Lưu nội dung của `private.pem` thành repository secret có tên `VECTOR_SIGNING_KEY` và giữ một bản sao offline an toàn. Tuyệt đối không commit file này.
3. Luân chuyển khóa (key rotation): một public key mới chỉ có thể đến tay người dùng thông qua việc cài đặt lại hoàn toàn (khóa nằm ngoài thư mục `app` có thể cập nhật).

## Tạo một bản phát hành (Cut a release)
1. Đặt tag và push: `git tag vX.Y.Z && git push origin vX.Y.Z`.
2. Workflow `ci-release` sẽ chạy các bài kiểm thử, quét mã native, kiểm tra cài đặt macOS trên `macos-15`, build bộ cài đặt Windows, ký file `app-vX.Y.Z.zip`, và xuất bản một GitHub Release gồm:
   `app-vX.Y.Z.zip` (+ `.sha256`, `.sig`) cho bộ cập nhật, và `vector-extension.zip` (+ `.sha256`), `SCCTLM-Vector-Setup.exe`, `install-mac.sh` cho các bản cài đặt mới.
3. Release job sẽ thất bại nếu thiếu `src/update-pubkey.pem` hoặc secret khóa ký.

## Công khai bản phát hành (Going public)
Cơ chế cập nhật sẽ luôn tắt cho đến khi biến `UPDATE_REPO` trong `src/app/config.js` được thiết lập. Khi ra mắt công khai: tạo repo `SCCTLM/SCCTLM_Vector-releases`, phát hành các release tại đó (token chỉ cấp quyền cho repo đó), đặt `UPDATE_REPO` thành `SCCTLM/SCCTLM_Vector-releases`, và phát hành bản build đó.

## Những gì cần cài đặt lại toàn bộ
Những thay đổi đối với `CSXS/manifest.xml`, `loader.html`, `picker-loader.html`, `notice-loader.html`, `loader.js`, `loader-core.js`, hoặc `update-pubkey.pem`. Bản cập nhật có `version.json` chứa `minLoaderVersion` cao hơn loader đang cài đặt sẽ bị từ chối kèm thông báo yêu cầu chạy trình cài đặt.

Khi một trong các file này thay đổi, hãy tăng đồng thời `LOADER_VERSION` trong `loader-core.js` và `minLoaderVersion` trong `app/version.json`. Loader phiên bản 2 đã thêm cửa sổ chọn màu (extension thứ hai trong manifest), do đó mọi bản cài đặt trước đó đều cần chạy lại trình cài đặt một lần. Loader phiên bản 3 thêm cửa sổ thông báo (extension thứ ba) để hiển thị các thông báo trạng thái của panel.

Các thay đổi trong thư mục `app/` có thể được kiểm thử trực tiếp tại chỗ: sao chép các file vào thư mục `app/` đã cài đặt và nhấn nút **↻ Tải lại** ở chân trang của panel, thao tác này sẽ tải lại trang của panel và nạp lại `jsx/engine.jsx`; nút này sẽ từ chối hoạt động khi đang có tác vụ xuất file, xử lý PDF, đổi kích thước artboard hay tạo lưới đang chạy. Cửa sổ chọn màu và các biến toàn cục ExtendScript sẽ không bị reset khi tải lại, và các file liệt kê ở trên vẫn cần chạy lại trình cài đặt.

## Cổng phát hành (kiểm tra thủ công)
- Máy Windows sạch: cài đặt, xuất một file mẫu fixture, phát hành phiên bản cao hơn, chấp nhận cập nhật, khởi động lại, xác nhận phiên bản mới; phát hành một phiên bản cố tình gây lỗi và xác nhận tính năng khôi phục (rollback).
- Máy Mac Apple Silicon không có Rosetta: cùng quy trình trên; xác nhận không có thông báo yêu cầu Rosetta và `process.arch` là `arm64`. Hỗ trợ Mac chưa được xác thực cho đến khi vượt qua bước này (cần một beta tester).
