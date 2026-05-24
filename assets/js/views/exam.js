/* ===== Exam View =====
   流程：
   1) 進入時：依目前考生 + 科目，呼叫 buildQuiz（自動加入弱項加權）
      把 quiz 與作答狀態存到 SG._examState（避免重新整理）
   2) 顯示 25 題，可自由切換題號、單選/多選分別用 radio/checkbox
   3) 提交時轉去 #/result
*/
(function () {
  'use strict';
  const SG = window.StudyGuy;

  function render(container) {
    const settings = SG.Storage.getSettings();
    const stu = settings.activeStudentId ? SG.Storage.getStudent(settings.activeStudentId) : null;
    const subj = settings.activeSubjectId ? SG.Storage.getSubject(settings.activeSubjectId) : null;
    container.innerHTML = '';
    if (!stu || !subj) {
      container.innerHTML =
        '<div class="card"><h2 class="page-title">考試</h2>' +
        '<p class="muted">請先到 <a href="#/home">主頁</a> 選擇考生及科目。</p></div>';
      return;
    }
    // 若沒有現存考試，或現存考試科目／考生對不上，重新抽題
    let st = SG._examState;
    if (!st || st.studentId !== stu.id || st.subjectId !== subj.subjectId || st.submitted) {
      st = startNewExam(stu, subj);
    }
    container.appendChild(renderExamCard(st));
  }

  function startNewExam(stu, subj) {
    const w = SG.Weakness.analyze(stu.id, subj.subjectId);
    const total = SG.Exam.DEFAULT_TOTAL;
    const quiz = SG.Exam.buildQuiz(subj, { total: total, weakLessonIds: w.weakLessonIds });
    const st = {
      studentId: stu.id,
      studentName: stu.name,
      subjectId: subj.subjectId,
      subjectName: subj.subjectName,
      weakLessonIds: w.weakLessonIds.slice(),
      quiz: quiz,
      picks: {},  // questionId -> number[]
      currentIdx: 0,
      startedAt: new Date().toISOString(),
      submitted: false
    };
    SG._examState = st;
    return st;
  }

  function renderExamCard(st) {
    const card = document.createElement('div');
    card.className = 'card';
    const total = st.quiz.length;
    const cur = st.currentIdx;
    const q = st.quiz[cur];
    const answeredCount = Object.keys(st.picks).filter(function (qid) {
      return (st.picks[qid] || []).length > 0;
    }).length;

    let html =
      '<div class="exam-header">' +
      '  <div style="display:flex;justify-content:space-between;align-items:center;">' +
      '    <h2 class="page-title" style="margin:0;">📝 ' + SG.esc(st.subjectName) + ' 模擬考試</h2>' +
      '    <button class="btn btn-ghost" id="sg-cancel-exam" style="font-size:14px;padding:8px 14px;">✕ 離開考試</button>' +
      '  </div>' +
      '  <p class="muted" style="margin:6px 0 0;">考生：<b>' + SG.esc(st.studentName) + '</b>　·　已答 ' +
      answeredCount + ' / ' + total + ' 題' +
      (st.weakLessonIds.length ? '　·　已針對弱項加強出題' : '') +
      '</p>' +
      '</div>';

    // 題號導覽
    html += '<div class="qnum-grid">';
    for (let i = 0; i < total; i++) {
      const qq = st.quiz[i];
      const answered = (st.picks[qq.id] || []).length > 0;
      const isCur = i === cur;
      const cls = 'qnum' + (isCur ? ' current' : '') + (answered ? ' answered' : '');
      html += '<button type="button" class="' + cls + '" data-idx="' + i + '">' + (i + 1) + '</button>';
    }
    html += '</div>';
    card.innerHTML = html;

    // 題目主體
    card.appendChild(renderQuestionBlock(q, cur, total, st));

    // 題號導覽事件
    card.querySelectorAll('.qnum').forEach(function (btn) {
      btn.addEventListener('click', function () {
        st.currentIdx = parseInt(btn.getAttribute('data-idx'), 10);
        render(document.getElementById('app-main'));
      });
    });

    return card;
  }

  function renderQuestionBlock(q, idx, total, st) {
    const wrap = document.createElement('div');
    wrap.className = 'question-block';
    const picked = st.picks[q.id] || [];
    const isMulti = q.type === 'multiple';

    let html =
      '<div class="qmeta muted">第 ' + (idx + 1) + ' / ' + total + ' 題　·　' +
      (isMulti ? '<span class="badge multi">多選題</span>' : '<span class="badge single">單選題</span>') +
      '</div>' +
      '<h3 class="qtext">' + SG.esc(q.question) + '</h3>' +
      '<div class="options">';
    q.options.forEach(function (opt, oi) {
      const id = 'opt-' + q.id + '-' + oi;
      const checked = picked.indexOf(oi) >= 0 ? 'checked' : '';
      const inputType = isMulti ? 'checkbox' : 'radio';
      html +=
        '<label class="option' + (checked ? ' checked' : '') + '" for="' + id + '">' +
        '  <input type="' + inputType + '" id="' + id + '" name="opt-' + q.id + '" data-idx="' + oi + '" ' + checked + '>' +
        '  <span>' + SG.esc(opt) + '</span>' +
        '</label>';
    });
    html += '</div>';

    // 導覽按鈕
    html += '<div class="row" style="margin-top:20px;justify-content:space-between;">';
    html += '  <button class="btn btn-ghost" id="sg-prev"' + (idx === 0 ? ' disabled' : '') + '>← 上一題</button>';
    if (idx < total - 1) {
      html += '  <button class="btn" id="sg-next">下一題 →</button>';
    } else {
      html += '  <button class="btn btn-accent" id="sg-submit">提交答案</button>';
    }
    html += '</div>';

    wrap.innerHTML = html;

    // 選項事件
    wrap.querySelectorAll('.option input').forEach(function (input) {
      input.addEventListener('change', function () {
        const oi = parseInt(input.getAttribute('data-idx'), 10);
        let cur = (st.picks[q.id] || []).slice();
        if (isMulti) {
          if (input.checked) { if (cur.indexOf(oi) < 0) cur.push(oi); }
          else { cur = cur.filter(function (x) { return x !== oi; }); }
        } else {
          cur = [oi];
        }
        st.picks[q.id] = cur;
        // 即時更新該選項視覺
        wrap.querySelectorAll('.option').forEach(function (lab) {
          const inp = lab.querySelector('input');
          lab.classList.toggle('checked', inp.checked);
        });
      });
    });
    return wrap;
  }

  // 攔截導覽按鈕（事件委派）：在 card 渲染後 attach 一次
  document.addEventListener('click', function (e) {
    const t = e.target;
    if (!t || t.nodeType !== 1) return;
    const st = SG._examState;
    if (!st || st.submitted) return;
    if (t.id === 'sg-prev') {
      st.currentIdx = Math.max(0, st.currentIdx - 1);
      render(document.getElementById('app-main'));
    } else if (t.id === 'sg-next') {
      st.currentIdx = Math.min(st.quiz.length - 1, st.currentIdx + 1);
      render(document.getElementById('app-main'));
    } else if (t.id === 'sg-submit') {
      submitExam(st);
    } else if (t.id === 'sg-cancel-exam') {
      SG.modal.confirm('確定離開考試？目前的作答進度將不會儲存。').then(function (ok) {
        if (!ok) return;
        SG._examState = null;
        SG.navigate('home');
      });
    }
  });

  function submitExam(st) {
    var unanswered = st.quiz.filter(function (q) {
      return !(st.picks[q.id] && st.picks[q.id].length);
    });
    var proceed = unanswered.length
      ? SG.modal.confirm('還有 ' + unanswered.length + ' 題未作答，確定提交？')
      : Promise.resolve(true);
    proceed.then(function (ok) {
      if (!ok) return;
      doSubmit(st);
    });
  }

  function doSubmit(st) {
    var result = SG.Exam.grade(st.quiz, st.picks);
    var endedAt = new Date().toISOString();
    var durationSec = Math.max(1,
      Math.round((new Date(endedAt) - new Date(st.startedAt)) / 1000));
    var record = SG.Storage.addExamRecord({
      studentId: st.studentId,
      subjectId: st.subjectId,
      subjectName: st.subjectName,
      startedAt: st.startedAt,
      endedAt: endedAt,
      durationSec: durationSec,
      totalQuestions: result.totalQuestions,
      correctCount: result.correctCount,
      score: result.score,
      answers: result.answers
    });
    st.submitted = true;
    SG._lastResult = { recordId: record.id };
    SG.navigate('result');
  }

  SG.registerView('exam', { render: render });
})();
