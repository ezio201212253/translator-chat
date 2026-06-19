// 100 NEW instructions - strictly using ONLY info from user prompt:
// AB兩棟 / 地下3樓+15F標準層+R1R2R3 / A-M戶種 / 抽積水 / 清理垃圾 / 兩電梯兩樓梯
// / 防水劑+貼磁磚料+水泥+砂 / 磁磚60x120 30x60 20x20 20x27 收邊條
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
  // A. 抽積水 (15)
  'A棟B3抽積水',
  'B棟B2抽水',
  'A棟B1積水抽乾',
  'B棟B3抽水機啟動',
  'A棟B2抽水機油料補',
  'B棟B1積水照片回報',
  'A棟B3抽水注意觸電',
  'B棟B2積水抽到水桶搬走',
  'A棟B1抽水機故障換備用',
  'B棟B3積水嚴重要加班抽',
  'A棟地下積水抽到一樓',
  'B棟B1抽水機管線接戶外',
  'A棟B2抽水每天記錄水位',
  'B棟B3抽水機搬走',
  'A棟B1積水傳照片給監工',
  // B. 清理垃圾環境 (20)
  'A棟15樓垃圾集中',
  'B棟R1垃圾清掉',
  'A棟電梯旁垃圾掃',
  'B棟樓梯間清乾淨',
  'A棟R2廢料集中',
  'B棟15樓垃圾搬下樓',
  'A棟電梯廳拖地',
  'B棟樓梯踏步掃',
  'A棟R1公共區域擦',
  'B棟茶水間清',
  'A棟廁所清掃',
  'B棟R2垃圾子車換',
  'A棟R3完成面清',
  'B棟樓梯扶手擦',
  'A棟走道不堆料',
  'B棟R1公共走廊拖地',
  'A棟B棟垃圾分類',
  'B棟茶水間保持乾淨',
  'A棟R2廁所定期消毒',
  'B棟15樓電梯口掃',
  // C. 水泥搬運 (8)
  '水泥送上A棟15樓',
  'A棟水泥五十包上樓',
  'B棟水泥每層放十包',
  'A棟15樓水泥集中',
  'B棟水泥送每層各五包',
  'A棟B1水泥搬上貨梯',
  'B棟R3水泥送上去',
  'A棟R2水泥搬運小心',
  // D. 砂搬運 (7)
  '砂搬上B棟R1',
  'A棟砂每層放五包',
  'B棟砂送R1',
  'A棟R2砂分堆',
  'A棟15樓砂集中堆',
  'B棟R3砂搬上去',
  'A棟砂送貨梯上樓',
  // E. 防水劑搬運 (7)
  '防水劑送A棟R3',
  '防水劑送B棟R1',
  'A棟防水劑送15樓',
  'B棟防水劑送R2',
  'A棟B3防水劑搬入',
  'B棟防水劑送貨梯上樓',
  'A棟防水劑集中放R1',
  // F. 磁磚搬運 (20) — 60x120, 30x60, 20x20, 20x27
  'B棟R1磁磚60x120搬',
  'A棟R2磁磚30x60上樓',
  'B棟R3磁磚20x20小磁磚搬',
  'A棟磁磚20x27送12樓',
  'B棟磁磚60x120送15樓',
  'A棟R1磁磚30x60搬',
  'B棟R2磁磚20x20上',
  'A棟磁磚20x27送R3',
  'B棟磁磚每戶放一箱',
  'A棟磁磚60x120送15樓',
  'B棟磁磚30x60送R1',
  'A棟磁磚20x20送R2',
  'B棟磁磚20x27送R3',
  'A棟磁磚整貨上樓小心',
  'B棟磁磚60x120搬上貨梯',
  'A棟磁磚30x60清點',
  'B棟磁磚20x20拆箱',
  'A棟磁磚20x27送貨梯',
  '磁磚60x120送A棟15樓',
  '磁磚30x60送B棟R1',
  // G. 收邊條 (7)
  'A棟15樓收邊條送貨',
  'B棟R1收邊條放一箱',
  'A棟R2收邊條搬上去',
  'B棟R3收邊條清點',
  'A棟收邊條每層放兩箱',
  'B棟收邊條拆箱',
  'A棟15樓收邊條集中',
  // H. 樓梯電梯使用 (9)
  'A棟貨梯只能載物料',
  'B棟客梯禁止推車進',
  'A棟樓梯間材料靠牆放',
  'B棟R1貨梯等十分鐘',
  'A棟15樓電梯滿載等下一班',
  'B棟樓梯間禁止丟垃圾',
  'A棟電梯按樓順序上',
  'B棟R2電梯故障等修',
  'A棟電梯每天早開晚關',
  // I. 戶種指定 (7) — A-M 戶種
  'A棟A戶磁磚送',
  'B棟M戶砂搬',
  'A棟G戶防水劑送',
  'B棟D戶水泥送',
  'A棟E戶磁磚20x20送',
  'B棟H戶收邊條送',
  'A棟C戶磁磚60x120送'
];

// vocab checks: only terms from the prompt
const vocabChecks = [
  ['A棟', ['gedung a', 'bangunan a', 'bldg a']],
  ['B棟', ['gedung b', 'bangunan b', 'bldg b']],
  ['B1', ['b1', 'lantai dasar pertama']],
  ['B2', ['b2', 'lantai dasar kedua']],
  ['B3', ['b3', 'lantai dasar ketiga']],
  ['R1', ['r1']],
  ['R2', ['r2']],
  ['R3', ['r3']],
  ['15樓', ['lantai 15', 'lantai lima belas']],
  ['抽水', ['pompa', 'memompa', 'pemompaan']],
  ['積水', ['genangan', 'tergenang', 'air']],
  ['油料', ['bahan bakar', 'minyak']],
  ['觸電', ['listrik', 'sengatan listrik']],
  ['水桶', ['ember']],
  ['垃圾', ['sampah']],
  ['廢料', ['limbah', 'sisa', 'bekas']],
  ['掃', ['sapu', 'menyapu', 'dibersihkan', 'penyapuan', 'pembersihan']],
  ['拖地', ['pel', 'mengel']],
  ['擦', ['lap', 'mengelap', 'penghapusan']],
  ['廁所', ['toilet', 'kamar kecil']],
  ['茶水間', ['ruang teh', ' pantry', 'ruang']],
  ['電梯', ['lift', 'elevator']],
  ['樓梯', ['tangga']],
  ['貨梯', ['lift barang', 'tangga barang', 'kargo']],
  ['客梯', ['lift penumpang', 'tangga penumpang']],
  ['扶手', ['pegangan']],
  ['水泥', ['semen']],
  ['砂', ['pasir']],
  ['防水劑', ['waterproof', 'kedap air', 'pengusir air', 'agen kedap']],
  ['磁磚', ['ubin', 'keramik', 'tile']],
  ['60x120', ['60x120', '60 x 120']],
  ['30x60', ['30x60', '30 x 60']],
  ['20x20', ['20x20', '20 x 20']],
  ['20x27', ['20x27', '20 x 27']],
  ['收邊條', ['pinggiran', 'list', 'trim', 'sisi', 'bilah', 'strip', 'sidebar']],
  ['拆箱', ['buka kotak', 'buka kemasan', 'pembukaan']],
  ['清點', ['menghitung', 'memeriksa', 'inventaris', 'inventarisasi']],
  ['故障', ['rusak', 'kerusakan', 'gangguan', 'kegagalan']],
  ['滿載', ['penuh', 'muatan penuh']],
  ['監工', ['mandor', 'pengawas', 'pengawasan']],
  ['照片', ['foto']],
  ['水位', ['tinggi air', 'ketinggian air']],
  ['管線', ['pipa', 'saluran']]
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
  console.log(`  100-instruction test — strictly from prompt (AB棟 / B1-3 / 15F / R1-3 / A-M)`);
  console.log(`  Categories: 抽積水 15 / 清理 20 / 水泥 8 / 砂 7 / 防水劑 7`);
  console.log(`              磁磚20 / 收邊條 7 / 電梯樓梯 9 / 戶種 7`);
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
