/* ===== Result View =====
   接收最近一次考試記錄，顯示總分、按課表現、逐題回顧。
   來源：SG._lastResult.recordId（exam.js 提交時設定）
*/
(function () {
  'use strict';
  const SG = window.StudyGuy;

  function render(container) {
    container.innerHTML = '';
    const recordId = SG._lastResult && SG._lastResult.recordId;
    let record = null;
    if (recordId) {
      record = SG.Storage.listExamRecords().find(function (r) {
        return r.id === recordId;
      });
    }
    if (!record) {
      container.innerHTML =
        '<div class="card"><h2 class="page-title">考試結果</h2>' +
        '<p class="muted">沒有最近的考試記錄。請到 <a href="#/history">考試記錄</a> 查看歷次成績。</p></div>';
      return;
    }
    container.appendChild(renderHero(record));
    container.appendChild(renderLessonBars(record));
    container.appendChild(renderReview(record));
    container.appendChild(renderActions(record));
  }

  // 大分數區塊
  function renderHero(rec) {
    const card = document.createElement('div');
    card.className = 'card';
    const dur = formatDuration(rec.durationSec);
    card.innerHTML =
      '<div class="score-hero">' +
      '  <div class="meta">' + SG.esc(rec.subjectName) + '</div>' +
      '  <div class="big">' + rec.score + '</div>' +
      '  <div class="meta">答對 ' + rec.correctCount + ' / ' + rec.totalQuestions +
      ' 題　·　用時 ' + SG.esc(dur) + '</div>' +
      '</div>';
    return card;
  }

  function formatDuration(sec) {
    if (!sec || sec < 60) return (sec || 0) + ' 秒';
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return m + ' 分 ' + (s ? s + ' 秒' : '');
  }

  // 按課表現（本次考試）
  function renderLessonBars(rec) {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = '<h2 class="page-title">📊 本次按課表現</h2>';
    const byLesson = {};
    rec.answers.forEach(function (a) {
      const o = byLesson[a.lessonId] || { lessonId: a.lessonId, lessonName: a.lessonName, total: 0, correct: 0 };
      o.total += 1;
      if (a.isCorrect) o.correct += 1;
      byLesson[a.lessonId] = o;
    });
    const wrap = document.createElement('div');
    wrap.className = 'lesson-bars';
    Object.keys(byLesson).sort().forEach(function (lid) {
      const o = byLesson[lid];
      const pct = o.total ? Math.round(o.correct / o.total * 100) : 0;
      const weak = pct < SG.Weakness.THRESHOLD * 100;
      const row = document.createElement('div');
      row.className = 'lesson-bar' + (weak ? ' weak' : '');
      row.innerHTML =
        '<div class="name">' + SG.esc(o.lessonName || lid) +
        ' <span class="muted">(' + o.correct + '/' + o.total + ')</span></div>' +
        '<div class="pct">' + pct + '%</div>' +
        '<div class="bar"><span style="width:' + pct + '%"></span></div>';
      wrap.appendChild(row);
    });
    card.appendChild(wrap);
    return card;
  }

  // 逐題回顧
  function renderReview(rec) {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = '<h2 class="page-title">📝 逐題回顧</h2>';
    rec.answers.forEach(function (a, i) {
      const item = document.createElement('div');
      item.className = 'review-item ' + (a.isCorrect ? 'correct' : 'wrong');
      const correctSet = {};
      (a.correct || []).forEach(function (x) { correctSet[x] = true; });
      const pickedSet = {};
      (a.picked || []).forEach(function (x) { pickedSet[x] = true; });
      let html = '<p class="q">' + (i + 1) + '. ' + SG.esc(a.question) +
        ' <span class="badge ' + (a.type === 'multiple' ? 'multi' : 'single') + '">' +
        (a.type === 'multiple' ? '多選' : '單選') + '</span>' +
        ' <span class="muted" style="font-size:13px;">[' + SG.esc(a.lessonName || a.lessonId) + ']</span></p>';
      html += '<div class="opts">';
      a.options.forEach(function (opt, oi) {
        let cls = 'opt';
        if (correctSet[oi]) cls += ' is-correct';
        else if (pickedSet[oi]) cls += ' is-picked-wrong';
        const mark = correctSet[oi] ? ' ✓' : (pickedSet[oi] ? ' ✗' : '');
        html += '<div class="' + cls + '">' + SG.esc(opt) + mark + '</div>';
      });
      html += '</div>';
      if (a.explanation) html += '<div class="explain"><b>解釋：</b>' + SG.esc(a.explanation) + '</div>';
      if (a.source) html += '<p class="muted" style="margin:6px 0 0;font-size:13px;">📖 ' + SG.esc(a.source) + '</p>';
      item.innerHTML = html;
      card.appendChild(item);
    });
    return card;
  }

  // 後續動作
  function renderActions(rec) {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML =
      '<div class="row" style="justify-content:center;">' +
      '  <button class="btn btn-ghost" id="sg-go-history">查看歷史記錄</button>' +
      '  <button class="btn" id="sg-go-home">返回主頁</button>' +
      '  <button class="btn btn-accent" id="sg-go-exam-again">再考一次</button>' +
      '</div>';
    card.querySelector('#sg-go-history').addEventListener('click', function () { SG.navigate('history'); });
    card.querySelector('#sg-go-home').addEventListener('click', function () { SG.navigate('home'); });
    card.querySelector('#sg-go-exam-again').addEventListener('click', function () {
      SG._examState = null; // 強制重新抽題
      SG.navigate('exam');
    });
    return card;
  }

  SG.registerView('result', { render: render });
})();
