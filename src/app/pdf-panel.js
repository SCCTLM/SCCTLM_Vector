// PDF tab: mode, layout, predicted size and export. Shares the artboard list, output folder and status
// line with the Images tab through the DOM; panel.js fires "artboards-changed" when the list is rebuilt.
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var each = function (nodes, fn) { Array.prototype.forEach.call(nodes, fn); };

  var state = { tab: 'images', mode: 'print', quality: 'high', layout: 'single' };
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
    $('pdf-export').disabled = busy;
    $('pdf-recalc').disabled = busy;
    $('pdf-export').textContent = exporting ? 'Exporting…' : 'Export PDF';
  }
  function setExporting(on) {
    exporting = on;
    syncButtons();
  }
  function setEstimating(on) {
    estimating = on;
    syncButtons();
  }

  function showSize(mode, result) {
    var el = $('pdf-size-' + mode);
    if (!result) { el.textContent = '-'; el.title = ''; el.classList.remove('fail'); return; }
    el.classList.toggle('fail', !result.ok);
    el.textContent = result.ok ? (result.approx ? '≈ ' : '') + PdfFormat.formatBytes(result.bytes) : 'n/a';
    el.title = result.ok ? '' : result.error;
  }

  // Both modes are measured in one engine call (one temporary copy); stale results are dropped.
  function recalc() {
    clearTimeout(timer);
    var id = ++seq;
    var note = $('pdf-estimate-note');
    if (state.tab !== 'pdf' || exporting || estimating) return;
    showSize('print', null);
    showSize('review', null);
    if (!Bridge.available || !selectedArtboards().length) {
      note.textContent = Bridge.available ? 'Select at least one artboard.' : '';
      return;
    }
    note.textContent = 'Calculating… Illustrator may pause until this finishes.';
    setEstimating(true);
    Bridge.estimatePdf({ artboards: selectedArtboards(), quality: state.quality, modes: ['print', 'review'] }).then(function (r) {
      if (id !== seq) return;
      if (!r.ok) {
        showSize('print', r);
        showSize('review', r);
        note.textContent = r.error;
        return;
      }
      showSize('print', { ok: true, bytes: r.sizes.print, approx: r.approx });
      showSize('review', { ok: true, bytes: r.sizes.review, approx: r.approx });
      note.textContent = r.approx ? 'Approximate: estimated from one representative artboard.' : 'Measured from a trial export.';
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
    showSize('print', null);
    showSize('review', null);
    $('pdf-estimate-note').textContent = 'Selection or quality changed. Press Calculate size to see the predicted file size.';
  }

  function runExport() {
    var outputDir = $('outdir').value;
    var artboards = selectedArtboards();
    if (exporting) return;
    if (!artboards.length) { status('Select at least one artboard.'); return; }
    if (!outputDir) { status('Choose an output folder.'); return; }
    clearTimeout(timer);
    seq++;
    setExporting(true);
    status('Exporting… Illustrator may not respond until it finishes.');
    $('results').textContent = '';
    var payload = { artboards: artboards, mode: state.mode, quality: state.quality, layout: state.layout, outputDir: outputDir };
    Bridge.runPdfJob(payload).then(function (r) {
      var files = r.files || [];
      var okCount = files.filter(function (f) { return f.ok; }).length;
      status(r.error ? r.error : okCount + ' of ' + files.length + ' files exported.');
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

  function init() {
    document.addEventListener('tab-changed', function (e) {
      var tab = e.detail;
      state.tab = tab;
      seq++;
      clearTimeout(timer);
      if (tab === 'pdf') $('pdf-estimate-note').textContent = 'Press Calculate size to see the predicted file size.';
    });
    $('pdf-modes').onclick = function (e) {
      var card = e.target.closest ? e.target.closest('.card') : null;
      if (!card) return;
      pick($('pdf-modes'), 'data-mode', 'mode', card.dataset.mode);
    };
    $('pdf-quality-row').onclick = function (e) {
      var q = e.target.dataset && e.target.dataset.quality;
      if (!q || q === state.quality) return;
      pick($('pdf-quality-row'), 'data-quality', 'quality', q);
      schedule();
    };
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
