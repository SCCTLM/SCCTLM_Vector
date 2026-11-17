// Document Color Mode controller (RGB vs CMYK). Manages the segmented capsule toggle,
// reflects the document's active color mode, and switches it via Bridge.setColorSpace.
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var busy = false;
  var currentColorSpace = 'RGB';

  function status(text) {
    var el = $('status');
    if (el) el.textContent = text;
  }

  function setBusy(on) {
    busy = on;
    syncButtons();
  }

  function syncButtons() {
    var disabled = busy || !Bridge.available;
    var btnRgb = $('color-mode-rgb');
    var btnCmyk = $('color-mode-cmyk');
    if (btnRgb) btnRgb.disabled = disabled;
    if (btnCmyk) btnCmyk.disabled = disabled;
  }

  function render(space) {
    if (space) currentColorSpace = String(space).toUpperCase();
    var isCmyk = currentColorSpace === 'CMYK';
    var btnRgb = $('color-mode-rgb');
    var btnCmyk = $('color-mode-cmyk');
    if (btnRgb) {
      btnRgb.classList.toggle('on', !isCmyk);
      btnRgb.setAttribute('aria-checked', !isCmyk ? 'true' : 'false');
    }
    if (btnCmyk) {
      btnCmyk.classList.toggle('on', isCmyk);
      btnCmyk.setAttribute('aria-checked', isCmyk ? 'true' : 'false');
    }
    syncButtons();
  }

  function applySpace(space) {
    if (busy || !Bridge.available) return;
    var target = String(space).toUpperCase();
    if (target === currentColorSpace) return;
    setBusy(true);
    // Optimistic UI update
    render(target);
    Bridge.setColorSpace(target).then(function (res) {
      if (!res.ok) {
        status(res.error || 'Không đổi được hệ màu tài liệu.');
        render(currentColorSpace);
        return;
      }
      currentColorSpace = res.colorSpace || target;
      render(currentColorSpace);
      document.dispatchEvent(new CustomEvent('refresh-artboards', {
        detail: { message: 'Đã chuyển sang hệ màu ' + currentColorSpace + '.' }
      }));
    }, function (e) {
      status((e && e.message) || 'Lỗi khi đổi hệ màu');
      render(currentColorSpace);
    }).then(function () {
      setBusy(false);
    });
  }

  function init() {
    var btnRgb = $('color-mode-rgb');
    var btnCmyk = $('color-mode-cmyk');
    if (btnRgb) btnRgb.addEventListener('click', function () { applySpace('RGB'); });
    if (btnCmyk) btnCmyk.addEventListener('click', function () { applySpace('CMYK'); });

    document.addEventListener('artboards-changed', function (e) {
      var space = e.detail && e.detail.colorSpace;
      if (space) render(space);
    });

    render(currentColorSpace);
  }

  init();
}());
