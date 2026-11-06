// Human-readable file sizes for the PDF size estimate.
(function (global) {
  'use strict';

  // 1 MB = 1024 * 1024 bytes, matching what Windows Explorer and Finder-style tools report for PDFs.
  function formatBytes(bytes) {
    var n = Number(bytes);
    if (!isFinite(n) || n < 0) return '-';
    var units = ['B', 'KB', 'MB', 'GB'];
    var i = 0;
    while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
    // Rounding can land on 1024 (for example 1023.96 KB); promote so the unit stays correct.
    if (i < units.length - 1 && Math.round(n * 10) / 10 >= 1024) { n /= 1024; i++; }
    return (i === 0 ? String(Math.round(n)) : (Math.round(n * 10) / 10).toFixed(1)) + ' ' + units[i];
  }

  var api = { formatBytes: formatBytes };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.PdfFormat = api;
}(typeof window !== 'undefined' ? window : globalThis));
