#!/usr/bin/env node
/* ===========================================================================
 * 老特拉福德球场 · 建筑图纸自检
 * ---------------------------------------------------------------------------
 * 读取 assets/drawings/ 下由 tools/gen-drawings.mjs（01—05）与
 * tools/gen-level-sheets.mjs（06—12）生成的 12 张 SVG，检查：
 *   1. 文件存在、可读；
 *   2. 含 <svg ...> 与 </svg>、根元素带 viewBox；
 *   3. 不含任何外部资源引用（http:// 与 https:// 只允许 SVG 命名空间）；
 *   4. 必备注记（图名、数据等级图例、图号）齐全；
 *   5. 打印每张图的字节数与元素数量（按标签分类）。
 * 退出码：全部通过 0，任一失败 1。
 * 用法：node tools\check-drawings.mjs
 * ========================================================================= */

import { readFileSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

/**
 * 待检查的图纸清单。
 *   no   —— 图号（必须出现在图面标题里）
 *   must —— 必备注记：图名 / 数据等级图例 / 图签，缺一即不通过
 */
const FILES = [
  { name: '01-总平面图.svg', no: '01', must: ['老特拉福德', '总平面图', '官方', '推算'] },
  { name: '02-南北剖面图.svg', no: '02', must: ['老特拉福德', '剖面', '官方', '推算'] },
  { name: '03-东西剖面图.svg', no: '03', must: ['老特拉福德', '剖面', '官方', '推算'] },
  { name: '04-看台参数对照表.svg', no: '04', must: ['老特拉福德', '看台参数', '官方', '推算'] },
  { name: '05-数据等级图例.svg', no: '05', must: ['老特拉福德', '数据等级', '官方', '推算'] },
  { name: '06-场地层平面图.svg', no: '06', must: ['老特拉福德', '场地层平面图', '官方', '推算', '剖切'] },
  { name: '07-首层看台平面图.svg', no: '07', must: ['老特拉福德', '首层看台平面图', '官方', '推算', '剖切'] },
  { name: '08-中层环廊平面图.svg', no: '08', must: ['老特拉福德', '中层环廊平面图', '官方', '推算', '剖切'] },
  { name: '09-上层环廊平面图.svg', no: '09', must: ['老特拉福德', '上层环廊平面图', '官方', '推算', '剖切'] },
  { name: '10-屋面层平面图.svg', no: '10', must: ['老特拉福德', '屋面层平面图', '官方', '推算', '剖切'] },
  { name: '11-逐层剖面谱.svg', no: '11', must: ['老特拉福德', '逐层剖面谱', '官方', '推算', '剖切'] },
  { name: '12-角部象限专项图.svg', no: '12', must: ['老特拉福德', '角部象限专项图', '官方', '推算', '剖切'] },
];

/** 唯一允许出现的 URL：SVG 命名空间 */
const NS_ALLOWED = 'http://www.w3.org/2000/svg';

/** 统计 SVG 中的元素（自闭合标签按 1 个计，XML 声明与注释不计） */
function countElements(svg) {
  const re = /<([A-Za-z][A-Za-z0-9:_-]*)(\s[^>]*?)?\/?>/g;
  const byTag = {};
  let n = 0;
  let m;
  while ((m = re.exec(svg)) !== null) {
    n++;
    byTag[m[1]] = (byTag[m[1]] || 0) + 1;
  }
  return { n, byTag };
}

/** 找出所有不被允许的 URL */
function findExternalUrls(svg) {
  const stripped = svg.split(NS_ALLOWED).join('');   // 先摘掉合法的命名空间
  const hits = stripped.match(/https?:\/\/[^\s"'<>()]+/g) || [];
  return [...new Set(hits)];
}

const root = fileURLToPath(new URL('..', import.meta.url));
const dir = resolve(root, 'assets', 'drawings');

console.log('老特拉福德球场 · 图纸自检 / DRAWING SELF-CHECK');
console.log(`目录：assets/drawings/   文件数：${FILES.length}（01—05 gen-drawings.mjs，06—12 gen-level-sheets.mjs）`);
console.log('='.repeat(86));

let failed = 0;
let totalBytes = 0;
let totalEl = 0;
const report = [];

for (const item of FILES) {
  const name = item.name;
  const p = resolve(dir, name);
  const problems = [];

  if (!existsSync(p)) {
    problems.push('文件不存在');
    report.push({ name, bytes: 0, n: 0, top: '', problems });
    failed++;
    continue;
  }

  const buf = readFileSync(p);
  const svg = buf.toString('utf8');
  const bytes = statSync(p).size;

  // 2. 结构检查
  if (!svg.includes('<svg')) problems.push('缺少 <svg 起始标签');
  if (!svg.includes('</svg>')) problems.push('缺少 </svg> 结束标签');
  if (!/viewBox\s*=/.test(svg)) problems.push('缺少 viewBox');
  else if (!/<svg[^>]*viewBox\s*=\s*"([^"]+)"/.test(svg)) problems.push('viewBox 未写在根 <svg> 上');

  // 3. 外部资源检查
  const urls = findExternalUrls(svg);
  if (urls.length) problems.push(`发现外部 URL：${urls.slice(0, 3).join(' , ')}`);

  // 4. 必备注记（图名 / 数据等级图例 / 图号）
  const missing = item.must.filter((s) => !svg.includes(s));
  if (missing.length) problems.push(`缺少必备注记：${missing.join('、')}`);
  if (!svg.includes(`${item.no} ·`) && !svg.includes(`${item.no} `)) {
    problems.push(`图面未出现图号 ${item.no}`);
  }

  // 5. 统计
  const { n, byTag } = countElements(svg);
  const top = Object.entries(byTag).sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([t, c]) => `${t}×${c}`).join('  ');

  // 根元素属性回显
  const rootTag = (svg.match(/<svg[^>]*>/) || [''])[0];
  const vb = (rootTag.match(/viewBox\s*=\s*"([^"]+)"/) || [, '—'])[1];
  const width = (rootTag.match(/\bwidth\s*=\s*"([^"]+)"/) || [, '—'])[1];
  const height = (rootTag.match(/\bheight\s*=\s*"([^"]+)"/) || [, '—'])[1];

  totalBytes += bytes;
  totalEl += n;
  if (problems.length) failed++;
  report.push({ name, bytes, n, top, problems, vb, width, height });
}

// 输出
report.forEach((r) => {
  const state = r.problems.length ? '✗ 不通过' : '✓ 通过';
  console.log(`${state}  ${r.name}`);
  console.log(`      字节数 ${String(r.bytes).padStart(8, ' ')} 字节  元素数 ${String(r.n).padStart(5, ' ')} 个`);
  console.log(`      根元素 width=${r.width} height=${r.height} viewBox="${r.vb || '—'}"`);
  console.log(`      主要标签 ${r.top}`);
  r.problems.forEach((s) => console.log(`      ! ${s}`));
});
console.log('='.repeat(86));
console.log(`合计：${report.length} 张图、${totalBytes} 字节、${totalEl} 个元素`);
console.log(`外部资源：${failed ? '存在不合规项' : `0 处（仅允许 ${NS_ALLOWED}）`}`);
console.log(`结论：${failed ? `${failed} 张图未通过` : '全部通过'}`);
process.exit(failed ? 1 : 0);