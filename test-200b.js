// 200 NEW instructions (non-overlapping with first 100 AND second 200) — throttled + retry
const BASE = 'http://localhost:3096';
let TOTAL = 0, PASS = 0, FAIL = 0;
const failures = [];

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function tr(text, from, to, attempt = 0) {
  try {
    const r = await fetch(BASE + '/api/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, from, to })
    });
    const j = await r.json();
    if (!j.translatedText && j.error) {
      // rate-limited or upstream error → backoff and retry
      if (attempt < 4) {
        await sleep(1500 * (attempt + 1));
        return tr(text, from, to, attempt + 1);
      }
    }
    return j;
  } catch (e) {
    if (attempt < 3) { await sleep(1500); return tr(text, from, to, attempt + 1); }
    return { translatedText: '', error: e.message };
  }
}

const items = [
  // 鋼構焊接 (12)
  '鋼樑吊裝要兩端同時',
  '焊接前要清鏽',
  'H 鋼要對準再焊',
  '電焊要戴面罩',
  '瓦斯要放通風處',
  '焊渣要用刷子清',
  '鋼板接縫要滿焊',
  '銲道檢查不能有氣孔',
  '鋼構除鏽後要上漆',
  '螺栓鎖緊扭力要夠',
  '鋼柱垂直度檢查',
  '鋼樑銜接要墊片',
  // 防水細節 (12)
  '防水層至少刷兩道',
  '浴室防水要做 180 公分',
  '屋頂防水轉角要加強',
  '防水塗料要攪拌均勻',
  '防水完成後要試水 24 小時',
  '試水沒漏再做下一層',
  '落水頭周圍要加強防水',
  '窗框四周塞水路',
  '矽利康填滿不能有空隙',
  '防水層乾燥才能貼磚',
  '排水管轉角不能直角',
  '浴缸下方也要做防水',
  // 隔間牆 (10)
  '輕隔間骨架間距 60 公分',
  '隔間牆要預留門洞',
  '隔音棉要塞滿',
  '矽酸鈣板用自攻螺絲固定',
  '隔間內電管要先配',
  '隔間完成不能有鼓起',
  '接縫要貼網帶',
  '牆面垂直誤差 3mm 內',
  '隔間牆厚度 10 公分',
  '隔間與結構縫要填彈性材',
  // 天花板 (10)
  '天花板高度要標記',
  '吊筋間距 90 公分',
  '矽酸鈣板天花板要先放樣',
  '冷氣出風口要預留',
  '燈具孔要先開',
  '維修孔位置要預留',
  '天花板不能有高低差',
  '收邊要水平',
  '造型天花板要照圖施工',
  '天花板完成要清潔',
  // 地板細節 (10)
  '地板鋪設前要掃乾淨',
  '木地板要留伸縮縫',
  '拋光石英磚要對花',
  '浴室地坪要洩水坡',
  '地板膠要塗均勻',
  '架高地板要先放樣',
  '地坪不能有空心',
  '地板完成要鋪保護板',
  '樓梯止滑條要裝',
  '踢腳板安裝要平整',
  // 衛浴安裝 (10)
  '馬桶安裝要對準排水口',
  '臉盆高度 80 公分',
  '淋浴龍頭要水平',
  '馬桶水箱配件要齊',
  '浴缸進排水測試',
  '衛浴五金鎖牆',
  '鏡子高度 150 公分',
  '毛巾架位置',
  '浴室門要外開',
  '防水做好才能貼磚',
  // 廚房 (8)
  '流理台高度 85 公分',
  '廚具進場順序',
  '瓦斯爐要離牆 15 公分',
  '抽油煙機管路要短',
  '廚房插座要 220V',
  '水槽要測試排水',
  '廚櫃門板要對齊',
  '廚房門要防火',
  // 鐵件 (8)
  '鐵窗要量準確',
  '鐵捲門要測試',
  '鐵欄杆高度 110 公分',
  '樓梯扶手高度',
  '鐵件除鏽要徹底',
  '防鏽漆至少兩道',
  '鐵件焊接要滿',
  '不鏽鋼不能污染',
  // 鋁窗 (8)
  '鋁窗框塞水路',
  '鋁窗玻璃要裝',
  '窗戶外框要水平',
  '氣密窗測試',
  '紗窗軌道要通',
  '窗台要洩水坡',
  '鋁門安裝要平',
  '推窗要測試',
  // 木作 (10)
  '木作放樣要精準',
  '木料要看紋路',
  '木作接榫要密合',
  '木作表面要打磨',
  '木作底漆要塗',
  '木作完成要保護',
  '木作不能有蟲蛀',
  '防腐材要用在戶外',
  '木螺絲要先鑽孔',
  '木作表面要平整',
  // 系統櫃 (8)
  '系統櫃要先組立',
  '系統櫃要對齊',
  '門片要水平',
  '抽屜要測試',
  '五金配件要齊',
  '系統櫃後面要靠牆',
  '衣櫃深度 60 公分',
  '鞋櫃分層要合',
  // 油漆細節 (10)
  '油漆底漆要先刷',
  '批土要等乾再磨',
  '油漆塗刷要均勻',
  '牆角要貼紙膠帶',
  '油漆不能有刷痕',
  '顏色要對色票',
  '乳膠漆要加水稀釋',
  '戶外漆要用防水',
  '木器漆要等乾',
  '噴漆要均勻',
  // 磁磚細節 (10)
  '磁磚泡水後才能貼',
  '磁磚縫要對齊',
  '磁磚切割要戴口罩',
  '黏著劑要梳齒狀塗',
  '磁磚敲擊不能有空音',
  '磁磚填縫要飽滿',
  '磁磚清潔要等填縫乾',
  '浴室地磚要防滑',
  '大理石要對花紋',
  '抿石子要先打底',
  // 景觀植栽 (8)
  '植栽要先挖洞',
  '樹木要立支架',
  '草地要灑水',
  '排水要順暢',
  '花台高度 60 公分',
  '步道鋪設要平',
  '圍籬要牢固',
  '戶外燈具防水',
  // 拆除細節 (8)
  '拆除前先斷水斷電',
  '拆除順序由上往下',
  '拆除前先拍照存證',
  '結構不能隨便拆',
  '玻璃拆除要戴手套',
  '石綿要專業處理',
  '廢棄物分類',
  '拆除後要清運',
  // 環保廢棄物 (8)
  '廢土要集中',
  '廢金屬要回收',
  '廢木材要分類',
  '廢油漆桶要回收',
  '化學廢液要專業處理',
  '工地垃圾不落地',
  '廢棄物每天清運',
  '回收桶要標示',
  // 消防 (8)
  '滅火器要定期檢查',
  '消防栓位置不能擋',
  '逃生動線要通',
  '緊急照明要測試',
  '煙霧偵測器位置',
  '撒水頭間距',
  '消防泵浦測試',
  '防火門要關',
  // 弱電 (8)
  '網路線要穿管',
  '監視器位置要規劃',
  '對講機測試',
  '門禁系統設定',
  '弱電機房要通風',
  '電視插座預留',
  '電話線配管',
  '弱電要避開強電',
  // 給排水 (10)
  '自來水管要試壓',
  '排水管要洩水坡',
  '化糞池位置',
  '污水管轉角用 45 度',
  '通氣管要伸頂',
  '給水泵要測試',
  '熱水管要包保溫',
  '止水閥要裝',
  '排水分支要順',
  '落水管要接',
  // 機械停車 (6)
  '機械停車測試升降',
  '機械停車不能超重',
  '機械車位標示',
  '機械車位防落',
  '機械車位照明',
  '機械車位檢查',
  // 工地清潔 (8)
  '每日收工前要清',
  '公共區域每天掃',
  '廁所定期消毒',
  '茶水間保持乾淨',
  '機具用完要清',
  '工具歸位',
  '工地大門前清',
  '走道不堆料',
  // 特殊指令 (10)
  '今天加班到深夜',
  '穿反光背心',
  '安全帽要戴好',
  '帶自己的午餐',
  '帶杯子喝水',
  '今天有訪客',
  '不要吸菸',
  '手機放震動',
  '下午有會議',
  '明天有會勘'
];

// loose matcher — Indonesian worker only needs key vocabulary words present
const vocabChecks = [
  // [mustBeInOriginalZh, mustBeSomewhereInId]
  ['鋼樑', ['balok baja', 'baja']],
  ['焊接', ['las', 'pengelasan']],
  ['清鏽', ['karat', 'hapus karat']],
  ['電焊', ['las', 'pengelasan']],
  ['瓦斯', ['gas']],
  ['焊渣', ['terak']],
  ['螺栓', ['baut']],
  ['垂直度', ['tegak lurus', 'vertikal']],
  ['防水', ['tahan air', 'kedap air', 'waterproof']],
  ['浴室', ['kamar mandi']],
  ['試水', ['uji air', 'tes air']],
  ['矽利康', ['silikon', 'silicone']],
  ['落水頭', ['kepala air']],
  ['隔間', ['partisi', 'sekat']],
  ['隔音', ['kedap suara']],
  ['天花板', ['langit-langit', 'plafon']],
  ['冷氣', ['AC', 'pendingin']],
  ['燈具', ['lampu']],
  ['木地板', ['lantai kayu']],
  ['拋光', [' poles', 'mengkilap']],
  ['馬桶', ['toilet', 'kloset']],
  ['臉盆', ['baskom', 'wastafel']],
  ['龍頭', ['keran']],
  ['流理台', ['meja', 'counter']],
  ['瓦斯爐', ['kompor']],
  ['抽油煙機', ['penghisap asap', 'exhaust']],
  ['水槽', ['bak cuci']],
  ['鐵窗', ['jendela besi']],
  ['扶手', ['pegangan', 'handrail']],
  ['防鏽', ['antikarat', 'anti karat']],
  ['鋁窗', ['jendela aluminium']],
  ['氣密', ['kedap udara', 'kedap']],
  ['木作', ['kayu', 'pertukangan kayu']],
  ['系統櫃', ['lemari']],
  ['批土', ['dempul']],
  ['油漆', ['cat']],
  ['磁磚', ['ubin', 'keramik']],
  ['黏著劑', ['perekat', 'lem']],
  ['大理石', ['marmer']],
  ['植栽', ['tanaman']],
  ['樹木', ['pohon']],
  ['草地', ['rumput']],
  ['拆除', ['bongkar', 'pembongkaran']],
  ['廢土', ['tanah']],
  ['廢金屬', ['logam']],
  ['滅火器', ['pemadam', 'alat pemadam']],
  ['消防', ['pemadam kebakaran']],
  ['逃生', ['evakuasi', 'keluar']],
  ['監視器', ['kamera pengawas', 'CCTV']],
  ['門禁', ['kontrol akses', 'akses']],
  ['自來水', ['air ledeng']],
  ['排水', ['pembuangan', 'drainase']],
  ['化糞池', ['septictank']],
  ['通氣管', ['ventilasi']],
  ['熱水', ['air panas']],
  ['止水閥', ['katup']],
  ['機械停車', ['mekanis', 'parkir mekanis']],
  ['加班', ['lembur']],
  ['安全帽', ['helm', 'topi keras']],
  ['反光', ['reflektif', 'memantulkan cahaya']],
  ['吸菸', ['merokok', 'rokok']]
];

function vocabOK(orig, id) {
  const idLow = id.toLowerCase();
  for (const [zh, words] of vocabChecks) {
    if (orig.indexOf(zh) !== -1) {
      const hit = words.some(w => idLow.indexOf(w.toLowerCase()) !== -1);
      if (!hit) return `missing vocab for "${zh}": expected one of ${JSON.stringify(words)}`;
    }
  }
  return null;
}
function glossaryOK(orig, id) {
  const checks = [
    { zh: '批土', mustId: 'dempul' },
    { zh: '放樣', mustId: 'penandaan' }
  ];
  for (const c of checks) {
    if (orig.indexOf(c.zh) !== -1 && id.toLowerCase().indexOf(c.mustId) === -1) {
      return `missing glossary "${c.mustId}" for "${c.zh}"`;
    }
  }
  return null;
}

(async () => {
  console.log('='.repeat(72));
  console.log(`  200-instruction integration test #2 (post-fix + vocab-aware)`);
  console.log(`  Source: zh-TW → id, vocab-match against Indonesian construction terms`);
  console.log('='.repeat(72));
  let i = 0;
  for (const orig of items) {
    TOTAL++;
    i++;
    const r1 = await tr(orig, 'zh-TW', 'id');
    const id = (r1.translatedText || '').trim();
    const glos = glossaryOK(orig, id);
    const voc = vocabOK(orig, id);
    if (!glos && !voc) PASS++;
    else { FAIL++; failures.push({ idx: i, orig, id, glos, voc }); }
    if (i % 20 === 0) {
      console.log(`  progress: ${i}/${items.length} (pass=${PASS} fail=${FAIL})`);
    }
    await sleep(400); // throttle so we don't hit MyMemory rate limit
  }
  console.log(`\n=== RESULT ===`);
  console.log(`PASS: ${PASS} / ${TOTAL}  (${Math.round(PASS/TOTAL*100)}%)`);
  console.log(`FAIL: ${FAIL}\n`);

  if (failures.length) {
    console.log('='.repeat(72));
    console.log('Failures:');
    console.log('='.repeat(72));
    for (const f of failures) {
      console.log(`\n  [${f.idx}] ${f.orig}`);
      console.log(`        id:  ${f.id || '(empty)'}`);
      if (f.glos) console.log(`        *** ${f.glos}`);
      if (f.voc)  console.log(`        *** ${f.voc}`);
    }
  }
})();
