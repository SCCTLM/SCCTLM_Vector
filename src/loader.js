// Fixed shell boot: apply a staged update, load the app, roll back if it never reports ready.
(function () {
  'use strict';

  var READY_TIMEOUT_MS = 15000;
  var frame = document.getElementById('app');

  function localPath(href) {
    var p = decodeURIComponent(href.replace(/^file:\/\/\/?/, '').replace(/[?#].*$/, ''));
    if (!/^[A-Za-z]:/.test(p)) p = '/' + p;
    return p;
  }

  function boot() {
    var core, path, os, extDir, dataDir;
    try {
      path = require('path'); os = require('os');
      extDir = path.dirname(localPath(window.location.href));
      core = require(path.join(extDir, 'loader-core.js'));
      dataDir = path.join(process.platform === 'win32'
        ? (process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'))
        : path.join(os.homedir(), 'Library', 'Application Support'), 'ilus-batch-export');
    } catch (e) {
      frame.src = 'app/index.html'; // Node unavailable: run without update support
      return;
    }

    try {
      core.applyPending(extDir, dataDir);
      core.checkBootHealth(extDir, dataDir);
    } catch (e) { /* never block the panel on update bookkeeping */ }

    // Only a just-applied update is on probation; a slow launch of a confirmed app is never undone.
    var timer = null;
    try {
      if (core.hasPending(dataDir)) {
        timer = setTimeout(function () {
          try {
            if (core.rollback(extDir, dataDir).rolledBack) frame.src = 'app/index.html?rolledback=1';
          } catch (e) { /* leave the current app loaded */ }
        }, READY_TIMEOUT_MS);
      }
    } catch (e) { /* no probation timer */ }

    window.addEventListener('message', function (ev) {
      if (ev.source !== frame.contentWindow || !ev.data || ev.data.type !== 'ilus-ready') return;
      if (timer) clearTimeout(timer);
      try { core.markHealthy(dataDir); } catch (e) { /* ignore */ }
    });

    frame.src = 'app/index.html';
  }

  boot();
}());
