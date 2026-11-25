const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const cssPath = path.join(__dirname, '..', 'src', 'app', 'panel.css');
const css = fs.readFileSync(cssPath, 'utf8');

test('panel.css hides scrollbars across engines while keeping vertical scrolling', () => {
  assert.match(css, /scrollbar-width:\s*none;/);
  assert.match(css, /-ms-overflow-style:\s*none;/);
  assert.match(css, /::-webkit-scrollbar\s*\{\s*width:\s*0;\s*height:\s*0;\s*display:\s*none;\s*\}/);
  assert.match(css, /html\s*\{[^}]*overflow-y:\s*auto;\s*overflow-x:\s*hidden;/);
  assert.match(css, /\.list\s*\{[^}]*overflow-y:\s*auto;[^}]*scrollbar-width:\s*none;/);
  assert.doesNotMatch(css, /\.list::-webkit-scrollbar\s*\{\s*width:\s*6px;/);
});

test('panel.css includes narrow-width responsive protections for all tabs', () => {
  assert.match(css, /\.tab\s*\{[^}]*min-width:\s*0;[^}]*text-overflow:\s*ellipsis;/);
  assert.match(css, /\.offset-options-row\s*\{[^}]*flex-wrap:\s*wrap;/);
  assert.match(css, /\.align-bottom\s*\{[^}]*flex-wrap:\s*wrap;/);
  assert.match(css, /\.pdf-size-row\s*\{[^}]*flex-wrap:\s*wrap;/);
  assert.match(css, /body\[data-tab="pdf"\]\s+#artboards\s*\{[^}]*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(css, /@media\s*\(max-width:\s*290px\)/);
  assert.match(css, /@media\s*\(max-width:\s*260px\)/);
});
