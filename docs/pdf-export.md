# PDF export

The **PDF** tab saves the selected artboards as PDF through Illustrator's PDF save options, which allow per-image compression that the Export for Screens path does not. It shows a predicted file size before you export.

## Modes

| | In ấn (Print) | Duyệt (Review) |
|---|---|---|
| Base preset | High Quality Print | High Quality Print |
| Images | no downsampling: images keep their resolution (naming the preset does not apply any downsampling, measured) | images above 225 ppi are reduced to 150 ppi (bicubic) |
| JPEG quality | set by the compression ratio | set by the compression ratio |
| Illustrator editing data | removed | removed |

## Compression
The **Tỉ lệ nén** slider (0-100%, default 20% = Cao, JPEG Maximum) sets the JPEG level for both modes; higher means a smaller file and softer images. The **Thấp / Trung bình / Cao** buttons are presets for the slider (80% / 50% / 20%) and light up only while the slider sits exactly on one of them.

| Compression | JPEG level |
|---|---|
| 0-20% | Maximum |
| 21-40% | High |
| 41-60% | Medium |
| 61-80% | Low |
| 81-100% | Minimum |

Removing the editing data is the main reason these PDFs are far smaller than a default save. A PDF saved this way can lose layers or turn text into outlines when reopened in Illustrator, so keep the original `.ai` file.

## Layouts
- **Gộp nhiều trang** (One multi-page PDF, default): the selected artboards in order, named `<document>_print.pdf` or `<document>_review.pdf`.
- **Lẻ từng trang** (One PDF per artboard): `<document>_<artboard>_print.pdf` and so on. Existing files are never overwritten; a number is appended.

## Size estimate
The panel saves a real trial PDF of the selected mode into a temporary folder, measures it and deletes it. With more than 20 selected artboards it trials only the median-sized artboard and scales by artboard count; the readout then shows `≈`. The estimate runs only when you press **Tính toán** (Calculate), because Illustrator is unresponsive while it works (about 47 s for a 349 MB document with 13 artboards). Changing the artboard selection, the mode, the compression or the open document clears the number until you calculate again.

## Requirements and safety
- The document must be **saved with no pending changes**. The PDF is made from the saved file, so the estimate and export show an error asking you to save first when there are unsaved edits or no file yet.
- Saving a PDF can re-link the document it runs on to the new file. To avoid that, the engine copies the saved `.ai` next to the original (a short-lived file named `~scctlm-<time>.ai`, so relative links still resolve), opens the copy, saves the PDFs from it, closes it without saving and deletes it. Your open document is never saved or re-linked; the engine compares its name, path and saved state before and after and reports an error if anything changed.
- The estimate measures a single multi-page file. "Lẻ từng trang" repeats shared fonts and resources in every file, so those files add up to somewhat more than the estimate.

Related: [spike results](spike-results.md).

---

# Xuất PDF

Tab **PDF** lưu các artboard được chọn dưới dạng PDF thông qua các tùy chọn lưu PDF của Illustrator, cho phép nén từng hình ảnh mà quy trình Export for Screens không hỗ trợ. Nó hiển thị dung lượng file dự đoán trước khi bạn thực hiện xuất.

## Các chế độ

| | In ấn | Duyệt |
|---|---|---|
| Preset cơ sở | High Quality Print | High Quality Print |
| Hình ảnh | không giảm độ phân giải: hình ảnh giữ nguyên độ phân giải (việc chỉ định preset không tự áp dụng bất kỳ bước downsample nào, đã đo lường thực tế) | hình ảnh trên 225 ppi được giảm xuống 150 ppi (bicubic) |
| Chất lượng JPEG | theo tỉ lệ nén | theo tỉ lệ nén |
| Dữ liệu chỉnh sửa Illustrator | đã loại bỏ | đã loại bỏ |

## Nén
Thanh trượt **Tỉ lệ nén** (0-100%, mặc định 20% = Cao, JPEG Maximum) quyết định mức JPEG cho cả hai chế độ; càng cao file càng nhẹ và ảnh càng kém nét. Các nút **Thấp / Trung bình / Cao** là preset của thanh trượt (80% / 50% / 20%) và chỉ sáng lên khi thanh trượt nằm đúng ở một trong các giá trị đó.

| Tỉ lệ nén | Mức JPEG |
|---|---|
| 0-20% | Maximum |
| 21-40% | High |
| 41-60% | Medium |
| 61-80% | Low |
| 81-100% | Minimum |

Việc loại bỏ dữ liệu chỉnh sửa của Illustrator là lý do chính khiến các file PDF này nhẹ hơn rất nhiều so với file lưu mặc định. File PDF lưu theo cách này có thể mất các layer hoặc biến văn bản thành outline khi mở lại trong Illustrator, vì vậy hãy giữ lại file `.ai` gốc.

## Bố cục xuất
- **Gộp nhiều trang** (mặc định): các artboard được chọn theo thứ tự, được đặt tên `<document>_print.pdf` hoặc `<document>_review.pdf`.
- **Lẻ từng trang**: `<document>_<artboard>_print.pdf`, v.v. Các file đã tồn tại không bao giờ bị ghi đè; một số thứ tự sẽ được thêm vào sau tên file.

## Ước tính dung lượng
Panel sẽ lưu một file PDF thử nghiệm thực tế của chế độ đang chọn vào thư mục tạm, đo kích thước rồi xóa đi. Nếu có hơn 20 artboard được chọn, panel chỉ thử nghiệm trên artboard có kích thước trung vị và nhân theo số lượng artboard; khi đó kết quả sẽ hiển thị dấu `≈`. Ước tính dung lượng chỉ chạy khi bạn nhấn **Tính toán**, vì Illustrator sẽ không phản hồi trong khi xử lý (khoảng 47 giây cho một tài liệu 349 MB với 13 artboard). Việc thay đổi lựa chọn artboard, chế độ, tỉ lệ nén hoặc tài liệu đang mở sẽ xóa con số cho đến khi bạn tính toán lại.

## Yêu cầu và tính an toàn
- Tài liệu phải **được lưu và không có thay đổi chưa lưu**. File PDF được tạo từ file đã lưu, do đó việc ước tính và xuất sẽ báo lỗi yêu cầu bạn lưu tài liệu trước nếu có các chỉnh sửa chưa lưu hoặc chưa có file trên ổ đĩa.
- Việc lưu PDF có thể liên kết lại (re-link) tài liệu đang mở sang file mới. Để tránh điều đó, engine sẽ sao chép file `.ai` đã lưu sang vị trí bên cạnh file gốc (một file tạm có tên `~scctlm-<time>.ai`, giúp các đường dẫn tương đối vẫn hoạt động), mở bản sao đó lên, lưu các file PDF từ nó, đóng lại mà không lưu và xóa bản sao đi. Tài liệu đang mở của bạn không bao giờ bị lưu đè hay re-link; engine so sánh tên, đường dẫn và trạng thái đã lưu trước và sau khi chạy, sau đó báo lỗi nếu có bất kỳ thay đổi nào.
- Ước tính dung lượng đo trên một file nhiều trang duy nhất. Chế độ "Lẻ từng trang" lặp lại các font và tài nguyên dùng chung trong từng file, do đó tổng dung lượng các file đó sẽ lớn hơn một chút so với con số ước tính.

Liên quan: [kết quả spike](spike-results.md).
