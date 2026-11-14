// Pure colour conversions for the colour picker. RGB channels are 0-255 floats, HSB is h 0-360 / s,b 0-100,
// Lab is D50 (what Illustrator and Photoshop show), with sRGB as the RGB space.
(function (global) {
  'use strict';

  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

  // The *Into forms write into out and allocate nothing; the field renderer calls them per pixel.
  function hsbToRgbInto(h, s, b, out) {
    s = clamp(s, 0, 100) / 100; b = clamp(b, 0, 100) * 2.55;
    h = ((h % 360) + 360) % 360 / 60;
    var i = Math.floor(h) % 6, f = h - Math.floor(h);
    var p = b * (1 - s), q = b * (1 - s * f), t = b * (1 - s * (1 - f));
    if (i === 0) { out[0] = b; out[1] = t; out[2] = p; }
    else if (i === 1) { out[0] = q; out[1] = b; out[2] = p; }
    else if (i === 2) { out[0] = p; out[1] = b; out[2] = t; }
    else if (i === 3) { out[0] = p; out[1] = q; out[2] = b; }
    else if (i === 4) { out[0] = t; out[1] = p; out[2] = b; }
    else { out[0] = b; out[1] = p; out[2] = q; }
    return out;
  }

  function hsbToRgb(h, s, b) { return hsbToRgbInto(h, s, b, [0, 0, 0]); }

  // keepHue: hue to report when the colour is grey (hue undefined), so dragging S or B to 0 keeps it.
  function rgbToHsb(r, g, b, keepHue) {
    r /= 255; g /= 255; b /= 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min, h;
    if (d === 0) h = keepHue || 0;
    else if (max === r) h = 60 * (((g - b) / d) % 6);
    else if (max === g) h = 60 * ((b - r) / d + 2);
    else h = 60 * ((r - g) / d + 4);
    if (h < 0) h += 360;
    return [h, max === 0 ? 0 : d / max * 100, max * 100];
  }

  function rgbToHex(rgb) {
    return rgb.map(function (v) {
      var s = Math.round(clamp(v, 0, 255)).toString(16);
      return s.length < 2 ? '0' + s : s;
    }).join('');
  }

  // Accepts "1e419b", "#1E419B" or the 3-digit form; returns null when it is not a colour.
  function hexToRgb(hex) {
    var m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(hex).trim());
    if (!m) return null;
    var h = m[1].length === 3 ? m[1].replace(/./g, '$&$&') : m[1];
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }

  // sRGB to XYZ, Bradford-adapted to D50.
  var M = [[0.4360747, 0.3850649, 0.1430804], [0.2225045, 0.7168786, 0.0606169], [0.0139322, 0.0971045, 0.7141733]];
  var MI = [[3.1338561, -1.6168667, -0.4906146], [-0.9787684, 1.9161415, 0.0334540], [0.0719453, -0.2289914, 1.4052427]];
  var WHITE = [0.96422, 1, 0.82521];
  var EPS = 216 / 24389, KAPPA = 24389 / 27;

  function toLinear(v) { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }
  function gammaEncode(v) { return 255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055); }

  // Interpolated table for the sRGB gamma (error under 0.005 on the 0-255 scale): the Lab field calls it
  // three times per pixel and Math.pow alone would take most of a frame.
  var GAMMA_STEPS = 4096, GAMMA = new Float64Array(GAMMA_STEPS + 1);
  for (var gi = 0; gi <= GAMMA_STEPS; gi++) GAMMA[gi] = gammaEncode(gi / GAMMA_STEPS);
  function fromLinear(v) {
    if (v <= 0) return v * 12.92 * 255;
    if (v >= 1) return gammaEncode(v);
    var x = v * GAMMA_STEPS, i = x | 0;
    return GAMMA[i] + (GAMMA[i + 1] - GAMMA[i]) * (x - i);
  }

  function rgbToLab(r, g, b) {
    var lin = [toLinear(clamp(r, 0, 255)), toLinear(clamp(g, 0, 255)), toLinear(clamp(b, 0, 255))];
    var f = [0, 1, 2].map(function (i) {
      var t = (M[i][0] * lin[0] + M[i][1] * lin[1] + M[i][2] * lin[2]) / WHITE[i];
      return t > EPS ? Math.cbrt(t) : (KAPPA * t + 16) / 116;
    });
    return [116 * f[1] - 16, 500 * (f[0] - f[1]), 200 * (f[1] - f[2])];
  }

  function labInv(f) { var f3 = f * f * f; return f3 > EPS ? f3 : (116 * f - 16) / KAPPA; }

  // Lab colours outside sRGB are clipped per channel, as the picker fields and swatches can only show sRGB.
  function labToRgbInto(L, a, b, out) {
    var fy = (L + 16) / 116;
    var x = labInv(fy + a / 500) * WHITE[0], y = L > KAPPA * EPS ? fy * fy * fy : L / KAPPA, z = labInv(fy - b / 200) * WHITE[2];
    out[0] = clamp(fromLinear(MI[0][0] * x + MI[0][1] * y + MI[0][2] * z), 0, 255);
    out[1] = clamp(fromLinear(MI[1][0] * x + MI[1][1] * y + MI[1][2] * z), 0, 255);
    out[2] = clamp(fromLinear(MI[2][0] * x + MI[2][1] * y + MI[2][2] * z), 0, 255);
    return out;
  }

  function labToRgb(L, a, b) { return labToRgbInto(L, a, b, [0, 0, 0]); }

  function deltaE(lab1, lab2) {
    var dl = lab1[0] - lab2[0], da = lab1[1] - lab2[1], db = lab1[2] - lab2[2];
    return Math.sqrt(dl * dl + da * da + db * db);
  }

  global.ColorMath = {
    clamp: clamp, hsbToRgb: hsbToRgb, hsbToRgbInto: hsbToRgbInto, labToRgbInto: labToRgbInto, rgbToHsb: rgbToHsb, rgbToHex: rgbToHex, hexToRgb: hexToRgb,
    rgbToLab: rgbToLab, labToRgb: labToRgb, deltaE: deltaE
  };
}(window));
