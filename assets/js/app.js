/* ===== Study Guy 主程式 =====
   負責：hash 路由、view 切換、導覽列渲染
*/
(function () {
  'use strict';

  // 全域命名空間
  window.StudyGuy = window.StudyGuy || {};
  const SG = window.StudyGuy;

  // 已註冊的 view
  // 每個 view 會自行 SG.registerView(name, { render(container, params), title })
  SG.views = SG.views || {};
  SG.registerView = function (name, view) {
    SG.views[name] = view;
  };

  // 導覽列項目
  const NAV_ITEMS = [
    { route: 'home', label: '主頁' },
    { route: 'study', label: '溫習' },
    { route: 'exam', label: '考試' },
    { route: 'history', label: '記錄' },
    { route: 'manage', label: '管理' }
  ];

  // 解析 hash：#/route/param1/param2 -> { name, params }
  function parseHash() {
    const raw = (location.hash || '#/home').replace(/^#\/?/, '');
    const parts = raw.split('/').filter(Boolean);
    return {
      name: parts[0] || 'home',
      params: parts.slice(1)
    };
  }

  // 渲染導覽列
  function renderNav(activeName) {
    const nav = document.getElementById('app-nav');
    if (!nav) return;
    nav.innerHTML = '';
    NAV_ITEMS.forEach(function (item) {
      const btn = document.createElement('button');
      btn.textContent = item.label;
      if (item.route === activeName) btn.classList.add('active');
      btn.addEventListener('click', function () {
        location.hash = '#/' + item.route;
      });
      nav.appendChild(btn);
    });
  }

  // 渲染目前 view
  function renderCurrent() {
    const { name, params } = parseHash();
    const main = document.getElementById('app-main');
    const view = SG.views[name];
    renderNav(name);
    if (!view) {
      main.innerHTML = '<div class="card"><h2 class="page-title">找不到頁面</h2><p>路由：' + name + '</p></div>';
      return;
    }
    main.innerHTML = '';
    try {
      view.render(main, params);
    } catch (err) {
      console.error('[StudyGuy] view render error:', err);
      main.innerHTML = '<div class="card"><h2 class="page-title">頁面載入錯誤</h2><pre>' + (err && err.message ? err.message : err) + '</pre></div>';
    }
  }

  // 提供其他模組使用的導航 API
  SG.navigate = function (route) {
    location.hash = '#/' + route;
  };

  // 顯示短暫訊息
  SG.toast = function (message, type) {
    const el = document.createElement('div');
    el.className = 'toast ' + (type || '');
    el.textContent = message;
    document.body.appendChild(el);
    setTimeout(function () { el.remove(); }, type === 'error' ? 3500 : 2200);
  };

  // 簡易 HTML 跳脫（給 innerHTML 使用）
  SG.esc = function (s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  };

  // 裝置偵測
  SG.isIOS = function () {
    var ua = navigator.userAgent || '';
    // iPad on iPadOS 13+ 報告為 Mac，但有 touch points
    var iPadOS = ua.indexOf('Macintosh') >= 0 && navigator.maxTouchPoints > 1;
    return /iPad|iPhone|iPod/.test(ua) || iPadOS;
  };

  // 自製 Modal API：alert / confirm / prompt
  // 統一介面、不依賴 window.prompt/confirm（在 iOS PWA 模式可能被擋）
  SG.modal = {
    alert: function (message, opts) {
      return openModal({ type: 'alert', message: message, opts: opts || {} });
    },
    confirm: function (message, opts) {
      return openModal({ type: 'confirm', message: message, opts: opts || {} });
    },
    prompt: function (message, defaultValue, opts) {
      return openModal({
        type: 'prompt', message: message,
        defaultValue: defaultValue || '', opts: opts || {}
      });
    }
  };

  function openModal(cfg) {
    return new Promise(function (resolve) {
      var mask = document.createElement('div');
      mask.className = 'modal-mask';
      var card = document.createElement('div');
      card.className = 'modal-card';
      var html = '<div class="modal-message">' + SG.esc(cfg.message) + '</div>';
      if (cfg.type === 'prompt') {
        html += '<input type="text" class="modal-input" value="' + SG.esc(cfg.defaultValue) + '">';
      }
      html += '<div class="modal-actions">';
      if (cfg.type !== 'alert') {
        html += '<button class="btn btn-ghost" data-act="cancel">' +
          SG.esc(cfg.opts.cancelLabel || '取消') + '</button>';
      }
      html += '<button class="btn" data-act="ok">' +
        SG.esc(cfg.opts.okLabel || '確定') + '</button>';
      html += '</div>';
      card.innerHTML = html;
      mask.appendChild(card);
      document.body.appendChild(mask);

      var input = card.querySelector('.modal-input');
      if (input) { setTimeout(function () { input.focus(); input.select(); }, 30); }

      function close(value) {
        mask.remove();
        resolve(value);
      }
      card.querySelector('[data-act="ok"]').addEventListener('click', function () {
        if (cfg.type === 'alert') close(true);
        else if (cfg.type === 'confirm') close(true);
        else close(input ? input.value : '');
      });
      var cancelBtn = card.querySelector('[data-act="cancel"]');
      if (cancelBtn) {
        cancelBtn.addEventListener('click', function () {
          close(cfg.type === 'prompt' ? null : false);
        });
      }
      // ESC 關閉
      function onKey(e) {
        if (e.key === 'Escape') {
          document.removeEventListener('keydown', onKey);
          close(cfg.type === 'prompt' ? null : false);
        } else if (e.key === 'Enter' && (cfg.type !== 'alert' || !input)) {
          document.removeEventListener('keydown', onKey);
          if (cfg.type === 'prompt') close(input.value);
          else close(true);
        }
      }
      document.addEventListener('keydown', onKey);
    });
  }

  // 啟動
  window.addEventListener('hashchange', renderCurrent);
  window.addEventListener('DOMContentLoaded', function () {
    if (!location.hash) location.hash = '#/home';
    else renderCurrent();
  });
})();
