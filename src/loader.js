// Fixed shell boot: apply a staged update, load the app, roll back if it never reports ready.
(function () {
  'use strict';

  var READY_TIMEOUT_MS = 15000;
  var ROLLBACK_UNLOAD_DELAY_MS = 300;
  var CLOSE_EVENT = 'vn.scctlm.close';
  var frame = document.getElementById('app');

  function localPath(href) {
    var p = decodeURIComponent(href.replace(/^file:\/\/\/?/, '').replace(/[?#].*$/, ''));
    if (!/^[A-Za-z]:/.test(p)) p = '/' + p;
    return p;
  }

  function broadcastClose() {
    try {
      if (window.__adobe_cep__ && typeof window.__adobe_cep__.dispatchEvent === 'function') {
        window.__adobe_cep__.dispatchEvent({
          type: CLOSE_EVENT,
          scope: 'APPLICATION',
          appId: '',
          extensionId: '',
          data: ''
        });
      }
    } catch (e) { /* best effort */ }
  }

  function safeRollback(core, extDir, dataDir) {
    broadcastClose();
    // Unload the iframe first so Windows/Chromium releases file handles inside app/ before renaming.
    frame.src = 'about:blank';
    setTimeout(function () {
      try {
        if (core.rollback(extDir, dataDir).rolledBack) {
          frame.src = 'app/index.html?rolledback=1';
          return;
        }
      } catch (e) { /* fall through and reload the current app */ }
      frame.src = 'app/index.html';
    }, ROLLBACK_UNLOAD_DELAY_MS);
  }

  function boot() {
    var core, fs, path, os, extDir, dataDir;
    try {
      fs = require('fs'); path = require('path'); os = require('os');
      extDir = path.dirname(localPath(window.location.href));
      core = require(path.join(extDir, 'loader-core.js'));
      dataDir = path.join(process.platform === 'win32'
        ? (process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'))
        : path.join(os.homedir(), 'Library', 'Application Support'), 'vector-batch-export');
    } catch (e) {
      frame.src = 'app/index.html'; // Node unavailable: run without update support
      return;
    }

    try {
      if (fs.existsSync(path.join(extDir, 'app.staging', '.ready'))) {
        broadcastClose();
      }
      core.applyPending(extDir, dataDir);
      core.checkBootHealth(extDir, dataDir);
    } catch (e) { /* never block the panel on update bookkeeping */ }

    // Only a just-applied update is on probation; a slow launch of a confirmed app is never undone.
    var timer = null;
    try {
      if (core.hasPending(dataDir)) {
        timer = setTimeout(function () {
          safeRollback(core, extDir, dataDir);
        }, READY_TIMEOUT_MS);
      }
    } catch (e) { /* no probation timer */ }

    window.addEventListener('message', function (ev) {
      if (ev.source !== frame.contentWindow || !ev.data || ev.data.type !== 'vector-ready') return;
      if (timer) clearTimeout(timer);
      try { core.markHealthy(dataDir); } catch (e) { /* ignore */ }
    });

    frame.src = 'app/index.html';
  }

  boot();
}());
