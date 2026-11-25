// Align & Distribute panel controller (bottom of Daily tab).
(function (global) {
  'use strict';

  var STORAGE_KEY = 'scctlm.alignTo';
  var $ = function (id) { return document.getElementById(id); };

  var state = {
    alignTo: 'selection', // 'artboard' | 'selection' | 'key'
    spacingPt: null,      // null = auto even spacing; number = explicit gap in pt
    busy: false
  };

  function loadStoredAlignTo() {
    try {
      if (global.localStorage) {
        var saved = global.localStorage.getItem(STORAGE_KEY);
        if (saved === 'selection' || saved === 'artboard' || saved === 'key') {
          return saved;
        }
      }
    } catch (ignore) {}
    return 'selection';
  }

  function saveAlignTo(mode) {
    try {
      if (global.localStorage) global.localStorage.setItem(STORAGE_KEY, mode);
    } catch (ignore) {}
  }

  function notify(msg) {
    if (global.NoticeWindow && global.NoticeWindow.show) {
      global.NoticeWindow.show(msg);
    } else {
      var s = $('status');
      if (s) s.textContent = msg;
    }
  }

  function setStatus(msg) {
    var s = $('status');
    if (s) s.textContent = msg || '';
  }

  function parseSpacingInput() {
    var input = $('align-spacing');
    if (!input) return null;
    var raw = String(input.value || '').trim();
    if (raw === '') return null;
    var num = parseFloat(raw.replace(',', '.'));
    return isNaN(num) ? null : num;
  }

  function updateUI() {
    var toBtns = document.querySelectorAll('.align-to-btn');
    toBtns.forEach(function (btn) {
      var isCur = btn.dataset.alignTo === state.alignTo;
      btn.classList.toggle('on', isCur);
      btn.setAttribute('aria-pressed', isCur ? 'true' : 'false');
    });

    var spacingInput = $('align-spacing');
    if (spacingInput) {
      spacingInput.placeholder = state.alignTo === 'key' ? '0' : 'Auto';
    }
  }

  function setAlignTo(mode) {
    if (mode !== 'selection' && mode !== 'artboard' && mode !== 'key') return;
    state.alignTo = mode;
    saveAlignTo(mode);
    updateUI();
  }

  function setButtonsDisabled(disabled) {
    var btns = document.querySelectorAll('.align-btn');
    btns.forEach(function (btn) {
      btn.disabled = !!disabled;
    });
  }

  function runAlign(op) {
    if (state.busy) return Promise.resolve();
    if (!global.Bridge || !global.Bridge.alignObjects) {
      notify('Mất kết nối Illustrator');
      return Promise.resolve();
    }

    var job = {
      op: op,
      alignTo: state.alignTo
    };
    if (op === 'v-space' || op === 'h-space') {
      job.spacingPt = parseSpacingInput();
    }

    state.busy = true;
    setButtonsDisabled(true);

    return global.Bridge.alignObjects(job).then(function (res) {
      state.busy = false;
      setButtonsDisabled(false);
      if (res && res.ok) {
        setStatus('');
      } else {
        notify(res && res.error ? res.error : 'Không thể căn chỉnh');
      }
      return res;
    }).catch(function (err) {
      state.busy = false;
      setButtonsDisabled(false);
      notify('Lỗi: ' + (err && err.message ? err.message : String(err)));
    });
  }

  function init() {
    state.alignTo = loadStoredAlignTo();

    var opBtns = document.querySelectorAll('.align-btn');
    opBtns.forEach(function (btn) {
      btn.onclick = function () {
        var op = btn.dataset.alignOp;
        if (op) runAlign(op);
      };
    });

    var toBtns = document.querySelectorAll('.align-to-btn');
    toBtns.forEach(function (btn) {
      btn.onclick = function () {
        setAlignTo(btn.dataset.alignTo);
      };
    });

    var spacingInput = $('align-spacing');
    if (spacingInput) {
      spacingInput.oninput = function () {
        state.spacingPt = parseSpacingInput();
      };
    }

    updateUI();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  global.AlignPanel = {
    state: state,
    setAlignTo: setAlignTo,
    runAlign: runAlign,
    parseSpacingInput: parseSpacingInput,
    updateUI: updateUI
  };
}(window));
