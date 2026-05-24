/* ===== Storage 模組 =====
   封裝 localStorage 的三個 namespace：
   - students      ：學生帳號清單
   - examRecords   ：所有考試記錄（含 studentId、subjectId 索引）
   - subjects      ：已匯入的科目（含每課 notes 與 questions）
   提供匯出／匯入備份用 API。
*/
(function () {
  'use strict';
  const SG = window.StudyGuy = window.StudyGuy || {};

  const KEY_STUDENTS = 'sg.students';
  const KEY_EXAMS = 'sg.examRecords';
  const KEY_SUBJECTS = 'sg.subjects';
  const KEY_SETTINGS = 'sg.settings';
  const KEY_TAXONOMY = 'sg.taxonomy';

  // 預設分類標籤
  var DEFAULT_TAXONOMY = {
    grades: ['小一', '小二', '小三', '小四', '小五', '小六'],
    terms: ['上學期', '下學期'],
    subjects: [
      { code: 'people', name: '常識（人民）' },
      { code: 'science', name: '科學' },
      { code: 'chi', name: '中文' },
      { code: 'eng', name: '英文' },
      { code: 'math', name: '數學' }
    ],
    chapters: [
      '第12課', '第13課', '第14課', '第15課',
      '第16課', '第17課'
    ]
  };

  // 低階讀寫
  function readJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw == null ? fallback : JSON.parse(raw);
    } catch (e) {
      console.warn('[Storage] readJSON 失敗', key, e);
      return fallback;
    }
  }

  function writeJSON(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  // 產生簡單 ID
  function genId(prefix) {
    return prefix + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  }

  // ===== 學生 =====
  function listStudents() {
    return readJSON(KEY_STUDENTS, []);
  }

  function getStudent(id) {
    return listStudents().find(function (s) { return s.id === id; }) || null;
  }

  function addStudent(name, grade) {
    const trimmed = (name || '').trim();
    if (!trimmed) throw new Error('學生姓名不可為空');
    const g = (grade || '').trim();
    if (!g) throw new Error('請選擇學生年級');
    const list = listStudents();
    if (list.some(function (s) { return s.name === trimmed; })) {
      throw new Error('已有同名學生：' + trimmed);
    }
    const student = {
      id: genId('stu'),
      name: trimmed,
      grade: g,
      createdAt: new Date().toISOString()
    };
    list.push(student);
    writeJSON(KEY_STUDENTS, list);
    return student;
  }

  function updateStudent(id, patch) {
    const list = listStudents();
    const idx = list.findIndex(function (s) { return s.id === id; });
    if (idx < 0) throw new Error('找不到學生：' + id);
    list[idx] = Object.assign({}, list[idx], patch);
    writeJSON(KEY_STUDENTS, list);
    return list[idx];
  }

  function removeStudent(id) {
    const list = listStudents().filter(function (s) { return s.id !== id; });
    writeJSON(KEY_STUDENTS, list);
    // 同時刪除該學生的考試記錄
    const exams = readJSON(KEY_EXAMS, []).filter(function (r) { return r.studentId !== id; });
    writeJSON(KEY_EXAMS, exams);
  }

  // ===== 科目 =====
  // 每個 subject 結構：
  // { schemaVersion, subjectId, subjectName, grade, publisher, description,
  //   units: [{ unitId, unitName, lessons: [{ lessonId, lessonName, notes, questions }] }],
  //   importedAt }
  function listSubjects() {
    return readJSON(KEY_SUBJECTS, []);
  }

  function getSubject(subjectId) {
    return listSubjects().find(function (s) { return s.subjectId === subjectId; }) || null;
  }

  // upsertSubject：同 subjectId 時合併 lessons，不同時新增
  // schema 2.0：subject 結構為平鋪 { subjectId, subjectName, grade, lessons: [...] }
  // 接受兩種輸入：
  //   - 完整 subject 物件 { subjectId, subjectName, grade, lessons: [...] }
  //   - 單一 lesson 陣列：{ subjectId, subjectName, grade, _newLessons: [...] }
  // 回傳 { subject, stats: { added, updated } }
  function upsertSubject(input) {
    var list = listSubjects();
    var idx = list.findIndex(function (s) { return s.subjectId === input.subjectId; });
    var stats = { added: 0, updated: 0 };
    var enriched;
    var newLessons = input._newLessons || input.lessons || [];
    if (idx < 0) {
      // 全新科目
      enriched = {
        schemaVersion: '2.0',
        subjectId: input.subjectId,
        subjectName: input.subjectName,
        grade: input.grade,
        lessons: newLessons.map(function (l) { return JSON.parse(JSON.stringify(l)); }),
        importedAt: new Date().toISOString()
      };
      stats.added = newLessons.length;
      list.push(enriched);
    } else {
      enriched = Object.assign({}, list[idx]);
      // 更新 metadata（非空才覆蓋）
      ['subjectName', 'grade'].forEach(function (k) {
        if (input[k]) enriched[k] = input[k];
      });
      enriched.schemaVersion = '2.0';
      enriched.importedAt = new Date().toISOString();
      var existing = enriched.lessons || [];
      newLessons.forEach(function (newL) {
        var li = existing.findIndex(function (l) { return l.lessonId === newL.lessonId; });
        if (li < 0) {
          existing.push(JSON.parse(JSON.stringify(newL)));
          stats.added += 1;
        } else {
          existing[li] = JSON.parse(JSON.stringify(newL));
          stats.updated += 1;
        }
      });
      enriched.lessons = existing;
      list[idx] = enriched;
    }
    writeJSON(KEY_SUBJECTS, list);
    return { subject: enriched, stats: stats };
  }

  function removeSubject(subjectId) {
    const list = listSubjects().filter(function (s) { return s.subjectId !== subjectId; });
    writeJSON(KEY_SUBJECTS, list);
  }

  // 取得科目內所有課（schema 2.0 已平鋪，按 lessonOrder 然後 lessonId 排序）
  function flattenLessons(subject) {
    if (!subject || !Array.isArray(subject.lessons)) return [];
    var list = subject.lessons.slice();
    list.sort(function (a, b) {
      var oa = (typeof a.lessonOrder === 'number') ? a.lessonOrder : Number.MAX_SAFE_INTEGER;
      var ob = (typeof b.lessonOrder === 'number') ? b.lessonOrder : Number.MAX_SAFE_INTEGER;
      if (oa !== ob) return oa - ob;
      return String(a.lessonId).localeCompare(String(b.lessonId));
    });
    return list;
  }

  // 年級匹配：學生「小四」可看到所有以「小四」開頭的科目（例：「小四上」「小四下」）
  function gradeMatches(studentGrade, subjectGrade) {
    if (!studentGrade) return true; // 無年級限制
    if (!subjectGrade) return false;
    return subjectGrade.indexOf(studentGrade) === 0;
  }

  // ===== Taxonomy（分類標籤）=====
  function getTaxonomy() {
    var stored = readJSON(KEY_TAXONOMY, null);
    if (!stored) return JSON.parse(JSON.stringify(DEFAULT_TAXONOMY));
    // 確保所有 category 都存在（向後相容）
    var result = JSON.parse(JSON.stringify(DEFAULT_TAXONOMY));
    Object.keys(stored).forEach(function (k) { result[k] = stored[k]; });
    // 清除無效項目（例如曾經誤存入的 PointerEvent 物件、空字串等）
    ['grades', 'terms', 'chapters'].forEach(function (k) {
      if (Array.isArray(result[k])) {
        result[k] = result[k].filter(function (x) {
          return typeof x === 'string' && x.trim() && !/^\[object /.test(x);
        });
      }
    });
    if (Array.isArray(result.subjects)) {
      result.subjects = result.subjects.filter(function (s) {
        return s && typeof s.code === 'string' && s.code && typeof s.name === 'string' && s.name;
      });
    }
    return result;
  }

  function setTaxonomy(data) {
    writeJSON(KEY_TAXONOMY, data);
  }

  // category: 'grades' | 'terms' | 'subjects' | 'chapters'
  // item: string（grades/terms/chapters）或 { code, name }（subjects）
  function addTaxonomyItem(category, item) {
    var tax = getTaxonomy();
    if (!Array.isArray(tax[category])) throw new Error('未知分類：' + category);
    if (category === 'subjects') {
      if (!item || !item.code || !item.name) throw new Error('科目需要 code 與 name');
      if (tax.subjects.some(function (s) { return s.code === item.code; })) {
        throw new Error('已有相同 code 的科目：' + item.code);
      }
      tax.subjects.push(item);
    } else {
      var str = String(item || '').trim();
      if (!str) throw new Error('項目不可為空');
      if (tax[category].indexOf(str) >= 0) throw new Error('已有相同項目：' + str);
      tax[category].push(str);
    }
    setTaxonomy(tax);
    return tax;
  }

  function removeTaxonomyItem(category, item) {
    var tax = getTaxonomy();
    if (!Array.isArray(tax[category])) throw new Error('未知分類：' + category);
    if (category === 'subjects') {
      tax.subjects = tax.subjects.filter(function (s) { return s.code !== item; });
    } else {
      tax[category] = tax[category].filter(function (x) { return x !== item; });
    }
    setTaxonomy(tax);
    return tax;
  }

  // 由標籤算出 subjectId：<subjectCode>-p<gradeNum><termLetter>
  // 例：科目 people、小四、下學期 → people-p4b
  function buildSubjectId(subjectCode, grade, term) {
    var gradeMap = { '小一': '1', '小二': '2', '小三': '3', '小四': '4', '小五': '5', '小六': '6' };
    var termMap = { '上學期': 'a', '下學期': 'b' };
    var g = gradeMap[grade] || '';
    var t = termMap[term] || '';
    if (!g || !t) return null;
    return subjectCode + '-p' + g + t;
  }
  // record 結構：
  // { id, studentId, subjectId, subjectName, startedAt, endedAt, durationSec,
  //   totalQuestions, correctCount, score (0-100),
  //   answers: [{ questionId, lessonId, type, options, correct: number[],
  //               picked: number[], isCorrect, question, explanation, source }] }
  function listExamRecords(filter) {
    const all = readJSON(KEY_EXAMS, []);
    if (!filter) return all;
    return all.filter(function (r) {
      if (filter.studentId && r.studentId !== filter.studentId) return false;
      if (filter.subjectId && r.subjectId !== filter.subjectId) return false;
      return true;
    });
  }

  function addExamRecord(record) {
    const list = readJSON(KEY_EXAMS, []);
    const enriched = Object.assign({ id: genId('exam') }, record);
    list.push(enriched);
    writeJSON(KEY_EXAMS, list);
    return enriched;
  }

  // ===== 設定 =====
  function getSettings() {
    return readJSON(KEY_SETTINGS, { activeStudentId: null, activeSubjectId: null });
  }

  function updateSettings(patch) {
    const cur = getSettings();
    const next = Object.assign({}, cur, patch);
    writeJSON(KEY_SETTINGS, next);
    return next;
  }

  // ===== 備份／還原 =====
  function exportAll() {
    return {
      schemaVersion: '1.0',
      exportedAt: new Date().toISOString(),
      students: listStudents(),
      examRecords: readJSON(KEY_EXAMS, []),
      subjects: listSubjects(),
      settings: getSettings()
    };
  }

  function importAll(data, opts) {
    opts = opts || {};
    if (!data || typeof data !== 'object') throw new Error('備份檔格式錯誤');
    if (opts.replace) {
      writeJSON(KEY_STUDENTS, data.students || []);
      writeJSON(KEY_EXAMS, data.examRecords || []);
      writeJSON(KEY_SUBJECTS, data.subjects || []);
      if (data.settings) writeJSON(KEY_SETTINGS, data.settings);
    } else {
      // 合併模式：以 id 為主鍵覆蓋
      mergeArray(KEY_STUDENTS, data.students, 'id');
      mergeArray(KEY_EXAMS, data.examRecords, 'id');
      mergeArray(KEY_SUBJECTS, data.subjects, 'subjectId');
    }
  }

  function mergeArray(key, incoming, idField) {
    if (!Array.isArray(incoming)) return;
    const cur = readJSON(key, []);
    const map = {};
    cur.forEach(function (it) { map[it[idField]] = it; });
    incoming.forEach(function (it) { if (it && it[idField] != null) map[it[idField]] = it; });
    writeJSON(key, Object.keys(map).map(function (k) { return map[k]; }));
  }

  function clearAll() {
    [KEY_STUDENTS, KEY_EXAMS, KEY_SUBJECTS, KEY_SETTINGS].forEach(function (k) {
      localStorage.removeItem(k);
    });
  }

  // 對外 API
  SG.Storage = {
    // 學生
    listStudents: listStudents,
    getStudent: getStudent,
    addStudent: addStudent,
    updateStudent: updateStudent,
    removeStudent: removeStudent,
    // 科目
    listSubjects: listSubjects,
    getSubject: getSubject,
    upsertSubject: upsertSubject,
    removeSubject: removeSubject,
    flattenLessons: flattenLessons,
    gradeMatches: gradeMatches,
    // 考試記錄
    listExamRecords: listExamRecords,
    addExamRecord: addExamRecord,
    // 設定
    getSettings: getSettings,
    updateSettings: updateSettings,
    // 備份／還原
    exportAll: exportAll,
    importAll: importAll,
    clearAll: clearAll,
    // Taxonomy
    getTaxonomy: getTaxonomy,
    setTaxonomy: setTaxonomy,
    addTaxonomyItem: addTaxonomyItem,
    removeTaxonomyItem: removeTaxonomyItem,
    buildSubjectId: buildSubjectId
  };
})();
