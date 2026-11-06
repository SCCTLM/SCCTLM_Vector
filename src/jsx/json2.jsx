// Minimal ES3 JSON polyfill for ExtendScript (Illustrator has no native JSON).
if (typeof JSON === "undefined") {
  JSON = {};
}
if (typeof JSON.stringify !== "function") {
  (function () {
    var meta = { "\b": "\\b", "\t": "\\t", "\n": "\\n", "\f": "\\f", "\r": "\\r", '"': '\\"', "\\": "\\\\" };

    function quote(s) {
      return '"' + String(s).replace(/[\\"\x00-\x1f\u2028\u2029]/g, function (c) {
        if (meta[c]) return meta[c];
        return "\\u" + ("0000" + c.charCodeAt(0).toString(16)).slice(-4);
      }) + '"';
    }

    function str(v) {
      if (v === null || v === undefined) return "null";
      var t = typeof v;
      if (t === "string") return quote(v);
      if (t === "number") return isFinite(v) ? String(v) : "null";
      if (t === "boolean") return String(v);
      var out = [];
      var i;
      if (Object.prototype.toString.call(v) === "[object Array]") {
        for (i = 0; i < v.length; i++) out.push(str(v[i]));
        return "[" + out.join(",") + "]";
      }
      for (var k in v) {
        if (Object.prototype.hasOwnProperty.call(v, k) && typeof v[k] !== "function" && v[k] !== undefined) {
          out.push(quote(k) + ":" + str(v[k]));
        }
      }
      return "{" + out.join(",") + "}";
    }

    JSON.stringify = function (value) {
      return str(value);
    };
  })();
}
if (typeof JSON.parse !== "function") {
  JSON.parse = function (text) {
    var s = String(text);
    // Reject anything that is not plain JSON before handing it to eval.
    var stripped = s
      .replace(/\\(?:["\\\/bfnrt]|u[0-9a-fA-F]{4})/g, "@")
      .replace(/"[^"\\\n\r]*"|true|false|null|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?/g, "]")
      .replace(/(?:^|:|,)(?:\s*\[)+/g, "");
    if (!/^[\],:{}\s]*$/.test(stripped)) {
      throw new SyntaxError("JSON.parse: invalid JSON");
    }
    return eval("(" + s + ")");
  };
}
