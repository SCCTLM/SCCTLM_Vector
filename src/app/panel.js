(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var each = function (nodes, fn) { Array.prototype.forEach.call(nodes, fn); };
  var cepApi = window.cep || (window.parent && window.parent.cep);
  var busy = false;
  var artboardSignature = '';
  var lastDocName = 'Chưa đặt tên';
  var previewSeq = 0;
  var artboardNames = [];
  var artboardCount = 0;
  var DEFAULT_TEMPLATE = '{doc}_{artboard}@{scale}x';

  // ---------- settings <-> UI ----------
  function checkedFormats() {
    return Array.prototype.map.call($('formats').querySelectorAll('input:checked'), function (i) { return i.value; });
  }
  function activeScales() {
    return Array.prototype.map.call($('scales').querySelectorAll('.chip.on'), function (b) { return Number(b.dataset.scale); });
  }
  function selectedArtboards() {
    return Array.prototype.map.call($('artboards').querySelectorAll('input:checked'), function (i) { return Number(i.value); });
  }
  function readSettings() {
    return { formats: checkedFormats(), scales: activeScales(), template: $('template').value, outputDir: $('outdir').value };
  }
  function applySettings(s) {
    each($('formats').querySelectorAll('input'), function (i) { i.checked = s.formats.indexOf(i.value) >= 0; });
    each($('scales').querySelectorAll('.chip'), function (b) {
      b.classList.toggle('on', s.scales.indexOf(Number(b.dataset.scale)) >= 0);
    });
    $('template').value = s.template;
    if (s.outputDir) $('outdir').value = s.outputDir;
    updateExample();
  }

  // ---------- live filename example (uses the engine's own naming code) ----------
  // Mirrors the engine: first selected artboard, first format and scale; raster formats with several
  // scales and no {scale} token get "@{scale}x" appended so files stay distinct.
  function updateExample() {
    var id = ++previewSeq;
    var fmt = checkedFormats()[0] || 'png';
    var scales = activeScales();
    var picked = selectedArtboards();
    var artboardIndex = Math.min(picked[0] || 0, Math.max(artboardNames.length - 1, 0));
    var ctx = {
      doc: lastDocName,
      index: artboardIndex + 1,
      scale: scales[0] || 1,
      format: fmt,
      date: new Date().toISOString().slice(0, 10).replace(/-/g, '')
    };
    Bridge.previewName($('template').value, ctx, artboardNames.length ? artboardNames : ['Artboard 1'],
      artboardIndex, fmt === 'png' || fmt === 'jpg', scales.length)
      .then(function (r) {
        if (id === previewSeq) $('example').textContent = r.name + '.' + fmt;
      }, function () {
        if (id === previewSeq) $('example').textContent = '-';
      });
  }

  // ---------- artboards ----------
  function renderArtboards(list, keep) {
    var box = $('artboards');
    box.textContent = '';
    list.forEach(function (a) {
      var label = document.createElement('label');
      label.dataset.name = a.name;
      var cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.value = a.index;
      cb.checked = keep ? (keep.indexOf(a.index) >= 0 || a.index >= artboardCount) : true;
      label.appendChild(cb);
      label.appendChild(document.createTextNode(' ' + (a.index + 1) + '. ' + a.name));
      box.appendChild(label);
    });
  }

  // Called on focus and every 2s: Illustrator exposes no reliable document-change event to CEP.
  function refreshArtboards() {
    if (busy || document.hidden) return Promise.resolve();
    return Bridge.listArtboards().then(function (r) {
      var sig = JSON.stringify(r);
      if (sig === artboardSignature) return;
      var prev = artboardSignature ? JSON.parse(artboardSignature) : null;
      var sameDoc = !!prev && prev.docName === r.docName && prev.docPath === r.docPath;
      artboardSignature = sig;
      lastDocName = r.ok ? r.docName : 'Chưa đặt tên';
      $('doc-name').textContent = r.ok ? '(' + r.docName + ')' : '';
      $('status').textContent = r.ok ? '' : r.error;
      renderArtboards(r.artboards, sameDoc ? selectedArtboards() : null);
      artboardNames = r.artboards.map(function (a) { return a.name; });
      artboardCount = r.artboards.length;
      updateExample();
      document.dispatchEvent(new Event('artboards-changed'));
    }).catch(function (e) { $('status').textContent = e.message; });
  }

  // ---------- presets ----------
  function renderPresets(selectedName) {
    var sel = $('preset-select');
    sel.textContent = '';
    var list = [];
    try { list = Presets.list(); } catch (e) { $('status').textContent = 'Không tải được preset: ' + e.message; }
    list.forEach(function (p) {
      var o = document.createElement('option');
      o.textContent = p.name;
      o.value = p.name;
      sel.appendChild(o);
    });
    if (selectedName) sel.value = selectedName;
    ['preset-apply', 'preset-rename', 'preset-delete'].forEach(function (id) { $(id).disabled = list.length === 0; });
  }
  function guarded(fn) {
    try { fn(); } catch (e) { $('status').textContent = e.message; }
  }
  // window.prompt is unsupported in CEP panels, so names are collected with an inline field.
  var pendingName = null;
  function askName(label, initial, onDone) {
    pendingName = onDone;
    $('name-label').textContent = label;
    $('name-input').value = initial || '';
    $('name-row').hidden = false;
    $('name-input').focus();
    $('name-input').select();
  }
  function closeNameRow(accept) {
    var cb = pendingName;
    var value = $('name-input').value.trim();
    pendingName = null;
    $('name-row').hidden = true;
    if (accept && value && cb) guarded(function () { cb(value); });
  }

  // ---------- export ----------
  function setBusy(on) {
    busy = on;
    $('export').disabled = on;
    $('export').textContent = on ? 'Đang xuất…' : 'Xuất';
  }
  function showResults(r) {
    var ul = $('results');
    ul.textContent = '';
    (r.files || []).forEach(function (f) {
      var li = document.createElement('li');
      li.textContent = (f.ok ? '✓ ' : '✗ ') + f.path + (f.ok ? '' : ' - ' + f.error);
      if (!f.ok) li.className = 'fail';
      ul.appendChild(li);
    });
  }
  function runExport() {
    var s = readSettings();
    var artboards = selectedArtboards();
    if (!artboards.length) { $('status').textContent = 'Hãy chọn ít nhất một artboard.'; return; }
    if (!s.formats.length) { $('status').textContent = 'Hãy chọn ít nhất một định dạng.'; return; }
    if (!s.scales.length) { $('status').textContent = 'Hãy chọn ít nhất một tỉ lệ.'; return; }
    if (!s.outputDir) { $('status').textContent = 'Hãy chọn thư mục xuất.'; return; }
    setBusy(true);
    $('status').textContent = 'Đang xuất… Illustrator có thể không phản hồi cho đến khi xong.';
    $('results').textContent = '';
    Bridge.runJob({ artboards: artboards, formats: s.formats, scales: s.scales, template: s.template, outputDir: s.outputDir })
      .then(function (r) {
        var files = r.files || [];
        var okCount = files.filter(function (f) { return f.ok; }).length;
        $('status').textContent = r.error ? r.error : 'Đã xuất ' + okCount + '/' + files.length + ' tệp.';
        showResults(r);
      })
      .catch(function (e) { $('status').textContent = e.message; })
      .then(function () { setBusy(false); });
  }

  function browse() {
    if (!cepApi || !cepApi.fs) { $('status').textContent = 'Không mở được hộp chọn thư mục.'; return; }
    var res = cepApi.fs.showOpenDialogEx(false, true, 'Chọn thư mục xuất', $('outdir').value || '', [], '');
    if (res && res.err === 0 && res.data && res.data.length) $('outdir').value = res.data[0];
  }

  // ---------- wiring ----------
  function init() {
    if (!Bridge.available) $('status').textContent = 'Không có kết nối CEP (hãy mở panel trong Illustrator).';
    Theme.watch();

    $('ab-all').onclick = function () { each($('artboards').querySelectorAll('input'), function (i) { i.checked = true; }); };
    $('ab-none').onclick = function () { each($('artboards').querySelectorAll('input'), function (i) { i.checked = false; }); };
    $('scales').onclick = function (e) {
      if (e.target.classList.contains('chip')) { e.target.classList.toggle('on'); updateExample(); }
    };
    $('formats').onchange = updateExample;
    $('artboards').onchange = updateExample;
    $('ab-all').addEventListener('click', updateExample);
    $('ab-none').addEventListener('click', updateExample);
    $('template').oninput = updateExample;
    $('tokens').onclick = function (e) {
      var token = e.target.dataset && e.target.dataset.token;
      if (!token) return;
      var input = $('template');
      var start = input.selectionStart;
      var end = input.selectionEnd;
      input.value = input.value.slice(0, start) + token + input.value.slice(end);
      input.focus();
      input.setSelectionRange(start + token.length, start + token.length);
      updateExample();
    };
    $('browse').onclick = browse;
    $('export').onclick = runExport;

    $('preset-apply').onclick = function () {
      guarded(function () {
        var s = Presets.get($('preset-select').value);
        if (s) applySettings(s);
      });
    };
    $('preset-save').onclick = function () {
      askName('Lưu preset với tên:', $('preset-select').value, function (name) {
        Presets.saveAs(name, readSettings());
        renderPresets(name);
      });
    };
    $('preset-rename').onclick = function () {
      var old = $('preset-select').value;
      askName('Đổi tên preset thành:', old, function (name) {
        if (name === old) return;
        Presets.rename(old, name);
        renderPresets(name);
      });
    };
    // Two-step delete (no confirm dialog): first click arms, second click within 3s deletes.
    var deleteArmed = null;
    function resetDelete() {
      clearTimeout(deleteArmed);
      deleteArmed = null;
      $('preset-delete').textContent = 'Xoá';
    }
    $('preset-delete').onclick = function () {
      var name = $('preset-select').value;
      if (!name) return;
      if (!deleteArmed) {
        $('preset-delete').textContent = 'Xác nhận?';
        deleteArmed = setTimeout(resetDelete, 3000);
        return;
      }
      resetDelete();
      guarded(function () { Presets.remove(name); renderPresets(); });
    };
    // Changing the selection disarms a pending delete so it can never hit a different preset.
    $('preset-select').onchange = resetDelete;
    $('name-ok').onclick = function () { closeNameRow(true); };
    $('name-cancel').onclick = function () { closeNameRow(false); };
    $('name-input').onkeydown = function (e) {
      if (e.key === 'Enter') closeNameRow(true);
      else if (e.key === 'Escape') closeNameRow(false);
    };

    renderPresets();
    applySettings(Presets.DEFAULT_SETTINGS);
    refreshArtboards();
    window.addEventListener('focus', refreshArtboards);
    setInterval(refreshArtboards, 2000);
    if (Bridge.cs && window.signalReady) Bridge.loadEngine().then(window.signalReady, function () {});
  }

  init();
}());
