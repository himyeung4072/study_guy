/* ===== History View =====
   顯示目前考生的所有考試記錄、分數趨勢、按科目累積弱項分析。
*/
(function () {
  'use strict';
  const SG = window.StudyGuy;

  function render(container) {
    const settings = SG.Storage.getSettings();
    const stu = settings.activeStudentId ? SG.Storage.getStudent(settings.activeStudentId) : null;
    container.innerHTML = '';
    if (!stu) {
      container.innerHTML =
        '<div class="card"><h2 class="page-title">考試記錄</h2>' +
        '<p class="muted">請先到 <a href="#/home">主頁</a> 選擇考生。</p></div>';
      return;
    }
    const records = SG.Storage.listExamRecords({ studentId: stu.id })
      .slice()
      .sort(function (a, b) { return new Date(a.endedAt) - new Date(b.endedAt); });
    if (!records.length) {
      container.innerHTML =
        '<div class="card"><h2 class="page-title">📊 ' + SG.esc(stu.name) + ' 的考試記錄</h2>' +
        '<p class="muted">尚未有任何考試記錄。回 <a href="#/home">主頁</a> 開始第一次考試吧。</p></div>';
      return;
    }
    container.appendChild(renderTrendCard(stu, records));
    container.appendChild(renderWeaknessCard(stu, records));
    container.appendChild(renderListCard(stu, records));
  }

  // 分數趨勢
  function renderTrendCard(stu, records) {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML =
      '<h2 class="page-title">📈 ' + SG.esc(stu.name) + ' · 分數趨勢</h2>' +
      '<p class="muted">最近 ' + records.length + ' 次考試（左→右為時間順序）。</p>';
    const trend = document.createElement('div');
    trend.className = 'trend';
    records.forEach(function (r) {
      const bar = document.createElement('div');
      bar.className = 'bar';
      if (r.score >= 80) bar.classList.add('high');
      else if (r.score < 60) bar.classList.add('low');
      bar.style.height = Math.max(4, r.score) + '%';
      bar.setAttribute('data-score', r.score);
      bar.title = SG.esc(r.subjectName) + ' · ' + new Date(r.endedAt).toLocaleString();
      trend.appendChild(bar);
    });
    card.appendChild(trend);
    return card;
  }

  // 按科目累積弱項分析（取記錄中曾考過的所有科目）
  function renderWeaknessCard(stu, records) {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = '<h2 class="page-title">🎯 累積按課表現（弱項提示）</h2>';
    // 整理出曾考過的科目 ID
    const subjIds = {};
    records.forEach(function (r) {
      subjIds[r.subjectId] = r.subjectName;
    });
    const ids = Object.keys(subjIds);
    if (!ids.length) {
      card.appendChild(makeMuted('沒有考試資料可分析。'));
      return card;
    }
    ids.forEach(function (sid) {
      const w = SG.Weakness.analyze(stu.id, sid);
      const block = document.createElement('div');
      block.style.marginBottom = '20px';
      const subj = SG.Storage.getSubject(sid);
      block.innerHTML = '<h3 style="margin:8px 0;">' + SG.esc(subjIds[sid]) +
        '（' + w.examCount + ' 次考試）</h3>';
      const wrap = document.createElement('div');
      wrap.className = 'lesson-bars';
      const lessonNames = lessonNameMap(subj);
      Object.keys(w.byLesson).sort().forEach(function (lid) {
        const o = w.byLesson[lid];
        const pct = Math.round(o.accuracy * 100);
        const weak = w.weakLessonIds.indexOf(lid) >= 0;
        const row = document.createElement('div');
        row.className = 'lesson-bar' + (weak ? ' weak' : '');
        row.innerHTML =
          '<div class="name">' + SG.esc(lessonNames[lid] || lid) +
          ' <span class="muted">(' + o.correct + '/' + o.total + ')</span>' +
          (weak ? ' <span class="badge multi">弱項</span>' : '') + '</div>' +
          '<div class="pct">' + pct + '%</div>' +
          '<div class="bar"><span style="width:' + pct + '%"></span></div>';
        wrap.appendChild(row);
      });
      block.appendChild(wrap);
      card.appendChild(block);
    });
    return card;
  }

  function lessonNameMap(subject) {
    const m = {};
    if (!subject) return m;
    SG.Storage.flattenLessons(subject).forEach(function (l) {
      m[l.lessonId] = l.lessonName;
    });
    return m;
  }

  // 考試記錄列表（最新在上）
  function renderListCard(stu, records) {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = '<h2 class="page-title">📋 考試記錄</h2>';
    const list = records.slice().reverse();
    list.forEach(function (r) {
      const row = document.createElement('div');
      row.className = 'history-row';
      let cls = 'score-pill';
      if (r.score >= 80) cls += ' high';
      else if (r.score < 60) cls += ' low';
      row.innerHTML =
        '<div><b>' + SG.esc(r.subjectName) + '</b>' +
        ' <span class="when">' + new Date(r.endedAt).toLocaleString() + '</span><br>' +
        '<span class="muted" style="font-size:13px;">答對 ' + r.correctCount + '/' + r.totalQuestions +
        ' 題　·　用時 ' + formatDuration(r.durationSec) + '</span></div>' +
        '<div class="' + cls + '">' + r.score + '</div>' +
        '<button class="btn-sm">查看詳情</button>';
      row.querySelector('button').addEventListener('click', function () {
        SG._lastResult = { recordId: r.id };
        SG.navigate('result');
      });
      card.appendChild(row);
    });
    return card;
  }

  function formatDuration(sec) {
    if (!sec || sec < 60) return (sec || 0) + ' 秒';
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return m + ' 分 ' + (s ? s + ' 秒' : '');
  }

  function makeMuted(text) {
    const p = document.createElement('p');
    p.className = 'muted';
    p.textContent = text;
    return p;
  }

  SG.registerView('history', { render: render });
})();
