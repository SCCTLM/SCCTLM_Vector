# Spike results: CEP panel load test

Status: partially complete. Spike files are written and copied to the Windows CEP folder; the load checks need Illustrator 2022 (v26) opened by a person.

## Setup used
- Manifest: host `ILST` `[26.0,99.9]`, `RequiredRuntime CSXS 10.0`, params `--enable-nodejs --mixed-context`.
- Debug mode: `HKCU\Software\Adobe\CSXS.9` to `CSXS.12`, `PlayerDebugMode=1` (set on the dev Windows PC). Mac equivalent: `defaults write com.adobe.CSXS.<n> PlayerDebugMode 1`.
- Panel copied by hand to `%APPDATA%\Adobe\CEP\extensions\vn.scctlm.vector`.
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

## PDF export on a real document (Illustrator 26.0.2, Windows)

Document: 13 artboards, 39 raster images, about 1070 paths, 349 MB `.ai`. Measured with `tests/fixtures/spike-pdf-saveas.jsx` and `diag-engine-run.jsx`.

| Result | Value |
|---|---|
| Open document after any export or estimate | unchanged (name, path, saved flag); temporary copy deleted |
| `saveAs` PDF on the temporary copy | copy keeps its `.ai` name, so the copy is not re-linked on this version |
| PDF with editing data kept | 326 MB |
| Print (editing data removed, JPEG maximum) | 5.24 MB |
| Review, JPEG high | 5.52 MB (larger than Print on this file) |
| Review, JPEG medium | 3.50 MB |
| Estimate vs real file | identical to within a few dozen bytes (both come from the same save) |
| Time for one estimate (Print + Review) | about 47 s; one export 23-31 s |
| Per-artboard review PDFs (artboards 1-3, medium) | 0.33 to 0.38 MB each |

Findings that shaped the code:
- Setting `pDFPreset` does not fill in the compression and downsampling values; they must be set explicitly.
- Set the downsampling properties before the compression level, otherwise the JPEG level comes out wrong.
- `CompressionQuality.JPEGMAXIMUM` and `JPEGHIGH` gave the same size here; `JPEGMEDIUM`, `JPEGLOW` and `JPEGMINIMUM` give progressively smaller files.
- Downsampling to 150 ppi only matters for images above 225 ppi; this document mostly gains from removing editing data and from JPEG level.

---

# Kết quả spike: kiểm tra tải panel CEP

Trạng thái: hoàn thành một phần. Các file spike đã được viết và sao chép vào thư mục CEP của Windows; việc kiểm tra tải cần có người mở Illustrator 2022 (v26).

## Cấu hình đã sử dụng
- Manifest: host `ILST` `[26.0,99.9]`, `RequiredRuntime CSXS 10.0`, tham số `--enable-nodejs --mixed-context`.
- Chế độ Debug: `HKCU\Software\Adobe\CSXS.9` đến `CSXS.12`, `PlayerDebugMode=1` (được thiết lập trên máy Windows dev). Lệnh tương đương trên Mac: `defaults write com.adobe.CSXS.<n> PlayerDebugMode 1`.
- Panel được sao chép thủ công vào `%APPDATA%\Adobe\CEP\extensions\vn.scctlm.vector`.
- Illustrator không tìm thấy trong `C:\Program Files\Adobe` trên máy dev tại thời điểm kiểm tra, vì vậy chưa chạy bài kiểm tra nạp panel.

## Ma trận kiểm thử

| Ô | Panel hiển thị | Phiên bản Illustrator hiển thị | `process.arch` | Kết quả |
|---|---|---|---|---|
| Windows x Illustrator 2022 (v26) | chưa chạy | chưa chạy | kỳ vọng `x64` | đang chờ (pending) |
| Apple Silicon x Illustrator 2022 (v26), không Rosetta | chưa chạy | chưa chạy | phải là `arm64` | đang chờ (pending) |

## Các mục kiểm tra trên Mac (cần ghi lại)
- `pgrep oahd` không in ra gì và `/Library/Apple/usr/share/rosetta` không tồn tại.
- Panel vẫn tải bình thường; `process.arch` trả về `arm64`.

## Các phiên bản và khóa CSXS thực tế cần thiết
Sẽ được ghi lại sau khi chạy (khóa `CSXS.n` nào đã giúp panel tải được).

## Ghi chú
- Kế hoạch liệt kê dải host là `[27.0,99.9]` ở một chỗ và `26.0` ở một chỗ khác; `26.0` được sử dụng vì phiên bản mục tiêu là Illustrator 2022 (v26).
- Nếu panel thất bại trên phiên bản mục tiêu, chuyển sang phương án dự phòng dùng hộp thoại ScriptUI theo phần rủi ro của giai đoạn (phase risk).

## Xuất PDF trên một tài liệu thực tế (Illustrator 26.0.2, Windows)

Tài liệu: 13 artboard, 39 ảnh raster, khoảng 1070 path, file `.ai` 349 MB. Được đo lường bằng `tests/fixtures/spike-pdf-saveas.jsx` và `diag-engine-run.jsx`.

| Kết quả kiểm tra | Giá trị |
|---|---|
| Tài liệu đang mở sau khi xuất hoặc ước tính | không đổi (tên, đường dẫn, cờ trạng thái đã lưu); bản sao tạm thời đã được xóa |
| `saveAs` PDF trên bản sao tạm | bản sao giữ nguyên tên đuôi `.ai`, do đó bản sao không bị liên kết lại trên phiên bản này |
| File PDF giữ nguyên dữ liệu chỉnh sửa | 326 MB |
| Bản In ấn (đã loại bỏ dữ liệu chỉnh sửa, JPEG maximum) | 5,24 MB |
| Bản Duyệt, JPEG high | 5,52 MB (lớn hơn bản In ấn trên file này) |
| Bản Duyệt, JPEG medium | 3,50 MB |
| So sánh ước tính với file thực tế | giống hệt nhau trong phạm vi vài chục byte (cả hai đều từ cùng một lần lưu) |
| Thời gian cho một lần ước tính (In ấn + Duyệt) | khoảng 47 giây; một lần xuất mất 23-31 giây |
| File PDF duyệt theo từng artboard (artboard 1-3, medium) | 0,33 đến 0,38 MB mỗi file |

Các phát hiện đã định hình mã nguồn:
- Việc gán `pDFPreset` không tự động điền các giá trị nén và giảm độ phân giải; chúng phải được thiết lập rõ ràng.
- Phải thiết lập các thuộc tính downsampling trước mức nén, nếu không mức nén JPEG sẽ bị áp dụng sai.
- `CompressionQuality.JPEGMAXIMUM` và `JPEGHIGH` cho cùng một dung lượng ở file này; `JPEGMEDIUM`, `JPEGLOW` và `JPEGMINIMUM` cho dung lượng giảm dần tương ứng.
- Việc giảm độ phân giải xuống 150 ppi chỉ có tác dụng đối với hình ảnh trên 225 ppi; tài liệu này giảm dung lượng chủ yếu nhờ loại bỏ dữ liệu chỉnh sửa và mức nén JPEG.
