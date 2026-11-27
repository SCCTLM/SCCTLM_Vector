// Khám phá tab: community link, channel link and a filterable list of tutorial videos.
// Every link opens in the user's default browser.
(function () {
  'use strict';

  var TOPICS = ['Tất cả', 'Typography', 'Photoshop', 'Illustrator'];

  // id = YouTube video id; thumbnails come from i.ytimg.com.
  var VIDEOS = [
    { id: 'kXFvjApaEes', title: '#30 Hiệu ứng chữ Phú Thọ', tags: ['Typography', 'Photoshop', 'Illustrator'] },
    { id: 'KAMfVNKMzZE', title: '#29 Hiệu ứng chữ Vành Đai - god of war: laufey', tags: ['Typography', 'Photoshop', 'Illustrator'] },
    { id: 'EVNVRwf4STk', title: '#28 Hiệu ứng chữ 85k Thành Viên', tags: ['Typography', 'Photoshop', 'Illustrator'] },
    { id: '5XGwl2ekK6w', title: '#26 Logo Typography ZOMBIE V4 (Bloodring)', tags: ['Typography', 'Photoshop', 'Illustrator'] },
    { id: 'J6iwutiI_rE', title: '#25 Typography Game Kiếm Hiệp', tags: ['Typography', 'Photoshop', 'Illustrator'] },
    { id: '11Pcrt4Jx90', title: 'Cài SCCTLM_Foto trên Win & Mac', tags: ['Photoshop'] },
    { id: 'dElqqocxv-4', title: 'Test nhanh plugin SCCTLM_Foto cho Photoshop', tags: ['Photoshop'] }
  ];

  var EXT_ICON = '<svg class="explore-ext-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>';

  var cs = typeof CSInterface !== 'undefined' && window.__adobe_cep__ ? new CSInterface() : null;
  var list = document.getElementById('explore-videos');
  var search = document.getElementById('explore-search');
  var chips = document.getElementById('explore-chips');
  var topic = TOPICS[0];
  var listRendered = false;

  function isExploreTab() {
    var tab = document.body && document.body.dataset && document.body.dataset.tab;
    return !tab || tab === 'explore';
  }

  function openUrl(url) {
    if (cs) cs.openURLInDefaultBrowser(url);
    else window.open(url, '_blank');
  }

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function fold(s) {
    return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd');
  }

  function renderChips() {
    chips.innerHTML = TOPICS.map(function (t) {
      var on = t === topic;
      return '<button type="button" class="explore-chip' + (on ? ' on' : '') + '" role="radio" aria-checked="' + on + '" data-topic="' + esc(t) + '">' + esc(t) + '</button>';
    }).join('');
  }

  function renderList() {
    var q = fold(search.value.trim());
    var rows = VIDEOS.filter(function (v) {
      return (topic === TOPICS[0] || v.tags.indexOf(topic) !== -1) && (!q || fold(v.title).indexOf(q) !== -1);
    });
    if (!rows.length) {
      list.innerHTML = '<li class="explore-empty">Không có bài phù hợp.</li>';
      return;
    }
    listRendered = true;
    list.innerHTML = rows.map(function (v) {
      return '<li><button type="button" class="explore-video" data-url="https://www.youtube.com/watch?v=' + v.id + '">' +
        '<img class="explore-thumb" loading="lazy" decoding="async" alt="" src="https://i.ytimg.com/vi/' + v.id + '/mqdefault.jpg">' +
        '<span class="explore-video-text"><span class="explore-video-title">' + esc(v.title) + '</span>' +
        '<span class="explore-video-link">Xem trên YouTube ' + EXT_ICON + '</span></span></button></li>';
    }).join('');
  }

  document.querySelector('[data-pane="explore"]').addEventListener('click', function (e) {
    var chip = e.target.closest('.explore-chip');
    if (chip) {
      topic = chip.getAttribute('data-topic');
      renderChips();
      renderList();
      return;
    }
    var link = e.target.closest('[data-url]');
    if (link) openUrl(link.getAttribute('data-url'));
  });
  search.addEventListener('input', renderList);

  if (typeof document.addEventListener === 'function') {
    document.addEventListener('tab-changed', function (e) {
      if (!listRendered && (!e || !e.detail || e.detail === 'explore')) renderList();
    });
  }

  renderChips();
  // Defer thumbnail DOM/network/decode until the user actually opens the Khám phá tab.
  if (isExploreTab()) renderList();
}());
