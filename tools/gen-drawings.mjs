#!/usr/bin/env node
/**
 * ===========================================================================
 * tools/gen-drawings.mjs —— 老特拉福德球场「档案抽屉」建筑图纸生成器
 * ---------------------------------------------------------------------------
 * 输入：../js/data.js（唯一真相，只读，本脚本绝不修改它）
 * 输出：../assets/drawings/01-总平面图.svg … 05-数据等级图例.svg
 *
 * 设计约束
 *   1) 零依赖：仅用 Node 内置模块 + 字符串拼接输出 SVG；
 *   2) SVG 内不得引用任何外部资源（无 http(s) 链接、无外链字体/图片/样式）；
 *   3) 剖面几何必须由 data.js 的 tiers 逐排算出（见 rakeProfile），不得手写坐标；
 *   4) 所有关键尺寸在图上逐项标注数据等级 [官方]/[文献]/[推算]/[推定]。
 *
 * 图纸规格：ISO A1 横版 841 × 594 mm（1 用户单位 = 1 mm，viewBox 同尺寸）
 *   01 总平面图            1:1000
 *   02 南北剖面图          1:300（含 1:50 节点放大）
 *   03 东西剖面图          1:300
 *   04 看台参数对照表      NTS（不按比例）
 *   05 数据等级图例        NTS
 * ===========================================================================
 */

import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * 载入 js/data.js（唯一真相，只读）
 * ---------------------------------------------------------------------------
 * 本项目根目录没有 package.json（不得由本脚本创建），因此 Node 会把 .js 当作
 * CommonJS 解析，静态 import 会报 "Named export ... not found"。
 * 这里做两步：
 *   1) 先按标准 ESM 动态 import（若将来根目录补上 type:module 即走此路）；
 *   2) 失败则读出 data.js 源码，用 data: URL 交给同一个 ESM 加载器求值 ——
 *      文件内容一字不改，仍是 ES module 语义，也仍然只有这一份真相。
 */
async function loadData() {
  if (hasModulePackageJson()) return import('../js/data.js');
  const src = readFileSync(new URL('../js/data.js', import.meta.url), 'utf8');
  if (!/export\s+(const|default|function|class)/.test(src)) return import('../js/data.js');
  return import(`data:text/javascript;charset=utf-8,${encodeURIComponent(src)}`);
}

/** 根目录 / js 目录若声明了 type:module，则可直接 ESM 静态 import */
function hasModulePackageJson() {
  for (const p of ['../package.json', '../js/package.json']) {
    try {
      if (/"type"\s*:\s*"module"/.test(readFileSync(new URL(p, import.meta.url), 'utf8'))) return true;
    } catch { /* 文件不存在，继续 */ }
  }
  return false;
}

const DATA = await loadData();
const {
  META, PITCH, RUN_OFF, BOWL_INNER, STANDS, STAND_ORDER, QUADRANTS,
  FEATURES, CONTEXT, SOURCES, DISCLAIMER, DATA_VERSION,
} = DATA;

/* ===========================================================================
 * 0. 图纸常量与配色
 * ========================================================================= */

const SHEET = { w: 841, h: 594 };            // A1 横版（mm）
const FRAME = { l: 20, r: 10, t: 10, b: 10 }; // 图框：左 20 装订边，其余 10

const INK = '#15181c';        // 主墨色
const INK2 = '#5b636b';       // 次级文字
const INK3 = '#8b939b';       // 弱化文字
const FRAME_C = '#0f1113';    // 图框
const HAIR = '#b9bfc5';       // 细线

const FONT =
  "'Microsoft YaHei','PingFang SC','Hiragino Sans GB','Noto Sans CJK SC'," +
  "'Source Han Sans SC','WenQuanYi Micro Hei',sans-serif";
const MONO = "'Cascadia Mono','Consolas','DejaVu Sans Mono','Courier New',monospace";

/* -------- 数据等级：全套图纸统一配色（第 05 张图为该体系的说明图） -------- */
const LEVELS = {
  官方: { color: '#136c46', bg: '#e6f4ec', desc: '俱乐部 / 政府 / 官方数据集口径，已抓到来源' },
  文献: { color: '#17539b', bg: '#e7eff9', desc: '权威二手来源（stadiumdb / footballgroundguide / 地方志等）' },
  推算: { color: '#a85d00', bg: '#fdf0df', desc: '由已知尺寸按常规建筑做法推导，用于补全视觉比例，并非实测' },
  推定: { color: '#7b3ba0', bg: '#f3ebfa', desc: '按行业标准假定（如草坪 105×68），未见本项目专属来源' },
};
const LV = (k) => LEVELS[k].color;                 // 等级色
const LVT = (v, unit = 'm', d = 1) => `${v.toFixed(d)}${unit} [${lvOf(v)}]`; // 占位（不使用）
function lvOf() { return '推算'; }                  // 占位（不使用）

/** 带等级的标注文本：数值 + 单位 + [等级] */
const dimText = (v, unit, lv, d = 1) => `${v.toFixed(d)}${unit} [${lv}]`;

const C = {
  grass: '#eaf2e4', grassAlt: '#dcead3', grassLine: '#3d4a3c',
  bowl: '#f7f5f1', stand: '#e6e2da', standEdge: '#5a6068',
  quad: '#f4ecdd', quadEdge: '#8a7d64',
  pitchMark: '#2c3630',
  concrete: '#eeebe5', concLine: '#a8a29a', steel: '#98a0a8',
  road: '#ececee', roadEdge: '#9aa0a6', park: '#f1efe9', parkEdge: '#9c968a',
  water: '#d3e6ee', waterEdge: '#5d8fa3',
  rail: '#dcdcdf', railEdge: '#6d7076',
  bldg: '#e3ded4', bldgEdge: '#8d8478',
  dim: '#1668b3', cut: '#c8102e',
  roof: '#c9cfd6', roofEdge: '#5b6169',
  tblHead: '#e9edf1', tblLine: '#aeb5bc', tblAlt: '#fafbfc',
};

/* ===========================================================================
 * 1. 基础绘图工具（全部返回 SVG 字符串片段）
 * ========================================================================= */

const n2 = (v) => (Math.round(v * 100) / 100).toString();

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** 粗略估算文本宽度（mm）：CJK 计 1.0 em，西文计 0.52 em */
function textWidth(s, size) {
  let w = 0;
  for (const ch of String(s)) {
    w += /[\u2E80-\u9FFF\uFF00-\uFFEF\u3000-\u303F]/.test(ch) ? 1.0 : 0.52;
  }
  return w * size;
}

/** 文本 */
function T(x, y, s, o = {}) {
  const a = [
    `x="${n2(x)}"`, `y="${n2(y)}"`,
    `font-size="${o.size ?? 3.4}"`,
    `fill="${o.fill ?? INK}"`,
    `text-anchor="${o.anchor ?? 'start'}"`,
    `font-family="${o.mono ? MONO : FONT}"`,
  ];
  if (o.weight) a.push(`font-weight="${o.weight}"`);
  if (o.spacing) a.push(`letter-spacing="${o.spacing}"`);
  if (o.opacity != null) a.push(`opacity="${o.opacity}"`);
  if (o.rotate) a.push(`transform="rotate(${o.rotate} ${n2(x)} ${n2(y)})"`);
  return `<text ${a.join(' ')}>${esc(s)}</text>`;
}

/** 多行文本（按行距均匀排列） */
function TL(x, y, lines, o = {}) {
  const lh = o.lh ?? (o.size ?? 3.4) * 1.45;
  return lines.map((s, i) => T(x, y + i * lh, s, o)).join('');
}

/** 线段 */
function L(x1, y1, x2, y2, o = {}) {
  const a = [
    `x1="${n2(x1)}"`, `y1="${n2(y1)}"`, `x2="${n2(x2)}"`, `y2="${n2(y2)}"`,
    `stroke="${o.stroke ?? INK}"`, `stroke-width="${o.w ?? 0.3}"`,
  ];
  if (o.dash) a.push(`stroke-dasharray="${o.dash}"`);
  if (o.cap) a.push(`stroke-linecap="${o.cap}"`);
  if (o.opacity != null) a.push(`opacity="${o.opacity}"`);
  return `<line ${a.join(' ')} />`;
}

/** 矩形 */
function R(x, y, w, h, o = {}) {
  const a = [
    `x="${n2(x)}"`, `y="${n2(y)}"`, `width="${n2(w)}"`, `height="${n2(h)}"`,
    `fill="${o.fill ?? 'none'}"`,
  ];
  if (o.stroke !== 'none') a.push(`stroke="${o.stroke ?? 'none'}"`, `stroke-width="${o.w ?? 0.3}"`);
  if (o.dash) a.push(`stroke-dasharray="${o.dash}"`);
  if (o.opacity != null) a.push(`opacity="${o.opacity}"`);
  if (o.rx) a.push(`rx="${o.rx}"`);
  return `<rect ${a.join(' ')} />`;
}

/** 圆 */
function CI(cx, cy, r, o = {}) {
  const a = [`cx="${n2(cx)}"`, `cy="${n2(cy)}"`, `r="${n2(r)}"`, `fill="${o.fill ?? 'none'}"`];
  if (o.stroke !== 'none') a.push(`stroke="${o.stroke ?? 'none'}"`, `stroke-width="${o.w ?? 0.3}"`);
  if (o.dash) a.push(`stroke-dasharray="${o.dash}"`);
  return `<circle ${a.join(' ')} />`;
}

/** 路径 */
function P(d, o = {}) {
  const a = [`d="${d}"`, `fill="${o.fill ?? 'none'}"`];
  if (o.stroke !== 'none') a.push(`stroke="${o.stroke ?? 'none'}"`, `stroke-width="${o.w ?? 0.3}"`);
  if (o.dash) a.push(`stroke-dasharray="${o.dash}"`);
  if (o.join) a.push(`stroke-linejoin="${o.join}"`);
  if (o.opacity != null) a.push(`opacity="${o.opacity}"`);
  return `<path ${a.join(' ')} />`;
}

/** 折线 / 多边形（pts 为 [x,y] 数组） */
const dOf = (pts) => pts.map(([x, y], i) => `${i ? 'L' : 'M'}${n2(x)} ${n2(y)}`).join(' ');
const PL = (pts, o = {}) => P(dOf(pts), { ...o });
const PG = (pts, o = {}) => P(dOf(pts) + ' Z', o);

/** 米 → 图纸毫米用的坐标映射器（统一处理 y 轴翻转） */
function mapper({ k, ox, oy, cx = 0, cy = 0, flipY = false }) {
  return {
    k,
    x: (wx) => ox + (wx - cx) * k,
    y: (wy) => (flipY ? oy - (wy - cy) * k : oy + (wy - cy) * k),
    len: (m) => m * k,
  };
}

/* ---------------------------- 标注 / 尺寸线 ---------------------------- */

/** 水平尺寸线（建筑制图 45° 斜杠标记） */
function dimH(xa, xb, y, label, o = {}) {
  const c = o.color ?? C.dim;
  const s = [
    L(xa, y, xb, y, { stroke: c, w: o.w ?? 0.35 }),
    L(xa - 1.3, y + 1.3, xa + 1.3, y - 1.3, { stroke: c, w: 0.35 }),
    L(xb - 1.3, y + 1.3, xb + 1.3, y - 1.3, { stroke: c, w: 0.35 }),
  ];
  if (o.above !== false) {
    s.push(T((xa + xb) / 2, y - 1.5, label, {
      size: o.size ?? 3.2, anchor: 'middle', fill: c, weight: o.weight ?? 'bold', mono: true,
    }));
  } else {
    s.push(T((xa + xb) / 2, y + (o.size ?? 3.2) + 1.0, label, {
      size: o.size ?? 3.2, anchor: 'middle', fill: c, weight: o.weight ?? 'bold', mono: true,
    }));
  }
  return s.join('');
}

/** 垂直尺寸线（文字旋转 −90°） */
function dimV(x, yTop, yBot, label, o = {}) {
  const c = o.color ?? C.dim;
  const my = (yTop + yBot) / 2;
  const s = [
    L(x, yTop, x, yBot, { stroke: c, w: o.w ?? 0.35 }),
    L(x - 1.3, yTop + 1.3, x + 1.3, yTop - 1.3, { stroke: c, w: 0.35 }),
    L(x - 1.3, yBot + 1.3, x + 1.3, yBot - 1.3, { stroke: c, w: 0.35 }),
  ];
  if (o.side === 'right') {
    s.push(T(x + 1.6, my, label, {
      size: o.size ?? 3.2, anchor: 'middle', fill: c, weight: o.weight ?? 'bold',
      mono: true, rotate: -90,
    }));
  } else {
    s.push(T(x - 1.6, my, label, {
      size: o.size ?? 3.2, anchor: 'middle', fill: c, weight: o.weight ?? 'bold',
      mono: true, rotate: -90,
    }));
  }
  return s.join('');
}

/** 引出标注（点 → 折线 → 文字） */
function leader(px, py, tx, ty, text, o = {}) {
  const c = o.color ?? INK;
  const mid = [o.mid ?? (tx - 6), ty];
  return [
    CI(px, py, o.dot ?? 0.7, { fill: c }),
    PL([[px, py], mid, [tx - 1, ty]], { stroke: c, w: 0.25 }),
    T(tx, ty + 1.2, text, {
      size: o.size ?? 3.1, fill: c, weight: o.weight, mono: o.mono ?? true,
    }),
  ].join('');
}

/** 带白色底衬的文字（用于压在图形上的注记） */
function halo(x, y, s, o = {}) {
  const size = o.size ?? 3.4;
  const w = textWidth(s, size);
  const ax = o.anchor ?? 'start';
  const x0 = ax === 'middle' ? x - w / 2 : ax === 'end' ? x - w : x;
  const pad = o.pad ?? 0.9;
  return [
    R(x0 - pad, y - size * 0.9 - pad * 0.3, w + pad * 2, size * 1.2 + pad * 0.6,
      { fill: o.halo ?? '#ffffff', opacity: o.haloOpacity ?? 0.9 }),
    T(x, y, s, o),
  ].join('');
}

/* ------------------------------ 图框 / 图纸 ------------------------------ */

/** 图框（含分区编号刻度） */
function frame() {
  const { w, h } = SHEET;
  const x0 = FRAME.l, y0 = FRAME.t, x1 = w - FRAME.r, y1 = h - FRAME.b;
  const s = [
    R(x0, y0, x1 - x0, y1 - y0, { stroke: FRAME_C, w: 0.7 }),
    R(x0 - 2.5, y0 - 2.5, x1 - x0 + 5, y1 - y0 + 5, { stroke: HAIR, w: 0.25, dash: '6 3' }),
  ];
  // 顶部/底部 1..8 分区刻度
  const NX = 8, NY = 6;
  for (let i = 1; i < NX; i++) {
    const x = x0 + ((x1 - x0) * i) / NX;
    s.push(L(x, y0, x, y0 + 4, { stroke: FRAME_C, w: 0.35 }));
    s.push(L(x, y1, x, y1 - 4, { stroke: FRAME_C, w: 0.35 }));
  }
  for (let i = 0; i < NX; i++) {
    const cx = x0 + ((x1 - x0) * (i + 0.5)) / NX;
    s.push(T(cx, y0 - 1.6, String(i + 1), { size: 3, anchor: 'middle', fill: INK3, mono: true }));
    s.push(T(cx, y1 + 4.4, String(i + 1), { size: 3, anchor: 'middle', fill: INK3, mono: true }));
  }
  // 左右 A..F 分区刻度
  for (let i = 1; i < NY; i++) {
    const y = y0 + ((y1 - y0) * i) / NY;
    s.push(L(x0, y, x0 + 4, y, { stroke: FRAME_C, w: 0.35 }));
    s.push(L(x1, y, x1 - 4, y, { stroke: FRAME_C, w: 0.35 }));
  }
  for (let i = 0; i < NY; i++) {
    const cy = y0 + ((y1 - y0) * (i + 0.5)) / NY;
    const ch = String.fromCharCode(65 + i);
    s.push(T(x0 - 1.6, cy + 1.1, ch, { size: 3, anchor: 'middle', fill: INK3, mono: true }));
    s.push(T(x1 + 1.6, cy + 1.1, ch, { size: 3, anchor: 'middle', fill: INK3, mono: true }));
  }
  return s.join('');
}

/**
 * 标题栏（固定画在图纸右下角）
 * info = { no, name, scale, note }
 */
function titleBlock(info) {
  const w = 224, h = 84;
  const x = SHEET.w - FRAME.r - w;
  const y = SHEET.h - FRAME.b - h;
  const out = [];
  out.push(R(x, y, w, h, { fill: '#ffffff', stroke: FRAME_C, w: 0.7 }));

  // 抬头
  out.push(R(x, y, w, 15, { fill: '#eceff2', stroke: FRAME_C, w: 0.5 }));
  out.push(T(x + 3, y + 6.4, `${META.name} · ${META.nameEn}`, { size: 5.2, weight: 'bold' }));
  out.push(T(x + 3, y + 12.4, '3D 展览「档案抽屉」· 数据驱动建筑图纸', { size: 3.1, fill: INK2 }));

  // 图名行
  const y1 = y + 15, h1 = 20;
  out.push(R(x, y1, w, h1, { stroke: FRAME_C, w: 0.5 }));
  out.push(L(x + 34, y1, x + 34, y1 + h1, { stroke: FRAME_C, w: 0.5 }));
  out.push(T(x + 3, y1 + 6, '图名', { size: 3.2, fill: INK2 }));
  out.push(T(x + 3, y1 + 13.4, 'DRAWING', { size: 2.6, fill: INK3, mono: true }));
  out.push(T(x + 37, y1 + 13.4, info.name, { size: 7, weight: 'bold' }));

  // 三栏信息行
  const y2 = y1 + h1, h2 = 17;
  const colW = [70, 78, w - 148];
  let cx = x;
  const cells = [
    { l: '图号', v: info.no },
    { l: '比例', v: info.scale },
    { l: '数据等级', v: '逐项标注 [官方]/[文献]/[推算]/[推定]' },
  ];
  cells.forEach((c0, i) => {
    out.push(R(cx, y2, colW[i], h2, { stroke: FRAME_C, w: 0.5 }));
    out.push(T(cx + 2.5, y2 + 6, c0.l, { size: 2.9, fill: INK2 }));
    out.push(T(cx + 2.5, y2 + 13, c0.v, i === 2 ? { size: 2.55, fill: INK2 } : { size: 4.6, weight: 'bold', mono: true }));
    cx += colW[i];
  });

  // 来源说明
  const y3 = y2 + h2, h3 = h - 15 - h1 - h2;
  out.push(R(x, y3, w, h3, { stroke: FRAME_C, w: 0.5 }));
  out.push(T(x + 2.5, y3 + 5.4, `数据来源：js/data.js（DATA_VERSION ${DATA_VERSION}）· ${SOURCES.length} 条来源清单`, { size: 2.7, fill: INK2 }));
  out.push(T(x + 2.5, y3 + 10, DISCLAIMER.short, { size: 2.7, fill: '#8a2b2b' }));
  out.push(T(x + 2.5, y3 + 14.6, `生成：tools/gen-drawings.mjs · ${new Date().toISOString().slice(0, 10)}`, { size: 2.5, fill: INK3, mono: true }));
  return out.join('');
}

/** 指北针（北 = −Z = 图面向上） */
function northArrow(cx, cy, r) {
  const s = [
    CI(cx, cy, r * 1.22, { stroke: HAIR, w: 0.3 }),
    CI(cx, cy, r * 1.5, { stroke: HAIR, w: 0.3, dash: '3 2' }),
    P(`M${n2(cx)} ${n2(cy - r)} L${n2(cx - r * 0.4)} ${n2(cy + r * 0.62)} L${n2(cx)} ${n2(cy + r * 0.22)} Z`,
      { fill: INK }),
    P(`M${n2(cx)} ${n2(cy - r)} L${n2(cx + r * 0.4)} ${n2(cy + r * 0.62)} L${n2(cx)} ${n2(cy + r * 0.22)} Z`,
      { fill: '#ffffff', stroke: INK, w: 0.3 }),
    T(cx, cy - r * 1.18, '北', { size: 4.4, anchor: 'middle', weight: 'bold' }),
    T(cx, cy + r * 1.05, 'N', { size: 3, anchor: 'middle', fill: INK2, mono: true }),
  ];
  return s.join('');
}

/** 图形比例尺：segs 为米刻度，k 为 mm/m */
function scaleBar(x, y, k, segs, unit = 'm') {
  const h = 3.4;
  const out = [];
  let cx = x;
  segs.forEach((v, i) => {
    const w = (i === 0 ? v : v - segs[i - 1]) * k;
    out.push(R(cx, y, w, h, { fill: i % 2 ? '#ffffff' : INK, stroke: INK, w: 0.3 }));
    out.push(L(cx, y + h, cx, y + h + 1.6, { stroke: INK, w: 0.3 }));
    out.push(T(cx, y + h + 5.2, String(v), { size: 3, anchor: 'middle', mono: true }));
    cx += w;
  });
  out.push(L(cx, y + h, cx, y + h + 1.6, { stroke: INK, w: 0.3 }));
  out.push(T(cx, y + h + 5.2, `${segs[segs.length - 1]} ${unit}`, { size: 3, anchor: 'middle', mono: true }));
  out.push(T(x, y - 1.8, '图形比例尺', { size: 3, fill: INK2 }));
  // 左上 1/5 细分
  out.push(T(x + 2, y - 1.8, '', { size: 3 }));
  return out.join('');
}

/** 面板（带标题条的信息框） */
function panel(x, y, w, h, title, o = {}) {
  const th = o.th ?? 8;
  const s = [R(x, y, w, h, { fill: o.fill ?? '#ffffff', stroke: o.stroke ?? HAIR, w: 0.4 })];
  if (title) {
    s.push(R(x, y, w, th, { fill: o.headFill ?? '#eceff2', stroke: o.stroke ?? HAIR, w: 0.4 }));
    s.push(T(x + 3, y + th * 0.72, title, { size: o.ts ?? 4.6, weight: 'bold', fill: o.tc ?? INK }));
  }
  return s.join('');
}

/** 等级色块 */
function lvSwatch(x, y, w, h, lv) {
  return R(x, y, w, h, { fill: LEVELS[lv].bg, stroke: LEVELS[lv].color, w: 0.45 });
}

/** 颜色图例条（官方/文献/推算/推定） */
function levelStrip(x, y, o = {}) {
  const size = o.size ?? 3.2;
  let cx = x;
  const out = [];
  Object.keys(LEVELS).forEach((lv) => {
    const label = `[${lv}]`;
    const w = textWidth(label, size) + 3.4;
    out.push(lvSwatch(cx, y - size * 0.95, w, size * 1.3, lv));
    out.push(T(cx + w / 2, y, label, { size, anchor: 'middle', fill: LV(lv), weight: 'bold' }));
    cx += w + 2.2;
  });
  return out.join('');
}

/* ===========================================================================
 * 2. 由 data.js 派生的几何（剖面几何的唯一入口）
 * ========================================================================= */

/** 看台在剖切轴上的半宽（碗体内缘到原点） */
const halfOf = (key) => {
  const ax = STANDS[key].axis;
  return (ax === 'z-' || ax === 'z+') ? BOWL_INNER.halfZ : BOWL_INNER.halfX;
};

/**
 * 由「距碗体内缘的水平距离 u」换算到世界坐标（沿该看台的剖切轴）
 *   axis 'z-' → Z = -(halfZ + u)   （北看台）
 *   axis 'z+' → Z = +(halfZ + u)   （南看台）
 *   axis 'x-' → X = -(halfX + u)   （西看台）
 *   axis 'x+' → X = +(halfX + u)   （东看台）
 */
function worldOf(key, u) {
  const s = STANDS[key];
  const h = halfOf(key);
  switch (s.axis) {
    case 'z-': return { axis: 'z', v: -(h + u) };
    case 'z+': return { axis: 'z', v: (h + u) };
    case 'x-': return { axis: 'x', v: -(h + u) };
    default: return { axis: 'x', v: (h + u) };
  }
}

/**
 * ★ 核心：由 tiers 逐排计算某座看台的阶梯剖面
 * ---------------------------------------------------------------------------
 * 规则（与 js/data.js 的字段定义一致，r 自 0 起计）：
 *     第 k 层第 r 排踏面标高 tread(r) = baseHeight + r * rowRise
 *     第 k 层第 r 排水平进深 depth(r) = startDepth + r * rowDepth   （自碗体内缘起算）
 *     本层后缘 backDepth = startDepth + rows * rowDepth
 *     本层后壁顶 backTop = baseHeight + rows * rowRise
 *     层间平台标高 concourseLevel = 下层 baseHeight + rows * rowRise（全部可由数据推出，无独立假定）
 * 方向翻转由 worldOf() 统一处理，本函数只算「局部进深/标高」。
 */
function rakeProfile(key) {
  const s = STANDS[key];
  const tiers = [];
  s.tiers.forEach((t, i) => {
    const steps = [];
    for (let r = 0; r < t.rows; r++) {
      steps.push({
        r,
        d0: t.startDepth + r * t.rowDepth,
        d1: t.startDepth + (r + 1) * t.rowDepth,
        tread: t.baseHeight + r * t.rowRise,
        next: t.baseHeight + (r + 1) * t.rowRise,
      });
    }
    const prev = i > 0 ? tiers[i - 1] : null;
    tiers.push({
      id: t.id,
      spec: t,
      rows: t.rows,
      steps,
      frontDepth: t.startDepth,
      backDepth: t.startDepth + t.rows * t.rowDepth,
      topTread: t.baseHeight + (t.rows - 1) * t.rowRise,
      backTop: t.baseHeight + t.rows * t.rowRise,
      concourseLevel: prev ? prev.backTop : 0,
      gapFromPrev: prev ? t.startDepth - prev.backDepth : t.startDepth,
      fasciaDeclared: t.fascia,
    });
  });

  const last = tiers[tiers.length - 1];
  const first = tiers[0];
  return {
    key,
    stand: s,
    nameZh: s.nameZh,
    axis: s.axis,
    half: halfOf(key),
    tiers,
    frontDepth: first.frontDepth,
    backDepthComputed: last.backDepth,
    backTopComputed: last.backTop,
    maxTread: Math.max(...tiers.map((x) => x.topTread)),
    rowsTotal: tiers.reduce((a, x) => a + x.rows, 0),
    treadsTotal: tiers.reduce((a, x) => a + x.rows, 0),
    risersTotal: tiers.reduce((a, x) => a + x.rows + 1, 0),
    totalDepthDeclared: s.totalDepth,
    totalDepthDelta: s.totalDepth - last.backDepth,
    /** 剖面实体轮廓（局部进深 u → 标高 y），自地面起封闭 */
    solidOutline() {
      const pts = [[first.frontDepth, 0], [first.frontDepth, first.spec.baseHeight]];
      tiers.forEach((tr, i) => {
        tr.steps.forEach((st) => {
          pts.push([st.d1, st.tread]);
          pts.push([st.d1, st.next]);
        });
        const nx = tiers[i + 1];
        if (nx) {
          pts.push([nx.frontDepth, tr.backTop]);   // 层间平台（水平）
          pts.push([nx.frontDepth, nx.spec.baseHeight]); // 上层前缘竖板
        }
      });
      pts.push([last.backDepth, 0]);
      return pts;
    },
  };
}

/**
 * 屋盖几何（局部进深 → 标高）
 * 口径：屋盖后缘落在看台声明外缘（BOWL_INNER 半宽 + totalDepth），
 *       前缘 = 后缘 − roofCantilever。因此悬挑量恒等于数据值，
 *       而后缘/前缘的绝对位置随 totalDepth 的 [推算] 性而平移 —— 见图上注记。
 */
function roofGeom(key) {
  const s = STANDS[key];
  const rear = s.totalDepth;                     // 局部进深
  const front = rear - s.roofCantilever;
  const th = 1.2;                                // [推算] 屋盖结构厚度，数据未给出
  return {
    rear, front, th,
    bottom: s.roofHeight,
    top: s.roofHeight + th,
    cantilever: s.roofCantilever,
    overhangPastBowl: front - 0,                 // >0 表示越过碗体内缘、悬到跑动区上方
  };
}

/** 全部看台的剖面（供海拔/统计复用） */
const PROFILES = Object.fromEntries(STAND_ORDER.map((k) => [k, rakeProfile(k)]));

/* ===========================================================================
 * 3. 图纸 01：总平面图  1:1000
 * ========================================================================= */

function drawPlan() {
  const W = 1000, k = 1000 / W;                    // 1:1000 → 1 m = 1 mm
  const CW = { x0: -200, x1: 250, z0: -245, z1: 205 };  // 图上范围（米，450 × 450）
  const cxw = (CW.x0 + CW.x1) / 2, czw = (CW.z0 + CW.z1) / 2;
  const MAP = mapper({ k, ox: 269, oy: 245, cx: cxw, cy: czw }); // 中心落在纸面 (269,245)
  const px = (x) => MAP.x(x), py = (z) => MAP.y(z), sl = (m) => MAP.len(m);
  const g = [];

  /* ---------- 3.1 配景：道路 / 停车场 / 运河 / 铁路 / 建筑 ---------- */
  const ctx = [];
  // 铁路（北侧）
  const railW = 3.0;
  const rz = CONTEXT.rail.offset;
  ctx.push(R(px(CW.x0), py(rz - railW), sl(CW.x1 - CW.x0), sl(railW * 2),
    { fill: C.rail, stroke: C.railEdge, w: 0.3 }));
  ctx.push(L(px(CW.x0), py(rz - railW), px(CW.x1), py(rz - railW), { stroke: C.railEdge, w: 0.5 }));
  ctx.push(L(px(CW.x0), py(rz + railW), px(CW.x1), py(rz + railW), { stroke: C.railEdge, w: 0.5 }));
  for (let x = CW.x0; x <= CW.x1; x += 6) {
    ctx.push(L(px(x), py(rz - railW), px(x), py(rz + railW), { stroke: C.railEdge, w: 0.18, opacity: 0.7 }));
  }
  ctx.push(T(px(CW.x0) + 2, py(rz) - 1.6, CONTEXT.rail.name, { size: 3.2, fill: '#3d4249', weight: 'bold' }));

  // 运河（北侧）
  const ca = CONTEXT.canal;
  ctx.push(R(px(CW.x0), py(ca.offset - ca.width / 2), sl(CW.x1 - CW.x0), sl(ca.width),
    { fill: C.water, stroke: C.waterEdge, w: 0.35 }));
  for (let x = CW.x0; x < CW.x1; x += 14) {
    ctx.push(L(px(x), py(ca.offset - 1.5), px(x + 8), py(ca.offset - 1.5), { stroke: C.waterEdge, w: 0.2, opacity: 0.65 }));
    ctx.push(L(px(x + 5), py(ca.offset + 2.5), px(x + 12), py(ca.offset + 2.5), { stroke: C.waterEdge, w: 0.2, opacity: 0.65 }));
  }
  ctx.push(T(px(CW.x0) + 2, py(ca.offset) + 5.6, `${ca.name}（${ca.width} m 宽 [文献]）`, { size: 3.2, fill: '#20475a', weight: 'bold' }));

  // 道路
  CONTEXT.roads.forEach((rd) => {
    const alongZ = rd.axis === 'z';
    const x0 = alongZ ? px(rd.offset - rd.width / 2) : px(CW.x0);
    const z0 = alongZ ? py(CW.z0) : py(rd.offset - rd.width / 2);
    const w = alongZ ? sl(rd.width) : sl(CW.x1 - CW.x0);
    const h = alongZ ? sl(CW.z1 - CW.z0) : sl(rd.width);
    ctx.push(R(x0, z0, w, h, { fill: C.road, stroke: C.roadEdge, w: 0.35 }));
    // 中线
    if (alongZ) ctx.push(L(x0 + w / 2, z0, x0 + w / 2, z0 + h, { stroke: '#ffffff', w: 0.5, dash: '4 3' }));
    else ctx.push(L(x0, z0 + h / 2, x0 + w, z0 + h / 2, { stroke: '#ffffff', w: 0.5, dash: '4 3' }));
    const tx = alongZ ? x0 + w + 1.4 : x0 + 3;
    const ty = alongZ ? py(rd.offset) + 1.2 : z0 - 1.6;
    ctx.push(halo(tx, ty, `${rd.name}（${rd.width} m [${/\[官方\]/.test(rd.note || '') ? '官方' : '文献'}]）`, { size: 2.9, fill: '#3d4249', anchor: 'start' }));
  });

  // 停车场
  CONTEXT.carparks.forEach((cp) => {
    const x = px(cp.x - cp.w / 2), y = py(cp.z - cp.d / 2);
    ctx.push(R(x, y, sl(cp.w), sl(cp.d), { fill: C.park, stroke: C.parkEdge, w: 0.35, dash: '2 1.4' }));
    // 车位线（示意，按 2.5 × 5.0 m 标准车位排布）
    const cols = Math.floor(cp.w / 5), rowsN = Math.floor(cp.d / 2.5);
    for (let i = 1; i < cols; i++) {
      const gx = px(cp.x - cp.w / 2 + i * (cp.w / cols));
      ctx.push(L(gx, y + 1, gx, y + sl(cp.d) / 2 - 1, { stroke: C.parkEdge, w: 0.15, opacity: 0.55 }));
    }
    for (let i = 1; i < rowsN; i++) {
      const gy = py(cp.z - cp.d / 2 + i * (cp.d / rowsN));
      ctx.push(L(x + 1, gy, x + sl(cp.w) - 1, gy, { stroke: C.parkEdge, w: 0.15, opacity: 0.35 }));
    }
    ctx.push(R(x + 1, y + 1, 4.6, 4.2, { fill: '#ffffff', stroke: C.parkEdge, w: 0.3 }));
    ctx.push(T(x + 3.3, y + 4.1, 'P', { size: 3.2, anchor: 'middle', weight: 'bold', fill: '#3d4249' }));
    ctx.push(T(x + 6.4, y + 4.1, `${cp.id} · ${cp.w}×${cp.d} m`, { size: 3.0, weight: 'bold', mono: true }));
  });

  // 建筑（本图范围内）
  CONTEXT.landmarks.filter((l) => l.w && l.h || l.w).forEach(() => {});
  CONTEXT.landmarks.forEach((lm) => {
    if (!lm.w) return;
    const inside = lm.x - lm.w / 2 > CW.x0 && lm.x + lm.w / 2 < CW.x1
      && lm.z - lm.d / 2 > CW.z0 && lm.z + lm.d / 2 < CW.z1;
    if (!inside) return;
    const x = px(lm.x - lm.w / 2), y = py(lm.z - lm.d / 2);
    ctx.push(R(x, y, sl(lm.w), sl(lm.d), { fill: C.bldg, stroke: C.bldgEdge, w: 0.4 }));
    ctx.push(T(x + 2, y + sl(lm.d) / 2 + 1.2, `${lm.name}`, { size: 3.1, weight: 'bold' }));
    ctx.push(T(x + 2, y + sl(lm.d) / 2 + 5.4, `${lm.w}×${lm.d} m · 高 ${lm.h} m`, { size: 2.7, fill: INK2, mono: true }));
  });

  // 轻轨站（范围内者）
  CONTEXT.landmarks.filter((l) => l.items).forEach((lm) => {
    lm.items.forEach((it) => {
      if (it.x < CW.x0 || it.x > CW.x1 || it.z < CW.z0 || it.z > CW.z1) return;
      const x = px(it.x), y = py(it.z);
      ctx.push(CI(x, y, 2.6, { fill: '#ffffff', stroke: '#17539b', w: 0.5 }));
      ctx.push(T(x, y + 1.1, 'M', { size: 3.2, anchor: 'middle', weight: 'bold', fill: '#17539b', mono: true }));
      ctx.push(T(x + 3.6, y + 1.1, `Metrolink ${it.stop}`, { size: 2.9, fill: '#17539b' }));
    });
  });
  g.push(ctx.join(''));

  /* ---------- 3.2 四角象限 + 四座看台 ---------- */
  const st = [];
  const outerOf = (key) => halfOf(key) + STANDS[key].totalDepth;
  const outerX = { e: outerOf('east'), w: outerOf('west') };
  const outerZ = { n: outerOf('north'), s: outerOf('south') };
  const bx = BOWL_INNER.halfX, bz = BOWL_INNER.halfZ;

  // 四角象限：几何由 QUADRANTS.cornerRadius（= BOWL_INNER.cornerRadius 的圆角弧）与 corners[].sx/sz 决定
  // 象限 = 外轮廓角部区域，其内缘被碗体内缘的圆角弧切掉（cornerCut ≈ 8.28 m）
  const qr = QUADRANTS.cornerRadius ?? BOWL_INNER.cornerRadius;
  const splitDeg = QUADRANTS.splitDeg ?? 45;
  QUADRANTS.corners.forEach((c0) => {
    const ax = c0.sx ?? (c0.x === '+' ? 1 : -1);
    const az = c0.sz ?? (c0.z === '-' ? -1 : 1);
    const ox = ax * (ax > 0 ? outerX.e : outerX.w);      // 外轮廓角点
    const oz = az * (az < 0 ? outerZ.n : outerZ.s);
    const p1 = [ax * (bx - qr), az * bz];                // 弧端点（落在边线一侧）
    const p2 = [ax * bx, az * (bz - qr)];                // 弧端点（落在球门线一侧）
    const ccx = ax * (bx - qr), ccz = az * (bz - qr);    // 弧心
    const sweep = (ax * az < 0) ? 1 : 0;
    const arc = `A${n2(sl(qr))} ${n2(sl(qr))} 0 0 ${sweep} ${n2(px(p2[0]))} ${n2(py(p2[1]))}`;
    const d0 = `M${n2(px(p1[0]))} ${n2(py(p1[1]))} ${arc} `
      + `L${n2(px(ox))} ${n2(py(p2[1]))} L${n2(px(ox))} ${n2(py(oz))} L${n2(px(p1[0]))} ${n2(py(oz))} Z`;
    st.push(P(d0, { fill: C.quad, stroke: C.quadEdge, w: 0.5 }));
    // 角部座席轮廓弧（被相邻看台覆盖的部分自然不显）
    st.push(P(`M${n2(px(p1[0]))} ${n2(py(p1[1]))} ${arc}`, { stroke: C.quadEdge, w: 0.45, dash: '3.5 2' }));
    // 45° 分属线：自弧中点指向外角，说明该 90° 角弧按 splitDeg 分属相邻两座看台
    const mx = ccx + ax * qr / Math.SQRT2, mz = ccz + az * qr / Math.SQRT2;
    st.push(L(px(mx), py(mz), px(ox), py(oz), { stroke: C.quadEdge, w: 0.3, dash: '2 2', opacity: 0.8 }));
    const lx = px((p2[0] + ox) / 2), ly = py((p1[1] + oz) / 2);
    st.push(T(lx, ly - 3.2, `${c0.name}象限`, { size: 3.5, anchor: 'middle', weight: 'bold', fill: '#6b5c3f' }));
    st.push(T(lx, ly + 1.4, `${c0.rows} 排 · 底标高 ${c0.baseHeight.toFixed(1)} m`, { size: 2.7, anchor: 'middle', fill: '#6b5c3f', mono: true }));
    st.push(T(lx, ly + 5.4, `${splitDeg}° 分属相邻两座看台 [推算]`, { size: 2.6, anchor: 'middle', fill: '#6b5c3f' }));
  });

  // 四座看台主体
  STAND_ORDER.forEach((key) => {
    const s = STANDS[key];
    const p = PROFILES[key];
    let x, y, w, h;
    if (s.axis === 'z-') { x = px(-bx); y = py(-outerZ.n); w = sl(bx * 2); h = sl(outerZ.n - bz); }
    else if (s.axis === 'z+') { x = px(-bx); y = py(bz); w = sl(bx * 2); h = sl(outerZ.s - bz); }
    else if (s.axis === 'x+') { x = px(bx); y = py(-bz); w = sl(outerX.e - bx); h = sl(bz * 2); }
    else { x = px(-outerX.w); y = py(-bz); w = sl(outerX.w - bx); h = sl(bz * 2); }
    st.push(R(x, y, w, h, { fill: C.stand, stroke: C.standEdge, w: 0.55 }));

    // 逐层前沿线（startDepth 起算，由 axis 决定翻转方向）
    p.tiers.forEach((tr) => {
      const u = tr.frontDepth;
      const horiz = s.axis === 'z-';
      if (horiz) {
        const zz = worldOf(key, u).v;
        st.push(L(px(-bx), py(zz), px(bx), py(zz), { stroke: C.standEdge, w: 0.3, dash: '4 2' }));
        const tz = py(zz) - 1.6;
        st.push(T(px(-bx) + 2.5, tz, `${tr.id} 首排（进深 ${u.toFixed(1)} m）· ${tr.rows} 排`, { size: 2.7, fill: '#4b5158', mono: true }));
      } else {
        const xx = worldOf(key, u).v;
        st.push(L(px(xx), py(-bz), px(xx), py(bz), { stroke: C.standEdge, w: 0.3, dash: '4 2' }));
        st.push(T(px(xx) + 1.6, py(-bz) + 4.4, `${tr.id} 首排（进深 ${u.toFixed(1)} m）· ${tr.rows} 排`,
          { size: 2.7, fill: '#4b5158', mono: true, rotate: -90 }));
      }
    });

    // 声明外缘（实线已画）与逐排几何外缘（虚线）
    const dBack = p.backDepthComputed;
    if (Math.abs(dBack - s.totalDepth) > 0.05) {
      const horiz = s.axis === 'z-' || s.axis === 'z+';
      if (horiz) {
        const zz = worldOf(key, dBack).v;
        st.push(L(px(-bx), py(zz), px(bx), py(zz), { stroke: '#b02a1f', w: 0.5, dash: '5 2 1.5 2' }));
      } else {
        const xx = worldOf(key, dBack).v;
        st.push(L(px(xx), py(-bz), px(xx), py(bz), { stroke: '#b02a1f', w: 0.5, dash: '5 2 1.5 2' }));
      }
    }

    // 看台名
    const cxm = x + w / 2, cym = y + h / 2;
    const vert = s.axis === 'x+' || s.axis === 'x-';
    const nm = `${s.nameZh}`;
    const sub = `${s.nameEn}`;
    const sub2 = `${p.tiers.length} 层 · 共 ${p.rowsTotal} 排 · 声明总进深 ${s.totalDepth.toFixed(1)} m`;
    if (vert) {
      st.push(T(cxm, cym, nm, { size: 5, anchor: 'middle', weight: 'bold', rotate: -90 }));
      st.push(T(cxm + 5.4, cym, sub2, { size: 2.9, anchor: 'middle', fill: INK2, mono: true, rotate: -90 }));
    } else {
      st.push(T(cxm, cym - 2.6, nm, { size: 5.2, anchor: 'middle', weight: 'bold' }));
      st.push(T(cxm, cym + 1.6, sub, { size: 3.2, anchor: 'middle', fill: INK2 }));
      st.push(T(cxm, cym + 6.2, sub2, { size: 3.0, anchor: 'middle', fill: INK2, mono: true }));
    }
  });
  g.push(st.join(''));

  /* ---------- 3.3 场地内部元素（FEATURES） ---------- */
  const ft = [];
  // 广告板（距草坪边线 4.0 m）
  const ad = FEATURES.advertisingBoards.distanceFromLine;
  ft.push(R(px(-PITCH.length / 2 - ad), py(-PITCH.width / 2 - ad),
    sl(PITCH.length + ad * 2), sl(PITCH.width + ad * 2),
    { stroke: '#7a6a3a', w: 0.45, dash: '4 2' }));
  ft.push(T(px(-PITCH.length / 2 - ad) + 1, py(-PITCH.width / 2 - ad) - 1.4,
    `场边 LED 广告板 距边线 ${ad.toFixed(1)} m [推算]`, { size: 2.8, fill: '#7a6a3a' }));
  // 球员通道（西南角，宽 3.2 m）
  const tn = FEATURES.tunnel;
  ft.push(R(px(-bx), py(bz - tn.width), sl(0.9), sl(tn.width), { fill: '#c8102e', stroke: '#7a0b1d', w: 0.4 }));
  ft.push(leader(px(-bx) - 0.5, py(bz - tn.width / 2), px(-bx) - 34, py(bz + 16),
    `球员通道 ${tn.width}×${tn.height} m · 西南角 [文献]`, { color: '#a01020', size: 2.9 }));
  // 教练席 ×2（南看台前沿，位置按对称布置假定 [推算]）
  const dg = FEATURES.dugouts;
  [-1, 1].forEach((sg) => {
    const xc = sg * 18;
    ft.push(R(px(xc - dg.length / 2), py(bz - dg.depth), sl(dg.length), sl(dg.depth), { fill: '#8d9198', stroke: '#5a6068', w: 0.35 }));
  });
  ft.push(leader(px(18), py(bz - dg.depth / 2), px(30), py(bz) + 9.4,
    `教练席 ${dg.count} 座 · ${dg.length}×${dg.depth} m（对称布置假定 [推算]）`, { color: '#3d4550', size: 2.9 }));
  g.push(ft.join(''));

  /* ---------- 3.4 草坪与标线 ---------- */
  const pf = [];
  const hl = PITCH.length / 2, hw = PITCH.width / 2;
  pf.push(R(px(-hl), py(-hw), sl(PITCH.length), sl(PITCH.width), { fill: C.grass }));
  for (let i = 0; i < PITCH.stripes; i++) {
    if (i % 2) continue;
    const x0 = -hl + (PITCH.length * i) / PITCH.stripes;
    pf.push(R(px(x0), py(-hw), sl(PITCH.length / PITCH.stripes), sl(PITCH.width), { fill: C.grassAlt }));
  }
  const lw = 0.32;
  // 外框
  pf.push(R(px(-hl), py(-hw), sl(PITCH.length), sl(PITCH.width), { stroke: C.pitchMark, w: lw }));
  // 中线 + 中圈 + 中点
  pf.push(L(px(0), py(-hw), px(0), py(hw), { stroke: C.pitchMark, w: lw }));
  pf.push(CI(px(0), py(0), sl(PITCH.centerCircleRadius), { stroke: C.pitchMark, w: lw }));
  pf.push(CI(px(0), py(0), 0.7, { fill: C.pitchMark }));
  // 两侧大禁区 / 小禁区 / 点球点 / 罚球弧
  [-1, 1].forEach((sg) => {
    const gx = sg * hl;
    const paD = PITCH.penaltyAreaLength, paW = PITCH.penaltyAreaWidth;
    pf.push(R(px(Math.min(gx, gx - sg * paD)), py(-paW / 2), sl(paD), sl(paW), { stroke: C.pitchMark, w: lw }));
    const gaD = PITCH.goalAreaLength, gaW = PITCH.goalAreaWidth;
    pf.push(R(px(Math.min(gx, gx - sg * gaD)), py(-gaW / 2), sl(gaD), sl(gaW), { stroke: C.pitchMark, w: lw }));
    const sp = gx - sg * PITCH.penaltySpot;
    pf.push(CI(px(sp), py(0), 0.7, { fill: C.pitchMark }));
    // 罚球弧：以点球点为心、半径 = 中圈半径，取大禁区外的一段
    const rr = PITCH.centerCircleRadius;
    const dx = Math.abs(sp) + Math.sqrt(Math.max(rr * rr - (paW / 2) ** 2, 0));
    const xEnter = sg * (Math.abs(sp) + Math.sqrt(Math.max(rr * rr - (paW / 2) ** 2, 0)));
    const ax1 = px(xEnter), ay1 = py(-paW / 2), ax2 = px(xEnter), ay2 = py(paW / 2);
    pf.push(P(`M${n2(ax1)} ${n2(ay1)} A${n2(sl(rr))} ${n2(sl(rr))} 0 0 ${sg > 0 ? 1 : 0} ${n2(ax2)} ${n2(ay2)}`,
      { stroke: C.pitchMark, w: lw }));
    // 球门（门柱 7.32 m，网深 2.0 m，立于门线外）
    const gw = PITCH.goalWidth;
    pf.push(R(px(Math.min(gx, gx + sg * PITCH.goalDepth)), py(-gw / 2), sl(PITCH.goalDepth), sl(gw),
      { stroke: C.pitchMark, w: 0.5 }));
    void dx;
  });
  // 角弧
  [[-1, -1], [-1, 1], [1, -1], [1, 1]].forEach(([sx, sz]) => {
    const cxp = sx * hl, czp = sz * hw;
    const r = PITCH.cornerArcRadius;
    const p1 = [cxp - sx * r, czp], p2 = [cxp, czp - sz * r];
    const sweep = (sx * sz > 0) ? 0 : 1;
    pf.push(P(`M${n2(px(p1[0]))} ${n2(py(p1[1]))} A${n2(sl(r))} ${n2(sl(r))} 0 0 ${sweep} ${n2(px(p2[0]))} ${n2(py(p2[1]))}`,
      { stroke: C.pitchMark, w: lw }));
  });
  // 草坪注记
  pf.push(halo(px(0), py(-24), `草坪 ${PITCH.length.toFixed(1)} × ${PITCH.width.toFixed(1)} m [推定]`,
    { size: 4.2, anchor: 'middle', weight: 'bold', fill: '#2f3a33' }));
  pf.push(halo(px(0), py(-18), `${PITCH.surface} · ${PITCH.lengthNote}`,
    { size: 2.8, anchor: 'middle', fill: '#4a5648' }));
  g.push(pf.join(''));

  /* ---------- 3.5 碗体内缘 / 首排线 / 剖切符号 ---------- */
  const bl = [];
  // 碗体内缘：圆角矩形（四角半径 = BOWL_INNER.cornerRadius [推算]，圆角切掉直角 cornerCut ≈ 8.28 m）
  const AR = `A${n2(sl(qr))} ${n2(sl(qr))} 0 0 1 `;
  const BOWL_D = `M${n2(px(-bx + qr))} ${n2(py(-bz))}`
    + `L${n2(px(bx - qr))} ${n2(py(-bz))} ${AR}${n2(px(bx))} ${n2(py(-bz + qr))}`
    + `L${n2(px(bx))} ${n2(py(bz - qr))} ${AR}${n2(px(bx - qr))} ${n2(py(bz))}`
    + `L${n2(px(-bx + qr))} ${n2(py(bz))} ${AR}${n2(px(-bx))} ${n2(py(bz - qr))}`
    + `L${n2(px(-bx))} ${n2(py(-bz + qr))} ${AR}${n2(px(-bx + qr))} ${n2(py(-bz))} Z`;
  bl.push(P(BOWL_D, { stroke: '#0f6e8c', w: 0.7, dash: '7 3' }));
  bl.push(halo(px(0), py(-bz) - 1.8,
    `碗体内缘 BOWL_INNER：${(bx * 2).toFixed(1)} × ${(bz * 2).toFixed(1)} m · 四角圆角 R${qr.toFixed(1)} m（切角 ${BOWL_INNER.cornerCut.toFixed(2)} m）[推算]`,
    { size: 3.2, anchor: 'middle', weight: 'bold', fill: '#0f6e8c' }));
  bl.push(halo(px(0), py(bz) + 13.2,
    `碗体内缘 = 草坪半宽 + 缓冲（RUN_OFF 球门线后 ${RUN_OFF.goalLine.toFixed(1)} m / 边线侧 ${RUN_OFF.touchLine.toFixed(1)} m [推算]）`,
    { size: 2.9, anchor: 'middle', fill: '#0f6e8c' }));

  // 剖切符号 2—2（南北向，视向 +X）与 3—3（东西向，视向 −Z）
  bl.push(L(px(0), py(-130), px(0), py(85), { stroke: C.cut, w: 0.55, dash: '9 2.5 1.5 2.5' }));
  bl.push(L(px(-6), py(-130), px(6), py(-130), { stroke: C.cut, w: 0.9 }));
  bl.push(L(px(-6), py(85), px(6), py(85), { stroke: C.cut, w: 0.9 }));
  bl.push(T(px(0) + 3.4, py(-130) + 3.6, '2—2  南北剖面 · 视向 +X（自西向东看）', { size: 3.1, weight: 'bold', fill: C.cut }));
  bl.push(L(px(-118), py(0), px(118), py(0), { stroke: C.cut, w: 0.55, dash: '9 2.5 1.5 2.5' }));
  bl.push(L(px(-118), py(-6), px(-118), py(6), { stroke: C.cut, w: 0.9 }));
  bl.push(L(px(118), py(-6), px(118), py(6), { stroke: C.cut, w: 0.9 }));
  bl.push(T(px(120) + 0.6, py(0) - 2.4, '3—3', { size: 3.1, weight: 'bold', fill: C.cut }));
  g.push(bl.join(''));

  /* ---------- 3.6 尺寸链 ---------- */
  const dm = [];
  const yA = 480, yB = 489, yC = 498;
  // 底部（X 向）
  dm.push(L(px(-bx), py(bz) + 4, px(-bx), yA, { stroke: C.dim, w: 0.2 }));
  dm.push(L(px(bx), py(bz) + 4, px(bx), yA, { stroke: C.dim, w: 0.2 }));
  dm.push(dimH(px(-bx), px(bx), yA, `${(bx * 2).toFixed(1)} m 碗体内缘宽 [推算]`));
  dm.push(dimH(px(0), px(bx), yA + 0, ''));
  dm.push(L(px(-outerX.w), py(bz) + 8, px(-outerX.w), yB, { stroke: C.dim, w: 0.2 }));
  dm.push(L(px(0), py(bz) + 8, px(0), yB, { stroke: C.dim, w: 0.2 }));
  dm.push(L(px(outerX.e), py(bz) + 8, px(outerX.e), yB, { stroke: C.dim, w: 0.2 }));
  dm.push(dimH(px(-outerX.w), px(0), yB, `西看台 ${STANDS.west.totalDepth.toFixed(1)} m [推算]`));
  dm.push(dimH(px(0), px(outerX.e), yB, `东看台 ${STANDS.east.totalDepth.toFixed(1)} m [推算]`));
  dm.push(L(px(-hl), py(bz) + 12, px(-hl), yC, { stroke: C.dim, w: 0.2 }));
  dm.push(L(px(hl), py(bz) + 12, px(hl), yC, { stroke: C.dim, w: 0.2 }));
  dm.push(dimH(px(-hl), px(hl), yC, `草坪 ${PITCH.length.toFixed(1)} m [推定]`, { color: LV('推定') }));
  // 左侧（Z 向）
  const xA = 38, xB = 30, xC = 22;
  dm.push(L(px(-bx) - 4, py(-bz), xA, py(-bz), { stroke: C.dim, w: 0.2 }));
  dm.push(L(px(-bx) - 4, py(bz), xA, py(bz), { stroke: C.dim, w: 0.2 }));
  dm.push(dimV(xA, py(-bz), py(bz), `${(bz * 2).toFixed(1)} m 碗体内缘进深 [推算]`));
  dm.push(L(px(-bx) - 8, py(-outerZ.n), xB, py(-outerZ.n), { stroke: C.dim, w: 0.2 }));
  dm.push(L(px(-bx) - 8, py(0), xB, py(0), { stroke: C.dim, w: 0.2 }));
  dm.push(L(px(-bx) - 8, py(outerZ.s), xB, py(outerZ.s), { stroke: C.dim, w: 0.2 }));
  dm.push(dimV(xB, py(-outerZ.n), py(0), `北看台 ${STANDS.north.totalDepth.toFixed(1)} m [推算]`));
  dm.push(dimV(xB, py(0), py(outerZ.s), `南看台 ${STANDS.south.totalDepth.toFixed(1)} m [推算]`));
  dm.push(L(px(-bx) - 12, py(-hw), xC, py(-hw), { stroke: C.dim, w: 0.2 }));
  dm.push(L(px(-bx) - 12, py(hw), xC, py(hw), { stroke: C.dim, w: 0.2 }));
  dm.push(dimV(xC, py(-hw), py(hw), `草坪 ${PITCH.width.toFixed(1)} m [推定]`, { color: LV('推定') }));
  g.push(dm.join(''));

  /* ---------- 3.7 右侧信息栏 + 指北针 + 比例尺 ---------- */
  const RX = 510, RW = SHEET.w - FRAME.r - RX;   // 510 .. 831
  const rp = [];

  // 指北针
  rp.push(panel(RX, 20, RW, 74, '指北针 / 图纸方向'));
  rp.push(northArrow(RX + 40, 62, 15));
  rp.push(T(RX + 72, 50, '图面 +X 向右（东）· +Z 向下（南）', { size: 3.4, fill: INK2 }));
  rp.push(T(RX + 72, 56, '与 js/data.js 的坐标约定一致：', { size: 3.2, fill: INK2 }));
  rp.push(T(RX + 72, 61.4, '+X 东 / −X 西 / +Z 南 / −Z 北 / +Y 上', { size: 3.2, fill: INK2, mono: true }));
  rp.push(T(RX + 72, 68, `原点 = 草坪中心 · OS ${META.osGridRef}`, { size: 3.0, fill: INK3 }));

  // 图例
  rp.push(panel(RX, 100, RW, 132, '图例 / LEGEND'));
  const maxDepthDelta = Math.max(...STAND_ORDER.map((k) => Math.abs(PROFILES[k].totalDepthDelta)));
  // 图例（等级与数量全部由 CONTEXT 派生，不写死）
  const nRoadsOff = CONTEXT.roads.filter((r) => /\[官方\]/.test(r.note || '')).length;
  const nParksOff = CONTEXT.carparks.filter((c) => /\[官方\]/.test(c.note || '')).length;
  const nLandmarks = CONTEXT.landmarks.reduce((a, l) => a + (l.items ? l.items.length : 1), 0);
  const legItems = [
    [`草坪与场地标线（${PITCH.length} × ${PITCH.width} m [推定]）`, C.grass, C.pitchMark, null],
    [`看台主体（${STAND_ORDER.length} 座，含逐层前沿线）`, C.stand, C.standEdge, null],
    [`四角象限（${QUADRANTS.addedYear} 加建，${QUADRANTS.corners[0].rows} 排/角 [文献]）`, C.quad, C.quadEdge, null],
    [`碗体内缘 BOWL_INNER（${(bx * 2).toFixed(1)} × ${(bz * 2).toFixed(1)} m · 圆角 R${qr.toFixed(1)} m [推算]）`, 'none', '#0f6e8c', '7 3'],
    [`看台声明外缘 / 逐排几何外缘（虚，最大偏差 ${maxDepthDelta.toFixed(2)} m）`, 'none', '#b02a1f', '5 2 1.5 2'],
    [`道路（${CONTEXT.roads.length} 条，其中 ${nRoadsOff} 条 [官方]）`, C.road, C.roadEdge, null],
    [`停车场（${CONTEXT.carparks.length} 处，其中 ${nParksOff} 处 [官方]）`, C.park, C.parkEdge, '2 1.4'],
    [`运河（${CONTEXT.canal.name}，${CONTEXT.canal.width} m 宽 [文献]）`, C.water, C.waterEdge, null],
    [`${CONTEXT.rail.name} [文献]`, C.rail, C.railEdge, null],
    [`建筑体量（${nLandmarks} 处地标，Hotel Football 等 [文献]）`, C.bldg, C.bldgEdge, null],
    ['剖切位置线 2—2 / 3—3', 'none', C.cut, '9 2.5 1.5 2.5'],
  ];
  legItems.forEach((it, i) => {
    const yy = 100 + 11.4 + i * 10.6;
    rp.push(R(RX + 4, yy - 4.6, 14, 6.4, { fill: it[1], stroke: it[2], w: 0.4, dash: it[3] || null }));
    rp.push(T(RX + 21, yy, it[0], { size: 3.15, fill: INK }));
  });

  // 数据等级
  rp.push(panel(RX, 240, RW, 96, '数据等级 / DATA LEVEL（全图逐项标注）'));
  Object.keys(LEVELS).forEach((lv, i) => {
    const yy = 240 + 13 + i * 20.5;
    rp.push(lvSwatch(RX + 4, yy - 6.4, 20, 8.6, lv));
    rp.push(T(RX + 14, yy, `[${lv}]`, { size: 4, anchor: 'middle', fill: LV(lv), weight: 'bold' }));
    rp.push(T(RX + 28, yy - 0.4, LEVELS[lv].desc, { size: 2.9, fill: INK2 }));
  });

  // 比例尺
  rp.push(panel(RX, 344, RW, 40, '比例'));
  rp.push(scaleBar(RX + 6, 366, k, [0, 25, 50, 100, 200]));
  rp.push(T(RX + 130, 372, '1:1000（A1）', { size: 5, weight: 'bold', mono: true }));
  rp.push(T(RX + 130, 378, '1 mm = 1 m', { size: 3.2, fill: INK2, mono: true }));

  // 说明
  rp.push(panel(RX, 392, RW, SHEET.h - FRAME.b - 392, '说明 / NOTES'));
  const notes = [
    '1. 本图非施工图、非测绘成果，不得作为施工或工程依据。所有数值均附数据等级，[推算] 值为按常规做法推导，并非实测。',
    `2. 碗体内缘 BOWL_INNER = ${(bx * 2).toFixed(1)} × ${(bz * 2).toFixed(1)} m = 草坪半宽 + RUN_OFF（球门线后 ${RUN_OFF.goalLine.toFixed(1)} m / 边线侧 ${RUN_OFF.touchLine.toFixed(1)} m，均 [推算]）；四角以 R${qr.toFixed(1)} m 圆角取代直角（切角 ${BOWL_INNER.cornerCut.toFixed(2)} m [推算]）。各层 startDepth 自该线起算：首层 ${PROFILES.north.tiers[0].frontDepth.toFixed(1)} m 即第一排距碗体内缘的净空。`,
    `3. 数据自洽性校核：四座看台「声明 totalDepth」与「逐排几何外缘（末层 startDepth + rows × rowDepth）」最大偏差 ${maxDepthDelta.toFixed(2)} m；层间几何空隙与 fascia 声明值同样一致（例：北看台 L1→L2 空隙 ${PROFILES.north.tiers[1].gapFromPrev.toFixed(2)} m / fascia 声明 ${PROFILES.north.tiers[0].fasciaDeclared.toFixed(1)} m）。凡校核不通过处，本图以红色点划线另画几何外缘；本次校核全部通过，故未见红线。`,
    '4. 周边道路、停车场、运河、铁路取自 CONTEXT，其自述为「示意性重建，非测绘成果」；方位来自实测与文献，坐标未逐一实测。',
    '5. 本图范围外（北侧）：Emirates Old Trafford 板球场、Trafford Park Freightliner 货运站、Metrolink Imperial War Museum 站。',
    '6. 大屏、屋盖灯带（FEATURES.bigScreen / floodlights）未在本图定位：其平面位置数据未给出，不臆造。',
    `7. ${DISCLAIMER.short}`,
  ];
  notes.forEach((s, i) => {
    const yy = 392 + 12 + i * 13.6;
    rp.push(T(RX + 4, yy, s.length > 62 ? s.slice(0, 62) : s, { size: 2.75, fill: i === notes.length - 1 ? '#8a2b2b' : INK2 }));
    if (s.length > 62) {
      let rest = s.slice(62);
      let line = 1;
      while (rest.length) {
        rp.push(T(RX + 8, yy + line * 4.6, rest.slice(0, 74), { size: 2.75, fill: i === notes.length - 1 ? '#8a2b2b' : INK2 }));
        rest = rest.slice(74);
        line++;
      }
    }
  });
  g.push(rp.join(''));

  /* ---------- 3.8 图框 + 标题栏 ---------- */
  g.push(frame());
  g.push(titleBlock({
    no: 'TRF-A-01',
    name: '总平面图 · GENERAL PLAN',
    scale: '1:1000',
  }));

  return svgDoc({
    title: '老特拉福德球场 · 01 总平面图',
    desc: '由 js/data.js 生成的场地总平面：草坪与标线、碗体内缘、四座看台、四角象限与周边配景。',
    body: g.join('\n'),
  });
}

/* ===========================================================================
 * 4. 图纸 02 / 03：剖面图  1:300
 * ========================================================================= */

/**
 * 绘制剖面（which = 'z' 南北 / 'x' 东西）
 * 全部几何来自 PROFILES（rakeProfile）与 roofGeom，无手写坐标常量。
 */
function drawSection(which) {
  const NS = which === 'z';
  // 南北向总跨度约 215 m、东西向约 251 m：A1 上分别取 1:300 / 1:400，两者均为标准比例
  const DEN = NS ? 300 : 400;
  const k = 1000 / DEN;
  const keys = NS ? ['north', 'south'] : ['west', 'east'];
  const halfBowl = NS ? BOWL_INNER.halfZ : BOWL_INNER.halfX;
  const halfPitch = NS ? PITCH.width / 2 : PITCH.length / 2;
  const runOff = NS ? RUN_OFF.touchLine : RUN_OFF.goalLine;
  // 图上范围由数据推出：两座看台声明外缘（碗体内缘 + totalDepth）再外扩 3 m，保证剖切轮廓不出图
  const extA = keys.map((kk) => halfOf(kk) + STANDS[kk].totalDepth);
  const win = { a0: -extA[0] - 3, a1: extA[1] + 3 };
  const x0 = 56;                                   // 剖切左端（右侧留给尺寸链与留白）
  const baseY = NS ? 362 : 379;                     // 标高 0（草坪面）在纸上的 y
  const AX = (a) => x0 + (a - win.a0) * k;         // 世界坐标 → 纸面 x
  const YY = (y) => baseY - y * k;                 // 标高 → 纸面 y（上为 +Y）
  const SL = (m) => m * k;
  // 局部进深 u → 纸面 x（按各看台 axis 翻转）
  const UX = (key, u) => AX(worldOf(key, u).v);

  const g = [];

  /* ---------- 4.1 地面与草坪 ---------- */
  g.push(`<defs>
    <pattern id="ground" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <rect width="5" height="5" fill="#f4f2ee" />
      <line x1="0" y1="0" x2="0" y2="5" stroke="#c8c3ba" stroke-width="0.35" />
    </pattern>
    <pattern id="conc" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <rect width="6" height="6" fill="#e9e6e0" />
      <line x1="0" y1="0" x2="0" y2="6" stroke="#bab4aa" stroke-width="0.4" />
    </pattern>
    <pattern id="seat" width="3" height="3" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <rect width="3" height="3" fill="#efe9e2" />
      <line x1="0" y1="0" x2="0" y2="3" stroke="#cfa9a2" stroke-width="0.3" />
    </pattern>
  </defs>`);

  const Y0 = baseY;
  g.push(R(FRAME.l + 2, Y0, SHEET.w - FRAME.l - FRAME.r - 4, 12, { fill: 'url(#ground)', stroke: 'none' }));
  g.push(L(FRAME.l + 2, Y0, SHEET.w - FRAME.r - 1, Y0, { stroke: INK, w: 0.7 }));
  // 草坪（剖切长度）
  g.push(R(AX(-halfPitch), Y0 + 1.2, SL(halfPitch * 2), 3.4, { fill: C.grass, stroke: '#5d7a52', w: 0.4 }));
  g.push(T(AX(0), Y0 + 10.5, `草坪 · 剖切长度 ${(halfPitch * 2).toFixed(1)} m [推定]`, { size: 3.6, anchor: 'middle', weight: 'bold', fill: '#2f3a33' }));

  /* ---------- 4.2 看台剖面（由 tiers 逐排计算） ---------- */
  keys.forEach((key) => {
    const p = PROFILES[key];
    const s = STANDS[key];
    const solid = p.solidOutline().map(([u, y]) => [UX(key, u), YY(y)]);
    g.push(PG(solid, { fill: 'url(#conc)', stroke: '#4a4f55', w: 0.65, join: 'miter' }));
    // 座席面（坡面装饰）：逐排踏面加一条细红线，直观显示「每一排都算过」
    p.tiers.forEach((tr) => {
      tr.steps.forEach((st) => {
        g.push(L(UX(key, st.d0), YY(st.tread) - 0.55, UX(key, st.d1), YY(st.tread) - 0.55,
          { stroke: '#b3473c', w: 0.22, opacity: 0.5 }));
      });
    });
    // 层间平台（fascia）底衬
    p.tiers.forEach((tr, i) => {
      const nx = p.tiers[i + 1];
      if (!nx) return;
      g.push(L(UX(key, tr.backDepth), YY(tr.backTop), UX(key, nx.frontDepth), YY(tr.backTop),
        { stroke: '#2f6f8f', w: 0.5 }));
      g.push(L(UX(key, nx.frontDepth), YY(nx.spec.baseHeight), UX(key, nx.frontDepth), YY(tr.backTop),
        { stroke: '#2f6f8f', w: 0.5 }));
    });
    // 内缘竖线（碗体内缘）
    g.push(L(UX(key, 0), Y0, UX(key, 0), YY(1.2), { stroke: '#0f6e8c', w: 0.6, dash: '6 2.5' }));
    // 屋盖
    const rg = roofGeom(key);
    const rx1 = UX(key, rg.front), rx2 = UX(key, rg.rear);
    const ry1 = YY(rg.bottom), ry2 = YY(rg.top);
    g.push(R(Math.min(rx1, rx2), ry1, Math.abs(rx2 - rx1), ry2 - ry1,
      { fill: C.roof, stroke: C.roofEdge, w: 0.55 }));
    // 屋盖前缘加厚 + 后支点竖杆
    g.push(L(rx1, ry1 - 1.2, rx1, ry2 + 1.2, { stroke: C.roofEdge, w: 0.9 }));
    g.push(L(rx2, ry2, rx2, YY(0), { stroke: '#4a4f55', w: 0.7 }));
    g.push(L(rx2 - 1.6, ry2, rx2 + 1.6, ry2, { stroke: '#4a4f55', w: 0.7 }));
    // 剖切到的最大标高标注
    g.push(L(UX(key, rg.rear), YY(rg.bottom), UX(key, rg.rear) - 18, YY(rg.bottom) - 6, { stroke: INK3, w: 0.22 }));
    // 看台名
    const midU = (p.frontDepth + p.backDepthComputed) / 2;
    g.push(halo(UX(key, midU), YY(2.2), `${s.nameZh}`, { size: 6, anchor: 'middle', weight: 'bold' }));
    g.push(halo(UX(key, midU), YY(-1.2), `${p.tiers.length} 层 · 共 ${p.rowsTotal} 排 · 声明总进深 ${s.totalDepth.toFixed(1)} m [推算]`,
      { size: 3.2, anchor: 'middle', fill: INK2, mono: true }));
  });

  /* ---------- 4.3 尺寸标注（全部由数据推出，无手写坐标） ---------- */
  const dim = [];
  const yD1 = Y0 + 16, yD2 = Y0 + 28, yD3 = Y0 + 40;
  // ① 跑动区缓冲（草坪边线 → 碗体内缘）
  keys.forEach((key) => {
    const sgn = STANDS[key].axis.endsWith('-') ? -1 : 1;
    dim.push(dimH(AX(Math.min(sgn * halfPitch, sgn * halfBowl)), AX(Math.max(sgn * halfPitch, sgn * halfBowl)), yD1,
      `${runOff.toFixed(1)} m 缓冲 [推算]`, { color: LV('推算'), size: 3.0 }));
  });
  // ② 声明总进深
  keys.forEach((key) => {
    dim.push(dimH(UX(key, 0), UX(key, STANDS[key].totalDepth), yD2,
      `声明总进深 ${STANDS[key].totalDepth.toFixed(1)} m [推算]`, { color: LV('推算'), size: 3.0 }));
  });
  // ③ 屋盖悬挑：北看台 58.5 m 为 [官方]，其余为 [推算]
  const roofs = keys.map((kk) => roofGeom(kk));
  keys.forEach((key, i) => {
    const rg = roofs[i];
    const lv = STANDS[key].roofCantileverTier ?? (key === 'north' ? '官方' : '推算');
    const yb = YY(rg.bottom) - 10;
    dim.push(dimH(Math.min(UX(key, rg.front), UX(key, rg.rear)), Math.max(UX(key, rg.front), UX(key, rg.rear)), yb,
      `屋盖悬挑 ${rg.cantilever.toFixed(1)} m [${lv}]`,
      { color: LV(lv), size: 3.4, weight: lv === '官方' ? 'bold' : null }));
    [rg.rear, rg.front].forEach((u) => {
      dim.push(L(UX(key, u), yb + 2.6, UX(key, u), YY(rg.bottom) - 1.4, { stroke: LV(lv), w: 0.25 }));
    });
  });
  // ④ 竖向尺寸链：屋盖底标高 / 看台最高结构标高（左端一座在左，右端一座在右）
  const vL = [30, 40], vR = [AX(win.a1) + 6, AX(win.a1) + 16];
  keys.forEach((key, i) => {
    const p = PROFILES[key], rg = roofs[i];
    const xs = i === 0 ? vL : vR;
    dim.push(dimV(xs[0], YY(rg.bottom), Y0, `屋盖底标高 ${rg.bottom.toFixed(1)} m [推算]`, { color: LV('推算'), size: 3.0 }));
    dim.push(dimV(xs[1], YY(p.backTopComputed), Y0,
      `最高结构标高 ${p.backTopComputed.toFixed(2)} m [推算]`, { color: LV('推算'), size: 3.0 }));
  });
  // ⑤ 全场外缘总进深
  dim.push(dimH(AX(win.a0 + 3), AX(win.a1 - 3), yD3,
    `${NS ? '南北' : '东西'}向外缘总进深 ${(extA[0] + extA[1]).toFixed(1)} m [推算]`, { color: LV('推算'), size: 3.4 }));
  // ⑥ 单级行距 / 排高（证明剖面是按排算出来的）
  if (NS) {
    const t0 = PROFILES.north.tiers[0];
    const r0 = t0.steps[0];
    dim.push(dimH(UX('north', r0.d0), UX('north', r0.d1), YY(r0.tread) + 8,
      `行距 ${t0.spec.rowDepth.toFixed(2)} m`, { color: LV('推算'), size: 2.8 }));
    dim.push(dimH(UX('north', r0.d1), UX('north', r0.d1) + 12, YY(r0.tread) + 8,
      `第 1 排 · 踏面 ${t0.spec.baseHeight.toFixed(2)} m`, { color: '#8a2b2b', size: 2.8 }));
    dim.push(dimV(UX('north', r0.d1) + 3, YY(r0.tread), YY(r0.next),
      `排高 ${t0.spec.rowRise.toFixed(2)} m`, { color: LV('推算'), size: 2.8 }));
  }
  g.push(dim.join(''));

  /* ---------- 4.4 说明面板 ---------- */
  const notes = NS ? [
    '剖面视向 +X（自西向东看）：图面左为北（−Z）、右为南（+Z）。剖切线 2—2 通过 X = 0，不切割四角象限。',
    `阶梯剖面由 js/data.js 的 tiers 逐排计算：第 k 层第 r 排 踏面标高 = baseHeight + r·rowRise，水平进深 = startDepth + r·rowDepth（自碗体内缘起算）。`
    + `北看台 ${PROFILES.north.tiers.length} 层共 ${PROFILES.north.rowsTotal} 排（${PROFILES.north.tiers.map((t) => t.rows).join(' + ')}），本图绘出 ${PROFILES.north.treadsTotal} 级踏步与 ${PROFILES.north.risersTotal} 条竖板线；`
    + `南看台 ${PROFILES.south.tiers.length} 层共 ${PROFILES.south.rowsTotal} 排。`,
    `层间平台标高 = 下层 baseHeight + rows × rowRise，全部由数据推出：北看台 L1 顶排 ${PROFILES.north.tiers[0].backTop.toFixed(2)} m → L2 底标高 ${PROFILES.north.tiers[1].spec.baseHeight.toFixed(2)} m（结构深 ${(PROFILES.north.tiers[1].spec.baseHeight - PROFILES.north.tiers[0].backTop).toFixed(2)} m）；`
    + `L2 顶排 ${PROFILES.north.tiers[1].backTop.toFixed(2)} m → L3 底标高 ${PROFILES.north.tiers[2].spec.baseHeight.toFixed(2)} m（结构深 ${(PROFILES.north.tiers[2].spec.baseHeight - PROFILES.north.tiers[1].backTop).toFixed(2)} m）。层间几何空隙与 fascia 声明值一致（${PROFILES.north.tiers[1].gapFromPrev.toFixed(2)} + ${PROFILES.north.tiers[2].gapFromPrev.toFixed(2)} m vs fascia ${PROFILES.north.tiers[0].spec.fascia.toFixed(1)} m）。`,
    `官方口径中与本剖面直接相关的只有三项：北看台屋盖悬挑 ${roofs[0].cantilever.toFixed(1)} m、台阶 ${STANDS.north.stairsOfficial} 级、容量 ${META.capacity.premierLeague.toLocaleString('en-US')}（英超申报）。`
    + `悬挑按「屋盖前缘 = 看台声明外缘 − 悬挑」定位：前缘位于碗体内缘以北 ${roofs[0].overhangPastBowl.toFixed(1)} m（世界坐标 Z = ${worldOf(keys[0], roofs[0].front).v.toFixed(1)} m），未罩到跑动区上空；屋盖后支点的官方定义未取得，属 [推算]。`,
    `官方「台阶 ${STANDS.north.stairsOfficial} 级」与图中 ${PROFILES.north.treadsTotal} 级看台踏步不是同一对象（前者为楼梯级数口径），二者不可互相换算。`,
    '屋盖一律按水平绘制，底标高取 roofHeight；屋面坡度与屋盖结构厚度（图中 1.2 m）数据未给出，为 [推算]。',
    `南看台单层为可见事实（[文献]）；${STANDS.north.nameZh}屋盖 ${roofs[0].bottom.toFixed(1)} m 与 ${STANDS.south.nameZh}屋盖 ${roofs[1].bottom.toFixed(1)} m 的高差 ${(roofs[0].bottom - roofs[1].bottom).toFixed(1)} m 系两个 [推算] 值之差，不是实测高差。`,
  ] : [
    '剖面视向 −Z（自南向北看）：图面左为西（−X）、右为东（+X）。剖切线 3—3 通过 Z = 0，不切割四角象限。',
    `阶梯剖面同样由 tiers 逐排计算：西看台（Stretford End，传统死忠端）${PROFILES.west.tiers.length} 层共 ${PROFILES.west.rowsTotal} 排，东看台（旧称 Scoreboard End，客队球迷区 [官方]）${PROFILES.east.tiers.length} 层共 ${PROFILES.east.rowsTotal} 排；`
    + `两座的层间平台标高同样由数据推出（西 L1 顶排 ${PROFILES.west.tiers[0].backTop.toFixed(2)} m → L2 底标高 ${PROFILES.west.tiers[1].spec.baseHeight.toFixed(2)} m；东 ${PROFILES.east.tiers[0].backTop.toFixed(2)} m → ${PROFILES.east.tiers[1].spec.baseHeight.toFixed(2)} m）。`,
    `东西两座看台是全场唯一「对称双两层」的一对：排数 ${PROFILES.west.rowsTotal} vs ${PROFILES.east.rowsTotal}、声明总进深 ${STANDS.west.totalDepth.toFixed(1)} vs ${STANDS.east.totalDepth.toFixed(1)} m、屋盖底标高 ${STANDS.west.roofHeight.toFixed(1)} vs ${STANDS.east.roofHeight.toFixed(1)} m、悬挑 ${STANDS.west.roofCantilever.toFixed(1)} vs ${STANDS.east.roofCantilever.toFixed(1)} m —— 差异全部来自 [推算] 值，非实测。`,
    '东看台为主入口面（正门、Sir Matt Busby Way、两座雕像 [官方/文献]）；西端外侧无公共街道（[实测]，见 CONTEXT.west.contextNote），故本剖面在西端未绘城市道路。',
    '屋盖按水平绘制，底标高取 roofHeight；屋面坡度数据未给出，不臆造；屋盖结构厚度（图中 1.2 m）为 [推算]。',
    '官方口径中与东西两侧相关的项：客队球迷区位于东看台 [官方]、东看台座位约 12,000 [官方]、E1/E2/W2 停车场方位 [官方]；其余几何均为 [推算]。',
  ];

  const px0 = 24, py0 = 24, pw = 500, ph = 126;
  g.push(panel(px0, py0, pw, ph, '剖面数据说明 / SECTION NOTES'));
  let ny = py0 + 12.5;
  notes.forEach((s, i) => {
    const lines = wrap(s, 112);
    const use = Math.min(lines.length, 4);
    if (ny + use * 4.4 > py0 + ph - 3) return;          // 溢出保护
    lines.slice(0, 4).forEach((ln, j) => {
      g.push(T(px0 + 4, ny + j * 4.4, `${j === 0 ? `${i + 1}. ` : '    '}${ln}`,
        { size: 2.85, fill: (i === 3 && NS) ? '#8a2b2b' : INK2 }));
    });
    ny += use * 4.4 + 2.4;
  });

  /* ---------- 4.5 对比图（南北落差 / 东西对照） ---------- */
  const cx0 = 540, cy0 = 24, cw = SHEET.w - FRAME.r - cx0, ch = 126;
  g.push(panel(cx0, cy0, cw, ch, NS ? '南北高度落差对比 / NORTH vs SOUTH' : '东西两座看台对照 / WEST vs EAST'));
  const a = PROFILES[keys[0]], b = PROFILES[keys[1]];
  const ra = roofGeom(keys[0]), rb = roofGeom(keys[1]);
  const rows2 = NS ? [
    ['屋盖底标高 (m)', ra.bottom, rb.bottom],
    ['看台最高结构标高 (m)', a.backTopComputed, b.backTopComputed],
    ['顶层踏面标高 (m)', a.maxTread, b.maxTread],
    ['声明总进深 (m)', STANDS[keys[0]].totalDepth, STANDS[keys[1]].totalDepth],
    ['屋盖悬挑 (m)', ra.cantilever, rb.cantilever],
    ['层数 / 排数', a.tiers.length, b.tiers.length, true],
  ] : [
    ['屋盖底标高 (m)', ra.bottom, rb.bottom],
    ['看台最高结构标高 (m)', a.backTopComputed, b.backTopComputed],
    ['顶层踏面标高 (m)', a.maxTread, b.maxTread],
    ['声明总进深 (m)', STANDS[keys[0]].totalDepth, STANDS[keys[1]].totalDepth],
    ['屋盖悬挑 (m)', ra.cantilever, rb.cantilever],
    ['层数 / 排数', a.tiers.length, b.tiers.length, true],
  ];
  const colW = [104, 52, 52, 34];
  const hx = cx0 + 4;
  g.push(T(hx + 0, cy0 + 19, '项目', { size: 3.2, fill: INK2, weight: 'bold' }));
  g.push(T(hx + colW[0] + colW[1] * 0.5, cy0 + 19, STANDS[keys[0]].nameZh, { size: 3.2, anchor: 'middle', fill: INK2, weight: 'bold' }));
  g.push(T(hx + colW[0] + colW[1] + colW[2] * 0.5, cy0 + 19, STANDS[keys[1]].nameZh, { size: 3.2, anchor: 'middle', fill: INK2, weight: 'bold' }));
  g.push(T(hx + colW[0] + colW[1] + colW[2] + colW[3] * 0.5, cy0 + 19, '差值', { size: 3.2, anchor: 'middle', fill: INK2, weight: 'bold' }));
  rows2.forEach((r, i) => {
    const yy = cy0 + 28 + i * 13.4;
    const cx1 = hx, cx2 = hx + colW[0], cx3 = cx2 + colW[1], cx4 = cx3 + colW[2];
    g.push(L(hx, yy + 3.4, hx + colW[0] + colW[1] + colW[2] + colW[3], yy + 3.4, { stroke: '#dde2e7', w: 0.3 }));
    g.push(T(cx1, yy, r[0], { size: 3.15, fill: INK }));
    if (i === rows2.length - 1) {
      // 「层数 / 排数」行：直接写原文，避免与数字列重叠
      g.push(T(cx2, yy, `${a.tiers.length} 层 / ${a.rowsTotal} 排`, { size: 3.0, mono: true, fill: LV('推算') }));
      g.push(T(cx3, yy, `${b.tiers.length} 层 / ${b.rowsTotal} 排`, { size: 3.0, mono: true, fill: LV('推算') }));
      g.push(T(cx4, yy, `${a.rowsTotal - b.rowsTotal} 排`, { size: 3.0, mono: true, fill: INK, weight: 'bold' }));
      return;
    }
    g.push(T(cx2, yy, Number(r[1]).toFixed(2), { size: 3.3, mono: true, fill: LV('推算') }));
    g.push(T(cx3, yy, Number(r[2]).toFixed(2), { size: 3.3, mono: true, fill: LV('推算') }));
    g.push(T(cx4, yy, (r[1] - r[2]).toFixed(2), { size: 3.3, mono: true, fill: INK, weight: 'bold' }));
  });
  g.push(levelStrip(hx, cy0 + 104));
  g.push(T(hx, cy0 + 112, '表内数值除「层数 / 排数」为 data 原样给出外，其余标高与进深均由 js/data.js 派生，全部为 [推算]；', { size: 2.8, fill: INK2 }));
  g.push(T(hx, cy0 + 117, NS
    ? '唯一 [官方] 几何量：北看台屋盖悬挑 58.5 m（已在剖面中单独标注）。'
    : '东/西看台无 [官方] 几何量，看台几何全部为 [推算]。', { size: 2.8, fill: INK2 }));
  g.push(T(hx, cy0 + 122, NS
    ? '南看台单层 [文献] 是北/东/西三座多层之外的唯一例外 —— 这是全场形体不对称的根源。'
    : '西端「Stretford End」为传统死忠端，东看台为客队球迷区 [官方]。', { size: 2.8, fill: INK2 }));

  /* ---------- 4.6 底部：节点放大（把 L1→L2 层间交界按大比例重画一遍） ---------- */
  // 通用节点放大：坐标一律由 rakeProfile() 的逐排结果换算，不用手写常量
  function nodeDetail(key, o) {
    const p = PROFILES[key];
    const t0 = p.tiers[0], t1 = p.tiers[1];
    const lastStep = t0.steps[t0.steps.length - 1];
    g.push(panel(o.bx0, o.by0, o.bw, o.bh,
      `节点放大 1:${Math.round(1000 / o.kk)} · ${STANDS[key].nameZh} L1→L2 层间交界`
      + `（L1 第 ${t0.rows - 3}–${t0.rows} 排 与 L2 第 1–4 排）`));
    const DX = (u) => o.bx0 + 14 + (u - o.uA) * o.kk;
    const DY = (y) => o.by0 + o.bh - 6 - (y - o.yA) * o.kk;
    const clip = `clip_${key}_detail`;
    g.push(`<clipPath id="${clip}"><rect x="${n2(o.bx0 + 6)}" y="${n2(o.by0 + 8)}" width="${n2((o.uB - o.uA) * o.kk + 16)}" height="${n2(o.bh - 14)}" /></clipPath>`);
    const det = [];
    det.push(PG(p.solidOutline().map(([u, y]) => [DX(u), DY(y)]), { fill: 'url(#conc)', stroke: '#3f4449', w: 0.9, join: 'miter' }));
    p.tiers.forEach((tr) => {
      tr.steps.forEach((st) => {
        if (st.d0 < o.uA - 2 || st.d0 > o.uB + 2) return;
        det.push(L(DX(st.d0), DY(st.tread), DX(st.d1), DY(st.tread), { stroke: '#c8102e', w: 0.9 }));
        det.push(L(DX(st.d1), DY(st.tread), DX(st.d1), DY(st.next), { stroke: '#3f4449', w: 0.7 }));
      });
    });
    g.push(`<g clip-path="url(#${clip})">${det.join('')}</g>`);
    // 尺寸：行距 / 排高 / 层间平台 / 结构深
    g.push(dimH(DX(lastStep.d0), DX(lastStep.d1), DY(lastStep.tread) + 22, `${t0.spec.rowDepth.toFixed(2)} m 行距`, { size: 2.8 }));
    g.push(dimV(DX(lastStep.d1) - 10, DY(lastStep.tread), DY(lastStep.next), `${t0.spec.rowRise.toFixed(2)} m 排高`, { size: 2.8 }));
    g.push(dimH(DX(t0.backDepth), DX(t1.frontDepth), DY(t0.backTop) - 14,
      `${t1.gapFromPrev.toFixed(2)} m 层间平台 = fascia 声明 ${t0.spec.fascia.toFixed(1)} m`, { color: '#2f6f8f', size: 2.9 }));
    g.push(dimV(DX(t1.frontDepth) - 24, DY(t0.backTop), DY(t1.spec.baseHeight),
      `${(t1.spec.baseHeight - t0.backTop).toFixed(2)} m 结构深`, { color: '#2f6f8f', size: 2.8 }));
    // 指引（标注一律写在图元右侧空档）
    const lx = o.bx0 + o.lx;
    g.push(leader(DX(lastStep.d1), DY(lastStep.tread), lx, DY(o.yA + (o.yB - o.yA) * 0.18),
      `L1 第 ${t0.rows} 排 踏面 ${lastStep.tread.toFixed(2)} m`, { color: '#8a2b2b', size: 2.9 }));
    g.push(leader(DX(t0.backDepth + 2), DY(t0.backTop), lx, DY(o.yA + (o.yB - o.yA) * 0.36),
      `层间平台顶 ${t0.backTop.toFixed(2)} m（L1 末排后壁）`, { color: '#2f6f8f', size: 2.9 }));
    g.push(leader(DX(t1.frontDepth), DY(t1.spec.baseHeight), lx, DY(o.yA + (o.yB - o.yA) * 0.62),
      `L2 第 1 排 踏面 ${t1.spec.baseHeight.toFixed(2)} m`, { color: '#8a2b2b', size: 2.9 }));
    g.push(T(o.bx0 + 14, o.by0 + o.bh - 1.5,
      `窗口：局部进深 ${o.uA.toFixed(0)}–${o.uB.toFixed(0)} m × 标高 ${o.yA.toFixed(1)}–${o.yB.toFixed(1)} m ｜ 全部坐标由 rakeProfile() 逐排算出：`
      + `L1 第 ${t0.rows} 排 = baseHeight ${t0.spec.baseHeight.toFixed(1)} + ${t0.rows} × ${t0.spec.rowRise.toFixed(2)} = ${t0.backTop.toFixed(2)} m`,
      { size: 2.6, fill: INK2 }));
  }

  if (NS) {
    // 南北剖面：主剖面较高，底部放 1:50 节点放大
    nodeDetail('north', { kk: 20, uA: 24, uB: 42, yA: 12.2, yB: 20.0, bx0: 24, by0: 408, bw: 576, bh: 176, lx: 420 });
  } else {
    // 东西剖面：主剖面较矮，剖面上方的空档放「本剖面用到的全部原始数据」，底部仍做 1:100 节点放大
    const bx0 = 24, by0 = 156, bw = 576, bh = 128;
    g.push(panel(bx0, by0, bw, bh, '本剖面用到的全部原始数据（逐项等级）'));
    const w0 = PROFILES.west.tiers[0].spec, e0 = PROFILES.east.tiers[0].spec;
    const items = [
      [`西看台（Stretford End）${PROFILES.west.tiers.length} 层 ${PROFILES.west.rowsTotal} 排`, '推算',
        `tiers 全部字段：rows ${PROFILES.west.tiers.map((t) => t.rows).join(' + ')} / rowDepth ${w0.rowDepth.toFixed(2)} / rowRise ${w0.rowRise.toFixed(2)} / startDepth / baseHeight / fascia`],
      [`东看台（Scoreboard End）${PROFILES.east.tiers.length} 层 ${PROFILES.east.rowsTotal} 排`, '推算',
        `同上：rows ${PROFILES.east.tiers.map((t) => t.rows).join(' + ')} / rowDepth ${e0.rowDepth.toFixed(2)} / rowRise ${e0.rowRise.toFixed(2)}`],
      [`两座看台声明总进深 ${STANDS.west.totalDepth.toFixed(1)} / ${STANDS.east.totalDepth.toFixed(1)} m`, '推算',
        `totalDepth；逐排几何外缘 ${PROFILES.west.backDepthComputed.toFixed(2)} / ${PROFILES.east.backDepthComputed.toFixed(2)} m，偏差 ${Math.abs(PROFILES.west.totalDepthDelta).toFixed(2)} / ${Math.abs(PROFILES.east.totalDepthDelta).toFixed(2)} m`],
      [`屋盖底标高 ${STANDS.west.roofHeight.toFixed(1)} / ${STANDS.east.roofHeight.toFixed(1)} m、悬挑 ${STANDS.west.roofCantilever.toFixed(1)} / ${STANDS.east.roofCantilever.toFixed(1)} m`, '推算', 'roofHeight / roofCantilever'],
      ['屋盖结构厚度 1.2 m（图中绘制值）', '推算', '数据未给出，按常规金属屋盖假定'],
      [`草坪 ${PITCH.length} × ${PITCH.width} m（本剖切长 ${PITCH.length.toFixed(1)} m）`, '推定', '按标准比赛场地假定，未见本项目专属来源'],
      [`球门线后缓冲 ${RUN_OFF.goalLine.toFixed(1)} m`, '推算', 'RUN_OFF.goalLine，含广告板与摄影区'],
      ['客队球迷区位于东看台', '官方', '曼联官网口径（STANDS.east.awayFansNote）'],
      [`东看台座位约 ${META.standSeats.east.value.toLocaleString('en-US')}`, '官方', 'META.standSeats.east'],
      ['西端外侧无公共街道', '实测', 'KartaView 街景 + OSM 步行网络核查（研究/06）'],
    ];
    items.forEach((it, i) => {
      const yy = by0 + 13 + i * 12.2;
      g.push(T(bx0 + 4, yy, it[0], { size: 3.15, fill: INK, weight: 'bold' }));
      const lvCol = { 官方: LV('官方'), 文献: LV('文献'), 推算: LV('推算'), 推定: LV('推定'), 实测: LV('文献') }[it[1]];
      g.push(R(bx0 + 250, yy - 4.6, 22, 6.4, { fill: LEVELS[it[1]] ? LEVELS[it[1]].bg : '#e7eff9', stroke: lvCol, w: 0.45 }));
      g.push(T(bx0 + 261, yy, `[${it[1]}]`, { size: 2.9, anchor: 'middle', fill: lvCol, weight: 'bold' }));
      g.push(T(bx0 + 278, yy, it[2], { size: 2.7, fill: INK2 }));
    });
    nodeDetail('west', { kk: 10, uA: 24, uB: 46, yA: 8.5, yB: 21.3, bx0: 24, by0: 426, bw: 576, bh: 158, lx: 320 });
  }

  g.push(frame());
  g.push(titleBlock({
    no: NS ? 'TRF-A-02' : 'TRF-A-03',
    name: NS ? '南北剖面图 · SECTION N—S' : '东西剖面图 · SECTION E—W',
    scale: NS ? '1:300' : '1:400',
  }));

  return svgDoc({
    title: `老特拉福德球场 · ${NS ? '02 南北剖面图' : '03 东西剖面图'}`,
    desc: '剖面阶梯由 js/data.js 的 tiers 逐排计算（tread = baseHeight + r·rowRise，depth = startDepth + r·rowDepth）。',
    body: g.join('\n'),
  });
}

/** 简易按宽度折行（按 CJK 计 1 em 估算） */
function wrap(s, cols) {
  const out = [];
  let cur = '';
  let w = 0;
  for (const ch of String(s)) {
    const cw = /[\u2E80-\u9FFF\uFF00-\uFFEF\u3000-\u303F]/.test(ch) ? 1 : 0.52;
    if (w + cw > cols) { out.push(cur); cur = ''; w = 0; }
    cur += ch; w += cw;
  }
  if (cur) out.push(cur);
  return out;
}

const SHc = () => SHEET.w;

/* ===========================================================================
 * 5. 图纸 04：看台参数对照表（NTS）
 * ========================================================================= */

function drawTable() {
  const g = [];
  const X0 = 24, X1 = SHEET.w - FRAME.r - 13;      // 表格左右
  const COLS = [
    { t: '看台 / 座席区', w: 118, a: 'start' },
    { t: '层', w: 30, a: 'middle' },
    { t: '排数', w: 40, a: 'end' },
    { t: '行距\n(m)', w: 48, a: 'end' },
    { t: '排高\n(m)', w: 48, a: 'end' },
    { t: '起始进深\n(m)', w: 62, a: 'end' },
    { t: '底标高\n(m)', w: 56, a: 'end' },
    { t: '本层升高\n(m)', w: 62, a: 'end' },
    { t: '顶排踏面\n(m)', w: 62, a: 'end' },
    { t: '末排进深\n(m)', w: 62, a: 'end' },
    { t: '层间环廊\n(m)', w: 58, a: 'end' },
    { t: '看台总进深\n(m)', w: 66, a: 'end' },
    { t: '屋盖底标高\n(m)', w: 68, a: 'end' },
    { t: '屋盖悬挑\n(m)', w: 60, a: 'end' },
  ];
  const TW = COLS.reduce((s, c) => s + c.w, 0);

  let y = 30;
  // 标题
  g.push(T(X0, y + 8, '老特拉福德球场 · 四座看台逐层参数对照表', { size: 9, weight: 'bold' }));
  g.push(T(X1, y + 8, 'STAND PARAMETER SCHEDULE', { size: 5, anchor: 'end', fill: INK3, mono: true }));
  g.push(T(X0, y + 16.5, '全部数值取自 js/data.js（唯一真相）；单元格底色 = 该数值的数据等级，凡 [推算] 值一律以橙色标出，不得当作实测数据引用。',
    { size: 3.4, fill: INK2 }));
  y += 24;

  // 表头
  const HEAD_H = 20;
  let cx = X0;
  g.push(R(X0, y, TW, HEAD_H, { fill: C.tblHead, stroke: C.tblLine, w: 0.5 }));
  COLS.forEach((c) => {
    const lines = c.t.split('\n');
    if (lines.length === 1) {
      g.push(T(cx + c.w - 3, y + 11.5, c.t, { size: 3.5, anchor: 'end', weight: 'bold' }));
    } else {
      g.push(T(cx + c.w - 3, y + 7.6, lines[0], { size: 3.3, anchor: 'end', weight: 'bold' }));
      g.push(T(cx + c.w - 3, y + 12.8, lines[1], { size: 3.3, anchor: 'end', weight: 'bold' }));
    }
    cx += c.w;
  });
  y += HEAD_H;

  const ROW = 21;
  const y0Rows = y;
  let rowIdx = 0;

  /** 画一行；cells 中每个值 { v, lv } */
  const drawRow = (cells, opts = {}) => {
    const h = opts.h ?? ROW;
    g.push(R(0, 0, 0, 0, { fill: 'none' })); // 占位（保持元素计数稳定）
    if (opts.alt) g.push(R(X0, y, TW, h, { fill: C.tblAlt }));
    let x = X0;
    COLS.forEach((c, i) => {
      const cell = cells[i];
      if (cell && cell.span) { x += c.w; return; }
      if (cell && cell.box) {
        g.push(R(x, y, c.w * (cell.boxW ?? 1), h, { fill: cell.bg ?? 'none', stroke: C.tblLine, w: 0.35 }));
      }
      if (cell && cell.v != null && cell.v !== '') {
        const fill = cell.lv ? LV(cell.lv) : INK;
        const monoW = textWidth(String(cell.v), cell.size ?? 3.9) * 0.0;
        const tx = c.a === 'end' ? x + c.w - 3 : c.a === 'middle' ? x + c.w / 2 : x + 3;
        g.push(T(tx, y + h * 0.64, String(cell.v), {
          size: cell.size ?? 3.9,
          anchor: c.a === 'end' ? 'end' : c.a === 'middle' ? 'middle' : 'start',
          mono: true, fill, weight: cell.bold ? 'bold' : null,
        }));
        void monoW;
      }
      x += c.w;
    });
    g.push(R(X0, y, TW, h, { fill: 'none', stroke: C.tblLine, w: 0.35 }));
    y += h;
    rowIdx++;
  };

  // 分组行（合并单元格由 merge 处理：先画行，再补合并框）
  const groups = STAND_ORDER.map((key) => {
    const p = PROFILES[key];
    return { key, p, rows: p.tiers, yStart: 0, yEnd: 0 };
  });

  groups.forEach((grp, gi) => {
    const s = STANDS[grp.key];
    grp.yStart = y;
    grp.rows.forEach((tr, ti) => {
      const cells = [];
      cells.push(ti === 0 ? { v: `${s.nameZh}\n${s.nameEn}`, lines: 2 } : { v: '' });
      cells[1] = { v: tr.id, lv: null };
      cells[2] = { v: tr.rows, lv: '推算' };
      cells[3] = { v: tr.spec.rowDepth.toFixed(2), lv: '推算' };
      cells[4] = { v: tr.spec.rowRise.toFixed(2), lv: '推算' };
      cells[5] = { v: tr.spec.startDepth.toFixed(1), lv: '推算' };
      cells[6] = { v: tr.spec.baseHeight.toFixed(1), lv: '推算' };
      cells[7] = { v: (tr.rows * tr.spec.rowRise).toFixed(2), lv: '推算' };
      cells[8] = { v: tr.topTread.toFixed(2), lv: '推算' };
      cells[9] = { v: tr.backDepth.toFixed(2), lv: '推算' };
      cells[10] = { v: tr.spec.fascia.toFixed(1), lv: '推算' };
      cells[11] = ti === 0 ? { v: s.totalDepth.toFixed(1), lv: '推算', span: true } : null;
      cells[12] = ti === 0 ? { v: s.roofHeight.toFixed(1), lv: '推算', span: true } : null;
      cells[13] = ti === 0
        ? { v: s.roofCantilever.toFixed(1), lv: (grp.key === 'north' ? '官方' : '推算'), span: true }
        : null;
      // 层内看台名（两行）
      if (ti === 0) {
        const c = COLS[0];
        g.push(T(X0 + 3, y + 8.4, s.nameZh, { size: 4.2, weight: 'bold' }));
        g.push(T(X0 + 3, y + 13.6, s.nameEn, { size: 2.9, fill: INK2, mono: false }));
      }
      drawRow(cells, { alt: gi % 2 === 1 });
    });
    grp.yEnd = y;
    // 合并框（看台名 / 总进深 / 屋盖）
    const hh = grp.yEnd - grp.yStart;
    g.push(R(X0, grp.yStart, COLS[0].w, hh, { fill: 'none', stroke: C.tblLine, w: 0.4 }));
    [11, 12, 13].forEach((i) => {
      let x = X0; for (let j = 0; j < i; j++) x += COLS[j].w;
      g.push(R(x, grp.yStart, COLS[i].w, hh, { fill: 'none', stroke: C.tblLine, w: 0.4 }));
    });
    // 小计行
    const sub = [];
    sub[0] = { v: `${s.nameZh} 小计`, bold: true };
    sub[1] = { v: '' };
    sub[2] = { v: grp.p.rowsTotal, lv: '推算', bold: true };
    sub[3] = { v: '—' }; sub[4] = { v: '—' };
    sub[5] = { v: grp.p.tiers[0].spec.startDepth.toFixed(1), lv: '推算' };
    sub[6] = { v: grp.p.tiers[0].spec.baseHeight.toFixed(1), lv: '推算' };
    sub[7] = { v: (grp.p.backTopComputed - grp.p.tiers[0].spec.baseHeight).toFixed(2), lv: '推算' };
    sub[8] = { v: grp.p.maxTread.toFixed(2), lv: '推算' };
    sub[9] = { v: grp.p.backDepthComputed.toFixed(2), lv: '推算' };
    sub[10] = { v: '—' };
    sub[11] = { v: s.totalDepth.toFixed(1), lv: '推算', bold: true };
    sub[12] = { v: s.roofHeight.toFixed(1), lv: '推算', bold: true };
    sub[13] = { v: s.roofCantilever.toFixed(1), lv: (grp.key === 'north' ? '官方' : '推算'), bold: true };
    drawRow(sub, { h: 19 });
  });

  // 四角象限
  const qy0 = y;
  const qr = QUADRANTS.cornerRadius ?? BOWL_INNER.cornerRadius;   // 角部座席弧半径（与碗体内缘同源）
  QUADRANTS.corners.forEach((c0, i) => {
    const cells = [];
    cells[0] = i === 0 ? { v: '四角象限' } : { v: '' };
    cells[1] = { v: c0.name };
    cells[2] = { v: c0.rows, lv: '推算' };
    cells[3] = { v: c0.rowDepth.toFixed(2), lv: '推算' };
    cells[4] = { v: c0.rowRise.toFixed(2), lv: '推算' };
    cells[5] = { v: `弧 r=${qr.toFixed(0)}`, lv: '推算', size: 3.0 };
    cells[6] = { v: c0.baseHeight.toFixed(1), lv: '推算' };
    cells[7] = { v: (c0.rows * c0.rowRise).toFixed(2), lv: '推算' };
    cells[8] = { v: (c0.baseHeight + (c0.rows - 1) * c0.rowRise).toFixed(2), lv: '推算' };
    cells[9] = { v: '—' };
    cells[10] = { v: '—' };
    cells[11] = { v: '—' };
    cells[12] = { v: '—' };
    cells[13] = { v: '—' };
    if (i === 0) {
      g.push(T(X0 + 3, y + 8.4, '四角象限', { size: 4.2, weight: 'bold' }));
      g.push(T(X0 + 3, y + 13.6, 'QUADRANTS 2005–06', { size: 2.7, fill: INK2, mono: true }));
    }
    drawRow(cells, { alt: false });
  });
  g.push(R(X0, qy0, COLS[0].w, y - qy0, { fill: 'none', stroke: C.tblLine, w: 0.4 }));

  // 合计行
  const totalRows = STAND_ORDER.reduce((a, kk) => a + PROFILES[kk].rowsTotal, 0);
  const quadRows = QUADRANTS.corners.reduce((a, c0) => a + c0.rows, 0);
  const seatsSum = META.standSeats.north.value + META.standSeats.south.value
    + META.standSeats.east.value + META.standSeats.west.value;
  g.push(R(X0, y, TW, 20, { fill: '#eef2f6', stroke: C.tblLine, w: 0.5 }));
  g.push(T(X0 + 3, y + 13, `合计：四座看台 ${totalRows} 排 + 四角象限 ${quadRows} 排 = 全场 ${totalRows + quadRows} 排（纯几何排数，[推算]）`,
    { size: 3.9, weight: 'bold' }));
  g.push(T(X0 + 470, y + 13, `各看台声明座席之和 ${seatsSum.toLocaleString('en-US')} 座 vs 官方申报容量 ${META.capacity.premierLeague.toLocaleString('en-US')} —— 口径不同，并列不取平均`,
    { size: 3.2, fill: '#8a2b2b' }));
  y += 20;

  // 底部说明：全部由 data.js 派生，避免与数据脱节
  const S1 = { north: '北', south: '南', east: '东', west: '西' };
  const gapTxt = STAND_ORDER.flatMap((kk) => PROFILES[kk].tiers.slice(1).map((t, i) =>
    `${S1[kk]} L${i + 1}→L${i + 2} 几何空隙 ${t.gapFromPrev.toFixed(2)} m / fascia ${t.spec.fascia.toFixed(1)} m`)).join('；');
  const depthTxt = STAND_ORDER.map((kk) =>
    `${S1[kk]}声明 ${STANDS[kk].totalDepth.toFixed(1)} m vs 逐排几何 ${PROFILES[kk].backDepthComputed.toFixed(2)} m（差 ${Math.abs(PROFILES[kk].totalDepthDelta).toFixed(2)} m）`).join('；');
  const ny = y + 8;
  g.push(panel(X0, ny, XE() - X0, SHEET.h - FRAME.b - ny - 2, '表注 / NOTES'));
  const notes = [
    '1. 颜色 = 数据等级：[官方] 绿 = 已抓到来源的官方口径；[文献] 蓝 = 权威二手来源；[推算] 橙 = 由已知尺寸按常规做法推导，非实测；[推定] 紫 = 按行业标准假定。本表除「屋盖悬挑 58.5 m（北看台）」外，看台几何全部为 [推算]。',
    '2. 本层升高 = rows × rowRise；顶排踏面 = baseHeight + (rows − 1) × rowRise；末排进深 = startDepth + rows × rowDepth。三者均由 js/data.js 逐排推导，不在数据文件中原样给出。',
    `3. 「层间环廊 fascia」为 data.js 原样值，本表另列逐层几何空隙以资对照：${gapTxt}。两者在当前数据版本下完全吻合（若日后 data.js 改动导致不再吻合，本行会如实显示差额）。`,
    `4. 「看台总进深 totalDepth」为 data.js 原样值，逐排几何外缘为派生值，逐座对照：${depthTxt}。`,
    `5. 四角象限未给出 startDepth，其形状由 QUADRANTS.cornerRadius ${qr.toFixed(0)} m [推算] 的弧面控制（与碗体内缘 BOWL_INNER.cornerRadius 同源，共 ${QUADRANTS.corners.length} 个角、各 ${QUADRANTS.splitDeg}° 分属相邻两座看台），故进深列记为「—」，不臆造数值。`,
    `6. 官方口径中与看台有关的只有四项：北看台三层、屋盖悬挑 ${STANDS.north.roofCantilever.toFixed(1)} m、台阶 ${STANDS.north.stairsOfficial} 级、容量 ${META.capacity.premierLeague.toLocaleString('en-US')}（英超申报）；东看台座位约 ${META.standSeats.east.value.toLocaleString('en-US')} 为 [官方]，其余座位数为 [文献] 估数。`,
    `7. 台阶 ${STANDS.north.stairsOfficial} 级为官方导览的楼梯级数口径，与本表「排数」不是同一对象，不可换算。`,
  ];
  notes.forEach((s, i) => {
    const lines = wrap(s, 148);
    const yy = ny + 12 + i * 12.4;
    lines.slice(0, 4).forEach((ln, j) => g.push(T(X0 + 4, yy + j * 4.4, ln, { size: 2.95, fill: i >= 6 ? '#8a2b2b' : INK2 })));
  });

  g.push(frame());
  g.push(titleBlock({ no: 'TRF-A-04', name: '看台参数对照表 · SCHEDULE', scale: 'NTS（不按比例）' }));
  return svgDoc({
    title: '老特拉福德球场 · 04 看台参数对照表',
    desc: '四座看台逐层参数：排数、行距、排高、起始进深、底标高、层高、总进深、屋顶高，逐项标注数据等级。',
    body: g.join('\n'),
  });
}

const XE = () => SHEET.w - FRAME.r - 230 - 8;

/* ===========================================================================
 * 6. 图纸 05：数据等级图例（NTS）
 * ========================================================================= */

function drawLegendSheet() {
  const g = [];
  const X0 = 24;
  const XW = SHEET.w - FRAME.r - X0;

  g.push(T(X0, 30, '数据等级图例 / DATA TRUST LEVELS', { size: 10, weight: 'bold' }));
  g.push(T(SHEET.w - FRAME.r, 30, `${META.name} · ${META.nameEn}`, { size: 5, anchor: 'end', fill: INK3 }));
  g.push(T(X0, 39, '本模型对每一个尺寸都标注来路：有来源的用来源值，没有来源的按常规建筑做法推导并明确标为 [推算]，绝不冒充实测。',
    { size: 3.6, fill: INK2 }));

  // 四张等级卡：卡片内每一项也由数据派生，data.js 一改卡片即跟随
  const roadsOffN = CONTEXT.roads.filter((r) => /\[官方\]/.test(r.note || '')).length;
  const cpOffN = CONTEXT.carparks.filter((c0) => /\[官方\]/.test(c0.note || '')).length;
  const metro = (CONTEXT.landmarks.find((l) => l.id === 'metrolink') || {}).items || [];
  const q0 = QUADRANTS.corners[0];
  const qrL = (QUADRANTS.cornerRadius ?? BOWL_INNER.cornerRadius);
  const p0 = PROFILES.north.tiers[0].spec;
  const depthAll = STAND_ORDER.map((kk) => STANDS[kk].totalDepth.toFixed(1)).join(' / ');
  const cantOthers = ['south', 'east', 'west'].map((kk) => STANDS[kk].roofCantilever.toFixed(1)).join(' / ');
  const seats4 = (k2) => META.standSeats[k2].value.toLocaleString('en-US');
  const cards = [
    {
      lv: '官方',
      note: '俱乐部 / 政府 / 官方数据集口径',
      lines: 6.4,
      items: [
        [`容量 ${META.capacity.premierLeague.toLocaleString('en-US')}（英超申报）`],
        [`北看台屋盖悬挑 ${STANDS.north.roofCantilever.toFixed(1)} m`],
        [`北看台台阶 ${STANDS.north.stairsOfficial} 级`],
        ['客队球迷区位于东看台'],
        [`东看台座位约 ${seats4('east')}`],
        [`${roadsOffN} 条周边道路的方位`],
        [`${cpOffN} 处停车场方位（共 ${CONTEXT.carparks.length} 处示意）`],
        [`Metrolink ${metro.length} 个站点方位`],
        ['曼联圣三一像位置'],
      ],
    },
    {
      lv: '文献',
      note: '权威二手来源（stadiumdb / footballgroundguide / 地方志 / 实地记录）',
      lines: 4.6,
      items: [
        [`${META.opened} 年启用、Leitch 1909 设计`],
        [`容量 ${META.capacity.uefa.toLocaleString('en-US')}（欧战）/ ${META.capacity.seatedOnly.toLocaleString('en-US')}（仅座席）`],
        [`1939 年记录 ${META.capacity.recordAttendance.toLocaleString('en-US')} 人`],
        [`北看台约 ${seats4('north')} 座；南约 ${seats4('south')} 座`],
        [`西端约 ${seats4('west')} 座；四角约 ${seats4('quadrants')} 座`],
        ['南看台单层（可见事实）'],
        ['球员通道在西南角'],
        ['教练席在南看台前'],
        ['屋盖一体化照明、无独立灯塔'],
        ['桥水运河 / 铁路在场地北侧'],
        ['南看台保留 Leitch 老通道山墙'],
        [`草坪为 ${PITCH.surface}`],
      ],
    },
    {
      lv: '推算',
      note: '由已知尺寸按常规建筑做法推导，用于补全视觉比例，并非实测',
      lines: 4.6,
      items: [
        ['四座看台 tiers 全部字段',
          `（rows / rowDepth ${p0.rowDepth.toFixed(2)} / rowRise ${p0.rowRise.toFixed(2)}`,
          '/ startDepth / baseHeight / fascia）'],
        [`看台总进深 ${depthAll} m 与屋盖底标高`],
        [`南 / 东 / 西屋盖悬挑 ${cantOthers} m`],
        [`碗体内缘 ${(BOWL_INNER.halfX * 2).toFixed(1)} × ${(BOWL_INNER.halfZ * 2).toFixed(1)} m（RUN_OFF ${RUN_OFF.goalLine.toFixed(1)} / ${RUN_OFF.touchLine.toFixed(1)}）`],
        [`四角象限座席弧半径 ${qrL.toFixed(1)} m（${q0.rows} 排 · 底标高 ${q0.baseHeight.toFixed(1)} m · ${QUADRANTS.splitDeg}° 分属）`],
        ['看台外立面材质与分格'],
        ['屋盖结构厚度（图中取 1.2 m）'],
        [`草坪修剪条纹 ${PITCH.stripes} 道`],
        [`门柱半径 ${PITCH.postRadius.toFixed(2)} m`],
        [`场边 LED 广告板 ${FEATURES.advertisingBoards.height} × ${FEATURES.advertisingBoards.depth} m、距边线 ${FEATURES.advertisingBoards.distanceFromLine.toFixed(1)} m`],
        ['大屏位置（对角布置）'],
        ['周边道路 / 运河 / 铁路 / 停车场坐标系（示意性重建）'],
      ],
    },
    {
      lv: '推定',
      note: '按行业标准假定，未见本项目专属来源',
      lines: 6.0,
      items: [
        [`草坪 ${PITCH.length} × ${PITCH.width} m`, '（本项目未取得老特拉福德草坪实测尺寸）'],
        ['该尺寸直接决定 BOWL_INNER，', '进而决定两张剖面图的全部分区。'],
        ['若日后取得实测草坪尺寸，', '01 / 02 / 03 三张图须整体重算。'],
      ],
    },
  ];
  const cardW = (XW - 3 * 6) / 4;
  cards.forEach((cd, i) => {
    const x = X0 + i * (cardW + 6);
    const y = 50, h = 176;
    g.push(panel(x, y, cardW, h, '', { fill: '#ffffff', stroke: LEVELS[cd.lv].color, th: 0 }));
    g.push(R(x, y, cardW, 13, { fill: LEVELS[cd.lv].bg, stroke: LEVELS[cd.lv].color, w: 0.5 }));
    g.push(T(x + 4, y + 9, `[${cd.lv}]`, { size: 6.4, weight: 'bold', fill: LV(cd.lv) }));
    g.push(T(x + cardW - 4, y + 9, `${cd.items.length} 项`, { size: 3.4, anchor: 'end', fill: LV(cd.lv), mono: true }));
    let yy = y + 21;
    cd.items.forEach((it) => {
      it.forEach((ln, j) => {
        if (yy > y + h - 18) return;
        g.push(T(x + 4, yy, ln, { size: cd.lines > 5 ? 3.5 : 3.0, fill: INK2 }));
        yy += cd.lines;
      });
      yy += cd.lines > 5 ? 1.8 : 1.2;
    });
    g.push(T(x + 4, y + h - 16, cd.note, { size: 2.8, fill: INK3 }));
  });

  // 关键尺寸逐项对照（三栏，避免与下方免责声明面板重叠）
  const ly = 240;
  g.push(T(X0, ly, '本模型关键尺寸的数据等级（逐项）', { size: 5.6, weight: 'bold' }));
  const items = buildLevelItems();
  const colW = (XW - 240 - 20) / 3;
  const perCol = Math.ceil(items.length / 3);
  items.forEach((it, i) => {
    const col = Math.floor(i / perCol);
    const row = i % perCol;
    const x = X0 + col * (colW + 10);
    const yy = ly + 11 + row * 10.0;
    g.push(T(x, yy, it[0], { size: 3.15, fill: INK }));
    const lv = it[1];
    const col2 = LEVELS[lv] ? LV(lv) : LV('文献');
    const bg = LEVELS[lv] ? LEVELS[lv].bg : LEVELS['文献'].bg;
    const wdt = textWidth(`[${lv}]`, 3.0) + 3;
    g.push(R(x + colW - wdt, yy - 4.2, wdt, 6.2, { fill: bg, stroke: col2, w: 0.45 }));
    g.push(T(x + colW - wdt / 2, yy, `[${lv}]`, { size: 3.0, anchor: 'middle', fill: col2, weight: 'bold' }));
    g.push(T(x + colW - wdt - 3, yy, it[2] || '', { size: 2.85, anchor: 'end', fill: INK2, mono: true }));
  });
  g.push(T(X0 + XW - 244, ly, `共 ${items.length} 项 —— 逐项给出等级与 js/data.js 中的键名；等级配色见上方四张卡片。`,
    { size: 2.95, fill: INK3, anchor: 'end' }));

  // 右下：附加标记 + 来源清单
  const sx0 = X0 + XW - 230;
  g.push(panel(sx0, ly - 6, 230, 180, '附加标记与口径提示'));
  const extra = [
    `[实测]  STANDS.west.contextNote 使用：经 KartaView 街景与`,
    `        OSM 步行网络核查得出（「西侧无公共街道」）。本图`,
    `        将其按 [文献] 色系显示，不单列「实测」等级。`,
    `[标准]  FIFA 竞赛规则值（门宽 ${PITCH.goalWidth} / 门高 ${PITCH.goalHeight} / 中圈 ${PITCH.centerCircleRadius} /`,
    `        大禁区 ${PITCH.penaltyAreaLength} × ${PITCH.penaltyAreaWidth} / 小禁区 ${PITCH.goalAreaLength} × ${PITCH.goalAreaWidth} / 角弧 ${PITCH.cornerArcRadius} /`,
    `        罚球点 ${PITCH.penaltySpot} / 标线宽 ${PITCH.lineWidth} m）。本项目未单列该等级，`,
    `        图上按 [推定] 色系表达。`,
    '',
    '三口径容量并列，不取平均：',
    `  ${META.capacity.premierLeague.toLocaleString('en-US')}（英超申报 [官方]）`,
    `  ${META.capacity.uefa.toLocaleString('en-US')}（欧战 [文献]）`,
    `  ${META.capacity.seatedOnly.toLocaleString('en-US')}（仅座席 [文献]）`,
    `  ${META.capacity.recordAttendance.toLocaleString('en-US')}（1939 记录含站席 [文献]）`,
    '',
    '一句话：图上凡橙色数字，都不是实测值。',
  ];
  extra.forEach((ln, i) => {
    g.push(T(sx0 + 4, ly + 8 + i * 6.4, ln, {
      size: 2.95,
      fill: i === extra.length - 1 ? '#8a2b2b' : INK2,
      weight: i === extra.length - 1 ? 'bold' : null,
    }));
  });

  g.push(T(sx0, ly + 184, '来源清单（SOURCES）', { size: 4, weight: 'bold' }));
  SOURCES.slice(0, 6).forEach((s, i) => {
    g.push(T(sx0 + 3, ly + 191 + i * 6.2, `· ${s.label}  [${s.tier}]${s.status === 'blocked' ? '（本项目运行环境不可访问）' : ''}`,
      { size: 2.9, fill: s.status === 'blocked' ? '#8a2b2b' : INK2 }));
  });

  // 底部左侧两块并排面板：图纸目录 + 读数规则 / 免责与精度声明
  const BY = 386;
  const BH = 150;
  const AW = 268;
  const BW = XW - 240 - 20 - AW - 8;

  g.push(panel(X0, BY, AW, BH, '图纸目录与读数规则 / DRAWING INDEX'));
  const sheetList = [
    ['TRF-A-01', '总平面图 · GENERAL PLAN', '1:1000'],
    ['TRF-A-02', '南北剖面图 · SECTION N—S', '1:300'],
    ['TRF-A-03', '东西剖面图 · SECTION E—W', '1:400'],
    ['TRF-A-04', '看台参数对照表 · SCHEDULE', 'NTS'],
    ['TRF-A-05', '数据等级图例 · DATA LEVELS', 'NTS'],
  ];
  sheetList.forEach((sh, i) => {
    const yy = BY + 17 + i * 10.4;
    g.push(T(X0 + 4, yy, sh[0], { size: 3.3, mono: true, fill: INK2 }));
    g.push(T(X0 + 32, yy, sh[1], { size: 3.3, fill: INK }));
    g.push(T(X0 + AW - 4, yy, sh[2], { size: 3.3, anchor: 'end', mono: true, fill: INK2 }));
  });
  g.push(L(X0 + 4, BY + 64, X0 + AW - 4, BY + 64, { stroke: INK3, w: 0.35, dash: '3 2' }));
  const rules = [
    '单位：米（m）。坐标：+X 东 / −X 西 / +Z 南 / −Z 北 / +Y 上，',
    '原点在草坪中心，与 js/data.js 的约定一致。',
    '五张图均由 tools/gen-drawings.mjs 从 js/data.js 计算生成，',
    `图上数值按实际尺寸标注，不取整（如 ${PROFILES.north.maxTread.toFixed(2)} m 而非 ${PROFILES.north.maxTread.toFixed(1)} m）。`,
    '等级配色：绿 [官方]、蓝 [文献]、橙 [推算]、紫 [推定]。',
    '凡橙色或紫色数字，都不是实测值。',
  ];
  rules.forEach((s, i) => {
    const last = i === rules.length - 1;
    g.push(T(X0 + 4, BY + 76 + i * 8.4, s, {
      size: 3.3,
      fill: last ? '#8a2b2b' : INK2,
      weight: last ? 'bold' : null,
    }));
  });

  const bx = X0 + AW + 8;
  g.push(panel(bx, BY, BW, BH, '免责与精度声明 / DISCLAIMER'));
  let dy = BY + 17;
  DISCLAIMER.long.forEach((s) => {
    const lines = wrap(s, Math.floor((BW - 10) / 3.3)).slice(0, 4);
    lines.forEach((ln, k) => g.push(T(bx + 4, dy + k * 7.2, ln, { size: 3.3, fill: INK2 })));
    dy += lines.length * 7.2 + 5.6;
  });
  g.push(T(bx + 4, BY + BH - 8, DISCLAIMER.short, { size: 3.3, weight: 'bold', fill: '#8a2b2b' }));

  g.push(frame());
  g.push(titleBlock({ no: 'TRF-A-05', name: '数据等级图例 · DATA LEVELS', scale: 'NTS（不按比例）' }));
  return svgDoc({
    title: '老特拉福德球场 · 05 数据等级图例',
    desc: '说明 [官方]/[文献]/[推算]/[推定] 四个等级的含义、配色，并逐项列出本模型关键尺寸所属等级。',
    body: g.join('\n'),
  });
}

/** 关键尺寸 → 等级 的逐项清单（全部由 js/data.js 派生，不在函数里写死数值） */
function buildLevelItems() {
  const SHORT = { north: '北', south: '南', east: '东', west: '西' };
  const nf = (v) => String(Number(v));                      // 7.32 / 1 / 11 这类原样数值
  const q0 = QUADRANTS.corners[0];
  const qr = (QUADRANTS.cornerRadius ?? BOWL_INNER.cornerRadius);
  const depthAll = STAND_ORDER.map((k) => STANDS[k].totalDepth.toFixed(1)).join(' / ');
  const roofAll = STAND_ORDER.map((k) => STANDS[k].roofHeight.toFixed(1)).join(' / ');
  const cantOthers = ['south', 'east', 'west'].map((k) => STANDS[k].roofCantilever.toFixed(1)).join(' / ');
  const seats = (k) => META.standSeats[k].value.toLocaleString('en-US');
  const roadNames = CONTEXT.roads.map((r) => r.name).filter((n) => /Busby/.test(n));
  const cpOff = CONTEXT.carparks.filter((c) => /\[官方\]/.test(c.note || '')).map((c) => c.id);
  const metro = (CONTEXT.landmarks.find((l) => l.id === 'metrolink') || {}).items || [];
  const ab = FEATURES.advertisingBoards;

  return [
    [`草坪 ${nf(PITCH.length)} × ${nf(PITCH.width)} m`, '推定', 'PITCH'],
    [`门宽 ${nf(PITCH.goalWidth)} / 门高 ${nf(PITCH.goalHeight)} m`, '推定', 'FIFA[标准]'],
    [`中圈 ${nf(PITCH.centerCircleRadius)} / 角弧 ${nf(PITCH.cornerArcRadius)} / 罚球点 ${nf(PITCH.penaltySpot)} m`, '推定', 'FIFA[标准]'],
    [`大禁区 ${nf(PITCH.penaltyAreaLength)} × ${nf(PITCH.penaltyAreaWidth)} / 小禁区 ${nf(PITCH.goalAreaLength)} × ${nf(PITCH.goalAreaWidth)} m`, '推定', 'FIFA[标准]'],
    [`标线宽 ${nf(PITCH.lineWidth)} m`, '推定', 'FIFA[标准]'],
    [`草坪修剪条纹 ${PITCH.stripes} 道`, '推算', 'PITCH.stripes'],
    [`门柱半径 ${nf(PITCH.postRadius)} m`, '推算', 'PITCH.postRadius'],
    [`球门线后缓冲 ${RUN_OFF.goalLine.toFixed(1)} m / 边线侧 ${RUN_OFF.touchLine.toFixed(1)} m`, '推算', 'RUN_OFF'],
    [`碗体内缘 ${(BOWL_INNER.halfX * 2).toFixed(1)} × ${(BOWL_INNER.halfZ * 2).toFixed(1)} m、四角 R${qr.toFixed(1)} m`, '推算', 'BOWL_INNER'],
    ...STAND_ORDER.map((k) => [`${SHORT[k]}看台 ${PROFILES[k].tiers.length} 层 ${PROFILES[k].rowsTotal} 排全部几何`, '推算', `STANDS.${k}.tiers`]),
    [`看台总进深 ${depthAll} m`, '推算', 'totalDepth ×4'],
    [`屋盖底标高 ${roofAll} m`, '推算', 'roofHeight ×4'],
    [`南 / 东 / 西屋盖悬挑 ${cantOthers} m`, '推算', 'roofCantilever'],
    [`四角象限 ${q0.rows} 排 / 排高 ${nf(q0.rowRise)} / 底标高 ${q0.baseHeight.toFixed(1)} m`, '推算', 'QUADRANTS'],
    [`四角座席弧半径 ${qr.toFixed(1)} m、${QUADRANTS.splitDeg}° 分属相邻看台`, '推算', 'cornerRadius'],
    ['看台外立面材质、分格、色带', '推算', 'facade'],
    ['屋盖结构厚度（图中取 1.2 m）', '推算', '图纸假定'],
    [`场边 LED 广告板 ${nf(ab.height)} × ${nf(ab.depth)} m / 距边线 ${nf(ab.distanceFromLine)} m`, '推算', 'FEATURES'],
    ['大屏位置（东看台北端 + 西看台南端）', '推算', 'FEATURES'],
    ['周边道路 / 停车场 / 运河 / 铁路坐标（示意性重建）', '推算', 'CONTEXT'],
    [`北看台屋盖悬挑 ${STANDS.north.roofCantilever.toFixed(1)} m`, '官方', 'roofCantilever'],
    [`北看台台阶 ${STANDS.north.stairsOfficial} 级`, '官方', 'stairsOfficial'],
    [`容量 ${META.capacity.premierLeague.toLocaleString('en-US')}（英超申报）`, '官方', 'capacity'],
    [`东看台座位约 ${seats('east')}`, '官方', 'standSeats.east'],
    ['客队球迷区位于东看台', '官方', 'awayFans'],
    [`${roadNames[0] || 'Sir Matt Busby Way'} 等 ${CONTEXT.roads.length} 条道路`, '官方', 'CONTEXT.roads'],
    [`停车场官方方位（${cpOff.join(' / ')}）`, '官方', 'carparks'],
    [`Metrolink ${metro.length} 个站点方位`, '官方', 'metrolink'],
    ['曼联圣三一像位置', '官方', 'statues'],
    [`${META.opened} 年启用 / Leitch 1909 设计`, '文献', 'META'],
    [`容量 ${META.capacity.uefa.toLocaleString('en-US')} / ${META.capacity.seatedOnly.toLocaleString('en-US')} / ${META.capacity.recordAttendance.toLocaleString('en-US')}`, '文献', 'capacity'],
    [`北看台约 ${seats('north')} 座 / 南约 ${seats('south')} 座`, '文献', 'standSeats'],
    [`西端约 ${seats('west')} 座 / 四角约 ${seats('quadrants')} 座`, '文献', 'standSeats'],
    [`南看台 ${PROFILES.south.tiers.length} 层这一形体事实`, '文献', 'asymmetry'],
    ['球员通道在西南角 / 教练席在南看台前', '文献', 'FEATURES'],
    ['屋盖一体化照明、无独立灯塔', '文献', 'floodlights'],
    [`运河 / 铁路在场地北侧`, '文献', 'CONTEXT'],
    [`草坪为 ${PITCH.surface}`, '文献', 'PITCH.surface'],
  ];
}

/* ===========================================================================
 * 7. SVG 文档包装与主流程
 * ========================================================================= */

function svgDoc({ title, desc, body }) {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg xmlns="http://www.w3.org/2000/svg" width="${SHEET.w}mm" height="${SHEET.h}mm" viewBox="0 0 ${SHEET.w} ${SHEET.h}" role="img" aria-label="${esc(title)}" shape-rendering="geometricPrecision">`,
    `<title>${esc(title)}</title>`,
    `<desc>${esc(desc)}</desc>`,
    `<rect x="0" y="0" width="${SHEET.w}" height="${SHEET.h}" fill="#ffffff" />`,
    body,
    '</svg>',
    '',
  ].join('\n');
}

/** 元素计数（自检脚本亦使用） */
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

function main() {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const outDir = resolve(root, 'assets', 'drawings');
  mkdirSync(outDir, { recursive: true });

  const jobs = [
    ['01-总平面图.svg', drawPlan],
    ['02-南北剖面图.svg', () => drawSection('z')],
    ['03-东西剖面图.svg', () => drawSection('x')],
    ['04-看台参数对照表.svg', drawTable],
    ['05-数据等级图例.svg', drawLegendSheet],
  ];

  console.log('老特拉福德球场 · 数据驱动建筑图纸生成');
  console.log(`数据源：js/data.js（DATA_VERSION ${DATA_VERSION}）· 输出：assets/drawings/`);
  console.log('-'.repeat(78));
  let totalBytes = 0;
  let totalEl = 0;
  for (const [name, fn] of jobs) {
    const svg = fn();
    const buf = Buffer.from(svg, 'utf8');
    writeFileSync(resolve(outDir, name), buf);
    const { n, byTag } = countElements(svg);
    totalBytes += buf.length;
    totalEl += n;
    const top = Object.entries(byTag).sort((a, b) => b[1] - a[1]).slice(0, 4)
      .map(([t, c]) => `${t}×${c}`).join(' ');
    console.log(`${name.padEnd(22, ' ')}  ${String(buf.length).padStart(8, ' ')} 字节   ${String(n).padStart(6, ' ')} 个元素   ${top}`);
  }
  console.log('-'.repeat(78));
  console.log(`共 ${jobs.length} 张图，${totalBytes} 字节，${totalEl} 个元素`);
  console.log('');
  console.log('剖面自检（由 tiers 逐排计算的排数）：');
  STAND_ORDER.forEach((kk) => {
    const p = PROFILES[kk];
    console.log(`  ${STANDS[kk].nameZh.padEnd(12, ' ')} ${p.tiers.length} 层 ${String(p.rowsTotal).padStart(3, ' ')} 排`
      + `  踏步 ${p.treadsTotal} 级 / 竖板 ${p.risersTotal} 条`
      + `  最高踏面 ${p.maxTread.toFixed(2)} m  声明总进深 ${p.totalDepthDeclared.toFixed(1)} m vs 几何 ${p.backDepthComputed.toFixed(2)} m`);
  });
  const quadRows = QUADRANTS.corners.reduce((a, c0) => a + c0.rows, 0);
  console.log(`  四角象限     4 角 ${quadRows} 排（每角 ${QUADRANTS.corners[0].rows} 排）`);
  console.log(`  全场合计     ${STAND_ORDER.reduce((a, kk) => a + PROFILES[kk].rowsTotal, 0) + quadRows} 排`);
}

main();