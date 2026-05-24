# Study Guy TODO List

> 每完成一項立即更新本文件並同步 `docs/log/`。

## 階段 0：基建（已完成）

- [x] 建立 `docs/project-overview.md`（2026-05-24）
- [x] 建立 `docs/content-format.md`（2026-05-24）
- [x] 建立 `subjects/_template/`（subject.json、L01.json、README.md）（2026-05-24，已於 20:28 移到 `tools/subject-template/`）
- [x] 更新 steering：加入 A2 命名例外、TODO 規則（2026-05-24）
- [x] 建立 `docs/TODO.md`（2026-05-24）

## 階段 1：程式骨架

- [x] 建立 `index.html` 入口（2026-05-24）
- [x] 建立 `assets/css/styles.css`（適合小二至小六）（2026-05-24）
- [x] 建立 `assets/js/app.js`（路由與初始化）（2026-05-24）
- [x] 建立各 view／核心模組佔位檔（2026-05-24）

## 階段 2：核心模組

- [x] `assets/js/storage.js`：localStorage 封裝（students、examRecords、subjects）（2026-05-24）
- [x] `assets/js/content-loader.js`：JSON 匯入 + schema 驗證（2026-05-24）
- [x] `assets/js/exam-engine.js`：抽題（25 題、80/20 比例、弱項 50/50）、計分（2026-05-24）
- [x] `assets/js/weakness-analyzer.js`：每課正確率、< 60% 標弱項、累積分析（2026-05-24）
- [x] `tools/test-stage2.js`：端到端測試腳本（2026-05-24）

## 階段 3：UI 頁面

- [x] `views/home.js`：選擇／建立學生、選科目（2026-05-24）
- [x] `views/study.js`：溫習筆記顯示（2026-05-24）
- [x] `views/exam.js`：答題介面（25 題、不顯示答案）（2026-05-24）
- [x] `views/result.js`：成績、答案、解釋、出處、按課表現（2026-05-24）
- [x] `views/history.js`：分數趨勢、各課累積強弱（2026-05-24）
- [x] `views/manage.js`：匯入科目、學生管理、備份／還原（2026-05-24）
- [x] CSS 修復 scrollbar 出現時版面左移問題（scrollbar-gutter: stable）（2026-05-24）

## 階段 4：範例內容

- [x] 確認 PDF 是否可機讀 → 全部為掃描檔（2026-05-24）
- [x] 建立 `docs/agent-prompt-pdf-to-json.md` 給其他 AI Agent 使用（2026-05-24）
- [x] 更新提示詞加入內容質素規則（2026-05-24）
- [x] 升級 schema 至 1.1（加 notes.sections / notes.highlights）（2026-05-24）
- [x] 確立兩階段內容生成流程（2026-05-24）
- [x] 提示詞改用書面語、題型擴充至 7 類、每課 25 題（2026-05-24）
- [x] 加考生年級欄位 + 同年級科目過濾 + 修改年級功能（2026-05-24）
- [x] `subjects/people-p4b/` schema 2.0（L12、L13，書面語、25 題、7 類題型）（2026-05-24/25，待 L14、L16）
- [x] 科目匯入 merge 模式（同 subjectId 自動合併）（2026-05-25）
- [x] 標籤式匯入 UI（年級/學期/科目/章節，自動算 subjectId，可增刪標籤）（2026-05-25）
- [x] **schema 升 2.0**：廢除 subject.json 與 units 結構，一份 JSON = 一課，加 lessonOrder 必填欄位（2026-05-25）
- [ ] `subjects/science-p4b/`（小四下科學，4 課）

## 階段 5：驗收

- [x] 雙擊 `index.html` 可離線運行（2026-05-24）
- [x] 匯入 schema 錯誤的 JSON 顯示清晰錯誤（2026-05-24）
- [x] 多學生獨立累積記錄（2026-05-24）
- [x] 連續考試後弱項加權生效（2026-05-24，已通過自動測試）
- [x] 每次考試隨機抽題 + 選項順序洗牌（2026-05-24）
- [x] 考試頁加「離開考試」按鈕（確認後清除進度返回主頁）（2026-05-24）
- [x] 管理頁密碼保護（固定密碼 "password"，session 內記住）（2026-05-24）
- [x] iPad / iPhone 支援：自製 modal、PWA manifest、觸控優化、匯出 fallback、響應式（2026-05-25）
- [ ] 重新整理瀏覽器後資料保留（待用戶實機驗證）
- [ ] 備份／還原 JSON 正常（待用戶實機驗證）
- [ ] schema 1.1 sections/highlights 在瀏覽器顯示效果合用戶口味（待用戶實機驗證）
- [ ] iPad / iPhone 實機驗證
- [ ] 重新整理瀏覽器後資料保留（待用戶實機驗證）
- [ ] 備份／還原 JSON 正常（待用戶實機驗證）
- [ ] schema 1.1 sections/highlights 在瀏覽器顯示效果合用戶口味（待用戶實機驗證）
.