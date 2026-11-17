(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var each = function (nodes, fn) { Array.prototype.forEach.call(nodes, fn); };
  var cepApi = window.cep || (window.parent && window.parent.cep);
  var busy = false;
  var artboardSignature = '';
  var lastDocName = 'Chưa đặt tên';
  var artboardNames = [];
  var artboardCount = 0;

  function selectedArtboards() {
    var box = $('artboards');
    if (!box) return [];
    return Array.prototype.map.call(box.querySelectorAll('input:checked'), function (i) { return Number(i.value); });
  }

  // ---------- artboards ----------
  function renderArtboards(list, keep) {
    var box = $('artboards');
    if (!box) return;
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
  // Resolves with the response on a successful read (even when nothing changed) and null on failure,
  // so a caller can tell its own message from an error this refresh found.
  function refreshArtboards() {
    if (busy || document.hidden) return Promise.resolve();
    return Bridge.listArtboards().then(function (r) {
      var sig = JSON.stringify(r);
      if (sig === artboardSignature) return r;
      var prev = artboardSignature ? JSON.parse(artboardSignature) : null;
      var sameDoc = !!prev && prev.docName === r.docName && prev.docPath === r.docPath;
      artboardSignature = sig;
      lastDocName = r.ok ? r.docName : 'Chưa đặt tên';
      if ($('status')) $('status').textContent = r.ok ? '' : r.error;
      renderArtboards(r.artboards, sameDoc ? selectedArtboards() : null);
      artboardNames = r.artboards.map(function (a) { return a.name; });
      artboardCount = r.artboards.length;
      document.dispatchEvent(new CustomEvent('artboards-changed', {
        detail: { artboards: r.artboards, docName: r.docName, docPath: r.docPath, colorSpace: r.colorSpace }
      }));
      return r;
    }).catch(function (e) {
      if ($('status')) $('status').textContent = e.message;
      return null;
    });
  }

  function browse() {
    if (!cepApi || !cepApi.fs) {
      if ($('status')) $('status').textContent = 'Không mở được hộp chọn thư mục.';
      return;
    }
    var res = cepApi.fs.showOpenDialogEx(false, true, 'Chọn thư mục xuất', ($('outdir') && $('outdir').value) || '', [], '');
    if (res && res.err === 0 && res.data && res.data.length && $('outdir')) $('outdir').value = res.data[0];
  }

  // ---------- wiring ----------
  function init() {
    if (!Bridge.available && $('status')) $('status').textContent = 'Không có kết nối CEP (hãy mở panel trong Illustrator).';
    Theme.watch();

    if ($('ab-all')) $('ab-all').onclick = function () { each($('artboards').querySelectorAll('input'), function (i) { i.checked = true; }); };
    if ($('ab-none')) $('ab-none').onclick = function () { each($('artboards').querySelectorAll('input'), function (i) { i.checked = false; }); };
    if ($('browse')) $('browse').onclick = browse;

    refreshArtboards();
    window.addEventListener('focus', refreshArtboards);
    setInterval(refreshArtboards, 2000);

    // Another module changed the document; re-read it and then show the message it asked to display.
    // A failed re-read left its own error in the status line, so nothing is overwritten then.
    document.addEventListener('refresh-artboards', function (e) {
      refreshArtboards().then(function (r) {
        if (r && e.detail && e.detail.message && $('status')) $('status').textContent = e.detail.message;
      });
    });
    if (Bridge.cs && window.signalReady) Bridge.loadEngine().then(window.signalReady, function () {});
  }

  init();
}());
