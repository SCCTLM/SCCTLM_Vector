// Tab switching: sets body[data-tab] (CSS shows the matching panes) and fires "tab-changed" with the tab name.
(function () {
  'use strict';

  var tabs = document.getElementById('tabs');
  tabs.onclick = function (e) {
    var tab = e.target.dataset && e.target.dataset.tab;
    if (!tab || tab === document.body.dataset.tab) return;
    document.body.dataset.tab = tab;
    Array.prototype.forEach.call(tabs.querySelectorAll('.tab'), function (b) {
      b.classList.toggle('on', b.dataset.tab === tab);
    });
    document.dispatchEvent(new CustomEvent('tab-changed', { detail: tab }));
  };
}());
