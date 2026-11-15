// Footer control: reload the panel page, and with it the ExtendScript engine, after plugin code
// changes. The engine is loaded with $.evalFile when the page starts, so a reload re-runs it; the
// stamped URL makes the navigation a new document. Only the fixed loader shell stays put, so
// manifest, loader and installer changes still need a reinstall.
(function (global) {
  'use strict';

  var activeJobs = {}; // owner -> true while that panel action runs in Illustrator

  function isBusy() {
    for (var owner in activeJobs) {
      if (activeJobs.hasOwnProperty(owner)) return true;
    }
    return false;
  }

  // Registers an action that must finish before a reload. Reloading mid-job would drop its callbacks
  // (the ExtendScript side still runs), so the click is refused instead of the button being disabled:
  // a job whose promise never settles must not take the escape hatch down with it.
  function setBusy(owner, on) {
    if (on) activeJobs[owner] = true;
    else delete activeJobs[owner];
    return isBusy();
  }

  // Same file without an old query or fragment, stamped so the navigation is a new document.
  function reloadUrl(href, stamp) {
    return String(href).replace(/[?#].*$/, '') + '?r=' + stamp;
  }

  // False when an Illustrator job is still running or the navigation was refused.
  function reload(stamp) {
    if (isBusy()) return false;
    try {
      global.location.replace(reloadUrl(global.location.href, stamp || Date.now()));
      return true;
    } catch (e) {
      return false;
    }
  }

  function showStatus(text) {
    var el = document.getElementById('status');
    if (el) el.textContent = text;
  }

  global.PanelReload = { reloadUrl: reloadUrl, reload: reload, setBusy: setBusy, isBusy: isBusy };

  if (typeof document === 'undefined') return; // Node: unit tests only
  var btn = document.getElementById('reload-panel');
  if (btn) btn.onclick = function () {
    if (reload()) return;
    if (isBusy()) showStatus('Illustrator đang chạy tác vụ khác; hãy đợi xong rồi tải lại.');
    else showStatus('Không tải lại được panel; hãy đóng và mở lại panel.');
  };
}(window));
