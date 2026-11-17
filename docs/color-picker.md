# Colour picker window: CMYK gamut warning

Illustrator's own Color Picker only shows a small warning triangle when a colour cannot be printed. This window shows the whole printable area: every colour in the field that falls outside the CMYK gamut is painted grey, and the grey area updates while you drag.

## Use

1. Select what you want to colour (paths, compound paths, text, groups) and press **Màu CMYK** in the panel header. The window opens with the colour of the active fill or stroke (the one in front in Illustrator's toolbar), or with the document default when nothing is selected. Pressing the button again while the window is open reloads the colour of the current selection.
2. Pick a colour:
   - Drag in the big square or on the vertical slider.
   - Choose which channel runs along the slider with the radio buttons: **H S B**, **R G B** or **L a b**. In H mode (the default) saturation runs left to right and brightness bottom to top.
   - Type values in any field. Arrow keys step by 1, Shift+arrow by 10. You can also type a hex code after **#**.
   - Type **C M Y K** to set the exact ink values. Typed CMYK is applied exactly as typed.
3. When the colour is outside the gamut, a warning triangle appears under the swatches with a small swatch of the nearest printable colour. Click either one to switch to that colour.
4. **OK** (or Enter) paints the colour and closes the window. **Huỷ** (Cancel) or Esc closes without changes. The **Fill / Stroke** menu picks which one is painted. It starts on the one active in Illustrator.

What OK changes:
- Selected paths, compound paths and text frames, including those inside groups, get the colour on their fill or stroke. Locked items, placed images and other objects are skipped.
- With nothing selected, the colour becomes the document's default fill or stroke.
- CMYK documents receive a CMYK colour; RGB documents receive an RGB colour.

The footer has a **Cảnh báo gamut** (gamut warning) switch for the grey area. It also shows which profile the check uses:
- CMYK documents use the document's own profile, so the profile menu is locked.
- RGB documents use the profile you pick in that menu. The default is the installed profile whose name contains FOGRA39, for example *Coated FOGRA39 (ISO 12647-2:2004)*. The window remembers your choice, the mode and the switch in `color-picker.json` next to `presets.json`.

## How it works

- **CMYK numbers.** In CMYK documents the C, M, Y and K fields come from Illustrator itself (`app.convertSampleColor`), recomputed while you drag. They are the numbers OK applies, using the document profile and your Illustrator colour settings. In RGB documents they come from the ICC engine for the chosen profile, so they are a guide only, because OK applies RGB.
- **Gamut check.** A colour is out of gamut when converting it sRGB → CMYK → sRGB through the profile moves it by more than ΔE 3. The conversion uses Relative Colorimetric intent with black point compensation, Illustrator's default. On 60 test colours this check gave the same answer as Illustrator for every colour. The engine is [jsColorEngine](https://github.com/glennwilton/jsColorEngine) (MPL-2.0), bundled unmodified in `src/app/lib/jscolorengine/` with its licence.
- **Speed.** When a profile loads, the window builds a 49 × 49 × 49 table of the round-trip difference (about 0.2 s). The grey area is read from that table with interpolation. Inside Illustrator 2022 (Chromium 88) a full 256 × 256 field with the mask takes 8–20 ms depending on the mode. While you drag, the field is drawn at half resolution (1–3 ms) and scaled up, so dragging keeps 60 fps. The full-resolution field is redrawn when you let go. The table agrees with the exact check on about 99.75% of colours. The rare disagreements are only on the border of the grey area.
- **Profiles.** The window reads every `.icc` / `.icm` file in these folders and matches each one by the name stored inside the file, not by its file name. Folders that do not exist are skipped:
  - Windows: `Common Files\Adobe\Color\Profiles` (and its `Recommended` folder) under `Program Files (x86)` and `Program Files`, `%APPDATA%\Adobe\Color\Profiles`, and `C:\Windows\System32\spool\drivers\color`.
  - macOS: `/Library/Application Support/Adobe/Color/Profiles` (and `Recommended`), `/Library/ColorSync/Profiles`, and the same two folders under `~/Library`.
  - Any `.icc` / `.icm` file placed in `src/app/profiles/` ships with the extension. Installed profiles win when both have the same name. The repository does not include one, because Adobe's profiles are not ours to redistribute; add a profile there only if its licence allows redistribution.

  When the window cannot check gamut it says why: no CMYK profile is installed, the CMYK document has no profile, or the document's profile is not installed. Picking and applying colours still works.
- **Lab** values are D50, computed from sRGB, and match Illustrator within about 0.6.

Code: `src/app/picker.*` (window), `src/app/color-math.js`, `color-gamut.js`, `color-field.js` (pure, tested in `tests/color-picker-core.test.js`), `src/app/jsx/color-engine.jsx` (Illustrator side, tested in `tests/color-engine.test.js`).

## Limits

- The window is a second CEP extension (`vn.scctlm.vector.picker`), so it needs the manifest from this version. Existing installs must run the installer once, because the auto-updater refuses this version on an older install. See [release-process.md](release-process.md).
- Spot colours are read as their tinted process equivalent. OK always applies a process colour, never a spot or global swatch.
- Gradients, patterns and "Only Web Colors" are not supported.

---

# Cửa sổ chọn màu: Cảnh báo dải màu (gamut) CMYK

Hộp thoại Color Picker mặc định của Illustrator chỉ hiển thị một biểu tượng tam giác cảnh báo nhỏ khi màu không in được. Cửa sổ này hiển thị toàn bộ vùng in được: mọi màu trong trường màu nằm ngoài gamut CMYK đều được phủ xám, và vùng màu xám sẽ cập nhật ngay khi bạn rê chuột.

## Cách sử dụng

1. Chọn đối tượng bạn muốn tô màu (path, compound path, text, group) và nhấn **Màu CMYK** trên thanh tiêu đề panel. Cửa sổ mở ra với màu của fill hoặc stroke đang kích hoạt (màu nằm phía trước trong thanh công cụ của Illustrator), hoặc với màu mặc định của tài liệu khi không có gì được chọn. Nhấn lại nút này khi cửa sổ đang mở sẽ tải lại màu của vùng chọn hiện tại.
2. Chọn màu:
   - Rê chuột trong ô vuông lớn hoặc trên thanh trượt dọc.
   - Chọn kênh màu chạy dọc thanh trượt bằng các nút radio: **H S B**, **R G B** hoặc **L a b**. Ở chế độ H (mặc định), độ bão hòa (saturation) chạy từ trái sang phải và độ sáng (brightness) chạy từ dưới lên trên.
   - Nhập giá trị vào bất kỳ trường nào. Các phím mũi tên tăng giảm 1 đơn vị, Shift+mũi tên tăng giảm 10 đơn vị. Bạn cũng có thể nhập mã hex sau ký tự **#**.
   - Nhập **C M Y K** để thiết lập thông số mực in chính xác. Giá trị CMYK nhập vào sẽ được áp dụng chính xác như đã nhập.
3. Khi màu nằm ngoài gamut, một hình tam giác cảnh báo sẽ xuất hiện dưới ô mẫu màu kèm một ô màu nhỏ của màu in được gần nhất. Nhấp vào một trong hai để chuyển sang màu đó.
4. Nhấn **OK** (hoặc Enter) để tô màu và đóng cửa sổ. Nhấn **Huỷ** (Cancel hoặc phím Esc) để đóng mà không thay đổi. Menu **Fill / Stroke** chọn xem thuộc tính nào sẽ được tô. Nó bắt đầu với thuộc tính đang kích hoạt trong Illustrator.

Những gì OK sẽ thay đổi:
- Các path, compound path và khung văn bản (text frame) được chọn, bao gồm cả những đối tượng nằm trong group, sẽ nhận màu cho fill hoặc stroke của chúng. Các mục bị khóa, ảnh đặt vào (placed image) và các đối tượng khác sẽ được bỏ qua.
- Khi không có gì được chọn, màu sẽ trở thành fill hoặc stroke mặc định của tài liệu.
- Tài liệu CMYK nhận màu CMYK; tài liệu RGB nhận màu RGB.

Phần chân trang có công tắc **Cảnh báo gamut** cho vùng màu xám. Nó cũng hiển thị profile mà việc kiểm tra đang sử dụng:
- Tài liệu CMYK sử dụng profile riêng của tài liệu, do đó menu profile bị khóa.
- Tài liệu RGB sử dụng profile bạn chọn trong menu đó. Mặc định là profile đã cài đặt có tên chứa FOGRA39, ví dụ *Coated FOGRA39 (ISO 12647-2:2004)*. Cửa sổ ghi nhớ lựa chọn của bạn, chế độ và trạng thái công tắc trong file `color-picker.json` bên cạnh `presets.json`.

## Cơ chế hoạt động

- **Thông số CMYK.** Trong tài liệu CMYK, các trường C, M, Y và K lấy từ chính Illustrator (`app.convertSampleColor`), được tính toán lại ngay khi bạn rê chuột. Đó là các thông số mà nút OK áp dụng, sử dụng profile tài liệu và cài đặt màu trong Illustrator của bạn. Trong tài liệu RGB, chúng lấy từ công cụ ICC cho profile đã chọn, vì vậy chúng chỉ mang tính tham khảo, do OK sẽ áp dụng giá trị RGB.
- **Kiểm tra Gamut.** Một màu được coi là ngoài gamut khi việc chuyển đổi nó sRGB → CMYK → sRGB qua profile làm lệch màu quá ΔE 3. Quá trình chuyển đổi sử dụng phương pháp Relative Colorimetric với tính năng bù điểm đen (black point compensation), chuẩn mặc định của Illustrator. Trên 60 màu kiểm thử, phép kiểm tra này cho kết quả giống hệt Illustrator đối với từng màu. Công cụ xử lý là [jsColorEngine](https://github.com/glennwilton/jsColorEngine) (MPL-2.0), được đóng gói nguyên bản trong `src/app/lib/jscolorengine/` cùng với giấy phép của nó.
- **Tốc độ.** Khi nạp profile, cửa sổ xây dựng bảng chênh lệch hai chiều 49 × 49 × 49 (mất khoảng 0,2 giây). Vùng xám được đọc từ bảng này bằng phép nội suy. Bên trong Illustrator 2022 (Chromium 88), toàn bộ trường 256 × 256 kèm mặt nạ mất 8–20 ms tùy thuộc vào chế độ. Khi bạn rê chuột, trường màu được vẽ ở độ phân giải bằng một nửa (1–3 ms) và phóng to lên, giúp việc rê chuột duy trì ở mức 60 fps. Trường màu đầy đủ độ phân giải sẽ được vẽ lại khi bạn thả chuột. Bảng dữ liệu khớp với phép kiểm tra chính xác trên khoảng 99,75% số màu. Những điểm khác biệt hiếm hoi chỉ nằm ở đường biên của vùng màu xám.
- **Profile.** Cửa sổ đọc tất cả các file `.icc` / `.icm` trong các thư mục sau và khớp từng file theo tên lưu bên trong file chứ không theo tên file. Các thư mục không tồn tại sẽ được bỏ qua:
  - Windows: `Common Files\Adobe\Color\Profiles` (và thư mục `Recommended` của nó) trong `Program Files (x86)` và `Program Files`, `%APPDATA%\Adobe\Color\Profiles`, và `C:\Windows\System32\spool\drivers\color`.
  - macOS: `/Library/Application Support/Adobe/Color/Profiles` (và `Recommended`), `/Library/ColorSync/Profiles`, và hai thư mục tương tự trong `~/Library`.
  - Bất kỳ file `.icc` / `.icm` nào được đặt trong `src/app/profiles/` sẽ được đóng gói cùng tiện ích mở rộng. Profile đã cài đặt trên máy sẽ được ưu tiên khi cả hai có cùng tên. Kho lưu trữ không kèm sẵn profile nào vì profile của Adobe không thuộc quyền phân phối lại của chúng ta; chỉ thêm profile vào đó nếu giấy phép cho phép phân phối lại.

  Khi cửa sổ không thể kiểm tra gamut, nó sẽ nêu rõ lý do: chưa cài đặt profile CMYK nào, tài liệu CMYK không có profile, hoặc profile của tài liệu chưa được cài đặt. Việc chọn và áp dụng màu vẫn hoạt động bình thường.
- Giá trị **Lab** theo chuẩn D50, tính toán từ sRGB, và khớp với Illustrator trong khoảng chênh lệch 0,6.

Mã nguồn: `src/app/picker.*` (cửa sổ), `src/app/color-math.js`, `color-gamut.js`, `color-field.js` (thuần JS, được kiểm thử trong `tests/color-picker-core.test.js`), `src/app/jsx/color-engine.jsx` (phía Illustrator, được kiểm thử trong `tests/color-engine.test.js`).

## Giới hạn

- Cửa sổ là một CEP extension thứ hai (`vn.scctlm.vector.picker`), do đó nó cần manifest từ phiên bản này. Bản cài đặt hiện có phải chạy trình cài đặt một lần, vì trình tự động cập nhật sẽ từ chối phiên bản này trên bản cài đặt cũ hơn. Xem [release-process.md](release-process.md).
- Màu Spot (màu pha) được đọc dưới dạng tương đương màu process có sắc thái. Nút OK luôn áp dụng màu process, không bao giờ áp dụng màu spot hay swatch toàn cục (global).
- Gradient, pattern và tùy chọn "Only Web Colors" chưa được hỗ trợ.
