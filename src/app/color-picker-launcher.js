// Header button and Artboard tab button: opens the colour picker window, or, when it is already open, tells it to reload the colour of
// the current selection. The window does its own Illustrator calls.
(function () {
  'use strict';

  var PICKER_ID = 'vn.scctlm.vector.picker';
  var REFRESH_EVENT = 'vn.scctlm.picker.refresh';

  function openPicker() {
    Bridge.cs.requestOpenExtension(PICKER_ID, '');
    var ev = new CSEvent(REFRESH_EVENT, 'APPLICATION');
    ev.data = '';
    Bridge.cs.dispatchEvent(ev);
  }

  var btn = document.getElementById('open-picker');
  var btnArtboard = document.getElementById('open-picker-artboard');

  if (!Bridge.cs) {
    if (btn) btn.disabled = true;
    if (btnArtboard) btnArtboard.disabled = true;
    return;
  }
  if (btn) btn.onclick = openPicker;
  if (btnArtboard) btnArtboard.onclick = openPicker;
}());
