// Artboard size and orientation block. Reads the artboards the shared list reports, shows the size of
// the ticked ones and writes a new size (or swaps the sides) through the engine. Illustrator has no
// orientation property, so the label is only a comparison of the two sides.
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var list = [];
  var unit = 'mm';
  var busy = false;
  var docName = '';
  var docPath = '';

  function status(text) { $('status').textContent = text; }

  function selectedIndexes() {
    return Array.prototype.map.call($('artboards').querySelectorAll('input:checked'), function (i) {
      return Number(i.value);
    });
  }

  function sizeAt(index) {
    for (var i = 0; i < list.length; i++) if (list[i].index === index) return list[i];
    return null;
  }

  function dims(size) { return { width: size.widthPt, height: size.heightPt }; }

  function orientationLabel(size) {
    var orientation = artboardOrientation(size.widthPt, size.heightPt);
    if (orientation === 'landscape') return 'Ngang';
    if (orientation === 'portrait') return 'Dọc';
    return 'Vuông';
  }

  // Repaints the fields from the reported sizes; never overwrites a field the user is typing in.
  function render() {
    var indexes = selectedIndexes();
    var scope = indexes.length ? indexes : list.map(function (a) { return a.index; });
    var sizes = [];
    var complete = scope.length > 0;
    for (var i = 0; i < scope.length; i++) {
      var size = sizeAt(scope[i]);
      if (!size) complete = false;
      else sizes.push(size);
    }
    var uniform = complete && sizes.length > 0;
    for (var k = 1; k < sizes.length; k++) {
      if (!artboardSizesEqual(dims(sizes[0]), dims(sizes[k]))) uniform = false;
    }
    var mixed = complete && !uniform;

    var w = $('doc-w');
    var h = $('doc-h');
    var typing = document.activeElement === w || document.activeElement === h;
    if (!typing) {
      w.value = uniform ? artboardFormatSize(sizes[0].widthPt, unit) : '';
      h.value = uniform ? artboardFormatSize(sizes[0].heightPt, unit) : '';
    }
    w.placeholder = mixed ? 'Hỗn hợp' : '';
    h.placeholder = mixed ? 'Hỗn hợp' : '';
    $('doc-orient').textContent = !complete ? '-' : uniform ? orientationLabel(sizes[0]) : 'Hỗn hợp';

    syncButtons();
  }

  // Only the buttons change with the busy flag: repainting the fields here would throw away the
  // numbers the user just typed before the engine answers.
  function syncButtons() {
    var disabled = busy || !Bridge.available || list.length === 0;
    $('doc-apply').disabled = disabled;
    $('doc-swap').disabled = disabled;
    $('doc-apply').textContent = busy ? 'Đang đổi…' : 'Áp dụng';
  }

  function setBusy(on) {
    busy = on;
    syncButtons();
  }

  function run(job, verb) {
    var indexes = selectedIndexes();
    if (!indexes.length) { status('Hãy chọn ít nhất một artboard.'); return; }
    // Indexes are positional: send the document and the names the user saw so the engine can refuse
    // a list that no longer matches the open document.
    job.artboards = indexes;
    job.count = list.length;
    job.docName = docName;
    job.docPath = docPath;
    job.targets = indexes.map(function (index) {
      var row = sizeAt(index);
      return { index: index, name: row ? row.name : '' };
    });
    setBusy(true);
    Bridge.resizeArtboards(job).then(function (res) {
      if (!res.ok) { status(res.error || 'Không đổi được kích thước artboard.'); return; }
      // The panel re-reads the document, then shows this message after its own refresh cleared the line.
      document.dispatchEvent(new CustomEvent('refresh-artboards', {
        detail: { message: verb + indexes.length + ' artboard.' }
      }));
    }, function (e) {
      status(e.message);
    }).then(function () { setBusy(false); });
  }

  function apply() {
    var width = artboardParseSize($('doc-w').value);
    var height = artboardParseSize($('doc-h').value);
    if (width === null || height === null) {
      status('Hãy nhập chiều rộng và chiều cao lớn hơn 0.');
      return;
    }
    run({ widthPt: artboardToPt(width, unit), heightPt: artboardToPt(height, unit) }, 'Đã đổi kích thước ');
  }

  function swap() {
    run({ swap: true }, 'Đã đổi hướng ');
  }

  function init() {
    var sel = $('doc-unit');
    if (!sel) return;
    for (var i = 0; i < ARTBOARD_UNITS.length; i++) {
      var option = document.createElement('option');
      option.value = ARTBOARD_UNITS[i];
      option.textContent = ARTBOARD_UNITS[i];
      sel.appendChild(option);
    }
    sel.value = unit;
    sel.onchange = function () { unit = sel.value; render(); };
    $('doc-apply').onclick = apply;
    $('doc-swap').onclick = swap;
    document.addEventListener('artboards-changed', function (e) {
      list = (e.detail && e.detail.artboards) || [];
      docName = (e.detail && e.detail.docName) || '';
      docPath = (e.detail && e.detail.docPath) || '';
      render();
    });
    $('artboards').addEventListener('change', render);
    // "Tất cả" / "Bỏ chọn" set checked from script, which fires no change event.
    $('ab-all').addEventListener('click', render);
    $('ab-none').addEventListener('click', render);
    render();
  }

  init();
}());
