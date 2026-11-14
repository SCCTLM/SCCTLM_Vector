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
