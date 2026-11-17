// CMYK gamut checks for the colour picker, through an ICC engine (jsColorEngine) and a printing profile.
// A colour is out of gamut when its sRGB -> CMYK -> sRGB round trip moves it more than THRESHOLD (Delta E 1976),
// with relative colorimetric intent and black point compensation, the Adobe default. Checked against
// Illustrator's own conversion: same verdict on 60 of 60 test colours (see docs/color-picker.md).
// The per-pixel mask reads a GRID^3 table of round-trip Delta E built once per profile, interpolated
// trilinearly, so a 256x256 field takes a few milliseconds.
(function (global) {
  'use strict';

  var THRESHOLD = 3;
  var GRID = 49;

  // Folders that hold printing profiles, most specific first. Adobe's come with Creative Cloud apps;
  // Adobe's per-user folder is where newer installs and manually added profiles live.
  function profileDirs(platform, env) {
    var dirs = [];
    function add(base, tail) { if (base) dirs.push(base + tail); }
    if (platform === 'win32') {
      var profiles = '\\Common Files\\Adobe\\Color\\Profiles';
      [env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', env.ProgramFiles, env.ProgramW6432].forEach(function (base) {
        add(base, profiles + '\\Recommended');
        add(base, profiles);
      });
      add(env.APPDATA, '\\Adobe\\Color\\Profiles');
      add(env.SystemRoot || env.windir || 'C:\\Windows', '\\System32\\spool\\drivers\\color');
    } else {
      var home = env.HOME || '';
      dirs.push('/Library/Application Support/Adobe/Color/Profiles/Recommended',
        '/Library/Application Support/Adobe/Color/Profiles',
        '/Library/ColorSync/Profiles');
      if (home) dirs.push(home + '/Library/Application Support/Adobe/Color/Profiles', home + '/Library/ColorSync/Profiles');
    }
    return dirs.filter(function (d, i) { return dirs.indexOf(d) === i; });
  }

  function ascii(bytes, start, len) {
    var s = '';
    for (var i = start; i < start + len && i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return s;
  }

  function u32(bytes, at) {
    return ((bytes[at] << 24) >>> 0) + (bytes[at + 1] << 16) + (bytes[at + 2] << 8) + bytes[at + 3];
  }

  // Colour space and description of an ICC profile, read from the header and the 'desc' tag
  // (v2 'desc' text or v4 'mluc'). Returns null for data that is not a profile.
  function profileInfo(bytes) {
    if (!bytes || bytes.length < 132 || ascii(bytes, 36, 4) !== 'acsp') return null;
    var info = { space: ascii(bytes, 16, 4).trim(), name: '' };
    var count = u32(bytes, 128);
    for (var i = 0; i < count && 132 + i * 12 + 12 <= bytes.length; i++) {
      var at = 132 + i * 12;
      if (ascii(bytes, at, 4) !== 'desc') continue;
      var off = u32(bytes, at + 4), type = ascii(bytes, off, 4);
      if (type === 'desc') {
        info.name = ascii(bytes, off + 12, Math.max(0, u32(bytes, off + 8) - 1));
      } else if (type === 'mluc' && u32(bytes, off + 8) > 0) {
        var len = u32(bytes, off + 20), start = off + u32(bytes, off + 24), s = '';
        for (var j = 0; j + 1 < len; j += 2) s += String.fromCharCode((bytes[start + j] << 8) | bytes[start + j + 1]);
        info.name = s;
      }
      break;
    }
    info.name = info.name.replace(/\u0000+$/, '').trim();
    return info;
  }

  // Every CMYK profile in the given folders: [{ name, path }], sorted by name, first file wins per name.
  function listCmykProfiles(dirs) {
    var fs = require('fs'), path = require('path');
    var seen = {}, out = [];
    dirs.forEach(function (dir) {
      var files;
      try { files = fs.readdirSync(dir); } catch (e) { return; }
      files.forEach(function (f) {
        if (!/\.ic[cm]$/i.test(f)) return;
        var full = path.join(dir, f), info;
        try { info = profileInfo(new Uint8Array(fs.readFileSync(full))); } catch (e) { return; }
        if (!info || info.space !== 'CMYK' || !info.name || seen[info.name]) return;
        seen[info.name] = true;
        out.push({ name: info.name, path: full });
      });
    });
    return out.sort(function (a, b) { return a.name < b.name ? -1 : (a.name > b.name ? 1 : 0); });
  }

  function findProfile(list, name) {
    for (var i = 0; i < list.length; i++) if (list[i].name === name) return list[i];
    return null;
  }

  // engine: the jsColorEngine module. bytes: the CMYK profile file. RGB in and out is 0-255, CMYK is 0-100.
  function create(engine, bytes) {
    bytes = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    var info = profileInfo(bytes);
    if (!info || info.space !== 'CMYK') throw new Error('Không phải ICC profile CMYK');
    var profile = new engine.Profile();
    profile.loadBinary(bytes);
    if (!profile.loaded) throw new Error('Không đọc được ICC profile' + (profile.lastError ? ': ' + profile.lastError : ''));
    var rel = engine.eIntent.relative, color = engine.color;
    function transform(from, to, bpc) {
      var t = new engine.Transform({ BPC: bpc, dataFormat: 'objectFloat' });
      t.create(from, to, rel);
      return t;
    }
    var toCmykT = transform('*sRGB', profile, true);
    var fromCmykT = transform(profile, '*sRGB', true);
    var cmykLabT = transform(profile, '*lab', true);
    var rgbLabT = transform('*sRGB', '*lab', false);

    function rgbf(rgb) { return color.RGBf(rgb[0] / 255, rgb[1] / 255, rgb[2] / 255); }
    function cmykf(c) { return color.CMYKf(c[0] / 100, c[1] / 100, c[2] / 100, c[3] / 100); }

    function toCmyk(rgb) {
      var k = toCmykT.transform(rgbf(rgb));
      return [k.Cf * 100, k.Mf * 100, k.Yf * 100, k.Kf * 100];
    }

    function cmykToRgb(cmyk) {
      var c = fromCmykT.transform(cmykf(cmyk));
      return [c.Rf * 255, c.Gf * 255, c.Bf * 255];
    }

    // Exact round-trip Delta E, through the engine.
    function roundTripDeltaE(rgb) {
      var c = rgbf(rgb);
      var a = rgbLabT.transform(c), b = cmykLabT.transform(toCmykT.transform(c));
      var dl = a.L - b.L, da = a.a - b.a, db = a.b - b.b;
      return Math.sqrt(dl * dl + da * da + db * db);
    }

    var lut = null;
    function buildLut() {
      lut = new Float32Array(GRID * GRID * GRID);
      var step = 255 / (GRID - 1), p = 0;
      for (var r = 0; r < GRID; r++) {
        for (var g = 0; g < GRID; g++) {
          for (var b = 0; b < GRID; b++) lut[p++] = roundTripDeltaE([r * step, g * step, b * step]);
        }
      }
    }

    // Interpolated round-trip Delta E for 0-255 channels; hot path of the mask.
    function maskDeltaE(r, g, b) {
      if (!lut) buildLut();
      var s = (GRID - 1) / 255, x = r * s, y = g * s, z = b * s, G = GRID, G2 = GRID * GRID;
      var i = x >= G - 1 ? G - 2 : (x < 0 ? 0 : x | 0);
      var j = y >= G - 1 ? G - 2 : (y < 0 ? 0 : y | 0);
      var k = z >= G - 1 ? G - 2 : (z < 0 ? 0 : z | 0);
      var fx = x - i, fy = y - j, fz = z - k, o = i * G2 + j * G + k;
      var c00 = lut[o] + (lut[o + G2] - lut[o]) * fx;
      var c10 = lut[o + G] + (lut[o + G2 + G] - lut[o + G]) * fx;
      var c01 = lut[o + 1] + (lut[o + G2 + 1] - lut[o + 1]) * fx;
      var c11 = lut[o + G + 1] + (lut[o + G2 + G + 1] - lut[o + G + 1]) * fx;
      var c0 = c00 + (c10 - c00) * fy, c1 = c01 + (c11 - c01) * fy;
      return c0 + (c1 - c0) * fz;
    }

    return {
      name: info.name,
      toCmyk: toCmyk,
      cmykToRgb: cmykToRgb,
      roundTripDeltaE: roundTripDeltaE,
      maskDeltaE: maskDeltaE,
      warmUp: function () { if (!lut) buildLut(); },
      isOutOfGamut: function (rgb) { return roundTripDeltaE(rgb) > THRESHOLD; },
      // The printable colour Illustrator would produce: the round trip through the profile.
      nearestInGamut: function (rgb) { return cmykToRgb(toCmyk(rgb)); }
    };
  }

  global.ColorGamut = {
    THRESHOLD: THRESHOLD, GRID: GRID,
    profileDirs: profileDirs, profileInfo: profileInfo, listCmykProfiles: listCmykProfiles,
    findProfile: findProfile, create: create
  };
}(window));
