// PDF tab: mode, compression, layout, fast predicted size and export. Shares the artboard list, output folder and
// status line with the Artboard tab through the DOM; panel.js fires "artboards-changed" when the list is rebuilt.
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var each = function (nodes, fn) { Array.prototype.forEach.call(nodes, fn); };

  var state = {
    tab: (document.body && document.body.dataset && document.body.dataset.tab) || 'daily',
    mode: 'print',
    compression: 20,
    layout: 'single'
  };
  var seq = 0;
  var exporting = false;
  var estimating = false;
  var cachedProfile = null;
  var cachedDocKey = '';

  function selectedArtboards() {
    var box = $('artboards');
    if (!box) return [];
    return Array.prototype.map.call(box.querySelectorAll('input:checked'), function (i) { return Number(i.value); });
  }
  function status(text) {
    var el = $('status');
    if (el) el.textContent = text;
  }

  function syncButtons() {
    var busy = exporting || estimating;
    if (window.PanelReload) PanelReload.setBusy('pdf', busy);
    var expBtn = $('pdf-export');
    var recalcBtn = $('pdf-recalc');
    if (expBtn) {
      expBtn.disabled = busy;
      expBtn.textContent = exporting ? 'Đang xuất…' : 'Xuất PDF';
    }
    if (recalcBtn) {
      recalcBtn.disabled = busy;
      recalcBtn.classList.toggle('is-loading', estimating);
    }
  }
  function setExporting(on) {
    exporting = on;
    syncButtons();
  }
  function setEstimating(on) {
    estimating = on;
    syncButtons();
  }

  function setSizeDisplay(kind, text, title) {
    var el = $('pdf-size');
    if (!el) return;
    el.classList.toggle('is-empty', kind === 'empty');
    el.classList.toggle('is-ready', kind === 'ready');
    el.classList.toggle('is-loading', kind === 'loading');
    el.classList.toggle('fail', kind === 'fail');
    el.textContent = text;
    el.title = title || '';
  }

  function setNote(text) {
    var note = $('pdf-estimate-note');
    if (note) note.textContent = text || '';
  }

  // Recomputes the displayed estimate instantaneously from the cached document profile (0 ExtendScript calls).
  function updateEstimateFromCache() {
    if (exporting || estimating) return;
    var selected = selectedArtboards();
    if (!selected.length) {
      setSizeDisplay('empty', '—', '');
      if (Bridge.available && cachedProfile) setNote('Hãy chọn ít nhất một artboard.');
      return;
    }
    if (!cachedProfile || !window.PdfEstimate) {
      setSizeDisplay('empty', '—', '');
      setNote('');
      return;
    }
    var bytes = PdfEstimate.estimatePdfBytes({
      docProfile: cachedProfile,
      mode: state.mode,
      compression: state.compression,
      layout: state.layout,
      selectedArtboards: selected,
      selectedArtboardCount: selected.length
    });
    setSizeDisplay('ready', '~ ' + PdfFormat.formatBytes(bytes), 'Ước tính nhanh từ tài liệu hiện tại');
    setNote('');
  }

  // Fetches a lightweight read-only document profile once (sub-second, zero disk writes) and caches it so
  // subsequent slider/mode/layout/artboard changes update instantaneously in JS.
  function recalc() {
    var id = ++seq;
    if (state.tab !== 'pdf' || exporting || estimating) return;
    var selected = selectedArtboards();
    if (!Bridge.available) {
      setSizeDisplay('empty', '—', '');
      setNote('');
      return;
    }
    if (!selected.length) {
      setSizeDisplay('empty', '—', '');
      setNote('Hãy chọn ít nhất một artboard.');
      return;
    }
    setSizeDisplay('loading', 'Đang tính…', '');
    setNote('');
    setEstimating(true);
    Bridge.profilePdfDoc().then(function (r) {
      if (id !== seq) return;
      if (!r || !r.ok || !r.profile) {
        cachedProfile = null;
        var err = (r && r.error) || 'Không đọc được thông tin tài liệu.';
        setSizeDisplay('fail', 'Không rõ', err);
        setNote(err);
        return;
      }
      cachedProfile = r.profile;
      setEstimating(false);
      updateEstimateFromCache();
    }).catch(function (e) {
      if (id !== seq) return;
      cachedProfile = null;
      var msg = (e && e.message) ? e.message : String(e);
      setSizeDisplay('fail', 'Không rõ', msg);
      setNote(msg);
    }).then(function () {
      if (estimating) setEstimating(false);
    });
  }

  function onArtboardsChanged(e) {
    var detail = (e && e.detail) || {};
    var count = detail.artboards ? detail.artboards.length : 0;
    var docKey = (detail.docName || '') + '|' + (detail.docPath || '') + '|' + count;
    if (docKey !== cachedDocKey) {
      cachedDocKey = docKey;
      cachedProfile = null;
      seq++;
      setSizeDisplay('empty', '—', '');
      setNote('');
      return;
    }
    updateEstimateFromCache();
  }

  function runExport() {
    var outputDir = $('outdir').value;
    var artboards = selectedArtboards();
    if (exporting) return;
    if (!artboards.length) { status('Hãy chọn ít nhất một artboard.'); return; }
    if (!outputDir) { status('Hãy chọn thư mục xuất.'); return; }
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
      var on = b.getAttribute(attr) === value;
      b.classList.toggle('on', on);
      b.setAttribute('aria-checked', on ? 'true' : 'false');
    });
  }

  // The slider is the source of truth; the Thấp / Trung bình / Cao chips are presets that light up when the
  // slider sits exactly on one of them.
  function setCompression(value) {
    state.compression = value;
    var slider = $('pdf-compression');
    if (slider) {
      slider.value = value;
      if (slider.style && slider.style.setProperty) slider.style.setProperty('--p', value + '%');
    }
    var valInput = $('pdf-compression-input');
    if (valInput && document.activeElement !== valInput) {
      valInput.value = value;
    }
    var valDisplay = $('pdf-compression-val');
    if (valDisplay) {
      valDisplay.textContent = value + '%';
    }
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
      if (tab === 'pdf') {
        if (cachedProfile) updateEstimateFromCache();
        else setNote('');
      }
    });
    $('pdf-modes').onclick = function (e) {
      var card = e.target.closest ? e.target.closest('.pdf-mode') : null;
      if (!card || card.dataset.mode === state.mode) return;
      pick($('pdf-modes'), 'data-mode', 'mode', card.dataset.mode);
      updateEstimateFromCache();
    };
    $('pdf-quality-row').onclick = function (e) {
      var c = e.target.dataset && e.target.dataset.compression;
      if (!c) return;
      setCompression(Number(c));
      updateEstimateFromCache();
    };
    $('pdf-compression').addEventListener('input', function () {
      setCompression(Number(this.value));
      updateEstimateFromCache();
    });
    var compInput = $('pdf-compression-input');
    if (compInput) {
      compInput.addEventListener('input', function () {
        var num = parseInt(this.value, 10);
        if (!isNaN(num)) {
          if (num < 0) num = 0;
          if (num > 100) num = 100;
          setCompression(num);
          updateEstimateFromCache();
        }
      });
      compInput.addEventListener('blur', function () {
        this.value = state.compression;
      });
    }
    setCompression(state.compression);
    $('pdf-layout').onclick = function (e) {
      var l = e.target.dataset && e.target.dataset.layout;
      if (!l || l === state.layout) return;
      pick($('pdf-layout'), 'data-layout', 'layout', l);
      updateEstimateFromCache();
    };
    $('pdf-recalc').onclick = recalc;
    $('pdf-export').onclick = runExport;
    $('artboards').addEventListener('change', updateEstimateFromCache);
    $('ab-all').addEventListener('click', updateEstimateFromCache);
    $('ab-none').addEventListener('click', updateEstimateFromCache);
    document.addEventListener('artboards-changed', onArtboardsChanged);
  }

  window.PdfPanel = {
    state: state,
    recalc: recalc,
    updateEstimateFromCache: updateEstimateFromCache,
    getCachedProfile: function () { return cachedProfile; }
  };

  init();
}());
