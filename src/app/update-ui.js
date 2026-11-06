// Update banner and startup handshake with the loader. Never installs without a click.
(function () {
  'use strict';

  var fs = require('fs');
  var path = require('path');
  var $ = function (id) { return document.getElementById(id); };

  function localPath(href) {
    var p = decodeURIComponent(href.replace(/^file:\/\/\/?/, '').replace(/[?#].*$/, ''));
    if (!/^[A-Za-z]:/.test(p)) p = '/' + p;
    return p;
  }

  var appDir = path.dirname(localPath(window.location.href));
  var extDir = path.dirname(appDir);
  var dataDir = Presets.dataDir();
  var stateFile = path.join(dataDir, 'update-state.json');
  var repo = (window.IlusConfig && window.IlusConfig.UPDATE_REPO) || '';
  var current = '0.0.0';
  var offered = null;

  try { current = JSON.parse(fs.readFileSync(path.join(appDir, 'version.json'), 'utf8')).version; } catch (e) { /* keep default */ }

  function readState() {
    try { return JSON.parse(fs.readFileSync(stateFile, 'utf8')); } catch (e) { return {}; }
  }

  function publicKey() {
    try { return fs.readFileSync(path.join(extDir, 'update-pubkey.pem'), 'utf8'); } catch (e) { return ''; }
  }

  // The installed loader's version, read from the fixed shell rather than from updatable code.
  function loaderVersion() {
    try { return require(path.join(extDir, 'loader-core.js')).LOADER_VERSION; } catch (e) { return 1; }
  }

  function show(text, canInstall) {
    $('update-banner').hidden = !text;
    $('update-text').textContent = text || '';
    $('update-install').hidden = !canInstall;
  }

  function check(manual) {
    if (!manual && !Updater.dueForCheck(stateFile, Date.now())) return;
    if (manual) show('Checking for updates…', false);
    Updater.checkForUpdate({ repo: repo, currentVersion: current, failedVersions: readState().failed }).then(function (info) {
      try { Updater.recordCheck(stateFile, Date.now()); } catch (e) { /* throttle is best effort */ }
      offered = info;
      if (info) {
        show('Update ' + info.version + ' available.', true);
        $('update-banner').title = info.notes;
      } else {
        show(manual ? 'You have the latest version.' : '', false);
      }
    }).catch(function () {
      show(manual ? 'Could not check for updates.' : '', false);
    });
  }

  function install() {
    if (!offered) return;
    show('Downloading ' + offered.version + '…', false);
    Updater.stageUpdate(offered, { extDir: extDir, publicKeyPem: publicKey(), loaderVersion: loaderVersion() }).then(function () {
      show('Update ' + offered.version + ' ready. Close and reopen the panel to finish.', false);
    }).catch(function (e) {
      show(e && e.needsInstaller ? 'This update needs the full installer.' : 'Update failed; nothing was changed.', false);
    });
  }

  function init() {
    $('version-label').textContent = 'v' + current;
    if (!repo) return; // updates are off in this build
    $('update-check').hidden = false;
    $('update-check').onclick = function () { check(true); };
    $('update-install').onclick = install;
    check(false);
  }

  // Called by panel.js once the panel and the export engine have loaded.
  window.signalReady = function () {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: 'ilus-ready', version: current }, '*');
    }
  };

  init();
}());
