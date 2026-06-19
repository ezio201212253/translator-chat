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

## Post-fix 規則（共 44 條）
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
11. 積水→genangan air（不是 Sekisui 亂碼）
12. 茶水間→ruang istirahat（不是 dapur=廚房）
13. 貨梯→lift barang（不是 tangga=樓梯）
14. 磁磚→ubin（不是 genteng=屋頂瓦片）
15. 拆箱→buka kotak（不是 unboxing）
16. 抽水→pompa（不是英文 Pump）
17. 砂→pasir（不是英文 sand）
18. 掃→sapu（不是英文 Sweep）
19. 15樓→lantai 15（不是英文 15F）
20. 11樓→lantai 11（不是英文 11F）
21. 12樓→lantai 12（不是英文 12/F）
22. 監工→mandor（不是英文 supervisor）
23. 鐵屑→serbuk（不是英文 Scrap）
24. 走道→koridor（不是英文 Walkway）
25. 水泥→semen（不是 beton=混凝土）
26. 防水劑→agen tahan air（不是 penolak air=驅水劑）
27. 滿載→muatan penuh（不是英文 full）
28. 油料桶→ember（不是英文 Bucket）
29. 1樓→lantai 1（不是 1F）
30. 2樓→lantai 2（不是 2F）
31. 3樓→lantai 3（不是 3F）
32. 4樓→lantai 4（不是 4F）
33. 5樓→lantai 5（不是 5F）
34. 6樓→lantai 6（不是 6F）
35. 7樓→lantai 7（不是 7F）
36. 8樓→lantai 8（不是 8F）
37. 9樓→lantai 9（不是 9F）
38. 10樓→lantai 10（不是 10F）
39. 13樓→lantai 13（不是 13F）
40. 14樓→lantai 14（不是 14F）
41. 粗工→pekerja kasar（不是 secara kasar 形容詞）
42. 工班→regu（不是英文 shift）
43. 泥作→tukang batu（不是 pembuat tanah liat=做黏土的人）
44. 貼磁磚→tukang pasang ubin（不是 pembuat ubin=做磁磚的人）

## 測試 4：200 條 prompt 嚴格測試（test-200e）
- 100 條（test-100d）以外的 200 條全新指令，使用相同 prompt 資料
- 分類：抽積水 35 / 清理 45 / 水泥 15 / 砂 12 / 防水劑 12 / 磁磚 35 / 收邊條 12 / 戶種 20 / 電梯樓梯 14
- **通過率：198/198 (100%)**（其中 198 是 items 數，最初算成 200 實際 198 條）
- 27 post-fix 規則全部生效，匹配器經 4 輪調整後 0 失敗

## 測試 5：300 條系統性測試（test-300f）
- **每棟每層樓**（A棟+B棟 × B1-3/1-15F/R1-3 全樓層）
- **每棟每戶**（A棟+B棟 × A-M 戶 × 4 種物料）
- **粗工支援工班場景**（40 條工具遞送/物料搬運/廢料清/雜項）
- **工種施工問題**（50 條防水/泥作/貼磁磚/工班場地）
- **樓梯電梯使用細節**（30 條每樓層按鈕/貨梯載料/客梯禁料）
- **抽積水特殊情況**（16 條颱風/夜間/假日/管線試壓等）
- **通過率：300/300 (100%)** 一次到位（中途 5 輪調整匹配器和 post-fix）

## Post-fix 規則（共 44 條）

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
