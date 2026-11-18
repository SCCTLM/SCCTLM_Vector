// Grid tab settings: JSON file next to presets.json in the per-user data dir, so updates keep it.
(function (global) {
  'use strict';

  var fs = require('fs');
  var path = require('path');

  var ELEMENTS = ['anchors', 'handles', 'outlines', 'gridlines', 'circles'];
  var CIRCLE_MODES = ['all', 'first', 'longest'];
  var HEX = /^#[0-9a-f]{6}$/i;

  // Mirrors the engine defaults in grid-engine.jsx; sizes and widths are points.
  var DEFAULTS = {
    elements: { anchors: true, handles: false, outlines: false, gridlines: false, circles: false },
    style: {
      anchors: { size: 10, fill: '#378ef0', stroke: '#ffffff', strokeWidth: 4 },
      handles: { size: 20, fill: '#378ef0', stroke: 'none', strokeWidth: 1 },
      outlines: { fill: 'none', stroke: '#ff2d55', strokeWidth: 0.5 },
      gridlines: { stroke: '#8e8e93', strokeWidth: 4 },
      circles: { fill: 'none', stroke: '#ff9500', strokeWidth: 4 }
    },
    gridlines: { sensitivity: 50, margin: 20 },
    circles: { complexity: 30, mode: 'all', n: 2 }
  };

  function filePath() { return path.join(global.Presets.dataDir(), 'grid-settings.json'); }

  function clone(v) { return JSON.parse(JSON.stringify(v)); }

  function num(v, min, max, fallback) {
    var n = Number(v);
    if (v === null || v === undefined || (typeof v === 'string' && v.trim() === '') || isNaN(n)) return fallback;
    return Math.max(min, Math.min(max, n));
  }

  function color(v, fallback) {
    return v === 'none' || (typeof v === 'string' && HEX.test(v)) ? v.toLowerCase() : fallback;
  }

  // Any stored or UI shape becomes a complete, valid settings object; never throws. Missing or empty values
  // fall back to `previous` (the last saved settings) when given, otherwise to the defaults.
  function normalize(raw, previous) {
    var s = raw && typeof raw === 'object' ? raw : {};
    var out = previous ? normalize(previous) : clone(DEFAULTS);
    var el = s.elements || {};
    ELEMENTS.forEach(function (k) { if (typeof el[k] === 'boolean') out.elements[k] = el[k]; });
    var style = s.style || {};
    ELEMENTS.forEach(function (k) {
      var given = style[k] || {};
      var base = out.style[k];
      Object.keys(base).forEach(function (p) {
        if (p === 'size') base.size = num(given.size, 0.5, 100, base.size);
        else if (p === 'strokeWidth') base.strokeWidth = num(given.strokeWidth, 0.05, 20, base.strokeWidth);
        else base[p] = color(given[p], base[p]);
      });
    });
    var g = s.gridlines || {};
    out.gridlines.sensitivity = Math.round(num(g.sensitivity, 0, 100, out.gridlines.sensitivity));
    out.gridlines.margin = num(g.margin, 0, 10000, out.gridlines.margin);
    var c = s.circles || {};
    out.circles.complexity = Math.round(num(c.complexity, 0, 100, out.circles.complexity));
    out.circles.mode = CIRCLE_MODES.indexOf(c.mode) >= 0 ? c.mode : out.circles.mode;
    out.circles.n = Math.round(num(c.n, 1, 99, out.circles.n));
    return out;
  }

  function load() {
    try { return normalize(JSON.parse(fs.readFileSync(filePath(), 'utf8'))); } catch (e) { return clone(DEFAULTS); }
  }

  // Atomic write, same as presets.json.
  function save(settings) {
    var target = filePath();
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target + '.tmp', JSON.stringify(normalize(settings), null, 2), 'utf8');
    fs.renameSync(target + '.tmp', target);
  }

  global.GridSettings = { ELEMENTS: ELEMENTS, DEFAULTS: DEFAULTS, normalize: normalize, load: load, save: save };
}(window));
