# Logo Lab: logo construction grid

The **Logo Lab** card in the **Daily** tab draws a construction grid over the selected vector artwork. It never changes the artwork itself; everything goes on a layer named `SCCTLM Grid` at the top of the document.

## Use

1. Select the logo: paths, compound paths and groups (groups are searched inside). Outline text first; text, placed images, clipping masks, hidden items (including everything inside a hidden group) and other items are skipped and counted in the status line.
2. In Logo Lab, switch on the elements you want (anchors, handles, outlines, circles, gridlines), adjust marker style, sizes, stroke widths and colors, and press **Tạo lưới** (Generate) or **Tạo tất cả** (Generate All). The preview above the controls updates live. Press **Áp dụng kiểu** (Restyle) to update colors, stroke widths and marker sizes directly on the existing grid layer without re-running geometry math. The layer keeps its locked and hidden state; time grows with the number of items on the grid.
3. Press **Tạo lưới** again after changing options: the previous grid layer is replaced, even if it was locked or hidden. **Xoá lưới** (Clear) removes it. If drawing fails, the previous grid stays and the partly drawn one is removed.

Marker **Fill**, **Stroke** and stroke width (the × button turns one off) are shared by anchors and handles; the **Anchors** and **Handles** sliders set marker sizes; **Vòng tròn** and **Đường lưới** set the stroke width of circles and gridlines. Values are labelled px but applied as points, as in Offset Lab. When the anchor points plus the circles to draw exceed 2,000, the panel asks before running, because Illustrator stops responding while it draws. High circle complexity can produce many more circles than anchors.

Illustrator may record the drawing as many undo steps, so use **Xoá lưới** to remove a grid rather than Undo.

## Elements

| Element | What is drawn | Sublayer |
|---|---|---|
| Anchors | a square marker on every anchor point | Anchors |
| Handles | a line from each anchor to each direction point that is pulled out, plus a round marker at its end | Handles |
| Outlines | a styled copy of every path (default unfilled with stroke; fill and stroke can be configured or turned off) | Outlines |
| Gridlines | every straight segment extended across the artwork, plus horizontal and vertical lines through anchors whose handles are horizontal or vertical (the top, bottom and sides of curves) | Gridlines |
| Circles | circles that follow each curved segment | Circles |

Sublayers with nothing on them are removed. Each element has its own style (size, fill, stroke, stroke width, with **Không** (None / ×) to turn fill or stroke off). Sizes and widths are in points. In CMYK documents the chosen colours are converted with the plain formula k = 1 − max(r, g, b).

## Options

- **Vòng tròn (Circles)**: stroke colour, stroke width, selection mode (**Tất cả** / All, **Dài nhất** / Longest N, or **Đầu tiên** / First N per curve), and **Độ chi tiết** (Complexity 0..100). Each curve is first split where it changes bend direction (an S-curve becomes two pieces); a piece gets one circle through its start, middle and end and is halved again while the curve strays too far from that circle (5% of logo size at 0, down to 0.05% at 100). Nearly straight pieces get no circle.
- **Đường lưới (Gridlines)**: stroke colour, stroke width, merge sensitivity (**Tách (0)** / Low, **Chuẩn (50)** / Standard, **Gộp (100)** / High), scope (**Theo logo + lề** / Selection bounds + margin, or **Toàn Artboard** / Active artboard + margin), and margin in points. At 0 only identical lines merge; at 100 lines within 3 degrees and 2% of the logo size merge.
- **Đường viền (Outlines)**: stroke colour (× turns stroke off), stroke width, and fill colour (× turns fill off).

Settings are saved in `grid-settings.json` next to `presets.json` in the per-user data folder, so updates keep them.

## Code

- `src/app/jsx/grid-geometry.jsx`: maths only (segments, inflections, circle fitting, line clipping and merging), unit tested in `tests/grid-geometry.test.js`.
- `src/app/jsx/grid-engine.jsx`: reads the selection, draws and restyles the layer; `gridInspect`, `gridGenerate`, `gridRestyle`, `gridClear`. Tested against stand-in Illustrator objects in `tests/grid-engine.test.js`.
- `src/app/logo-lab-panel.js`, `src/app/grid-settings.js`: Logo Lab card, live SVG preview and saved settings. Exposes full styling, in-place restyling, outlines, circle modes, complexity, and gridline sensitivity/scope controls.
- `tests/fixtures/make-grid-test-doc.jsx`, `tests/fixtures/bench-grid.jsx`: manual sample logo builder and engine benchmark script for Illustrator.

This feature is an original implementation written from a description of the behaviour. It contains no code or artwork from other grid tools.

---

# Logo Lab: lưới cấu trúc logo (logo construction grid)

Card **Logo Lab** trong tab **Daily** vẽ lưới cấu trúc lên trên đối tượng đồ họa vector được chọn. Nó không bao giờ thay đổi bản thân tác phẩm; mọi thứ đều được đưa vào một layer có tên `SCCTLM Grid` ở trên cùng của tài liệu.

## Cách sử dụng

1. Chọn logo: các path, compound path và group (các group sẽ được tìm kiếm bên trong). Cần outline văn bản trước; text, hình ảnh đặt vào (placed image), clipping mask, các mục bị ẩn (bao gồm mọi thứ bên trong group ẩn) và các đối tượng khác sẽ bị bỏ qua và được thống kê trong dòng trạng thái.
2. Trong Logo Lab, bật các thành phần muốn vẽ (điểm neo, tay nắm, đường viền, vòng tròn, đường lưới), chỉnh kiểu dáng, kích thước, màu sắc rồi nhấn **Tạo lưới** hoặc **Tạo tất cả**. Bản xem trước cập nhật trực tiếp. Nhấn **Áp dụng kiểu** để cập nhật nhanh màu sắc và kích thước trực tiếp lên layer lưới đang có mà không cần tính toán lại hình học.
3. Nhấn **Tạo lưới** lần nữa sau khi thay đổi tùy chọn: layer lưới trước đó sẽ được thay thế, ngay cả khi nó bị khóa hoặc ẩn. Nhấn **Xoá lưới** để xóa layer này. Nếu quá trình vẽ gặp lỗi, lưới trước đó vẫn được giữ nguyên và phần đang vẽ dở sẽ bị xóa bỏ.

**Fill**, **Stroke** và độ dày nét của điểm neo và tay nắm dùng chung (nút × để tắt); thanh trượt **Anchors** và **Handles** chỉnh kích thước; **Vòng tròn** và **Đường lưới** chỉnh độ dày nét. Giá trị ghi px nhưng áp dụng theo point, giống Offset Lab. Khi tổng số điểm neo (anchor point) cộng với các đường tròn cần vẽ vượt quá 2.000, panel sẽ hỏi xác nhận trước khi chạy, vì Illustrator sẽ tạm dừng phản hồi trong khi vẽ. Độ phức tạp vòng tròn cao có thể tạo ra nhiều vòng tròn hơn rất nhiều so với số điểm neo.

Illustrator có thể ghi nhận quá trình vẽ thành nhiều bước Undo, vì vậy hãy sử dụng nút **Xoá lưới** để xóa lưới thay vì bấm Undo.

## Các thành phần

| Thành phần | Những gì được vẽ | Sublayer |
|---|---|---|
| Anchors | dấu điểm vuông trên mỗi điểm neo | Anchors |
| Handles | đường nối từ mỗi điểm neo đến từng điểm điều hướng được kéo ra, kèm theo một điểm tròn ở đầu | Handles |
| Outlines | bản sao được định kiểu của mọi path (mặc định không tô, chỉ vẽ nét; có thể tùy chỉnh hoặc tắt cả tô lẫn nét) | Outlines |
| Gridlines | mọi đoạn thẳng được kéo dài xuyên qua tác phẩm, kèm theo các đường ngang và dọc đi qua các điểm neo có tay nắm điều hướng nằm ngang hoặc thẳng đứng (đỉnh, đáy và các cạnh của đường cong) | Gridlines |
| Circles | các đường tròn bám theo từng đoạn cong | Circles |

Các sublayer không chứa đối tượng nào sẽ bị xóa. Mỗi thành phần có kiểu dáng riêng (kích thước, fill, stroke, độ dày nét, với nút **×** để tắt fill hoặc stroke). Kích thước và độ dày nét tính bằng đơn vị point. Trong tài liệu CMYK, các màu được chọn sẽ được chuyển đổi theo công thức đơn giản k = 1 − max(r, g, b).

## Tùy chọn

- **Vòng tròn**: màu nét, độ dày nét, chế độ chọn (**Tất cả**, N vòng **Dài nhất**, hoặc N vòng **Đầu tiên** trên mỗi đoạn cong) và **Độ chi tiết** (0..100). Mỗi đường cong trước tiên được chia nhỏ tại vị trí đổi hướng uốn (đường cong chữ S tách thành hai đoạn); một đoạn sẽ nhận một đường tròn đi qua điểm đầu, giữa và cuối, rồi tiếp tục chia đôi nếu đường cong lệch quá xa khỏi đường tròn đó (sai số 5% kích thước logo ở mức 0, giảm xuống 0,05% ở mức 100). Các đoạn gần như thẳng sẽ không nhận đường tròn nào.
- **Đường lưới**: màu nét, độ dày nét, độ nhạy gộp (**Tách (0)**, **Chuẩn (50)**, **Gộp (100)**), phạm vi dóng (**Theo logo + lề** hoặc **Toàn Artboard**) và khoảng cách lề (pt). Ở mức 0 chỉ gộp các đường trùng nhau; ở mức 100 gộp các đường trong phạm vi 3 độ và 2% kích thước logo.
- **Đường viền (Outlines)**: màu nét (nút × để tắt nét), độ dày nét và màu tô (nút × để tắt tô).

Các cài đặt được lưu trong `grid-settings.json` bên cạnh `presets.json` trong thư mục dữ liệu người dùng, vì vậy các bản cập nhật vẫn sẽ giữ lại chúng.

## Mã nguồn

- `src/app/jsx/grid-geometry.jsx`: chỉ xử lý toán học (các đoạn, điểm uốn, khớp đường tròn, cắt và gộp đường thẳng), được unit test trong `tests/grid-geometry.test.js`.
- `src/app/jsx/grid-engine.jsx`: đọc vùng chọn, vẽ và cập nhật kiểu dáng layer; các hàm `gridInspect`, `gridGenerate`, `gridRestyle`, `gridClear`. Được kiểm thử với các đối tượng giả lập Illustrator trong `tests/grid-engine.test.js`.
- `src/app/logo-lab-panel.js`, `src/app/grid-settings.js`: card Logo Lab, bản xem trước SVG trực tiếp và lưu cài đặt. Cung cấp đầy đủ tùy chọn màu sắc, cập nhật kiểu dáng trực tiếp, đường viền (outlines), chế độ lọc vòng tròn và độ nhạy/phạm vi đường dóng.
- `tests/fixtures/make-grid-test-doc.jsx`, `tests/fixtures/bench-grid.jsx`: tạo logo mẫu để kiểm tra thủ công và đo hiệu năng engine trong Illustrator.

Tính năng này là bản hiện thực độc lập được viết dựa trên mô tả hành vi. Nó không chứa mã nguồn hay đồ họa từ bất kỳ công cụ lưới nào khác.
