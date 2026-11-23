const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function setupExploreDOM() {
  const elements = {};
  function makeElem(tag, id, classes = '') {
    const el = {
      tagName: tag.toUpperCase(),
      id: id || '',
      value: '',
      innerHTML: '',
      textContent: '',
      attributes: {},
      listeners: {},
      classList: {
        classes: new Set(classes ? classes.split(' ') : []),
        add(cls) { this.classes.add(cls); },
        delete(cls) { this.classes.delete(cls); },
        has(cls) { return this.classes.has(cls); },
        toggle(cls, force) {
          if (force !== undefined) {
            if (force) this.classes.add(cls); else this.classes.delete(cls);
          } else {
            if (this.classes.has(cls)) this.classes.delete(cls); else this.classes.add(cls);
          }
        },
        contains(cls) { return this.classes.has(cls); }
      },
      setAttribute(k, v) { this.attributes[k] = String(v); },
      getAttribute(k) { return this.attributes[k] !== undefined ? this.attributes[k] : null; },
      removeAttribute(k) { delete this.attributes[k]; },
      addEventListener(event, fn) {
        if (!this.listeners[event]) this.listeners[event] = [];
        this.listeners[event].push(fn);
      },
      dispatch(event, eventObj = {}) {
        const fns = this.listeners[event] || [];
        fns.forEach(fn => fn(eventObj));
      },
      closest(sel) {
        // Simple closest implementation for tests
        if (sel.startsWith('.')) {
          const cls = sel.slice(1);
          if (this.classList.contains(cls)) return this;
        }
        if (sel === '[data-url]' && this.attributes['data-url']) return this;
        return null;
      }
    };
    if (id) elements[id] = el;
    return el;
  }

  const videosList = makeElem('ul', 'explore-videos');
  const searchInput = makeElem('input', 'explore-search');
  const chipsContainer = makeElem('div', 'explore-chips');
  const explorePane = makeElem('div', null, 'explore');
  explorePane.setAttribute('data-pane', 'explore');

  const openedUrls = [];
  const sandbox = {
    document: {
      getElementById(id) {
        return elements[id] || null;
      },
      querySelector(sel) {
        if (sel === '[data-pane="explore"]') return explorePane;
        return null;
      }
    },
    window: {
      open(url, target) {
        openedUrls.push({ url, target });
      }
    },
    CSInterface: undefined,
    __adobe_cep__: undefined
  };

  sandbox.window.document = sandbox.document;
  vm.createContext(sandbox);

  const scriptPath = path.join(__dirname, '../src/app/explore-panel.js');
  const code = fs.readFileSync(scriptPath, 'utf8');
  vm.runInContext(code, sandbox);

  return { sandbox, elements, videosList, searchInput, chipsContainer, explorePane, openedUrls };
}

test('explore-panel initializes chips and videos list', () => {
  const { chipsContainer, videosList } = setupExploreDOM();
  assert.ok(chipsContainer.innerHTML.includes('Tất cả'));
  assert.ok(chipsContainer.innerHTML.includes('Typography'));
  assert.ok(chipsContainer.innerHTML.includes('Photoshop'));
  assert.ok(chipsContainer.innerHTML.includes('Illustrator'));

  // Video items are populated
  assert.ok(videosList.innerHTML.includes('explore-video'));
  assert.ok(videosList.innerHTML.includes('#30 Hiệu ứng chữ Phú Thọ'));
});

test('explore-panel filters by search query with accent folding', () => {
  const { searchInput, videosList } = setupExploreDOM();

  // Search without accents 'phu tho' matches 'Phú Thọ'
  searchInput.value = 'phu tho';
  searchInput.dispatch('input');
  assert.ok(videosList.innerHTML.includes('#30 Hiệu ứng chữ Phú Thọ'));
  assert.ok(!videosList.innerHTML.includes('#25 Typography Game Kiếm Hiệp'));

  // Search with 'd' matches 'đ'
  searchInput.value = 'vanh dai';
  searchInput.dispatch('input');
  assert.ok(videosList.innerHTML.includes('#29 Hiệu ứng chữ Vành Đai'));

  // Search non-existent term
  searchInput.value = 'khongcotrongdanhsach';
  searchInput.dispatch('input');
  assert.ok(videosList.innerHTML.includes('explore-empty'));
});

test('explore-panel handles chip filtering and opening urls', () => {
  const { explorePane, searchInput, videosList, openedUrls } = setupExploreDOM();

  // Simulate chip click for 'Photoshop'
  const fakeChip = {
    classList: { contains: (cls) => cls === 'explore-chip' },
    getAttribute: (attr) => (attr === 'data-topic' ? 'Photoshop' : null),
    closest: function (sel) { if (sel === '.explore-chip') return this; return null; }
  };

  explorePane.dispatch('click', { target: fakeChip });

  // Only Photoshop videos should remain (such as SCCTLM_Foto or Typography with Photoshop tag)
  assert.ok(videosList.innerHTML.includes('SCCTLM_Foto'));

  // Simulate clicking an external url
  const fakeLink = {
    classList: { contains: () => false },
    getAttribute: (attr) => (attr === 'data-url' ? 'https://www.youtube.com/@scctlm' : null),
    closest: function (sel) {
      if (sel === '.explore-chip') return null;
      if (sel === '[data-url]') return this;
      return null;
    }
  };

  explorePane.dispatch('click', { target: fakeLink });
  assert.strictEqual(openedUrls.length, 1);
  assert.strictEqual(openedUrls[0].url, 'https://www.youtube.com/@scctlm');
  assert.strictEqual(openedUrls[0].target, '_blank');
});
