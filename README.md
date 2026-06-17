# 翻譯即時通 (Translator Chat)

即時通訊 + 自動翻譯，雙方用手機瀏覽器即可使用，支援 **中文 / 英文 / 印尼文** 三語互譯。

## 功能

- **匿名 + 房間代碼**：輸入相同的 4-8 碼房號即可配對，不需註冊帳號
- **自動翻譯**：發送時自動翻成三種語言版本，接收端依自己的顯示語言顯示
- **顯示語言切換**：每則訊息有「原文」按鈕可切換查看原文
- **對話紀錄保存**：伺服器以 JSON 檔保存每個房間的歷史訊息（最多 1000 則）
- **翻譯獨立頁面**：無需對方，自己貼文也能翻譯（`/translate.html`）
- **手機優先**：響應式設計，iOS / Android 瀏覽器直接用
- **免費翻譯 API**：使用 MyMemory 公開 API，不需 API key

## 技術

- Node.js 18+ / Express / ws (WebSocket)
- 翻譯：MyMemory `api.mymemory.translated.net`（無需註冊）
- 儲存：本地 JSON 檔（每房間一個檔案）
- 部署：Render 免費方案（推薦）

---

## 本機啟動

需要 Node.js 18 以上。

```bash
cd translator-chat
npm install
npm start
# 開啟 http://localhost:3000
```

---

## 部署到 Render（免費）

### 1. 推到 GitHub

在你的電腦上：

```bash
cd translator-chat
git init
git add .
git commit -m "init"
# 然後在 GitHub 開一個新 repo，照 GitHub 指示 push
```

> 沒裝 git 也可以手動到 GitHub 網頁上傳檔案（把整個 `translator-chat` 資料夾拖進新建的 repo）。

### 2. 在 Render 建立 Web Service

1. 到 https://render.com 註冊並登入
2. 點 **New +** → **Web Service**
3. 連接你的 GitHub repo
4. 設定：
   - **Environment**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: Free
5. 點 **Create Web Service**

部署完成後 Render 會給你一個網址，例如：

```
https://translator-chat-xxxx.onrender.com
```

這個網址就能在電腦和手機上用，**不用裝任何 App**。

### 3. 給印尼方的使用方式

把網址 + 房號用 WhatsApp / SMS 傳給對方，例如：

> 打開這個網址：`https://translator-chat-xxxx.onrender.com`
> 房號輸入：`ABC123`
> 你的名字填自己的名字
> 顯示語言選「印尼文」
> 就可以開始對話

---

## 使用說明

### 開始聊天
1. 開啟網址，看到登入畫面
2. 輸入你的名字（例如：王先生 / Pak Ahmad）
3. 輸入或產生一個房號（4-8 個英數字）
4. 選擇「對方看到的語言」（對方開啟後看到的語言）
5. 選擇「我打字的語言」（你輸入訊息時的語言）
6. 點「加入 / 建立房間」

### 兩邊都加入後
- 你打的訊息會出現在對方手機上，但**自動翻譯成對方選的語言**
- 對方打的訊息會出現在你這邊，**自動翻譯成你看得到的語言**
- 每則訊息下方有「原文」按鈕，點下去可看原始內容

### 純翻譯（不需對方）
- 網址後面加 `/translate.html`
- 貼上文字、選語言、點翻譯
- 也支援自動偵測來源語言

---

## 翻譯額度

MyMemory 免費方案：每天 5000 字 / 每 IP。
- 短對話（每天幾十則）絕對夠用
- 大量批次翻譯會被限流，會看到「原文」回退

如要更高額度可改用 Google Translate API（需在 `.env` 設 key 後改寫 `server.js` 的 `/api/translate` endpoint）。

---

## 檔案結構

```
translator-chat/
├── server.js          # Express + WebSocket + 翻譯代理
├── package.json
├── .gitignore
├── README.md
└── public/
    ├── index.html     # 聊天主頁
    ├── translate.html # 純翻譯頁
    ├── style.css
    ├── client.js      # 聊天前端
    └── translate.js   # 翻譯頁前端
```

對話紀錄會存在 `data/<房號>.json`（首次部署後自動建立）。

---

## 隱私 / 注意事項

- 房間代碼就是「密碼」，知道代碼的人都能看到對話
- 對話紀錄存在 Render 磁碟，**免費方案重啟後資料可能會不見**（Render 不保證磁碟持久性）
- 如要永久保存紀錄，建議付費升級 Render 或改接 Supabase
- 翻譯經過 MyMemory 第三方 API，敏感內容請自行評估
