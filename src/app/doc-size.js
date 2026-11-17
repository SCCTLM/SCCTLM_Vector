// Artboard size and orientation block. Reads the artboards the shared list reports, shows the size of
// the ticked ones in a single pill input (e.g. "70cm x 30cm") and orientation icon buttons (Portrait,
// Landscape, Square). Writes a new size or orientation through the engine.
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var list = [];
  var unit = 'cm';
  var busy = false;
  var docName = '';
  var docPath = '';

  function status(text) {
    var el = $('status');
    if (el) el.textContent = text;
  }

  function selectedIndexes() {
    var box = $('artboards');
    if (!box) return [];
    return Array.prototype.map.call(box.querySelectorAll('input:checked'), function (i) {
      return Number(i.value);
    });
  }

  function sizeAt(index) {
    for (var i = 0; i < list.length; i++) if (list[i].index === index) return list[i];
    return null;
  }

  function dims(size) { return { width: size.widthPt, height: size.heightPt }; }

  function getScopeSizes() {
    var indexes = selectedIndexes();
    var scope = indexes.length ? indexes : list.map(function (a) { return a.index; });
    var sizes = [];
    var complete = scope.length > 0;
    for (var i = 0; i < scope.length; i++) {
      var size = sizeAt(scope[i]);
      if (!size) complete = false;
      else sizes.push(size);
    }
    return { scope: scope, sizes: sizes, complete: complete };
  }

  // Repaints the input and orientation icons from the reported sizes; never overwrites while user is typing.
  function render() {
    var data = getScopeSizes();
    var sizes = data.sizes;
    var complete = data.complete;
    var uniform = complete && sizes.length > 0;
    for (var k = 1; k < sizes.length; k++) {
      if (!artboardSizesEqual(dims(sizes[0]), dims(sizes[k]))) uniform = false;
    }
    var mixed = complete && !uniform;

    var input = $('doc-size-input');
    var btnPortrait = $('orient-portrait');
    var btnLandscape = $('orient-landscape');
    var btnSquare = $('orient-square');

    if (input) {
      var typing = document.activeElement === input;
      if (!typing) {
        if (uniform) {
          var wStr = artboardFormatSize(sizes[0].widthPt, unit);
          var hStr = artboardFormatSize(sizes[0].heightPt, unit);
          input.value = wStr + unit + ' x ' + hStr + unit;
        } else {
          input.value = '';
        }
      }
      input.placeholder = mixed ? 'Hỗn hợp' : (!complete ? '-' : '70cm x 30cm');
    }

    if (btnPortrait && btnLandscape && btnSquare) {
      if (uniform) {
        var orient = artboardOrientation(sizes[0].widthPt, sizes[0].heightPt);
        btnPortrait.classList.toggle('on', orient === 'portrait');
        btnLandscape.classList.toggle('on', orient === 'landscape');
        btnSquare.classList.toggle('on', orient === 'square');
      } else {
        btnPortrait.classList.remove('on');
        btnLandscape.classList.remove('on');
        btnSquare.classList.remove('on');
      }
    }

    syncButtons();
  }

  function syncButtons() {
    var disabled = busy || !Bridge.available || list.length === 0;
    ['orient-portrait', 'orient-landscape', 'orient-square'].forEach(function (id) {
      var btn = $(id);
      if (btn) btn.disabled = disabled;
    });
  }

  function setBusy(on) {
    busy = on;
    if (window.PanelReload) PanelReload.setBusy('docSize', on);
    syncButtons();
  }

  function run(job, verb) {
    var indexes = selectedIndexes();
    if (!indexes.length) indexes = list.map(function (a) { return a.index; });
    if (!indexes.length) { status('Hãy chọn ít nhất một artboard.'); return; }

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
      document.dispatchEvent(new CustomEvent('refresh-artboards', {
        detail: { message: verb + indexes.length + ' artboard.' }
      }));
    }, function (e) {
      status(e.message);
    }).then(function () { setBusy(false); });
  }

  function applyCustom() {
    var input = $('doc-size-input');
    if (!input) return;
    var val = input.value.trim();
    if (!val) return;
    var parsed = artboardParseCombinedSize(val, unit);
    if (!parsed) {
      status('Kích thước không hợp lệ. Ví dụ: 70cm x 30cm, 210mm x 297mm, 1920px x 1080px');
      return;
    }
    unit = parsed.unit;
    var wPt = artboardToPt(parsed.width, unit);
    var hPt = artboardToPt(parsed.height, unit);
    run({ widthPt: wPt, heightPt: hPt }, 'Đã đổi kích thước ');
  }

  function setOrientation(targetOrient) {
    var data = getScopeSizes();
    var sizes = data.sizes;
    if (!sizes.length) return;
    var s = sizes[0];
    var currentOrient = artboardOrientation(s.widthPt, s.heightPt);
    if (currentOrient === targetOrient) return;

    if (targetOrient === 'square') {
      var side = Math.max(s.widthPt, s.heightPt);
      run({ widthPt: side, heightPt: side }, 'Đã đổi khổ vuông ');
    } else if (targetOrient === 'portrait') {
      if (currentOrient === 'landscape') {
        run({ swap: true }, 'Đã đổi khổ dọc ');
      } else {
        var minSide = Math.min(s.widthPt, s.heightPt);
        var maxSide = Math.max(s.widthPt, s.heightPt);
        run({ widthPt: minSide, heightPt: maxSide }, 'Đã đổi khổ dọc ');
      }
    } else if (targetOrient === 'landscape') {
      if (currentOrient === 'portrait') {
        run({ swap: true }, 'Đã đổi khổ ngang ');
      } else {
        var minSide = Math.min(s.widthPt, s.heightPt);
        var maxSide = Math.max(s.widthPt, s.heightPt);
        run({ widthPt: maxSide, heightPt: minSide }, 'Đã đổi khổ ngang ');
      }
    }
  }

  function init() {
    var input = $('doc-size-input');
    if (input) {
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          applyCustom();
          input.blur();
        }
      });
      input.addEventListener('change', applyCustom);
    }

    var btnP = $('orient-portrait');
    var btnL = $('orient-landscape');
    var btnS = $('orient-square');
    if (btnP) btnP.onclick = function () { setOrientation('portrait'); };
    if (btnL) btnL.onclick = function () { setOrientation('landscape'); };
    if (btnS) btnS.onclick = function () { setOrientation('square'); };

    document.addEventListener('artboards-changed', function (e) {
      list = (e.detail && e.detail.artboards) || [];
      docName = (e.detail && e.detail.docName) || '';
      docPath = (e.detail && e.detail.docPath) || '';
      render();
    });

    var box = $('artboards');
    if (box) box.addEventListener('change', render);

    var abAll = $('ab-all');
    var abNone = $('ab-none');
    if (abAll) abAll.addEventListener('click', render);
    if (abNone) abNone.addEventListener('click', render);

    render();
  }

  init();
}());
