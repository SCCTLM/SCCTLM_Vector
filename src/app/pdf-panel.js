// PDF tab: mode, compression, layout, predicted size and export. Shares the artboard list, output folder and status
// line with the Images tab through the DOM; panel.js fires "artboards-changed" when the list is rebuilt.
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var each = function (nodes, fn) { Array.prototype.forEach.call(nodes, fn); };

  var state = { tab: (document.body && document.body.dataset && document.body.dataset.tab) || 'daily', mode: 'print', compression: 20, layout: 'single' };
  var timer = null;
  var seq = 0;
  var exporting = false;

  function selectedArtboards() {
    return Array.prototype.map.call($('artboards').querySelectorAll('input:checked'), function (i) { return Number(i.value); });
  }
  function status(text) { $('status').textContent = text; }

  // Illustrator runs one script at a time and each PDF job can take tens of seconds, so while one runs the
  // buttons that would queue another are disabled.
  var estimating = false;
  function syncButtons() {
    var busy = exporting || estimating;
    if (window.PanelReload) PanelReload.setBusy('pdf', busy);
    $('pdf-export').disabled = busy;
    $('pdf-recalc').disabled = busy;
    $('pdf-export').textContent = exporting ? 'Đang xuất…' : 'Xuất PDF';
  }
  function setExporting(on) {
    exporting = on;
    syncButtons();
  }
  function setEstimating(on) {
    estimating = on;
    syncButtons();
  }

  function showSize(result) {
    var el = $('pdf-size');
    if (!result) { el.textContent = '-'; el.title = ''; el.classList.remove('fail'); return; }
    el.classList.toggle('fail', !result.ok);
    el.textContent = result.ok ? (result.approx ? '≈ ' : '') + PdfFormat.formatBytes(result.bytes) : 'không rõ';
    el.title = result.ok ? '' : result.error;
  }

  // Only the selected mode is measured (one temporary copy, one trial save); stale results are dropped.
  function recalc() {
    clearTimeout(timer);
    var id = ++seq;
    var note = $('pdf-estimate-note');
    if (state.tab !== 'pdf' || exporting || estimating) return;
    showSize(null);
    if (!Bridge.available || !selectedArtboards().length) {
      note.textContent = Bridge.available ? 'Hãy chọn ít nhất một artboard.' : '';
      return;
    }
    note.textContent = 'Đang tính… Illustrator có thể tạm dừng cho đến khi xong.';
    setEstimating(true);
    var mode = state.mode;
    Bridge.estimatePdf({ artboards: selectedArtboards(), compression: state.compression, modes: [mode] }).then(function (r) {
      if (id !== seq) return;
      if (!r.ok) {
        showSize(r);
        note.textContent = r.error;
        return;
      }
      showSize({ ok: true, bytes: r.sizes[mode], approx: r.approx });
      note.textContent = r.approx ? 'Gần đúng: ước tính từ một artboard đại diện.' : '';
    }).catch(function (e) {
      if (id === seq) note.textContent = e.message;
    }).then(function () { setEstimating(false); });
  }

  // A trial export opens a copy of the document and can freeze Illustrator for tens of seconds on a large file
  // (measured: about 47 s for a 349 MB .ai), so it never starts by itself: a change only marks the numbers stale.
  function schedule() {
    clearTimeout(timer);
    seq++;
    if (state.tab !== 'pdf' || exporting) return;
    showSize(null);
    $('pdf-estimate-note').textContent = 'Lựa chọn đã thay đổi. Nhấn Tính toán để cập nhật dung lượng.';
  }

  function runExport() {
    var outputDir = $('outdir').value;
    var artboards = selectedArtboards();
    if (exporting) return;
    if (!artboards.length) { status('Hãy chọn ít nhất một artboard.'); return; }
    if (!outputDir) { status('Hãy chọn thư mục xuất.'); return; }
    clearTimeout(timer);
    seq++;
    setExporting(true);
    status('Đang xuất… Illustrator có thể không phản hồi cho đến khi xong.');
    $('results').textContent = '';
    var payload = { artboards: artboards, mode: state.mode, compression: state.compression, layout: state.layout, outputDir: outputDir };
    Bridge.runPdfJob(payload).then(function (r) {
      var files = r.files || [];
      var okCount = files.filter(function (f) { return f.ok; }).length;
      status(r.error ? r.error : 'Đã xuất ' + okCount + '/' + files.length + ' tệp.');
      files.forEach(function (f) {
        var li = document.createElement('li');
        li.textContent = (f.ok ? '✓ ' : '✗ ') + f.path + (f.ok ? '' : ' - ' + f.error);
        if (!f.ok) li.className = 'fail';
        $('results').appendChild(li);
      });
    }).catch(function (e) { status(e.message); }).then(function () { setExporting(false); });
  }

  function pick(container, attr, key, value) {
    state[key] = value;
    each(container.querySelectorAll('[' + attr + ']'), function (b) {
      b.classList.toggle('on', b.getAttribute(attr) === value);
    });
  }

  // The slider is the source of truth; the Thấp / Trung bình / Cao chips are presets that light up when the
  // slider sits exactly on one of them.
  function setCompression(value) {
    state.compression = value;
    var slider = $('pdf-compression');
    slider.value = value;
    slider.style.setProperty('--p', value + '%');
    $('pdf-compression-val').textContent = value + '%';
    each($('pdf-quality-row').querySelectorAll('[data-compression]'), function (b) {
      var on = Number(b.getAttribute('data-compression')) === value;
      b.classList.toggle('on', on);
      b.setAttribute('aria-checked', on ? 'true' : 'false');
    });
  }

  function init() {
    document.addEventListener('tab-changed', function (e) {
      var tab = e.detail;
      state.tab = tab;
      seq++;
      clearTimeout(timer);
      if (tab === 'pdf') $('pdf-estimate-note').textContent = '';
    });
    $('pdf-modes').onclick = function (e) {
      var card = e.target.closest ? e.target.closest('.pdf-mode') : null;
      if (!card || card.dataset.mode === state.mode) return;
      pick($('pdf-modes'), 'data-mode', 'mode', card.dataset.mode);
      schedule();
    };
    $('pdf-quality-row').onclick = function (e) {
      var c = e.target.dataset && e.target.dataset.compression;
      if (!c) return;
      setCompression(Number(c));
      schedule();
    };
    $('pdf-compression').addEventListener('input', function () {
      setCompression(Number(this.value));
      schedule();
    });
    setCompression(state.compression);
    $('pdf-layout').onclick = function (e) {
      var l = e.target.dataset && e.target.dataset.layout;
      if (l) pick($('pdf-layout'), 'data-layout', 'layout', l);
    };
    $('pdf-recalc').onclick = recalc;
    $('pdf-export').onclick = runExport;
    $('artboards').addEventListener('change', schedule);
    $('ab-all').addEventListener('click', schedule);
    $('ab-none').addEventListener('click', schedule);
    document.addEventListener('artboards-changed', schedule);
  }

  init();
}());
