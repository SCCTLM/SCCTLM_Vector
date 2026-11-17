# Artboard size and orientation

The **Kích thước & hướng** (size and orientation) block inside the Artboard section resizes the artboards you have ticked, so a document created with the wrong size or orientation does not have to be rebuilt.

Illustrator has no orientation property: portrait and landscape only mean which side is longer. The block therefore never stores an orientation. It shows whether the sides are **Dọc** (portrait), **Ngang** (landscape) or **Vuông** (square), and **Đổi hướng** swaps the two sides of each artboard on its own.

## Use

1. Tick the artboards to change. With none ticked, the block shows every artboard but Apply and Swap refuse to run.
2. Open **Kích thước & hướng** and choose the unit: `pt`, `mm`, `cm`, `in` or `px`. One pixel is one point; 72 pt = 1 in = 25.4 mm = 2.54 cm.
3. Type the width and height, or leave them and press **Đổi hướng**.
4. Press **Áp dụng** (Apply) or **Đổi hướng** (Swap).

Both actions keep each artboard's top-left corner and never scale or move the artwork: shrinking an artboard can leave artwork outside it, exactly as when the size is changed in Illustrator itself. Artboard names, positions and the document colour profile are untouched.

## Details

- One width/height pair applies to every ticked artboard. When the ticked artboards differ in size the fields show **Hỗn hợp** (mixed) and stay empty until you type a value.
- A decimal comma is accepted (`21,5`) as well as a dot.
- Sizes are validated before the first write. Empty, zero, negative or non-numeric input changes nothing and reports an error.
- If Illustrator refuses one artboard (a locked artboard, an out-of-range size), the artboards already changed in that run are restored and the error is shown; if a restore also fails, the error says how many artboards could not be put back. Illustrator owns the allowed size range; the panel adds no limits of its own.
- The rectangle is read back after the change and compared with the one that was written, for **Áp dụng** and **Đổi hướng** alike. A difference above 0.5 pt (0.18 mm) of any edge counts as a clamp: the run is undone and the size the document actually has is reported. The tolerance exists because Illustrator stores coordinates at limited precision.
- The panel sends the document identity (name and path) and the name of every ticked artboard. If the document was switched, renamed, or its artboards rearranged, renamed or replaced since the list was read, the request is refused instead of resizing the wrong artboards.
- Illustrator may record one undo step per artboard, so undoing a change to several artboards takes several undos.
- The block is hidden on the Grid tab, where artboard size does not apply.

---

# Kích thước và hướng Artboard

Khối **Kích thước & hướng** trong phần Artboard cho phép thay đổi kích thước các artboard mà bạn đã tích chọn, giúp tài liệu được tạo sai kích thước hoặc hướng không cần phải làm lại từ đầu.

Illustrator không có thuộc tính hướng (orientation): chiều dọc và ngang chỉ đơn giản là cạnh nào dài hơn. Do đó, khối này không bao giờ lưu trữ hướng. Nó hiển thị các cạnh hiện tại là **Dọc**, **Ngang** hoặc **Vuông**, và nút **Đổi hướng** sẽ tự động hoán đổi hai cạnh của từng artboard.

## Cách sử dụng

1. Tích chọn các artboard cần thay đổi. Nếu không tích chọn artboard nào, khối vẫn hiển thị tất cả các artboard nhưng nút Áp dụng và Đổi hướng sẽ từ chối thực hiện.
2. Mở **Kích thước & hướng** và chọn đơn vị: `pt`, `mm`, `cm`, `in` hoặc `px`. Một pixel tương đương một point; 72 pt = 1 in = 25,4 mm = 2,54 cm.
3. Nhập chiều rộng và chiều cao, hoặc để nguyên và nhấn **Đổi hướng**.
4. Nhấn **Áp dụng** hoặc **Đổi hướng**.

Cả hai thao tác đều giữ nguyên góc trên bên trái của mỗi artboard và không bao giờ co giãn hay di chuyển hình vẽ: việc thu nhỏ artboard có thể để lại hình vẽ nằm ngoài artboard, tương tự như khi đổi kích thước trực tiếp trong Illustrator. Tên artboard, vị trí và color profile của tài liệu đều được giữ nguyên.

## Chi tiết kỹ thuật

- Một cặp giá trị rộng/cao sẽ áp dụng cho tất cả các artboard được tích chọn. Khi các artboard được tích chọn có kích thước khác nhau, các trường sẽ hiển thị **Hỗn hợp** và để trống cho đến khi bạn nhập giá trị mới.
- Chấp nhận dấu phẩy thập phân (`21,5`) cũng như dấu chấm.
- Kích thước được kiểm tra tính hợp lệ trước khi ghi lần đầu. Giá trị rỗng, bằng 0, âm hoặc không phải số sẽ không làm thay đổi gì và báo lỗi.
- Nếu Illustrator từ chối một artboard (artboard bị khóa, kích thước vượt ngoài phạm vi cho phép), các artboard đã thay đổi trong lượt đó sẽ được khôi phục lại và hiển thị lỗi; nếu việc khôi phục cũng thất bại, thông báo lỗi sẽ cho biết số lượng artboard không thể phục hồi. Illustrator quản lý giới hạn kích thước cho phép; panel không đặt thêm giới hạn riêng nào.
- Hình chữ nhật artboard được đọc lại sau khi thay đổi và so sánh với giá trị đã ghi, áp dụng cho cả **Áp dụng** và **Đổi hướng**. Độ lệch vượt quá 0,5 pt (0,18 mm) ở bất kỳ cạnh nào sẽ được tính là bị giới hạn (clamp): lượt chạy sẽ được hoàn tác và báo cáo kích thước thực tế mà tài liệu đang có. Dung sai này tồn tại do Illustrator lưu tọa độ với độ chính xác giới hạn.
- Panel gửi thông tin định danh tài liệu (tên và đường dẫn) cùng tên của từng artboard được tích chọn. Nếu tài liệu bị chuyển đổi, đổi tên, hoặc các artboard bị sắp xếp lại, đổi tên hoặc thay thế kể từ khi danh sách được tải, yêu cầu sẽ bị từ chối để tránh đổi nhầm kích thước các artboard khác.
- Illustrator có thể ghi nhận một bước Undo cho mỗi artboard, do đó việc hoàn tác thay đổi trên nhiều artboard sẽ cần nhiều lần Undo.
- Khối này bị ẩn trên tab Lưới (Grid), nơi kích thước artboard không áp dụng.
