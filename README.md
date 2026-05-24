# 📚 Study Guy

一個本地運行的 HTML 溫習與模擬考試系統，協助學生（小二至小六）就不同科目進行溫習與考試，並透過累積考試記錄分析弱項，於下一次考試針對性加強練習。

**Live demo**：https://himyeung4072.github.io/study_guy/

## 特點

- 🌐 **純前端，無後端**：HTML + CSS + 原生 JavaScript，零依賴
- 📱 **支援桌面與 iPad / iPhone**：PWA、可加入主畫面變成 App
- 🔒 **資料留本機**：所有考生與考試記錄存於瀏覽器 `localStorage`
- 🎯 **智能弱項分析**：自動找出較弱課別並加強出題
- 🏷️ **標籤式內容匯入**：選年級／學期／科目，拖入 lesson JSON 即可
- 🎲 **隨機抽題 + 選項洗牌**：每次考試題目與選項順序都不同
- 📝 **多元出題技巧**：7 類題型（正向、反向、因果、對比、配對、順序、情境）

## 快速開始

### 線上使用

1. 用 Safari/Chrome 開 https://himyeung4072.github.io/study_guy/
2. 主頁建立考生 → 選年級
3. 進「管理」（密碼：`password`）→ 選標籤 → 拖入 lesson JSON
4. 回主頁選科目 → 開始溫習／考試

### 本地使用（離線）

```sh
git clone https://github.com/himyeung4072/study_guy.git
cd study_guy
# 直接雙擊 index.html，或用任何 static server，例如：
python -m http.server 8000
# 然後開 http://localhost:8000
```

### 加入 iPad / iPhone 主畫面

1. 用 Safari 開上述網址
2. 按右上角「分享」→「加入主畫面」
3. 桌面會出現 📚 Study Guy 圖示，點按變全螢幕 App

## 內容格式

每個科目由若干份 lesson JSON 組成，**不需 `subject.json`**（schema 2.0）。

```
subjects/
  people-p4b/
    L12.json
    L13.json
    ...
```

詳細格式：[`docs/content-format.md`](docs/content-format.md)

範本：[`tools/lesson-template/L01.json`](tools/lesson-template/L01.json)

## 由 PDF 產生 JSON

如要把課文 PDF 轉為 lesson JSON，請把 [`docs/agent-prompt-pdf-to-json.md`](docs/agent-prompt-pdf-to-json.md) 整份貼給有視覺能力的 AI（ChatGPT、Claude、Gemini），跟住流程做即可。

## 文檔

- [`docs/project-overview.md`](docs/project-overview.md)：專案目的與功能說明
- [`docs/content-format.md`](docs/content-format.md)：JSON 格式規範
- [`docs/agent-prompt-pdf-to-json.md`](docs/agent-prompt-pdf-to-json.md)：給 AI 的 PDF→JSON 提示詞
- [`docs/TODO.md`](docs/TODO.md)：開發進度

## 隱私

- 所有資料（考生、考試記錄、匯入的科目）均儲存於瀏覽器 `localStorage`
- 系統不會把任何資料上傳至伺服器
- 跨裝置使用：請用「管理 → 匯出備份」匯出 JSON，在新裝置「還原」即可

## 授權

程式 code 採 MIT 授權。
匯入的課文／試題內容版權屬原出版社所有，本系統僅作個人溫習用途。

## 開發

無建置流程，純靜態檔。修改後重新整理瀏覽器即可。

跑測試（需 Node.js）：

```sh
node tools/test-stage2.js
```
