# 對話紀錄永久保存設定（Upstash Redis）

## 為什麼要做這件事

Render 免費方案的硬碟是 **ephemeral**：
- 每次重新部署 / 服務重啟 / 15 分鐘沒人用 → `/data/*.json` 全部被清空
- 目前 deploy 完若重啟，之前的對話紀錄會不見

## 為什麼選 Upstash

| | Upstash | Supabase | 自己架 DB |
|---|---|---|---|
| 免費額度 | 10K 指令/天、256MB | 500MB Postgres | 沒有 |
| 設帳號 | 30 秒（GitHub 登入） | 30 秒 | 要花錢 |
| 客戶端 | HTTP REST | REST 但較重 | 要裝驅動 |
| 適合本專案 | ✅ | over-engineered | overkill |

## 設定步驟（5 分鐘）

### 1. 註冊 Upstash
- 開 https://console.upstash.com
- 用 **GitHub 帳號登入**（不用填信用卡）

### 2. 建立 Redis 資料庫
- 點 **Create Database**
- Name: `translator-chat`
- Type: **Regional**（免費方案）
- Region: 選 **Oregon**（跟 Render 同區，速度最快）
- TLS: 預設開著，**不要關**
- 點 Create

### 3. 複製 REST 端點
建立完成後會到 detail 頁面，找這兩個值：

```
UPSTASH_REDIS_REST_URL = https://xxxx-xxxx.upstash.io
UPSTASH_REDIS_REST_TOKEN = AXxx...（很長那串）
```

⚠️ Token 只會顯示一次，先複製下來。

### 4. 設到 Render
- 開 https://dashboard.render.com/web/srv-d8p52d28qa3s73bi3280
- 左邊 **Environment** → 點 **Add Environment Variable**
- 加兩條：
  - Key: `UPSTASH_REDIS_REST_URL` / Value: 貼 URL
  - Key: `UPSTASH_REDIS_REST_TOKEN` / Value: 貼 token
- 點 **Save Changes**（Render 會自動重新部署，約 1-2 分鐘）

### 5. 驗證
部署完成後，打開：
```
https://translator-chat-e6sw.onrender.com/api/storage
```
應該看到：
```json
{"mode":"redis (persistent)","persistent":true,"hasUrl":true,"hasToken":true}
```

如果還是 `local` 模式，檢查：
- 環境變數 key 大小寫有沒有打錯（全大寫，底線分隔）
- 重新部署了沒（Save Changes 後 Render 會自動 deploy）

### 6. 測試持久化
1. 用房號 `WORK123` 發幾則訊息
2. Render dashboard → 該服務 → 右上 **Manual Deploy** → **Clear build cache & deploy**
3. 等約 1 分鐘部署完
4. 重整 `?room=WORK123` → 訊息還在 ✓

## 沒設會怎樣

- 網站照常運作
- 但每次重啟紀錄就消失
- localStorage 還是有「本機快取」（自己裝置看得見），但別人裝置上看不到

## 額度

- 10,000 指令/天
- 一則訊息約 2 個指令（讀 + 寫）
- 等於 **5,000 則訊息/天 免費**
- 一個房間一天傳 50 則都用不完

## 不想用 Upstash 怎麼辦

- 加 **匯出按鈕**（前端把歷史下載成 JSON 備份）
- 或升級 Render 到 **Starter $7/月**（磁碟變持久，不用設 Redis）

要我加匯出按鈕嗎？或想直接接 Upstash？
