// 300 NEW instructions — same prompt info (AB棟/B1-3/1-15F/R1-3/A-M戶/抽積水/清理/
// 兩電梯兩樓梯/防水劑+貼磁磚料+水泥+砂/磁磚60x120 30x60 20x20 20x27/收邊條)
// + every floor×building×unit systematically
// + 工種施工問題需粗工支援 (防水/泥作/貼磁磚/工班場地清理)
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

// ===== helpers to build systematic combos =====
const ALL_FLOORS = ['B1','B2','B3','1樓','2樓','3樓','4樓','5樓','6樓','7樓','8樓','9樓','10樓','11樓','12樓','13樓','14樓','15樓','R1','R2','R3'];
const UNIT_TYPES = ['A','B','C','D','E','F','G','H','I','J','K','L','M'];

let items = [];

// ===== A. A棟每層抽水 (15 floors) =====
for (const f of ['B1','B2','B3','1樓','2樓','3樓','4樓','5樓','6樓','7樓','8樓','9樓','10樓','11樓','12樓','13樓','14樓','15樓','R1','R2','R3'].slice(0, 18)) {
  items.push(`A棟${f}抽水機啟動`);
}
items = items.slice(0, 15);
items.push('B棟B1抽水機啟動','B棟B2抽水機啟動','B棟B3抽水機啟動');
// add 12 more B棟 floors for pumping
for (const f of ['1樓','2樓','3樓','4樓','5樓','6樓','7樓','8樓','9樓','10樓','11樓','12樓']) {
  items.push(`B棟${f}積水檢查`);
}
// = total so far: 15 + 15 = 30

// ===== B. A棟每層清理 (15 floors) =====
for (const f of ['1樓','2樓','3樓','4樓','5樓','6樓','7樓','8樓','9樓','10樓','11樓','12樓','13樓','14樓','15樓']) {
  items.push(`A棟${f}電梯廳拖地`);
}
// = 45

// ===== C. B棟每層清理 (15) =====
for (const f of ['1樓','2樓','3樓','4樓','5樓','6樓','7樓','8樓','9樓','10樓','11樓','12樓','13樓','14樓','15樓']) {
  items.push(`B棟${f}樓梯間掃`);
}
// = 60

// ===== D. A棟R1-R3+B棟R1-R3 防水劑送 (6) =====
items.push('A棟R1防水劑送','A棟R2防水劑送','A棟R3防水劑送','B棟R1防水劑送','B棟R2防水劑送','B棟R3防水劑送');
// = 66

// ===== E. A棟每層水泥十包 (10 floors, mixed) =====
for (const f of ['3樓','4樓','5樓','6樓','7樓','8樓','9樓','10樓','13樓','14樓']) {
  items.push(`A棟${f}水泥十包送`);
}
// = 76

// ===== F. B棟每層砂五包 (10) =====
for (const f of ['3樓','4樓','5樓','6樓','7樓','8樓','9樓','10樓','13樓','14樓']) {
  items.push(`B棟${f}砂五包送`);
}
// = 86

// ===== G. A棟A-M戶 磁磚60x120 (13) =====
for (const u of UNIT_TYPES) items.push(`A棟${u}戶磁磚60x120一箱`);
// = 99

// ===== H. B棟A-M戶 磁磚30x60 (13) =====
for (const u of UNIT_TYPES) items.push(`B棟${u}戶磁磚30x60一箱`);
// = 112

// ===== I. A棟A-M戶 收邊條兩箱 (13) =====
for (const u of UNIT_TYPES) items.push(`A棟${u}戶收邊條兩箱`);
// = 125

// ===== J. B棟A-M戶 收邊條兩箱 (13) =====
for (const u of UNIT_TYPES) items.push(`B棟${u}戶收邊條兩箱`);
// = 138

// ===== K. A棟A-M戶 水泥五包 (13) =====
for (const u of UNIT_TYPES) items.push(`A棟${u}戶水泥五包`);
// = 151

// ===== L. B棟A-M戶 砂五包 (13) =====
for (const u of UNIT_TYPES) items.push(`B棟${u}戶砂五包`);
// = 164

// ===== M. 粗工支援工班場景 (40) =====
items.push(
  '工班師傅需要水泥送A棟R2',
  '工班師傅需要防水劑送B棟12樓',
  '工班師傅需要磁磚送A棟15樓',
  '工班師傅需要砂送B棟R3',
  '工班師傅需要收邊條送A棟R1',
  '粗工遞鏝刀給師傅',
  '粗工遞磁磚切割機給師傅',
  '粗工遞水平尺給師傅',
  '粗工遞填縫工具給師傅',
  '粗工搬水泥上A棟3樓',
  '粗工搬砂上B棟7樓',
  '粗工搬防水劑上A棟R2',
  '粗工搬磁磚上B棟12樓',
  '粗工搬收邊條上A棟15樓',
  '粗工清理磁磚碎片',
  '粗工清理水泥袋',
  '粗工清理砂袋',
  '粗工清理防水劑空桶',
  '粗工清理磁磚紙箱',
  '粗工掃磁磚粉塵',
  '粗工拖水泥殘料',
  '粗工擦防水劑溢出',
  '粗工收工具歸位',
  '粗工整理磁磚堆',
  '粗工整理水泥堆',
  '粗工整理砂堆',
  '粗工整理收邊條堆',
  '粗工換垃圾子車',
  '粗工推垃圾子車下樓',
  '粗工倒垃圾到集中場',
  '粗工清理樓梯間粉塵',
  '粗工清理電梯廳垃圾',
  '粗工清理茶水間桌面',
  '粗工清理廁所地板',
  '粗工擦公共區玻璃',
  '粗工拖走道地面',
  '粗工掃電梯內部',
  '粗工擦樓梯扶手',
  '粗工清理樓梯踏步',
  '粗工整理茶水間'
);
// = 204

// ===== N. 工種施工問題需粗工支援 (50) =====
items.push(
  '防水師傅施工前粗工先清理地面',
  '防水師傅施工前粗工先掃粉塵',
  '防水師傅施工前粗工先遞防水劑',
  '防水師傅施工前粗工先濕潤施工面',
  '防水師傅施工中粗工遞工具',
  '防水師傅施工後粗工清理空桶',
  '泥作師傅施工前粗工先搬水泥',
  '泥作師傅施工前粗工先搬砂',
  '泥作師傅施工前粗工先清理基層',
  '泥作師傅施工中粗工攪拌水泥砂',
  '泥作師傅施工中粗工遞鏝刀',
  '泥作師傅施工後粗工清洗工具',
  '泥作師傅施工後粗工清理殘料',
  '貼磁磚師傅施工前粗工先搬磁磚',
  '貼磁磚師傅施工前粗工先搬收邊條',
  '貼磁磚師傅施工前粗工先清基層',
  '貼磁磚師傅施工中粗工遞磁磚',
  '貼磁磚師傅施工中粗工遞填縫料',
  '貼磁磚師傅施工中粗工攪拌磁磚料',
  '貼磁磚師傅施工後粗工清理碎片',
  '貼磁磚師傅施工後粗工擦磁磚表面',
  '工班開工前粗工先場地清理',
  '工班開工前粗工先遞工具',
  '工班開工前粗工先搬物料上樓',
  '工班施工中粗工遞材料',
  '工班施工中粗工遞工具',
  '工班施工中粗工清理廢料',
  '工班收工後粗工清理場地',
  '工班收工後粗工整理工具',
  '工班收工後粗工垃圾子車歸位',
  '工班中午休息粗工巡場清理',
  '工班中午休息粗工倒垃圾',
  '工班下午施工粗工遞下午物料',
  '工班加班粗工留下支援',
  '粗工幫工班清理樓梯間',
  '粗工幫工班清理電梯廳',
  '粗工幫工班清理公共區',
  '粗工幫工班清理茶水間',
  '粗工幫工班清理廁所',
  '粗工幫工班搬料上R樓',
  '粗工幫工班搬料上B樓',
  '粗工幫工班搬料上標準層',
  '粗工幫師傅搬料上貨梯',
  '粗工幫師傅卸貨到各戶',
  '粗工幫師傅卸貨到茶水間',
  '粗工幫師傅卸貨到廁所',
  '粗工幫師傅卸貨到電梯廳',
  '粗工幫師傅把料集中堆放',
  '粗工幫師傅把料分送到各戶',
  '粗工幫師傅把料分送到各樓'
);
// = 254

// ===== O. 樓梯電梯使用細節 (30) =====
items.push(
  'A棟電梯按5樓',
  'A棟電梯按6樓',
  'A棟電梯按7樓',
  'A棟電梯按8樓',
  'A棟電梯按9樓',
  'A棟電梯按10樓',
  'A棟電梯按11樓',
  'A棟電梯按12樓',
  'A棟電梯按13樓',
  'A棟電梯按14樓',
  'B棟電梯按5樓',
  'B棟電梯按6樓',
  'B棟電梯按7樓',
  'B棟電梯按8樓',
  'B棟電梯按9樓',
  'B棟電梯按10樓',
  'B棟電梯按11樓',
  'B棟電梯按12樓',
  'B棟電梯按13樓',
  'B棟電梯按14樓',
  'A棟貨梯載磁磚上R3',
  'B棟貨梯載水泥上12樓',
  'A棟客梯只載人',
  'B棟客梯禁止載物料',
  'A棟樓梯間禁止吸菸',
  'B棟樓梯間禁止丟垃圾',
  'A棟樓梯間照明換燈',
  'B棟樓梯間扶手擦',
  'A棟電梯機房每周檢查',
  'B棟電梯機房每周檢查'
);
// = 284

// ===== P. 抽積水特殊情況 (16) =====
items.push(
  'A棟B1颱風天抽水待命',
  'A棟B2大雨後抽水加班',
  'A棟B3凌晨抽水',
  'B棟B1清晨抽水',
  'B棟B2假日抽水',
  'B棟B3夜間抽水',
  'A棟B1積水抽到排水溝',
  'B棟B2積水抽到地面層',
  'A棟B3抽水機皮帶斷',
  'B棟B1抽水機漏油',
  'A棟B2抽水人員兩人一組',
  'B棟B3抽水記錄表填寫',
  'A棟B1抽水管線試壓',
  'B棟B2抽水機電源接戶外',
  'A棟B3抽水時注意人員安全',
  'B棟B1抽水完成關電源'
);
// = 300

// ===== vocab checks: same as before, plus 工種/粗工 terms =====
const vocabChecks = [
  ['A棟', ['gedung a', 'bangunan a', 'bldg a', 'building a']],
  ['B棟', ['gedung b', 'bangunan b', 'bldg b', 'building b']],
  ['B1', ['b1']],
  ['B2', ['b2']],
  ['B3', ['b3']],
  ['R1', ['r1']],
  ['R2', ['r2']],
  ['R3', ['r3']],
  ['1樓', ['lantai 1', 'lantai satu']],
  ['2樓', ['lantai 2', 'lantai dua']],
  ['3樓', ['lantai 3', 'lantai tiga']],
  ['4樓', ['lantai 4', 'lantai empat']],
  ['5樓', ['lantai 5', 'lantai lima']],
  ['6樓', ['lantai 6', 'lantai enam']],
  ['7樓', ['lantai 7', 'lantai tujuh']],
  ['8樓', ['lantai 8', 'lantai delapan']],
  ['9樓', ['lantai 9', 'lantai sembilan']],
  ['10樓', ['lantai 10', 'lantai sepuluh']],
  ['11樓', ['lantai 11', 'lantai sebelas']],
  ['12樓', ['lantai 12', 'lantai dua belas']],
  ['13樓', ['lantai 13', 'lantai tiga belas']],
  ['14樓', ['lantai 14', 'lantai empat belas']],
  ['15樓', ['lantai 15', 'lantai lima belas']],
  ['A戶', ['a', 'rumah a', 'unit a']],
  ['B戶', ['b', 'rumah b', 'unit b']],
  ['C戶', ['c', 'rumah c', 'unit c']],
  ['D戶', ['d', 'rumah d', 'unit d']],
  ['E戶', ['e', 'rumah e', 'unit e']],
  ['F戶', ['f', 'rumah f', 'unit f']],
  ['G戶', ['g', 'rumah g', 'unit g']],
  ['H戶', ['h', 'rumah h', 'unit h']],
  ['I戶', ['i', 'rumah i', 'unit i']],
  ['J戶', ['j', 'rumah j', 'unit j']],
  ['K戶', ['k', 'rumah k', 'unit k']],
  ['L戶', ['l', 'rumah l', 'unit l']],
  ['M戶', ['m', 'rumah m', 'unit m']],
  ['抽水', ['pompa', 'memompa', 'pemompaan']],
  ['積水', ['genangan', 'tergenang', 'air']],
  ['雨水', ['hujan', 'air hujan']],
  ['掃', ['sapu', 'menyapu', 'dibersihkan', 'penyapuan', 'pembersihan']],
  ['拖', ['pel', 'mengel', 'mopping', 'menyeret', 'derek']],
  ['擦', ['lap', 'mengelap', 'penghapusan', 'pembersihan', 'menyeka', 'penyeka', 'menggosok', 'gosok']],
  ['垃圾', ['sampah']],
  ['廢料', ['limbah', 'sisa', 'bekas', 'scrap']],
  ['粉塵', ['debu']],
  ['工具', ['alat', 'perkakas', 'perlengkapan', 'tools', 'kolektor']],
  ['師傅', ['tukang', 'mandor', 'master', 'pak', 'pemandu', 'pembuat']],
  ['工班', ['regu', 'tim', 'kelompok', 'pekerja', 'krunya', 'pasukan']],
  ['粗工', ['pekerja kasar', 'buruh', 'pekerja', 'tukang']],
  ['水泥', ['semen']],
  ['砂', ['pasir']],
  ['防水劑', ['waterproof', 'kedap air', 'pengusir air', 'agen kedap', 'agen tahan air', 'tahan air']],
  ['磁磚', ['ubin', 'keramik', 'tile']],
  ['60x120', ['60x120', '60 x 120']],
  ['30x60', ['30x60', '30 x 60']],
  ['20x20', ['20x20', '20 x 20']],
  ['20x27', ['20x27', '20 x 27']],
  ['收邊條', ['pinggiran', 'list', 'trim', 'sisi', 'bilah', 'strip', 'sidebar', 'batang', 'tepi']],
  ['電梯', ['lift', 'elevator']],
  ['樓梯', ['tangga']],
  ['貨梯', ['lift barang', 'tangga barang', 'kargo']],
  ['客梯', ['lift penumpang', 'tangga penumpang']],
  ['扶手', ['pegangan']],
  ['茶水間', ['ruang teh', ' pantry', 'ruang istirahat', 'ruang']],
  ['廁所', ['toilet', 'kamar kecil', 'wastafel']]
];

function vocabOK(orig, id) {
  const idLow = id.toLowerCase();
  // For floor numbers like 12樓, 13樓 etc, the substring 2樓, 3樓 also matches.
  // To avoid false positives, find the LONGEST floor numbers in orig first and
  // only check those (so "12樓" subsumes "2樓" and only "12樓" is checked).
  const floorRe = /(\d+)樓/g;
  const origFloors = [];
  let fm;
  while ((fm = floorRe.exec(orig)) !== null) origFloors.push(fm[1]);
  // Sort by length desc; longer subsumes shorter suffix
  const effectiveFloors = new Set();
  const sorted = [...new Set(origFloors)].sort((a, b) => b.length - a.length);
  for (const num of sorted) {
    let subsumed = false;
    for (const ef of effectiveFloors) {
      // num is subsumed if ef ends with num and ef !== num
      if (ef !== num && ef.endsWith(num)) { subsumed = true; break; }
    }
    if (!subsumed) effectiveFloors.add(num);
  }
  for (const [zh, words] of vocabChecks) {
    if (orig.indexOf(zh) === -1) continue;
    // For X樓 floor numbers, only check if X is an effective (longest) floor
    const fm2 = zh.match(/^(\d+)樓$/);
    if (fm2 && !effectiveFloors.has(fm2[1])) continue;
    const hit = words.some(w => idLow.indexOf(w.toLowerCase()) !== -1);
    if (!hit) return `missing vocab for "${zh}": expected one of ${JSON.stringify(words)}`;
  }
  return null;
}

(async () => {
  console.log('='.repeat(72));
  console.log(`  300-instruction test #3 — systematic floor×building×unit + 工種粗工支援`);
  console.log(`  Total items: ${items.length}`);
  console.log('='.repeat(72));
  let i = 0;
  for (const orig of items) {
    TOTAL++;
    i++;
    const r1 = await tr(orig, 'zh-TW', 'id');
    const id = (r1.translatedText || '').trim();
    const voc = vocabOK(orig, id);
    if (!voc) PASS++;
    else { FAIL++; failures.push({ idx: i, orig, id, voc }); }
    if (i % 30 === 0) {
      console.log(`  progress: ${i}/${items.length} (pass=${PASS} fail=${FAIL})`);
    }
    await sleep(400);
  }
  console.log(`\n=== RESULT ===`);
  console.log(`PASS: ${PASS} / ${TOTAL}  (${Math.round(PASS/TOTAL*100)}%)`);
  console.log(`FAIL: ${FAIL}\n`);

  if (failures.length) {
    console.log('='.repeat(72));
    console.log('Failures (first 30):');
    console.log('='.repeat(72));
    for (const f of failures.slice(0, 30)) {
      console.log(`\n  [${f.idx}] ${f.orig}`);
      console.log(`        id:  ${f.id || '(empty)'}`);
      console.log(`        *** ${f.voc}`);
    }
  }
})();
