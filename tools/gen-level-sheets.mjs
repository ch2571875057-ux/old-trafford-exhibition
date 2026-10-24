#!/usr/bin/env node
/**
 * ===========================================================================
 * tools/gen-level-sheets.mjs —— 老特拉福德球场「各层平面图 + 逐层剖面图」生成器
 * ---------------------------------------------------------------------------
 * 由来：体育场建模复现范式.docx 第 1 章要求 12 张输入图纸（屋面平面、看台平面、
 *       一层~五层平面、立面 ×3、剖面、剖透视），第 2 章要求一张参数总表。
 *       既有 tools/gen-drawings.mjs 已交付 01 总平面 / 02 南北剖面 / 03 东西剖面 /
 *       04 看台参数表 / 05 数据等级图例；本脚本补足「每一层的平面图与剖面图」。
 *
 * 输入：../js/data.js（唯一真相，只读，本脚本绝不修改它）
 * 输出：../assets/drawings/06 … 12
 *
 * 设计约束（与 gen-drawings.mjs 完全一致）
 *   1) 零依赖：仅用 Node 内置模块 + 字符串拼接输出 SVG；
 *   2) SVG 内不得引用任何外部资源（无 http(s) 链接、无外链字体/图片/样式）；
 *   3) 平面/剖面的每一排、每一道尺寸都由 data.js 的 tiers 逐排算出，不得手写坐标；
 *   4) 所有关键尺寸在图上逐项标注数据等级 [官方]/[文献]/[推算]/[推定]。
 *
 * 图纸规格：ISO A1 横版 841 × 594 mm（1 用户单位 = 1 mm，viewBox 同尺寸）
 *   06 场地层平面图      ±0.00（剖切 +1.20）1:750
 *   07 首层看台平面图    F1 +2.20（剖切 +3.60）1:750
 *   08 中层环廊平面图    F2 +18.00（剖切 +19.40）1:750
 *   09 上层环廊平面图    F3 +33.20（剖切 +34.60）1:750
 *   10 屋面层平面图      RF +49.60 1:750（含屋盖悬挑两种口径对照）
 *   11 逐层剖面谱        四看台 1:500（含全部层段与剖切标高线）
 *   12 角部象限专项图    NE 角部平面 1:530 + 45° 对角剖面示意 1:650
 *
 * 剖切口径（全套图纸统一）
 *   各层平面的剖切标高 = 该层楼面标高 + 1.40 m（建筑制图常规做法：人眼高度）。
 *   层段后缘顶 ≤ 剖切标高 → 该层段在剖切面之下：「下部层段」浅填充 + 排纹理；
 *   层段前缘标高 > 剖切标高 → 该层段在剖切面之上：「上部层段」虚线轮廓、不填充；
 *   跨越剖切标高 → 剖切面切过该层段，按切到的进深画红色粗剖切线。
 *   注：1.40 m ÷ rowRise 0.42 × rowDepth 0.75 = 2.50 m，四座看台相同，故每条剖切线
 *       都落在「该层段内缘进深 + 2.50 m」处，可在图上与 B 表逐项核对。
 * ===========================================================================
 */

import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** 载入 js/data.js（唯一真相，只读）—— 与 gen-drawings.mjs 同法，容忍根目录无 package.json */
async function loadData() {
  if (hasModulePackageJson()) return import('../js/data.js');
  const src = readFileSync(new URL('../js/data.js', import.meta.url), 'utf8');
  if (!/export\s+(const|default|function|class)/.test(src)) return import('../js/data.js');
  return import(`data:text/javascript;charset=utf-8,${encodeURIComponent(src)}`);
}

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
  META, PITCH, BOWL_INNER, SEATING, STANDS, STAND_ORDER, QUADRANTS,
  FEATURES, CONTEXT, SOURCES, DISCLAIMER, DATA_VERSION,
} = DATA;

/* ===========================================================================
 * 0. 图纸常量与配色（与 gen-drawings.mjs 同一套）
 * ========================================================================= */

const SHEET = { w: 841, h: 594 };
const FRAME = { l: 20, r: 10, t: 10, b: 10 };

const INK = '#15181c';
const INK2 = '#5b636b';
const INK3 = '#8b939b';
const FRAME_C = '#0f1113';
const HAIR = '#b9bfc5';

const FONT =
  "'Microsoft YaHei','PingFang SC','Hiragino Sans GB','Noto Sans CJK SC',"
  + "'Source Han Sans SC','WenQuanYi Micro Hei',sans-serif";
const MONO = "'Cascadia Mono','Consolas','DejaVu Sans Mono','Courier New',monospace";

const LEVELS = {
  官方: { color: '#136c46', bg: '#e6f4ec', desc: '俱乐部 / 政府 / 官方数据集口径，已抓到来源' },
  文献: { color: '#17539b', bg: '#e7eff9', desc: '权威二手来源（stadiumdb / footballgroundguide / 地方志等）' },
  推算: { color: '#a85d00', bg: '#fdf0df', desc: '由已知尺寸按常规建筑做法推导，用于补全视觉比例，并非实测' },
  推定: { color: '#7b3ba0', bg: '#f3ebfa', desc: '按行业标准假定（如草坪 105×68），未见本项目专属来源' },
};
const LV = (k) => LEVELS[k].color;
const dimText = (v, unit, lv, d = 1) => `${v.toFixed(d)}${unit} [${lv}]`;

const C = {
  grass: '#eaf2e4', grassAlt: '#dcead3',
  stand: '#e6e2da', standEdge: '#5a6068',
  quad: '#f4ecdd', quadEdge: '#8a7d64',
  pitchMark: '#2c3630',
  road: '#ececee', roadEdge: '#9aa0a6', park: '#f1efe9', parkEdge: '#9c968a',
  water: '#d3e6ee', waterEdge: '#5d8fa3',
  rail: '#dcdcdf', railEdge: '#6d7076',
  dim: '#1668b3', cut: '#c8102e',
  roof: '#c9cfd6', roofEdge: '#5b6169',
  tblHead: '#e9edf1', tblLine: '#aeb5bc', tblAlt: '#fafbfc',
  ringBelow: '#f1ece4', ringCut: '#e4dccf', ringAbove: '#fbfaf8',
  ringEdgeBelow: '#8d857c', ringEdgeAbove: '#b3aaa0',
  ground: '#eae6dd', groundEdge: '#9b938a', concourse: '#eae7e0',
  site: '#f7f5f1',
};

/* ===========================================================================
 * 1. 基础绘图工具（与 gen-drawings.mjs 同源，复制以保持零依赖）
 * ========================================================================= */

const n2 = (v) => (Math.round(v * 100) / 100).toString();

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function textWidth(s, size) {
  let w = 0;
  for (const ch of String(s)) {
    w += /[\u2E80-\u9FFF\uFF00-\uFFEF\u3000-\u303F]/.test(ch) ? 1.0 : 0.52;
  }
  return w * size;
}

function T(x, y, s, o = {}) {
  const a = [
    `x="${n2(x)}"`, `y="${n2(y)}"`,
    `font-size="${o.size ?? 3.4}"`,
    `fill="${o.fill ?? INK}"`,
    `text-anchor="${o.anchor ?? 'start'}"`,
    `font-family="${o.mono ? MONO : FONT}"`,
  ];
  if (o.weight) a.push(`font-weight="${o.weight}"`);
  if (o.opacity != null) a.push(`opacity="${o.opacity}"`);
  if (o.rotate) a.push(`transform="rotate(${o.rotate} ${n2(x)} ${n2(y)})"`);
  return `<text ${a.join(' ')}>${esc(s)}</text>`;
}

function TL(x, y, lines, o = {}) {
  const lh = o.lh ?? (o.size ?? 3.4) * 1.45;
  return lines.map((s, i) => T(x, y + i * lh, s, o)).join('');
}

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

function CI(cx, cy, r, o = {}) {
  const a = [`cx="${n2(cx)}"`, `cy="${n2(cy)}"`, `r="${n2(r)}"`, `fill="${o.fill ?? 'none'}"`];
  if (o.stroke !== 'none') a.push(`stroke="${o.stroke ?? 'none'}"`, `stroke-width="${o.w ?? 0.3}"`);
  if (o.dash) a.push(`stroke-dasharray="${o.dash}"`);
  return `<circle ${a.join(' ')} />`;
}

function P(d, o = {}) {
  const a = [`d="${d}"`, `fill="${o.fill ?? 'none'}"`];
  if (o.stroke !== 'none') a.push(`stroke="${o.stroke ?? 'none'}"`, `stroke-width="${o.w ?? 0.3}"`);
  if (o.dash) a.push(`stroke-dasharray="${o.dash}"`);
  if (o.join) a.push(`stroke-linejoin="${o.join}"`);
  if (o.opacity != null) a.push(`opacity="${o.opacity}"`);
  return `<path ${a.join(' ')} />`;
}

const dOf = (pts) => pts.map(([x, y], i) => `${i ? 'L' : 'M'}${n2(x)} ${n2(y)}`).join(' ');
const PL = (pts, o = {}) => P(dOf(pts), { ...o });
const PG = (pts, o = {}) => P(dOf(pts) + ' Z', o);

function mapper({ k, ox, oy, cx = 0, cy = 0, flipY = false }) {
  return {
    k,
    x: (wx) => ox + (wx - cx) * k,
    y: (wy) => (flipY ? oy - (wy - cy) * k : oy + (wy - cy) * k),
    len: (m) => m * k,
  };
}

function dimH(xa, xb, y, label, o = {}) {
  const c = o.color ?? C.dim;
  const s = [
    L(xa, y, xb, y, { stroke: c, w: o.w ?? 0.35 }),
    L(xa - 1.3, y + 1.3, xa + 1.3, y - 1.3, { stroke: c, w: 0.35 }),
    L(xb - 1.3, y + 1.3, xb + 1.3, y - 1.3, { stroke: c, w: 0.35 }),
  ];
  s.push(T((xa + xb) / 2, o.above === false ? y + (o.size ?? 3.2) + 1.0 : y - 1.5, label, {
    size: o.size ?? 3.2, anchor: 'middle', fill: c, weight: o.weight ?? 'bold', mono: true,
  }));
  return s.join('');
}

function dimV(x, yTop, yBot, label, o = {}) {
  const c = o.color ?? C.dim;
  const my = (yTop + yBot) / 2;
  const s = [
    L(x, yTop, x, yBot, { stroke: c, w: o.w ?? 0.35 }),
    L(x - 1.3, yTop + 1.3, x + 1.3, yTop - 1.3, { stroke: c, w: 0.35 }),
    L(x - 1.3, yBot + 1.3, x + 1.3, yBot - 1.3, { stroke: c, w: 0.35 }),
  ];
  s.push(T(o.side === 'right' ? x + 1.6 : x - 1.6, my, label, {
    size: o.size ?? 3.2, anchor: 'middle', fill: c, weight: o.weight ?? 'bold',
    mono: true, rotate: -90,
  }));
  return s.join('');
}

function leader(px0, py0, tx, ty, text, o = {}) {
  const c = o.color ?? INK;
  const mid = [o.mid ?? (tx - 6), ty];
  return [
    CI(px0, py0, o.dot ?? 0.7, { fill: c }),
    PL([[px0, py0], mid, [tx - 1, ty]], { stroke: c, w: 0.25 }),
    T(tx, ty + 1.2, text, { size: o.size ?? 3.1, fill: c, weight: o.weight, mono: o.mono ?? true }),
  ].join('');
}

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

function frame() {
  const { w, h } = SHEET;
  const x0 = FRAME.l, y0 = FRAME.t, x1 = w - FRAME.r, y1 = h - FRAME.b;
  const s = [
    R(x0, y0, x1 - x0, y1 - y0, { stroke: FRAME_C, w: 0.7 }),
    R(x0 - 2.5, y0 - 2.5, x1 - x0 + 5, y1 - y0 + 5, { stroke: HAIR, w: 0.25, dash: '6 3' }),
  ];
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

function titleBlock(info) {
  const w = 224, h = 84;
  const x = SHEET.w - FRAME.r - w;
  const y = SHEET.h - FRAME.b - h;
  const out = [];
  out.push(R(x, y, w, h, { fill: '#ffffff', stroke: FRAME_C, w: 0.7 }));

  out.push(R(x, y, w, 15, { fill: '#eceff2', stroke: FRAME_C, w: 0.5 }));
  out.push(T(x + 3, y + 6.4, `${META.name} · ${META.nameEn}`, { size: 5.2, weight: 'bold' }));
  out.push(T(x + 3, y + 12.4, '3D 展览「档案抽屉」· 数据驱动建筑图纸', { size: 3.1, fill: INK2 }));

  const y1 = y + 15, h1 = 20;
  out.push(R(x, y1, w, h1, { stroke: FRAME_C, w: 0.5 }));
  out.push(L(x + 34, y1, x + 34, y1 + h1, { stroke: FRAME_C, w: 0.5 }));
  out.push(T(x + 3, y1 + 6, '图名', { size: 3.2, fill: INK2 }));
  out.push(T(x + 3, y1 + 13.4, 'DRAWING', { size: 2.6, fill: INK3, mono: true }));
  out.push(T(x + 37, y1 + 13.4, info.name, { size: 7, weight: 'bold' }));

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

  const y3 = y2 + h2, h3 = h - 15 - h1 - h2;
  out.push(R(x, y3, w, h3, { stroke: FRAME_C, w: 0.5 }));
  out.push(T(x + 2.5, y3 + 5.4, `数据来源：js/data.js（DATA_VERSION ${DATA_VERSION}）· ${SOURCES.length} 条来源清单`, { size: 2.7, fill: INK2 }));
  out.push(T(x + 2.5, y3 + 10, DISCLAIMER.short, { size: 2.7, fill: '#8a2b2b' }));
  out.push(T(x + 2.5, y3 + 14.6, `生成：tools/gen-level-sheets.mjs · ${new Date().toISOString().slice(0, 10)}`, { size: 2.5, fill: INK3, mono: true }));
  return out.join('');
}

function northArrow(cx, cy, r) {
  return [
    CI(cx, cy, r * 1.22, { stroke: HAIR, w: 0.3 }),
    CI(cx, cy, r * 1.5, { stroke: HAIR, w: 0.3, dash: '3 2' }),
    P(`M${n2(cx)} ${n2(cy - r)} L${n2(cx - r * 0.4)} ${n2(cy + r * 0.62)} L${n2(cx)} ${n2(cy + r * 0.22)} Z`, { fill: INK }),
    P(`M${n2(cx)} ${n2(cy - r)} L${n2(cx + r * 0.4)} ${n2(cy + r * 0.62)} L${n2(cx)} ${n2(cy + r * 0.22)} Z`, { fill: '#ffffff', stroke: INK, w: 0.3 }),
    T(cx, cy - r * 1.18, '北', { size: 4.4, anchor: 'middle', weight: 'bold' }),
    T(cx, cy + r * 1.05, 'N', { size: 3, anchor: 'middle', fill: INK2, mono: true }),
  ].join('');
}

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
  return out.join('');
}

function panel(x, y, w, h, title, o = {}) {
  const th = o.th ?? 8;
  const s = [R(x, y, w, h, { fill: o.fill ?? '#ffffff', stroke: o.stroke ?? HAIR, w: 0.4 })];
  if (title) {
    s.push(R(x, y, w, th, { fill: o.headFill ?? '#eceff2', stroke: o.stroke ?? HAIR, w: 0.4 }));
    s.push(T(x + 3, y + th * 0.72, title, { size: o.ts ?? 4.6, weight: 'bold', fill: o.tc ?? INK }));
    if (o.note) s.push(T(x + w - 3, y + th * 0.7, o.note, { size: 2.7, anchor: 'end', fill: INK3, mono: true }));
  }
  return s.join('');
}

function lvSwatch(x, y, w, h, lv) {
  return R(x, y, w, h, { fill: LEVELS[lv].bg, stroke: LEVELS[lv].color, w: 0.45 });
}

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

function table(x, y, w, cols, rows, o = {}) {
  const rh = o.rh ?? 8.2, hh = o.hh ?? 8;
  const out = [];
  const totalH = hh + rows.length * rh;
  let cx = x;
  out.push(R(x, y, w, hh, { fill: C.tblHead, stroke: C.tblLine, w: 0.35 }));
  cols.forEach((c0) => {
    out.push(T(cx + c0.w / 2, y + hh * 0.68, c0.t, { size: o.hs ?? 2.9, anchor: 'middle', weight: 'bold', fill: INK2 }));
    cx += c0.w;
  });
  cx = x;
  cols.slice(0, -1).forEach((c0) => {
    cx += c0.w;
    out.push(L(cx, y, cx, y + totalH, { stroke: C.tblLine, w: 0.35 }));
  });
  rows.forEach((r, i) => {
    const cy = y + hh + i * rh;
    out.push(R(x, cy, w, rh, { fill: i % 2 ? C.tblAlt : '#ffffff', stroke: 'none' }));
    out.push(R(x, cy, w, rh, { stroke: C.tblLine, w: 0.3 }));
    let cx2 = x;
    r.forEach((cell, j) => {
      const cw = cols[j].w;
      const txt = cell == null ? '' : (typeof cell === 'object' ? cell.t : String(cell));
      const obj = (cell && typeof cell === 'object') ? cell : null;
      const fill = obj && obj.lv ? LV(obj.lv) : obj && obj.fill ? obj.fill : INK;
      const al = (obj && obj.align) || (j === 0 ? 'start' : 'middle');
      const tx = al === 'start' ? cx2 + 1.6 : cx2 + cw / 2;
      out.push(T(tx, cy + rh * 0.7, txt, {
        size: o.size ?? 2.9, anchor: al, fill,
        mono: obj && obj.noMono ? false : j > 0,
        weight: obj && obj.weight ? obj.weight : undefined,
      }));
      cx2 += cw;
    });
  });
  return out.join('');
}

/* ===========================================================================
 * 2. 由 data.js 派生的几何（平面 + 剖面共用）
 * ========================================================================= */

const A = BOWL_INNER.halfX;               // 64.5
const B = BOWL_INNER.halfZ;               // 44.0
const RC = BOWL_INNER.cornerRadius;       // 20.0
const CXA = A - RC;                       // 44.5
const CZA = B - RC;                       // 24.0
const D2R = Math.PI / 180;

/**
 * 每座看台的边界路径 = 直段 + 两段 45° 圆角弧，与 js/stadium.js 的 deckSegments() 一致。
 * 四段恰好铺满碗体内缘的圆角矩形，45° 对角处相邻两看台相接（QUADRANTS.splitDeg = 45）。
 */
const SEGS = {
  north: [
    { t: 'arc', cx: -CXA, cz: -CZA, a0: 225, a1: 270 },
    { t: 'line', x0: -CXA, z0: -B, x1: CXA, z1: -B },
    { t: 'arc', cx: CXA, cz: -CZA, a0: 270, a1: 315 },
  ],
  south: [
    { t: 'arc', cx: -CXA, cz: CZA, a0: 135, a1: 90 },
    { t: 'line', x0: -CXA, z0: B, x1: CXA, z1: B },
    { t: 'arc', cx: CXA, cz: CZA, a0: 90, a1: 45 },
  ],
  east: [
    { t: 'arc', cx: CXA, cz: -CZA, a0: 315, a1: 360 },
    { t: 'line', x0: A, z0: -CZA, x1: A, z1: CZA },
    { t: 'arc', cx: CXA, cz: CZA, a0: 0, a1: 45 },
  ],
  west: [
    { t: 'arc', cx: -CXA, cz: -CZA, a0: 225, a1: 180 },
    { t: 'line', x0: -A, z0: -CZA, x1: -A, z1: CZA },
    { t: 'arc', cx: -CXA, cz: CZA, a0: 180, a1: 135 },
  ],
};

const NORMAL = { north: [0, -1], south: [0, 1], east: [1, 0], west: [-1, 0] };

/** 沿看台边界等弧长取样：{x, z, nx, nz, s}（s = 自扇区起点的弧长，米） */
function stations(key, step = 2.0) {
  const out = [];
  let s = 0;
  const push = (x, z, nx, nz) => {
    if (out.length) {
      const p = out[out.length - 1];
      s += Math.hypot(x - p.x, z - p.z);
    }
    out.push({ x, z, nx, nz, s });
  };
  for (const seg of SEGS[key]) {
    if (seg.t === 'line') {
      const len = Math.hypot(seg.x1 - seg.x0, seg.z1 - seg.z0);
      const nSeg = Math.max(2, Math.round(len / step));
      for (let i = 0; i <= nSeg; i++) {
        if (i === 0 && out.length) continue;
        const t = i / nSeg;
        push(seg.x0 + (seg.x1 - seg.x0) * t, seg.z0 + (seg.z1 - seg.z0) * t, NORMAL[key][0], NORMAL[key][1]);
      }
    } else {
      const len = Math.abs((seg.a1 - seg.a0) * D2R) * RC;
      const nSeg = Math.max(2, Math.round(len / step));
      for (let i = 0; i <= nSeg; i++) {
        if (i === 0 && out.length) continue;
        const a = (seg.a0 + (seg.a1 - seg.a0) * (i / nSeg)) * D2R;
        push(seg.cx + Math.cos(a) * RC, seg.cz + Math.sin(a) * RC, Math.cos(a), Math.sin(a));
      }
    }
  }
  return out;
}

const _stCache = new Map();
const stOf = (key, step) => {
  const kk = `${key}@${step}`;
  if (!_stCache.has(kk)) _stCache.set(kk, stations(key, step));
  return _stCache.get(kk);
};

function stationAtS(key, s) {
  const st = stOf(key, 0.25);
  for (let i = 1; i < st.length; i++) {
    if (st[i].s >= s) {
      const p = st[i - 1], q = st[i];
      const t = (s - p.s) / Math.max(1e-9, q.s - p.s);
      return {
        x: p.x + (q.x - p.x) * t, z: p.z + (q.z - p.z) * t,
        nx: p.nx + (q.nx - p.nx) * t, nz: p.nz + (q.nz - p.nz) * t, s,
      };
    }
  }
  return st[st.length - 1];
}

const ringAt = (key, u, step = 2.0) => stOf(key, step).map((p) => [p.x + p.nx * u, p.z + p.nz * u]);

function bandAt(key, u0, u1, step = 2.0) {
  const st = stOf(key, step);
  const outer = st.map((p) => [p.x + p.nx * u1, p.z + p.nz * u1]);
  const inner = st.map((p) => [p.x + p.nx * u0, p.z + p.nz * u0]).reverse();
  return outer.concat(inner);
}

/** 碗体内缘圆角矩形（r 为圆角半径，half 为半宽/半深） */
function roundedRectPts(halfX, halfZ, r, step = 8) {
  const cx = halfX - r, cz = halfZ - r;
  const pts = [];
  const arc = (cxa, cza, a0, a1) => {
    for (let i = 0; i <= step; i++) {
      const a = (a0 + (a1 - a0) * (i / step)) * D2R;
      pts.push([cxa + Math.cos(a) * r, cza + Math.sin(a) * r]);
    }
  };
  arc(-cx, cz, 180, 90);
  arc(cx, cz, 90, 0);
  arc(cx, -cz, 360, 270);
  arc(-cx, -cz, 270, 180);
  return pts;
}

/* -------- 看台层段（tiers）派生量：全部由 data.js 直接推出 -------- */
const tierTop = (t) => t.baseHeight + t.rows * t.rowRise;
const tierBack = (t) => t.startDepth + t.rows * t.rowDepth;
const tierDepth = (t) => t.rows * t.rowDepth;
const standBack = (key) => STANDS[key].totalDepth;

/** 屋盖前缘进深（与 js/stadium.js buildDeck() 同一口径：总进深 − 悬挑） */
function roofFront(key) {
  const back = standBack(key);
  const cant = STANDS[key].roofCantilever ?? 0;
  return Math.max(3.0, back - Math.min(cant, back - 4));
}

function bandState(t, cut) {
  if (tierTop(t) <= cut) return 'below';
  if (t.baseHeight > cut) return 'above';
  return 'active';
}

const cutDepth = (t, cut) => t.startDepth + ((cut - t.baseHeight) / t.rowRise) * t.rowDepth;

const ALL_TIERS = [];
STAND_ORDER.forEach((key) => {
  STANDS[key].tiers.forEach((t, i) => {
    ALL_TIERS.push({ key, tier: t, idx: i, label: `L${i + 1}` });
  });
});

const STAND_SHORT = {
  north: '北看台', south: '南看台', east: '东看台', west: '西看台',
};
const STAND_EN = {
  north: 'SIR ALEX FERGUSON STAND', south: 'SIR BOBBY CHARLTON STAND',
  east: 'EAST STAND', west: 'STRETFORD END',
};

/* ===========================================================================
 * 3. 版面常量
 * ========================================================================= */

const PLAN_K = 1000 / 750;      // 1:750
const PLAN_CX = 250;
const PLAN_CY = 288;
const SITE = { x: 22, y: 62, w: 460, h: 388 };
const PANEL_X = 490;
const PANEL_W = SHEET.w - FRAME.r - PANEL_X;   // 331
const STRIP = { x: 24, y: 466, w: 572, h: 104 };
const SEC_BASEY = STRIP.y + 78;

const mPlan = mapper({ k: PLAN_K, ox: PLAN_CX, oy: PLAN_CY, cx: 0, cy: 0, flipY: false });
const pt = (m, p) => [m.x(p[0]), m.y(p[1])];
const pl = (m, pts, o = {}) => PL(pts.map((p) => pt(m, p)), o);
const pg = (m, pts, o = {}) => PG(pts.map((p) => pt(m, p)), o);

/* ===========================================================================
 * 4. 图面构件
 * ========================================================================= */

function pitchPlan() {
  const Lp = PITCH.length, Wp = PITCH.width;
  const out = [];
  const ns = PITCH.stripes;
  for (let i = 0; i < ns; i++) {
    const x0 = -Lp / 2 + (Lp / ns) * i;
    out.push(R(mPlan.x(x0), mPlan.y(-Wp / 2), mPlan.len(Lp / ns), mPlan.len(Wp),
      { fill: i % 2 ? C.grassAlt : C.grass, stroke: 'none' }));
  }
  const W = PITCH.lineWidth * PLAN_K;
  const gx = Lp / 2, gz = Wp / 2;
  out.push(R(mPlan.x(-gx), mPlan.y(-gz), mPlan.len(Lp), mPlan.len(Wp), { stroke: C.pitchMark, w: W }));
  out.push(L(mPlan.x(0), mPlan.y(-gz), mPlan.x(0), mPlan.y(gz), { stroke: C.pitchMark, w: W }));
  out.push(CI(mPlan.x(0), mPlan.y(0), mPlan.len(PITCH.centerCircleRadius), { stroke: C.pitchMark, w: W }));
  out.push(CI(mPlan.x(0), mPlan.y(0), mPlan.len(0.35), { fill: C.pitchMark }));
  [-1, 1].forEach((sgn) => {
    const xl = sgn * gx;
    const pa = PITCH.penaltyAreaLength, pw = PITCH.penaltyAreaWidth;
    const ga = PITCH.goalAreaLength, gw = PITCH.goalAreaWidth;
    out.push(R(mPlan.x(Math.min(xl, xl - sgn * pa)), mPlan.y(-pw / 2), mPlan.len(pa), mPlan.len(pw), { stroke: C.pitchMark, w: W }));
    out.push(R(mPlan.x(Math.min(xl, xl - sgn * ga)), mPlan.y(-gw / 2), mPlan.len(ga), mPlan.len(gw), { stroke: C.pitchMark, w: W }));
    const spx = xl - sgn * PITCH.penaltySpot;
    out.push(CI(mPlan.x(spx), mPlan.y(0), mPlan.len(0.35), { fill: C.pitchMark }));
    const r = PITCH.centerCircleRadius;
    const a = Math.acos(Math.max(-1, Math.min(1, (PITCH.penaltyAreaLength - PITCH.penaltySpot) / r)));
    const s0 = sgn > 0 ? Math.PI - a : -a;
    const s1 = sgn > 0 ? Math.PI + a : a;
    const pts = [];
    for (let i = 0; i <= 24; i++) {
      const ang = s0 + (s1 - s0) * (i / 24);
      pts.push([spx + Math.cos(ang) * r, Math.sin(ang) * r]);
    }
    out.push(pl(mPlan, pts, { stroke: C.pitchMark, w: W }));
    out.push(R(mPlan.x(sgn > 0 ? xl - 2.0 : xl), mPlan.y(-PITCH.goalWidth / 2),
      mPlan.len(2.0), mPlan.len(PITCH.goalWidth), { stroke: C.pitchMark, w: 0.45 }));
  });
  // 角球弧：以角点为心、半径 1.0 m，向场内 90°
  [[-1, -1], [-1, 1], [1, -1], [1, 1]].forEach(([sx, sz]) => {
    const cx0 = sx * gx, cz0 = sz * gz;
    const base = Math.atan2(-sz, -sx);
    const pts = [];
    for (let i = 0; i <= 10; i++) {
      const ang = base + (Math.PI / 2) * (i / 10) * (sx > 0 ? -1 : 1);
      pts.push([cx0 + Math.cos(ang) * PITCH.cornerArcRadius, cz0 + Math.sin(ang) * PITCH.cornerArcRadius]);
    }
    out.push(pl(mPlan, pts, { stroke: C.pitchMark, w: W }));
  });
  return out.join('');
}

function contextPlan(full) {
  const out = [];
  const roadStyle = full
    ? { fill: C.road, stroke: C.roadEdge, w: 0.3 }
    : { stroke: C.roadEdge, w: 0.25, dash: '4 2' };
  const drawRoad = (r, nm) => {
    const hw = r.w / 2;
    if (r.axis === 'x') {
      out.push(R(mPlan.x(r.offset - hw), mPlan.y(-330), mPlan.len(r.w), mPlan.len(660), roadStyle));
      if (full) out.push(T(mPlan.x(r.offset), mPlan.y(-260), nm, { size: 3.2, rotate: -90, fill: INK2 }));
    } else {
      out.push(R(mPlan.x(-330), mPlan.y(r.offset - hw), mPlan.len(660), mPlan.len(r.w), roadStyle));
      if (full) out.push(T(mPlan.x(-250), mPlan.y(r.offset) + 1.1, nm, { size: 3.2, fill: INK2 }));
    }
  };
  const RD = CONTEXT.roads;
  if (RD.busbyWay) drawRoad(RD.busbyWay, 'Sir Matt Busby Way');
  if (RD.wharfside) drawRoad(RD.wharfside, RD.wharfside.name || 'Wharfside Way');
  if (RD.chester) drawRoad(RD.chester, 'A56 Chester Rd');
  if (RD.victoria) drawRoad(RD.victoria, 'Victoria St');
  if (RD.canal) {
    const cc = RD.canal;
    out.push(R(mPlan.x(-330), mPlan.y(cc.offset - cc.w / 2), mPlan.len(660), mPlan.len(cc.w),
      { fill: C.water, stroke: C.waterEdge, w: 0.3 }));
    if (full) out.push(T(mPlan.x(-250), mPlan.y(cc.offset) + 1.1, cc.name || 'Bridgewater Canal', { size: 3.2, fill: '#3b6d80' }));
  }
  if (RD.rail) {
    out.push(R(mPlan.x(-330), mPlan.y(RD.rail.offset - 3), mPlan.len(660), mPlan.len(6),
      { fill: C.rail, stroke: C.railEdge, w: 0.3, dash: '8 3' }));
    if (full) out.push(T(mPlan.x(-250), mPlan.y(RD.rail.offset) + 1.1, 'Trafford Park 货运线', { size: 3.2, fill: INK2 }));
  }
  if (full && CONTEXT.carparks) {
    Object.entries(CONTEXT.carparks).forEach(([id, c0]) => {
      out.push(R(mPlan.x(c0.x - c0.w / 2), mPlan.y(c0.z - c0.d / 2), mPlan.len(c0.w), mPlan.len(c0.d),
        { fill: C.park, stroke: C.parkEdge, w: 0.25 }));
      out.push(T(mPlan.x(c0.x), mPlan.y(c0.z) + 1.0, id, { size: 2.6, anchor: 'middle', fill: '#6f6a60', mono: true }));
    });
  }
  return out.join('');
}

/** 首层/底层环带：看台结构之下的地面层空间（仅 ±0.00 图有意义） */
function groundRingPlan() {
  const out = [];
  STAND_ORDER.forEach((key) => {
    out.push(pg(mPlan, bandAt(key, 0, standBack(key)), {
      fill: C.ground, stroke: C.groundEdge, w: 0.35, join: 'round',
    }));
  });
  return out.join('');
}

function drawTierBand(m, key, t, idx, cut) {
  const st = bandState(t, cut);
  const u0 = t.startDepth, u1 = tierBack(t);
  const out = [];
  const fill = st === 'below' ? C.ringBelow : st === 'active' ? C.ringCut : C.ringAbove;
  const edge = st === 'above' ? C.ringEdgeAbove : C.ringEdgeBelow;
  out.push(pg(m, bandAt(key, u0, u1), {
    fill, stroke: edge, w: st === 'above' ? 0.22 : 0.35,
    dash: st === 'above' ? '3 2' : null, join: 'round',
  }));
  if (st !== 'above') {
    for (let r = 8; r < t.rows; r += 8) {
      out.push(pl(m, ringAt(key, t.startDepth + r * t.rowDepth), { stroke: '#bdb3a8', w: 0.22 }));
    }
    out.push(pl(m, ringAt(key, u1), { stroke: edge, w: 0.4 }));
  }
  // 径向通道（模型口径：每 14 座停 2.0 m [推算]）
  const period = SEATING.aisleEvery * SEATING.seatWidth + SEATING.aisleGap;
  const total = stOf(key, 0.25).slice(-1)[0].s;
  for (let s = SEATING.aisleEvery * SEATING.seatWidth; s < total; s += period) {
    const q = stationAtS(key, s);
    out.push(L(
      m.x(q.x + q.nx * u0), m.y(q.z + q.nz * u0),
      m.x(q.x + q.nx * u1), m.y(q.z + q.nz * u1),
      { stroke: '#9a9086', w: 0.22, dash: '1.2 1.2' },
    ));
  }
  if (st === 'active') {
    out.push(pl(m, ringAt(key, cutDepth(t, cut)), { stroke: C.cut, w: 0.9, join: 'round' }));
  }
  void idx;
  return out.join('');
}

/** 某深度处的标注锚点（该看台扇区中部） */
function labelAt(key, u, m, lift = 0) {
  const st = stOf(key, 0.25);
  const mid = st[st.length - 1].s / 2;
  const q = stationAtS(key, mid);
  return [m.x(q.x + q.nx * u), m.y(q.z + q.nz * u) - lift];
}

function roofPlan(m, solid) {
  const out = [];
  STAND_ORDER.forEach((key) => {
    const back = standBack(key);
    const front = roofFront(key);
    out.push(pg(m, bandAt(key, front, back), {
      fill: solid ? C.roof : 'none',
      stroke: C.roofEdge, w: solid ? 0.5 : 0.3,
      dash: solid ? null : '5 2.5', join: 'round',
    }));
    stOf(key, 12).forEach((p) => {
      out.push(L(m.x(p.x + p.nx * front), m.y(p.z + p.nz * front),
        m.x(p.x + p.nx * back), m.y(p.z + p.nz * back),
        { stroke: C.roofEdge, w: solid ? 0.22 : 0.16, opacity: solid ? 0.85 : 0.5 }));
    });
    out.push(pl(m, ringAt(key, front), { stroke: C.roofEdge, w: solid ? 0.6 : 0.3 }));
    out.push(pl(m, ringAt(key, back), { stroke: C.roofEdge, w: solid ? 0.6 : 0.3 }));
  });
  return out.join('');
}

/** 外墙（各看台声明总进深）+ 四角象限分隔与标注 */
function outerWallPlan() {
  const out = [];
  STAND_ORDER.forEach((key) => {
    out.push(pl(mPlan, ringAt(key, standBack(key)), { stroke: C.standEdge, w: 0.7, join: 'round' }));
  });
  QUADRANTS.corners.forEach((c0) => {
    const dir = Math.atan2(c0.sz, c0.sx);
    const inner = [c0.sx * CXA + Math.cos(dir) * RC, c0.sz * CZA + Math.sin(dir) * RC];
    const outer = [inner[0] + Math.cos(dir) * 70, inner[1] + Math.sin(dir) * 70];
    out.push(L(mPlan.x(inner[0]), mPlan.y(inner[1]), mPlan.x(outer[0]), mPlan.y(outer[1]),
      { stroke: C.quadEdge, w: 0.3, dash: '6 3' }));
    const lm = [inner[0] + Math.cos(dir) * 34, inner[1] + Math.sin(dir) * 34];
    out.push(halo(mPlan.x(lm[0]), mPlan.y(lm[1]), `${c0.id} 象限 ${c0.rows} 排 · 底 +${c0.baseHeight.toFixed(1)} m`, {
      size: 2.9, anchor: 'middle', fill: '#6d5f45',
    }));
  });
  return out.join('');
}

function pitchSideFeatures() {
  const out = [];
  const f = FEATURES;
  if (f.tunnel) {
    // SW 角：西南角弧心 (−CXA, +CZA) 的 135° 方向
    const dir = 135 * D2R;
    const cxw = -CXA + Math.cos(dir) * RC, czw = CZA + Math.sin(dir) * RC;
    const w = f.tunnel.width, d = f.tunnel.depth ?? 4;
    out.push(R(mPlan.x(cxw - w / 2), mPlan.y(czw - d / 2), mPlan.len(w), mPlan.len(d),
      { fill: '#f7dede', stroke: C.cut, w: 0.5 }));
    out.push(leader(mPlan.x(cxw), mPlan.y(czw) - 3, mPlan.x(cxw) + 30, mPlan.y(czw) - 22,
      `球员通道 ${dimText(f.tunnel.width, 'm', '文献')} × ${f.tunnel.height.toFixed(1)}m 高 [文献]`,
      { color: C.cut, mid: mPlan.x(cxw) + 14 }));
  }
  if (f.dugouts) {
    const zd = PITCH.width / 2 + 4.0;
    [-1, 1].forEach((sgn, i) => {
      const x0 = sgn * 20 - f.dugouts.length / 2;
      out.push(R(mPlan.x(x0), mPlan.y(zd), mPlan.len(f.dugouts.length), mPlan.len(f.dugouts.depth),
        { fill: '#e8e4dc', stroke: C.standEdge, w: 0.4 }));
      if (i === 0) {
        out.push(leader(mPlan.x(x0), mPlan.y(zd + f.dugouts.depth), mPlan.x(x0) - 34, mPlan.y(zd) + 26,
          `教练席 ${f.dugouts.count} × ${dimText(f.dugouts.length, 'm', '文献')}`, { color: INK2, mid: mPlan.x(x0) - 18 }));
      }
    });
  }
  if (f.advertisingBoards) {
    const d = f.advertisingBoards.distanceFromLine;
    const x0 = -(PITCH.length / 2 + d), z0 = -(PITCH.width / 2 + d);
    out.push(R(mPlan.x(x0), mPlan.y(z0), mPlan.len(PITCH.length + d * 2), mPlan.len(PITCH.width + d * 2),
      { stroke: '#b98b2f', w: 0.5, dash: '4 1.5' }));
  }
  if (f.statues) {
    const pos = { busby: [126, 0], trinity: [128, -22] };
    f.statues.forEach((s0) => {
      const p0 = pos[s0.id];
      if (!p0) return;
      out.push(CI(mPlan.x(p0[0]), mPlan.y(p0[1]), 1.4, { fill: '#7a6a52', stroke: '#4d4232', w: 0.3 }));
      out.push(halo(mPlan.x(p0[0]) + 3, mPlan.y(p0[1]) - 1, `${s0.nameZh || s0.id} 雕像 [${s0.level || '文献'}]`, { size: 2.8, fill: '#6d5f45' }));
    });
  }
  if (f.bigScreen) {
    const w0 = f.bigScreen.width;
    out.push(R(mPlan.x(88), mPlan.y(-41), mPlan.len(0.8), mPlan.len(w0), { fill: '#3c4650', stroke: INK, w: 0.35 }));
    out.push(R(mPlan.x(-88.8), mPlan.y(29), mPlan.len(0.8), mPlan.len(w0), { fill: '#3c4650', stroke: INK, w: 0.35 }));
    out.push(halo(mPlan.x(92), mPlan.y(-41), `大屏 ${w0.toFixed(1)}×${f.bigScreen.height.toFixed(1)} m [推算]`, { size: 2.7, fill: '#3c4650' }));
  }
  return out.join('');
}

/** 剖面剖切线（2—2 / 3—3）在平面上的位置与编号泡 */
function sectionMarks() {
  const out = [];
  out.push(L(mPlan.x(0), mPlan.y(-139), mPlan.x(0), mPlan.y(101), { stroke: '#0f6e8c', w: 0.35, dash: '10 3 2 3' }));
  out.push(L(mPlan.x(-139), mPlan.y(0), mPlan.x(139), mPlan.y(0), { stroke: '#0f6e8c', w: 0.35, dash: '10 3 2 3' }));
  [[0, -143, '2'], [0, 105, '2'], [-143, 0, '3'], [143, 0, '3']].forEach(([x, z, tag]) => {
    out.push(CI(mPlan.x(x), mPlan.y(z), 4.2, { fill: '#ffffff', stroke: '#0f6e8c', w: 0.45 }));
    out.push(T(mPlan.x(x), mPlan.y(z) + 1.5, tag, { size: 5, anchor: 'middle', fill: '#0f6e8c', weight: 'bold' }));
  });
  return out.join('');
}

function planDims(cfg) {
  const out = [];
  const XW = mPlan.x(-(A + standBack('west')));
  const XE = mPlan.x(A + standBack('east'));
  const ZN = mPlan.y(-(B + standBack('north')));
  const ZS = mPlan.y(B + standBack('south'));
  out.push(dimH(XW, XE, 116, `场地东西外缘 ${(2 * A + standBack('west') + standBack('east')).toFixed(1)} m`));
  out.push(dimH(mPlan.x(-PITCH.length / 2), mPlan.x(PITCH.length / 2), 127, `草坪长 ${dimText(PITCH.length, 'm', '推定')}`, { size: 2.9 }));
  out.push(dimV(70, ZN, ZS, `场地南北外缘 ${(2 * B + standBack('north') + standBack('south')).toFixed(1)} m`, { side: 'left' }));
  out.push(dimV(80, mPlan.y(-PITCH.width / 2), mPlan.y(PITCH.width / 2), `草坪宽 ${dimText(PITCH.width, 'm', '推定')}`, { side: 'left', size: 2.9 }));
  out.push(dimH(mPlan.x(-CXA), mPlan.x(CXA), ZN - 9,
    `北看台进深 ${standBack('north').toFixed(1)} m（悬挑 ${STANDS.north.roofCantilever} m [官方]）`, { size: 2.8 }));
  out.push(dimH(mPlan.x(-CXA), mPlan.x(CXA), ZS + 9,
    `南看台进深 ${standBack('south').toFixed(1)} m（单层 ${STANDS.south.tiers[0].rows} 排）`, { size: 2.8, above: false }));
  out.push(dimV(XW - 9, mPlan.y(-CZA), mPlan.y(CZA), `西看台 ${standBack('west').toFixed(1)} m`, { side: 'left', size: 2.8 }));
  out.push(dimV(XE + 9, mPlan.y(-CZA), mPlan.y(CZA), `东看台 ${standBack('east').toFixed(1)} m`, { side: 'right', size: 2.8 }));
  out.push(halo(mPlan.x(0), mPlan.y(-B) + 4, `碗体内缘 ${(2 * A).toFixed(1)} × ${(2 * B).toFixed(1)} m · 圆角 R ${RC.toFixed(1)} m [推算]`,
    { size: 2.9, anchor: 'middle', fill: '#0f6e8c' }));
  out.push(halo(mPlan.x(-52), mPlan.y(B + 6), `本层剖切标高 +${cfg.cut.toFixed(2)} m`, { size: 3.4, anchor: 'middle', fill: C.cut, weight: 'bold' }));
  return out.join('');
}

function planLegend(x, y) {
  const out = [];
  const w = 200, h = 70;
  out.push(panel(x, y, w, h, '图例 · LEGEND', { note: `${PLAN_K.toFixed(4)} mm/m` }));
  const items = [
    ['#ffffff', C.standEdge, '实线', '剖切面之下可见的构件轮廓'],
    [C.ringCut, C.ringEdgeBelow, '本层（切到）', '剖切面切过：座席层段 + 红色剖切线'],
    [C.ringBelow, C.ringEdgeBelow, '下部层段', '剖切面之下：可见（浅填充 + 排纹理）'],
    [C.ringAbove, C.ringEdgeAbove, '上部层段', '剖切面之上：遮挡（虚线、无填充）'],
    [C.ground, C.groundEdge, '地面层空间', '±0.00 图：看台结构之下的底层环带'],
    [C.roof, C.roofEdge, '屋盖', '屋面图实线；其余图虚线投影'],
    [C.grass, '#2c3630', '草坪 / 跑动区', `草坪 ${PITCH.length}×${PITCH.width} m [推定]`],
  ];
  items.forEach((it, i) => {
    const iy = y + 11 + i * 8.2;
    out.push(R(x + 4, iy, 9, 5.2, { fill: it[0], stroke: it[1], w: 0.4 }));
    out.push(T(x + 16, iy + 4.2, it[2], { size: 2.9, weight: 'bold' }));
    out.push(T(x + 54, iy + 4.2, it[3], { size: 2.8, fill: INK2 }));
  });
  return out.join('');
}

/* ===========================================================================
 * 5. 各层平面图
 * ========================================================================= */

const SHEETS_PLAN = [
  {
    no: '06', file: '06-场地层平面图.svg', name: '场地层平面图（±0.00）', titleShort: '场地层 ±0.00',
    level: 0.00, cut: 1.20, scale: '1:750',
    func: '草坪 · 场边设施 · 首层底部环带（看台结构之下）；上部看台与屋盖以虚线示出投影。',
    context: 'full', roof: false, ground: true,
    cutNote: '剖切面 +1.20 m 只切到广告板与球员通道，看台首排踏面 +2.20 m 在其上。',
  },
  {
    no: '07', file: '07-首层看台平面图.svg', name: '首层看台平面图（F1 · +2.20）', titleShort: '首层 F1 +2.20',
    level: 2.20, cut: 3.60, scale: '1:750',
    func: '下层看台 L1 座席带（四座看台）· 踏面 +2.20 起 · 排高 0.42 / 排距 0.75 · 径向通道每 14 座停 2.0 m。',
    context: 'light', roof: false, ground: false,
    cutNote: '剖切面切过四座看台 L1 的第 4 排（进深 8.5 m）。',
  },
  {
    no: '08', file: '08-中层环廊平面图.svg', name: '中层环廊平面图（F2 · +18.00）', titleShort: '中层 F2 +18.00',
    level: 18.00, cut: 19.40, scale: '1:750',
    func: '中层环廊（L1 后缘 → L2 前缘的平台）· 四角 2005–06 象限 · 中层看台 L2 座席带。',
    context: 'light', roof: 'dash', ground: false,
    cutNote: '剖切面切过北/东/西看台 L2 的第 4 排；南看台单层，其座席全部在剖切面之下。',
  },
  {
    no: '09', file: '09-上层环廊平面图.svg', name: '上层环廊平面图（F3 · +33.20）', titleShort: '上层 F3 +33.20',
    level: 33.20, cut: 34.60, scale: '1:750',
    func: '上层环廊（L2 后缘 → L3 前缘的平台，仅北看台有 L3）· 北看台上层座席带。',
    context: 'light', roof: 'dash', ground: false,
    cutNote: '剖面只切到北看台 L3 的第 4 排；其余三座看台已全部在剖切面之下。',
  },
  {
    no: '10', file: '10-屋面层平面图.svg', name: '屋面层平面图（RF · +49.60）', titleShort: '屋面层 RF',
    level: null, cut: 49.60, scale: '1:750',
    func: '四座看台屋盖板（前缘悬挑/后缘支点）· 场地照明灯带 · 屋盖悬挑两种口径对照。',
    context: 'light', roof: 'solid', ground: false,
    cutNote: '屋面图为俯视，剖切面取 +49.60 m（北看台檐口 +49.00 m [推算] 之上）。',
  },
];

/** 11/12 两张图：不走 drawLevelPlan，用各自的绘制函数 */
const SHEETS_EXTRA = [
  {
    no: '11', file: '11-逐层剖面谱.svg',
    name: '逐层剖面谱（剖面 2—2 南北 1:500 · 3—3 东西 1:600）',
    titleShort: '逐层剖面谱', titleName: '逐层剖面谱（2—2 / 3—3）', scale: '1:500 / 1:600', en: 'LEVEL SECTION SET',
    level: 0.00, cut: 49.60, custom: true,
    contentA: '剖面 2—2 南北 1:500 · 剖面 3—3 东西 1:600',
    func: '四座看台逐排剖面轮廓 + 06—10 五张平面图的剖切标高线；本图是 06—10 的剖切依据。',
    cutNote: '剖面谱本身不剖切，红色方框标出 06—10 各层平面的剖切标高。',
    draw: drawCutSheet,
  },
  {
    no: '12', file: '12-角部象限专项图.svg',
    name: '角部象限专项图（NE 角部平面 1:530 · 45° 对角剖面示意 1:650）',
    titleShort: '角部象限专项', titleName: '角部象限专项图（NE 角部）', scale: '1:530 / 1:650', en: 'CORNER QUADRANT',
    level: 18.00, cut: 19.40,
    func: '四角 2005–06 象限：数据（每角 30 排 / 底 +18.00）与模型（由相邻看台 L2 的 45° 弧段各半承担）两种口径对照。',
    cutNote: '角部平面按中层环廊标高 +19.40 m 剖切，与 08 号图对照。',
    draw: drawCornerSheet,
  },
];

function drawLevelPlan(cfg) {
  const m = mPlan;
  const out = [];
  const cut = cfg.cut;

  /* ============ 一、图面内容（先画内容，再画图框与标题，避免被遮） ============ */
  const content = [];
  content.push(R(SITE.x, SITE.y, SITE.w, SITE.h, { fill: C.site, stroke: 'none' }));
  if (cfg.ground) content.push(groundRingPlan());
  content.push(contextPlan(cfg.context === 'full'));
  content.push(pitchPlan());
  STAND_ORDER.forEach((key) => {
    STANDS[key].tiers.forEach((t, i) => content.push(drawTierBand(m, key, t, i, cut)));
  });
  if (cfg.roof) content.push(roofPlan(m, cfg.roof === 'solid'));
  content.push(outerWallPlan());
  if (cfg.ground || cfg.no === '07') content.push(pitchSideFeatures());
  content.push(sectionMarks());

  /* 标注：层段简短标签 + 看台名称（东/西看台文字竖排）
     名称所在层段（取进深最大者）的短标签前移，避免与该看台名称重叠 */
  const NAME_TIER = {};
  STAND_ORDER.forEach((key) => {
    // 多层看台用中层（L2）落名，单层看台（南看台）用唯一层
    NAME_TIER[key] = STANDS[key].tiers.length > 1 ? 1 : 0;
  });
  STAND_ORDER.forEach((key) => {
    const tiers = STANDS[key].tiers;
    tiers.forEach((t, i) => {
      const st = bandState(t, cut);
      const f = i === NAME_TIER[key] ? 0.25 : 0.5;
      const [lx, ly] = labelAt(key, t.startDepth + f * tierDepth(t), m);
      const rot = (key === 'east' || key === 'west') ? -90 : 0;
      content.push(halo(lx, ly, `${STAND_SHORT[key][0]}${i + 1} · ${t.rows} 排`, {
        size: 3.1, anchor: 'middle', rotate: rot,
        fill: st === 'active' ? C.cut : INK2, weight: st === 'active' ? 'bold' : null,
      }));
      if (st === 'active') {
        const [cx2, cy2] = labelAt(key, cutDepth(t, cut) - 6, m);
        content.push(halo(cx2, cy2, `剖切 +${cut.toFixed(2)}`, { size: 2.8, anchor: 'middle', rotate: rot, fill: C.cut }));
      }
    });
    // 看台名称：置于进深最大层段的 70% 处（中空处不压层段标签）
    const nt = tiers[NAME_TIER[key]];
    const [nx, ny] = labelAt(key, nt.startDepth + 0.7 * tierDepth(nt), m);
    const rot = (key === 'east' || key === 'west') ? -90 : 0;
    content.push(T(nx, ny, STANDS[key].nameZh, { size: 4.4, anchor: 'middle', rotate: rot, weight: 'bold', fill: '#3d4348' }));
    content.push(T(nx + (rot ? 6.5 : 0), ny + (rot ? 0 : 4.6), STAND_EN[key], {
      size: 2.6, anchor: 'middle', rotate: rot, fill: INK3, mono: true,
    }));
  });
  content.push(planDims(cfg));
  content.push(pitchSideLabels(cfg));

  out.push(`<g clip-path="url(#clip-site)">${content.join('')}</g>`);

  /* ============ 二、图框 / 抬头 / 图例 / 比例尺 ============ */
  out.push(frame());
  out.push(T(FRAME.l + 6, 28, `${cfg.no} · ${cfg.name}`, { size: 8.4, weight: 'bold' }));
  out.push(T(FRAME.l + 6, 37, `${cfg.en || ''} OLD TRAFFORD · A1 841×594 mm · ${cfg.scale}`, { size: 3.4, fill: INK2, mono: true }));
  out.push(levelStrip(FRAME.l + 6, 46));
  out.push(T(FRAME.l + 6, 56, `图面约定：北向上（−Z）· 剖切线 2—2 通过 X = 0、3—3 通过 Z = 0 · 全部几何由 js/data.js 逐排推出，无手写坐标。`, { size: 2.9, fill: INK3 }));
  out.push(planLegend(FRAME.l + 6, SITE.y + 4));
  out.push(northArrow(46, 190, 8));
  out.push(scaleBar(FRAME.l + 8, 442, PLAN_K, [0, 50, 100, 150, 200]));

  /* ============ 三、剖切关系示意（剖面 2—2 / 3—3，1:1000） ============ */
  out.push(sectionStrip(cfg));

  /* ============ 四、右侧面板与标题栏 ============ */
  out.push(...sidePanels(cfg));
  out.push(titleBlock({ no: cfg.no, name: cfg.titleName ?? cfg.name, scale: cfg.scale }));

  void cfg.titleShort;
  void cfg.cutNote;
  return svgDoc({
    title: `${cfg.no} ${cfg.name}`,
    desc: `老特拉福德球场 ${cfg.name}，本层剖切标高 +${cfg.cut.toFixed(2)} m，几何由 js/data.js 逐排派生`,
    body: out.join(''),
  });
}

/** 场边设施的文字标注（与 pitchSideFeatures 分离，便于压在最上层） */
function pitchSideLabels(cfg) {
  if (!(cfg.ground || cfg.no === '07')) return '';
  return '';
}

/* ===========================================================================
 * 6. 剖切关系示意：剖面 2—2（南北）与 3—3（东西），1:1000
 * ========================================================================= */

/** 看台的实体轮廓 [u, y]（座席体量，闭合到地面） */
function massOutline(key) {
  const s = STANDS[key];
  const pts = [[0, 0]];
  s.tiers.forEach((t) => {
    pts.push([t.startDepth, t.baseHeight]);
    for (let r = 0; r < t.rows; r++) {
      const u = t.startDepth + (r + 1) * t.rowDepth;
      pts.push([u, t.baseHeight + r * t.rowRise]);
      pts.push([u, t.baseHeight + (r + 1) * t.rowRise]);
    }
  });
  const last = s.tiers[s.tiers.length - 1];
  const back = tierBack(last);
  pts.push([back, 0]);
  void back;
  return pts;
}

/** 屋盖板轮廓 [u, y] */
function roofOutline(key) {
  const s = STANDS[key];
  const last = s.tiers[s.tiers.length - 1];
  const back = tierBack(last);
  const rh = s.roofHeight;
  const front = roofFront(key);
  return [[front, rh - 1.2], [back + 1.6, rh - 1.2], [back + 1.6, rh], [front, rh]];
}

/**
 * 1:1000 缩略剖面。which = 'z'（南北 2—2，左北右南）| 'x'（东西 3—3，左西右东）
 * window 为该方向的取景范围（米，世界坐标）
 */
function sectionMini(which, cfg, o) {
  const { x0, k, baseY, win, label } = o;
  const XW = (w) => x0 + (w - win[0]) * k;
  const YY = (y) => baseY - y * k;
  const out = [];
  const keys = which === 'z' ? ['north', 'south'] : ['west', 'east'];
  const toWorld = (key, u) => {
    if (key === 'north') return -(B + u);
    if (key === 'south') return (B + u);
    if (key === 'west') return -(A + u);
    return (A + u);
  };
  // 地面线与草坪
  out.push(L(x0 - 6, baseY, x0 + (win[1] - win[0]) * k + 6, baseY, { stroke: INK, w: 0.7 }));
  const pw = which === 'z' ? [-PITCH.width / 2, PITCH.width / 2] : [-PITCH.length / 2, PITCH.length / 2];
  out.push(L(XW(pw[0]), baseY, XW(pw[1]), baseY, { stroke: '#2f6b32', w: 1.8 }));
  out.push(T(XW(pw[0]) - 1, baseY + 3.6, '草坪', { size: 2.5, fill: '#2f6b32', anchor: 'end' }));
  // 看台实体 + 屋盖板
  keys.forEach((key) => {
    const mass = massOutline(key).map(([u, y]) => [XW(toWorld(key, u)), YY(y)]);
    out.push(PG(mass, { fill: 'url(#strip-conc)', stroke: C.standEdge, w: 0.35, join: 'round' }));
    const roof = roofOutline(key).map(([u, y]) => [XW(toWorld(key, u)), YY(y)]);
    out.push(PG(roof, { fill: C.roof, stroke: C.roofEdge, w: 0.4 }));
    // 外墙脚线
    out.push(L(XW(toWorld(key, standBack(key))), YY(0), XW(toWorld(key, standBack(key))), YY(cfg.cut), {
      stroke: C.standEdge, w: 0.3, dash: '2 2',
    }));
  });
  // 剖切面（红虚线）
  const cutY = YY(cfg.cut);
  out.push(L(x0 - 4, cutY, x0 + (win[1] - win[0]) * k + 4, cutY, { stroke: C.cut, w: 0.55, dash: '6 2.5' }));
  out.push(T(x0 - 4, cutY - 1.4, `+${cfg.cut.toFixed(2)}`, { size: 2.7, fill: C.cut, weight: 'bold', mono: true }));
  // 逐层剖切标高线（可选）：o.levels = [{ no, cut, xFrac }]
  (o.levels ?? []).forEach((L2) => {
    const ly = YY(L2.cut);
    out.push(L(x0 - 4, ly, x0 + (win[1] - win[0]) * k + 4, ly,
      { stroke: C.cut, w: 0.4, dash: L2.dash ?? '3.5 2.5', opacity: 0.9 }));
    const lx = x0 + (win[1] - win[0]) * k * L2.xFrac;
    out.push(R(lx, ly - 5.8, 16.6, 4.5, { fill: '#ffffff', stroke: C.cut, w: 0.35, opacity: 0.95 }));
    out.push(T(lx + 1.1, ly - 2.5, `${L2.no} · +${L2.cut.toFixed(2)}`, { size: 2.45, fill: C.cut, mono: true, weight: 'bold' }));
  });
  // 逐层段标高（可选）
  if (o.tierLabels) {
    keys.forEach((key) => {
      STANDS[key].tiers.forEach((t, i) => {
        const u = t.startDepth + tierDepth(t) * 0.5;
        const tp = tierTop(t);
        out.push(T(XW(toWorld(key, u)), YY(tp) - 2.2,
          `L${i + 1} ${t.rows}排 +${t.baseHeight.toFixed(2)}~+${tp.toFixed(2)}`,
          { size: 2.4, anchor: 'middle', fill: INK2, mono: true }));
      });
    });
  }
  // 标高刻度
  for (let lv = 0; lv <= 50; lv += 10) {
    out.push(L(x0 - 8, YY(lv), x0 - 5, YY(lv), { stroke: HAIR, w: 0.3 }));
    out.push(T(x0 - 9, YY(lv) + 1.0, `+${lv}`, { size: 2.5, anchor: 'end', fill: INK3, mono: true }));
  }
  // 标注
  out.push(T(x0 + (win[1] - win[0]) * k / 2, baseY + 9.5, label, { size: 3.0, anchor: 'middle', fill: INK2, weight: 'bold' }));
  keys.forEach((key) => {
    const last = STANDS[key].tiers[STANDS[key].tiers.length - 1];
    const mid = toWorld(key, tierBack(last) / 2);
    out.push(T(XW(mid), baseY + 5.0, `${STAND_SHORT[key]} ${STANDS[key].tiers.length} 层段`, {
      size: 2.7, anchor: 'middle', fill: INK3,
    }));
    out.push(T(XW(toWorld(key, standBack(key) / 2)), YY(STANDS[key].roofHeight) - 2.0,
      `屋盖 +${STANDS[key].roofHeight.toFixed(1)}`, { size: 2.5, anchor: 'middle', fill: C.roofEdge, mono: true }));
  });
  return out.join('');
}

function sectionStrip(cfg) {
  const out = [];
  out.push(panel(STRIP.x, STRIP.y, STRIP.w, STRIP.h,
    '剖切关系 · 剖面 2—2（南北）/ 3—3（东西） 1:1000',
    { note: '红虚线 = 本层剖切标高' }));
  out.push(T(STRIP.x + 4, STRIP.y + 16,
    `本层 ${cfg.no} · ${cfg.titleShort} —— 本层剖切 +${cfg.cut.toFixed(2)} m${cfg.level != null ? `（楼面 +${cfg.level.toFixed(2)} m + 1.40 m）` : '（檐口之上俯视）'}：${cfg.cutNote}`,
    { size: 2.8, fill: C.cut }));
  out.push(sectionMini('z', cfg, { x0: 60, k: 1.0, baseY: SEC_BASEY, win: [-132, 92], label: '剖面 2—2 南北 · 左北右南 · 通过 X = 0' }));
  out.push(sectionMini('x', cfg, { x0: 320, k: 1.0, baseY: SEC_BASEY, win: [-132, 132], label: '剖面 3—3 东西 · 左西右东 · 通过 Z = 0' }));
  return out.join('');
}

/* ===========================================================================
 * 6b. 逐层剖面谱（11 号图）与角部象限专项（12 号图）
 * ========================================================================= */

/** 五张平面图的剖切标高（层楼面 +1.40 m = 通行净高口径） */
const LEVEL_LINES = [
  { no: '06', name: '场地层', cut: 1.20, xFrac: 0.09 },
  { no: '07', name: '首层', cut: 3.60, xFrac: 0.55 },
  { no: '08', name: '中层', cut: 19.40, xFrac: 0.09 },
  { no: '09', name: '上层', cut: 34.60, xFrac: 0.55 },
  { no: '10', name: '屋面层', cut: 49.60, xFrac: 0.09 },
];

const LEVEL_ROSTER = '逐层剖切标高（层楼面 +1.40 m 为通行净高，均为推算值）：'
  + LEVEL_LINES.map((l) => `${l.no} ${l.name} → 切 +${l.cut.toFixed(2)}`).join(' · ');

/** 表格用的单字看台简称 */
const STAND_1 = { north: '北', south: '南', east: '东', west: '西' };

/** 某剖切标高切到的层段，压缩成表格式短串：北L1·南L1·东L1·西L1 @ 8.5 m */
function cutTierBrief(cut) {
  const act = ALL_TIERS.filter((t0) => bandState(t0.tier, cut) === 'active');
  if (!act.length) return '无';
  const ds = act.map((t0) => cutDepth(t0.tier, cut));
  const same = ds.every((d) => Math.abs(d - ds[0]) < 0.05);
  const names = act.map((t0) => `${STAND_1[t0.key]}L${t0.idx + 1}`).join('·');
  return same
    ? `${names} @ ${ds[0].toFixed(1)} m`
    : act.map((t0, i) => `${STAND_1[t0.key]}L${t0.idx + 1}@${ds[i].toFixed(1)}m`).join(' ');
}

/** 逐层剖切对照表的一行说明（对应各层平面图的 cutNote 精简版） */
const CUT_BRIEF = {
  '06': '草坪与跑动区；看台首排踏面 +2.20 m 在剖切面之上',
  '07': '四座看台 L1 座席带（下层看台）',
  '08': '北 / 东 / 西 L2 座席带；南看台单层，无座席被切',
  '09': '仅北看台 L3 到达该标高',
  '10': '檐口之上俯视，表达四座看台屋盖',
};

/** 逐层剖切对照表：本图是 06—10 的剖切依据，故把五个标高并列成表 */
function drawCutTable() {
  const out = [];
  const cols = [
    { t: '图号', w: 20 }, { t: '层名', w: 62 }, { t: '层楼面', w: 44 },
    { t: '剖切标高', w: 46 }, { t: '被切层段 / 进深', w: 118 }, { t: '说明', w: 164 },
  ];
  const rows = SHEETS_PLAN.map((p) => [
    { t: p.no },
    { t: p.titleShort, align: 'start', noMono: true },
    { t: p.level == null ? '檐口 +49.00' : `+${p.level.toFixed(2)}` },
    { t: `+${p.cut.toFixed(2)}`, fill: C.cut, weight: 'bold' },
    { t: cutTierBrief(p.cut), align: 'start', noMono: true },
    { t: CUT_BRIEF[p.no] ?? '', align: 'start', noMono: true },
  ]);
  const h = 8 + 8 + rows.length * 8.6 + 10;
  out.push(panel(22, 446, 460, h, '逐层剖切对照表（06—10 的剖切依据）',
    { note: '剖切标高 = 层楼面 +1.40 m · 均为推算值' }));
  out.push(table(25, 458, 454, cols, rows, { rh: 8.6, size: 2.7, hs: 2.7 }));
  out.push(T(25, 446 + h - 3.6,
    '进深 = 剖切面与看台斜面的交线、到该层段内缘的进深（沿看台外法线方向）。', { size: 2.6, fill: INK3 }));
  return out;
}

function drawCutSheet(cfg) {
  const out = [];
  const ov = { levels: LEVEL_LINES, tierLabels: true, noCut: true };
  const NS = { x0: 28, k: 2.0, baseY: 250, win: [-132, 92] };
  const EW = { x0: 34, k: 1000 / 600, baseY: 392, win: [-132, 132] };

  out.push(frame());
  out.push(T(FRAME.l + 6, 28, `${cfg.no} · ${cfg.name}`, { size: 8.4, weight: 'bold' }));
  out.push(T(FRAME.l + 6, 37, `${cfg.en} OLD TRAFFORD · A1 841×594 mm · ${cfg.scale}`, { size: 3.4, fill: INK2, mono: true }));
  out.push(levelStrip(FRAME.l + 6, 46));
  out.push(T(FRAME.l + 6, 56, '图面约定：剖切面为竖直平面，2—2 通过 X = 0（自西向东看，左北右南）、3—3 通过 Z = 0（自南向北看，左西右东）；'
    + '看台与屋盖轮廓逐排由 js/data.js 推出，无手写坐标；虚线为层间平台外缘。', { size: 2.9, fill: INK3 }));
  out.push(T(FRAME.l + 6, 66, LEVEL_ROSTER, { size: 2.9, fill: C.cut }));

  // 图例（横向三项）
  let lx = FRAME.l + 6;
  out.push(R(lx, 74, 7, 3.6, { fill: 'url(#strip-conc)', stroke: C.standEdge, w: 0.3 }));
  out.push(T(lx + 9, 77.5, '看台结构（座席体量，逐排踏面）', { size: 2.75, fill: INK2 }));
  lx += 68;
  out.push(R(lx, 74, 7, 3.6, { fill: C.roof, stroke: C.roofEdge, w: 0.3 }));
  out.push(T(lx + 9, 77.5, '屋盖板（前缘悬挑 / 后缘支点）', { size: 2.75, fill: INK2 }));
  lx += 74;
  out.push(L(lx, 76, lx + 8, 76, { stroke: C.cut, w: 0.55, dash: '3.5 2.5' }));
  out.push(T(lx + 10, 77.5, '红色方框 = 各层平面图的剖切标高', { size: 2.75, fill: C.cut }));

  out.push(panel(22, 86, 460, 190, '剖面 2—2（南北）1:500 · 通过 X = 0 · 左北右南',
    { note: '草坪 105 m（沿 X）· 北看台三层 / 南看台单层' }));
  out.push(sectionMini('z', cfg, { ...NS, ...ov, label: '剖面 2—2 南北 · 左北右南 · 通过 X = 0' }));

  out.push(panel(22, 282, 460, 156, '剖面 3—3（东西）1:600 · 通过 Z = 0 · 左西右东',
    { note: '草坪 68 m（沿 Z）· 东看台两层 / 西看台两层' }));
  out.push(sectionMini('x', cfg, { ...EW, ...ov, label: '剖面 3—3 东西 · 左西右东 · 通过 Z = 0' }));

  out.push(...drawCutTable());

  out.push(...sidePanels(cfg));
  out.push(titleBlock({ no: cfg.no, name: cfg.titleName ?? cfg.name, scale: cfg.scale }));
  return svgDoc({
    title: `${cfg.no} ${cfg.name}`,
    desc: '老特拉福德球场逐层剖面谱：剖面 2—2 南北 1:500、剖面 3—3 东西 1:600，标注 06—10 各层剖切标高',
    body: out.join(''),
  });
}

/** 碗体圆角沿 45° 方向的内缘半径：解 (x−CX)² + (x−CZ)² = R² 在射线 z = −x 上的远交点，再 × √2 */
const CORNER_R_BOWL = (() => {
  const CX = BOWL_INNER.halfX - BOWL_INNER.cornerRadius;
  const CZ = BOWL_INNER.halfZ - BOWL_INNER.cornerRadius;
  const R0 = BOWL_INNER.cornerRadius;
  const sm = CX + CZ;
  return ((sm + Math.sqrt(sm * sm - 2 * (CX * CX + CZ * CZ - R0 * R0))) / 2) * Math.SQRT2;
})();

/** 草坪沿 45° 方向的角点半径：射线 z = −x 穿过边线 z = −宽/2 */
const CORNER_R_PITCH = (PITCH.width / 2) * Math.SQRT2;

/** 45° 对角剖面（示意）：沿对角线方向，看台进深按 1/cos45° ≈ 1.414 展绘 */
function cornerSection(o) {
  const { x0, k, baseY, r0, rMax } = o;
  const XR = (r) => x0 + (r - r0) * k;
  const YY = (y) => baseY - y * k;
  const SL = Math.SQRT2;
  const key = 'north';
  const s = STANDS[key];
  const out = [];
  const R = (u) => CORNER_R_BOWL + u * SL;
  // 地面、草坪、跑动区、碗体内缘
  out.push(L(XR(r0), baseY, XR(rMax) + 4, baseY, { stroke: INK, w: 0.7 }));
  out.push(L(XR(r0), baseY, XR(CORNER_R_PITCH), baseY, { stroke: '#2f6b32', w: 1.8 }));
  out.push(T(XR(r0) + 1.2, baseY + 4.8, `草坪（45° 角点 r = ${CORNER_R_PITCH.toFixed(1)} m）`, { size: 2.5, fill: '#2f6b32' }));
  out.push(L(XR(CORNER_R_BOWL), baseY, XR(CORNER_R_BOWL), YY(46), { stroke: '#0f6e8c', w: 0.35, dash: '6 2.5' }));
  out.push(T(XR(CORNER_R_BOWL) + 1.4, baseY + 9.2, `碗体内缘 r = ${CORNER_R_BOWL.toFixed(1)} m`, { size: 2.5, fill: '#0f6e8c' }));
  // 逐层踏面
  s.tiers.forEach((t, i) => {
    const pts = [[R(t.startDepth), t.baseHeight]];
    for (let r = 0; r < t.rows; r++) {
      const u = t.startDepth + (r + 1) * t.rowDepth;
      pts.push([R(u), t.baseHeight + r * t.rowRise]);
      pts.push([R(u), t.baseHeight + (r + 1) * t.rowRise]);
    }
    pts.push([R(tierBack(t)), 0]);
    pts.push([R(0), 0]);
    out.push(PG(pts.map(([x, y]) => [XR(x), YY(y)]), { fill: 'url(#strip-conc)', stroke: C.standEdge, w: 0.35, join: 'round' }));
    // 踏面红线
    let pv = null;
    for (let r = 0; r <= t.rows; r++) {
      const u = t.startDepth + r * t.rowDepth;
      const y = t.baseHeight + r * t.rowRise;
      const p = [XR(R(u)), YY(y)];
      if (pv) out.push(L(pv[0], pv[1], p[0], p[1], { stroke: '#c8102e', w: 0.28, opacity: 0.5 }));
      pv = p;
    }
    out.push(T(XR(R(t.startDepth + tierDepth(t) * 0.5)), YY(tierTop(t)) - 2.2,
      `L${i + 1} ${t.rows}排 +${t.baseHeight.toFixed(2)}~+${tierTop(t).toFixed(2)}`,
      { size: 2.45, anchor: 'middle', fill: INK2, mono: true }));
  });
  // 角部象限座席（相邻两看台 L2 的 45° 弧段各半）
  const t2 = s.tiers[1];
  out.push(R(XR(R(t2.startDepth)), YY(tierTop(t2)), XR(R(tierBack(t2))) - XR(R(t2.startDepth)), 9.5,
    { fill: '#f6e6c8', stroke: '#b08a3e', w: 0.4 }));
  out.push(T((XR(R(t2.startDepth)) + XR(R(tierBack(t2)))) / 2, YY(tierTop(t2)) + 5.6,
    '角部象限座席（相邻两看台 L2 的 45° 弧段各半，与相邻看台几何重合）', { size: 2.45, anchor: 'middle', fill: '#8a6a28' }));
  // 屋盖
  const roof = [[R(roofFront(key)), s.roofHeight - 1.2], [R(tierBack(s.tiers[s.tiers.length - 1]) + 1.6), s.roofHeight - 1.2],
    [R(tierBack(s.tiers[s.tiers.length - 1]) + 1.6), s.roofHeight], [R(roofFront(key)), s.roofHeight]];
  out.push(PG(roof.map(([x, y]) => [XR(x), YY(y)]), { fill: C.roof, stroke: C.roofEdge, w: 0.4 }));
  out.push(T(XR((R(roofFront(key)) + R(tierBack(s.tiers[s.tiers.length - 1]))) / 2), YY(s.roofHeight) - 2.2,
    `屋盖 +${s.roofHeight.toFixed(1)} · 前缘进深 ${roofFront(key).toFixed(1)} m（口径 A）`, { size: 2.5, anchor: 'middle', fill: C.roofEdge, mono: true }));
  // 各层剖切标高线
  LEVEL_LINES.forEach((L2) => {
    const ly = YY(L2.cut);
    out.push(L(XR(r0 - 3), ly, XR(rMax) + 3, ly, { stroke: C.cut, w: 0.4, dash: '3.5 2.5', opacity: 0.9 }));
    const bx = XR(r0 + 2) + (L2.no === '07' || L2.no === '09' ? 62 : 0);
    out.push(R(bx, ly - 5.8, 16.6, 4.5, { fill: '#ffffff', stroke: C.cut, w: 0.35, opacity: 0.95 }));
    out.push(T(bx + 1.1, ly - 2.5, `${L2.no} · +${L2.cut.toFixed(2)}`, { size: 2.45, fill: C.cut, mono: true, weight: 'bold' }));
  });
  return out.join('');
}

function drawCornerSheet(cfg) {
  const out = [];
  const cut = cfg.cut;
  // NE 角部平面 1:500，区域世界坐标 x 40..125、z −131..−17 → 图面 160×215 mm @ (30,180)
  const mC = mapper({ k: 1000 / 530, ox: 110.2, oy: 287.6, cx: 82.5, cy: -74, flipY: false });
  const content = [];
  content.push(R(29, 179, 163, 218, { fill: C.site, stroke: 'none' }));
  ['north', 'east'].forEach((key) => {
    STANDS[key].tiers.forEach((t, i) => content.push(drawTierBand(mC, key, t, i, cut)));
    content.push(pl(mC, ringAt(key, 0), { stroke: '#0f6e8c', w: 0.4, dash: '6 2.5' }));
    content.push(pl(mC, ringAt(key, standBack(key)), { stroke: C.standEdge, w: 0.7, join: 'round' }));
  });
  // 45° 分界线与角部标注
  const dir = 45 * D2R;
  content.push(L(mC.x(0), mC.y(0), mC.x(Math.cos(dir) * 130), mC.y(-Math.sin(dir) * 130),
    { stroke: C.quadEdge, w: 0.4, dash: '7 3' }));
  content.push(halo(mC.x(Math.cos(dir) * 100), mC.y(-Math.sin(dir) * 100) - 2,
    '45° 分界线（象限与相邻看台各半）', { size: 2.8, anchor: 'middle', fill: '#6d5f45' }));
  content.push(halo(mC.x(86), mC.y(-96) - 2, 'NE 象限 30 排 · 底 +18.00 m · 顶 +30.60 m', { size: 3.0, fill: '#6d5f45' }));
  content.push(T(33, 391, 'NE 角部放大 · 对照 08 中层环廊平面', { size: 3.2, weight: 'bold', fill: INK2 }));
  // 尺寸：圆角半径与外墙
  content.push(leader(mC.x(58.6), mC.y(-38.1), mC.x(58), mC.y(-60), '碗体圆角 R 20.0 m [推算]', { mid: mC.x(58) }));
  content.push(leader(mC.x(80), mC.y(-129), mC.x(80), mC.y(-121), '北看台外墙（总进深 85.0 m）', { mid: mC.x(80) }));
  content.push(leader(mC.x(122), mC.y(-60), mC.x(105), mC.y(-60), '东看台外墙（总进深 57.5 m）', { mid: mC.x(105) }));
  out.push(`<g clip-path="url(#clip-corner)">${content.join('')}</g>`);

  out.push(frame());
  out.push(T(FRAME.l + 6, 28, `${cfg.no} · ${cfg.name}`, { size: 8.4, weight: 'bold' }));
  out.push(T(FRAME.l + 6, 37, `${cfg.en} OLD TRAFFORD · A1 841×594 mm · ${cfg.scale}`, { size: 3.4, fill: INK2, mono: true }));
  out.push(levelStrip(FRAME.l + 6, 46));
  out.push(T(FRAME.l + 6, 56, '图面约定：本图按中层环廊标高 +19.40 m 剖切（与 08 号图同口径）；四角 2005–06 象限在 js/data.js 中为独立数据块（每角 30 排 / 底 +18.00 m），'
    + '在 js/stadium.js 中由相邻两看台 L2 的 45° 弧段各半承担，两者几何重合，图上已加注。', { size: 2.9, fill: INK3 }));

  /* A · 角部构成 */
  out.push(panel(22, 84, 222, 88, '① 角部构成（口径说明）', { note: '数据 = 图纸依据' }));
  const cornerNotes = [
    '① 数据：QUADRANTS.corners 四角各 30 排、底 +18.00 m、排距 0.75 / 排高 0.42，底标高与 L2 一致。',
    '② 模型：js/stadium.js 只建立角部空组，角部座席由相邻看台 L2 的 45° 弧段提供 —— 本图按模型口径绘制。',
    '③ 分界：相邻看台各占 45°（QUADRANTS.splitDeg = 45），故四角无独立外墙，径向通道与座席图案连续。',
    '④ 待确认：角部象限是否应比相邻 L2 多出若干排，以及角部顶标高 +30.60 m 与实际是否一致。',
  ];
  cornerNotes.forEach((s, i) => out.push(T(26, 98 + i * 11.5, s, { size: 2.8, fill: i >= 3 ? C.cut : INK2 })));

  /* B · 45° 对角剖面（示意） */
  out.push(panel(240, 84, 250, 321, '② 45° 对角剖面（示意）1:650', { note: '沿 NE 角 45° 分界线展开 · 进深 × 1/cos45° = 1.414' }));
  out.push(cornerSection({ x0: 250, k: 1000 / 650, baseY: 252, r0: 40, rMax: 186 }));
  out.push(T(246, 100, '剖面沿 NE 角的 45° 分界线方向展开（即北看台弧段与东看台弧段的交界处），'
    + '因此图中进深 = 该方向上的实际斜距；红线为逐排踏面，虚线为各层剖切标高。', { size: 2.7, fill: INK3 }));
  // 对角剖面读数表
  const cs = (u) => CORNER_R_BOWL + u * Math.SQRT2;
  const t1 = STANDS.north.tiers;
  const lastT = t1[t1.length - 1];
  const rRows = [
    ['草坪角点（45° 方向）', `${CORNER_R_PITCH.toFixed(1)} m`],
    ['碗体圆角内缘（看台起点）', `${CORNER_R_BOWL.toFixed(1)} m`],
    ['L1 前缘 / 后缘', `${cs(t1[0].startDepth).toFixed(1)} / ${cs(tierBack(t1[0])).toFixed(1)} m`],
    ['L2 前缘 / 后缘', `${cs(t1[1].startDepth).toFixed(1)} / ${cs(tierBack(t1[1])).toFixed(1)} m`],
    ['L3 前缘 / 后缘', `${cs(t1[2].startDepth).toFixed(1)} / ${cs(tierBack(t1[2])).toFixed(1)} m`],
    ['屋盖前缘 / 后缘', `${cs(roofFront('north')).toFixed(1)} / ${cs(tierBack(lastT) + 1.6).toFixed(1)} m`],
    ['角部象限座席（30 排）', '+18.00 ~ +30.60 m'],
    ['北看台总进深 85.0 m →', `${cs(standBack('north')).toFixed(1)} m（对角）`],
  ];
  out.push(table(246, 272, 238, [{ t: '要素', w: 116 }, { t: '对角方向半径 r（自草坪中心）', w: 122 }], rRows, { rh: 10.2, size: 2.6, hs: 2.6 }));
  out.push(T(246, 272 + 8 + rRows.length * 10.2 + 6.0,
    '对角读数 = 直角方向同一进深的半径 × 1.414，用于与 11 号图的 2—2 / 3—3 直角剖面互校。', { size: 2.5, fill: INK3 }));
  out.push(T(246, 272 + 8 + rRows.length * 10.2 + 12.0,
    '看台几何逐排由 js/data.js 推出：排距 0.75 m、排高 0.42 m，图中进深方向按 1.414 展绘（斜距口径）。', { size: 2.5, fill: INK3 }));

  /* C · 四角象限对照 */
  out.push(panel(22, 405, 468, 174, '③ 四角象限：数据口径 / 模型口径（由 data.js 与 stadium.js 对照）',
    { note: '2026-10-23 · tools/gen-level-sheets.mjs' }));
  const cRows = [
    ['数据（js/data.js）', 'QUADRANTS.corners：NE / SE / SW / NW 各 30 排 · 底 +18.00 m · 顶 +30.60 m · 排距 0.75 / 排高 0.42 [文献]'],
    ['模型（js/stadium.js）', '四角按 45° 分属相邻两看台；角部组为空组，象限座席由相邻看台 L2 的 45° 弧段各半承担'],
    ['几何关系', '象限底面 +18.00 m = L2 底面，两者踏面落在同一斜面上、平面投影完全重合（08 号图已表达）'],
    ['径向通道', `角部沿用相邻看台的通道节奏：每 ${SEATING.aisleEvery} 座停 ${SEATING.aisleGap.toFixed(1)} m（周期 ${(SEATING.aisleEvery * SEATING.seatWidth + SEATING.aisleGap).toFixed(1)} m）[推算]`],
    ['屋盖', '四角无独立屋盖：相邻两看台的屋盖板在 45° 处相接（10 号图可见）'],
    ['待确认', '象限排数与顶标高、是否有独立外墙、角部是否设置疏散通道 —— 需以官方图纸或现场照片复核'],
  ];
  cRows.forEach((r, i) => {
    const ry = 419 + i * 15.4;
    out.push(T(26, ry, r[0], { size: 2.9, weight: 'bold', fill: i >= 5 ? C.cut : INK }));
    const ls = wrap(r[1], 74);
    out.push(TL(96, ry, ls, { size: 2.75, fill: INK2, lh: 4.4 }));
  });

  out.push(...sidePanels(cfg));
  out.push(titleBlock({ no: cfg.no, name: cfg.titleName ?? cfg.name, scale: cfg.scale }));
  return svgDoc({
    title: `${cfg.no} ${cfg.name}`,
    desc: '老特拉福德球场角部象限专项图：NE 角部平面 1:530、45° 对角剖面示意 1:650、四角象限数据/模型口径对照',
    body: out.join(''),
  });
}

/* ===========================================================================
 * 7. 右侧面板
 * ========================================================================= */

function sidePanels(cfg) {
  const out = [];
  const x = PANEL_X, w = PANEL_W;
  let y = 34;
  const custom = !!cfg.custom;          // 11 号图（剖面谱）无单一剖切标高
  const cut = custom ? null : cfg.cut;

  /* A. 本层信息 */
  const hA = 70;
  out.push(panel(x, y, w, hA, custom ? 'A · 本图信息 · SHEET DATA' : 'A · 本层信息 · LEVEL DATA'));
  const activeList = cut == null ? [] : ALL_TIERS.filter((t0) => bandState(t0.tier, cut) === 'active');
  const rowsA = custom ? [
    ['图号 / 比例', `${cfg.no} · ${cfg.scale}`],
    ['图名', cfg.titleName],
    ['内容', cfg.contentA],
    ['剖切依据', LEVEL_LINES.map((L2) => `${L2.no} +${L2.cut.toFixed(2)}`).join(' · ')],
    ['功能', cfg.func],
  ] : [
    ['图号 / 比例', `${cfg.no} · ${cfg.scale}`],
    ['层名', cfg.name],
    ['层楼面标高', cfg.level == null ? '屋面层（北看台檐口 +49.00 m [推算]）' : `+${cfg.level.toFixed(2)} m [推算]`],
    ['本层剖切标高', `+${cut.toFixed(2)} m${cfg.level != null ? '（层楼面 +1.40 m）' : '（檐口之上俯视）'}`],
    ['本层被切到的层段', activeList.length
      ? activeList.map((t0) => `${STAND_SHORT[t0.key]} L${t0.idx + 1} @ ${cutDepth(t0.tier, cut).toFixed(1)} m`).join(' / ')
      : '无（本层无座席层段被剖切面切到）'],
    ['功能', cfg.func],
  ];
  rowsA.forEach((r, i) => {
    const ry = y + 13 + i * 9.6;
    out.push(T(x + 4, ry, r[0], { size: 2.9, fill: INK2 }));
    out.push(T(x + 96, ry, r[1], { size: 2.85, weight: i === 1 ? 'bold' : null }));
  });
  y += hA + 6;

  /* B. 四看台分层表 */
  const cols = [
    { t: '看台', w: 62 }, { t: '层段', w: 28 }, { t: '排数', w: 28 },
    { t: '内缘进深', w: 46 }, { t: '后缘进深', w: 46 }, { t: '踏面标高', w: 48 }, { t: '剖切', w: 67 },
  ];
  const rows = [];
  STAND_ORDER.forEach((key) => {
    STANDS[key].tiers.forEach((t, i) => {
      const stp = cut == null ? null : bandState(t, cut);
      rows.push([
        { t: i === 0 ? `${STANDS[key].nameZh}` : '', align: 'start', noMono: true },
        { t: `L${i + 1}` },
        { t: `${t.rows}` },
        { t: `${t.startDepth.toFixed(1)}` },
        { t: `${tierBack(t).toFixed(1)}` },
        { t: `${t.baseHeight.toFixed(2)}~${tierTop(t).toFixed(2)}` },
        {
          t: stp == null ? '—' : stp === 'active' ? `切 @ ${cutDepth(t, cut).toFixed(1)} m` : stp === 'below' ? '在下' : '在上',
          fill: stp === 'active' ? C.cut : INK3, weight: stp === 'active' ? 'bold' : null, noMono: true,
        },
      ]);
    });
  });
  const hB = 8 + 8 + rows.length * 7.6 + 14;
  out.push(panel(x, y, w, hB, 'B · 四看台分层与进深/标高（由 data.js 逐排推出）'));
  out.push(table(x + 3, y + 12, w - 6, cols, rows, { rh: 7.6, size: 2.75, hs: 2.75 }));
  out.push(T(x + 3, y + hB - 4.5,
    `四角象限 [文献]：每角 ${QUADRANTS.corners[0].rows} 排 × ${QUADRANTS.corners[0].rowDepth} m 排距，底 +${QUADRANTS.corners[0].baseHeight.toFixed(1)} m；`
    + `全场 ${ALL_TIERS.reduce((a, t0) => a + t0.tier.rows, 0)} 排 + 象限 ${QUADRANTS.corners.length * QUADRANTS.corners[0].rows} 排`, {
    size: 2.6, fill: INK2,
  }));
  y += hB + 6;

  /* C. 功能环带 */
  const rings = [];
  STAND_ORDER.forEach((key) => {
    const s = STANDS[key];
    s.tiers.forEach((t, i) => {
      if (i === 0) return;
      const prev = s.tiers[i - 1];
      const gap = t.startDepth - tierBack(prev);
      if (gap > 0.2) {
        rings.push([`${STANDS[key].nameZh} L${i} 前平台`, `${tierBack(prev).toFixed(1)} → ${t.startDepth.toFixed(1)} m`,
          `${gap.toFixed(2)} m 宽`, `+${tierTop(prev).toFixed(2)} m`]);
      }
    });
  });
  const hC = 8 + 12 + rings.length * 10.0 + 26;
  out.push(panel(x, y, w, hC, 'C · 功能环带（模型口径：层间平台 / 环廊）'));
  rings.forEach((r, i) => {
    const ry = y + 18 + i * 10.0;
    out.push(T(x + 5, ry, r[0], { size: 2.9, weight: 'bold' }));
    out.push(T(x + 5, ry + 4.4, `${r[1]}  ·  ${r[2]}  ·  平台标高 ${r[3]}`, { size: 2.7, fill: INK2, mono: true }));
  });
  const cNotes = [
    '注：模型未建室内隔墙、楼梯与卫生间等房间；「环廊」指层间平台的水平进深，非实际房间划分（README 诚实清单）。南看台单层，无层间平台。',
    `径向通道：每 ${SEATING.aisleEvery} 座停 ${SEATING.aisleGap.toFixed(1)} m（周期 ${(SEATING.aisleEvery * SEATING.seatWidth + SEATING.aisleGap).toFixed(1)} m）[推算] · 首排前区 ${STANDS.north.tiers[0].startDepth.toFixed(1)} m（startDepth）`,
  ];
  let cyN = y + hC - 20;
  cNotes.forEach((s) => {
    const ls = wrap(s, 60);
    out.push(TL(x + 4, cyN, ls, { size: 2.6, fill: INK3, lh: 4.4 }));
    cyN += ls.length * 4.4 + 2;
  });
  y += hC + 6;

  /* D. 口径与局限 */
  const notes = [
    '剖切口径：各层平面剖切标高 = 层楼面 +1.40 m；1.40 ÷ 0.42 × 0.75 = 2.50 m，故红色剖切线总落在该层段内缘进深 +2.50 m 处。',
    '屋盖口径：前缘 = 声明总进深 − roofCantilever（北 58.5 [官方] / 南 36 / 东 46 / 西 46）——与 js/stadium.js 一致。',
    '备选口径：把悬挑读作「自碗体内缘起算 58.5 m」则前缘越过后缘，两种读法对照见 10 屋面层平面图。',
    '角部象限：模型把四角 90° 按 45° 分属相邻两看台，象限座席由相邻看台的 L2 半弧承担（js/stadium.js:908 只建空组）。',
    '照片中可见的四角白色格构桁架与桅杆、座席白字拼写未参与几何，本套图纸亦不表达。',
    '图纸不是施工图、不是 BIM：草坪 105×68 [推定]，排数 / 行距 / 排高 / 环廊宽度为重建值 [推算]。',
  ];
  const dLines = notes.map((s) => {
    const ls = wrap(s, 58);
    // 折行后若末行只剩句末标点/空白，并回上一行，避免图上出现孤立符号
    while (ls.length > 1 && ls[ls.length - 1].replace(/[\s。，、；：）]/g, '').length === 0) {
      ls[ls.length - 2] += ls.pop();
    }
    return ls;
  });
  const hD = 8 + 6 + dLines.reduce((a, l) => a + l.length * 4.6 + 5.6, 0);
  out.push(panel(x, y, w, hD, 'D · 口径与局限 · NOTES'));
  let dy = y + 15;
  dLines.forEach((ls) => {
    out.push(T(x + 4, dy, '·', { size: 3, fill: INK3 }));
    out.push(TL(x + 7, dy, ls, { size: 2.65, fill: INK2, lh: 4.6 }));
    dy += ls.length * 4.6 + 5.6;
  });
  y += hD + 6;

  /* E. 全套图纸索引 */
  const idx = [
    ['01', '总平面图', '1:1000', false], ['02', '南北剖面图', '1:300', false],
    ['03', '东西剖面图', '1:300', false], ['04', '看台参数对照表', 'NTS', false],
    ['05', '数据等级图例', 'NTS', false], ['06', '场地层平面图', '1:750', false],
    ['07', '首层看台平面图', '1:750', false], ['08', '中层环廊平面图', '1:750', false],
    ['09', '上层环廊平面图', '1:750', false], ['10', '屋面层平面图', '1:750', false],
    ['11', '逐层剖面谱', '1:500', false], ['12', '角部象限专项图', '1:530/650', false],
  ];
  idx.forEach((r) => { r[3] = (r[0] === cfg.no); });
  const hE = 8 + 6 * 8.8 + 6;
  out.push(panel(x, y, w, hE, 'E · 全套图纸索引（● 为本图）', { note: '06–12 由 gen-level-sheets.mjs 生成' }));
  idx.forEach((r, i) => {
    const col = i < 6 ? 0 : 1;
    const row = i % 6;
    const ix = x + 5 + col * 160;
    const iy = y + 15 + row * 8.8;
    out.push(T(ix, iy, r[3] ? '●' : '○', { size: 2.9, fill: r[3] ? C.cut : INK3 }));
    out.push(T(ix + 5, iy, `${r[0]} ${r[1]}`, { size: 2.85, fill: r[3] ? INK : INK2, weight: r[3] ? 'bold' : null }));
    out.push(T(ix + 100, iy, r[2], { size: 2.7, fill: INK3, mono: true }));
  });
  y += hE;
  const colH = y - 34;
  if (colH > 432) console.warn(`  ! 右侧面板列高 ${colH.toFixed(1)} mm 超出可用 432 mm`);
  return out;
}

/** 按字符数硬折行（CJK 近似等宽） */
function wrap(s, n) {
  const out = [];
  let cur = '';
  for (const ch of s) {
    cur += ch;
    if (cur.length >= n) { out.push(cur); cur = ''; }
  }
  if (cur) out.push(cur);
  return out;
}

/* ===========================================================================
 * 8. SVG 文档包装与主流程
 * ========================================================================= */

const HDEFS = [
  '<defs>',
  `<clipPath id="clip-site"><rect x="${SITE.x}" y="${SITE.y}" width="${SITE.w}" height="${SITE.h}" /></clipPath>`,
  '<clipPath id="clip-corner"><rect x="28" y="178" width="165" height="220" /></clipPath>',
  '<pattern id="strip-conc" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">',
  '<rect width="6" height="6" fill="#f4f1ec" />',
  '<line x1="0" y1="0" x2="0" y2="6" stroke="#c2bcb3" stroke-width="0.5" />',
  '</pattern>',
  '</defs>',
].join('');

function svgDoc({ title, desc, body }) {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg xmlns="http://www.w3.org/2000/svg" width="${SHEET.w}mm" height="${SHEET.h}mm" viewBox="0 0 ${SHEET.w} ${SHEET.h}" role="img" aria-label="${esc(title)}" shape-rendering="geometricPrecision">`,
    `<title>${esc(title)}</title>`,
    `<desc>${esc(desc)}</desc>`,
    `<rect x="0" y="0" width="${SHEET.w}" height="${SHEET.h}" fill="#ffffff" />`,
    HDEFS,
    body,
    '</svg>',
    '',
  ].join('\n');
}

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
    ...SHEETS_PLAN.map((cfg) => [cfg.file, () => drawLevelPlan(cfg)]),
    ...SHEETS_EXTRA.map((cfg) => [cfg.file, () => cfg.draw(cfg)]),
  ];

  console.log('老特拉福德球场 · 各层平面图 / 逐层剖面图生成');
  console.log(`数据源：js/data.js（DATA_VERSION ${DATA_VERSION}）· 输出：assets/drawings/`);
  console.log('-'.repeat(80));
  let totalBytes = 0, totalEl = 0;
  for (const [name, fn] of jobs) {
    const svg = fn();
    const buf = Buffer.from(svg, 'utf8');
    writeFileSync(resolve(outDir, name), buf);
    const { n, byTag } = countElements(svg);
    totalBytes += buf.length;
    totalEl += n;
    const top = Object.entries(byTag).sort((a, b) => b[1] - a[1]).slice(0, 4)
      .map(([t, c]) => `${t}×${c}`).join(' ');
    console.log(`${name.padEnd(26, ' ')} ${String(buf.length).padStart(8, ' ')} 字节  ${String(n).padStart(6, ' ')} 个元素  ${top}`);
  }
  console.log('-'.repeat(80));
  console.log(`共 ${jobs.length} 张图，${totalBytes} 字节，${totalEl} 个元素`);
  console.log('');
  console.log('逐层剖切核对（层楼面 +1.40 m）：');
  SHEETS_PLAN.forEach((cfg) => {
    const act = ALL_TIERS.filter((t0) => bandState(t0.tier, cfg.cut) === 'active');
    console.log(`  ${cfg.no} 剖切 +${cfg.cut.toFixed(2)}  被切层段：${act.length
      ? act.map((t0) => `${STAND_SHORT[t0.key]}L${t0.idx + 1}@${cutDepth(t0.tier, cfg.cut).toFixed(1)}m`).join(' ')
      : '—'}`);
  });
}

main();