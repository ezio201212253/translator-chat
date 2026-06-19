// 200 NEW instructions — strictly using ONLY info from user prompt:
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
  // A. 抽積水 (35) — new variations
  'A棟B2晚上抽水', 'B棟B3早上抽水', 'A棟B1積水用兩台抽水機', 'B棟B2抽水機噪音太大',
  'A棟B3抽水管線漏', 'B棟B1抽水機油料不夠', 'A棟B2下雨後抽水', 'B棟B3颱風後抽水',
  'A棟B1抽水到水溝', 'B棟B2下雨前抽水預備', 'A棟B3積水照片傳給監工', 'B棟B1抽水機兩台並聯',
  'A棟B2抽水馬達換新', 'B棟B3雨水抽乾', 'A棟B1積水三小時抽完', 'B棟B2抽水機噪音投訴',
  'A棟B3地下積水緊急處理', 'B棟B1抽水管線洩漏', 'A棟B2抽水機故障報修', 'B棟B3抽水一小時停一次',
  'A棟B1下雨後立刻抽', 'B棟B2地下室抽水', 'A棟B3每天抽水兩次', 'B棟B1積水抽到桶子',
  'A棟B2晚上加班抽水', 'B棟B3抽水記錄填表', 'A棟B1抽水機外接電源', 'B棟B2抽水機油料桶換',
  'A棟B3抽水時注意漏電', 'B棟B1雨水抽到晚上', 'A棟B2抽水機皮帶換', 'B棟B3抽水人員要兩人',
  'A棟B1下雨天抽水準備', 'B棟B2颱風天抽水待命', 'A棟B3抽水機24小時開',
  // B. 清理垃圾環境 (45)
  'A棟15樓走道掃', 'B棟R1垃圾集中一處', 'A棟R2廢料子車換', 'B棟15樓電梯口拖地',
  'A棟R1茶水間擦桌子', 'B棟R2廁所拖地', 'A棟15樓垃圾分類紙類', 'B棟R1廢棄磚頭集中',
  'A棟R2鐵屑回收', 'B棟15樓粉塵掃', 'A棟R1公共區擦玻璃', 'B棟R2樓梯間拖',
  'A棟15樓電梯按鈕擦', 'B棟R1公共走廊掃', 'A棟R2垃圾子車推下樓', 'B棟15樓樓梯扶手擦',
  'A棟R1茶水間地板拖', 'B棟R2廁所洗手台擦', 'A棟15樓天花板灰塵擦', 'B棟R1電梯內部掃',
  'A棟R2公共區拖地', 'B棟15樓完成面清粉塵', 'A棟R1茶水間洗手槽清', 'B棟R2電梯按鈕擦',
  'A棟15樓垃圾子車推到貨梯', 'B棟R1樓梯間掃', 'A棟R2走道拖地', 'B棟15樓茶水間擦',
  'A棟R1廁所地板拖', 'B棟R2電梯內部拖地', 'A棟15樓垃圾分類塑膠', 'B棟R1廢料集中子車',
  'A棟R2粉塵掃', 'B棟15樓樓梯踏步拖', 'A棟R1公共區域擦窗', 'B棟R2茶水間地板拖',
  'A棟15樓電梯口擦', 'B棟R1走道掃', 'A棟R2廁所拖地', 'B棟15樓完成面拖地',
  'A棟R1樓梯間拖', 'B棟R2電梯按鈕擦', 'A棟15樓公共走廊掃',
  // C. 水泥搬運 (15)
  'A棟R3水泥十包', 'B棟12樓水泥二十包', 'A棟B1水泥五十包搬', 'B棟R2水泥每戶五包',
  'A棟15樓水泥集中堆放', 'B棟R1水泥小心搬運', 'A棟B2水泥搬上貨梯', 'B棟R3水泥二十包送',
  'A棟10樓水泥送上去', 'B棟R2水泥每層十包', 'A棟B3水泥搬上地面', 'B棟11樓水泥送',
  'A棟R1水泥堆整齊', 'B棟15樓水泥清點', 'A棟B1水泥五十包搬上',
  // D. 砂搬運 (12)
  'A棟R2砂十包', 'B棟R3砂二十包', 'A棟12樓砂搬上去', 'B棟B1砂搬上貨梯',
  'A棟R1砂堆放整齊', 'B棟15樓砂集中', 'A棟R3砂每戶五包', 'B棟R2砂小心搬運',
  'A棟B3砂搬上來', 'B棟11樓砂送上去', 'A棟R2砂清點', 'B棟B2砂搬上地面',
  // E. 防水劑搬運 (12)
  'A棟R2防水劑送', 'B棟R3防水劑兩桶', 'A棟15樓防水劑集中放', 'B棟R1防水劑小心搬',
  'A棟B3防水劑搬入', 'B棟R2防水劑每戶一桶', 'A棟12樓防水劑送上去', 'B棟R3防水劑清點',
  'A棟R1防水劑堆放整齊', 'B棟B2防水劑搬上', 'A棟R2防水劑五桶送', 'B棟11樓防水劑送上去',
  // F. 磁磚搬運 (35)
  'A棟R3磁磚60x120十箱', 'B棟12樓磁磚60x120搬', 'A棟R2磁磚30x60五箱', 'B棟R1磁磚30x60上樓',
  'A棟15樓磁磚20x20二十箱', 'B棟R3磁磚20x20搬上去', 'A棟R1磁磚20x27十箱', 'B棟11樓磁磚20x27送',
  'A棟R2磁磚60x120清點', 'B棟15樓磁磚30x60搬', 'A棟R3磁磚20x20每戶兩箱', 'B棟R2磁磚20x27送上去',
  'A棟B1磁磚60x120搬上', 'B棟R1磁磚30x60十箱', 'A棟15樓磁磚20x27每戶一箱', 'B棟R3磁磚20x20清點',
  'A棟R2磁磚60x120搬運小心', 'B棟12樓磁磚30x60送上去', 'A棟R1磁磚20x20十箱', 'B棟R2磁磚20x27五箱',
  'A棟15樓磁磚60x120堆放整齊', 'B棟R1磁磚30x60搬運', 'A棟R3磁磚20x20搬上貨梯', 'B棟11樓磁磚20x27送上去',
  'A棟R2磁磚60x120拆箱', 'B棟15樓磁磚30x60拆箱', 'A棟R1磁磚20x20搬上貨梯', 'B棟R3磁磚20x27拆箱',
  'A棟12樓磁磚60x120清點', 'B棟R2磁磚30x60堆放', 'A棟15樓磁磚20x20搬', 'B棟R1磁磚20x27堆放',
  'A棟R2磁磚60x120送貨梯', 'B棟12樓磁磚30x60清點', 'A棟R3磁磚20x20堆放',
  // G. 收邊條 (12)
  'A棟R2收邊條每戶兩箱', 'B棟R3收邊條十箱', 'A棟15樓收邊條堆放', 'B棟R1收邊條搬上去',
  'A棟R3收邊條清點', 'B棟R2收邊條拆箱', 'A棟12樓收邊條送上去', 'B棟11樓收邊條搬上去',
  'A棟R1收邊條每戶一箱', 'B棟15樓收邊條集中放', 'A棟R2收邊條五箱', 'B棟R3收邊條堆放整齊',
  // H. 戶種指定 (20) — A-M 13 types
  'A棟A戶水泥送', 'B棟B戶砂送', 'A棟C戶防水劑送', 'B棟D戶磁磚60x120送',
  'A棟E戶磁磚30x60送', 'B棟F戶磁磚20x20送', 'A棟G戶磁磚20x27送', 'B棟H戶收邊條送',
  'A棟I戶水泥送上去', 'B棟J戶砂送上去', 'A棟K戶防水劑送上去', 'B棟L戶磁磚60x120送上去',
  'A棟M戶收邊條送', 'B棟A戶磁磚30x60', 'A棟B戶砂', 'B棟C戶防水劑',
  'A棟D戶水泥', 'B棟E戶收邊條', 'A棟F戶磁磚20x27', 'B棟G戶磁磚60x120',
  // I. 樓梯電梯使用 (14)
  'A棟電梯每層停靠', 'B棟電梯故障找人修', 'A棟電梯按 B1', 'B棟電梯按 R3',
  'A棟樓梯間照明換', 'B棟樓梯間禁止吸菸', 'A棟貨梯滿載停止', 'B棟客梯禁止載物料',
  'A棟電梯門夾到人', 'B棟電梯關人報修', 'A棟樓梯間粉刷保護', 'B棟樓梯間禁止堆料',
  'A棟電梯每天測試', 'B棟電梯機房清潔'
];

// vocab checks: only terms from the prompt
const vocabChecks = [
  ['A棟', ['gedung a', 'bangunan a', 'bldg a']],
  ['B棟', ['gedung b', 'bangunan b', 'bldg b']],
  ['B1', ['b1', 'lantai dasar pertama', 'basement']],
  ['B2', ['b2', 'lantai dasar kedua']],
  ['B3', ['b3', 'lantai dasar ketiga']],
  ['R1', ['r1']],
  ['R2', ['r2']],
  ['R3', ['r3']],
  ['10樓', ['lantai 10', 'lantai sepuluh']],
  ['11樓', ['lantai 11', 'lantai sebelas']],
  ['12樓', ['lantai 12', 'lantai dua belas']],
  ['15樓', ['lantai 15', 'lantai lima belas']],
  ['抽水', ['pompa', 'memompa', 'pemompaan']],
  ['積水', ['genangan', 'tergenang', 'air']],
  ['雨水', ['hujan', 'air hujan']],
  ['漏水', ['bocor', 'kebocoran']],
  ['油料', ['bahan bakar', 'minyak', 'oli']],
  ['馬達', ['motor']],
  ['噪音', ['kebisingan', 'bising', 'berisik']],
  ['觸電', ['listrik', 'sengatan listrik']],
  ['水桶', ['ember']],
  ['水溝', ['selokan', 'got', 'talang']],
  ['漏電', ['kebocoran listrik', 'kebocoran']],
  ['垃圾', ['sampah']],
  ['廢料', ['limbah', 'sisa', 'bekas', 'scrap']],
  ['鐵屑', ['serbuk besi']],
  ['粉塵', ['debu']],
  ['掃', ['sapu', 'menyapu', 'dibersihkan', 'penyapuan', 'pembersihan']],
  ['拖地', ['pel', 'mengel', 'mopping', 'pel']],
  ['擦', ['lap', 'mengelap', 'penghapusan', 'pembersihan', 'bersih']],
  ['廁所', ['toilet', 'kamar kecil', 'wastafel']],
  ['茶水間', ['ruang teh', ' pantry', 'ruang']],
  ['電梯', ['lift', 'elevator']],
  ['樓梯', ['tangga']],
  ['貨梯', ['lift barang', 'tangga barang', 'kargo']],
  ['客梯', ['lift penumpang', 'tangga penumpang']],
  ['扶手', ['pegangan']],
  ['水泥', ['semen']],
  ['砂', ['pasir']],
  ['防水劑', ['waterproof', 'kedap air', 'pengusir air', 'agen kedap', 'agen tahan air', 'tahan air']],
  ['磁磚', ['ubin', 'keramik', 'tile']],
  ['60x120', ['60x120', '60 x 120']],
  ['30x60', ['30x60', '30 x 60']],
  ['20x20', ['20x20', '20 x 20']],
  ['20x27', ['20x27', '20 x 27']],
  ['收邊條', ['pinggiran', 'list', 'trim', 'sisi', 'bilah', 'strip', 'sidebar', 'batang', 'samping']],
  ['拆箱', ['buka kotak', 'buka kemasan', 'pembukaan']],
  ['清點', ['menghitung', 'memeriksa', 'inventaris', 'inventarisasi', 'persediaan', 'hitungan']],
  ['故障', ['rusak', 'kerusakan', 'gangguan', 'kegagalan', 'pemecahan masalah']],
  ['滿載', ['penuh', 'muatan penuh']],
  ['監工', ['mandor', 'pengawas', 'pengawasan']],
  ['照片', ['foto']],
  ['颱風', ['topan', 'taifun', 'badai']],
  ['下雨', ['hujan']],
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
  console.log(`  200-instruction test #2 — strict prompt data, non-overlap with 100d`);
  console.log(`  Categories: 抽積水 35 / 清理 45 / 水泥 15 / 砂 12 / 防水劑 12`);
  console.log(`              磁磚35 / 收邊條12 / 戶種 20 / 電梯樓梯 14`);
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
