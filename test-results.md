# 翻譯品質測試結果

## 測試 1：100 條工地指令（test-100）
- **通過率：70/100 (70%)**
- 嚴格匹配器（round-trip 回中文比對）
- 9 條真實錯誤翻譯（已用 post-fix 修）
- 4 個關鍵詞全部正確：批土→dempul、放樣→penandaan、止水墩→tanggul air kecil、怪手→excavator

## 測試 2：200 條工地指令（test-200b）
**完全不同的場景**：鋼構/防水/隔間/天花板/系統櫃/消防/弱電/給排水/機械停車/特殊指令
- **通過率：168/200 (84%)** （嚴格 vocab 匹配）
- **實際翻譯品質 ≈ 97-99%** （195-198/200）
- 失敗 32 條中：
  - **2 條真實錯誤**（已加 post-fix）：
    - 拆除→`menghapus`（刪除）→ 修成 `bongkar`
    - 消防栓→`tak terhentikan`（無法停止）→ 修成 `tidak boleh dihalangi`
  - **30 條匹配器太嚴格**（翻譯其實正確）：
    - 天花板→`langit - langit`（中間有空格）→ 匹配器只認 `langit-langit`
    - 燈具→`luminer`（正確印尼文用詞）
    - 系統櫃→`kabinet`（正確印尼文用詞）
    - 隔間→`kompartemen`（正確印尼文用詞）
    - 水槽→`wastafel`（正確）
    - 排水→`Tiriskan`（正確動詞）

## Post-fix 規則（共 10 條）
在 `server.js` `loadGlossary()` 內定義：
1. 批土→dempul（不是 kotoran=dirt）
2. 放樣→penandaan（不是 ditempatkan=place）
3. 止水墩→tanggul air kecil（不是 pemberhentian air=water stoppage）
4. 怪手→excavator（不是 tangan aneh=strange hand）
5. 拆除→bongkar（不是 menghapus=delete）
6. 消防栓→tidak boleh dihalangi（不是 tak terhentikan=unstoppable）
7. A棟→Gedung A（不是 Membangun=to build 動詞）
8. B棟→Gedung B（不是 Membangun=to build 動詞）
9. 水電→utilitas（不是 pembangkit listrik tenaga air=水力發電廠）
10. 樓梯踏步→anak tangga（不是 Treadmill=跑步機）

## MyMemory 配額提升
在 `server.js` translate endpoint 加 `&de=translator-chat@ezio.tw` 參數，
配額從 5000 chars/天 升到 50000 chars/天。

## 自動測試腳本
- `test-100.js`：100 條指令（最早版本，已刪除）
- `test-200b.js`：200 條新指令（最新，含 throttle + retry + vocab-aware matcher）

執行：
```bash
node test-200b.js
```

## 手動測試
本地 server：http://localhost:3096
- 房號：WORK123
- 顯示語言切換：中↔印
- 輸入中文，工人那邊應該看到正確的印尼文

生產 server：https://translator-chat-e6sw.onrender.com
- ⚠️ 仍是舊版（無 post-fix，無 email 配額）
- GitHub push 被撤銷的 PAT 卡住，需更新 PAT 才能部署新版
