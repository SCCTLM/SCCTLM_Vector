// Colour field and slider for the picker, in the 9 channel modes of the classic picker layout: the selected
// channel runs along the vertical slider, the other two channels of its group span the square field
// (x left to right, y bottom to top). Values are kept per group: hsb [h, s, b], rgb [r, g, b], lab [L, a, b].
(function (global) {
  'use strict';

  var CM = global.ColorMath;

  var RANGES = {
    hsb: [[0, 360], [0, 100], [0, 100]],
    rgb: [[0, 255], [0, 255], [0, 255]],
    lab: [[0, 100], [-128, 127], [-128, 127]]
  };

  var MODES = {
    'hsb-h': { group: 'hsb', slider: 0, x: 1, y: 2 },
    'hsb-s': { group: 'hsb', slider: 1, x: 0, y: 2 },
    'hsb-b': { group: 'hsb', slider: 2, x: 0, y: 1 },
    'rgb-r': { group: 'rgb', slider: 0, x: 2, y: 1 },
    'rgb-g': { group: 'rgb', slider: 1, x: 2, y: 0 },
    'rgb-b': { group: 'rgb', slider: 2, x: 0, y: 1 },
    'lab-l': { group: 'lab', slider: 0, x: 1, y: 2 },
    'lab-a': { group: 'lab', slider: 1, x: 2, y: 0 },
    'lab-b': { group: 'lab', slider: 2, x: 1, y: 0 }
  };

  var GREY = 150;

  function mode(id) {
    var m = MODES[id];
    if (!m) throw new Error('Unknown picker mode ' + id);
    return m;
  }

  function toRgbInto(group, v, out) {
    if (group === 'hsb') return CM.hsbToRgbInto(v[0], v[1], v[2], out);
    if (group === 'lab') return CM.labToRgbInto(v[0], v[1], v[2], out);
    out[0] = v[0]; out[1] = v[1]; out[2] = v[2];
    return out;
  }

  function toRgb(group, v) { return toRgbInto(group, v, [0, 0, 0]); }

  function norm(group, ch, value) {
    var r = RANGES[group][ch];
    return (value - r[0]) / (r[1] - r[0]);
  }

  function denorm(group, ch, t) {
    var r = RANGES[group][ch];
    t = CM.clamp(t, 0, 1);
    return r[0] + t * (r[1] - r[0]);
  }

  // Marker positions, 0..1 from the top-left: { x, y } in the field and s on the slider.
  function position(id, v) {
    var m = mode(id);
    return {
      x: norm(m.group, m.x, v[m.x]),
      y: 1 - norm(m.group, m.y, v[m.y]),
      s: 1 - norm(m.group, m.slider, v[m.slider])
    };
  }

  function atField(id, v, x, y) {
    var m = mode(id), out = v.slice();
    out[m.x] = denorm(m.group, m.x, x);
    out[m.y] = denorm(m.group, m.y, 1 - y);
    return out;
  }

  function atSlider(id, v, s) {
    var m = mode(id), out = v.slice();
    out[m.slider] = denorm(m.group, m.slider, 1 - s);
    return out;
  }

  // Fills RGBA pixels (row-major, top row first). isOut(r, g, b) marks pixels to paint grey, or null.
  // Runs once per frame while dragging, so the per-pixel work is kept minimal: axis values are computed once
  // per field and the converter is chosen once (Illustrator's Chromium is several times slower than Node).
  function renderField(id, v, w, h, data, isOut) {
    var m = mode(id), g = m.group, xi = m.x, yi = m.y, p = 0, col;
    var c0 = v[0], c1 = v[1], c2 = v[2], rgb = [0, 0, 0];
    var conv = g === 'hsb' ? CM.hsbToRgbInto : (g === 'lab' ? CM.labToRgbInto : null);
    var xs = new Float64Array(w);
    for (col = 0; col < w; col++) xs[col] = denorm(g, xi, col / (w - 1));
    for (var row = 0; row < h; row++) {
      var yv = denorm(g, yi, 1 - row / (h - 1));
      if (yi === 0) c0 = yv; else if (yi === 1) c1 = yv; else c2 = yv;
      for (col = 0; col < w; col++) {
        if (xi === 0) c0 = xs[col]; else if (xi === 1) c1 = xs[col]; else c2 = xs[col];
        if (conv) conv(c0, c1, c2, rgb);
        else { rgb[0] = c0; rgb[1] = c1; rgb[2] = c2; }
        if (isOut && isOut(rgb[0], rgb[1], rgb[2])) { data[p] = data[p + 1] = data[p + 2] = GREY; }
        else { data[p] = rgb[0]; data[p + 1] = rgb[1]; data[p + 2] = rgb[2]; }
        data[p + 3] = 255;
        p += 4;
      }
    }
  }

  // The slider shows the selected channel over its range with the other two at their current values,
  // except hue, which is shown at full saturation and brightness.
  function renderSlider(id, v, w, h, data) {
    var m = mode(id), cur = id === 'hsb-h' ? [0, 100, 100] : v.slice(), p = 0;
    for (var row = 0; row < h; row++) {
      cur[m.slider] = denorm(m.group, m.slider, 1 - row / (h - 1));
      var rgb = toRgb(m.group, cur);
      for (var col = 0; col < w; col++) {
        data[p] = rgb[0]; data[p + 1] = rgb[1]; data[p + 2] = rgb[2]; data[p + 3] = 255;
        p += 4;
      }
    }
  }

  global.ColorField = {
    MODES: MODES, RANGES: RANGES, GREY: GREY,
    toRgb: toRgb, position: position, atField: atField, atSlider: atSlider,
    renderField: renderField, renderSlider: renderSlider
  };
}(window));
