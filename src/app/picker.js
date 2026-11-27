// Colour picker window: classic picker layout with a live CMYK gamut mask.
// CMYK numbers in a CMYK document come from Illustrator itself (Bridge.colorConvert), so they are exactly what
// OK applies; the ICC engine only draws the grey mask, the warning triangle and the nearest printable colour.
// In an RGB document the CMYK fields show the engine's numbers for the profile chosen in the footer.
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var CM = ColorMath, CF = ColorField, CG = ColorGamut;
  var REFRESH_EVENT = 'vn.scctlm.picker.refresh';
  var RESULT_EVENT = 'vn.scctlm.picker.result';
  var CLOSE_EVENT = 'vn.scctlm.close';
  var PICK_REQUEST_KEY = 'scctlm.picker.request';
  var PICK_REQUEST_FILE = 'picker-request.json';
  var DEFAULT_RGB_DOC_PROFILE = /FOGRA39/i;
  var hasNode = typeof require === 'function' && typeof process === 'object';
  var fs = hasNode ? require('fs') : null;
  var path = hasNode ? require('path') : null;
  var loadSeq = 0;

  var state = {
    mode: 'hsb-h',
    hsb: [0, 0, 100], rgb: [255, 255, 255], lab: [100, 0, 0],
    cmyk: null,        // CMYK shown in the fields
    typedCmyk: null,   // CMYK the user typed (or the selection had); applied as is
    current: [255, 255, 255], currentCmyk: null,
    ctx: { hasDoc: false, isCmyk: false, fillActive: true },
    profiles: null, gamut: null, gamutName: '', gamutOn: true,
    pickRequest: null  // When set: return-color mode for panel controls (Offset Lab / Logo Lab)
  };
  var settings = { gamutOn: true, mode: 'hsb-h', rgbDocProfile: '' };

  // ---------- settings (per-user data dir, next to presets.json) ----------
  function settingsFile() { return path.join(Presets.dataDir(), 'color-picker.json'); }
  function loadSettings() {
    if (!hasNode) return;
    try {
      var raw = JSON.parse(fs.readFileSync(settingsFile(), 'utf8'));
      if (typeof raw.gamutOn === 'boolean') settings.gamutOn = raw.gamutOn;
      if (CF.MODES[raw.mode]) settings.mode = raw.mode;
      if (typeof raw.rgbDocProfile === 'string') settings.rgbDocProfile = raw.rgbDocProfile;
    } catch (e) { /* first run or unreadable: defaults */ }
  }
  function saveSettings() {
    if (!hasNode) return;
    try {
      var target = settingsFile();
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target + '.tmp', JSON.stringify(settings, null, 2), 'utf8');
      fs.renameSync(target + '.tmp', target);
    } catch (e) { /* settings are a convenience; never block the picker */ }
  }

  function status(text, isError) {
    var el = $('pk-status');
    el.textContent = text || '';
    el.title = text || '';
    el.classList.toggle('err', !!isError);
  }

  // ---------- colour state ----------
  function clampAll(group, v) {
    return v.map(function (x, i) { var r = CF.RANGES[group][i]; return CM.clamp(Number(x) || 0, r[0], r[1]); });
  }

  // HSB from RGB, keeping hue for greys and saturation for black so dragging through them does not jump.
  function hsbFromRgb(rgb) {
    var hsb = CM.rgbToHsb(rgb[0], rgb[1], rgb[2], state.hsb[0]);
    if (hsb[2] === 0) hsb[1] = state.hsb[1];
    return hsb;
  }

  // group: 'hsb' | 'rgb' | 'lab'. opts.cmyk: CMYK to show and apply as is (typed or from the selection).
  function setColor(group, values, opts) {
    opts = opts || {};
    var v = clampAll(group, values);
    if (group === 'hsb') { state.hsb = v; state.rgb = CM.hsbToRgb(v[0], v[1], v[2]); }
    else if (group === 'lab') { state.lab = v; state.rgb = CM.labToRgb(v[0], v[1], v[2]); state.hsb = hsbFromRgb(state.rgb); }
    else { state.rgb = v; state.hsb = hsbFromRgb(v); }
    if (group !== 'lab') state.lab = CM.rgbToLab(state.rgb[0], state.rgb[1], state.rgb[2]);
    state.typedCmyk = opts.cmyk ? opts.cmyk.slice() : null;
    if (opts.cmyk) state.cmyk = opts.cmyk.slice();
    else updateCmyk();
    render();
  }

  // ---------- CMYK numbers ----------
  var cmykBusy = false, cmykAgain = false;
  function updateCmyk() {
    if (state.ctx.isCmyk && Bridge.available) { requestIllustratorCmyk(); return; }
    state.cmyk = state.gamut ? state.gamut.toCmyk(state.rgb) : null;
  }
  // One conversion in flight; the newest colour is converted when it returns.
  function requestIllustratorCmyk() {
    if (cmykBusy) { cmykAgain = true; return; }
    cmykBusy = true; cmykAgain = false;
    var rgb = state.rgb.slice();
    Bridge.colorConvert({ rgb: rgb }).then(function (res) {
      if (res.ok && !state.typedCmyk && same(rgb, state.rgb)) { state.cmyk = res.cmyk; render(); }
    }).catch(function () { /* keep the previous numbers */ }).then(function () {
      cmykBusy = false;
      if (cmykAgain) requestIllustratorCmyk();
    });
  }
  function same(a, b) { return a[0] === b[0] && a[1] === b[1] && a[2] === b[2]; }

  function setTypedCmyk(cmyk) {
    cmyk = cmyk.map(function (x) { return CM.clamp(Number(x) || 0, 0, 100); });
    if (state.ctx.isCmyk && Bridge.available) {
      Bridge.colorConvert({ cmyk: cmyk }).then(function (res) {
        if (res.ok) setColor('rgb', res.rgb, { cmyk: cmyk });
      }).catch(function (e) { status(e.message, true); });
    } else if (state.gamut) {
      setColor('rgb', state.gamut.cmykToRgb(cmyk), { cmyk: cmyk });
    }
  }

  // ---------- drawing ----------
  var fieldCtx = $('field').getContext('2d'), sliderCtx = $('slider').getContext('2d');
  var fieldImg = fieldCtx.createImageData(256, 256), sliderImg = sliderCtx.createImageData(20, 256);
  var fieldKey = '', sliderKey = '', frame = 0;
  // While a drag is in progress the field is drawn at half resolution and scaled up (a full 256x256 field
  // costs ~20 ms in Illustrator's Chromium, a 128x128 one a quarter of that); the full field follows on release.
  var DRAFT = 128, draftCanvas = document.createElement('canvas');
  draftCanvas.width = draftCanvas.height = DRAFT;
  var draftCtx = draftCanvas.getContext('2d'), draftImg = draftCtx.createImageData(DRAFT, DRAFT);
  var dragging = false, fieldIsDraft = false;

  function gamutMask() {
    var g = state.gamut;
    if (!g || g.isRgb || !state.gamutOn) return null;
    return function (r, gg, b) { return g.maskDeltaE(r, gg, b) > CG.THRESHOLD; };
  }

  function render() { if (!frame) frame = requestAnimationFrame(draw); }

  function css(rgb) { return 'rgb(' + rgb.map(Math.round).join(',') + ')'; }

  function draw() {
    frame = 0;
    var m = CF.MODES[state.mode], v = state[m.group];
    var fk = state.mode + '|' + v[m.slider] + '|' + (state.gamutOn ? state.gamutName : '');
    if (fk !== fieldKey && dragging) {
      fieldKey = fk;
      fieldIsDraft = true;
      CF.renderField(state.mode, v, DRAFT, DRAFT, draftImg.data, gamutMask());
      draftCtx.putImageData(draftImg, 0, 0);
      fieldCtx.imageSmoothingEnabled = true;
      fieldCtx.drawImage(draftCanvas, 0, 0, 256, 256);
    } else if (fk !== fieldKey || (fieldIsDraft && !dragging)) {
      fieldKey = fk;
      fieldIsDraft = false;
      CF.renderField(state.mode, v, 256, 256, fieldImg.data, gamutMask());
      fieldCtx.putImageData(fieldImg, 0, 0);
    }
    var sk = state.mode + '|' + (state.mode === 'hsb-h' ? '' : v[m.x] + '|' + v[m.y]);
    if (sk !== sliderKey) {
      sliderKey = sk;
      CF.renderSlider(state.mode, v, 20, 256, sliderImg.data);
      sliderCtx.putImageData(sliderImg, 0, 0);
    }
    var p = CF.position(state.mode, v);
    // 1px border, then the centre of pixel 0..255.
    $('ring').style.left = (1.5 + p.x * 255) + 'px';
    $('ring').style.top = (1.5 + p.y * 255) + 'px';
    $('arrows').style.top = (1.5 + p.s * 255) + 'px';

    $('sw-new').style.background = css(state.rgb);
    $('sw-cur').style.background = css(state.current);

    var out = !!state.gamut && state.gamut.isOutOfGamut(state.rgb);
    $('warn').hidden = !out;
    if (out) $('warn-sw').style.background = css(state.gamut.nearestInGamut(state.rgb));

    writeFields();
  }

  function writeFields() {
    var focused = document.activeElement;
    function put(id, value) { var el = $(id); if (el !== focused) el.value = value; }
    var r = Math.round;
    for (var i = 0; i < 3; i++) {
      put('f-hsb-' + i, r(state.hsb[i]));
      put('f-rgb-' + i, r(state.rgb[i]));
      put('f-lab-' + i, r(state.lab[i]));
    }
    for (var k = 0; k < 4; k++) put('f-cmyk-' + k, state.cmyk ? r(state.cmyk[k]) : '');
    put('f-hex', CM.rgbToHex(state.rgb));
  }

  // ---------- input ----------
  function drag(box, canvas, onMove) {
    // Pixel centres of the drawn image (inside the 1px border) map to 0..1, the same grid the renderer uses.
    function move(e) {
      var r = canvas.getBoundingClientRect();
      onMove((e.clientX - r.left - canvas.clientLeft - 0.5) / (canvas.clientWidth - 1),
        (e.clientY - r.top - canvas.clientTop - 0.5) / (canvas.clientHeight - 1));
    }
    box.addEventListener('pointerdown', function (e) {
      if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
      box.setPointerCapture(e.pointerId);
      box.onpointermove = move;
      dragging = true;
      move(e);
    });
    function end() { box.onpointermove = null; dragging = false; render(); }
    box.addEventListener('pointerup', end);
    box.addEventListener('lostpointercapture', end);
  }

  function onFieldInput(el) {
    var group = el.dataset.group, ch = Number(el.dataset.ch), n = parseFloat(el.value);
    if (isNaN(n)) return;
    if (group === 'cmyk') {
      var c = (state.cmyk || [0, 0, 0, 0]).slice();
      c[ch] = n;
      setTypedCmyk(c);
      return;
    }
    var v = state[group].slice();
    v[ch] = n;
    setColor(group, v);
  }

  function bindFields() {
    Array.prototype.forEach.call(document.querySelectorAll('.pk-f input:not([type])'), function (el) {
      el.addEventListener('input', function () { onFieldInput(el); });
      el.addEventListener('blur', render);
      el.addEventListener('keydown', function (e) {
        if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
        e.preventDefault();
        el.value = (parseFloat(el.value) || 0) + (e.key === 'ArrowUp' ? 1 : -1) * (e.shiftKey ? 10 : 1);
        onFieldInput(el);
      });
    });
    $('f-hex').addEventListener('input', function () {
      var rgb = CM.hexToRgb(this.value);
      if (rgb && this.value.replace('#', '').length === 6) setColor('rgb', rgb);
    });
    $('f-hex').addEventListener('blur', render);
  }

  function setMode(id) {
    state.mode = id;
    settings.mode = id;
    var radio = document.querySelector('input[name=mode][value="' + id + '"]');
    if (radio) radio.checked = true;
    saveSettings();
    render();
  }

  // ---------- gamut profile ----------
  var engine = null;
  function appDir() {
    var dir = decodeURIComponent(location.href.replace(/[?#].*$/, '').replace(/[^\/]*$/, '').replace(/^file:\/\/\/?/, ''));
    return /^[A-Za-z]:/.test(dir) ? dir : '/' + dir;
  }
  function loadEngine() {
    if (!engine) engine = require(path.join(appDir(), 'lib', 'jscolorengine', 'src', 'main.js'));
    return engine;
  }
  // Installed profiles win over the ones shipped in profiles/ (first file per name is kept).
  function profileFolders() {
    return CG.profileDirs(process.platform, process.env).concat(path.join(appDir(), 'profiles'));
  }

  function fillProfileSelect(names, selected, locked) {
    var sel = $('profile');
    sel.innerHTML = '';
    names.forEach(function (n) {
      var o = document.createElement('option');
      o.value = o.textContent = n;
      sel.appendChild(o);
    });
    sel.value = selected;
    sel.disabled = locked;
  }

  // CMYK documents default to their own profile; RGB documents and return-color mode use the chosen profile (including sRGB).
  function setupGamut() {
    var rgbName = CG.RGB_PROFILE_NAME;
    if (!hasNode) {
      fillProfileSelect([rgbName], rgbName, false);
      useProfile(rgbName);
      return;
    }
    try {
      if (!state.profiles) state.profiles = CG.listCmykProfiles(profileFolders());
    } catch (e) { state.profiles = []; }
    var cmykNames = state.profiles.map(function (p) { return p.name; });
    var allNames = [rgbName].concat(cmykNames);
    var want;
    if (state.ctx.isCmyk && !state.pickRequest) {
      want = state.ctx.profileName;
      var cmykList = want ? [rgbName, want] : [rgbName];
      if (!want) {
        fillProfileSelect(cmykList, rgbName, false);
        useProfile('', 'Tài liệu CMYK chưa gắn profile: không kiểm tra được gamut');
        return;
      }
      fillProfileSelect(cmykList, want, false);
    } else {
      want = settings.rgbDocProfile;
      if (!CG.isRgbProfile(want) && !CG.findProfile(state.profiles, want)) {
        var def = state.profiles.filter(function (p) { return DEFAULT_RGB_DOC_PROFILE.test(p.name); })[0] || state.profiles[0];
        want = def ? def.name : rgbName;
      }
      fillProfileSelect(allNames, want, false);
    }
    useProfile(want);
  }

  function useProfile(name, missingText) {
    if (CG.isRgbProfile(name)) {
      state.gamut = CG.createRgb();
      state.gamutName = name;
      status('Không gian màu RGB (sRGB)');
      if (!state.typedCmyk) updateCmyk();
      fieldKey = '';
      render();
      return;
    }
    var p = CG.findProfile(state.profiles || [], name);
    if (!p) {
      state.gamut = null; state.gamutName = '';
      status(name ? 'Không tìm thấy ICC profile “' + name + '” trên máy: không kiểm tra được gamut' : (missingText || 'Không có profile CMYK'), true);
    } else if (p.name !== state.gamutName) {
      try {
        var g = CG.create(loadEngine(), fs.readFileSync(p.path));
        g.warmUp();
        state.gamut = g; state.gamutName = p.name;
        status('Gamut theo: ' + p.name);
      } catch (e) {
        state.gamut = null; state.gamutName = '';
        status('Không đọc được profile ' + p.name + ': ' + e.message, true);
      }
    }
    if (!state.typedCmyk) updateCmyk();
    fieldKey = '';
    render();
  }

  // ---------- return-color mode (panel controls: Offset Lab / Logo Lab) ----------
  function pickRequestFile() {
    if (!hasNode || typeof Presets === 'undefined' || !Presets || typeof Presets.dataDir !== 'function') return '';
    var dir = Presets.dataDir();
    return dir ? path.join(dir, PICK_REQUEST_FILE) : '';
  }

  function parsePickRequest(raw) {
    if (!raw) return null;
    try {
      var data = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (data && typeof data.target === 'string' && data.target) {
        return {
          requestId: data.requestId ? String(data.requestId) : '',
          target: data.target,
          hex: typeof data.hex === 'string' ? data.hex : ''
        };
      }
    } catch (e) { /* ignore malformed payload */ }
    return null;
  }

  function readStoredPickRequest() {
    try {
      var f = pickRequestFile();
      if (f && fs.existsSync(f)) {
        var fromFile = parsePickRequest(fs.readFileSync(f, 'utf8'));
        if (fromFile) return fromFile;
      }
    } catch (e) { /* fs unavailable or unreadable */ }
    try {
      if (typeof localStorage !== 'undefined') {
        return parsePickRequest(localStorage.getItem(PICK_REQUEST_KEY));
      }
    } catch (e) { /* storage unavailable */ }
    return null;
  }

  function clearPickRequest() {
    state.pickRequest = null;
    try {
      var f = pickRequestFile();
      if (f && fs.existsSync(f)) fs.unlinkSync(f);
    } catch (e) { /* ignore */ }
    try {
      if (typeof localStorage !== 'undefined') localStorage.removeItem(PICK_REQUEST_KEY);
    } catch (e) { /* ignore */ }
  }

  // ---------- Illustrator ----------
  function loadContext(eventData) {
    var seq = ++loadSeq;
    var req = eventData === '' ? null : (parsePickRequest(eventData) || readStoredPickRequest());
    state.pickRequest = req;

    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();

    var targetEl = $('target');
    if (req) {
      if (targetEl) { targetEl.hidden = true; targetEl.disabled = true; }
      var rgb = CM.hexToRgb(req.hex) || [255, 255, 255];
      state.current = rgb.slice();
      state.currentCmyk = null;
      $('ok').disabled = false;
      status('');
      fieldKey = '';
      sliderKey = '';
      setColor('rgb', rgb);
      if (Bridge.available) {
        return Bridge.colorContext().then(function (ctx) {
          if (seq !== loadSeq || !state.pickRequest) return;
          if (ctx && ctx.ok) state.ctx = ctx;
          setTimeout(setupGamut, 30);
        }).catch(function () {
          if (seq !== loadSeq || !state.pickRequest) return;
          setTimeout(setupGamut, 30);
        });
      }
      setTimeout(setupGamut, 30);
      return Promise.resolve();
    }

    if (targetEl) { targetEl.hidden = false; targetEl.disabled = false; }
    if (!Bridge.available) { setupGamut(); return Promise.resolve(); }
    return Bridge.colorContext().then(function (ctx) {
      if (seq !== loadSeq || state.pickRequest) return;
      if (!ctx.ok) throw new Error(ctx.error);
      state.ctx = ctx;
      state.current = ctx.rgb.slice();
      state.currentCmyk = ctx.cmyk ? ctx.cmyk.slice() : null;
      $('target').value = ctx.fillActive ? 'fill' : 'stroke';
      $('ok').disabled = !ctx.hasDoc;
      fieldKey = '';
      sliderKey = '';
      setColor('rgb', ctx.rgb, { cmyk: ctx.cmyk });
      // Profile scan and table build take a few hundred ms: after the first paint.
      setTimeout(setupGamut, 30);
      if (!ctx.hasDoc) status('Chưa mở tài liệu nào: chỉ xem màu', true);
    }).catch(function (e) {
      if (seq !== loadSeq || state.pickRequest) return;
      status(e.message, true);
    });
  }

  function close() {
    clearPickRequest();
    if (Bridge.cs) Bridge.cs.closeExtension();
    else window.close();
  }

  function apply() {
    if (state.pickRequest) {
      var req = state.pickRequest;
      var hex = '#' + CM.rgbToHex(state.rgb).toUpperCase();
      if (Bridge.cs && typeof CSEvent === 'function') {
        var ev = new CSEvent(RESULT_EVENT, 'APPLICATION');
        ev.data = JSON.stringify({ requestId: req.requestId, target: req.target, hex: hex });
        Bridge.cs.dispatchEvent(ev);
      }
      close();
      return;
    }
    $('ok').disabled = true;
    Bridge.colorApply({ rgb: state.rgb, cmyk: state.typedCmyk, fill: $('target').value === 'fill' }).then(function (res) {
      if (res.ok) { close(); return; }
      status(res.error || 'Không tô được màu', true);
      $('ok').disabled = false;
    }).catch(function (e) { status(e.message, true); $('ok').disabled = false; });
  }

  // ---------- start ----------
  function start() {
    Theme.watch();
    loadSettings();
    state.gamutOn = settings.gamutOn;
    $('gamut-on').checked = settings.gamutOn;
    setMode(settings.mode);
    bindFields();

    drag($('field-box'), $('field'), function (x, y) {
      var m = CF.MODES[state.mode];
      setColor(m.group, CF.atField(state.mode, state[m.group], x, y));
    });
    drag($('slider-box'), $('slider'), function (x, y) {
      var m = CF.MODES[state.mode];
      setColor(m.group, CF.atSlider(state.mode, state[m.group], y));
    });

    document.addEventListener('change', function (e) {
      if (e.target.name === 'mode') setMode(e.target.value);
    });
    $('gamut-on').onchange = function () {
      state.gamutOn = settings.gamutOn = this.checked;
      saveSettings();
      render();
    };
    $('profile').onchange = function () {
      if (!state.ctx.isCmyk || state.pickRequest) {
        settings.rgbDocProfile = this.value;
        saveSettings();
      }
      useProfile(this.value);
    };
    $('warn-btn').onclick = $('warn-sw').onclick = function () {
      if (state.gamut) setColor('rgb', state.gamut.nearestInGamut(state.rgb));
    };
    $('sw-cur').onclick = function () { setColor('rgb', state.current, { cmyk: state.currentCmyk }); };
    $('ok').onclick = apply;
    $('cancel').onclick = close;
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') close();
      // Enter on a focused button or menu keeps its own meaning (Cancel stays Cancel).
      else if (e.key === 'Enter' && !/^(SELECT|BUTTON)$/.test(e.target.tagName) && !$('ok').disabled) apply();
    });

    if (Bridge.cs) {
      Bridge.cs.addEventListener(REFRESH_EVENT, function (ev) { loadContext(ev ? ev.data : ''); });
      Bridge.cs.addEventListener(CLOSE_EVENT, close);
    }
    if (typeof window !== 'undefined' && window.addEventListener) {
      window.addEventListener('beforeunload', clearPickRequest);
    }
    loadContext();
    if (!state.pickRequest) setColor('rgb', state.rgb);
  }

  start();
}());
