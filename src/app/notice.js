// Message window: shows the message the panel sends (plain text, optional action button) and closes on
// request. On load it asks the panel to resend the current message, because the window is usually opened
// by the very message it must show.
(function () {
  'use strict';

  var SHOW_EVENT = 'vn.scctlm.notice.show';
  var READY_EVENT = 'vn.scctlm.notice.ready';
  var ACTION_EVENT = 'vn.scctlm.notice.action';
  var SHOWN_EVENT = 'vn.scctlm.notice.shown';
  var msg = document.getElementById('msg');
  var action = document.getElementById('action');
  var closeBtn = document.getElementById('close');

  function close() { if (Bridge.cs) Bridge.cs.closeExtension(); }

  function runAction() {
    var ev = new CSEvent(ACTION_EVENT, 'APPLICATION');
    ev.data = '';
    Bridge.cs.dispatchEvent(ev);
  }

  function parse(data) {
    try {
      var m = JSON.parse(decodeURIComponent(data));
      if (m && typeof m === 'object') return m;
    } catch (e) { /* plain text */ }
    return { text: data };
  }

  function show(data) {
    var m = parse(data);
    msg.textContent = m.text || '';
    action.hidden = !m.action;
    action.textContent = m.action || '';
    closeBtn.textContent = m.action ? 'Để sau' : 'Đóng';
    var shown = new CSEvent(SHOWN_EVENT, 'APPLICATION');
    shown.data = '';
    Bridge.cs.dispatchEvent(shown);
  }

  Theme.watch();
  closeBtn.onclick = close;
  action.onclick = runAction;
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') close();
    else if (e.key === 'Enter') { if (action.hidden) close(); else runAction(); }
  });

  if (Bridge.cs) {
    Bridge.cs.addEventListener(SHOW_EVENT, function (ev) { show(ev.data); });
    var ready = new CSEvent(READY_EVENT, 'APPLICATION');
    ready.data = '';
    Bridge.cs.dispatchEvent(ready);
  }
}());
