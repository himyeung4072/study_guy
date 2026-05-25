/* ===== Study View =====
   顯示已選科目的單元／課別樹，點某課顯示溫習筆記
*/
(function () {
  'use strict';
  const SG = window.StudyGuy;

  function render(container, params) {
    const settings = SG.Storage.getSettings();
    const subj = settings.activeSubjectId ? SG.Storage.getSubject(settings.activeSubjectId) : null;
    container.innerHTML = '';
    if (!subj) {
      container.innerHTML =
        '<div class="card"><h2 class="page-title">溫習</h2>' +
        '<p class="muted">尚未選擇科目。請回 <a href="#/home">主頁</a> 選擇科目。</p></div>';
      return;
    }
    // params[0] = lessonId（可選）
    const lessonId = params && params[0];
    if (lessonId) {
      const lesson = findLesson(subj, lessonId);
      if (!lesson) {
        container.innerHTML = '<div class="card"><p class="danger">找不到該課：' + SG.esc(lessonId) + '</p></div>';
        return;
      }
      container.appendChild(renderLessonNotes(subj, lesson));
    } else {
      container.appendChild(renderLessonList(subj));
    }
  }

  function findLesson(subj, lessonId) {
    const all = SG.Storage.flattenLessons(subj);
    return all.find(function (l) { return l.lessonId === lessonId; }) || null;
  }

  // 列表頁：平鋪顯示所有課別（schema 2.0）
  function renderLessonList(subj) {
    var card = document.createElement('div');
    card.className = 'card';
    var html = '<h2 class="page-title">📖 溫習：' + SG.esc(subj.subjectName) + '</h2>' +
      '<p class="muted">' + SG.esc(subj.grade) + '</p>';
    var lessons = SG.Storage.flattenLessons(subj);
    if (!lessons.length) {
      html += '<p class="muted">此科目尚未匯入任何課別。</p>';
      card.innerHTML = html;
      return card;
    }
    html += '<div class="lesson-list" style="margin-top:12px;">';
    lessons.forEach(function (l) {
      var qn = (l.questions || []).length;
      html += '<a class="tile" href="#/study/' + encodeURIComponent(l.lessonId) + '">' +
        '<h3>' + SG.esc(l.lessonName) + '</h3>' +
        '<p>' + qn + ' 條題目</p></a>';
    });
    html += '</div>';
    card.innerHTML = html;
    return card;
  }

  // 詳細頁：顯示某課筆記
  function renderLessonNotes(subj, lesson) {
    const card = document.createElement('div');
    card.className = 'card notes-section';
    const n = lesson.notes || {};
    let html = '<a href="#/study" class="muted">← 返回課別列表</a>' +
      '<h2 class="page-title" style="margin-top:8px;">' + SG.esc(lesson.lessonName) + '</h2>';

    // 切換按鈕：重點 / 原文
    var hasOriginal = !!(n.originalText);
    if (hasOriginal) {
      html += '<div class="view-tabs" style="margin-bottom:16px;">' +
        '<button class="tab-btn active" data-tab="notes">重點</button>' +
        '<button class="tab-btn" data-tab="original">原文</button>' +
        '</div>';
    }

    // 重點內容區
    html += '<div class="tab-content" data-content="notes">';
    if (n.summary) {
      html += '<h3>本課摘要</h3>' + formatSummary(n.summary);
    }
    if (n.sections && n.sections.length) {
      n.sections.forEach(function (sec) {
        html += '<div class="note-section">';
        html += '<h3>' + (sec.icon ? '<span class="icon">' + SG.esc(sec.icon) + '</span> ' : '') +
          SG.esc(sec.title) + '</h3>';
        html += '<ul>';
        sec.points.forEach(function (p) { html += '<li>' + SG.esc(p) + '</li>'; });
        html += '</ul></div>';
      });
    } else if (n.keyPoints && n.keyPoints.length) {
      html += '<h3>重點</h3><ul>';
      n.keyPoints.forEach(function (p) { html += '<li>' + SG.esc(p) + '</li>'; });
      html += '</ul>';
    }
    if (n.highlights && n.highlights.length) {
      n.highlights.forEach(function (h) {
        html += '<div class="note-highlight">';
        html += '<h3>✦ ' + SG.esc(h.title) + '</h3><ol>';
        h.points.forEach(function (p) { html += '<li>' + SG.esc(p) + '</li>'; });
        html += '</ol></div>';
      });
    }
    if (n.keywords && n.keywords.length) {
      html += '<h3>關鍵詞</h3><div class="kw-list">';
      n.keywords.forEach(function (k) {
        html += '<div class="kw-item"><b>' + SG.esc(k.term) + '</b>：' +
          SG.esc(k.definition) + '</div>';
      });
      html += '</div>';
    }
    if (n.examples && n.examples.length) {
      html += '<h3>例子</h3><ul>';
      n.examples.forEach(function (e) { html += '<li>' + SG.esc(e) + '</li>'; });
      html += '</ul>';
    }
    html += '</div>'; // end tab-content notes

    // 原文內容區
    if (hasOriginal) {
      html += '<div class="tab-content" data-content="original" style="display:none;">' +
        '<div class="original-text">' + renderMarkdown(n.originalText) + '</div>' +
        '</div>';
    }

    html += '<div class="row" style="margin-top:20px;">' +
      '<button class="btn" onclick="location.hash=\'#/study\'">返回課別</button>' +
      '<button class="btn btn-accent" onclick="location.hash=\'#/exam\'">準備好了，開始考試</button>' +
      '</div>';
    card.innerHTML = html;

    // 綁定 tab 切換事件
    if (hasOriginal) {
      var tabs = card.querySelectorAll('.tab-btn');
      var contents = card.querySelectorAll('.tab-content');
      tabs.forEach(function (tab) {
        tab.addEventListener('click', function () {
          tabs.forEach(function (t) { t.classList.remove('active'); });
          tab.classList.add('active');
          var target = tab.getAttribute('data-tab');
          contents.forEach(function (c) {
            c.style.display = c.getAttribute('data-content') === target ? '' : 'none';
          });
        });
      });
    }

    return card;
  }

  // A：格式化 summary — 將「本課分X部分：(1)...(2)...」拆成列表
  function formatSummary(summary) {
    // 嘗試拆分：找「本課分X部分：」或「本課分X部分:」後面的內容
    var match = summary.match(/^([\s\S]*?)(本課分[^：:]*[：:])\s*([\s\S]*)$/);
    if (!match) {
      // 無法匹配，直接 pre-line 顯示
      return '<p style="white-space:pre-line;">' + SG.esc(summary) + '</p>';
    }
    var intro = match[1].trim();
    var heading = match[2];
    var rest = match[3].trim();
    var html = '';
    if (intro) {
      html += '<p>' + SG.esc(intro) + '</p>';
    }
    html += '<p style="margin-top:8px;">' + SG.esc(heading) + '</p>';
    // 拆分各部分：支援 (1)...(2)... 或 1.... 2.... 格式
    var parts = rest.split(/[；;]\s*(?=\(\d+\)|\d+[\.\s])/).filter(Boolean);
    if (parts.length <= 1) {
      // 嘗試用 ；分隔
      parts = rest.split(/[；;]\s*/).filter(Boolean);
    }
    if (parts.length <= 1) {
      // 無法拆分，直接顯示
      html += '<p>' + SG.esc(rest) + '</p>';
    } else {
      html += '<ol class="summary-parts">';
      parts.forEach(function (p) {
        // 移除開頭的 (1) 或 1. 編號
        var cleaned = p.replace(/^\(\d+\)\s*/, '').replace(/^\d+[\.\s]+/, '').trim();
        html += '<li>' + SG.esc(cleaned) + '</li>';
      });
      html += '</ol>';
    }
    return html;
  }

  // C：簡易 markdown 渲染（用於原文顯示）
  function renderMarkdown(text) {
    if (!text) return '';
    var lines = text.split('\n');
    var html = '';
    var inList = false;
    lines.forEach(function (line) {
      // 標題
      if (/^####\s/.test(line)) {
        if (inList) { html += '</ul>'; inList = false; }
        html += '<h4>' + SG.esc(line.replace(/^####\s*/, '')) + '</h4>';
      } else if (/^###\s/.test(line)) {
        if (inList) { html += '</ul>'; inList = false; }
        html += '<h3>' + SG.esc(line.replace(/^###\s*/, '')) + '</h3>';
      } else if (/^##\s/.test(line)) {
        if (inList) { html += '</ul>'; inList = false; }
        html += '<h2>' + SG.esc(line.replace(/^##\s*/, '')) + '</h2>';
      } else if (/^\s*[\*\-]\s/.test(line)) {
        if (!inList) { html += '<ul>'; inList = true; }
        var content = line.replace(/^\s*[\*\-]\s*/, '');
        html += '<li>' + escBold(content) + '</li>';
      } else if (/^\s*\d+\.\s/.test(line)) {
        if (inList) { html += '</ul>'; inList = false; }
        var content2 = line.replace(/^\s*\d+\.\s*/, '');
        html += '<p style="margin:4px 0;padding-left:16px;">' + escBold(content2) + '</p>';
      } else if (/^>\s/.test(line)) {
        if (inList) { html += '</ul>'; inList = false; }
        html += '<blockquote>' + escBold(line.replace(/^>\s*/, '')) + '</blockquote>';
      } else if (line.trim() === '' || line.trim() === '---') {
        if (inList) { html += '</ul>'; inList = false; }
        if (line.trim() === '') html += '<br>';
      } else {
        if (inList) { html += '</ul>'; inList = false; }
        html += '<p>' + escBold(line) + '</p>';
      }
    });
    if (inList) html += '</ul>';
    return html;
  }

  // 處理 **粗體** 標記
  function escBold(text) {
    var escaped = SG.esc(text);
    return escaped.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
  }

  SG.registerView('study', { render: render });
})();
