/* ===== Home View =====
   功能：選擇／建立學生、選擇科目、進入溫習或考試
*/
(function () {
  'use strict';
  const SG = window.StudyGuy;

  function render(container) {
    const settings = SG.Storage.getSettings();
    container.innerHTML = '';
    container.appendChild(renderStudentCard(settings));
    container.appendChild(renderSubjectCard(settings));
    container.appendChild(renderActionCard(settings));
  }

  // 共用：年級選項
  const GRADES = ['小一', '小二', '小三', '小四', '小五', '小六'];

  // 學生選擇／新增
  function renderStudentCard(settings) {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = '<h2 class="page-title">第一步：選擇考生</h2>';
    const students = SG.Storage.listStudents();
    if (!students.length) {
      const p = document.createElement('p');
      p.className = 'muted';
      p.textContent = '還未有任何考生，先輸入姓名與年級建立一個吧。';
      card.appendChild(p);
    } else {
      const grid = document.createElement('div');
      grid.className = 'tile-grid';
      students.forEach(function (s) {
        const tile = document.createElement('button');
        tile.className = 'tile' + (settings.activeStudentId === s.id ? ' selected' : '');
        const gradeBadge = s.grade
          ? '<span class="muted" style="font-size:13px;">（' + SG.esc(s.grade) + '）</span>'
          : '<span class="danger" style="font-size:13px;">（⚠ 請補填年級）</span>';
        tile.innerHTML = '<h3>' + SG.esc(s.name) + ' ' + gradeBadge + '</h3><p>選為目前考生</p>';
        tile.addEventListener('click', function () {
          SG.Storage.updateSettings({ activeStudentId: s.id, activeSubjectId: null });
          render(document.getElementById('app-main'));
        });
        grid.appendChild(tile);
      });
      card.appendChild(grid);
    }
    const form = document.createElement('div');
    form.className = 'row';
    form.style.marginTop = '12px';
    let gradeOptions = '<option value="">選擇年級…</option>';
    GRADES.forEach(function (g) { gradeOptions += '<option value="' + g + '">' + g + '</option>'; });
    form.innerHTML =
      '<input type="text" placeholder="輸入新考生姓名…" style="flex:2;">' +
      '<select style="flex:1;">' + gradeOptions + '</select>' +
      '<button class="btn">新增考生</button>';
    const input = form.querySelector('input');
    const select = form.querySelector('select');
    const btn = form.querySelector('button');
    btn.addEventListener('click', function () {
      try {
        const stu = SG.Storage.addStudent(input.value, select.value);
        SG.Storage.updateSettings({ activeStudentId: stu.id, activeSubjectId: null });
        SG.toast('已新增考生：' + stu.name + '（' + stu.grade + '）', 'success');
        render(document.getElementById('app-main'));
      } catch (e) { SG.toast(e.message, 'error'); }
    });
    input.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') btn.click(); });
    card.appendChild(form);
    return card;
  }

  // 科目選擇（按目前考生年級過濾）
  function renderSubjectCard(settings) {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = '<h2 class="page-title">第二步：選擇科目</h2>';
    const stu = settings.activeStudentId ? SG.Storage.getStudent(settings.activeStudentId) : null;
    if (!stu) {
      const p = document.createElement('p');
      p.className = 'muted';
      p.textContent = '請先選擇考生。';
      card.appendChild(p);
      return card;
    }
    if (!stu.grade) {
      const p = document.createElement('p');
      p.className = 'danger';
      p.innerHTML = '考生未填年級。請到 <a href="#/manage">管理</a> 頁補填年級。';
      card.appendChild(p);
      return card;
    }
    const allSubjects = SG.Storage.listSubjects();
    const subjects = allSubjects.filter(function (s) {
      return SG.Storage.gradeMatches(stu.grade, s.grade);
    });
    if (!allSubjects.length) {
      const p = document.createElement('p');
      p.className = 'muted';
      p.innerHTML = '尚未匯入任何科目。請到 <a href="#/manage">管理</a> 頁匯入科目 JSON 檔。';
      card.appendChild(p);
      return card;
    }
    if (!subjects.length) {
      const p = document.createElement('p');
      p.className = 'muted';
      p.innerHTML = '沒有適合 <b>' + SG.esc(stu.grade) + '</b> 的科目（共 ' + allSubjects.length +
        ' 個科目，但年級皆不匹配）。請到 <a href="#/manage">管理</a> 頁匯入適合年級的科目。';
      card.appendChild(p);
      return card;
    }
    const grid = document.createElement('div');
    grid.className = 'tile-grid';
    subjects.forEach(function (s) {
      const lessons = SG.Storage.flattenLessons(s);
      const totalQ = lessons.reduce(function (sum, l) {
        return sum + (l.questions || []).length;
      }, 0);
      const tile = document.createElement('button');
      tile.className = 'tile' + (settings.activeSubjectId === s.subjectId ? ' selected' : '');
      tile.innerHTML =
        '<h3>' + SG.esc(s.subjectName) + '</h3>' +
        '<p>' + SG.esc(s.grade) + ' · ' + lessons.length + ' 課 · 共 ' + totalQ + ' 題</p>';
      tile.addEventListener('click', function () {
        SG.Storage.updateSettings({ activeSubjectId: s.subjectId });
        render(document.getElementById('app-main'));
      });
      grid.appendChild(tile);
    });
    card.appendChild(grid);
    return card;
  }

  // 動作：進入溫習 / 考試
  function renderActionCard(settings) {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = '<h2 class="page-title">第三步：開始</h2>';
    const stu = settings.activeStudentId ? SG.Storage.getStudent(settings.activeStudentId) : null;
    const subj = settings.activeSubjectId ? SG.Storage.getSubject(settings.activeSubjectId) : null;
    const ready = stu && subj;
    const status = document.createElement('p');
    if (ready) {
      status.innerHTML = '考生：<b>' + SG.esc(stu.name) + '</b>　·　科目：<b>' + SG.esc(subj.subjectName) + '</b>';
    } else {
      status.className = 'muted';
      status.textContent = '請先完成上面兩步。';
    }
    card.appendChild(status);
    const row = document.createElement('div');
    row.className = 'row';
    row.style.marginTop = '12px';
    const btnStudy = document.createElement('button');
    btnStudy.className = 'btn';
    btnStudy.textContent = '📖 開始溫習';
    btnStudy.disabled = !ready;
    btnStudy.addEventListener('click', function () { SG.navigate('study'); });
    const btnExam = document.createElement('button');
    btnExam.className = 'btn btn-accent';
    btnExam.textContent = '📝 開始考試';
    btnExam.disabled = !ready;
    btnExam.addEventListener('click', function () { SG.navigate('exam'); });
    row.appendChild(btnStudy);
    row.appendChild(btnExam);
    card.appendChild(row);
    return card;
  }

  SG.registerView('home', { render: render });
})();
