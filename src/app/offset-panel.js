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
    applyColor: true
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
      applyBtn.textContent = state.mode === 'sticker' ? 'Tạo viền' : 'Offset Path';
    }

    var miterInput = $('offset-miter-input');
    if (miterInput) miterInput.value = state.miterLimit;

    var colorBtn = $('offset-color-btn');
    if (colorBtn) colorBtn.style.backgroundColor = state.color;

    var hexInput = $('offset-hex-input');
    if (hexInput && document.activeElement !== hexInput) {
      hexInput.value = state.color.toUpperCase();
    }

    var swatches = document.querySelectorAll('.offset-swatch');
    swatches.forEach(function (sw) {
      sw.classList.toggle('active', sw.dataset.color.toUpperCase() === state.color.toUpperCase());
    });

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

  // Mirrors the Illustrator selection into the preview; falls back to the sample glyph.
  function refreshShape() {
    if (shapeBusy || !global.Bridge || !global.Bridge.offsetShape) return;
    var card = $('offset-preview-svg');
    if (card && card.offsetParent === null) return; // pane hidden
    shapeBusy = true;
    global.Bridge.offsetShape().then(function (res) {
      shapeBusy = false;
      var next = res && res.ok ? res : sample;
      var key = next === sample ? 'sample' : next.d;
      if (key === shapeKey) return;
      shapeKey = key;
      applyShape(next);
      updatePreview();
    }).catch(function () { shapeBusy = false; });
  }

  function notify(msg) {
    if (global.NoticeWindow && global.NoticeWindow.show) {
      global.NoticeWindow.show(msg);
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
      nativeColor.oninput = function () {
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
        if (!global.Bridge || !global.Bridge.offsetCreate) {
          notify('Mất kết nối Illustrator');
          return;
        }

        applyBtn.disabled = true;
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
    refreshShape();
    if (typeof global.addEventListener === 'function') global.addEventListener('focus', refreshShape);
    if (typeof setInterval === 'function') setInterval(refreshShape, 1500);

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
    rgbToHex: rgbToHex
  };
}(window));
