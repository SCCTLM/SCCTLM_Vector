// Update check, messages through the notice window, and startup handshake with the loader. Never installs without a click.
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
  var repo = (window.VectorConfig && window.VectorConfig.UPDATE_REPO) || '';
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

  // Messages go to the notice window as plain text.
  function say(text, opts) {
    opts = opts || {};
    if (window.Notice) window.Notice.show(text, { label: opts.label, run: opts.run });
  }

  function setChecking(on) {
    var btn = $('update-check');
    btn.disabled = on;
    btn.textContent = on ? 'Đang kiểm tra…' : 'Kiểm tra cập nhật';
  }

  function check(manual) {
    if (!manual && !Updater.dueForCheck(stateFile, Date.now())) return;
    if (manual) setChecking(true);
    Updater.checkForUpdate({ repo: repo, currentVersion: current, failedVersions: readState().failed }).then(function (info) {
      try { Updater.recordCheck(stateFile, Date.now()); } catch (e) { /* throttle is best effort */ }
      offered = info;
      if (info) {
        say('Có bản cập nhật ' + info.version + '.' + (info.notes ? '\n\n' + info.notes : ''), { label: 'Cài đặt', run: install });
      } else if (manual) {
        say('Bạn đang dùng phiên bản mới nhất (v' + current + ').');
      }
    }).catch(function () {
      if (manual) say('Không kiểm tra được bản cập nhật. Kiểm tra kết nối mạng rồi thử lại.');
    }).then(function () { if (manual) setChecking(false); });
  }

  function install() {
    if (!offered) return;
    var version = offered.version;
    say('Đang tải ' + version + '…');
    Updater.stageUpdate(offered, { extDir: extDir, publicKeyPem: publicKey(), loaderVersion: loaderVersion() }).then(function () {
      say('Bản cập nhật ' + version + ' đã sẵn sàng. Đóng và mở lại panel để hoàn tất.');
    }).catch(function (e) {
      if (e && e.needsInstaller) say('Bản cập nhật này cần cài bằng bộ cài đầy đủ. Tải bộ cài mới từ trang phát hành.');
      else say('Cập nhật thất bại; chưa có gì bị thay đổi.');
    });
  }

  function init() {
    $('version-label').textContent = 'v' + current;
    if (!repo) return; // updates are off in this build
    $('update-check').hidden = false;
    $('update-check').onclick = function () { check(true); };
    check(false);
  }

  // Called by panel.js once the panel and the export engine have loaded.
  window.signalReady = function () {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: 'vector-ready', version: current }, '*');
    }
  };

  init();
}());
