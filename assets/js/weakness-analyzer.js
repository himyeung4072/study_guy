/* ===== Weakness Analyzer 模組 =====
   按學生 + 科目，從歷史記錄統計每課的累積正確率，
   標記 < 60% 為弱項，供考試出題加權使用。
*/
(function () {
  'use strict';
  const SG = window.StudyGuy = window.StudyGuy || {};

  const WEAK_THRESHOLD = 0.6; // 正確率 < 60% 視為弱項

  // 計算指定學生 + 科目的弱項分析
  // 回傳 {
  //   byLesson: { [lessonId]: { total, correct, accuracy } },
  //   weakLessonIds: string[],
  //   examCount: number
  // }
  function analyze(studentId, subjectId) {
    const records = SG.Storage.listExamRecords({
      studentId: studentId,
      subjectId: subjectId
    });
    const byLesson = {};
    records.forEach(function (rec) {
      (rec.answers || []).forEach(function (a) {
        if (!a.lessonId) return;
        const acc = byLesson[a.lessonId] || { total: 0, correct: 0, accuracy: 0 };
        acc.total += 1;
        if (a.isCorrect) acc.correct += 1;
        byLesson[a.lessonId] = acc;
      });
    });
    Object.keys(byLesson).forEach(function (lid) {
      const o = byLesson[lid];
      o.accuracy = o.total > 0 ? o.correct / o.total : 0;
    });
    const weakLessonIds = Object.keys(byLesson).filter(function (lid) {
      const o = byLesson[lid];
      // 至少答過一定數量題目才能可靠判斷弱項，避免一條錯就被標弱
      return o.total >= 3 && o.accuracy < WEAK_THRESHOLD;
    });
    return {
      byLesson: byLesson,
      weakLessonIds: weakLessonIds,
      examCount: records.length
    };
  }

  // 對外 API
  SG.Weakness = {
    analyze: analyze,
    THRESHOLD: WEAK_THRESHOLD
  };
})();
