// In-panel notice modal and toast. Replaces the separate CEP notice extension so notifications never
// spawn an extra CEPHtmlEngine process or lock files in app/ during updates.
(function (global) {
  'use strict';

  var DEFAULT_TOAST_MS = 4500;
  var $ = function (id) { return document.getElementById(id); };
  var activeAction = null;
  var toastTimer = null;

  function clearToastTimer() {
    if (toastTimer) {
      clearTimeout(toastTimer);
      toastTimer = null;
    }
  }

  function hideToast() {
    clearToastTimer();
    var toast = $('notice-toast');
    if (toast) toast.hidden = true;
  }

  function hideModal() {
    activeAction = null;
    var modal = $('notice-modal');
    if (modal) modal.hidden = true;
  }

  function hide() {
    hideModal();
    hideToast();
  }

  function inferKind(text, opts) {
    if (opts && opts.kind) return opts.kind;
    return /^(Lỗi|Không thể|Cảnh báo)\b/i.test(String(text || '')) ? 'error' : 'info';
  }

  // opts: { label, run, title, kind, modal, duration }
  function show(text, opts) {
    if (!text) return;
    opts = opts || {};
    var kind = inferKind(text, opts);
    var hasAction = !!(opts.label && typeof opts.run === 'function');
    var useModal = !!(opts.modal || hasAction);

    var modal = $('notice-modal');
    var toast = $('notice-toast');

    if (useModal && modal) {
      hideToast();
      var dialog = $('notice-dialog');
      var titleEl = $('notice-modal-title');
      var bodyEl = $('notice-modal-body');
      var actionBtn = $('notice-modal-action');
      var closeBtn = $('notice-modal-close');

      if (dialog) dialog.setAttribute('data-kind', kind);
      if (titleEl) titleEl.textContent = opts.title || 'Thông báo';
      if (bodyEl) bodyEl.textContent = String(text);
      activeAction = hasAction ? opts.run : null;

      if (actionBtn) {
        actionBtn.hidden = !hasAction;
        actionBtn.textContent = hasAction ? opts.label : '';
      }
      if (closeBtn) {
        closeBtn.textContent = hasAction ? 'Để sau' : 'Đóng';
      }
      modal.hidden = false;
      return;
    }

    if (toast) {
      hideModal();
      clearToastTimer();
      var textEl = $('notice-toast-text');
      if (textEl) textEl.textContent = String(text);
      toast.setAttribute('data-kind', kind);
      toast.hidden = false;

      var duration = opts.duration !== undefined
        ? opts.duration
        : (kind === 'error' || kind === 'warning' ? 0 : DEFAULT_TOAST_MS);
      if (duration > 0) {
        toastTimer = setTimeout(hideToast, duration);
      }
      return;
    }

    var status = $('status');
    if (status) status.textContent = String(text);
  }

  function runAction() {
    var fn = activeAction;
    hideModal();
    if (fn) fn();
  }

  function wire() {
    var toastClose = $('notice-toast-close');
    if (toastClose) toastClose.onclick = hideToast;

    var modalClose = $('notice-modal-close');
    if (modalClose) modalClose.onclick = hideModal;

    var modalX = $('notice-modal-x');
    if (modalX) modalX.onclick = hideModal;

    var modalAction = $('notice-modal-action');
    if (modalAction) modalAction.onclick = runAction;

    var modal = $('notice-modal');
    if (modal && modal.addEventListener) {
      modal.addEventListener('click', function (e) {
        if (e.target === modal) hideModal();
      });
    }

    if (document.addEventListener) {
      document.addEventListener('keydown', function (e) {
        var m = $('notice-modal');
        if (m && !m.hidden) {
          if (e.key === 'Escape') hideModal();
          else if (e.key === 'Enter' && activeAction) runAction();
          return;
        }
        var t = $('notice-toast');
        if (t && !t.hidden && e.key === 'Escape') hideToast();
      });
    }
  }

  wire();
  global.Notice = { show: show, hide: hide };
}(window));
