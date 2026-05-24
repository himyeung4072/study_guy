/* 階段 2 端到端測試
   - parse 全部 JS
   - mock localStorage、FileReader、window
   - 載入模組、跑：建立學生 → 匯入假科目 → 抽題 → 計分 → 弱項分析 → 第二次抽題加權
*/
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

// 1. mock 環境
const store = {};
const localStorage = {
  getItem: function (k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
  setItem: function (k, v) { store[k] = String(v); },
  removeItem: function (k) { delete store[k]; }
};
const sandbox = {
  window: {},
  localStorage: localStorage,
  console: console,
  Promise: Promise,
  Number: Number,
  Math: Math,
  Date: Date,
  Object: Object,
  Array: Array,
  JSON: JSON,
  Error: Error,
  Set: Set
};
sandbox.global = sandbox;
vm.createContext(sandbox);

const FILES = [
  'assets/js/storage.js',
  'assets/js/content-loader.js',
  'assets/js/weakness-analyzer.js',
  'assets/js/exam-engine.js'
];
FILES.forEach(function (f) {
  const code = fs.readFileSync(f, 'utf8');
  vm.runInContext(code, sandbox, { filename: f });
});

const SG = sandbox.window.StudyGuy;
function assert(cond, msg) {
  if (!cond) { console.error('FAIL:', msg); process.exit(1); }
  else console.log('OK   ', msg);
}


// 2. 學生
const stu = SG.Storage.addStudent('Hayson', '小四');
assert(stu && stu.id, '建立學生');
assert(stu.grade === '小四', '學生年級');
assert(SG.Storage.listStudents().length === 1, '學生列表計數');
try { SG.Storage.addStudent('Hayson', '小四'); assert(false, '應該擋同名'); }
catch (e) { assert(/已有同名/.test(e.message), '同名擋下'); }
try { SG.Storage.addStudent('Bobby', ''); assert(false, '應該擋無年級'); }
catch (e) { assert(/年級/.test(e.message), '無年級擋下'); }
// 年級匹配
assert(SG.Storage.gradeMatches('小四', '小四下') === true, '小四 → 小四下 匹配');
assert(SG.Storage.gradeMatches('小四', '小三下') === false, '小四 → 小三下 不匹配');
assert(SG.Storage.gradeMatches('小四', '小四上') === true, '小四 → 小四上 匹配');

// 3. 假科目（2 課，每課 8 題：6 single + 2 multiple）schema 2.0
function makeQuestions(lessonId, n, multiPart) {
  const arr = [];
  for (let i = 1; i <= n; i++) {
    const isMulti = i > (n - multiPart);
    arr.push({
      id: lessonId + '-Q' + String(i).padStart(2, '0'),
      type: isMulti ? 'multiple' : 'single',
      question: lessonId + ' 題目 ' + i + '?',
      options: ['A', 'B', 'C', 'D'],
      answer: isMulti ? [0, 2] : [1],
      explanation: '解釋 ' + i,
      source: '課本 P.' + i
    });
  }
  return arr;
}
function makeLesson(subjectId, lessonId, order, n, multiPart) {
  return {
    schemaVersion: '2.0',
    subjectId: subjectId,
    lessonId: lessonId,
    lessonName: lessonId + ' 測試課',
    lessonOrder: order,
    notes: { summary: '測試摘要', keyPoints: ['p1','p2','p3'] },
    questions: makeQuestions(lessonId, n, multiPart)
  };
}
const lessonsArr = [
  makeLesson('test-sub', 'L01', 1, 8, 2),
  makeLesson('test-sub', 'L02', 2, 8, 2)
];
SG.Storage.upsertSubject({
  subjectId: 'test-sub',
  subjectName: '測試科',
  grade: '小四下',
  _newLessons: lessonsArr
});
assert(SG.Storage.listSubjects().length === 1, '科目寫入');
const subj = SG.Storage.getSubject('test-sub');
assert(subj.lessons.length === 2, '兩課寫入');
assert(subj.lessons[0].questions.length === 8, '每課 8 題');


// 4. 抽題（無弱項，總共只 16 題，但要求 25——應 top up 到不超過 16）
let quiz = SG.Exam.buildQuiz(subj, { total: 25 });
assert(quiz.length === 16, '題池只有 16 題時應全抽（實際 ' + quiz.length + '）');

// 縮小 total 到 10，看 80/20 比例與課平均
quiz = SG.Exam.buildQuiz(subj, { total: 10 });
assert(quiz.length === 10, '抽 10 題');
const singleN = quiz.filter(function (q) { return q.type === 'single'; }).length;
const multiN = quiz.filter(function (q) { return q.type === 'multiple'; }).length;
assert(singleN === 8 && multiN === 2, '80/20: single=' + singleN + ', multi=' + multiN);
const lessonHit = {};
quiz.forEach(function (q) { lessonHit[q.lessonId] = (lessonHit[q.lessonId] || 0) + 1; });
assert(lessonHit['L01'] === 5 && lessonHit['L02'] === 5,
  '平均分配：L01=' + lessonHit['L01'] + ' L02=' + lessonHit['L02']);

// 5. 計分（全錯）
const picksAllWrong = {};
quiz.forEach(function (q) { picksAllWrong[q.id] = []; });
const r1 = SG.Exam.grade(quiz, picksAllWrong);
assert(r1.score === 0, '全錯 0 分');
assert(r1.correctCount === 0, '全錯 0 題對');

// 6. 計分（全對）
const picksAllRight = {};
quiz.forEach(function (q) { picksAllRight[q.id] = q.answer.slice(); });
const r2 = SG.Exam.grade(quiz, picksAllRight);
assert(r2.score === 100, '全對 100 分');
assert(r2.correctCount === quiz.length, '全對 = total');

// 7. 寫入記錄並做弱項分析（讓 L01 全錯、L02 全對）
const mixedAnswers = quiz.map(function (q) {
  const picked = q.lessonId === 'L01' ? [] : q.answer.slice();
  return {
    questionId: q.id, lessonId: q.lessonId, type: q.type,
    options: q.options, correct: q.answer.slice(),
    picked: picked, isCorrect: q.lessonId !== 'L01',
    question: q.question, explanation: q.explanation || '', source: q.source || ''
  };
});
SG.Storage.addExamRecord({
  studentId: stu.id, subjectId: 'test-sub', subjectName: '測試科',
  startedAt: new Date().toISOString(), endedAt: new Date().toISOString(), durationSec: 60,
  totalQuestions: 10, correctCount: 5, score: 50, answers: mixedAnswers
});
const w = SG.Weakness.analyze(stu.id, 'test-sub');
assert(w.weakLessonIds.indexOf('L01') >= 0, 'L01 標為弱項');
assert(w.weakLessonIds.indexOf('L02') < 0, 'L02 不是弱項');


// 8. 加入第三課，造出「弱項+其餘」的格局，驗證 50/50 出題加權
SG.Storage.upsertSubject({
  subjectId: 'test-sub',
  subjectName: '測試科',
  grade: '小四下',
  _newLessons: [makeLesson('test-sub', 'L03', 3, 8, 2)]
});
const subj2 = SG.Storage.getSubject('test-sub');
const w2 = SG.Weakness.analyze(stu.id, 'test-sub');
const quizW = SG.Exam.buildQuiz(subj2, { total: 10, weakLessonIds: w2.weakLessonIds });
assert(quizW.length === 10, '加權後抽 10 題');
const hit2 = {};
quizW.forEach(function (q) { hit2[q.lessonId] = (hit2[q.lessonId] || 0) + 1; });
// 預期 L01（弱項）約 50%，其餘平均 50%
assert(hit2['L01'] >= 4, 'L01（弱項）至少 4 題（實際 ' + (hit2['L01']||0) + '）');
console.log('lesson 分佈:', hit2);

// 9. 驗證錯誤 schema 會被擋下
try {
  SG.ContentLoader.validateLesson({ schemaVersion: '2.0', subjectId: 'x', lessonId: 'L01', lessonName: 'a', lessonOrder: 1, notes: { summary: 's', keyPoints: ['k'] }, questions: [{ id: 'Q', type: 'single', question: 'q', options: ['a','b','c'], answer: [9], explanation: 'e' }] }, 'x', 'bad.json');
  assert(false, 'answer index 越界應被擋');
} catch (e) {
  assert(/越界/.test(e.message), 'answer 越界錯誤訊息: ' + e.message);
}

// 10. 備份／還原
const dump = SG.Storage.exportAll();
assert(dump.students.length === 1 && dump.subjects.length === 1, 'exportAll 內容齊全');
SG.Storage.clearAll();
assert(SG.Storage.listStudents().length === 0, 'clearAll 學生清空');
SG.Storage.importAll(dump, { replace: true });
assert(SG.Storage.listStudents().length === 1, 'importAll replace 還原學生');

console.log('\nAll tests passed.');


// 11. schema 2.0：sections + highlights 驗證
const v20 = {
  schemaVersion: '2.0', subjectId: 'sub20', lessonId: 'L01', lessonName: 'L01', lessonOrder: 1,
  notes: {
    summary: 's', keyPoints: ['k1'],
    sections: [{ icon: '🔤', title: 'A 區', points: ['p1', 'p2'] }],
    highlights: [{ title: '三大原因', points: ['一', '二', '三'] }]
  },
  questions: [
    { id: 'Q1', type: 'single', question: 'q', options: ['a','b','c'], answer: [0], explanation: 'e' }
  ]
};
SG.ContentLoader.validateLesson(v20, 'sub20', 'v20.json');
assert(true, 'schema 2.0 sections + highlights 通過');

// section 缺 title 應失敗
try {
  const bad = JSON.parse(JSON.stringify(v20));
  delete bad.notes.sections[0].title;
  SG.ContentLoader.validateLesson(bad, 'sub20', 'bad.json');
  assert(false, 'section 缺 title 應失敗');
} catch (e) {
  assert(/title 必填/.test(e.message), 'section title 驗證生效');
}

// 缺 lessonOrder 應失敗
try {
  const bad = JSON.parse(JSON.stringify(v20));
  delete bad.lessonOrder;
  SG.ContentLoader.validateLesson(bad, 'sub20', 'bad.json');
  assert(false, '缺 lessonOrder 應失敗');
} catch (e) {
  assert(/lessonOrder 必填/.test(e.message), 'lessonOrder 驗證生效');
}

// 1.x schema 應被擋
try {
  SG.ContentLoader.validateLesson(Object.assign({}, v20, { schemaVersion: '1.1' }), 'sub20', 'bad.json');
  assert(false, '舊 schema 1.1 應被擋');
} catch (e) {
  assert(/不支援的 schemaVersion/.test(e.message), '舊 schema 擋下');
}


// 12. 選項洗牌：shuffleOptions 應保持 answer 正確性
const q0 = { id: 'T1', type: 'single', question: 'q', options: ['A','B','C','D'], answer: [2], explanation: 'e', lessonId: 'L01', lessonName: 'L01' };
const shuffled = SG.Exam._shuffleOptions(q0);
assert(shuffled.options.length === 4, '洗牌後選項數量不變');
// 正確答案文字應仍是 'C'
assert(shuffled.options[shuffled.answer[0]] === 'C', '洗牌後 answer 指向正確選項文字');
// 多選洗牌
const q1 = { id: 'T2', type: 'multiple', question: 'q', options: ['A','B','C','D'], answer: [0,2], explanation: 'e', lessonId: 'L01', lessonName: 'L01' };
const s1 = SG.Exam._shuffleOptions(q1);
const correctTexts = s1.answer.map(function(i){ return s1.options[i]; }).sort();
assert(correctTexts[0] === 'A' && correctTexts[1] === 'C', '多選洗牌後 answer 指向正確選項文字');


// 13. upsertSubject merge 模式（schema 2.0 平鋪 lessons）
function mkLesson(sid, lid, order, name) {
  return {
    schemaVersion: '2.0', subjectId: sid, lessonId: lid,
    lessonName: name || lid, lessonOrder: order,
    notes: { summary: 's', keyPoints: ['k'] }, questions: []
  };
}

// 第一次：2 lessons
var r1m = SG.Storage.upsertSubject({
  subjectId: 'merge-test', subjectName: '合併測試', grade: '小四下',
  _newLessons: [mkLesson('merge-test', 'L01', 1), mkLesson('merge-test', 'L02', 2)]
});
assert(r1m.stats.added === 2 && r1m.stats.updated === 0, 'merge: 首次匯入 added=2');
assert(SG.Storage.flattenLessons(r1m.subject).length === 2, 'merge: 首次 2 課');

// 第二次：L01 更新 + L03 新增
var r2m = SG.Storage.upsertSubject({
  subjectId: 'merge-test', subjectName: '合併測試', grade: '小四下',
  _newLessons: [
    mkLesson('merge-test', 'L01', 1, 'L01 更新'),
    mkLesson('merge-test', 'L03', 3)
  ]
});
assert(r2m.stats.added === 1 && r2m.stats.updated === 1, 'merge: 第二次 added=1 updated=1');
var merged = SG.Storage.getSubject('merge-test');
assert(SG.Storage.flattenLessons(merged).length === 3, 'merge: 合併後 3 課');
var l01 = merged.lessons.find(function(l){ return l.lessonId === 'L01'; });
assert(l01 && l01.lessonName === 'L01 更新', 'merge: L01 被更新');

// 排序：lessonOrder 1, 2, 3
var sorted = SG.Storage.flattenLessons(merged);
assert(sorted[0].lessonId === 'L01' && sorted[1].lessonId === 'L02' && sorted[2].lessonId === 'L03',
  'flattenLessons 按 lessonOrder 排序');

// 14. taxonomy CRUD
var tax = SG.Storage.getTaxonomy();
assert(tax.grades.indexOf('小四') >= 0, 'taxonomy: 預設年級存在');
SG.Storage.addTaxonomyItem('grades', '幼稚園');
assert(SG.Storage.getTaxonomy().grades.indexOf('幼稚園') >= 0, 'taxonomy: 新增年級');
SG.Storage.removeTaxonomyItem('grades', '幼稚園');
assert(SG.Storage.getTaxonomy().grades.indexOf('幼稚園') < 0, 'taxonomy: 刪除年級');
SG.Storage.addTaxonomyItem('subjects', { code: 'music', name: '音樂' });
assert(SG.Storage.getTaxonomy().subjects.some(function(s){ return s.code === 'music'; }), 'taxonomy: 新增科目');

// 15. buildSubjectId
assert(SG.Storage.buildSubjectId('people', '小四', '下學期') === 'people-p4b', 'buildSubjectId: people-p4b');
assert(SG.Storage.buildSubjectId('science', '小三', '上學期') === 'science-p3a', 'buildSubjectId: science-p3a');
assert(SG.Storage.buildSubjectId('people', '', '下學期') === null, 'buildSubjectId: 缺年級回 null');
