// Grid tab: element toggles and styles, gridline and circle options, Generate / Generate all / Clear.
// Settings are saved on every change; the status line is shared with the other tabs.
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var LABELS = { anchors: 'Anchors', handles: 'Handles', outlines: 'Outlines', gridlines: 'Gridlines', circles: 'Circles' };
  var STYLE_LABELS = { size: 'Size', fill: 'Fill', stroke: 'Stroke', strokeWidth: 'Stroke width' };
  // Above this many anchors plus circles the run can freeze Illustrator for a while, so the panel asks first.
  var CONFIRM_ITEMS = 2000;

  var settings = GridSettings.load();
  // Last saved settings: an emptied number field falls back to these instead of the minimum.
  var saved = GridSettings.normalize(settings);
  var running = false;
  var pending = null;

  function status(text) { $('status').textContent = text; }

  function save() {
    settings = GridSettings.normalize(settings, saved);
    saved = GridSettings.normalize(settings);
    try { GridSettings.save(settings); } catch (e) { status('Could not save grid settings: ' + e.message); }
  }

  // One row per element: toggle, then a collapsible style block built from that element's style keys.
  function buildElements() {
    var host = $('grid-elements');
    host.innerHTML = '';
    GridSettings.ELEMENTS.forEach(function (key) {
      var wrap = document.createElement('div');
      wrap.className = 'grid-el';
      var row = document.createElement('div');
      row.className = 'row';
      var pill = document.createElement('label');
      pill.className = 'pill';
      pill.innerHTML = '<input type="checkbox"><span></span>';
      pill.querySelector('span').textContent = LABELS[key];
      var toggle = pill.querySelector('input');
      toggle.checked = settings.elements[key];
      toggle.onchange = function () { settings.elements[key] = toggle.checked; save(); };
      var details = document.createElement('details');
      details.innerHTML = '<summary>Style</summary><div class="grid-style"></div>';
      var grid = details.querySelector('.grid-style');
      Object.keys(settings.style[key]).forEach(function (prop) { addStyleControl(grid, key, prop); });
      row.appendChild(pill);
      row.appendChild(details);
      wrap.appendChild(row);
      host.appendChild(wrap);
    });
  }

  function addStyleControl(grid, key, prop) {
    var label = document.createElement('span');
    label.className = 'muted';
    label.textContent = STYLE_LABELS[prop];
    var cell = document.createElement('label');
    var value = settings.style[key][prop];
    if (prop === 'size' || prop === 'strokeWidth') {
      var input = document.createElement('input');
      input.type = 'number';
      input.min = prop === 'size' ? '0.5' : '0.05';
      input.step = prop === 'size' ? '0.5' : '0.05';
      input.value = value;
      input.onchange = function () { settings.style[key][prop] = input.value; save(); input.value = settings.style[key][prop]; };
      cell.appendChild(input);
      cell.appendChild(document.createTextNode(' pt'));
    } else {
      var picker = document.createElement('input');
      picker.type = 'color';
      var none = document.createElement('input');
      none.type = 'checkbox';
      var sync = function () { picker.disabled = none.checked; };
      none.checked = value === 'none';
      picker.value = value === 'none' ? '#000000' : value;
      sync();
      var update = function () { settings.style[key][prop] = none.checked ? 'none' : picker.value; sync(); save(); };
      picker.onchange = update;
      none.onchange = update;
      cell.appendChild(picker);
      cell.appendChild(none);
      cell.appendChild(document.createTextNode('None'));
    }
    grid.appendChild(label);
    grid.appendChild(cell);
  }

  function showOptions() {
    $('grid-sensitivity').value = settings.gridlines.sensitivity;
    $('grid-margin').value = settings.gridlines.margin;
    $('grid-complexity').value = settings.circles.complexity;
    $('grid-n').value = settings.circles.n;
    $('grid-n').disabled = settings.circles.mode === 'all';
    Array.prototype.forEach.call($('grid-cmode').querySelectorAll('[data-cmode]'), function (b) {
      b.classList.toggle('on', b.dataset.cmode === settings.circles.mode);
    });
  }

  function bindOptions() {
    $('grid-sensitivity').onchange = function () { settings.gridlines.sensitivity = Number(this.value); save(); };
    $('grid-margin').onchange = function () { settings.gridlines.margin = this.value; save(); showOptions(); };
    $('grid-complexity').onchange = function () { settings.circles.complexity = Number(this.value); save(); };
    $('grid-n').onchange = function () { settings.circles.n = this.value; save(); showOptions(); };
    $('grid-cmode').onclick = function (e) {
      var mode = e.target.dataset && e.target.dataset.cmode;
      if (!mode) return;
      settings.circles.mode = mode;
      save();
      showOptions();
    };
  }

  function setRunning(on) {
    running = on;
    ['grid-generate', 'grid-generate-all', 'grid-clear'].forEach(function (id) { $(id).disabled = on; });
    $('grid-generate').textContent = on ? 'Working…' : 'Generate';
  }

  function hideConfirm() { pending = null; $('grid-confirm').hidden = true; }

  function skippedNote(skipped) {
    var parts = [];
    if (skipped && skipped.text) parts.push(skipped.text + ' text (outline it first)');
    if (skipped && skipped.raster) parts.push(skipped.raster + ' image');
    if (skipped && skipped.other) parts.push(skipped.other + ' other');
    return parts.length ? ' Skipped: ' + parts.join(', ') + '.' : '';
  }

  function summary(counts) {
    var parts = [];
    GridSettings.ELEMENTS.forEach(function (k) { if (counts[k]) parts.push(counts[k] + ' ' + LABELS[k].toLowerCase()); });
    return parts.length ? 'Grid drawn: ' + parts.join(', ') + '.' : 'Nothing to draw for the chosen elements.';
  }

  // Generate all draws every element for this run only; the saved toggles stay as they are.
  function jobFor(everything) {
    var elements = {};
    GridSettings.ELEMENTS.forEach(function (k) { elements[k] = everything || settings.elements[k]; });
    return { elements: elements, style: settings.style, gridlines: settings.gridlines, circles: settings.circles };
  }

  function draw(job) {
    setRunning(true);
    status('Drawing the grid…');
    Bridge.gridGenerate(job).then(function (res) {
      status(res.ok ? summary(res.counts) + skippedNote(res.skipped) : res.error + skippedNote(res.skipped));
    }).catch(function (e) {
      status('Grid failed: ' + e.message);
    }).then(function () { setRunning(false); });
  }

  function generate(everything) {
    if (running) return;
    hideConfirm();
    var job = jobFor(everything);
    var any = GridSettings.ELEMENTS.some(function (k) { return job.elements[k]; });
    if (!any) { status('Turn on at least one element to draw.'); return; }
    setRunning(true);
    Bridge.gridInspect(job).then(function (info) {
      setRunning(false);
      if (!info.ok) { status(info.error); return; }
      if (!info.paths) { status('Select vector paths first (outline any text).' + skippedNote(info.skipped)); return; }
      if (info.anchors + (info.circles || 0) > CONFIRM_ITEMS) {
        pending = job;
        $('grid-confirm-text').textContent = info.anchors + ' anchor points' + (info.circles ? ' and ' + info.circles + ' circles' : '') +
          ' to draw. Illustrator may stop responding for a while.';
        $('grid-confirm').hidden = false;
        return;
      }
      draw(job);
    }).catch(function (e) {
      setRunning(false);
      status('Grid failed: ' + e.message);
    });
  }

  function clear() {
    if (running) return;
    hideConfirm();
    setRunning(true);
    Bridge.gridClear().then(function (res) {
      status(!res.ok ? res.error : res.removed ? 'Grid removed.' : 'No grid layer in this document.');
    }).catch(function (e) {
      status('Clear failed: ' + e.message);
    }).then(function () { setRunning(false); });
  }

  function init() {
    buildElements();
    showOptions();
    bindOptions();
    $('grid-generate').onclick = function () { generate(false); };
    $('grid-generate-all').onclick = function () { generate(true); };
    $('grid-clear').onclick = clear;
    $('grid-confirm-ok').onclick = function () { var job = pending; hideConfirm(); if (job) draw(job); };
    $('grid-confirm-cancel').onclick = function () { hideConfirm(); status('Cancelled.'); };
    document.addEventListener('tab-changed', function (e) { if (e.detail !== 'grid') hideConfirm(); });
  }

  init();
}());
