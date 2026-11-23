// Follows the Illustrator UI brightness: overwrites the colour tokens in panel.css from the host skin and
// again whenever the user changes it. Shared by the panel and the colour picker window.
(function (global) {
  'use strict';

  function hex(c) {
    var h = function (n) { return ('0' + Math.round(n).toString(16)).slice(-2); };
    return '#' + h(c.red) + h(c.green) + h(c.blue);
  }
  function shift(c, delta) {
    var clamp = function (n) { return Math.max(0, Math.min(255, n + delta)); };
    return { red: clamp(c.red), green: clamp(c.green), blue: clamp(c.blue) };
  }
  function apply() {
    if (!global.Bridge || !Bridge.cs) return;
    var bg = Bridge.cs.getHostEnvironment().appSkinInfo.panelBackgroundColor.color;
    var dark = (bg.red + bg.green + bg.blue) / 3 < 128;
    var root = document.documentElement.style;
    root.setProperty('--bg', hex(bg));
    root.setProperty('--fg', dark ? '#ddd' : '#222');
    root.setProperty('--muted', dark ? 'rgba(238,238,238,.8)' : 'rgba(20,20,20,.8)');
    root.setProperty('--green-text', dark ? '#3ee690' : '#055a2f');
    root.setProperty('--green-accent', dark ? '#35c779' : '#1f9d55');
    root.setProperty('--err', dark ? '#ff7378' : '#a80008');
    root.setProperty('--field', hex(shift(bg, dark ? -20 : 25)));
    root.setProperty('--btn', hex(shift(bg, dark ? 25 : -20)));
  }
  function watch() {
    apply();
    if (global.Bridge && Bridge.cs) Bridge.cs.addEventListener(CSInterface.THEME_COLOR_CHANGED_EVENT, apply);
  }

  global.Theme = { apply: apply, watch: watch };
}(window));
