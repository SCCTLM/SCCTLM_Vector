// Moves the panel's status line into the notice window. Every module writes its messages to #status, so one
// observer covers them all; the line is cleared once the window has the text. Without CEP the line stays inline.
(function () {
  'use strict';

  var NOTICE_ID = 'vn.scctlm.vector.notice';
  var SHOW_EVENT = 'vn.scctlm.notice.show';
  var READY_EVENT = 'vn.scctlm.notice.ready';
  var status = document.getElementById('status');
  var pending = '';

  if (!Bridge.cs || !status || typeof MutationObserver === 'undefined') return;

  function send() {
    var ev = new CSEvent(SHOW_EVENT, 'APPLICATION');
    ev.data = pending;
    Bridge.cs.dispatchEvent(ev);
  }

  // A window that has just been opened asks for the message it was opened for.
  Bridge.cs.addEventListener(READY_EVENT, function () { if (pending) send(); });

  new MutationObserver(function () {
    var text = status.textContent;
    if (!text) return;
    pending = text;
    status.textContent = '';
    Bridge.cs.requestOpenExtension(NOTICE_ID, '');
    send();
  }).observe(status, { childList: true, characterData: true, subtree: true });
}());
