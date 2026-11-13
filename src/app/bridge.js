// Single gateway to the ExtendScript engine. All calls return Promises of parsed JSON.
(function (global) {
  'use strict';

  // The app runs inside the loader's iframe; CSInterface expects the bridge on this window.
  try {
    if (!global.__adobe_cep__ && global.parent && global.parent.__adobe_cep__) {
      global.__adobe_cep__ = global.parent.__adobe_cep__;
    }
  } catch (ignore) { /* parent not reachable: bridge stays unavailable */ }

  var cs = global.__adobe_cep__ && typeof CSInterface !== 'undefined' ? new CSInterface() : null;

  // JSON text is a valid ExtendScript expression. U+2028/2029 are legal in JSON but are line
  // terminators in ExtendScript, so they are escaped explicitly.
  function jsonText(value) {
    return JSON.stringify(value)
      .split(String.fromCharCode(0x2028)).join('\\u2028')
      .split(String.fromCharCode(0x2029)).join('\\u2029');
  }

  function literal(value) {
    return jsonText(String(value));
  }

  function rawEval(code) {
    return new Promise(function (resolve) {
      if (!cs) { resolve('EvalScript error.'); return; }
      cs.evalScript(code, resolve);
    });
  }

  // The engine lives in app/jsx so updates replace it with the rest of the app (the manifest
  // cannot name it, because the manifest never changes after install). Loaded once, before any call.
  var engineLoaded = null;
  function loadEngine() {
    if (!engineLoaded) {
      var base = global.location.href.replace(/[?#].*$/, '').replace(/[^\/]*$/, '').replace(/^file:\/\/\/?/, '');
      base = decodeURIComponent(base);
      if (!/^[A-Za-z]:/.test(base)) base = '/' + base;
      engineLoaded = rawEval('$.evalFile(File(' + jsonText(base + 'jsx/engine.jsx') + '));"ok"').then(function (r) {
        if (r === 'EvalScript error.') { engineLoaded = null; throw new Error('Could not load the export engine'); }
      });
    }
    return engineLoaded;
  }

  function evalScript(code) {
    return new Promise(function (resolve, reject) {
      if (!cs) { reject(new Error('CEP bridge unavailable')); return; }
      loadEngine().then(function () { return rawEval(code); }).then(function (result) {
        if (result === 'EvalScript error.') { reject(new Error('Illustrator script error')); return; }
        try { resolve(JSON.parse(result)); }
        catch (e) { reject(new Error('Unexpected engine reply: ' + result)); }
      }).catch(reject);
    });
  }

  global.Bridge = {
    available: !!cs,
    cs: cs,
    loadEngine: loadEngine,
    literal: literal,
    listArtboards: function () { return evalScript('listArtboards()'); },
    runJob: function (job) { return evalScript('runExport(' + literal(JSON.stringify(job)) + ')'); },
    runPdfJob: function (job) { return evalScript('runPdfExport(' + literal(JSON.stringify(job)) + ')'); },
    estimatePdf: function (job) { return evalScript('estimatePdf(' + literal(JSON.stringify(job)) + ')'); },
    gridInspect: function (job) { return evalScript('gridInspect(' + literal(JSON.stringify(job || {})) + ')'); },
    gridGenerate: function (job) { return evalScript('gridGenerate(' + literal(JSON.stringify(job)) + ')'); },
    gridClear: function () { return evalScript('gridClear()'); },
    // names: every artboard name in index order, so de-duplication matches the engine.
    previewName: function (template, ctx, names, index, isRaster, scaleCount) {
      return evalScript('(function(){var c=' + jsonText(ctx) + ';c.artboard=uniqueArtboardNames(' +
        jsonText(names) + ')[' + Number(index) + '];return JSON.stringify({name:buildFileBaseName(' +
        'templateForScales(' + literal(template) + ',' + (isRaster ? 'true' : 'false') + ',' + Number(scaleCount) +
        '),c)});})()');
    }
  };
}(window));
