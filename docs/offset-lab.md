# Offset Lab

The **Offset Lab** section inside the **Daily** tab provides an interactive tool for creating offset paths (sticker borders, outlines, insets, contours) around selected artwork in Adobe Illustrator.

It allows adjusting the offset width, join style (round, miter, bevel), miter limit, and color with real-time SVG preview feedback before applying the effect to the active Illustrator selection.

## Features & Controls

1. **Live Vector Preview**:
   - Displays real-time visual feedback of the offset path around a vector glyph.
   - Dynamically updates stroke width, join style (`round`, `miter`, `bevel`), positive/negative offsets (inset vs outset), and color as you adjust controls.

2. **Độ rộng (Offset Width)**:
   - Slider ranging from `-50px` to `+100px` (default `20px`).
   - Direct numerical input field allowing exact decimal or negative values (e.g., `-5`, `2.5`, `35`).
   - Supports both outsets (positive) for sticker borders and insets (negative) for concentric inner paths.

3. **Kiểu bo góc (Join Styles)**:
   - **Bo tròn (Round)**: Smooth rounded outer joins (Illustrator join type 0).
   - **Góc nhọn (Miter)**: Pointed sharp corners (Illustrator join type 2).
   - **Vát góc (Bevel)**: Chamfered flat corners (Illustrator join type 1).
   - Styled as a sleek segmented capsule toggle matching the extension's theme.

4. **Giới hạn góc nhọn (Miter Limit)**:
   - Sets the miter cutoff threshold (default `4`).

5. **Màu sắc & Hút màu (Color & Eyedropper)**:
   - **Bảng màu / Palette button**: Opens native color picker dialog.
   - **Mã màu HEX**: Displays and accepts custom hex color input (e.g., `#1FC8FF`).
   - **Hút màu (Eyedropper)**: Samples colors from the screen via the browser `EyeDropper` API, or queries the active Illustrator selection via the Bridge.

6. **Bảng màu chọn nhanh (Preset Swatches)**:
   - 8 curated swatches: Blue (`#4295D1`), Mint (`#5EC093`), Lime (`#8EC642`), Yellow (`#F2EC20`), Orange (`#FDB716`), Coral (`#F15A41`), Purple (`#9F58A3`), Indigo (`#7464AC`).

7. **Chế độ Offset (Execution Modes)**:
   - **Tạo viền (Sticker)**: Unites all selected objects into a unified silhouette, applies offset path, and places the continuous border behind the artwork.
   - **Offset Path chuẩn (Standard)**: Applies the offset path to each selected path/compound path individually, retaining individual geometries.

8. **Tùy chọn nâng cao (Options)**:
   - **Phía sau**: Places the new offset paths behind the original artwork.
   - **Giữ hình gốc**: Retains the original artwork (unchecked replaces the original artwork with the offset path).
   - **Đổi màu**: Applies the chosen color to the offset path.

9. **Robust ExtendScript Engine**:
   - Converts `TextFrame` objects to vector outlines.
   - Outlines live strokes so borders wrap visible outer bounds.
   - Utilizes dual `edge` menu commands to force internal cache refreshes before `expandStyle`, ensuring reliable expansion across all Adobe Illustrator versions.

---

# Offset Lab (Tiếng Việt)

Phần **Offset Lab** trong tab **Daily** cung cấp bộ công cụ trực quan và mạnh mẽ để tạo viền mở rộng (Offset Path), viền cắt bế sticker hoặc thụt lề bên trong (inset) cho các đối tượng đang chọn trong Adobe Illustrator.

Công cụ hỗ trợ điều chỉnh độ rộng viền, kiểu góc bo (bo tròn, góc nhọn, vát góc), giới hạn góc nhọn và màu sắc với bản xem trước vector SVG thời gian thực trước khi áp dụng vào tài liệu Illustrator.

## Các chức năng & Điều khiển

1. **Bản xem trước trực tiếp (Live Preview)**:
   - Mô phỏng đường viền thời gian thực xung quanh đối tượng vector mẫu.
   - Tự động cập nhật độ dày nét, kiểu bo (`round`, `miter`, `bevel`), offset dương (nở ra ngoài) hoặc offset âm (thụt vào trong) và màu sắc ngay khi thay đổi giá trị.

2. **Độ rộng (Offset Width)**:
   - Thanh trượt từ `-50px` đến `+100px` (mặc định `20px`).
   - Ô nhập số trực tiếp cho phép điền giá trị chính xác, số thập phân hoặc số âm (ví dụ: `-5`, `2.5`, `35`).

3. **Kiểu bo góc**:
   - **Bo tròn**: Các góc ngoài được bo cong mượt mà (Illustrator join type 0).
   - **Góc nhọn**: Giữ góc sắc nhọn (Illustrator join type 2).
   - **Vát góc**: Cắt vát phẳng tại các góc nhọn (Illustrator join type 1).
   - Thiết kế dạng capsule segmented toggle hiện đại đồng bộ giao diện.

4. **Giới hạn góc nhọn (Miter Limit)**:
   - Thiết lập ngưỡng ngắt miter (mặc định `4`).

5. **Màu sắc & Hút màu**:
   - **Nút bảng màu (Palette button)**: Mở hộp thoại chọn màu hệ thống.
   - **Mã màu HEX**: Nhập hoặc hiển thị mã màu HEX tùy chỉnh (ví dụ: `#1FC8FF`).
   - **Nút hút màu (Eyedropper)**: Hút màu trực tiếp từ màn hình qua API `EyeDropper`, hoặc lấy màu của đối tượng đang chọn trong Illustrator qua Bridge.

6. **Bảng màu chọn nhanh**:
   - 8 màu sắc được tối ưu sẵn: Xanh dương (`#4295D1`), Xanh bạc hà (`#5EC093`), Xanh chanh (`#8EC642`), Vàng (`#F2EC20`), Cam (`#FDB716`), Đỏ san hô (`#F15A41`), Tím hồng (`#9F58A3`), Chàm tím (`#7464AC`).

7. **Chế độ thực thi (Mode)**:
   - **Tạo viền (Sticker)**: Hợp nhất tất cả đối tượng đang chọn thành một khối silhouette duy nhất, tạo viền bao liền mạch phía sau (chuẩn viền sticker / bế viền).
   - **Offset Path chuẩn**: Áp dụng Offset Path độc lập trên từng Path/CompoundPath (chuẩn lệnh `Object > Path > Offset Path` gốc của Illustrator).

8. **Tùy chọn nâng cao**:
   - **Phía sau**: Đặt lớp viền mới tạo phía sau hình gốc.
   - **Giữ hình gốc**: Giữ nguyên đối tượng gốc (nếu bỏ chọn sẽ thay thế đối tượng cũ).
   - **Đổi màu**: Tô màu được chọn cho đường viền mới.

9. **Cơ chế ExtendScript an toàn & chuẩn xác**:
   - Chuyển đổi chữ (`TextFrame`) thành vector outlines.
   - Mở rộng nét viền (`Live Outline Stroke`) để viền ôm trọn nét vẽ ngoài cùng.
   - Tự động kích hoạt chuỗi lệnh làm mới `edge` trước khi thực hiện `expandStyle`, đảm bảo diện mạo luôn được mở rộng thành vector anchor point độc lập trên mọi phiên bản Illustrator.
