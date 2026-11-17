// Shows panel messages in the notice window. Every module writes its messages to #status, so one observer
// covers them all and the line is cleared once the window has the text; modules that need a button (the
// updater) call Notice.show directly. Without CEP the text stays in the inline #status line.
(function () {
  'use strict';

  var NOTICE_ID = 'vn.scctlm.vector.notice';
  var SHOW_EVENT = 'vn.scctlm.notice.show';
  var READY_EVENT = 'vn.scctlm.notice.ready';
  var ACTION_EVENT = 'vn.scctlm.notice.action';
  var SHOWN_EVENT = 'vn.scctlm.notice.shown';
  var ACK_TIMEOUT_MS = 3000;
  var NOT_REGISTERED_HINT = '\n(Không mở được cửa sổ thông báo. Khởi động lại Illustrator rồi thử lại.)';
  var status = document.getElementById('status');
  var current = null; // { text, label, run }
  var ackTimer = null;
  var inlineText = '';

  function send() {
    var ev = new CSEvent(SHOW_EVENT, 'APPLICATION');
    // Percent-encoded so non-ASCII text survives the event channel unchanged.
    ev.data = encodeURIComponent(JSON.stringify({ text: current.text, action: current.label || null }));
    Bridge.cs.dispatchEvent(ev);
  }

  // opts: { label, run } adds one button that calls run once.
  function show(text, opts) {
    if (!text) return;
    opts = opts || {};
    current = { text: text, label: opts.label, run: opts.run };
    if (!Bridge.cs) { if (status) status.textContent = text; return; }
    status.textContent = '';
    Bridge.cs.requestOpenExtension(NOTICE_ID, '');
    send();
    // Illustrator only learns of a new extension at startup, so right after an install the window cannot open.
    // Without an acknowledgement the message would vanish, so it goes inline instead.
    clearTimeout(ackTimer);
    ackTimer = setTimeout(function () {
      inlineText = text + NOT_REGISTERED_HINT;
      if (status) status.textContent = inlineText;
    }, ACK_TIMEOUT_MS);
  }

  window.Notice = { show: show };

  if (!Bridge.cs) return;

  // A window that has just been opened asks for the message it was opened for.
  Bridge.cs.addEventListener(SHOWN_EVENT, function () { clearTimeout(ackTimer); });
  Bridge.cs.addEventListener(READY_EVENT, function () { if (current) send(); });
  Bridge.cs.addEventListener(ACTION_EVENT, function () {
    var run = current && current.run;
    if (current) current.run = null;
    if (run) run();
  });

  if (status && typeof MutationObserver !== 'undefined') {
    new MutationObserver(function () {
      var text = status.textContent;
      if (!text || text === inlineText) return;
      show(text);
    }).observe(status, { childList: true, characterData: true, subtree: true });
  }
}());
