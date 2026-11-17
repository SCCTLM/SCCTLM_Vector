# PDF export

The **PDF** tab saves the selected artboards as PDF through Illustrator's PDF save options, which allow per-image compression that the Export for Screens path does not. It shows a predicted file size before you export.

## Modes

| | In ấn (Print) | Duyệt (Review) |
|---|---|---|
| Base preset | High Quality Print | High Quality Print |
| Images | no downsampling: images keep their resolution (naming the preset does not apply any downsampling, measured) | images above 225 ppi are reduced to 150 ppi (bicubic) |
| JPEG quality | Maximum | High, or Medium when chosen |
| Illustrator editing data | removed | removed |

Removing the editing data is the main reason these PDFs are far smaller than a default save. A PDF saved this way can lose layers or turn text into outlines when reopened in Illustrator, so keep the original `.ai` file.

## Layouts
- **Một PDF nhiều trang** (One multi-page PDF, default): the selected artboards in order, named `<document>_print.pdf` or `<document>_review.pdf`.
- **Mỗi artboard một PDF** (One PDF per artboard): `<document>_<artboard>_print.pdf` and so on. Existing files are never overwritten; a number is appended.

## Size estimate
The panel saves a real trial PDF into a temporary folder, measures it and deletes it, once for Print and once for Review. With more than 20 selected artboards it trials only the median-sized artboard and scales by artboard count; the readout then shows `≈`. The estimate runs only when you press **Tính dung lượng** (Calculate size), because Illustrator is unresponsive while it works (about 47 s for a 349 MB document with 13 artboards). Changing the artboard selection, the Review quality or the open document clears the numbers until you calculate again.

## Requirements and safety
- The document must be **saved with no pending changes**. The PDF is made from the saved file, so the estimate and export show an error asking you to save first when there are unsaved edits or no file yet.
- Saving a PDF can re-link the document it runs on to the new file. To avoid that, the engine copies the saved `.ai` next to the original (a short-lived file named `~scctlm-<time>.ai`, so relative links still resolve), opens the copy, saves the PDFs from it, closes it without saving and deletes it. Your open document is never saved or re-linked; the engine compares its name, path and saved state before and after and reports an error if anything changed.
- Both modes are measured in one pass, so a pass opens the copy once.
- The estimate measures a single multi-page file. "One PDF per artboard" repeats shared fonts and resources in every file, so those files add up to somewhat more than the estimate.

Related: [spike results](spike-results.md).

---

# Xuất PDF

Tab **PDF** lưu các artboard được chọn dưới dạng PDF thông qua các tùy chọn lưu PDF của Illustrator, cho phép nén từng hình ảnh mà quy trình Export for Screens không hỗ trợ. Nó hiển thị dung lượng file dự đoán trước khi bạn thực hiện xuất.

## Các chế độ

| | In ấn | Duyệt |
|---|---|---|
| Preset cơ sở | High Quality Print | High Quality Print |
| Hình ảnh | không giảm độ phân giải: hình ảnh giữ nguyên độ phân giải (việc chỉ định preset không tự áp dụng bất kỳ bước downsample nào, đã đo lường thực tế) | hình ảnh trên 225 ppi được giảm xuống 150 ppi (bicubic) |
| Chất lượng JPEG | Maximum | High, hoặc Medium khi được chọn |
| Dữ liệu chỉnh sửa Illustrator | đã loại bỏ | đã loại bỏ |

Việc loại bỏ dữ liệu chỉnh sửa của Illustrator là lý do chính khiến các file PDF này nhẹ hơn rất nhiều so với file lưu mặc định. File PDF lưu theo cách này có thể mất các layer hoặc biến văn bản thành outline khi mở lại trong Illustrator, vì vậy hãy giữ lại file `.ai` gốc.

## Bố cục xuất
- **Một PDF nhiều trang** (mặc định): các artboard được chọn theo thứ tự, được đặt tên `<document>_print.pdf` hoặc `<document>_review.pdf`.
- **Mỗi artboard một PDF**: `<document>_<artboard>_print.pdf`, v.v. Các file đã tồn tại không bao giờ bị ghi đè; một số thứ tự sẽ được thêm vào sau tên file.

## Ước tính dung lượng
Panel sẽ lưu một file PDF thử nghiệm thực tế vào thư mục tạm, đo kích thước rồi xóa đi, một lần cho In ấn và một lần cho Duyệt. Nếu có hơn 20 artboard được chọn, panel chỉ thử nghiệm trên artboard có kích thước trung vị và nhân theo số lượng artboard; khi đó kết quả sẽ hiển thị dấu `≈`. Ước tính dung lượng chỉ chạy khi bạn nhấn **Tính dung lượng**, vì Illustrator sẽ không phản hồi trong khi xử lý (khoảng 47 giây cho một tài liệu 349 MB với 13 artboard). Việc thay đổi lựa chọn artboard, chất lượng bản Duyệt hoặc tài liệu đang mở sẽ xóa các con số cho đến khi bạn tính toán lại.

## Yêu cầu và tính an toàn
- Tài liệu phải **được lưu và không có thay đổi chưa lưu**. File PDF được tạo từ file đã lưu, do đó việc ước tính và xuất sẽ báo lỗi yêu cầu bạn lưu tài liệu trước nếu có các chỉnh sửa chưa lưu hoặc chưa có file trên ổ đĩa.
- Việc lưu PDF có thể liên kết lại (re-link) tài liệu đang mở sang file mới. Để tránh điều đó, engine sẽ sao chép file `.ai` đã lưu sang vị trí bên cạnh file gốc (một file tạm có tên `~scctlm-<time>.ai`, giúp các đường dẫn tương đối vẫn hoạt động), mở bản sao đó lên, lưu các file PDF từ nó, đóng lại mà không lưu và xóa bản sao đi. Tài liệu đang mở của bạn không bao giờ bị lưu đè hay re-link; engine so sánh tên, đường dẫn và trạng thái đã lưu trước và sau khi chạy, sau đó báo lỗi nếu có bất kỳ thay đổi nào.
- Cả hai chế độ đều được đo trong một lượt duy nhất, do đó mỗi lượt chỉ mở bản sao một lần.
- Ước tính dung lượng đo trên một file nhiều trang duy nhất. Chế độ "Mỗi artboard một PDF" lặp lại các font và tài nguyên dùng chung trong từng file, do đó tổng dung lượng các file đó sẽ lớn hơn một chút so với con số ước tính.

Liên quan: [kết quả spike](spike-results.md).
