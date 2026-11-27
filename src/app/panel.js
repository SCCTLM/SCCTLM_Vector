(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var each = function (nodes, fn) { Array.prototype.forEach.call(nodes, fn); };
  var cepApi = window.cep || (window.parent && window.parent.cep);
  var inFlight = null;
  var lastHoverRefresh = 0;
  var HOVER_COOLDOWN_MS = 1500;
  var artboardSignature = '';
  var lastError = '';
  var lastDocName = 'Chưa đặt tên';
  var artboardNames = [];
  var artboardCount = 0;

  function needsArtboards() {
    var tab = document.body && document.body.dataset && document.body.dataset.tab;
    return !tab || tab === 'artboard' || tab === 'pdf';
  }

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

  // Event-driven refresh (tab switch, focus, visibility, panel hover, post-mutation):
  // never polls Illustrator's single-threaded main loop in the background while the user draws.
  // Resolves with the response on a successful read (even when nothing changed) and null on failure,
  // so a caller can tell its own message from an error this refresh found.
  function refreshArtboards(opts) {
    var force = opts && opts.force === true;
    if (document.hidden) return Promise.resolve();
    if (!force && !needsArtboards()) return Promise.resolve();
    if (inFlight) return inFlight;
    var req = Bridge.listArtboards().then(function (r) {
      if (r && r.ok && lastError) {
        lastError = '';
        if ($('status')) $('status').textContent = '';
      }
      var sig = JSON.stringify(r);
      if (sig === artboardSignature) return r;
      var prev = artboardSignature ? JSON.parse(artboardSignature) : null;
      var sameDoc = !!prev && prev.docName === r.docName && prev.docPath === r.docPath;
      artboardSignature = sig;
      lastDocName = r.ok ? r.docName : 'Chưa đặt tên';
      if (r.ok) {
        lastError = '';
        if ($('status')) $('status').textContent = '';
      } else {
        var errText = r.error || '';
        if (errText !== lastError) {
          lastError = errText;
          if ($('status')) $('status').textContent = errText;
        }
      }
      renderArtboards(r.artboards, sameDoc ? selectedArtboards() : null);
      artboardNames = r.artboards.map(function (a) { return a.name; });
      artboardCount = r.artboards.length;
      document.dispatchEvent(new CustomEvent('artboards-changed', {
        detail: { artboards: r.artboards, docName: r.docName, docPath: r.docPath, colorSpace: r.colorSpace }
      }));
      return r;
    }).catch(function (e) {
      var msg = (e && e.message) ? e.message : String(e);
      if (msg !== lastError) {
        lastError = msg;
        if ($('status')) $('status').textContent = msg;
      }
      return null;
    });
    var clear = function () { if (inFlight === req) inFlight = null; };
    req.then(clear, clear);
    inFlight = req;
    return req;
  }

  function refreshOnHover() {
    if (!needsArtboards() || document.hidden) return;
    var now = Date.now();
    if (now - lastHoverRefresh < HOVER_COOLDOWN_MS) return;
    lastHoverRefresh = now;
    refreshArtboards();
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

    if (needsArtboards()) refreshArtboards();
    window.addEventListener('focus', function () { refreshArtboards(); });
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) refreshArtboards();
    });
    document.addEventListener('tab-changed', function () {
      if (needsArtboards()) refreshArtboards();
    });
    document.addEventListener('mouseenter', refreshOnHover);

    // Another module changed the document; re-read it and then show the message it asked to display.
    // A failed re-read left its own error in the status line, so nothing is overwritten then.
    document.addEventListener('refresh-artboards', function (e) {
      refreshArtboards({ force: true }).then(function (r) {
        if (r && e.detail && e.detail.message && $('status')) $('status').textContent = e.detail.message;
      });
    });
    if (Bridge.cs && window.signalReady) Bridge.loadEngine().then(window.signalReady, function () {});
  }

  window.Panel = { refreshArtboards: refreshArtboards };

  init();
}());
