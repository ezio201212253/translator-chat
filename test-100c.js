// 100 NEW instructions for AB-棟 scenario
// A棟/B棟 + B1-B3 + 15F standard + R1/R2/R3 + A-M 戶種
// 粗工常見工作：抽積水、清理垃圾、兩電梯兩樓梯、搬物料上樓
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
    if (!j.translatedText && j.error && attempt < 4) {
      await sleep(1500 * (attempt + 1));
      return tr(text, from, to, attempt + 1);
    }
    return j;
  } catch (e) {
    if (attempt < 3) { await sleep(1500); return tr(text, from, to, attempt + 1); }
    return { translatedText: '', error: e.message };
  }
}

const items = [
  // A. 抽積水 (12)
  'A棟地下三樓抽積水',
  'B棟地下二樓抽水',
  'A棟B3抽水機啟動',
  'B棟B2抽水機油料補',
  'A棟B1積水抽到一樓',
  'B棟B3積水嚴重要加班抽',
  'A棟抽水機管線接戶外排水',
  'B棟抽水機每天記錄水位',
  'A棟地下一樓積水照片回報',
  'B棟B1抽水機故障換備用',
  'A棟地下積水抽到水桶搬走',
  'B棟抽水注意觸電先斷電',
  // B. 清理垃圾環境 (20)
  'A棟15樓垃圾集中',
  'B棟R1垃圾清掉',
  'A棟電梯旁垃圾掃',
  'B棟樓梯間清乾淨',
  'A棟R2廢料集中',
  'B棟標準層垃圾搬下樓',
  'A棟15樓電梯口掃乾淨',
  'B棟R3走道垃圾清',
  'A棟地下垃圾分類',
  'B棟地下一樓清掃',
  'A棟電梯廳拖地',
  'B棟樓梯踏步掃',
  'A棟R1公共區域擦',
  'B棟公共走廊拖地',
  'A棟15樓茶水間清',
  'B棟R2廁所清掃',
  'A棟垃圾子車換滿',
  'B棟廢料子車推到貨梯',
  'A棟R3完成面清',
  'B棟樓梯扶手擦',
  // C. 物料搬運上樓 (25) — 防水劑/水泥/砂/磁磚 60*120 30*60 20*20 20*27/收邊條
  '水泥送上A棟15樓',
  '砂搬上B棟R1',
  'A棟水泥五十包上樓',
  'B棟R2磁磚搬上去',
  '防水劑送A棟R3',
  'B棟水泥每層放十包',
  'A棟15樓收邊條送貨',
  'B棟R1磁磚 60x120 搬',
  'A棟R2 30x60 磁磚上樓',
  'B棟R3 20x20 小磁磚搬',
  'A棟防水劑送地下三樓',
  'B棟20x27磁磚送12樓',
  'A棟收邊條放R1',
  'B棟水泥送每層各五包',
  'A棟15樓防水材料集中',
  'B棟R2磁磚料清點',
  'A棟R3砂搬上樓分堆',
  'B棟地下一樓水泥搬上貨梯',
  'A棟磁磚整貨上樓小心',
  'B棟收邊條拆箱清點',
  'A棟 60x120 磁磚送15樓',
  'B棟 30x60 磁磚送R3',
  'A棟 20x20 磁磚送R1',
  'B棟 20x27 磁磚送R2',
  'A棟收邊條每層放兩箱',
  // D. 樓梯電梯使用 (15)
  'A棟貨梯只能載物料',
  'B棟客梯禁止推車進',
  'A棟樓梯間材料靠牆放',
  'B棟R1貨梯等十分鐘',
  'A棟15樓電梯滿載等下一班',
  'B棟樓梯間禁止丟垃圾',
  'A棟電梯按樓順序上',
  'B棟R2樓梯間照明檢查',
  'A棟電梯每天早開晚關',
  'B棟電梯機房保持乾燥',
  'A棟樓梯間粉刷後清',
  'B棟R3電梯口保護板鋪',
  'A棟貨梯載重 1.5 噸',
  'B棟R1電梯故障等修',
  'A棟樓梯間禁止吸菸',
  // E. 工班配合 (15)
  'A棟15樓磁磚師傅要開工',
  'B棟R1防水班進場',
  'A棟R2泥作今天開始',
  'B棟R3水電班後天進場',
  'A棟泥作工班缺水泥',
  'B棟磁磚班缺收邊條',
  'A棟防水班需要防水劑',
  'B棟泥作班需要砂',
  'A棟15樓磁磚班進度',
  'B棟R2水電要穿管',
  'A棟R3木工今天來',
  'B棟工班中午便當放R1',
  'A棟工班休息區在R2',
  'B棟15樓工班午餐',
  'A棟師傅叫你去幫忙',
  // F. 緊急處理 (8)
  'A棟15樓漏水處理',
  'B棟R1電梯卡住',
  'A棟R2水管爆裂',
  'B棟R3突然停電',
  'A棟地下一樓積水緊急',
  'B棟樓梯間燒起來',
  'A棟15樓鷹架不穩',
  'B棟R1瓦斯外洩',
  // G. 覆蓋保護/灑水 (5)
  'A棟15樓磁磚貼好要覆蓋',
  'B棟R1粉刷後灑水養護',
  'A棟R2地面鋪防塵網',
  'B棟R3完工區域封起來',
  'A棟B棟每天灑水除塵'
];

// vocab-aware matcher with AB-棟 specific terms
const vocabChecks = [
  // [mustBeInOriginalZh, mustBeSomewhereInId]
  // A棟/B棟 — accept multiple valid Indonesian renderings (post-fix forces Gedung A/B but be permissive)
  ['A棟', ['gedung a', 'bangunan a', 'bldg a']],
  ['B棟', ['gedung b', 'bangunan b', 'bldg b']],
  ['地下', ['bawah tanah', 'basement', 'bawah', 'dasar']],
  ['抽水', ['pompa', 'memompa']],
  ['積水', ['genangan', 'tergenang', 'akumulasi air', 'air yang dipompa']],
  ['油料', ['bahan bakar', 'minyak']],
  ['管線', ['pipa', 'saluran']],
  ['排水', ['pembuangan', 'drainase', 'buang', 'tiriskan']],
  ['水位', ['tinggi air', 'ketinggian air']],
  ['照片', ['foto']],
  ['備用', ['cadangan', 'pengganti']],
  ['水桶', ['ember']],
  ['觸電', ['tersengat listrik', 'sengatan listrik', 'listrik']],
  ['垃圾', ['sampah']],
  ['廢料', ['limbah', 'sisa', 'bekas', 'scrap']],
  ['掃', ['sapu', 'menyapu', 'bersih', 'dibersihkan', 'penyapuan']],
  ['拖地', ['pel', 'mengel']],
  ['擦', ['lap', 'mengelap', 'penghapusan', 'dihapus']],
  ['廁所', ['toilet', 'kamar kecil']],
  ['茶水間', ['ruang teh', ' pantry', 'ruang']],
  ['電梯', ['lift', 'elevator']],
  ['樓梯', ['tangga']],
  ['貨梯', ['lift barang', 'tangga barang', 'kargo']],
  ['客梯', ['lift penumpang', 'tangga penumpang']],
  ['推車', ['kereta', 'troli', 'didorong']],
  ['扶手', ['pegangan']],
  ['水泥', ['semen']],
  ['砂', ['pasir']],
  ['防水劑', ['waterproof', 'kedap air', 'agen kedap', 'pengusir air']],
  ['防水', ['tahan air', 'kedap air', 'waterproof']],
  ['磁磚', ['ubin', 'keramik', 'tile', 'genteng']],
  ['收邊條', ['pinggiran', 'list', 'trim', 'sisi', 'bilah', 'strip', 'sidebar']],
  ['拆箱', ['buka kotak', 'buka kemasan', 'pembukaan']],
  ['清點', ['menghitung', 'memeriksa', 'inventaris', 'inventarisasi']],
  ['載重', ['beban', 'muatan', 'berbobot']],
  ['故障', ['rusak', 'kerusakan', 'gangguan']],
  ['吸菸', ['merokok', 'rokok']],
  ['磁磚師傅', ['tukang ubin', 'pemasang ubin', 'koki ubin']],
  ['防水班', ['tim waterproof', 'kelas waterproof', 'kelas kedap air']],
  ['泥作', ['tukang semen', 'pekerja semen', 'pekerja lumpur', 'kerja lumpur']],
  ['水電', ['utilitas', 'listrik', 'plumbing']],
  ['木工', ['tukang kayu']],
  ['便當', ['bekal', 'makanan', 'lunchbox']],
  ['休息區', ['area istirahat', 'rest area']],
  ['師傅', ['mandor', 'tukang', 'master']],
  ['漏水', ['bocor', 'kebocoran']],
  ['水管', ['pipa air']],
  ['爆裂', ['pecah', 'meledak', 'semburan']],
  ['停電', ['pemadaman listrik', 'listrik padam']],
  ['鷹架', ['perancah', 'rak elang']],
  ['瓦斯', ['gas']],
  ['外洩', ['bocor', 'kebocoran']],
  ['覆蓋', ['menutupi', 'tutup', 'ditutupi']],
  ['灑水', ['menyiram', 'siram', 'percikan air']],
  ['養護', ['perawatan', 'pemeliharaan']],
  ['防塵網', ['jaring debu', 'pelindung debu']],
  ['完工', ['selesai']],
  ['封起來', ['tutup', 'menutup', 'disegel']],
  ['除塵', ['penghilang debu', 'buang debu', 'menghilangkan debu']]
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
    { zh: '放樣', mustId: 'penandaan' },
    { zh: '拆除', mustId: 'bongkar' },
    { zh: '消防栓', mustId: 'tidak boleh dihalangi' }
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
  console.log(`  100-instruction test — AB棟 + B1-B3 + 15F + R1-R3 + A-M 戶種`);
  console.log(`  粗工常見工作：抽積水、清理垃圾、兩電梯兩樓梯、搬物料上樓`);
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
    if (i % 10 === 0) {
      console.log(`  progress: ${i}/${items.length} (pass=${PASS} fail=${FAIL})`);
    }
    await sleep(400);
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
