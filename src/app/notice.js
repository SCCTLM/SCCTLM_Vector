// Message window: shows the text the panel sends and closes on request. On load it asks the panel to
// resend the current message, because the window is usually opened by the very message it must show.
(function () {
  'use strict';

  var SHOW_EVENT = 'vn.scctlm.notice.show';
  var READY_EVENT = 'vn.scctlm.notice.ready';
  var msg = document.getElementById('msg');

  function close() { if (Bridge.cs) Bridge.cs.closeExtension(); }

  function show(text) { msg.textContent = text || ''; }

  Theme.watch();
  document.getElementById('close').onclick = close;
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' || e.key === 'Enter') close();
  });

  if (Bridge.cs) {
    Bridge.cs.addEventListener(SHOW_EVENT, function (ev) { show(ev.data); });
    var ready = new CSEvent(READY_EVENT, 'APPLICATION');
    ready.data = '';
    Bridge.cs.dispatchEvent(ready);
  }
}());
