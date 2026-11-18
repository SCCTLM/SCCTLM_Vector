// Logo Lab card (Daily tab): element toggles, marker style, sizes and stroke widths, live preview, Generate / Clear.
// It drives the same grid engine and saved grid settings as before; outlines are never drawn here because the
// artwork is already on the page. Settings are saved on every change; messages go to the notice window.
(function (global) {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var ELEMENTS = ['anchors', 'handles', 'circles', 'gridlines'];
  var LABELS = { anchors: 'điểm neo', handles: 'tay nắm', circles: 'vòng tròn', gridlines: 'đường lưới' };
  // Above this many anchors plus circles the run can freeze Illustrator for a while, so the panel asks first.
  var CONFIRM_ITEMS = 2000;

  // The grid engine job for the current settings. Outlines are always off in Logo Lab.
  function buildJob(settings) {
    var elements = { outlines: false };
    ELEMENTS.forEach(function (k) { elements[k] = !!settings.elements[k]; });
    return { elements: elements, style: settings.style, gridlines: settings.gridlines, circles: settings.circles };
  }

  // Preview glyph: a lowercase "a" as an absolute M / L / C path, y pointing down, in a 168.9 x 163.3 box.
  var GLYPH = { d: 'M 34.7 112.7 C 34.7 125.8 45.0 135.0 66.0 135.0 C 91.1 135.0 111.3 120.5 117.1 83.6 L 117.1 64.9 C 112.1 73.8 98.1 77.2 80.5 80.8 C 53.7 86.4 34.7 91.7 34.7 112.7 M 0.6 128.3 C 0.6 113.8 6.7 104.3 19.0 96.7 C 29.1 90.6 41.1 87.2 56.2 83.6 C 64.9 81.6 76.0 79.4 85.8 77.2 C 102.9 73.5 117.1 68.8 117.1 58.1 C 117.1 41.6 107.1 28.8 80.5 28.8 C 55.6 28.8 40.0 39.4 29.6 62.1 L 0.0 45.6 C 17.3 16.5 43.9 0.0 81.1 0.0 C 125.3 0.0 148.7 20.1 148.7 59.0 L 148.7 118.8 C 148.7 129.4 152.1 132.2 159.6 132.2 C 164.1 132.2 166.6 131.4 168.9 130.3 L 168.9 158.8 C 164.9 160.8 156.3 162.4 147.9 162.4 C 127.2 162.4 116.0 152.9 116.0 126.6 C 116.0 118.5 116.6 101.8 116.9 92.5 C 107.6 130.0 80.0 163.3 45.0 163.3 C 14.5 163.3 0.6 148.2 0.6 128.3', w: 168.9, h: 163.3 };

  // Where the design shows anchors, handle ends and handle lines on the glyph, in the same box.
  var PV_ANCHORS = [[81.1, 0.2], [148.6, 57.1], [39.3, 163.5], [146.2, 163.5], [0.6, 128.1]];
  var PV_HANDLE_DOTS = [[149, 122], [168.9, 130.3], [129.4, 163.5], [67.7, 134.4], [34.8, 112.8], [0.6, 110.2], [0.6, 146], [75.1, 163.5],
    [7.3, 163.5], [163.1, 163.5], [148.6, 19.1], [29.1, 61.7], [0.6, 45.8], [40, 0.2], [122.2, 0.2]];
  var PV_HANDLE_LINES = [[40, 0.2, 79, 0.2], [83.1, 0.2, 122.2, 0.2], [75.1, 163.5, 7.3, 163.5], [163.1, 163.5, 129.3, 163.5],
    [0.6, 146, 0.6, 110.2], [148.7, 18.1, 148.7, 57.1]];

  // Shapes for the preview. It is a loose illustration, not to scale.
  function previewModel() {
    var margin = 14;
    return {
      d: GLYPH.d.replace(/ M /g, ' Z M ') + ' Z',
      anchors: PV_ANCHORS,
      handleDots: PV_HANDLE_DOTS,
      handleLines: PV_HANDLE_LINES,
      lines: [
        [-margin, 0, GLYPH.w + margin, 0], [-margin, GLYPH.h, GLYPH.w + margin, GLYPH.h],
        [0, -margin, 0, GLYPH.h + margin], [GLYPH.w, -margin, GLYPH.w, GLYPH.h + margin]
      ],
      circle: { cx: GLYPH.w / 2, cy: GLYPH.h / 2, r: Math.min(GLYPH.w, GLYPH.h) / 2 }
    };
  }

  global.LogoLab = { buildJob: buildJob, previewModel: previewModel, ELEMENTS: ELEMENTS };

  if (typeof document === 'undefined' || !$('ll-generate')) return;

  var SVG_NS = 'http://www.w3.org/2000/svg';
  var settings = GridSettings.load();
  // Last saved settings: an emptied number field falls back to these instead of the minimum.
  var saved = GridSettings.normalize(settings);
  var running = false;
  var pending = null;

  function notify(msg) {
    if (global.NoticeWindow && global.NoticeWindow.show) global.NoticeWindow.show(msg);
    else $('status').textContent = msg;
  }

  function save() {
    settings = GridSettings.normalize(settings, saved);
    saved = GridSettings.normalize(settings);
    try { GridSettings.save(settings); } catch (e) { notify('Không lưu được thiết lập: ' + e.message); }
    show();
  }

  function svg(tag, attrs, parent) {
    var el = document.createElementNS(SVG_NS, tag);
    Object.keys(attrs).forEach(function (k) { el.setAttribute(k, attrs[k]); });
    parent.appendChild(el);
    return el;
  }

  function clearNode(id) {
    var n = $(id);
    while (n.firstChild) n.removeChild(n.firstChild);
    return n;
  }

  // Real stroke widths would swamp the small preview, so they are kept thin there.
  function previewStroke(w) { return Math.max(0.75, Math.min(2, w)); }

  function drawPreview() {
    var m = previewModel();
    var st = settings.style;
    var on = settings.elements;
    var shape = $('ll-pv-shape');
    shape.setAttribute('d', m.d);

    var lines = clearNode('ll-pv-gridlines');
    if (on.gridlines) {
      m.lines.forEach(function (l) {
        svg('line', { x1: l[0], y1: l[1], x2: l[2], y2: l[3], stroke: st.gridlines.stroke, 'stroke-width': Math.max(0.75, st.gridlines.strokeWidth) }, lines);
      });
    }
    var circles = clearNode('ll-pv-circles');
    if (on.circles) {
      svg('circle', { cx: m.circle.cx, cy: m.circle.cy, r: m.circle.r, fill: 'none', stroke: st.circles.stroke, 'stroke-width': Math.max(0.75, st.circles.strokeWidth) }, circles);
    }
    var handles = clearNode('ll-pv-handles');
    if (on.handles) {
      var h = st.handles;
      var line = h.stroke !== 'none' ? h.stroke : h.fill;
      var r = Math.max(1, h.size * 0.25);
      m.handleLines.forEach(function (l) {
        svg('line', { x1: l[0], y1: l[1], x2: l[2], y2: l[3], stroke: line, 'stroke-width': 1.5 }, handles);
      });
      m.handleDots.forEach(function (p) {
        svg('circle', { cx: p[0], cy: p[1], r: r, fill: h.fill, stroke: h.stroke, 'stroke-width': previewStroke(h.strokeWidth) }, handles);
      });
    }
    var anchors = clearNode('ll-pv-anchors');
    if (on.anchors) {
      var a = st.anchors;
      var s = Math.max(2, a.size * 1.5);
      m.anchors.forEach(function (p) {
        svg('rect', { x: p[0] - s / 2, y: p[1] - s / 2, width: s, height: s, fill: a.fill, stroke: a.stroke, 'stroke-width': previewStroke(a.strokeWidth) }, anchors);
      });
    }
  }

  function sliderFill(slider) {
    var min = Number(slider.min), max = Number(slider.max);
    var pct = Math.max(0, Math.min(100, ((Number(slider.value) - min) / (max - min)) * 100));
    slider.style.background = 'linear-gradient(to right, var(--commit) 0%, var(--commit) ' + pct + '%, var(--control-hover) ' + pct + '%, var(--control-hover) 100%)';
  }

  function showColor(prop, value) {
    var picker = $('ll-' + prop);
    var none = $('ll-' + prop + '-none');
    var isNone = value === 'none';
    if (picker.value !== (isNone ? '#000000' : value)) picker.value = isNone ? '#000000' : value;
    picker.disabled = isNone;
    var chip = $('ll-' + prop + '-chip');
    chip.classList.toggle('is-none', isNone);
    if (!isNone) chip.style.setProperty('--c', value);
    none.classList.toggle('on', isNone);
    none.setAttribute('aria-pressed', isNone ? 'true' : 'false');
  }

  function show() {
    var st = settings.style;
    Array.prototype.forEach.call(document.querySelectorAll('.ll-toggle'), function (b) {
      var on = !!settings.elements[b.dataset.el];
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    showColor('fill', st.anchors.fill);
    showColor('stroke', st.anchors.stroke);
    setValue('ll-stroke-width', st.anchors.strokeWidth);
    setValue('ll-anchor-size', st.anchors.size);
    setValue('ll-anchor-size-val', st.anchors.size);
    setValue('ll-handle-size', st.handles.size);
    setValue('ll-handle-size-val', st.handles.size);
    setValue('ll-circle-width', st.circles.strokeWidth);
    setValue('ll-grid-width', st.gridlines.strokeWidth);
    sliderFill($('ll-anchor-size'));
    sliderFill($('ll-handle-size'));
    drawPreview();
  }

  // Leaves the field being typed in alone so a half-typed number is not overwritten.
  function setValue(id, value) {
    var el = $(id);
    if (document.activeElement !== el) el.value = value;
    el.style.width = (String(el.value).length + 0.4) + 'ch';
  }

  // Anchors and handles share one fill, stroke and stroke width.
  function setMarker(prop, value) {
    settings.style.anchors[prop] = value;
    settings.style.handles[prop] = value;
    save();
  }

  function bindNumber(id, apply, blurRefresh) {
    var el = $(id);
    el.oninput = function () { if (el.value !== '' && !isNaN(Number(el.value))) apply(el.value); };
    el.onchange = function () { apply(el.value); el.blur(); if (blurRefresh) show(); };
  }

  function bind() {
    Array.prototype.forEach.call(document.querySelectorAll('.ll-toggle'), function (b) {
      b.onclick = function () { settings.elements[b.dataset.el] = !settings.elements[b.dataset.el]; save(); };
    });
    $('ll-fill').oninput = function () { setMarker('fill', this.value); };
    $('ll-stroke').oninput = function () { setMarker('stroke', this.value); };
    $('ll-fill-none').onclick = function () { setMarker('fill', settings.style.anchors.fill === 'none' ? $('ll-fill').value : 'none'); };
    $('ll-stroke-none').onclick = function () { setMarker('stroke', settings.style.anchors.stroke === 'none' ? $('ll-stroke').value : 'none'); };
    bindNumber('ll-stroke-width', function (v) { setMarker('strokeWidth', v); }, true);
    ['ll-anchor-size', 'll-anchor-size-val'].forEach(function (id) {
      bindNumber(id, function (v) { settings.style.anchors.size = v; save(); }, true);
    });
    ['ll-handle-size', 'll-handle-size-val'].forEach(function (id) {
      bindNumber(id, function (v) { settings.style.handles.size = v; save(); }, true);
    });
    bindNumber('ll-circle-width', function (v) { settings.style.circles.strokeWidth = v; save(); }, true);
    bindNumber('ll-grid-width', function (v) { settings.style.gridlines.strokeWidth = v; save(); }, true);
  }

  function setRunning(on) {
    running = on;
    if (global.PanelReload) global.PanelReload.setBusy('grid', on);
    $('ll-generate').disabled = on;
    $('ll-clear').disabled = on;
    $('ll-generate').textContent = on ? 'Đang xử lý…' : 'Tạo lưới';
  }

  function hideConfirm() { pending = null; $('ll-confirm').hidden = true; }

  function skippedNote(skipped) {
    var parts = [];
    if (skipped && skipped.text) parts.push(skipped.text + ' văn bản (hãy outline trước)');
    if (skipped && skipped.raster) parts.push(skipped.raster + ' ảnh');
    if (skipped && skipped.other) parts.push(skipped.other + ' đối tượng khác');
    return parts.length ? ' Bỏ qua: ' + parts.join(', ') + '.' : '';
  }

  function summary(counts) {
    var parts = [];
    ELEMENTS.forEach(function (k) { if (counts[k]) parts.push(counts[k] + ' ' + LABELS[k]); });
    return parts.length ? 'Đã vẽ lưới: ' + parts.join(', ') + '.' : 'Không có gì để vẽ với các thành phần đã chọn.';
  }

  function draw(job) {
    setRunning(true);
    notify('Đang vẽ lưới…');
    global.Bridge.gridGenerate(job).then(function (res) {
      notify(res.ok ? summary(res.counts) + skippedNote(res.skipped) : res.error + skippedNote(res.skipped));
    }).catch(function (e) {
      notify('Tạo lưới thất bại: ' + e.message);
    }).then(function () { setRunning(false); });
  }

  function generate() {
    if (running) return;
    hideConfirm();
    var job = buildJob(settings);
    if (!ELEMENTS.some(function (k) { return job.elements[k]; })) { notify('Hãy bật ít nhất một thành phần để vẽ.'); return; }
    setRunning(true);
    global.Bridge.gridInspect(job).then(function (info) {
      setRunning(false);
      if (!info.ok) { notify(info.error); return; }
      if (!info.paths) { notify('Hãy chọn các path vector trước (outline văn bản nếu có).' + skippedNote(info.skipped)); return; }
      if (info.anchors + (info.circles || 0) > CONFIRM_ITEMS) {
        pending = job;
        $('ll-confirm-text').textContent = 'Cần vẽ ' + info.anchors + ' điểm neo' + (info.circles ? ' và ' + info.circles + ' vòng tròn' : '') +
          '. Illustrator có thể ngừng phản hồi một lúc.';
        $('ll-confirm').hidden = false;
        return;
      }
      draw(job);
    }).catch(function (e) {
      setRunning(false);
      notify('Tạo lưới thất bại: ' + e.message);
    });
  }

  function clear() {
    if (running) return;
    hideConfirm();
    setRunning(true);
    global.Bridge.gridClear().then(function (res) {
      notify(!res.ok ? res.error : res.removed ? 'Đã xoá lưới.' : 'Tài liệu này không có layer lưới.');
    }).catch(function (e) {
      notify('Xoá lưới thất bại: ' + e.message);
    }).then(function () { setRunning(false); });
  }

  bind();
  show();
  $('ll-expand').onclick = function () {
    var open = $('ll-more').hidden;
    $('ll-more').hidden = !open;
    this.setAttribute('aria-expanded', open ? 'true' : 'false');
  };
  $('ll-generate').onclick = generate;
  $('ll-clear').onclick = clear;
  $('ll-confirm-ok').onclick = function () { var job = pending; hideConfirm(); if (job) draw(job); };
  $('ll-confirm-cancel').onclick = function () { hideConfirm(); notify('Đã huỷ.'); };
}(window));
