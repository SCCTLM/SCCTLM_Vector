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
