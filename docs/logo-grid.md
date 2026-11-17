# Grid tab: logo construction grid

The Grid tab draws a construction grid over the selected vector artwork. It never changes the artwork itself; everything goes on a layer named `SCCTLM Grid` at the top of the document.

## Use

1. Select the logo: paths, compound paths and groups (groups are searched inside). Outline text first; text, placed images, clipping masks, hidden items (including everything inside a hidden group) and other items are skipped and counted in the status line.
2. Open the **Lưới** (Grid) tab, turn on the elements you want and press **Tạo lưới** (Generate).
3. Press **Tạo lưới** again after changing options: the previous grid layer is replaced, even if it was locked or hidden. **Xoá lưới** (Clear) removes it. If drawing fails, the previous grid stays and the partly drawn one is removed.

**Tạo tất cả** (Generate all) draws every element for that run without changing your toggles. When the anchor points plus the circles to draw exceed 2,000, the panel asks before running, because Illustrator stops responding while it draws. High circle complexity can produce many more circles than anchors.

Illustrator may record the drawing as many undo steps, so use **Xoá lưới** to remove a grid rather than Undo.

## Elements

| Element | What is drawn | Sublayer |
|---|---|---|
| Anchors | a square marker on every anchor point | Anchors |
| Handles | a line from each anchor to each direction point that is pulled out, plus a round marker at its end | Handles |
| Outlines | an unfilled copy of every path | Outlines |
| Gridlines | every straight segment extended across the artwork, plus horizontal and vertical lines through anchors whose handles are horizontal or vertical (the top, bottom and sides of curves) | Gridlines |
| Circles | circles that follow each curved segment | Circles |

Sublayers with nothing on them are removed. Each element has its own style (size, fill, stroke, stroke width, with **Không** (None) to turn fill or stroke off). Sizes and widths are in points. In CMYK documents the chosen colours are converted with the plain formula k = 1 − max(r, g, b).

## Options

- **Đường lưới, Gộp (Thấp to Cao)** (Gridlines, Merge, Low to High): how close two lines must be to count as one. At Low only identical lines merge; at High lines within 3 degrees and 2% of the logo size merge. Merged lines are drawn as their average. The default (50) merges the duplicate lines a square or a symmetric logo produces.
- **Đường lưới, Lề** (Gridlines, Margin): how far the lines run past the artwork, in points.
- **Vòng tròn, Tối giản to Phức tạp** (Circles, Minimal to Complex): how closely the circles must follow the curve. Each curve is first split where it changes bend direction (an S-curve becomes two pieces); a piece gets one circle through its start, middle and end and is halved again while the curve strays too far from that circle. Minimal allows 5% of the logo size, Complex 0.05%. Nearly straight pieces get no circle.
- **Vòng tròn, Mỗi đường cong** (Circles, Per curve): **Tất cả** (All) circles, the **Đầu tiên** (First) N from the start of each curve, or the N covering the **Dài nhất** (Longest) parts of it.

Settings are saved in `grid-settings.json` next to `presets.json` in the per-user data folder, so updates keep them.

## Code

- `src/app/jsx/grid-geometry.jsx`: maths only (segments, inflections, circle fitting, line clipping and merging), unit tested in `tests/grid-geometry.test.js`.
- `src/app/jsx/grid-engine.jsx`: reads the selection and draws the layer; `gridInspect`, `gridGenerate`, `gridClear`. Tested against stand-in Illustrator objects in `tests/grid-engine.test.js`.
- `src/app/grid-panel.js`, `src/app/grid-settings.js`, `src/app/tabs.js`: tab UI, saved settings and tab switching.
- `tests/fixtures/make-grid-test-doc.jsx`: builds and selects a sample logo for a manual check in Illustrator.

This feature is an original implementation written from a description of the behaviour. It contains no code or artwork from other grid tools.

---

# Tab Lưới: lưới cấu trúc logo (logo construction grid)

Tab Lưới vẽ lưới cấu trúc lên trên đối tượng đồ họa vector được chọn. Nó không bao giờ thay đổi bản thân tác phẩm; mọi thứ đều được đưa vào một layer có tên `SCCTLM Grid` ở trên cùng của tài liệu.

## Cách sử dụng

1. Chọn logo: các path, compound path và group (các group sẽ được tìm kiếm bên trong). Cần outline văn bản trước; text, hình ảnh đặt vào (placed image), clipping mask, các mục bị ẩn (bao gồm mọi thứ bên trong group ẩn) và các đối tượng khác sẽ bị bỏ qua và được thống kê trong dòng trạng thái.
2. Mở tab **Lưới**, bật các thành phần bạn muốn và nhấn **Tạo lưới**.
3. Nhấn **Tạo lưới** lần nữa sau khi thay đổi tùy chọn: layer lưới trước đó sẽ được thay thế, ngay cả khi nó bị khóa hoặc ẩn. Nhấn **Xoá lưới** để xóa layer này. Nếu quá trình vẽ gặp lỗi, lưới trước đó vẫn được giữ nguyên và phần đang vẽ dở sẽ bị xóa bỏ.

**Tạo tất cả** sẽ vẽ tất cả các thành phần cho lượt chạy đó mà không làm thay đổi các nút bật/tắt bạn đã chọn. Khi tổng số điểm neo (anchor point) cộng với các đường tròn cần vẽ vượt quá 2.000, panel sẽ hỏi xác nhận trước khi chạy, vì Illustrator sẽ tạm dừng phản hồi trong khi vẽ. Độ phức tạp vòng tròn cao có thể tạo ra nhiều vòng tròn hơn rất nhiều so với số điểm neo.

Illustrator có thể ghi nhận quá trình vẽ thành nhiều bước Undo, vì vậy hãy sử dụng nút **Xoá lưới** để xóa lưới thay vì bấm Undo.

## Các thành phần

| Thành phần | Những gì được vẽ | Sublayer |
|---|---|---|
| Anchors | dấu điểm vuông trên mỗi điểm neo | Anchors |
| Handles | đường nối từ mỗi điểm neo đến từng điểm điều hướng được kéo ra, kèm theo một điểm tròn ở đầu | Handles |
| Outlines | một bản sao không fill của mọi path | Outlines |
| Gridlines | mọi đoạn thẳng được kéo dài xuyên qua tác phẩm, kèm theo các đường ngang và dọc đi qua các điểm neo có tay nắm điều hướng nằm ngang hoặc thẳng đứng (đỉnh, đáy và các cạnh của đường cong) | Gridlines |
| Circles | các đường tròn bám theo từng đoạn cong | Circles |

Các sublayer không chứa đối tượng nào sẽ bị xóa. Mỗi thành phần có kiểu dáng riêng (kích thước, fill, stroke, độ dày nét, với tùy chọn **Không** để tắt fill hoặc stroke). Kích thước và độ dày nét tính bằng đơn vị point. Trong tài liệu CMYK, các màu được chọn sẽ được chuyển đổi theo công thức đơn giản k = 1 − max(r, g, b).

## Tùy chọn

- **Đường lưới, Gộp (Thấp đến Cao)**: khoảng cách hai đường thẳng cần đạt để được gộp thành một. Ở mức Thấp chỉ gộp các đường thẳng giống hệt nhau; ở mức Cao, các đường thẳng trong phạm vi 3 độ và 2% kích thước logo sẽ được gộp lại. Các đường được gộp sẽ vẽ theo vị trí trung bình của chúng. Mức mặc định (50) giúp gộp các đường trùng lặp do hình vuông hoặc logo đối xứng tạo ra.
- **Đường lưới, Lề**: khoảng cách đường lưới chạy vượt ra ngoài phạm vi tác phẩm, tính bằng point.
- **Vòng tròn, Tối giản đến Phức tạp**: mức độ các vòng tròn phải bám sát đường cong. Mỗi đường cong trước tiên được chia nhỏ tại vị trí đổi hướng uốn (đường cong chữ S tách thành hai đoạn); một đoạn sẽ nhận một đường tròn đi qua điểm đầu, giữa và cuối, rồi tiếp tục chia đôi nếu đường cong lệch quá xa khỏi đường tròn đó. Tối giản cho phép sai số 5% kích thước logo, Phức tạp cho phép 0,05%. Các đoạn gần như thẳng sẽ không nhận đường tròn nào.
- **Vòng tròn, Mỗi đường cong**: **Tất cả** các vòng tròn, N vòng tròn **Đầu tiên** từ điểm bắt đầu của mỗi đường cong, hoặc N vòng tròn bao phủ các phần **Dài nhất** của nó.

Các cài đặt được lưu trong `grid-settings.json` bên cạnh `presets.json` trong thư mục dữ liệu người dùng, vì vậy các bản cập nhật vẫn sẽ giữ lại chúng.

## Mã nguồn

- `src/app/jsx/grid-geometry.jsx`: chỉ xử lý toán học (các đoạn, điểm uốn, khớp đường tròn, cắt và gộp đường thẳng), được unit test trong `tests/grid-geometry.test.js`.
- `src/app/jsx/grid-engine.jsx`: đọc vùng chọn và vẽ layer; các hàm `gridInspect`, `gridGenerate`, `gridClear`. Được kiểm thử với các đối tượng giả lập Illustrator trong `tests/grid-engine.test.js`.
- `src/app/grid-panel.js`, `src/app/grid-settings.js`, `src/app/tabs.js`: giao diện tab, lưu trữ cài đặt và chuyển tab.
- `tests/fixtures/make-grid-test-doc.jsx`: tạo và chọn một logo mẫu để kiểm tra thủ công trong Illustrator.

Tính năng này là bản hiện thực độc lập được viết dựa trên mô tả hành vi. Nó không chứa mã nguồn hay đồ họa từ bất kỳ công cụ lưới nào khác.
