# -*- coding: utf-8 -*-
"""一次性校正 js/data.js 中的看台排数与碗体几何，使几何自洽且座位总数接近公开容量。
   所有数值仍标注 [推算]。"""
import io, re, sys

P = r'C:\Users\25718\Desktop\曼联球场\js\data.js'
s = io.open(P, encoding='utf-8').read()
orig = s
report = []

def sub1(old, new, tag):
    global s
    n = s.count(old)
    if n != 1:
        report.append(f'FAIL {tag}: 命中 {n} 次（应为 1）')
        return
    s = s.replace(old, new)
    report.append(f'OK   {tag}')

# ---- 1. 缓冲距离 ----
sub1("""  goalLine: 9.0,      // [推算] 球门线后缓冲（含广告板与摄影区）
  touchLine: 6.5,     // [推算] 边线侧缓冲""",
"""  goalLine: 12.0,     // [推算] 球门线后缓冲（含广告板与摄影区）
  touchLine: 10.0,    // [推算] 边线侧缓冲""", 'RUN_OFF')

# ---- 2. 碗体内缘 + 角部半径 + 座席模数 ----
sub1("""/** 碗体内缘矩形半宽（草坪中心到看台第一排的水平距离） */
export const BOWL_INNER = {
  halfX: PITCH.length / 2 + RUN_OFF.goalLine,   // 61.5 m —— 东/西看台前缘
  halfZ: PITCH.width / 2 + RUN_OFF.touchLine,   // 40.5 m —— 北/南看台前缘
};""",
"""/** 碗体内缘矩形半宽（草坪中心到看台第一排的水平距离） */
export const BOWL_INNER = {
  halfX: PITCH.length / 2 + RUN_OFF.goalLine,   // 64.5 m —— 东/西看台前缘（球门后方）
  halfZ: PITCH.width / 2 + RUN_OFF.touchLine,   // 44.0 m —— 北/南看台前缘（边线侧）
  /**
   * 角部圆角半径 [推算]
   * 碗体内缘取「圆角矩形」：四角以半径 cornerRadius 的圆弧取代直角，
   * 使看台在角部连续过渡。圆角切掉直角约 cornerRadius*(√2−1) ≈ 8.3 m。
   * 注意：四个圆角弧的圆心在偏移后保持不变（a、b、R 同步增大），
   * 因此各排座席线是同心圆弧 —— 这正是碗形看台的正确几何。
   */
  cornerRadius: 20.0,
  cornerCut: 20.0 * (Math.SQRT2 - 1),  // ≈ 8.28 m
};

/**
 * 座席排布模数 [推算]
 * 这三个值决定了模型生成的座席总数。它们不是实测值：
 * 公开口径只给出各看台大致座位规模与「北看台三层」这一事实。
 */
export const SEATING = {
  seatWidth: 0.45,    // [推算] 单座中心距
  rowDepth: 0.75,     // [推算] 行距（前后排中心距）
  rowRise: 0.42,      // [推算] 排高 / 视线升高值 C-value
  seatHeight: 0.46,   // [推算] 座椅背高（视觉用）
  seatDepth: 0.42,    // [推算] 座椅进深（视觉用）
  aisleEvery: 14,     // [推算] 每 14 座设一道纵向通道
};""", 'BOWL_INNER + SEATING')

# ---- 3. 北看台 ----
sub1("""      { id: 'L1', rows: 28, rowDepth: 0.78, rowRise: 0.42, startDepth: 6.0,  baseHeight: 2.2,  fascia: 5.0 },
      { id: 'L2', rows: 24, rowDepth: 0.78, rowRise: 0.42, startDepth: 34.5, baseHeight: 15.8, fascia: 5.0 },
      { id: 'L3', rows: 20, rowDepth: 0.78, rowRise: 0.42, startDepth: 60.5, baseHeight: 28.4, fascia: 0.0 },
    ],
    totalDepth: 78.0,      // [推算] = 末层 startDepth + rows*rowDepth""",
"""      { id: 'L1', rows: 32, rowDepth: 0.75, rowRise: 0.42, startDepth: 6.0,  baseHeight: 2.2,  fascia: 5.0 },
      { id: 'L2', rows: 30, rowDepth: 0.75, rowRise: 0.42, startDepth: 35.0, baseHeight: 18.0, fascia: 5.0 },
      { id: 'L3', rows: 30, rowDepth: 0.75, rowRise: 0.42, startDepth: 62.5, baseHeight: 33.2, fascia: 0.0 },
    ],
    totalDepth: 85.0,      // [推算] = 末层 startDepth + rows*rowDepth = 62.5 + 22.5""", 'north tiers')

sub1("""    roofCantilever: 58.5,  // [官方] 官方导览口径：屋盖悬挑 58.5 m
    roofCantileverNote: '官方口述导览数据；模型屋盖按其比例生成，仅前端悬挑段对应此值',
    roofHeight: 45.5,      // [推算] 屋盖前缘底标高""",
"""    roofCantilever: 58.5,  // [官方] 官方导览口径：屋盖悬挑 / 屋盖跨度 58.5 m
    roofCantileverNote:
      '官方导览口径 58.5 m 指屋盖结构跨度（无中间支撑的悬挑段）。' +
      '本模型屋盖水平覆盖自前缘向后退 58.5 m，其后 26.5 m 由后部结构支承 —— ' +
      '这是对「悬挑 58.5 m」的一种合理解读，非官方图纸复现。',
    roofHeight: 49.0,      // [推算] 屋盖前缘底标高 = 末层底标高 33.2 + 30 排 × 0.42 + 余量""", 'north roof')

# ---- 4. 南看台 ----
sub1("""      { id: 'L1', rows: 32, rowDepth: 0.78, rowRise: 0.42, startDepth: 6.0, baseHeight: 2.2, fascia: 0.0 },
    ],
    totalDepth: 31.0,
    roofCantilever: 30.0,  // [推算]
    roofHeight: 19.0,      // [推算] 显著低于北看台，构成全场轮廓落差""",
"""      { id: 'L1', rows: 40, rowDepth: 0.75, rowRise: 0.42, startDepth: 6.0, baseHeight: 2.2, fascia: 0.0 },
    ],
    totalDepth: 36.0,      // [推算] = 6.0 + 40 × 0.75
    roofCantilever: 36.0,  // [推算]
    roofHeight: 22.0,      // [推算] = 2.2 + 40 × 0.42 + 余量；显著低于北看台 49.0""", 'south tiers')

# ---- 5. 东看台 ----
sub1("""      { id: 'L1', rows: 26, rowDepth: 0.78, rowRise: 0.42, startDepth: 6.0,  baseHeight: 2.2,  fascia: 5.0 },
      { id: 'L2', rows: 22, rowDepth: 0.78, rowRise: 0.42, startDepth: 32.0, baseHeight: 15.0, fascia: 0.0 },
    ],
    totalDepth: 49.2,
    roofCantilever: 42.0,
    roofHeight: 31.0,""",
"""      { id: 'L1', rows: 32, rowDepth: 0.75, rowRise: 0.42, startDepth: 6.0,  baseHeight: 2.2,  fascia: 5.0 },
      { id: 'L2', rows: 30, rowDepth: 0.75, rowRise: 0.42, startDepth: 35.0, baseHeight: 18.0, fascia: 0.0 },
    ],
    totalDepth: 57.5,      // [推算] = 35.0 + 30 × 0.75
    roofCantilever: 46.0,  // [推算]
    roofHeight: 34.0,      // [推算]""", 'east tiers')

# ---- 6. 西看台 ----
sub1("""      { id: 'L1', rows: 26, rowDepth: 0.78, rowRise: 0.42, startDepth: 6.0,  baseHeight: 2.2,  fascia: 5.0 },
      { id: 'L2', rows: 24, rowDepth: 0.78, rowRise: 0.42, startDepth: 32.0, baseHeight: 15.0, fascia: 0.0 },
    ],
    totalDepth: 50.7,
    roofCantilever: 44.0,
    roofHeight: 33.0,""",
"""      { id: 'L1', rows: 32, rowDepth: 0.75, rowRise: 0.42, startDepth: 6.0,  baseHeight: 2.2,  fascia: 5.0 },
      { id: 'L2', rows: 32, rowDepth: 0.75, rowRise: 0.42, startDepth: 35.0, baseHeight: 18.0, fascia: 0.0 },
    ],
    totalDepth: 59.0,      // [推算] = 35.0 + 32 × 0.75
    roofCantilever: 46.0,  // [推算]
    roofHeight: 35.0,      // [推算]""", 'west tiers')

# ---- 7. 四角象限 ----
sub1("""  corners: [
    { id: 'NE', name: '东北角', x: '+', z: '-', rows: 22, rowDepth: 0.78, rowRise: 0.42, baseHeight: 15.0 },
    { id: 'SE', name: '东南角', x: '+', z: '+', rows: 22, rowDepth: 0.78, rowRise: 0.42, baseHeight: 15.0 },
    { id: 'SW', name: '西南角', x: '-', z: '+', rows: 22, rowDepth: 0.78, rowRise: 0.42, baseHeight: 15.0 },
    { id: 'NW', name: '西北角', x: '-', z: '-', rows: 22, rowDepth: 0.78, rowRise: 0.42, baseHeight: 15.0 },
  ],
  fillRadius: 26.0,   // [推算] 角部弧面填充半径""",
"""  corners: [
    { id: 'NE', name: '东北角', sx: +1, sz: -1, rows: 30, rowDepth: 0.75, rowRise: 0.42, baseHeight: 18.0 },
    { id: 'SE', name: '东南角', sx: +1, sz: +1, rows: 30, rowDepth: 0.75, rowRise: 0.42, baseHeight: 18.0 },
    { id: 'SW', name: '西南角', sx: -1, sz: +1, rows: 30, rowDepth: 0.75, rowRise: 0.42, baseHeight: 18.0 },
    { id: 'NW', name: '西北角', sx: -1, sz: -1, rows: 30, rowDepth: 0.75, rowRise: 0.42, baseHeight: 18.0 },
  ],
  /** [推算] 每个角弧按 45°/45° 分配给相邻两座看台 —— 对应现实中「角部由两侧看台共同围合」 */
  splitDeg: 45,
  cornerRadius: BOWL_INNER.cornerRadius,  // 与碗体内缘圆角一致
  cornerNote:
    '四个角弧各 90°，按 45° 分属相邻两座看台：北看台含东北、西北角各 45°，' +
    '南看台含东南、西南角各 45°，东看台含东北、东南角各 45°，西看台含西北、西南角各 45°。' +
    '因此北看台实际横扫长度 = 直段 + 两段 45° 圆弧。'""", 'quadrants')

if s == orig:
    print('!! 文件未发生变化'); sys.exit(1)

io.open(P, 'w', encoding='utf-8', newline='\n').write(s)
print('\n'.join(report))
print(f'\n字节数 {len(orig.encode("utf-8"))} -> {len(s.encode("utf-8"))}')