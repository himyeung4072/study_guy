/* ===== Exam Engine 模組 =====
   核心：抽題 + 計分 + 產生答題 detail（含 lessonId 用於弱項分析）
   抽題策略：
   - 預設 25 題（可由 settings 覆寫）
   - 80% 單選 + 20% 多選（25 題 = 20 單選 + 5 多選）
   - 平均分配到各課
   - 若有弱項：弱項 50% + 其餘平均 50%
*/
(function () {
  'use strict';
  const SG = window.StudyGuy = window.StudyGuy || {};

  const DEFAULT_TOTAL = 25;
  const SINGLE_RATIO = 0.8; // 80% 單選

  // Fisher–Yates 洗牌（不變動原陣列）
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  // 從 array 中以個數 n 抽（不夠則回傳全部）
  function pickN(arr, n) {
    if (n <= 0 || !arr.length) return [];
    return shuffle(arr).slice(0, Math.min(n, arr.length));
  }

  // 將科目的 lessons 按 lessonId 分桶，並依題型分組
  function buildLessonPool(subject) {
    const lessons = SG.Storage.flattenLessons(subject);
    return lessons.map(function (l) {
      const single = (l.questions || []).filter(function (q) { return q.type === 'single'; });
      const multi = (l.questions || []).filter(function (q) { return q.type === 'multiple'; });
      return {
        lessonId: l.lessonId,
        lessonName: l.lessonName,
        unitId: l.unitId,
        unitName: l.unitName,
        single: single,
        multiple: multi
      };
    });
  }

  // 平均分配題數至 lessons：總共 totalCount 題，盡量平均
  function distributeEvenly(lessons, totalCount) {
    const out = {};
    lessons.forEach(function (l) { out[l.lessonId] = 0; });
    const ids = lessons.map(function (l) { return l.lessonId; });
    if (!ids.length) return out;
    let i = 0;
    for (let k = 0; k < totalCount; k++) {
      out[ids[i % ids.length]] += 1;
      i++;
    }
    return out;
  }

  // 對一條題目的選項做洗牌，同步調整 answer index
  function shuffleOptions(q) {
    const n = q.options.length;
    // 建立 [0,1,2,...,n-1] 的新順序
    const order = shuffle(q.options.map(function (_, i) { return i; }));
    const newOptions = order.map(function (i) { return q.options[i]; });
    // 把舊 answer index 映射到新位置
    const reverseMap = {};
    order.forEach(function (oldIdx, newIdx) { reverseMap[oldIdx] = newIdx; });
    const newAnswer = q.answer.map(function (oldIdx) { return reverseMap[oldIdx]; }).sort(function (a, b) { return a - b; });
    return Object.assign({}, q, { options: newOptions, answer: newAnswer });
  }

  // 主抽題：回傳要考的 question 陣列（已附上 lessonId）
  function buildQuiz(subject, options) {
    options = options || {};
    const total = options.total || DEFAULT_TOTAL;
    const singleCount = Math.round(total * SINGLE_RATIO);
    const multiCount = total - singleCount;
    const weakLessonIds = (options.weakLessonIds || []).slice();

    const pool = buildLessonPool(subject);
    if (!pool.length) throw new Error('科目沒有任何課別');

    // 依弱項拆兩組
    const weakLessons = pool.filter(function (l) { return weakLessonIds.indexOf(l.lessonId) >= 0; });
    const restLessons = pool.filter(function (l) { return weakLessonIds.indexOf(l.lessonId) < 0; });

    // 計算弱項分佔比例
    const useWeak = weakLessons.length > 0 && restLessons.length > 0;
    const weakSingleTarget = useWeak ? Math.round(singleCount * 0.5) : 0;
    const weakMultiTarget = useWeak ? Math.round(multiCount * 0.5) : 0;
    const restSingleTarget = singleCount - weakSingleTarget;
    const restMultiTarget = multiCount - weakMultiTarget;

    const picked = []
      .concat(pickFromGroup(weakLessons, weakSingleTarget, 'single'))
      .concat(pickFromGroup(restLessons.length ? restLessons : weakLessons,
                            restSingleTarget, 'single'))
      .concat(pickFromGroup(weakLessons, weakMultiTarget, 'multiple'))
      .concat(pickFromGroup(restLessons.length ? restLessons : weakLessons,
                            restMultiTarget, 'multiple'));

    // 若某些組數不足而短缺，從整池補（避免最終題數少於 total）
    const filled = topUp(picked, pool, total);
    // 每條題目選項洗牌（同步調整 answer index）
    return shuffle(filled).map(shuffleOptions);
  }

  // 從 lessons 內依 type 平均抽 count 題
  function pickFromGroup(lessons, count, type) {
    if (count <= 0 || !lessons.length) return [];
    const dist = distributeEvenly(lessons, count);
    const picked = [];
    const shortfall = []; // 抽不夠時的對應 lesson
    lessons.forEach(function (l) {
      const want = dist[l.lessonId];
      const bank = type === 'single' ? l.single : l.multiple;
      const got = pickN(bank, want);
      got.forEach(function (q) {
        picked.push(Object.assign({}, q, {
          lessonId: l.lessonId,
          lessonName: l.lessonName
        }));
      });
      if (got.length < want) shortfall.push({ lesson: l, miss: want - got.length });
    });
    // 若某課該類型題不足，把缺額在同組其他課補
    if (shortfall.length) {
      const totalMiss = shortfall.reduce(function (s, x) { return s + x.miss; }, 0);
      const pool = lessons.reduce(function (acc, l) {
        const bank = type === 'single' ? l.single : l.multiple;
        bank.forEach(function (q) {
          if (!picked.some(function (p) { return p.id === q.id; })) {
            acc.push(Object.assign({}, q, { lessonId: l.lessonId, lessonName: l.lessonName }));
          }
        });
        return acc;
      }, []);
      const extra = pickN(pool, totalMiss);
      extra.forEach(function (q) { picked.push(q); });
    }
    return picked;
  }

  // 確保總數達 total，不足時不論類型從整池補
  function topUp(picked, pool, total) {
    const have = picked.length;
    if (have >= total) return picked.slice(0, total);
    const usedIds = {};
    picked.forEach(function (q) { usedIds[q.id] = true; });
    const candidates = [];
    pool.forEach(function (l) {
      l.single.concat(l.multiple).forEach(function (q) {
        if (!usedIds[q.id]) {
          candidates.push(Object.assign({}, q, {
            lessonId: l.lessonId, lessonName: l.lessonName
          }));
        }
      });
    });
    return picked.concat(pickN(candidates, total - have));
  }

  // 比較 picked 與 correct 是否相同（順序無關）
  function arraysEqualAsSet(a, b) {
    if (a.length !== b.length) return false;
    const sa = a.slice().sort(); const sb = b.slice().sort();
    for (let i = 0; i < sa.length; i++) if (sa[i] !== sb[i]) return false;
    return true;
  }

  // 計分：questions 為 buildQuiz 的輸出，answers 為 { questionId: number[] }
  function grade(questions, picksByQid) {
    const answers = questions.map(function (q) {
      const picked = (picksByQid && picksByQid[q.id]) || [];
      const isCorrect = arraysEqualAsSet(picked, q.answer);
      return {
        questionId: q.id,
        lessonId: q.lessonId,
        lessonName: q.lessonName,
        type: q.type,
        question: q.question,
        options: q.options,
        correct: q.answer.slice(),
        picked: picked.slice(),
        isCorrect: isCorrect,
        explanation: q.explanation || '',
        source: q.source || ''
      };
    });
    const correctCount = answers.filter(function (a) { return a.isCorrect; }).length;
    const totalQuestions = answers.length;
    const score = totalQuestions > 0
      ? Math.round((correctCount / totalQuestions) * 100)
      : 0;
    // 按課別表現
    const byLesson = {};
    answers.forEach(function (a) {
      const o = byLesson[a.lessonId] || { lessonId: a.lessonId, lessonName: a.lessonName, total: 0, correct: 0 };
      o.total += 1;
      if (a.isCorrect) o.correct += 1;
      byLesson[a.lessonId] = o;
    });
    return {
      totalQuestions: totalQuestions,
      correctCount: correctCount,
      score: score,
      answers: answers,
      byLesson: byLesson
    };
  }

  // 對外 API
  SG.Exam = {
    DEFAULT_TOTAL: DEFAULT_TOTAL,
    SINGLE_RATIO: SINGLE_RATIO,
    buildQuiz: buildQuiz,
    grade: grade,
    _shuffle: shuffle,
    _shuffleOptions: shuffleOptions
  };
})();
