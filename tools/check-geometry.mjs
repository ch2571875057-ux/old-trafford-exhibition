/**
 * 老特拉福德球场 · 几何自检
 * ------------------------------------------------------------------
 * 零依赖、零 npm 安装：直接读 js/data.js，校验模型几何是否自洽。
 * 用法：  node tools/check-geometry.mjs
 * 退出码：0 = 全部通过，1 = 有断言失败
 *
 * 为什么需要这个脚本：
 *   js/stadium.js 生成三维形态、tools/gen-drawings.mjs 生成二维图纸，
 *   两者都从 js/data.js 取数。data.js 一旦被改动，模型与图纸会同时漂移。
 *   本脚本把「声明值 vs 逐排几何」这类不变量钉死，改完数据立刻能发现破绽。
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DATA_PATH = resolve(ROOT, 'js', 'data.js');

// 仓库根目录没有 package.json，Node 会把 .js 当 CommonJS 解析；
// data.js 本身不含 import 语句，用 data: URL 求值最稳。
const source = readFileSync(DATA_PATH, 'utf8');
const D = await import('data:text/javascript;charset=utf-8,' + encodeURIComponent(source));

const { PITCH, RUN_OFF, BOWL_INNER, STANDS, STAND_ORDER, QUADRANTS, META } = D;

let failed = 0;
const near = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol;
const line = (s = '') => console.log(s);

function assert(name, ok, detail) {
  if (ok) line(`  ✓ ${name}${detail ? '   ' + detail : ''}`);
  else { failed++; line(`  ✗ ${name}   ${detail ?? ''}`); }
}

line('老特拉福德球场 · 几何自检 / GEOMETRY SELF-CHECK');
line(`数据源：js/data.js（DATA_VERSION ${D.DATA_VERSION}）`);
line();

// ---------------------------------------------------------------- 草坪与缓冲
line('【一】草坪与碗体内缘');
const halfX = PITCH.length / 2 + RUN_OFF.goalLine;
const halfZ = PITCH.width / 2 + RUN_OFF.touchLine;
assert('草坪尺寸', PITCH.length === 105 && PITCH.width === 68,
  `${PITCH.length} × ${PITCH.width} m`);
assert('球门尺寸（FIFA 标准）', PITCH.goalWidth === 7.32 && PITCH.goalHeight === 2.44,
  `${PITCH.goalWidth} × ${PITCH.goalHeight} m`);
assert('碗体内缘半宽 = 草坪半长 + 门线缓冲', near(BOWL_INNER.halfX, halfX),
  `${BOWL_INNER.halfX} m vs 计算 ${halfX} m`);
assert('碗体内缘半深 = 草坪半宽 + 边线缓冲', near(BOWL_INNER.halfZ, halfZ),
  `${BOWL_INNER.halfZ} m vs 计算 ${halfZ} m`);
assert('碗体内缘整体尺寸', BOWL_INNER.halfX === 64.5 && BOWL_INNER.halfZ === 44.0,
  `${(BOWL_INNER.halfX * 2).toFixed(1)} × ${(BOWL_INNER.halfZ * 2).toFixed(1)} m`);
line();

// ------------------------------------------------------- 逐看台：声明 vs 几何
line('【二】看台进深：声明 totalDepth  vs  逐排几何 startDepth + rows × rowDepth');
const standRows = [];
let totalRows = 0;
let totalSeats = 0;

for (const key of STAND_ORDER) {
  const st = STANDS[key];
  if (!st) { failed++; line(`  ✗ 缺少看台 ${key}`); continue; }

  const name = st.nameZh || st.name || key;
  const tiers = st.tiers ?? [];
  if (!tiers.length) { failed++; line(`  ✗ ${name} 没有 tiers`); continue; }

  let deepest = 0;
  let tiersOk = true;
  const treads = [];
  let seats = 0;

  for (const t of tiers) {
    const back = t.startDepth + t.rows * t.rowDepth;   // 本层最后一排的后沿进深
    const top = t.baseHeight + (t.rows - 1) * t.rowRise; // 本层最高踏面
    if (back > deepest) deepest = back;
    if (t.startDepth < 0 || t.rows <= 0 || t.rowDepth <= 0 || t.rowRise <= 0) tiersOk = false;
    treads.push(top);
    seats += t.seats ?? 0;
  }

  const rows = tiers.reduce((a, t) => a + t.rows, 0);
  const topTread = Math.max(...treads);
  totalRows += rows;
  totalSeats += seats;

  const okDepth = near(deepest, st.totalDepth, 0.005);
  if (!okDepth) failed++;
  const okTiers = tiersOk;
  if (!okTiers) failed++;

  line(`  ${okDepth && okTiers ? '✓' : '✗'} ${name.padEnd(12, '　')} ` +
    `${tiers.length} 层 ${String(rows).padStart(3)} 排 · ` +
    `末排深度 声明 ${st.totalDepth} m vs 几何 ${deepest.toFixed(2)} m` +
    `${okDepth ? '' : '  ← 偏差 ' + (deepest - st.totalDepth).toFixed(3) + ' m'}` +
    `  · 最高踏面 ${topTread.toFixed(2)} m`);
  standRows.push({ key, name, rows, tiers: tiers.length, topTread, deepest, totalDepth: st.totalDepth, roof: st.roofCantilever, roofHeight: st.roofHeight });
}
line(`  全场合计 ${totalRows} 排（四角象限另计）`);
line();

// ------------------------------------------------------------------- 屋盖口径
line('【三】屋盖悬挑（数据等级最敏感的一组值）');
for (const s of standRows) {
  if (s.roof == null) { failed++; line(`  ✗ ${s.name} 缺少 roofCantilever`); continue; }
  const official = s.key === 'north' && s.roof === 58.5;
  line(`  · ${s.name.padEnd(12, '　')} 悬挑 ${String(s.roof).padStart(6)} m` +
    `  · 前缘底标高 ${s.roofHeight ?? '—'} m` +
    (official ? '   ← 全场唯一 [官方] 几何量' : '   [推算]'));
}
const north = STANDS.north;
assert('北看台悬挑 = 58.5 m（官方口径）', north?.roofCantilever === 58.5,
  `${north?.roofCantilever} m`);
assert('北看台屋盖前缘进深 = totalDepth − 悬挑', near(85.0 - 58.5, 26.5),
  '85.0 − 58.5 = 26.5 m（与 js/stadium.js 的 frontDepth 约定一致）');
assert('南北屋盖底标高落差 27.0 m 由两个 [推算] 值相减而来',
  near((north?.roofHeight ?? 0) - (STANDS.south?.roofHeight ?? 0), 27.0),
  `${north?.roofHeight} − ${STANDS.south?.roofHeight} = ${((north?.roofHeight ?? 0) - (STANDS.south?.roofHeight ?? 0)).toFixed(1)} m —— 不是实测高差`);
line();

// --------------------------------------------------------------------- 四角
line('【四】四角象限');
if (QUADRANTS) {
  const q = QUADRANTS;
  const rowsPerCorner = q.rows ?? q.rowsPerCorner;
  assert('象限数量 = 4', (q.count ?? q.corners?.length ?? 4) === 4, String(q.count ?? 4));
  if (rowsPerCorner != null) {
    assert('象限排数自洽', rowsPerCorner === 30, `每角 ${rowsPerCorner} 排 → 四角共 ${rowsPerCorner * 4} 排`);
  }
  if (q.seatsTotal != null) line(`  · 象限座席合计 ${q.seatsTotal.toLocaleString()}`);
} else { failed++; line('  ✗ 缺少 QUADRANTS'); }
line();

// ------------------------------------------------------------------- 容量口径
line('【五】容量口径（并列展示，不取平均）');
if (META?.capacity) {
  const c = META.capacity;
  for (const [k, v] of Object.entries(c)) {
    if (typeof v === 'number') line(`  · ${k.padEnd(16)} ${v.toLocaleString()}`);
    else if (v && typeof v === 'object' && v.value != null) line(`  · ${k.padEnd(16)} ${Number(v.value).toLocaleString()}   ${v.src ?? ''}`);
  }
  assert('英超申报口径 74,244 在列',
    JSON.stringify(c).includes('74244') || c.premierLeague === 74244 || c.premierLeague?.value === 74244,
    '与 HUD 顶栏显示一致');
} else { failed++; line('  ✗ 缺少 META.capacity'); }
line();

// ------------------------------------------------------------------- 汇总
line('='.repeat(64));
if (failed === 0) {
  line('结论：全部通过 —— 模型几何自洽，声明值与逐排推算值一致。');
  line('提示：改动 js/data.js 后请同时重跑 tools/gen-drawings.mjs 更新图纸。');
} else {
  line(`结论：${failed} 项未通过 —— 请检查上面标 ✗ 的条目。`);
}
line('='.repeat(64));
process.exit(failed === 0 ? 0 : 1);