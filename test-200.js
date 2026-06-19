// 200 NEW instructions (non-overlapping with the first 100)
const BASE = 'http://localhost:3096';
let TOTAL = 0, PASS = 0, FAIL = 0;
const failures = [];

async function tr(text, from, to) {
  const r = await fetch(BASE + '/api/translate', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, from, to })
  });
  return await r.json();
}

const items = [
  // 物料到貨驗收 (15)
  '水泥到貨先點數量',
  '鋼筋送來要查尺寸',
  '磁磚到場先檢查有沒有破',
  '砂石車來了指揮倒在哪',
  '油漆桶外觀檢查',
  '木材進場要先看有沒有蟲蛀',
  '五金料件按規格分類',
  '化糞池到場要預挖位置',
  '電線到貨看線徑對不對',
  '防水材料要放陰涼處',
  '玻璃到場要直立靠牆',
  '模板料要計算用量',
  '鷹架料清點數量',
  '黏著劑要看有效日期',
  '衛浴設備點收',
  // 排程協調 (15)
  '明天鐵工先來，木工下午到',
  '後天泥作進場',
  '鋼筋工下週一開始',
  '模板這週要完成',
  '水電跟泥作錯開一天',
  '油漆等土作完成才進場',
  '防水測試完才能貼磚',
  '鋁窗等外牆完成再裝',
  '電梯等結構完成',
  '明天要趕工灌漿',
  '這週五前完成一樓',
  '後天監工會來看',
  '下週驗收',
  '工程款月底結算',
  '進度落後要加班',
  // 品質檢查 (15)
  '牆面平整度要 3mm 內',
  '地板水平誤差 5mm',
  '磁磚縫隙 2mm 一致',
  '油漆不能有流掛',
  '模板接縫不能漏漿',
  '鋼筋綁紮間距檢查',
  '防水層厚度檢測',
  '水壓測試 30 分鐘',
  '接地電阻要小於 100 歐姆',
  '混凝土強度測試',
  '門窗安裝垂直度',
  '天花板水平檢查',
  '樓梯踏步尺寸',
  '浴室洩水坡度',
  '陽台排水測試',
  // 天氣環境 (12)
  '颱風來所有鷹架加固',
  '雨天停止戶外施工',
  '高溫中午休息兩小時',
  '颱風前材料蓋防水布',
  '雨天後工地抽水',
  '大太陽要灑水養護',
  '寒流混凝土加防凍劑',
  '大風禁止吊車作業',
  '雷雨停止所有電焊',
  '濕度高油漆要加長乾燥時間',
  '颱風過後工地檢查',
  '地震後結構檢查',
  // 機具操作 (15)
  '怪手移動前確認四周',
  '吊車吊掛範圍禁入',
  '堆高機操作要有證照',
  '混凝土預拌車到場開始卸',
  '抽水機啟動前檢查',
  '發電機加油要熄火',
  '電梯禁止超載',
  '空調安裝要找技師',
  '攪拌機使用完清洗',
  '砂輪機換片要拔插頭',
  '切割機使用要戴護目鏡',
  '風鎚操作要扶穩',
  '電鑽換鑽頭要拔電源',
  '熱風槍用完放冷',
  '噴漆機清洗管路',
  // 人事薪資 (12)
  '今天先領週薪',
  '加班費另計',
  '借支下月薪水',
  '工地茶水間有飲水',
  '中午休息一小時',
  '身體不舒服要回報',
  '受傷立刻去包紮',
  '工地禁止喝酒',
  '禁止帶外人進入',
  '證件要隨身攜帶',
  '領班會發識別證',
  '工作完簽退',
  // 溝通配合 (12)
  '跟隔壁工班錯開使用電梯',
  '樓上施工注意下面',
  '敲牆前先通知樓下',
  '灌漿時段其他工種暫停',
  '用電量大要分時段',
  '機器故障立刻回報',
  '缺料跟倉庫說',
  '工具壞了回報領班',
  '有問題找監工',
  '完工等驗收',
  '變更設計要問設計師',
  '不懂的事問師傅',
  // 解決問題 (15)
  '牆角漏水找水電',
  '鋼筋鏽蝕要除鏽',
  '模板爆模立刻停止灌漿',
  '混凝土裂縫修補',
  '磁磚空心要重貼',
  '油漆剝落要刮除重漆',
  '水管堵塞要通',
  '排水不通要清',
  '漏電要查',
  '燈不亮換燈管',
  '門窗卡住要調整',
  '馬桶不通要通',
  '地板隆起要重做',
  '牆壁裂縫要補強',
  '屋頂漏水要修',
  // 文件記錄 (10)
  '每天填寫施工日誌',
  '進場材料要登錄',
  '完工要拍照上傳',
  '變更要填單',
  '估價單給業主',
  '合約要看清楚',
  '發票要保留',
  '收料單要簽名',
  '請款單月底交',
  '驗收單要雙方簽',
  // 工地設施 (10)
  '廁所在工地右側',
  '飲水機在休息區',
  '工具間鑰匙在領班',
  '急救箱在辦公室',
  '滅火器位置要知道',
  '緊急出口在哪要清楚',
  '工地大門 7 點開',
  '訪客登記才能進',
  '車輛停指定區',
  '垃圾分類桶配置',
  // 工具使用 (15)
  '電鑽先鑽導孔',
  '砂輪機要裝防護罩',
  '切管器順時針轉',
  '壓接鉗壓接要確實',
  '雷射水平儀校正',
  '測距儀量好記錄',
  '油壓千斤頂慢慢頂',
  '吊車吊帶檢查',
  '鋁梯展開要平穩',
  '鷹架踏板鋪滿',
  '墨斗彈線要拉緊',
  '水平尺要水平',
  '捲尺量好要復量',
  '扳手鎖緊不能過頭',
  '鐵剪剪鐵皮慢慢剪',
  // 數字規格 (15)
  '鋼筋間距 15 公分',
  '混凝土厚度 12 公分',
  '模板高度 280 公分',
  '樓梯踏步 17 公分高',
  '樓梯踏面 28 公分',
  '牆厚 15 公分',
  '樓板厚 12 公分',
  '樑寬 25 公分',
  '柱寬 40 公分',
  '門寬 90 公分',
  '窗高 120 公分',
  '樓層高 3 米 2',
  '樓梯寬 1 米 2',
  '浴室地坪洩水坡 1%',
  '屋頂洩水坡 2%',
  // 多步驟 (12)
  '先清再量再切再裝',
  '拆模養護再粉刷',
  '放樣綁筋封模灌漿拆模',
  '鑽孔鎖螺絲固定',
  '鋪防水層試水再貼磚',
  '牆面找平批土打磨上漆',
  '水管試壓再封管',
  '電線穿管再配線',
  '鋁窗安裝塞水路打矽利康',
  '木作放樣切割組裝固定',
  '拆除清理搬運廢棄物',
  '模板組立綁筋灌漿養護',
  // 條件指令 (10)
  '如果下雨就停工',
  '沒材料就回報',
  '超過時間加班要算',
  '屋主在要穿整齊',
  '監工來要主動回報',
  '有問題不能自己做主',
  '工具不夠去鄰近工地借',
  '加班要提前申請',
  '颱風來要撤離',
  '危險工作要有兩人在場',
  // 日常打招呼 (8)
  '早安',
  '你好',
  '辛苦了',
  '吃飽沒',
  '今天天氣不錯',
  '加油',
  '注意安全',
  '慢慢來不要急',
  // 確認回報 (10)
  '收到',
  '了解',
  '好的沒問題',
  '馬上過去',
  '等一下過去',
  '現在在做什麼',
  '進度到哪裡',
  '還要多久',
  '還有別的事嗎',
  '沒事我先去忙'
];

// relaxed matcher: at least one content word from orig appears in round-trip
function extractContentWords(zh) {
  // split by common Chinese particles
  const tokens = [];
  const re = /[一-鿿]{2,}/g;
  let m;
  while ((m = re.exec(zh)) !== null) tokens.push(m[0]);
  return tokens;
}
function semanticOK(orig, id, back) {
  const tokens = extractContentWords(orig);
  if (tokens.length === 0) return true; // very short like 早安
  // also strip 1-char functional
  let hits = 0;
  for (const t of tokens) {
    if (back.indexOf(t) !== -1) hits++;
  }
  return hits >= 1;
}
function glossaryOK(orig, id) {
  const checks = [
    { zh: '批土', mustId: 'dempul' },
    { zh: '放樣', mustId: 'penandaan' },
    { zh: '止水墩', mustId: 'tanggul air kecil' }
  ];
  for (const c of checks) {
    if (orig.indexOf(c.zh) !== -1 && id.indexOf(c.mustId) === -1) {
      return `missing "${c.mustId}" for "${c.zh}"`;
    }
  }
  return null;
}

(async () => {
  console.log('='.repeat(72));
  console.log(`  200-instruction integration test (post-fix + force-include)`);
  console.log(`  Source: zh-TW → id → zh-TW round-trip`);
  console.log('='.repeat(72));
  for (const orig of items) {
    TOTAL++;
    const r1 = await tr(orig, 'zh-TW', 'id');
    const id = r1.translatedText;
    const r2 = await tr(id, 'id', 'zh-TW');
    const back = r2.translatedText;
    const sem = semanticOK(orig, id, back);
    const glos = glossaryOK(orig, id);
    if (sem && !glos) PASS++;
    else { FAIL++; failures.push({ orig, id, back, glos }); }
  }
  console.log(`\n=== RESULT ===`);
  console.log(`PASS: ${PASS} / ${TOTAL}  (${Math.round(PASS/TOTAL*100)}%)`);
  console.log(`FAIL: ${FAIL}\n`);

  // categorize failures
  const realBad = []; // would confuse worker
  const minor = [];   // understandable, just word choice
  for (const f of failures) {
    const id = f.id.toLowerCase();
    // heuristic: real bad if id has clearly wrong words or no relevant content
    const hasIndo = /[a-z]/.test(id) && id.replace(/[^a-z]/g, '').length > 3;
    const hasRelevant = extractContentWords(f.orig).some(w =>
      f.id.toLowerCase().indexOf(w) !== -1 || f.back.indexOf(w) !== -1
    );
    if (f.glos || !hasIndo) realBad.push(f);
    else if (!hasRelevant) realBad.push(f);
    else minor.push(f);
  }
  console.log(`  Real bad (would mislead worker): ${realBad.length}`);
  console.log(`  Minor (understood, just word choice): ${minor.length}\n`);

  if (realBad.length) {
    console.log('='.repeat(72));
    console.log('Real-bad translations:');
    console.log('='.repeat(72));
    for (const f of realBad) {
      console.log(`\n  ${f.orig}`);
      console.log(`  -> id:    ${f.id}`);
      console.log(`  -> back:  ${f.back}`);
      if (f.glos) console.log(`  *** ${f.glos}`);
    }
  }
  if (minor.length && minor.length <= 25) {
    console.log('\n' + '='.repeat(72));
    console.log('Minor issues:');
    console.log('='.repeat(72));
    for (const f of minor) {
      console.log(`\n  ${f.orig}`);
      console.log(`  -> id:    ${f.id}`);
      console.log(`  -> back:  ${f.back}`);
    }
  } else if (minor.length) {
    console.log(`\n(minor issues: ${minor.length} — only showing first 25)`);
    for (const f of minor.slice(0, 25)) {
      console.log(`  ${f.orig}  ->  ${f.id}`);
    }
  }
})();
