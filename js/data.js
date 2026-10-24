/**
 * 老特拉福德球场 · 尺寸与素材数据（契约文件）
 * ---------------------------------------------------------------------------
 * 本文件是「几何尺寸 + 视点 + 来源」的唯一真相来源（single source of truth）。
 * js/stadium.js（几何生成）与 js/app.js（渲染/交互）都必须只从这里取数，
 * 不得在别处硬编码尺寸。
 *
 * ⚠ 数据可信度分级标注贯穿本文件：
 *   [官方]  俱乐部/政府/官方数据集口径，已抓到来源
 *   [文献]  权威二手来源（stadiumdb / footballgroundguide / 地方志 等）
 *   [推算]  由已知尺寸按常规建筑做法推导，用于补全视觉比例，**非实测**
 *   [推定]  按行业标准假定（如草坪 105×68），未见本项目专属来源
 *
 * 坐标约定（右手系，单位：米）
 *   +X = 东   −X = 西
 *   +Z = 南   −Z = 北
 *   +Y = 上
 *   原点 = 草坪中心（中圈开球点）
 * ---------------------------------------------------------------------------
 */

export const DATA_VERSION = 2;
/* 2 = 2026-10 外观精细化：新增 EXTERIOR（立面分格 / 屋盖桁架 / 桅杆 / 标识）
 *     与 COLORS.exterior。座席数据未变，看台与座席排布契约与 v1 完全一致。 */

/* ===========================================================================
 * 0. 项目元信息
 * ========================================================================= */
export const META = {
  name: '老特拉福德球场',
  nameEn: 'Old Trafford',
  nickname: '梦想剧场 / Theatre of Dreams',
  club: 'Manchester United',
  clubZh: '曼彻斯特联',
  city: 'Stretford, Greater Manchester, England',
  cityZh: '英国 大曼彻斯特 斯特雷特福德',
  opened: 1910,
  openedNote: '[文献] 1910 年启用；1909 年由建筑师 Archibald Leitch 设计',
  architect: 'Archibald Leitch (1909 原始设计)',
  uefaCategory: 'UEFA 五星级球场（2006 起）',
  osGridRef: 'SJ 80944 94383 (≈ 53.4631° N, 2.2913° W)',
  osGridRefNote: '[文献] 坐标由 stadiumdb 与曼联官网交通页交叉推得',

  // 容量三口径并存，如实并列，不取平均
  capacity: {
    premierLeague: 74244, // [官方] 英超申报口径
    uefa: 74310,          // [文献] 欧战口径
    seatedOnly: 74197,    // [文献] 仅座席口径
    recordAttendance: 76962, // [文献] 1939-12-25 对 Grimsby Town（含站席）
  },

  // 各看台规模（published 数字各来源不一致，均标注）
  standSeats: {
    north: { value: 26000, src: '[文献] Sir Alex Ferguson Stand 三层，业界普遍引用 26,000' },
    south: { value: 11000, src: '[文献] Sir Bobby Charlton Stand 单层，估约 10,000–11,000' },
    east:  { value: 12000, src: '[官方] 曼联官网 / 客队球迷区所在看台，约 12,000' },
    west:  { value: 14000, src: '[文献] Stretford End 两层，估约 13,000–14,000' },
    quadrants: { value: 8000, src: '[文献] 2005–06 四角象限加建，约 8,000 座' },
  },
};

/* ===========================================================================
 * 1. 草坪与球门
 * ========================================================================= */
export const PITCH = {
  length: 105,        // [推定] 沿 X（东西向）—— 按欧足联/英超标准尺寸假定
  width: 68,          // [推定] 沿 Z（南北向）
  lengthNote: '本项目未取得老特拉福德草坪实测尺寸来源，按标准比赛场地假定',
  goalWidth: 7.32,    // [标准] FIFA
  goalHeight: 2.44,   // [标准] FIFA
  goalDepth: 2.0,     // [标准] 球门网深度（前后柱距）
  postRadius: 0.06,   // [推算] 门柱直径 12 cm
  lineWidth: 0.12,    // [标准] 场地标线宽 12 cm
  centerCircleRadius: 9.15,   // [标准]
  penaltyAreaLength: 16.5,    // [标准] 大禁区纵深
  penaltyAreaWidth: 40.32,    // [标准] 大禁区宽
  goalAreaLength: 5.5,        // [标准] 小禁区纵深
  goalAreaWidth: 18.32,       // [标准] 小禁区宽
  cornerArcRadius: 1.0,       // [标准]
  penaltySpot: 11.0,          // [标准]
  surface: 'Desso GrassMaster 混合草',
  surfaceNote: '[文献] 老特拉福德 2000 年代起使用混合草系统；模型不区分草种',
  stripes: 14,        // [推算] 草坪修剪条纹数（视觉用，非实测）
};

/* ===========================================================================
 * 2. 碗体（看台内缘）
 * ========================================================================= */

/** 草坪边线到看台第一排的缓冲距离 */
export const RUN_OFF = {
  goalLine: 12.0,     // [推算] 球门线后缓冲（含广告板与摄影区）
  touchLine: 10.0,    // [推算] 边线侧缓冲
};

/** 碗体内缘矩形半宽（草坪中心到看台第一排的水平距离） */
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
  aisleGap: 2,        // [推算] 通道净宽占 2 个座位居（0.45×2 ≈ 0.90 m，符合英国看台 0.9–1.1 m 惯例）
};

/* ===========================================================================
 * 3. 四座看台
 * ---------------------------------------------------------------------------
 * tier 字段说明（几何生成器按此逐层生成台阶与座席）
 *   rows        排数              [推算]
 *   rowDepth    行距 (m)          [推算] 0.78 —— 现代碗形看台常见值
 *   rowRise     排高 (m)          [推算] 0.42 —— 视线升高值 (C-value) 常规下限
 *   startDepth  本层第一排距碗体内缘的水平距离 (m)   [推算]
 *   baseHeight  本层第一排踏面相对草坪的高 (m)       [推算]
 *   fascia      层间环廊（休息平台）宽度 (m)         [推算]
 *   seatCount   —— 由生成器按几何算出，此处不写死
 * ========================================================================= */

export const STANDS = {
  /* ---------------------------------------------------------------------
   * 北 · 弗格森爵士看台（原 North Stand，2011-11 改名）
   * 全场最大、唯一三层，屋盖悬挑 58.5 m（官方导览口径）
   * ------------------------------------------------------------------- */
  north: {
    id: 'north',
    name: 'Sir Alex Ferguson Stand',
    nameEn: 'Sir Alex Ferguson Stand',
    nameZh: '弗格森爵士看台',
    former: 'North Stand',
    renamedNote: '[文献] 2011 年 11 月更名，以纪念弗格森爵士执教 25 周年',
    direction: 'north',
    axis: 'z-',            // 位于 −Z 一侧
    tiers: [
      { id: 'L1', rows: 32, rowDepth: 0.75, rowRise: 0.42, startDepth: 6.0,  baseHeight: 2.2,  fascia: 5.0 },
      { id: 'L2', rows: 30, rowDepth: 0.75, rowRise: 0.42, startDepth: 35.0, baseHeight: 18.0, fascia: 5.0 },
      { id: 'L3', rows: 30, rowDepth: 0.75, rowRise: 0.42, startDepth: 62.5, baseHeight: 33.2, fascia: 0.0 },
    ],
    totalDepth: 85.0,      // [推算] = 末层 startDepth + rows*rowDepth = 62.5 + 22.5
    roofCantilever: 58.5,  // [官方] 官方导览口径：屋盖悬挑 / 屋盖跨度 58.5 m
    roofCantileverNote:
      '官方导览口径 58.5 m 指屋盖结构跨度（无中间支撑的悬挑段）。' +
      '本模型屋盖水平覆盖自前缘向后退 58.5 m，其后 26.5 m 由后部结构支承 —— ' +
      '这是对「悬挑 58.5 m」的一种合理解读，非官方图纸复现。',
    roofHeight: 49.0,      // [推算] 屋盖前缘底标高 = 末层底标高 33.2 + 30 排 × 0.42 + 余量
    facade: {
      style: '三层横向色带 + 竖向密肋金属板',
      baseColor: '#6d6a66',   // 石材基座
      panelColor: '#8d9198',  // 金属板
      accentColor: '#c8102e', // 俱乐部红
      bandCount: 3,
      note: '[推算] 外立面材质与分格为重建；未取得官方建筑图纸',
    },
    stairsOfficial: 177,   // [官方] 官方导览台阶数 177 级
    seats: META.standSeats.north,
  },

  /* ---------------------------------------------------------------------
   * 南 · 博比·查尔顿爵士看台（原 South Stand，2016-04 改名）
   * ⭐ 全场唯一单层看台 —— 这是老特拉福德形体不对称的根本原因
   * ------------------------------------------------------------------- */
  south: {
    id: 'south',
    name: 'Sir Bobby Charlton Stand',
    nameEn: 'Sir Bobby Charlton Stand',
    nameZh: '博比·查尔顿爵士看台',
    former: 'South Stand',
    renamedNote: '[文献] 2016 年 4 月更名',
    direction: 'south',
    axis: 'z+',
    tiers: [
      { id: 'L1', rows: 40, rowDepth: 0.75, rowRise: 0.42, startDepth: 6.0, baseHeight: 2.2, fascia: 0.0 },
    ],
    totalDepth: 36.0,      // [推算] = 6.0 + 40 × 0.75
    roofCantilever: 36.0,  // [推算]
    roofHeight: 22.0,      // [推算] = 2.2 + 40 × 0.42 + 余量；显著低于北看台 49.0
    asymmetryNote:
      '[关键] 南看台为单层 —— 官方久未加建，工程的与用地的限制（铁路/用地/权属）各来源说法不一，' +
      '本项目只确证「形体上它是单层」这一可见事实，成因见研究/07',
    facade: {
      style: '单层通高墙面 + 顶部窄檐',
      baseColor: '#7d5a4a',
      panelColor: '#9a7b68',
      accentColor: '#c8102e',
      bandCount: 1,
      note: '[推算] 单层看台外墙；南看台中央保留 Leitch 时期通道（1910）',
    },
    leitchGable: true,     // [文献] 南看台中央仍存 Archibald Leitch 设计的老通道山墙
    seats: META.standSeats.south,
  },

  /* ---------------------------------------------------------------------
   * 东 · 东看台（旧称 Scoreboard End）；客队球迷区所在
   * Sir Matt Busby Way 一侧，球场正门与雕像在此侧
   * ------------------------------------------------------------------- */
  east: {
    id: 'east',
    name: 'East Stand',
    nameEn: 'East Stand',
    nameZh: '东看台',
    former: 'Scoreboard End（记分牌端）',
    renamedNote: '[文献] 旧称 Scoreboard End，因历史上该端设有记分牌',
    direction: 'east',
    axis: 'x+',
    awayFans: true,
    awayFansNote: '[官方] 曼联官网口径：客队球迷区位于东看台',
    tiers: [
      { id: 'L1', rows: 32, rowDepth: 0.75, rowRise: 0.42, startDepth: 6.0,  baseHeight: 2.2,  fascia: 5.0 },
      { id: 'L2', rows: 30, rowDepth: 0.75, rowRise: 0.42, startDepth: 35.0, baseHeight: 18.0, fascia: 0.0 },
    ],
    totalDepth: 57.5,      // [推算] = 35.0 + 30 × 0.75
    roofCantilever: 46.0,  // [推算]
    roofHeight: 34.0,      // [推算]
    facade: {
      style: '两层 + 通高玻璃幕主入口（正门面）',
      baseColor: '#5f5c58',
      panelColor: '#7f858c',
      accentColor: '#c8102e',
      bandCount: 2,
      note: '[推算] 东侧为球场主面，模型在此侧设主入口体量与队名标识带',
    },
    entranceFacade: true,  // 主入口面
    seats: META.standSeats.east,
  },

  /* ---------------------------------------------------------------------
   * 西 · 斯特雷特福德端（Stretford End）
   * 球门后方的传统「Kop」端，曼联死忠区
   * ------------------------------------------------------------------- */
  west: {
    id: 'west',
    name: 'Stretford End',
    nameEn: 'Stretford End',
    nameZh: '斯特雷特福德端',
    former: 'West Stand',
    renamedNote: '[文献] 传统死忠看台，英文中 "End" 特指球门后方看台',
    direction: 'west',
    axis: 'x-',
    behindGoal: true,
    tiers: [
      { id: 'L1', rows: 32, rowDepth: 0.75, rowRise: 0.42, startDepth: 6.0,  baseHeight: 2.2,  fascia: 5.0 },
      { id: 'L2', rows: 32, rowDepth: 0.75, rowRise: 0.42, startDepth: 35.0, baseHeight: 18.0, fascia: 0.0 },
    ],
    totalDepth: 59.0,      // [推算] = 35.0 + 32 × 0.75
    roofCantilever: 46.0,  // [推算]
    roofHeight: 35.0,      // [推算]
    facade: {
      style: '两层 + 端部大幅红色标识面',
      baseColor: '#63605c',
      panelColor: '#82878e',
      accentColor: '#c8102e',
      bandCount: 2,
      note: '[推算] 西端为死忠区，模型在此侧设置巨幅红色旗面语言',
    },
    // ⭐ 实证：西侧无公共街道（见研究/06）
    contextNote:
      '[实测] 经 KartaView 街景与 OSM 步行网络核查：Stretford End 外侧无公共街道，' +
      '可达性显著低于东/北侧。周边道路与实测证据见 研究/06-周边道路与可达性.md',
    seats: META.standSeats.west,
  },
};

/** 四座看台的遍历顺序（供生成器与 UI 使用） */
export const STAND_ORDER = ['north', 'south', 'east', 'west'];

/* ===========================================================================
 * 4. 四角象限（2005–06 年加建）
 * ========================================================================= */
export const QUADRANTS = {
  addedYear: '2005–06 赛季',
  addedYearNote: '[文献] 四个角部象限加建，新增约 8,000 座，将看台连成连续碗体',
  seatsTotal: META.standSeats.quadrants.value,
  corners: [
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
    '因此北看台实际横扫长度 = 直段 + 两段 45° 圆弧。'
};

/* ===========================================================================
 * 5. 场地内部可见元素
 * ========================================================================= */
export const FEATURES = {
  tunnel: {
    location: 'SW 角（西南角，Stretford End 与南看台之间）',
    locationNote: '[文献] 球员通道位于西南角，球队自此入场',
    width: 3.2,
    height: 2.8,
  },
  dugouts: {
    location: '南看台前沿（Sir Bobby Charlton Stand 一侧）',
    locationNote: '[文献] 教练席与替补席位于南看台前',
    count: 2,
    length: 12.0,
    depth: 2.4,
    height: 1.9,
  },
  bigScreen: {
    location: '东看台北端与西看台南端（对角布置）',
    locationNote: '[推算] 大屏位置未取得官方来源，按对角布置重建',
    width: 12.0,
    height: 6.8,
  },
  floodlights: {
    type: '屋盖前沿灯带（非独立灯塔）',
    typeNote: '[文献] 老特拉福德为屋盖一体化照明，无独立灯塔；四角设灯桥',
    banks: 4,
    bankWidth: 22.0,
    lux: 2400,
  },
  advertisingBoards: {
    height: 0.9,
    depth: 0.12,
    distanceFromLine: 4.0,
    note: '[推算] 场边 LED 广告板',
  },
  statues: [
    {
      id: 'busby',
      name: '马特·巴斯比爵士像',
      nameEn: 'Sir Matt Busby Statue',
      location: '东看台正门前（Sir Matt Busby Way 西侧）',
      year: 1996,
      status: '[文献] 广场实测确认存在',
    },
    {
      id: 'trinity',
      name: '曼联圣三一像（贝斯特 / 劳 / 查尔顿）',
      nameEn: 'United Trinity Statue',
      location: 'Sir Matt Busby Way 东侧，正对东看台',
      year: 2008,
      status: '[官方] stadiumdb 口径：位于 Sir Matt Busby Way 对面、正对东看台',
    },
  ],
};

/* ===========================================================================
 * 6. 周边场地模型（配景；坐标由 研究/06 的方位关系反推，非精确测绘）
 * ========================================================================= */
export const CONTEXT = {
  note:
    '配景几何为示意性重建：方位关系来自 研究/06-周边道路与可达性.md 的实测与文献；' +
    '具体坐标与尺寸未逐一实测，仅用于建立正确的方位感，不得作为测绘依据。',

  roads: [
    { id: 'busbyWay',   name: 'Sir Matt Busby Way', side: 'east',  axis: 'z', offset: 132, width: 12, note: '[官方] 球场正门道路，东看台前' },
    { id: 'wharfside',  name: 'Wharfside Way',      side: 'north', axis: 'x', offset: -168, width: 14, note: '[官方] 北侧，通往 E1/E2 停车场' },
    { id: 'chester',    name: 'Chester Road (A56)', side: 'south', axis: 'x', offset: 150, width: 16, note: '[官方] 南侧干道' },
    { id: 'victoria',   name: 'Victoria Place',     side: 'south', axis: 'z', offset: 118, width: 10, note: '[官方] E3 停车场入口道路' },
  ],

  canal: {
    name: 'Bridgewater Canal',
    nameEn: 'Bridgewater Canal',
    side: 'north',
    offset: -205,
    width: 14,
    note: '[文献] 桥水运河位于场地北侧',
  },

  rail: {
    name: '铁路（Trafford Park 货运线）',
    side: 'north',
    offset: -225,
    note:
      '[文献] 北侧铁路与 Freightliner 货运站 —— 系新球场（New Trafford）选址所在；' +
      '另有南侧 Warrington 线（旧 Manchester United Halt 车站），本项目未确证二者与南看台限制的关系，见 研究/07',
  },

  carparks: [
    { id: 'N1', name: 'N1', side: 'north', x: -70, z: -150, w: 60, d: 34 },
    { id: 'N2', name: 'N2', side: 'north', x: 10,  z: -150, w: 60, d: 34, note: '[官方] 官网口径：N2 位于弗格森爵士看台一侧' },
    { id: 'N3', name: 'N3', side: 'north', x: -140, z: -190, w: 60, d: 34 },
    { id: 'N4', name: 'N4', side: 'north', x: 80,  z: -190, w: 60, d: 34 },
    { id: 'E1', name: 'E1', side: 'east',  x: 150, z: -70, w: 44, d: 60, note: '[官方] 仅比赛日开放，需许可，经由 Wharfside Way' },
    { id: 'E2', name: 'E2', side: 'east',  x: 150, z: 20,  w: 44, d: 60, note: '[官方] 非比赛日亦开放，入口 Wharfside Way West' },
    { id: 'E3', name: 'E3', side: 'south', x: 110, z: 120, w: 50, d: 40, note: '[官方] 经 Victoria Place 进入' },
    { id: 'W1', name: 'W1', side: 'west',  x: -150, z: -20, w: 44, d: 50 },
    { id: 'W2', name: 'W2', side: 'west',  x: -150, z: 60,  w: 44, d: 50, note: '[官方] 官网口径：W2 位于西看台一侧' },
    { id: 'W3', name: 'W3', side: 'west',  x: -170, z: -100, w: 44, d: 50 },
  ],

  landmarks: [
    {
      id: 'hotelFootball',
      name: 'Hotel Football',
      side: 'east',
      x: 150, z: 78, w: 34, d: 26, h: 26,
      note: '[文献] Sir Matt Busby Way 东侧，球场对面',
    },
    {
      id: 'cricketGround',
      name: 'Emirates Old Trafford（板球场）',
      side: 'north',
      x: 190, z: -300, w: 150, d: 130, h: 22,
      note: '[文献] 兰开夏板球场，位于足球场北侧偏东，两场相距约数百米',
    },
    {
      id: 'freightliner',
      name: 'Trafford Park Freightliner 货运站',
      side: 'north',
      x: 210, z: -230, w: 180, d: 90, h: 14,
      note: '[文献] 新球场（New Trafford）选址所在；规划容量约 100,000',
    },
    {
      id: 'metrolink',
      name: 'Metrolink 轻轨站',
      items: [
        { stop: 'Old Trafford', x: 240, z: 40, note: '[官方] 步行约 5 分钟' },
        { stop: 'Wharfside', x: 60, z: -190, note: '[官方] Trafford Park 线新增站' },
        { stop: 'Imperial War Museum', x: 300, z: -90, note: '[官方] Trafford Park 线新增站' },
      ],
    },
  ],

  skyline: {
    note: '[推算] 远景城市天际线为示意体量，仅用于地平线层次，非真实建筑',
    enabled: true,
  },
};

/* ===========================================================================
 * 7. 材质配色（PBR 参数）
 * ========================================================================= */
export const COLORS = {
  seat: {
    main: 0xc8102e,      // 俱乐部红
    dark: 0x8f0b20,
    highlight: 0xf2f2f2, // 白色点缀座席
    away: 0x2f3a4a,      // 客队区（东看台）深色
  },
  pitch: {
    grassLight: 0x3f7f38,
    grassDark: 0x357030,
    line: 0xf5f5f5,
  },
  structure: {
    concrete: 0x9a9a94,
    concreteDark: 0x6e6e69,
    steel: 0x8d9198,
    steelDark: 0x4a4d52,
    roofTop: 0x9ba1a8,
    roofUnder: 0x5b5f65,
    facadeStone: 0x6d6a66,
    facadePanel: 0x8d9198,
    accent: 0xc8102e,
    glass: 0x2a3a46,
  },
  context: {
    asphalt: 0x3a3a3c,
    road: 0x494a4d,
    roadMark: 0xd8d8d0,
    grass: 0x4a6b3a,
    water: 0x2b4a5a,
    gravel: 0x6a6660,
    building: 0x8a8782,
    rail: 0x707078,
  },
  /* 外观专用（2026-10 外观精细化新增） */
  exterior: {
    glazing: 0x2f3b38,     // [照片] 幕墙深绿灰玻璃
    mullion: 0xb8bfc1,     // [照片] 铝竖梃
    coping: 0xc9cec7,      // [照片] 顶部浅色压顶
    plinth: 0x55595a,      // [照片] 底部基座
    lattice: 0xe9ebec,     // [照片] 白色氟碳漆钢结构（屋盖桁架 / 桅杆）
    roofPanel: 0xdfe3e2,   // [照片] 半透明屋面板
    eave: 0x3b4245,        // [照片] 前沿深色檐口
    core: 0x8d949a,        // [照片] 四角金属包覆核心筒
    banner: 0xc8102e,      // 俱乐部红条幅
    led: 0xe0242c,         // 红色发光字标
    shopSign: 0xd8c9a0,    // 门店招牌金字
  },
  sky: {
    dayTop: 0x1f4f8b,
    dayBottom: 0xbcd4e8,
    nightTop: 0x05080f,
    nightBottom: 0x141b28,
    sunset: 0xe8955a,
  },
};

/* ===========================================================================
 * 7b. 外观：立面 / 屋盖结构 / 标识（2026-10「外观精细化」新增）
 * ---------------------------------------------------------------------------
 * 依据：用户提供的 8 张现场照片（_data/微信图片_2026102315*.jpg，下称「现场照片」）
 *       与公开文献对老特拉福德外形的描述。
 *
 * ⚠ 本节数字全部由照片按「已知尺寸」比例换算得来，一律标 [推算]：
 *   已知量 = 各看台进深 totalDepth、屋盖标高 roofHeight、碗体内缘 129.0 × 88.0。
 *   照片只能约束「比例与构件类型」，不能约束绝对尺寸；
 *   换算过程与误差区间见 研究/08-外观精细化-照片测算.md。
 *
 * 与座席的关系：本节只影响**外观**（立面皮肤、屋盖结构、桅杆、标识），
 *   不参与座席排布（js/stadium.js 第 4.6 节），改这里不会改变任何一座座席的位置。
 * ========================================================================= */
export const EXTERIOR = {
  /* ── 立面（幕墙）───────────────────────────────────────────────── */
  facade: {
    mullionSpacing: 2.6,   // [推算] 竖向分格间距（照片：立面每格 ≈ 看台深度的 1/22）
    transomSpacing: 3.2,   // [推算] 横向分格间距
    finSpacing: 5.2,       // [推算] 外凸主竖梃（真实几何，给立面以进深）
    finWidth: 0.30,        // [推算]
    finDepth: 0.45,        // [推算]
    plinthHeight: 5.4,     // [推算] 底部基座 / 门店带高度
    beltY: 15.0,           // [推算] 中部腰线标高
    beltHeight: 0.95,      // [推算]
    copingHeight: 1.10,    // [推算] 顶部浅色压顶
    copingOverhang: 0.35,  // [推算] 压顶外挑
    reflectivity: 0.86,    // 玻璃金属度（外观质感，非尺寸）
    photoRef: '现场照片 13_2 / 14_2（东立面）、16_2（鸟瞰）',
  },

  /* ── 屋盖结构：白色格构桁架体系 ───────────────────────────────── */
  roof: {
    trussSpacing: 5.2,     // [推算] 主桁架（径向）间距
    trussDepth: 1.80,      // [推算] 主桁架高（上下弦间距）
    trussChord: 0.34,      // [推算] 弦杆截面（方形近似钢管）
    trussWeb: 0.18,        // [推算] 腹杆截面
    ringSpacing: 5.2,      // [推算] 环向次梁间距
    ringSize: 0.24,        // [推算] 环向次梁截面
    eaveDepth: 2.20,       // [推算] 前沿檐口桁架高度
    panelOpacity: 0.55,    // [照片] 屋面板半透明程度（0 不透明，1 全透）
    diagonalEvery: 2,      // 每隔 N 个网格设一道斜撑（控制三角面数）
    photoRef: '现场照片 16_2 / 15_2（鸟瞰）、9_2 / 12_2（内场仰视）',
  },

  /* ── 屋盖桅杆（白色格构柱）────────────────────────────────────── */
  masts: {
    count: { north: 5, south: 3, east: 3, west: 3 },  // [照片测算] 每座看台桅杆数
    size: 2.8,             // [推算] 格构柱截面边长
    rise: 17.0,            // [推算] 柱顶高出屋盖的高度
    insetFromBack: 14.0,   // [推算] 距屋盖后缘的水平距离
    legs: 4,               // 4 根弦杆
    segments: 7,           // 竖向分节数（决定 X 形腹杆道数）
    legSize: 0.30,         // [推算] 弦杆截面
    ringSize: 0.20,        // [推算] 水平环杆截面
    webSize: 0.16,         // [推算] 斜腹杆截面
    bandRise: 1.2,         // [推算] 塔间水平格构带顶边高出柱顶
    bandDrop: 3.6,         // [推算] 格构带底边低于柱顶
    bandDivisions: 6,      // [推算] 格构带 X 形腹杆分段
    photoRef: '现场照片 13_2（东立面可见 3 座格构塔）、16_2（鸟瞰）',
  },

  /* ── 四角核心筒（灰色金属包覆）────────────────────────────────── */
  cornerCores: {
    size: 14.0,            // [推算] 平面尺寸
    heightRatio: 0.92,     // [推算] 高度 = 相邻看台屋盖高 × 该系数
    trimColor: 0xd7dbdc,   // [照片] 白色横向饰带
    trimEvery: 4.5,        // [推算] 饰带间距
    photoRef: '现场照片 16_2（四角灰白金属核心筒）',
  },

  /* ── 标识 ─────────────────────────────────────────────────────── */
  signage: {
    /* 总开关：公开展出如需「零商标风险」，把它改成 false 再重跑即可去掉全部外墙标识
       （文字标识仍属商标使用；徽章位置一律为抽象几何占位，不复制商标图形） */
    enabled: true,
    /* 东立面巨幅红条幅（照片 13_2 / 14_2） */
    bannerEast: {
      text1: 'THE REDS',
      text2: 'GO MARCHING ON!',
      width: 50.0,         // [推算] 横幅宽（占东立面直段 48 m 的主体）
      height: 9.5,         // [推算] 横幅高
      bottomY: 12.6,       // [推算] 横幅底标高
      stripes: 2,          // 左右各 2 道黑白竖条
      crest: true,         // 中央徽章位置（抽象占位，不复制商标图形）
      photoRef: '现场照片 16_2（东立面 "THE REDS GO MARCHING ON!"）',
    },
    /* 红色发光字标：每座看台正面各有一处（照片 13_2 东 / 10_2 西） */
    wordmark: {
      east: {
        text: 'MANCHESTER UNITED',
        width: 30.0,       // [推算]
        height: 2.4,       // [推算]
        aboveBanner: 1.2,  // [推算] 字标位于横幅顶以上
        photoRef: '现场照片 13_2 / 14_2（东立面 "MANCHESTER UNITED" 红色发光字）',
      },
      west: {
        text: 'STRETFORD END',
        width: 26.0,       // [推算]
        height: 2.4,       // [推算]
        aboveBanner: 1.2,
        photoRef: '现场照片 10_2 / 12_2（斯特雷特福德端 "STRETFORD END"）',
      },
      note: '字标贴在看台正面外墙，夜间转为自发光（见 js/stadium.js 的 setNight）。' +
        '西端用 "STRETFORD END" 而非俱乐部全名：照片 10_2 中该端立面的显著文字是前者。',
    },
    /* 屋盖前沿饰带（照片 10_2：西看台檐口 "STRETFORD END"） */
    eaveFascia: {
      west: { text: 'STRETFORD END', width: 30.0, height: 2.0 },
      north: { text: 'SIR ALEX FERGUSON STAND', width: 34.0, height: 1.9 },
      photoRef: '现场照片 10_2（西看台檐口白色 "STRETFORD END" 饰带）',
    },
    /* 门店招牌（照片 13_2 底部 "MEGA STORE"） */
    shop: {
      text: 'MEGA STORE',
      stands: ['east'],
      width: 13.0,
      height: 1.6,
      bottomY: 3.2,
      photoRef: '现场照片 13_2 / 14_2（东立面底部 MEGA STORE）',
    },
  },

  note:
    '外观参数只约束「看得见的形状」，不改变看台与座席。' +
    '立面材质、分格、屋盖桁架间距、桅杆数量均来自现场照片的比例换算，属于重建而非复现；' +
    '绝对尺寸（桅杆高、横幅宽、桁架间距）误差按 ±15% 计。',
};

/* ===========================================================================
 * 8. 视点（相机机位）
 * ---------------------------------------------------------------------------
 * type: 'aerial' 鸟瞰 | 'eye' 人眼高度(1.7 m) | 'section' 剖视
 * fov  : 垂直视场角（度）
 * eyeHeight 若给出，pos[1] 会被忽略并由生成器/使用者按地面高度 + eyeHeight 校正
 * ========================================================================= */
export const VIEWPOINTS = [
  {
    id: 'aerial-se', name: '东南鸟瞰', nameZh: '东南鸟瞰 · 全场',
    type: 'aerial', pos: [330, 205, 300], target: [0, 12, 0], fov: 38,
    note: '同时看见东看台、南看台单层与整体碗形轮廓差异',
  },
  {
    id: 'aerial-nw', name: '西北鸟瞰', nameZh: '西北鸟瞰 · 北看台三层',
    type: 'aerial', pos: [-330, 195, -290], target: [0, 14, 0], fov: 38,
    note: '北看台三层体量与其 58.5 m 悬挑屋盖的主视角',
  },
  {
    id: 'aerial-top', name: '正俯视', nameZh: '正俯视 · 平面关系',
    type: 'aerial', pos: [0, 430, 0.1], target: [0, 0, 0], fov: 36,
    note: '看清碗体、四角象限与草坪的平面关系',
  },
  {
    id: 'aerial-sw', name: '西南鸟瞰', nameZh: '西南鸟瞰 · 斯特雷特福德端',
    type: 'aerial', pos: [-320, 175, 310], target: [-20, 10, 0], fov: 40,
  },
  {
    id: 'east-facade', name: '东立面', nameZh: '东立面 · 正门与东看台',
    type: 'eye', pos: [250, 0, 40], target: [61.5, 24, 0], fov: 42, eyeHeight: 1.7,
    note: 'Sir Matt Busby Way 侧，主场正面观感',
  },
  {
    id: 'west-facade', name: '西端立面', nameZh: '西端 · 斯特雷特福德端',
    type: 'eye', pos: [-235, 0, 70], target: [-61.5, 20, 0], fov: 45, eyeHeight: 1.7,
    note: '实证西侧无公共街道，机位设于场地外围开阔处',
  },
  {
    id: 'north-facade', name: '北立面', nameZh: '北立面 · 弗格森爵士看台',
    type: 'eye', pos: [40, 0, -255], target: [0, 26, -40.5], fov: 48, eyeHeight: 1.7,
    note: 'Wharfside Way 侧，仰望全场最大看台',
  },
  {
    id: 'south-facade', name: '南立面', nameZh: '南立面 · 单层看台对比',
    type: 'eye', pos: [-30, 0, 215], target: [0, 12, 40.5], fov: 50, eyeHeight: 1.7,
    note: '用于对照：南看台单层与北看台三层的立面落差',
  },
  {
    id: 'tunnel-eye', name: '球员通道', nameZh: '球员视角 · 自通道入场',
    type: 'eye', pos: [-56, 0, 38], target: [40, 8, -6], fov: 60, eyeHeight: 1.7,
    note: '西南角通道出口望向草坪，还原入场视线',
  },
  {
    id: 'dugout', name: '教练席', nameZh: '教练席视角',
    type: 'eye', pos: [0, 0, 44], target: [0, 9, -40], fov: 62, eyeHeight: 1.75,
    note: '南看台前沿教练席，正对北看台三层',
  },
  {
    id: 'pitch-corner', name: '角旗', nameZh: '角旗位 · 草坪低角度',
    type: 'eye', pos: [52.5, 0, 34], target: [-30, 14, -30], fov: 66, eyeHeight: 1.7,
  },
  {
    id: 'seat-upper-n', name: '北看台顶层', nameZh: '北看台三层顶 · 俯瞰全场',
    type: 'eye', pos: [0, 42, -92], target: [0, 2, 30], fov: 58,
    note: '自弗格森爵士看台最高排俯瞰，可见南看台单层的高度落差',
  },
  {
    id: 'seat-west', name: '西看台', nameZh: '斯特雷特福德端 · 死忠区',
    type: 'eye', pos: [-78, 20, 0], target: [50, 4, 0], fov: 60,
  },
  {
    id: 'canal-far', name: '运河远眺', nameZh: '运河侧远景 · 含城市天际线',
    type: 'aerial', pos: [-140, 62, -430], target: [0, 22, 0], fov: 46,
    note: '自桥水运河一侧远眺，看球场与曼彻斯特天际线的关系',
  },
  {
    id: 'section', name: '剖视', nameZh: '剖面剖析 · 看台结构',
    type: 'section', pos: [330, 120, 0.1], target: [0, 18, 0], fov: 40, sectionAxis: 'z',
    note: '沿南北向剖开，露出三层看台台阶与屋盖悬挑',
  },
];

/* ===========================================================================
 * 9. 来源清单（供页面「档案抽屉」展示）
 * ========================================================================= */
export const SOURCES = [
  { id: 'manutd',      label: '曼联官网 · 交通与球场信息', url: 'https://www.manutd.com/', status: 'ok', tier: '官方' },
  { id: 'stadiumdb',   label: 'StadiumDB · Old Trafford', url: 'https://stadiumdb.com/stadiums/eng/old_trafford', status: 'ok', tier: '文献' },
  { id: 'fgg',         label: 'Football Ground Guide · Old Trafford', url: 'https://www.footballgroundguide.com/leagues/england/premier-league/old-trafford-manchester-united.html', status: 'ok', tier: '文献' },
  { id: 'trafford',    label: 'Trafford 自治市议会 · 地方研究馆藏', url: 'https://www.trafford.gov.uk/', status: 'ok', tier: '官方' },
  { id: 'nats',        label: 'NATS · UAS 限制空域（FRZ/RPZ）', url: 'https://nats-uk.ead-it.com/cms-nats/opencms/en/uas-restriction-zones/', status: 'ok', tier: '官方' },
  { id: 'ncap',        label: 'NCAP 国家航拍收藏', url: 'https://www.ncap.org/', status: 'ok', tier: '官方' },
  { id: 'ea-lidar',    label: '英国环境署 LiDAR 开放数据', url: 'https://ckan.publishing.service.gov.uk/', status: 'ok', tier: '官方' },
  { id: 'commonwealth', label: 'Wikimedia Commons · Old Trafford', url: 'https://commons.wikimedia.org/wiki/Category:Old_Trafford', status: 'blocked', tier: '社区', note: '本项目运行环境无法访问该域名' },
  { id: 'historiceng', label: 'Historic England · 航拍影像', url: 'https://images.historicenglandservices.org.uk/', status: 'blocked', tier: '官方', note: 'HTTP 403' },
];

/* ===========================================================================
 * 10. 免责与精度声明（页面与 README 必须同步展示）
 * ========================================================================= */
export const DISCLAIMER = {
  short: '本模型为建筑可视化重建，非施工图，不得作为测绘、施工或工程依据。',
  long: [
    '几何重建原则：凡有公开来源的尺寸一律采用来源值并标注等级；无来源处按常规建筑做法推导，' +
      '并在 js/data.js 中逐项标注为 [推算] / [推定]，绝不冒充实测。',
    '草坪尺寸 105 × 68 m 为按标准假定，未取得老特拉福德实测来源。',
    '四座看台的排数、行距、排高、层间环廊宽度均为重建值；已知的官方数据只有：' +
      '北看台三层、悬挑 58.5 m、台阶 177 级；南看台单层；容量 74,244（英超申报）。',
    '外立面材质、分格、屋顶形态为重建；未取得任何官方建筑图纸。',
    '周边道路、停车场、地标方位取自公开来源与实测核查，但坐标为示意性反推，非测绘成果。',
    '俱乐部徽章、队徽、商标：本模型不复制任何注册商标图形；立面仅使用文字标识，' +
      '徽章位置以抽象几何占位。',
  ],
};

/* ===========================================================================
 * 11. 曼联队史档案库（控制台 03 / HERITAGE 面板）
 * ---------------------------------------------------------------------------
 * 仅陈列公开发表的史实节点与冠军数，不含任何注册商标图形。
 * year 用于时间轴徽标，text 每条控制在一到两行，避免面板过长。
 * ========================================================================= */
export const HERITAGE = {
  anthem: {
    title: 'Glory Glory Man United',
    subtitle: '曼联队歌 · 循环播放',
    src: 'assets/manchester-united-anthem.mp3',
    volume: 0.55,
    note: '音频随展览循环播放，可用面板按钮或 M 键随时停止。浏览器要求先有一次交互才允许出声，'
      + '首帧被拦截时点一下播放即可。',
  },
  milestones: [
    { year: '1878', title: '牛顿希斯 LYR 队成立', text: '兰开夏与约克郡铁路公司工人组队，是曼联的前身。' },
    { year: '1902', title: '更名曼彻斯特联', text: '俱乐部财务危机后重组，改用今名与红色球衣。' },
    { year: '1910', title: '迁入老特拉福德', text: '2 月 19 日首战利物浦；Archibald Leitch 设计的碗形看台自此成形。' },
    { year: '1945', title: '马特·巴斯比接任', text: '战后重建球队，青训「巴斯比宝贝」崛起。' },
    { year: '1958', title: '慕尼黑空难', text: '2 月 6 日欧冠归途遇难，8 名球员罹难；俱乐部在废墟上重建。' },
    { year: '1968', title: '首夺欧洲冠军杯', text: '温布利 4–1 胜本菲卡，成为首支夺得欧冠的英格兰球队。' },
    { year: '1986', title: '弗格森上任', text: '11 月 6 日接手球队，此后执教 26 年。' },
    { year: '1993', title: '英超元年夺冠', text: '1992–93 赛季首夺英超，终结 26 年的联赛冠军荒。' },
    { year: '1999', title: '三冠王', text: '英超、足总杯与欧冠同季到手，欧冠决赛补时 2–1 逆转拜仁。' },
    { year: '2008', title: '莫斯科之夜', text: '欧冠决赛点球 6–5 胜切尔西，第三次捧起大耳朵杯。' },
    { year: '2013', title: '弗格森退休', text: '26 年、13 座英超冠军，北看台于 2011 年以其命名。' },
  ],
  honours: [
    { label: '顶级联赛', value: 20, note: '英格兰顶级联赛冠军' },
    { label: '足总杯', value: 13, note: 'FA Cup' },
    { label: '联赛杯', value: 6, note: 'League Cup' },
    { label: '欧洲冠军杯', value: 3, note: 'European Cup / UCL' },
  ],
  note: '史实与冠军数取自俱乐部公开记录与公开史料；本页仅作展览陈列，不含任何注册商标图形。',
};
