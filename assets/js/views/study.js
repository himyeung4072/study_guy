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
    if (n.summary) {
      html += '<h3>本課摘要</h3><p style="white-space:pre-line;">' + SG.esc(n.summary) + '</p>';
    }
    // 1.1 sections（如有）優先用，否則 fallback 到 keyPoints
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
    // 1.1 highlights（重點摘要框）
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
    html += '<div class="row" style="margin-top:20px;">' +
      '<button class="btn" onclick="location.hash=\'#/study\'">返回課別</button>' +
      '<button class="btn btn-accent" onclick="location.hash=\'#/exam\'">準備好了，開始考試</button>' +
      '</div>';
    card.innerHTML = html;
    return card;
  }

  SG.registerView('study', { render: render });
})();
