// Offset Lab panel controller: connects the UI to the preview SVG and the ExtendScript engine.
(function (global) {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };

  var state = {
    offset: 20,
    join: 'round',
    miterLimit: 4,
    color: '#1FC8FF',
    rgb: [31, 200, 255],
    cmyk: null,
    mode: 'sticker',
    placeBehind: true,
    keepOriginal: true,
    applyColor: true,
    // Edit-mode: when the selection is a tagged offset result
    editing: false,
    editParams: null
  };

  function hexToRgb(hex) {
    var c = hex.replace('#', '').trim();
    if (c.length === 3) c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
    var num = parseInt(c, 16);
    if (isNaN(num)) return [31, 200, 255];
    return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
  }

  function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(function (v) {
      return Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
    }).join('').toUpperCase();
  }

  function updateSliderFill() {
    var slider = $('offset-width-slider');
    if (!slider) return;
    var min = Number(slider.min) !== undefined && !isNaN(Number(slider.min)) ? Number(slider.min) : -50;
    var max = Number(slider.max) !== undefined && !isNaN(Number(slider.max)) ? Number(slider.max) : 100;
    var pct = Math.max(0, Math.min(100, ((state.offset - min) / (max - min)) * 100));
    slider.style.background = 'linear-gradient(to right, #44BA76 0%, #44BA76 ' + pct + '%, #4a4a4a ' + pct + '%, #4a4a4a 100%)';
  }

  // Preview geometry: the selected artwork when available, otherwise the sample glyph.
  var PREVIEW_W = 160;
  var PREVIEW_H = 140;
  var PREVIEW_PAD = 6;
  var sample = { d: null, x: 3, y: 5, w: 81, h: 109 };
  var shape = sample;
  var shapeKey = '';

  function setPathData(id, d) {
    var el = $(id);
    if (el && d) el.setAttribute('d', d);
  }

  function applyShape(next) {
    shape = next;
    ['offset-preview-outline-path', 'offset-preview-fg-path', 'offset-preview-clip-path'].forEach(function (id) {
      setPathData(id, shape.d);
    });
  }

  // Fits the shape plus the outset border into the preview; the stroke is a centred line, so
  // stroke-width = 2 * offset in shape units draws exactly offset of border outside the edge.
  function layoutPreview() {
    var room = Math.max(0, state.offset);
    var s = Math.min((PREVIEW_W - 2 * PREVIEW_PAD) / (shape.w + 2 * room),
                     (PREVIEW_H - 2 * PREVIEW_PAD) / (shape.h + 2 * room));
    var t = 'translate(' + (PREVIEW_W / 2) + ' ' + (PREVIEW_H / 2) + ') scale(' + s + ') translate(' +
            (-(shape.x + shape.w / 2)) + ' ' + (-(shape.y + shape.h / 2)) + ')';
    ['offset-preview-outline', 'offset-preview-fg'].forEach(function (id) {
      var g = $(id);
      if (g) g.setAttribute('transform', t);
    });
  }

  function updatePreview() {
    var outlineGroup = $('offset-preview-outline');
    if (!outlineGroup) return;
    layoutPreview();

    if (state.offset < 0) {
      // Inset: the inner band between the edge and the inset line, clipped to the shape.
      outlineGroup.setAttribute('stroke-width', Math.abs(state.offset) * 2);
      outlineGroup.setAttribute('stroke', state.color);
      outlineGroup.setAttribute('fill', 'none');
      outlineGroup.setAttribute('stroke-opacity', '0.6');
      outlineGroup.setAttribute('clip-path', 'url(#offset-preview-clip)');
    } else {
      // Outset / sticker contour visualization
      outlineGroup.setAttribute('stroke-width', Math.max(0.01, state.offset * 2));
      outlineGroup.setAttribute('stroke', state.color);
      outlineGroup.setAttribute('fill', state.color);
      if (typeof outlineGroup.removeAttribute === 'function') {
        outlineGroup.removeAttribute('stroke-opacity');
        outlineGroup.removeAttribute('clip-path');
      }
    }
    outlineGroup.setAttribute('stroke-linejoin', state.join);
    outlineGroup.setAttribute('stroke-miterlimit', state.miterLimit);
  }

  function updateUI() {
    var slider = $('offset-width-slider');
    var valInput = $('offset-width-input');
    var valDisplay = $('offset-width-val');

    if (slider) slider.value = state.offset;
    if (valInput && document.activeElement !== valInput) {
      valInput.value = state.offset;
    }
    if (valDisplay) valDisplay.textContent = state.offset + 'px';
    updateSliderFill();

    var joinBtns = document.querySelectorAll('.offset-join-btn');
    joinBtns.forEach(function (btn) {
      var isCur = btn.dataset.join === state.join;
      btn.classList.toggle('on', isCur);
      btn.setAttribute('aria-checked', isCur ? 'true' : 'false');
    });

    var modeBtns = document.querySelectorAll('.offset-mode-btn');
    modeBtns.forEach(function (btn) {
      var isCur = btn.dataset.mode === state.mode;
      btn.classList.toggle('on', isCur);
      btn.setAttribute('aria-checked', isCur ? 'true' : 'false');
    });

    var optBehind = $('offset-opt-behind');
    if (optBehind) optBehind.checked = state.placeBehind;

    var optKeep = $('offset-opt-keep');
    if (optKeep) optKeep.checked = state.keepOriginal;

    var optColor = $('offset-opt-color');
    if (optColor) optColor.checked = state.applyColor;

    var applyBtn = $('offset-apply');
    if (applyBtn) {
      if (state.editing) {
        applyBtn.textContent = 'Cập nhật viền';
      } else {
        applyBtn.textContent = state.mode === 'sticker' ? 'Tạo viền' : 'Offset Path';
      }
    }

    var miterInput = $('offset-miter-input');
    if (miterInput) miterInput.value = state.miterLimit;

    var colorBtn = $('offset-color-btn');
    if (colorBtn) colorBtn.style.backgroundColor = state.color;

    var nativeColor = $('offset-color-native');
    if (nativeColor) nativeColor.value = state.color;

    var hexInput = $('offset-hex-input');
    if (hexInput && document.activeElement !== hexInput) {
      hexInput.value = state.color.toUpperCase();
    }

    var swatches = document.querySelectorAll('.offset-swatch');
    swatches.forEach(function (sw) {
      sw.classList.toggle('active', sw.dataset.color.toUpperCase() === state.color.toUpperCase());
    });

    // Edit-mode badge and card highlight
    var badge = $('offset-edit-badge');
    var card = document.querySelector ? document.querySelector('.offset-lab-card') : null;
    if (badge) badge.style.display = state.editing ? 'flex' : 'none';
    if (card) card.classList.toggle('offset-editing', state.editing);

    // In edit mode, hide creation-only options (behind, keep, mode toggle)
    var optionsRow = document.querySelector ? document.querySelector('.offset-options-row') : null;
    if (optionsRow) optionsRow.style.display = state.editing ? 'none' : '';
    var modeToggle = $('offset-mode-toggle');
    if (modeToggle) modeToggle.style.display = state.editing ? 'none' : '';

    updatePreview();
  }

  function setColor(hex) {
    if (!hex) return;
    if (!hex.startsWith('#')) hex = '#' + hex;
    state.color = hex.toUpperCase();
    state.rgb = hexToRgb(state.color);
    updateUI();
  }

  function setMode(mode) {
    if (mode !== 'sticker' && mode !== 'standard') mode = 'sticker';
    state.mode = mode;
    // Standard Offset Path keeps the original appearance; sticker paints the border.
    state.applyColor = mode === 'sticker';
    updateUI();
  }

  var shapeBusy = false;
  var detectBusy = false;
  var inspectBusy = false;
  var lastHoverInspect = 0;
  var HOVER_COOLDOWN_MS = 1000;

  function isDailyTab() {
    var tab = document.body && document.body.dataset && document.body.dataset.tab;
    return !tab || tab === 'daily';
  }

  var joinNames = { 0: 'round', 1: 'bevel', 2: 'miter', 'round': 'round', 'bevel': 'bevel', 'miter': 'miter' };

  function enterEditMode(params, currentColor) {
    var newOffset = Number(params.offsetPt !== undefined ? params.offsetPt : 20);
    var newJoin = joinNames[params.join] || params.join || 'round';
    var newMiter = Number(params.miterLimit !== undefined ? params.miterLimit : 4);
    var newMode = params.mode || 'sticker';

    var newColor = state.color;
    var newRgb = state.rgb;

    if (currentColor && currentColor.hex) {
      newColor = currentColor.hex.toUpperCase();
      newRgb = currentColor.rgb || hexToRgb(newColor);
    } else if (params.colorHex) {
      newColor = params.colorHex.toUpperCase();
      newRgb = params.colorRgb || hexToRgb(newColor);
    }

    // Already editing this same offset: keep the user's pending changes instead of
    // overwriting them with the values stored on the object.
    if (state.editing && state.editParams &&
        (state.editParams.id || '') === (params.id || '')) {
      return;
    }

    var changed = !state.editing ||
      state.offset !== newOffset ||
      state.join !== newJoin ||
      state.miterLimit !== newMiter ||
      state.mode !== newMode ||
      state.color !== newColor;

    if (!changed) return;

    state.editing = true;
    state.editParams = params;
    state.offset = newOffset;
    state.join = newJoin;
    state.miterLimit = newMiter;
    state.mode = newMode;
    state.color = newColor;
    state.rgb = newRgb;

    updateUI();
  }

  function exitEditMode() {
    if (!state.editing) return;
    state.editing = false;
    state.editParams = null;
    updateUI();
  }

  // Detects whether the selection is a tagged offset result and enters edit mode.
  function detectExisting() {
    if (detectBusy || !global.Bridge || !global.Bridge.offsetDetect) return;
    var card = $('offset-preview-svg');
    if (card && card.offsetParent === null) return;
    detectBusy = true;
    global.Bridge.offsetDetect().then(function (res) {
      detectBusy = false;
      if (res && res.found && res.params) {
        enterEditMode(res.params, res.currentColor);
      } else {
        exitEditMode();
      }
    }).catch(function () {
      detectBusy = false;
      exitEditMode();
    });
  }

  // Unified inspector: inspects the selection and updates preview and offset controls.
  function inspectSelection() {
    if (document.hidden || !isDailyTab() || inspectBusy || !global.Bridge) return;
    var card = $('offset-preview-svg');
    if (card && card.offsetParent === null) return;

    if (global.Bridge.offsetInspect) {
      inspectBusy = true;
      global.Bridge.offsetInspect().then(function (res) {
        inspectBusy = false;
        if (!res || !res.ok) return;

        if (!res.hasSelection) {
          if (state.editing) exitEditMode();
          if (shapeKey !== 'sample') {
            shapeKey = 'sample';
            applyShape(sample);
            updatePreview();
          }
          return;
        }

        // 1. Process offset detection
        if (res.offsetInfo && res.offsetInfo.found && res.offsetInfo.params) {
          enterEditMode(res.offsetInfo.params, res.offsetInfo.currentColor);
        } else if (state.editing) {
          exitEditMode();
        }

        // 2. Process preview shape
        var next = res.shape && res.shape.ok ? res.shape : sample;
        var key = next === sample ? 'sample' : next.d;
        if (key !== shapeKey) {
          shapeKey = key;
          applyShape(next);
          updatePreview();
        }
      }).catch(function () {
        inspectBusy = false;
      });
      return;
    }

    refreshShape();
    detectExisting();
  }

  // Mirrors the Illustrator selection into the preview; falls back to the sample glyph.
  function refreshShape() {
    if (shapeBusy || !global.Bridge || !global.Bridge.offsetShape) return;
    var card = $('offset-preview-svg');
    if (card && card.offsetParent === null) return;
    shapeBusy = true;
    global.Bridge.offsetShape().then(function (res) {
      shapeBusy = false;
      var next = res && res.ok ? res : sample;
      var key = next === sample ? 'sample' : next.d;
      if (key !== shapeKey) {
        shapeKey = key;
        applyShape(next);
        updatePreview();
      }
      detectExisting();
    }).catch(function () { shapeBusy = false; });
  }

  function notify(msg) {
    if (global.Notice && global.Notice.show) {
      global.Notice.show(msg);
    } else {
      var s = $('status');
      if (s) s.textContent = msg;
    }
  }

  function init() {
    var slider = $('offset-width-slider');
    if (slider) {
      slider.oninput = function () {
        state.offset = Number(slider.value);
        updateUI();
      };
    }

    var valInput = $('offset-width-input');
    if (valInput) {
      valInput.oninput = function () {
        var num = parseFloat(valInput.value);
        if (!isNaN(num)) {
          state.offset = num;
          if (slider) slider.value = num;
          updateSliderFill();
          updatePreview();
        }
      };
      valInput.onchange = function () {
        var num = parseFloat(valInput.value);
        if (isNaN(num)) {
          valInput.value = state.offset;
        } else {
          state.offset = num;
          updateUI();
        }
      };
    }

    var joinBtns = document.querySelectorAll('.offset-join-btn');
    joinBtns.forEach(function (btn) {
      btn.onclick = function () {
        state.join = btn.dataset.join || 'round';
        updateUI();
      };
    });

    var modeBtns = document.querySelectorAll('.offset-mode-btn');
    modeBtns.forEach(function (btn) {
      btn.onclick = function () {
        setMode(btn.dataset.mode);
      };
    });

    var optBehind = $('offset-opt-behind');
    if (optBehind) {
      optBehind.onchange = function () {
        state.placeBehind = optBehind.checked;
      };
    }

    var optKeep = $('offset-opt-keep');
    if (optKeep) {
      optKeep.onchange = function () {
        state.keepOriginal = optKeep.checked;
      };
    }

    var optColor = $('offset-opt-color');
    if (optColor) {
      optColor.onchange = function () {
        state.applyColor = optColor.checked;
      };
    }

    var miterInput = $('offset-miter-input');
    if (miterInput) {
      miterInput.oninput = function () {
        var num = parseFloat(miterInput.value);
        if (!isNaN(num) && num >= 1) {
          state.miterLimit = num;
          updatePreview();
        }
      };
    }

    var colorBtn = $('offset-color-btn');
    var nativeColor = $('offset-color-native');
    if (colorBtn && nativeColor) {
      colorBtn.onclick = function () {
        nativeColor.value = state.color;
        nativeColor.click();
      };
      nativeColor.oninput = nativeColor.onchange = function () {
        setColor(nativeColor.value);
      };
    }

    var hexInput = $('offset-hex-input');
    if (hexInput) {
      hexInput.onchange = function () {
        var val = hexInput.value.trim();
        if (/^#?[0-9A-Fa-f]{3,6}$/.test(val)) {
          setColor(val);
        } else {
          hexInput.value = state.color.toUpperCase();
        }
      };
    }

    var eyedropperBtn = $('offset-eyedropper-btn');
    if (eyedropperBtn) {
      eyedropperBtn.onclick = function () {
        if (typeof window.EyeDropper !== 'undefined') {
          new EyeDropper().open().then(function (res) {
            setColor(res.sRGBHex);
          }).catch(function () {});
        } else if (global.Bridge && global.Bridge.colorContext) {
          global.Bridge.colorContext().then(function (ctx) {
            if (ctx && ctx.rgb) {
              setColor(rgbToHex(ctx.rgb[0], ctx.rgb[1], ctx.rgb[2]));
            }
          }).catch(function (e) {
            notify('Không thể hút màu: ' + e.message);
          });
        }
      };
    }

    var swatches = document.querySelectorAll('.offset-swatch');
    swatches.forEach(function (sw) {
      sw.onclick = function () {
        setColor(sw.dataset.color);
      };
    });

    var applyBtn = $('offset-apply');
    if (applyBtn) {
      applyBtn.onclick = function () {
        if (!global.Bridge) {
          notify('Mất kết nối Illustrator');
          return;
        }

        applyBtn.disabled = true;

        if (state.editing) {
          // Edit mode: update the existing offset in-place
          notify('Đang cập nhật viền…');
          global.Bridge.offsetUpdate({
            color: { rgb: state.rgb, hex: state.color },
            join: state.join,
            miterLimit: state.miterLimit,
            offsetPt: state.offset,
            rebuild: true
          }).then(function (res) {
            applyBtn.disabled = false;
            if (res && res.ok) {
              notify(res.message || 'Đã cập nhật viền');
              inspectSelection();
            } else {
              notify('Lỗi: ' + (res && res.error ? res.error : 'Thất bại'));
            }
          }).catch(function (err) {
            applyBtn.disabled = false;
            notify('Lỗi: ' + err.message);
          });
          return;
        }

        // Create mode
        if (!global.Bridge.offsetCreate) {
          notify('Mất kết nối Illustrator');
          applyBtn.disabled = false;
          return;
        }

        var actName = state.mode === 'sticker' ? 'Đang tạo viền' : 'Đang offset';
        notify(actName + ' ' + state.offset + 'px…');

        global.Bridge.offsetCreate({
          offsetPt: state.offset,
          join: state.join,
          miterLimit: state.miterLimit,
          mode: state.mode,
          placeBehind: state.placeBehind,
          keepOriginal: state.keepOriginal,
          applyColor: state.applyColor,
          color: {
            rgb: state.rgb,
            hex: state.color
          }
        }).then(function (res) {
          applyBtn.disabled = false;
          if (res && res.ok) {
            var succ = state.mode === 'sticker' ? 'Đã tạo viền' : 'Đã offset';
            notify(succ + ' ' + state.offset + 'px');
            inspectSelection();
          } else {
            notify('Lỗi: ' + (res && res.error ? res.error : 'Thất bại'));
          }
        }).catch(function (err) {
          applyBtn.disabled = false;
          notify('Lỗi: ' + err.message);
        });
      };
    }

    var outlinePath = $('offset-preview-outline-path');
    sample.d = outlinePath && outlinePath.getAttribute ? outlinePath.getAttribute('d') : null;
    inspectSelection();
    if (typeof global.addEventListener === 'function') global.addEventListener('focus', inspectSelection);
    if (typeof document.addEventListener === 'function') {
      document.addEventListener('visibilitychange', function () {
        if (!document.hidden) inspectSelection();
      });
      document.addEventListener('tab-changed', function (e) {
        if (!e || !e.detail || e.detail === 'daily') inspectSelection();
      });
    }
    var cardEl = document.querySelector ? document.querySelector('.offset-lab-card') : null;
    if (cardEl && typeof cardEl.addEventListener === 'function') {
      cardEl.addEventListener('mouseenter', function () {
        var now = Date.now();
        if (now - lastHoverInspect < HOVER_COOLDOWN_MS) return;
        lastHoverInspect = now;
        inspectSelection();
      });
    }

    updateUI();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  global.OffsetPanel = {
    state: state,
    setColor: setColor,
    setMode: setMode,
    setOffset: function (val) { state.offset = Number(val); updateUI(); },
    setJoin: function (join) { state.join = join; updateUI(); },
    updateUI: updateUI,
    hexToRgb: hexToRgb,
    rgbToHex: rgbToHex,
    enterEditMode: enterEditMode,
    exitEditMode: exitEditMode,
    inspectSelection: inspectSelection
  };
}(window));
