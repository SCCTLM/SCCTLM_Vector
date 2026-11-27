// Header button, Artboard tab button, and return-color launcher for Offset Lab & Logo Lab.
// Opens the custom SCCTLM Vector CMYK colour picker window (vn.scctlm.vector.picker),
// or reloads it when already open.
(function (global) {
  'use strict';

  var PICKER_ID = 'vn.scctlm.vector.picker';
  var REFRESH_EVENT = 'vn.scctlm.picker.refresh';
  var RESULT_EVENT = 'vn.scctlm.picker.result';
  var PICK_REQUEST_KEY = 'scctlm.picker.request';

  var seq = 0;
  var activeRequest = null;

  function hasCep() {
    return !!(typeof Bridge !== 'undefined' && Bridge && Bridge.cs);
  }

  function clearStoredRequest() {
    try {
      if (typeof localStorage !== 'undefined') localStorage.removeItem(PICK_REQUEST_KEY);
    } catch (e) { /* ignore storage errors */ }
  }

  function writeStoredRequest(req) {
    try {
      if (typeof localStorage !== 'undefined') localStorage.setItem(PICK_REQUEST_KEY, JSON.stringify(req));
    } catch (e) { /* ignore storage errors */ }
  }

  function openPicker() {
    if (!hasCep()) return false;
    activeRequest = null;
    clearStoredRequest();
    Bridge.cs.requestOpenExtension(PICKER_ID, '');
    var ev = new CSEvent(REFRESH_EVENT, 'APPLICATION');
    ev.data = '';
    Bridge.cs.dispatchEvent(ev);
    return true;
  }

  function pickColor(target, hex, onResult) {
    if (!hasCep() || !target) return false;
    seq += 1;
    var req = {
      requestId: 'pick-' + Date.now() + '-' + seq,
      target: String(target),
      hex: typeof hex === 'string' && hex ? hex : '#ffffff'
    };
    activeRequest = { requestId: req.requestId, target: req.target, onResult: onResult };
    writeStoredRequest(req);
    Bridge.cs.requestOpenExtension(PICKER_ID, '');
    var ev = new CSEvent(REFRESH_EVENT, 'APPLICATION');
    ev.data = JSON.stringify(req);
    Bridge.cs.dispatchEvent(ev);
    return true;
  }

  function handleResultEvent(ev) {
    if (!ev || !ev.data) return;
    var data;
    try {
      data = typeof ev.data === 'string' ? JSON.parse(ev.data) : ev.data;
    } catch (e) {
      return;
    }
    if (!data || !data.target || !data.hex) return;
    if (!activeRequest) return;
    if (data.requestId && activeRequest.requestId && data.requestId !== activeRequest.requestId) return;
    if (data.target !== activeRequest.target) return;
    var cb = activeRequest.onResult;
    activeRequest = null;
    if (typeof cb === 'function') cb(data.hex, data);
  }

  var btn = document.getElementById('open-picker');
  var btnArtboard = document.getElementById('open-picker-artboard');

  if (!hasCep()) {
    if (btn) btn.disabled = true;
    if (btnArtboard) btnArtboard.disabled = true;
  } else {
    if (btn) btn.onclick = openPicker;
    if (btnArtboard) btnArtboard.onclick = openPicker;
    if (typeof Bridge.cs.addEventListener === 'function') {
      Bridge.cs.addEventListener(RESULT_EVENT, handleResultEvent);
    }
  }

  if (global) {
    global.ColorPickerLauncher = {
      PICKER_ID: PICKER_ID,
      REFRESH_EVENT: REFRESH_EVENT,
      RESULT_EVENT: RESULT_EVENT,
      PICK_REQUEST_KEY: PICK_REQUEST_KEY,
      available: hasCep,
      open: openPicker,
      pick: pickColor
    };
  }
}(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null)));
