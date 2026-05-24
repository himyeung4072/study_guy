/* ===== Manage View =====
   匯入科目（拖放或選檔）、學生管理、備份／還原
   進入時需要輸入管理員密碼（固定為 "password"）。
   同一個瀏覽器 session 內驗證一次後不再要求。
*/
(function () {
  'use strict';
  const SG = window.StudyGuy;

  // 固定密碼（明文比對，適合家庭使用場景）
  var ADMIN_PASSWORD = 'password';
  var SESSION_KEY = 'sg.adminAuthed';

  function isAuthed() {
    try { return sessionStorage.getItem(SESSION_KEY) === '1'; }
    catch (e) { return false; }
  }

  function setAuthed() {
    try { sessionStorage.setItem(SESSION_KEY, '1'); } catch (e) {}
  }

  function render(container) {
    container.innerHTML = '';
    if (!isAuthed()) {
      container.appendChild(renderPasswordCard(container));
      return;
    }
    container.appendChild(renderImportCard());
    container.appendChild(renderSubjectsCard());
    container.appendChild(renderStudentsCard());
    container.appendChild(renderBackupCard());
  }

  // 密碼輸入畫面
  function renderPasswordCard(container) {
    const card = document.createElement('div');
    card.className = 'card';
    card.style.maxWidth = '400px';
    card.style.margin = '60px auto';
    card.innerHTML =
      '<h2 class="page-title">🔒 管理員驗證</h2>' +
      '<p class="muted">請輸入管理員密碼才可進入管理頁面。</p>' +
      '<div class="row" style="margin-top:12px;">' +
      '  <input type="password" id="sg-admin-pw" placeholder="輸入密碼…" style="flex:1;">' +
      '  <button class="btn" id="sg-admin-submit">確認</button>' +
      '</div>' +
      '<p class="muted" style="margin-top:16px;font-size:13px;">忘記密碼？請聯絡設定此系統的家長或老師。</p>';
    const input = card.querySelector('#sg-admin-pw');
    const btn = card.querySelector('#sg-admin-submit');
    function tryLogin() {
      if (input.value === ADMIN_PASSWORD) {
        setAuthed();
        render(document.getElementById('app-main'));
      } else {
        SG.toast('密碼錯誤，請重試。', 'error');
        input.value = '';
        input.focus();
      }
    }
    btn.addEventListener('click', tryLogin);
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') tryLogin(); });
    return card;
  }

  // ===== 匯入卡（含標籤 UI）=====
  function renderImportCard() {
    var card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = '<h2 class="page-title">📥 匯入課別</h2>' +
      '<p class="muted">先選擇下方標籤決定匯入到哪個科目，然後拖入課別 JSON 檔（一份檔案 = 一課）。<br>' +
      '同一科目可分多次匯入，新課別會自動加入，重複的會更新。</p>';

    // 標籤 UI 容器
    var tagArea = document.createElement('div');
    tagArea.id = 'sg-tag-area';
    card.appendChild(tagArea);

    // 目標顯示
    var targetDiv = document.createElement('div');
    targetDiv.id = 'sg-import-target';
    card.appendChild(targetDiv);

    // 拖放區
    var dzWrap = document.createElement('div');
    dzWrap.innerHTML =
      '<div class="dropzone" id="sg-dz">' +
      '  <p>📂 拖放 JSON 檔案到這裡</p>' +
      '  <p class="muted">（iPad / iPhone 用戶請點下方按鈕選檔）</p>' +
      '  <button class="btn btn-ghost" type="button" id="sg-browse-btn">選擇檔案…</button>' +
      '  <input type="file" multiple accept=".json,application/json" style="display:none;">' +
      '</div>' +
      '<div id="sg-import-result"></div>';
    card.appendChild(dzWrap);

    // 初始化標籤 UI
    renderTagUI(tagArea, targetDiv);

    // 拖放事件
    var dz = card.querySelector('#sg-dz');
    var fileInput = dz.querySelector('input[type="file"]');
    var browseBtn = card.querySelector('#sg-browse-btn');
    var resultBox = card.querySelector('#sg-import-result');

    browseBtn.addEventListener('click', function () { fileInput.click(); });
    fileInput.addEventListener('change', function () {
      handleFiles(fileInput.files, resultBox, getImportOpts());
    });
    dz.addEventListener('dragover', function (e) {
      e.preventDefault(); dz.classList.add('dragover');
    });
    dz.addEventListener('dragleave', function () { dz.classList.remove('dragover'); });
    dz.addEventListener('drop', function (e) {
      e.preventDefault(); dz.classList.remove('dragover');
      handleFiles(e.dataTransfer.files, resultBox, getImportOpts());
    });
    return card;
  }

  function getImportOpts() {
    var sid = getSelectedSubjectId();
    if (!sid) return null;
    return {
      targetSubjectId: sid,
      subjectName: getSelectedSubjectName(),
      grade: _selectedGrade + _selectedTerm
    };
  }

  // 目前選中的 subjectId（由標籤算出）
  var _selectedGrade = '';
  var _selectedTerm = '';
  var _selectedSubjectCode = '';
  var _selectedChapters = [];

  function getSelectedSubjectId() {
    if (!_selectedGrade || !_selectedTerm || !_selectedSubjectCode) return null;
    return SG.Storage.buildSubjectId(_selectedSubjectCode, _selectedGrade, _selectedTerm);
  }

  function getSelectedSubjectName() {
    var tax = SG.Storage.getTaxonomy();
    var s = tax.subjects.find(function (x) { return x.code === _selectedSubjectCode; });
    return s ? s.name : '';
  }

  function updateTargetDisplay(targetDiv) {
    var sid = getSelectedSubjectId();
    if (!sid) {
      targetDiv.innerHTML = '<p class="muted" style="margin:8px 0;">請選擇年級、學期及科目，系統將自動決定匯入目標。</p>';
      return;
    }
    var existing = SG.Storage.getSubject(sid);
    var existingInfo = existing
      ? '（已有 ' + SG.Storage.flattenLessons(existing).length + ' 課，新課將合併）'
      : '（新科目）';
    var chapStr = _selectedChapters.length ? '　章節：' + _selectedChapters.join('、') : '';
    targetDiv.innerHTML =
      '<div class="import-target">' +
      '  <div>匯入目標：<b>' + SG.esc(getSelectedSubjectName()) + '</b> / ' +
      SG.esc(_selectedGrade) + SG.esc(_selectedTerm) + chapStr + ' ' + existingInfo + '</div>' +
      '  <div class="sid">subjectId: ' + SG.esc(sid) + '</div>' +
      '</div>';
  }

  function handleFiles(fileList, resultBox, opts) {
    if (!opts) {
      resultBox.innerHTML = '<p class="danger">✗ 請先選擇年級／學期／科目標籤。</p>';
      return;
    }
    resultBox.innerHTML = '<p class="muted">匯入中…</p>';
    SG.ContentLoader.importFromFiles(fileList, opts).then(function (res) {
      var ws = res.warnings || [];
      var stats = res.stats || { added: 0, updated: 0 };
      var totalLessons = SG.Storage.flattenLessons(res.subject).length;
      var html = '<p class="success">✓ 已匯入：<b>' + SG.esc(res.subject.subjectName) + '</b>' +
        '（新增 ' + stats.added + ' 課，更新 ' + stats.updated + ' 課，目前共 ' + totalLessons + ' 課）</p>';
      if (ws.length) {
        html += '<div class="warning-list"><b>⚠ 警告：</b><ul>';
        ws.forEach(function (w) { html += '<li>' + SG.esc(w) + '</li>'; });
        html += '</ul></div>';
      }
      resultBox.innerHTML = html;
      SG.toast('科目匯入成功', 'success');
      setTimeout(function () { render(document.getElementById('app-main')); }, 50);
    }).catch(function (err) {
      console.error('[Manage] 匯入失敗', err);
      resultBox.innerHTML = '<p class="danger">✗ 匯入失敗：' + SG.esc(err.message || err) + '</p>';
      SG.toast('匯入失敗', 'error');
    });
  }

  function countQuestions(subject) {
    return SG.Storage.flattenLessons(subject).reduce(function (s, l) {
      return s + (l.questions || []).length;
    }, 0);
  }

  // 匯出備份：同時提供下載 + textarea 複製（iOS 友善）
  function showExportModal(text) {
    var ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16);
    var filename = 'study-guy-backup-' + ts + '.json';
    var mask = document.createElement('div');
    mask.className = 'modal-mask';
    var card = document.createElement('div');
    card.className = 'modal-card';
    card.style.maxWidth = '600px';
    card.innerHTML =
      '<div class="modal-message"><b>💾 匯出備份</b><br>' +
      '可選擇下載檔案，或複製下方 JSON 內容貼到任何地方（Notes、Email、雲端硬碟等）。</div>' +
      '<textarea class="export-textarea" readonly></textarea>' +
      '<div class="modal-actions">' +
      '  <button class="btn btn-ghost" id="exp-copy">📋 複製到剪貼簿</button>' +
      '  <button class="btn btn-ghost" id="exp-download">⬇ 下載檔案</button>' +
      '  <button class="btn" id="exp-close">關閉</button>' +
      '</div>';
    var ta = card.querySelector('textarea');
    ta.value = text;
    mask.appendChild(card);
    document.body.appendChild(mask);

    card.querySelector('#exp-copy').addEventListener('click', function () {
      copyText(ta.value).then(function (ok) {
        SG.toast(ok ? '已複製到剪貼簿' : '複製失敗，請手動選取文字', ok ? 'success' : 'error');
      });
    });
    card.querySelector('#exp-download').addEventListener('click', function () {
      var blob = new Blob([text], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
      SG.toast('如未自動下載，請改用「複製」', 'success');
    });
    card.querySelector('#exp-close').addEventListener('click', function () {
      mask.remove();
    });
  }

  // 複製文字（同時支援現代 Clipboard API 與舊 fallback）
  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(function () { return true; }, function () { return fallbackCopy(text); });
    }
    return Promise.resolve(fallbackCopy(text));
  }
  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    ta.remove();
    return ok;
  }

  // ===== 標籤 UI =====
  function renderTagUI(container, targetDiv) {
    var tax = SG.Storage.getTaxonomy();
    container.innerHTML = '';

    // 年級（單選）
    container.appendChild(makeTagGroup('年級', tax.grades, _selectedGrade, false,
      function (val) { _selectedGrade = val; refreshTagUI(container, targetDiv); },
      function () {
        SG.modal.prompt('新增年級（例：中一）：').then(function (val) {
          if (!val) return;
          try { SG.Storage.addTaxonomyItem('grades', val.trim()); refreshTagUI(container, targetDiv); }
          catch (e) { SG.toast(e.message, 'error'); }
        });
      },
      function (val) {
        SG.modal.confirm('確定移除標籤「' + val + '」？').then(function (ok) {
          if (!ok) return;
          SG.Storage.removeTaxonomyItem('grades', val);
          if (_selectedGrade === val) _selectedGrade = '';
          refreshTagUI(container, targetDiv);
        });
      }
    ));

    // 學期（單選）
    container.appendChild(makeTagGroup('學期', tax.terms, _selectedTerm, false,
      function (val) { _selectedTerm = val; refreshTagUI(container, targetDiv); },
      function () {
        SG.modal.prompt('新增學期（例：暑假班）：').then(function (val) {
          if (!val) return;
          try { SG.Storage.addTaxonomyItem('terms', val.trim()); refreshTagUI(container, targetDiv); }
          catch (e) { SG.toast(e.message, 'error'); }
        });
      },
      function (val) {
        SG.modal.confirm('確定移除標籤「' + val + '」？').then(function (ok) {
          if (!ok) return;
          SG.Storage.removeTaxonomyItem('terms', val);
          if (_selectedTerm === val) _selectedTerm = '';
          refreshTagUI(container, targetDiv);
        });
      }
    ));

    // 科目（單選，顯示 name）
    var subjectItems = tax.subjects.map(function (s) { return s.name; });
    var selectedSubjectName = getSelectedSubjectName();
    container.appendChild(makeTagGroup('科目', subjectItems, selectedSubjectName, false,
      function (name) {
        var s = tax.subjects.find(function (x) { return x.name === name; });
        _selectedSubjectCode = s ? s.code : '';
        refreshTagUI(container, targetDiv);
      },
      function () {
        SG.modal.prompt('新科目顯示名稱（例：音樂）：').then(function (name) {
          if (!name) return;
          SG.modal.prompt('新科目英文代碼（例：music，只用英文小寫和減號）：').then(function (code) {
            if (!code) return;
            try {
              SG.Storage.addTaxonomyItem('subjects', { code: code.trim(), name: name.trim() });
              refreshTagUI(container, targetDiv);
            } catch (e) { SG.toast(e.message, 'error'); }
          });
        });
      },
      function (name) {
        var s = tax.subjects.find(function (x) { return x.name === name; });
        if (!s) return;
        SG.modal.confirm('確定移除科目「' + name + '」？').then(function (ok) {
          if (!ok) return;
          SG.Storage.removeTaxonomyItem('subjects', s.code);
          if (_selectedSubjectCode === s.code) _selectedSubjectCode = '';
          refreshTagUI(container, targetDiv);
        });
      }
    ));

    // 章節（多選，純摘要）
    container.appendChild(makeTagGroup('章節（可選，純摘要）', tax.chapters, _selectedChapters, true,
      function (val) {
        var idx = _selectedChapters.indexOf(val);
        if (idx >= 0) _selectedChapters.splice(idx, 1);
        else _selectedChapters.push(val);
        refreshTagUI(container, targetDiv);
      },
      function () {
        SG.modal.prompt('新增章節（例：第18課）：').then(function (val) {
          if (!val) return;
          try {
            SG.Storage.addTaxonomyItem('chapters', val.trim());
            refreshTagUI(container, targetDiv);
          } catch (e) { SG.toast(e.message, 'error'); }
        });
      },
      function (val) {
        SG.modal.confirm('確定移除標籤「' + val + '」？').then(function (ok) {
          if (!ok) return;
          SG.Storage.removeTaxonomyItem('chapters', val);
          var idx = _selectedChapters.indexOf(val);
          if (idx >= 0) _selectedChapters.splice(idx, 1);
          refreshTagUI(container, targetDiv);
        });
      }
    ));

    updateTargetDisplay(targetDiv);
  }

  function refreshTagUI(container, targetDiv) {
    renderTagUI(container, targetDiv);
  }

  // 建立一個標籤群組
  // items: string[]，selected: string（單選）或 string[]（多選），multi: boolean
  function makeTagGroup(label, items, selected, multi, onSelect, onAdd, onRemove) {
    var wrap = document.createElement('div');
    wrap.className = 'tag-group';
    var lbl = document.createElement('div');
    lbl.className = 'tag-group-label';
    lbl.textContent = label;
    wrap.appendChild(lbl);
    var row = document.createElement('div');
    row.className = 'tag-row';
    items.forEach(function (item) {
      var isActive = multi
        ? (Array.isArray(selected) && selected.indexOf(item) >= 0)
        : (selected === item);
      var btn = document.createElement('button');
      btn.className = 'tag-btn' + (isActive ? ' active' : '');
      btn.type = 'button';
      // 刪除 ×（只在非 active 時顯示，避免誤刪）
      btn.innerHTML = SG.esc(item) +
        '<span class="tag-remove" data-item="' + SG.esc(item) + '" title="移除此標籤">×</span>';
      btn.addEventListener('click', function (e) {
        if (e.target.classList.contains('tag-remove')) {
          // 由 onRemove 自行處理 confirm（為了支援 async modal）
          onRemove(item);
          return;
        }
        onSelect(item);
      });
      row.appendChild(btn);
    });
    var addBtn = document.createElement('button');
    addBtn.className = 'tag-add';
    addBtn.type = 'button';
    addBtn.textContent = '+ 新增';
    addBtn.addEventListener('click', onAdd);
    row.appendChild(addBtn);
    wrap.appendChild(row);
    return wrap;
  }

  // 已匯入科目列表
  function renderSubjectsCard() {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = '<h2 class="page-title">📚 已匯入科目</h2>';
    const subjects = SG.Storage.listSubjects();
    if (!subjects.length) {
      const p = document.createElement('p');
      p.className = 'muted';
      p.textContent = '尚未匯入任何科目。';
      card.appendChild(p);
      return card;
    }
    subjects.forEach(function (s) {
      const row = document.createElement('div');
      row.className = 'subject-row';
      const lessons = SG.Storage.flattenLessons(s);
      const totalQ = lessons.reduce(function (sum, l) { return sum + (l.questions || []).length; }, 0);
      row.innerHTML =
        '<div><b>' + SG.esc(s.subjectName) + '</b> ' +
        '<span class="meta">' + SG.esc(s.grade) + ' · ' + lessons.length + ' 課 · ' + totalQ + ' 題</span></div>' +
        '<div class="actions"><button class="btn-sm danger">刪除</button></div>';
      row.querySelector('button').addEventListener('click', function () {
        SG.modal.confirm('確定刪除科目「' + s.subjectName + '」？此操作不可還原。').then(function (ok) {
          if (!ok) return;
          SG.Storage.removeSubject(s.subjectId);
          SG.toast('已刪除', 'success');
          render(document.getElementById('app-main'));
        });
      });
      card.appendChild(row);
    });
    return card;
  }

  // 學生管理
  function renderStudentsCard() {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = '<h2 class="page-title">👥 考生管理</h2>';
    const students = SG.Storage.listStudents();
    if (!students.length) {
      const p = document.createElement('p');
      p.className = 'muted';
      p.textContent = '尚未建立考生。可在主頁新增。';
      card.appendChild(p);
      return card;
    }
    const GRADES = ['小一', '小二', '小三', '小四', '小五', '小六'];
    students.forEach(function (s) {
      const row = document.createElement('div');
      row.className = 'subject-row';
      const recCount = SG.Storage.listExamRecords({ studentId: s.id }).length;
      let gradeOpts = '';
      GRADES.forEach(function (g) {
        gradeOpts += '<option value="' + g + '"' + (s.grade === g ? ' selected' : '') + '>' + g + '</option>';
      });
      row.innerHTML =
        '<div><b>' + SG.esc(s.name) + '</b>' +
        (s.grade ? ' <span class="meta">' + SG.esc(s.grade) + '</span>' :
          ' <span class="danger">⚠ 未設定年級</span>') +
        '<br><span class="muted" style="font-size:13px;">' + recCount + ' 次考試記錄</span></div>' +
        '<div class="actions">' +
        '<select class="grade-select" style="width:100px;padding:6px 8px;font-size:14px;">' +
        '<option value="">— 修改年級 —</option>' + gradeOpts + '</select>' +
        '<button class="btn-sm danger">刪除</button>' +
        '</div>';
      const select = row.querySelector('.grade-select');
      const delBtn = row.querySelector('button.danger');
      select.addEventListener('change', function () {
        if (!select.value) return;
        try {
          SG.Storage.updateStudent(s.id, { grade: select.value });
          SG.toast('已更新年級為 ' + select.value, 'success');
          render(document.getElementById('app-main'));
        } catch (e) { SG.toast(e.message, 'error'); }
      });
      delBtn.addEventListener('click', function () {
        SG.modal.confirm('確定刪除考生「' + s.name + '」？所有考試記錄會一併刪除。').then(function (ok) {
          if (!ok) return;
          SG.Storage.removeStudent(s.id);
          var settings = SG.Storage.getSettings();
          if (settings.activeStudentId === s.id) {
            SG.Storage.updateSettings({ activeStudentId: null });
          }
          SG.toast('已刪除', 'success');
          render(document.getElementById('app-main'));
        });
      });
      card.appendChild(row);
    });
    return card;
  }

  // 備份／還原
  function renderBackupCard() {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML =
      '<h2 class="page-title">💾 備份與還原</h2>' +
      '<p class="muted">把所有資料（科目、考生、考試記錄）匯出為一個 JSON 檔，方便備份或轉移到其他電腦。</p>' +
      '<div class="row">' +
      '  <button class="btn" id="sg-export">匯出全部資料</button>' +
      '  <button class="btn btn-ghost" id="sg-restore">從備份還原…</button>' +
      '  <input type="file" id="sg-restore-input" accept=".json,application/json" style="display:none;">' +
      '</div>';
    card.querySelector('#sg-export').addEventListener('click', function () {
      var data = SG.Storage.exportAll();
      var text = JSON.stringify(data, null, 2);
      showExportModal(text);
    });
    const restoreBtn = card.querySelector('#sg-restore');
    const restoreInput = card.querySelector('#sg-restore-input');
    restoreBtn.addEventListener('click', function () { restoreInput.click(); });
    restoreInput.addEventListener('change', function () {
      var f = restoreInput.files[0];
      if (!f) return;
      SG.modal.confirm('還原會覆蓋現有資料，是否繼續？').then(function (ok) {
        if (!ok) return;
        var reader = new FileReader();
        reader.onload = function () {
          try {
            var data = JSON.parse(reader.result);
            SG.Storage.importAll(data, { replace: true });
            SG.toast('還原成功', 'success');
            render(document.getElementById('app-main'));
          } catch (e) { SG.toast('還原失敗：' + e.message, 'error'); }
        };
        reader.readAsText(f);
      });
    });
    return card;
  }

  SG.registerView('manage', { render: render });
})();
