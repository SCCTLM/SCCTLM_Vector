// Header button: opens the colour picker window, or, when it is already open, tells it to reload the colour of
// the current selection. The window does its own Illustrator calls.
(function () {
  'use strict';

  var PICKER_ID = 'vn.scctlm.vector.picker';
  var REFRESH_EVENT = 'vn.scctlm.picker.refresh';
  var btn = document.getElementById('open-picker');

  if (!Bridge.cs) { btn.disabled = true; return; }
  btn.onclick = function () {
    Bridge.cs.requestOpenExtension(PICKER_ID, '');
    var ev = new CSEvent(REFRESH_EVENT, 'APPLICATION');
    ev.data = '';
    Bridge.cs.dispatchEvent(ev);
  };
}());
