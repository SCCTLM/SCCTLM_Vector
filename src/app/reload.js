// Footer control: reload the panel page, and with it the ExtendScript engine, after plugin code
// changes. The engine is loaded with $.evalFile when the page starts, so a reload re-reads every
// app file; the query stamp makes CEF treat it as a new document. Only the fixed loader shell stays
// put, so manifest, loader and installer changes still need a reinstall.
(function (global) {
  'use strict';

  // Same file without an old query or fragment, stamped so the document is not served from a cache.
  function reloadUrl(href, stamp) {
    return String(href).replace(/[?#].*$/, '') + '?r=' + stamp;
  }

  function reload(stamp) {
    global.location.replace(reloadUrl(global.location.href, stamp || Date.now()));
  }

  global.PanelReload = { reloadUrl: reloadUrl, reload: reload };

  if (typeof document === 'undefined') return; // Node: unit tests only
  var btn = document.getElementById('reload-panel');
  if (btn) btn.onclick = function () { reload(); };
}(window));
