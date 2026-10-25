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

export const DATA_VERSION = 4;
/* 2 = 2026-10 外观精细化：新增 EXTERIOR（立面分格 / 屋盖桁架 / 桅杆 / 标识）
 *     与 COLORS.exterior。座席数据未变，看台与座席排布契约与 v1 完全一致。
 * 3 = 2026-10 新增 PLAYER_CARDS（控制台 04 / SQUAD 球员卡面），纯增量，不影响几何。
 * 4 = 2026-10 新增 ALL_TIME / ALL_TIME_CARDS（队史最佳阵容：11 首发 + 10 替补 +
 *     弗格森），纯增量，不影响几何与现役契约。 */

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
    type: 'eye', pos: [0, 38, -92], target: [0, 2, 30], fov: 58,
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
  {
    id: 'lineup', name: '阵容站位', nameZh: '阵容站位 · 死忠区视角',
    type: 'lineup', pos: [-66, 9.5, 0], target: [8, 2, 0], fov: 64,
    note: '自斯特雷特福德端球门后望向全场：11 个红色人形按 4-2-3-1 站位，'
      + '主教练在教练区；靠近任一人形会锁定推近并展示球员卡，Esc 退出',
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

/* ===========================================================================
 * 10. 曼联球员（2026-27 赛季 · 球员卡导航）
 * --------------------------------------------------------------------------
 * 口径与《docs/曼联现役首发卡面制作清单.md》一致：最近一场英超实际首发（P0）
 * + 轮换主力（P1）。号码以俱乐部 2026-08-22 公告为准；num 为 null 表示号码
 * 待核对。photo 指向 assets/球员照片/<slug>.jpg（网络抓取图，公开分发需确认授权）。
 * card 为三维数字卡面的接入位：卡面由独立工作流制作，就绪后在此填路径。
 * ========================================================================= */
export const PLAYERS_VERSION = 2;export const PLAYERS = {
  note: '数字卡面已就绪（含生涯数据与荣誉）：点击任意球员，或在阵容站位中靠近人形查看。想加入自己的球员？点抽屉顶部「＋ 添加自定义球员卡」。',
  groups: [
    {
      id: 'xi',
      title: '最近一场首发',
      titleEn: 'LAST MATCH STARTING XI',
      members: [
        { num: 1, name: 'Senne Lammens', nameZh: '森内·拉门斯', pos: 'GK', posZh: '门将', nation: 'BEL', slug: 'lammens', photo: 'assets/球员照片/lammens.jpg', card: 'assets/球员卡面/lammens.html' },
        { num: 2, name: 'Diogo Dalot', nameZh: '迪奥戈·达洛特', pos: 'RB', posZh: '右后卫', nation: 'POR', slug: 'dalot', photo: 'assets/球员照片/dalot.jpg', card: 'assets/球员卡面/dalot.html' },
        { num: 15, name: 'Leny Yoro', nameZh: '莱尼·约罗', pos: 'CB', posZh: '中后卫', nation: 'FRA', slug: 'yoro', photo: 'assets/球员照片/yoro.jpg', card: 'assets/球员卡面/yoro.html' },
        { num: 5, name: 'Harry Maguire', nameZh: '哈里·马奎尔', pos: 'CB', posZh: '中后卫', nation: 'ENG', slug: 'maguire', photo: 'assets/球员照片/maguire.jpg', card: 'assets/球员卡面/maguire.html' },
        { num: 6, name: 'Lisandro Martínez', nameZh: '利桑德罗·马丁内斯', pos: 'CB', posZh: '中后卫', nation: 'ARG', slug: 'martinez', photo: 'assets/球员照片/martinez.jpg', card: 'assets/球员卡面/martinez.html' },
        { num: 17, name: 'Andrey Santos', nameZh: '安德雷·桑托斯', pos: 'CDM', posZh: '后腰', nation: 'BRA', slug: 'santos', photo: 'assets/球员照片/santos.jpg', card: 'assets/球员卡面/santos.html' },
        { num: 20, name: 'Carlos Baleba', nameZh: '卡洛斯·巴莱巴', pos: 'CDM', posZh: '后腰', nation: 'CMR', slug: 'baleba', photo: 'assets/球员照片/baleba.jpg', card: 'assets/球员卡面/baleba.html', pending: '号码待核对' },
        { num: 16, name: 'Amad Diallo', nameZh: '阿马德·迪亚洛', pos: 'RW', posZh: '右边锋', nation: 'CIV', slug: 'amad', photo: 'assets/球员照片/amad.jpg', card: 'assets/球员卡面/amad.html' },
        { num: 18, name: 'Youri Tielemans', nameZh: '尤里·蒂莱曼斯', pos: 'CM', posZh: '中场', nation: 'BEL', slug: 'tielemans', photo: 'assets/球员照片/tielemans.jpg', card: 'assets/球员卡面/tielemans.html' },
        { num: 8, name: 'Bruno Fernandes', nameZh: '布鲁诺·费尔南德斯', pos: 'CAM', posZh: '前腰 · 队长', nation: 'POR', slug: 'fernandes', photo: 'assets/球员照片/fernandes.jpg', card: 'assets/球员卡面/fernandes.html', captain: true },
        { num: 19, name: 'Bryan Mbeumo', nameZh: '布莱恩·姆贝乌莫', pos: 'ST', posZh: '中锋', nation: 'CMR', slug: 'mbeumo', photo: 'assets/球员照片/mbeumo.jpg', card: 'assets/球员卡面/mbeumo.html' },
      ],
    },
    {
      id: 'rotation',
      title: '轮换主力',
      titleEn: 'ROTATION SQUAD',
      members: [
        { num: 10, name: 'Matheus Cunha', nameZh: '马特乌斯·库尼亚', pos: 'CF', posZh: '前锋', nation: 'BRA', slug: 'cunha', photo: 'assets/球员照片/cunha.jpg', card: 'assets/球员卡面/cunha.html' },
        { num: 30, name: 'Benjamin Šeško', nameZh: '本亚明·谢什科', pos: 'ST', posZh: '中锋', nation: 'SVN', slug: 'sesko', photo: 'assets/球员照片/sesko.jpg', card: 'assets/球员卡面/sesko.html' },
        { num: 7, name: 'Mason Mount', nameZh: '梅森·芒特', pos: 'CAM', posZh: '攻击中场', nation: 'ENG', slug: 'mount', photo: 'assets/球员照片/mount.jpg', card: 'assets/球员卡面/mount.html' },
        { num: 4, name: 'Matthijs de Ligt', nameZh: '马泰斯·德里赫特', pos: 'CB', posZh: '中后卫', nation: 'NED', slug: 'deligt', photo: 'assets/球员照片/deligt.jpg', card: 'assets/球员卡面/deligt.html' },
        { num: 3, name: 'Noussair Mazraoui', nameZh: '努萨伊尔·马兹拉维', pos: 'RB', posZh: '右后卫', nation: 'MAR', slug: 'mazraoui', photo: 'assets/球员照片/mazraoui.jpg', card: 'assets/球员卡面/mazraoui.html' },
        { num: 23, name: 'Luke Shaw', nameZh: '卢克·肖', pos: 'LB', posZh: '左后卫', nation: 'ENG', slug: 'shaw', photo: 'assets/球员照片/shaw.jpg', card: 'assets/球员卡面/shaw.html', pending: '号码待核对' },
        { num: 37, name: 'Kobbie Mainoo', nameZh: '科比·梅努', pos: 'CM', posZh: '中场', nation: 'ENG', slug: 'mainoo', photo: 'assets/球员照片/mainoo.jpg', card: 'assets/球员卡面/mainoo.html', pending: '号码待核对' },
      ],
    },
  ],
};

/* ===========================================================================
 * 11. 阵容站位（4-2-3-1 · 死忠区视角的红色人形）
 * --------------------------------------------------------------------------
 * at 为草坪坐标（米）：x 沿草坪长轴，-52.5 = 西端（死忠区）球门线，
 * 进攻方向 +X（东）。站位为 [推定]：按清单口径的 4-2-3-1 常规落点预排，
 * 逐场轮换会变，仅作示意，不是某场比赛的实测站位。
 * members[].name 必须与 PLAYERS 第一个分组（首发十一人）的 name 一致。
 * ========================================================================= */
export const LINEUP_VERSION = 1;
export const LINEUP = {
  formation: '4-2-3-1',
  note: '站位按 4-2-3-1 常规做法预排，为示意位置；鼠标靠近人形可看清球员卡。',
  members: [
    { name: 'Senne Lammens', at: [-50, 0] },
    { name: 'Diogo Dalot', at: [-36, 22] },
    { name: 'Harry Maguire', at: [-40, 8] },
    { name: 'Leny Yoro', at: [-40, -8] },
    { name: 'Lisandro Martínez', at: [-36, -22] },
    { name: 'Andrey Santos', at: [-24, -8] },
    { name: 'Carlos Baleba', at: [-24, 8] },
    { name: 'Amad Diallo', at: [0, 26] },
    { name: 'Bruno Fernandes', at: [-6, 0] },
    { name: 'Youri Tielemans', at: [-8, -20] },
    { name: 'Bryan Mbeumo', at: [18, 0] },
  ],
};

/* ===========================================================================
 * 12. 主教练（教练区 · 黑色人形，与红色球员人形区分）
 * --------------------------------------------------------------------------
 * at 为草坪坐标（米）：[推定] 南看台前沿技术区，紧邻主队教练席；
 * 卡面数据在 PLAYER_CARDS（slug: 'coach'），悬停展示正式卡面。
 * 现任主教练：迈克尔·卡里克（2026-01-13 临时接任，2026 年 5 月转正，合约至 2028；
 * 任职与履历口径见 docs/曼联队史与球员资料搜集.md 与公开报道）。
 * ========================================================================= */
export const COACH_VERSION = 2;
export const COACH = {
  slug: 'coach',
  name: 'Michael Carrick',
  nameZh: '迈克尔·卡里克',
  pos: 'HC',
  posZh: '主教练',
  nation: 'ENG',
  born: '1981',
  at: [5, 35.2],
};

/* ===========================================================================
 * 13. 球员卡面数据（与 PLAYERS[].card 对应的卡面内容，按 slug 关联）
 * ---------------------------------------------------------------------------
 * 与 assets/球员卡面/index.html 的离线卡同一套数据（_data/players-cards.json）。
 * stats 为 [标签, 值] 数组；门将（lammens）用「出场/零封/扑救」口径。
 * 照片与队徽按 URL 引用（assets/球员照片/<slug>.jpg、assets/manutd-crest-92.png），
 * 不做 base64 内嵌；「约」为公开口径约值，截至 2026-10。
 * ========================================================================= */
export const PLAYER_CARDS = {
  crest: 'assets/manutd-crest-92.png',
  photoBase: 'assets/球员照片/',
  players: [
  {
    "slug": "coach",
    "coach": true,
    "num": null,
    "pos": "HC",
    "posZh": "主教练",
    "nat": "ENG",
    "natZh": "英格兰",
    "nameZh": "迈克尔·卡里克",
    "nameEn": "MICHAEL CARRICK",
    "born": "1981",
    "statLabel": "执教生涯（约）",
    "stats": [
      [
        "场次",
        "167"
      ],
      [
        "胜场",
        "79"
      ],
      [
        "胜率",
        "47%"
      ]
    ],
    "statNote": "执教场次含米德尔斯堡与曼联（看守/临时/转正）口径，为公开来源约值，截至 2026-10",
    "achievements": [
      [
        "2006",
        "自热刺加盟曼联，开启 12 年球员生涯，3 次英超 + 欧冠冠军成员"
      ],
      [
        "2008",
        "莫斯科雨夜欧冠决赛，点球大战登场罚进，随队捧杯"
      ],
      [
        "2018",
        "挂靴，随即进入曼联教练组（穆里尼奥团队）"
      ],
      [
        "2021",
        "临危受命出任看守主帅，三战不败"
      ],
      [
        "2022",
        "出任米德尔斯堡主帅，接手时英冠第 21 位，两年半间两进升级附加赛区"
      ],
      [
        "2026-01",
        "阿莫林离任后回归，1 月 13 日接任临时主帅"
      ],
      [
        "2026-05",
        "临时任期转正，签约两年；2026-08 续约至 2028"
      ]
    ],
    "honours": [
      "英超冠军 ×5（球员）",
      "欧洲冠军联赛 ×1（2008）",
      "世俱杯 ×1（2008）",
      "足总杯 ×1（球员）",
      "联赛杯 ×2（球员）"
    ]
  },
  {
    "slug": "lammens",
    "num": "1",
    "pos": "GK",
    "posZh": "门将",
    "nat": "BEL",
    "natZh": "比利时",
    "nameZh": "森内·拉门斯",
    "nameEn": "SENNE LAMMENS",
    "born": "2002",
    "statLabel": "曼联生涯（约）",
    "stats": [
      [
        "出场",
        "45"
      ],
      [
        "零封",
        "12"
      ],
      [
        "扑救",
        "180"
      ]
    ],
    "statNote": "门将以「零封 / 扑救」口径统计，均为约值",
    "achievements": [
      [
        "2023",
        "安特卫普一线队首秀，迅速成为主力门将"
      ],
      [
        "2024-25",
        "比甲零封次数最多，获评赛季最佳门将"
      ],
      [
        "2025-08",
        "自皇家安特卫普加盟曼联，合约至 2030 年"
      ],
      [
        "2025-10",
        "首秀零封桑德兰，坐稳曼联一号门将"
      ]
    ],
    "honours": []
  },
  {
    "slug": "dalot",
    "num": "2",
    "pos": "RB",
    "posZh": "右后卫",
    "nat": "POR",
    "natZh": "葡萄牙",
    "nameZh": "迪奥戈·达洛特",
    "nameEn": "DIOGO DALOT",
    "born": "1999",
    "statLabel": "曼联生涯（官方口径）",
    "stats": [
      [
        "出场",
        "256"
      ],
      [
        "进球",
        "10"
      ],
      [
        "助攻",
        "17"
      ]
    ],
    "statNote": "manutd.com 官方口径，截至 2026-10",
    "achievements": [
      [
        "2018",
        "自波尔图加盟曼联，6 月签约 9 月首秀"
      ],
      [
        "2020-21",
        "租借 AC 米兰历练一季"
      ],
      [
        "2023 / 2024",
        "随队夺得联赛杯与足总杯冠军"
      ],
      [
        "2025-26",
        "达成曼联 250 场里程碑（队史外籍边卫罕见）"
      ]
    ],
    "honours": [
      "联赛杯×1",
      "足总杯×1",
      "欧国联×1"
    ]
  },
  {
    "slug": "yoro",
    "num": "15",
    "pos": "CB",
    "posZh": "中后卫",
    "nat": "FRA",
    "natZh": "法国",
    "nameZh": "莱尼·约罗",
    "nameEn": "LENY YORO",
    "born": "2005",
    "statLabel": "曼联生涯（约）",
    "stats": [
      [
        "出场",
        "67"
      ],
      [
        "进球",
        "3"
      ],
      [
        "助攻",
        "2"
      ]
    ],
    "statNote": "公开口径约值，截至 2026-10",
    "achievements": [
      [
        "2022",
        "16 岁完成法甲首秀（里尔青训）"
      ],
      [
        "2024-07",
        "约 7000 万欧自里尔加盟曼联"
      ],
      [
        "2025-26",
        "英超 32 场，成为主力中卫"
      ],
      [
        "2026-10",
        "完成法国国家队首秀"
      ]
    ],
    "honours": []
  },
  {
    "slug": "maguire",
    "num": "5",
    "pos": "CB",
    "posZh": "中后卫",
    "nat": "ENG",
    "natZh": "英格兰",
    "nameZh": "哈里·马奎尔",
    "nameEn": "HARRY MAGUIRE",
    "born": "1993",
    "statLabel": "曼联生涯（官方口径）",
    "stats": [
      [
        "出场",
        "280"
      ],
      [
        "进球",
        "17"
      ],
      [
        "助攻",
        "8"
      ]
    ],
    "statNote": "manutd.com 官方口径，截至 2026-10",
    "achievements": [
      [
        "2019-08",
        "8000 万镑加盟，当时世界最贵后卫"
      ],
      [
        "2020",
        "接任队长，前 100 场 79 次佩戴袖标"
      ],
      [
        "2023 / 2024",
        "随队夺得联赛杯与足总杯冠军"
      ],
      [
        "2026",
        "俱乐部生涯达成 600 场里程碑"
      ]
    ],
    "honours": [
      "联赛杯×1",
      "足总杯×1"
    ]
  },
  {
    "slug": "martinez",
    "num": "6",
    "pos": "CB",
    "posZh": "中后卫",
    "nat": "ARG",
    "natZh": "阿根廷",
    "nameZh": "利桑德罗·马丁内斯",
    "nameEn": "LISANDRO MARTINEZ",
    "born": "1998",
    "statLabel": "曼联生涯（官方口径）",
    "stats": [
      [
        "出场",
        "118"
      ],
      [
        "进球",
        "4"
      ],
      [
        "助攻",
        "3"
      ]
    ],
    "statNote": "manutd.com 官方口径，截至 2026-10",
    "achievements": [
      [
        "2022-07",
        "自阿贾克斯加盟曼联"
      ],
      [
        "2022-12",
        "随阿根廷夺得卡塔尔世界杯冠军"
      ],
      [
        "2023",
        "联赛杯冠军（加盟首季）"
      ],
      [
        "2024",
        "足总杯冠军 + 美洲杯冠军"
      ]
    ],
    "honours": [
      "世界杯×1",
      "美洲杯×1",
      "联赛杯×1",
      "足总杯×1"
    ]
  },
  {
    "slug": "santos",
    "num": "17",
    "pos": "CDM",
    "posZh": "后腰",
    "nat": "BRA",
    "natZh": "巴西",
    "nameZh": "安德雷·桑托斯",
    "nameEn": "ANDREY SANTOS",
    "born": "2004",
    "statLabel": "上赛季 · 斯特拉斯堡（队长）",
    "stats": [
      [
        "出场",
        "43"
      ],
      [
        "进球",
        "11"
      ],
      [
        "助攻",
        "5"
      ]
    ],
    "statNote": "加盟曼联前的 2025-26 赛季，公开口径",
    "achievements": [
      [
        "2023",
        "自瓦斯科达伽马加盟切尔西"
      ],
      [
        "2024-26",
        "租借斯特拉斯堡，25-26 赛季任队长"
      ],
      [
        "2026-07",
        "正式加盟曼联，身披 17 号"
      ],
      [
        "2026-08",
        "英超首秀（客场对赫尔城 0-2）"
      ]
    ],
    "honours": []
  },
  {
    "slug": "baleba",
    "num": "20",
    "pos": "CDM",
    "posZh": "后腰",
    "nat": "CMR",
    "natZh": "喀麦隆",
    "nameZh": "卡洛斯·巴莱巴",
    "nameEn": "CARLOS BALEBA",
    "born": "2004",
    "statLabel": "布莱顿生涯（2023-26）",
    "stats": [
      [
        "出场",
        "112"
      ],
      [
        "进球",
        "4"
      ],
      [
        "助攻",
        "3"
      ]
    ],
    "statNote": "转会曼联前三个赛季的公开口径",
    "achievements": [
      [
        "2022",
        "自喀麦隆青训加盟里尔（23 场）"
      ],
      [
        "2023-08",
        "转会英超布莱顿"
      ],
      [
        "2025-26",
        "跻身欧洲顶级后腰，身价约 6300 万欧"
      ],
      [
        "2026-08",
        "6500 万镑+浮动加盟曼联，接过 20 号"
      ]
    ],
    "honours": []
  },
  {
    "slug": "amad",
    "num": "16",
    "pos": "RW",
    "posZh": "右边锋",
    "nat": "CIV",
    "natZh": "科特迪瓦",
    "nameZh": "阿马德·迪亚洛",
    "nameEn": "AMAD DIALLO",
    "born": "2002",
    "statLabel": "曼联生涯（约）",
    "stats": [
      [
        "出场",
        "101"
      ],
      [
        "进球",
        "16"
      ],
      [
        "助攻",
        "13"
      ]
    ],
    "statNote": "出场数为官方口径，进球助攻为公开口径约值",
    "achievements": [
      [
        "2021-01",
        "自亚特兰大加盟曼联"
      ],
      [
        "2022-23",
        "租借桑德兰 14 球成名"
      ],
      [
        "2024-25",
        "赛季爆发，多记绝杀与约 11 球"
      ],
      [
        "2026",
        "达成曼联百场（队史第 230 位百场球员）"
      ]
    ],
    "honours": []
  },
  {
    "slug": "tielemans",
    "num": "18",
    "pos": "CM",
    "posZh": "中场",
    "nat": "BEL",
    "natZh": "比利时",
    "nameZh": "尤里·蒂莱曼斯",
    "nameEn": "YOURI TIELEMANS",
    "born": "1997",
    "statLabel": "英超生涯（官方口径）",
    "stats": [
      [
        "出场",
        "251"
      ],
      [
        "进球",
        "26"
      ],
      [
        "助攻",
        "38"
      ]
    ],
    "statNote": "premierleague.com 官方口径，截至转会曼联",
    "achievements": [
      [
        "2013",
        "16 岁于安德莱赫特首秀（184 场 35 球）"
      ],
      [
        "2021",
        "足总杯决赛远射制胜，助莱斯特城夺冠"
      ],
      [
        "2019-25",
        "莱斯特城与阿斯顿维拉共 280+ 场"
      ],
      [
        "2026-07",
        "约 3500 万镑加盟曼联，身披 18 号"
      ]
    ],
    "honours": [
      "足总杯×1"
    ]
  },
  {
    "slug": "fernandes",
    "num": "8",
    "pos": "CAM",
    "posZh": "前腰 · 队长",
    "nat": "POR",
    "natZh": "葡萄牙",
    "nameZh": "布鲁诺·费尔南德斯",
    "nameEn": "BRUNO FERNANDES",
    "born": "1994",
    "statLabel": "曼联生涯（截至 2025-06）",
    "stats": [
      [
        "出场",
        "290"
      ],
      [
        "进球",
        "98"
      ],
      [
        "助攻",
        "86"
      ]
    ],
    "statNote": "懂球帝口径；2025-26 赛季 21 助攻破英超纪录",
    "achievements": [
      [
        "2020-01",
        "冬窗加盟曼联，半个赛季即重塑中场"
      ],
      [
        "2023-02",
        "联赛杯决赛梅开二度夺冠"
      ],
      [
        "2023-07",
        "接任曼联队长"
      ],
      [
        "2024-05",
        "足总杯决赛胜曼城，第 13 次捧杯"
      ],
      [
        "2025",
        "随葡萄牙队再夺欧国联（2019 后第二次）"
      ],
      [
        "2025-26",
        "英超单季 21 次助攻，打破联赛纪录"
      ]
    ],
    "honours": [
      "联赛杯×1",
      "足总杯×1",
      "欧国联×2"
    ]
  },
  {
    "slug": "mbeumo",
    "num": "19",
    "pos": "ST",
    "posZh": "中锋",
    "nat": "CMR",
    "natZh": "喀麦隆",
    "nameZh": "布莱恩·姆贝乌莫",
    "nameEn": "BRYAN MBEUMO",
    "born": "1999",
    "statLabel": "曼联生涯（约）",
    "stats": [
      [
        "出场",
        "54"
      ],
      [
        "进球",
        "20"
      ],
      [
        "助攻",
        "8"
      ]
    ],
    "statNote": "出场进球为公开口径，助攻为约值，截至 2026-10",
    "achievements": [
      [
        "2019",
        "自特鲁瓦加盟布伦特福德"
      ],
      [
        "2019-25",
        "布伦特福德 6 季 242 场 70 球 51 助"
      ],
      [
        "2025-07",
        "加盟曼联，首季 16 球创个人英超新高"
      ],
      [
        "2025-26",
        "与谢什科并列队内射手王"
      ]
    ],
    "honours": []
  },
  {
    "slug": "cunha",
    "num": "10",
    "pos": "CF",
    "posZh": "前锋",
    "nat": "BRA",
    "natZh": "巴西",
    "nameZh": "马特乌斯·库尼亚",
    "nameEn": "MATHEUS CUNHA",
    "born": "1999",
    "statLabel": "曼联生涯（约）",
    "stats": [
      [
        "出场",
        "52"
      ],
      [
        "进球",
        "20"
      ],
      [
        "助攻",
        "10"
      ]
    ],
    "statNote": "公开口径约值，截至 2026-10",
    "achievements": [
      [
        "2017-20",
        "锡永→柏林赫塔→马竞的欧洲立足之路"
      ],
      [
        "2023-25",
        "狼队 76 场 27 球，24-25 赛季 15 球 13 助"
      ],
      [
        "2025-06",
        "约 6250 万镑解约金加盟曼联，接过 10 号"
      ],
      [
        "2025-26",
        "英超 33 场 10 球，融入锋线三叉戟"
      ]
    ],
    "honours": []
  },
  {
    "slug": "sesko",
    "num": "30",
    "pos": "ST",
    "posZh": "中锋",
    "nat": "SVN",
    "natZh": "斯洛文尼亚",
    "nameZh": "本亚明·谢什科",
    "nameEn": "BENJAMIN SESKO",
    "born": "2003",
    "statLabel": "曼联生涯（约）",
    "stats": [
      [
        "出场",
        "44"
      ],
      [
        "进球",
        "13"
      ],
      [
        "助攻",
        "3"
      ]
    ],
    "statNote": "公开口径约值，截至 2026-10",
    "achievements": [
      [
        "2021",
        "红牛萨尔茨堡出道，16 岁国家队首秀"
      ],
      [
        "2023-25",
        "莱比锡 87 场 39 球，24-25 单季 21 球"
      ],
      [
        "2025-08",
        "约 7370 万镑加盟曼联"
      ],
      [
        "2025-26",
        "12 球与姆贝乌莫并列队内射手王"
      ]
    ],
    "honours": []
  },
  {
    "slug": "mount",
    "num": "7",
    "pos": "CAM",
    "posZh": "攻击中场",
    "nat": "ENG",
    "natZh": "英格兰",
    "nameZh": "梅森·芒特",
    "nameEn": "MASON MOUNT",
    "born": "1999",
    "statLabel": "曼联生涯（约）",
    "stats": [
      [
        "出场",
        "74"
      ],
      [
        "进球",
        "9"
      ],
      [
        "助攻",
        "2"
      ]
    ],
    "statNote": "公开口径约值，截至 2026-10",
    "achievements": [
      [
        "2019",
        "切尔西青训出品，一线队首秀"
      ],
      [
        "2019-23",
        "切尔西 129 场 27 球，两度队内最佳"
      ],
      [
        "2021",
        "随切尔西夺得欧冠冠军"
      ],
      [
        "2023-07",
        "约 6000 万镑加盟曼联，接过 7 号"
      ]
    ],
    "honours": [
      "欧冠×1"
    ]
  },
  {
    "slug": "deligt",
    "num": "4",
    "pos": "CB",
    "posZh": "中后卫",
    "nat": "NED",
    "natZh": "荷兰",
    "nameZh": "马泰斯·德里赫特",
    "nameEn": "MATTHIJS DE LIGT",
    "born": "1999",
    "statLabel": "曼联生涯（官方口径）",
    "stats": [
      [
        "出场",
        "57"
      ],
      [
        "进球",
        "3"
      ],
      [
        "助攻",
        "1"
      ]
    ],
    "statNote": "manutd.com 官方口径，截至 2026-10",
    "achievements": [
      [
        "2016",
        "阿贾克斯青训首秀，18 岁任队史最年轻队长"
      ],
      [
        "2019-23",
        "尤文图斯 117 场 → 拜仁慕尼黑 73 场"
      ],
      [
        "2024-08",
        "加盟曼联"
      ],
      [
        "2024-25",
        "首季 42 场 2 球，后防中坚"
      ]
    ],
    "honours": [
      "荷甲×1",
      "意甲×2",
      "德甲×1"
    ]
  },
  {
    "slug": "mazraoui",
    "num": "3",
    "pos": "RB",
    "posZh": "右后卫",
    "nat": "MAR",
    "natZh": "摩洛哥",
    "nameZh": "努萨伊尔·马兹拉维",
    "nameEn": "NOUSSAIR MAZRAOUI",
    "born": "1997",
    "statLabel": "曼联生涯（约）",
    "stats": [
      [
        "出场",
        "80"
      ],
      [
        "进球",
        "0"
      ],
      [
        "助攻",
        "5"
      ]
    ],
    "statNote": "公开口径约值，截至 2026-10",
    "achievements": [
      [
        "2018",
        "阿贾克斯一线队立足（137 场，3 荷甲 2 杯）"
      ],
      [
        "2022-24",
        "拜仁慕尼黑 55 场，随队德甲夺冠"
      ],
      [
        "2024-08",
        "与德里赫特同日加盟曼联"
      ],
      [
        "2024-25",
        "37 场全勤级表现，右后卫/左后卫通吃"
      ]
    ],
    "honours": [
      "荷甲×3",
      "德甲×1"
    ]
  },
  {
    "slug": "shaw",
    "num": "23",
    "pos": "LB",
    "posZh": "左后卫",
    "nat": "ENG",
    "natZh": "英格兰",
    "nameZh": "卢克·肖",
    "nameEn": "LUKE SHAW",
    "born": "1995",
    "statLabel": "曼联生涯（约）",
    "stats": [
      [
        "出场",
        "330"
      ],
      [
        "进球",
        "5"
      ],
      [
        "助攻",
        "29"
      ]
    ],
    "statNote": "manutd.com 口径约值，截至 2026-10",
    "achievements": [
      [
        "2014",
        "自南安普顿加盟，当时世界最贵 U18 球员"
      ],
      [
        "2015-17",
        "断腿重伤后漫长康复，浴火重生"
      ],
      [
        "2020-21",
        "入选 PFA 英超最佳阵容，欧洲杯亚军主力"
      ],
      [
        "2023 / 2024",
        "随队夺得联赛杯与足总杯冠军"
      ]
    ],
    "honours": [
      "联赛杯×1",
      "足总杯×1"
    ]
  },
  {
    "slug": "mainoo",
    "num": "37",
    "pos": "CM",
    "posZh": "中场",
    "nat": "ENG",
    "natZh": "英格兰",
    "nameZh": "科比·梅努",
    "nameEn": "KOBBIE MAINOO",
    "born": "2005",
    "statLabel": "曼联生涯（官方口径）",
    "stats": [
      [
        "出场",
        "110"
      ],
      [
        "进球",
        "8"
      ],
      [
        "助攻",
        "6"
      ]
    ],
    "statNote": "manutd.com 官方口径，截至 2026-10",
    "achievements": [
      [
        "2014",
        "9 岁加入曼联青训营"
      ],
      [
        "2024-01",
        "足总杯对纽波特首球，随后坐稳主力"
      ],
      [
        "2024-05",
        "足总杯决赛破门，2-1 胜曼城夺冠"
      ],
      [
        "2024-07",
        "随英格兰获欧洲杯亚军，一战成名"
      ]
    ],
    "honours": [
      "联赛杯×1",
      "足总杯×1"
    ]
  }
],
};

/* ===========================================================================
 * 13. 阵型库（阵容站位的可切换阵型）
 * --------------------------------------------------------------------------
 * slots 为 11 个草坪坐标（米），顺序必须与 LINEUP.members 的槽位序一致：
 *   [门将, 右后卫, 右中卫, 中卫, 左中卫/左后卫, 中场6, 中场7, 右边/前腰8,
 *    前腰9, 左中场10, 中锋11]
 * x 沿进攻方向（+X 东），z 横向（+Z 南）；-52.5 = 西端球门线。
 * 门将坐标固定 (-50, 0)：整体对齐逻辑（findWestGoalAnchor）以此为基准。
 * 站位均为 [推定] 示意落点；来源与定位写在每套的 note 里。
 * ========================================================================= */
export const FORMATIONS_VERSION = 1;
export const FORMATIONS = {
  default: '4-2-3-1',
  list: [
    {
      id: '4-2-3-1', label: '4-2-3-1', title: '双后腰与前腰',
      note: '[文献] 英超 2024/25 使用 408 次的绝对主流：双后腰稳定出球，前腰在防线间串联。',
      slots: [[-50, 0], [-36, 22], [-40, 8], [-40, -8], [-36, -22], [-24, -8], [-24, 8], [0, 26], [-6, 0], [-8, -20], [18, 0]],
    },
    {
      id: '4-3-3', label: '4-3-3', title: '现代足球基石',
      note: '[文献] 曼城/皇马/巴黎的经典形状：单后腰控节拍，两内收中场，三叉戟拉宽进攻。',
      slots: [[-50, 0], [-36, 22], [-40, 8], [-40, -8], [-36, -22], [-14, 14], [-22, 0], [6, 26], [-14, -14], [-2, -26], [14, 0]],
    },
    {
      id: '3-4-2-1', label: '3-4-2-1', title: '三中卫 · 双前腰',
      note: '[文献] 英超 2024/25 最大上升者（117 次）：阿莫林/格拉斯纳的三中卫体系，双前腰伏击中锋。',
      slots: [[-50, 0], [-30, 24], [-40, 10], [-42, 0], [-40, -10], [-18, 8], [-18, -8], [0, 10], [0, -10], [-30, -24], [12, 0]],
    },
    {
      id: '4-1-4-1', label: '4-1-4-1', title: '单后腰 · 平行中场',
      note: '[文献] 2024/25 新入选统计（27 次）：单后腰护住中路，四中场平行保持宽度与预判。',
      slots: [[-50, 0], [-36, 22], [-40, 8], [-40, -8], [-36, -22], [-12, 8], [-26, 0], [-8, 24], [-12, -8], [-8, -24], [16, 0]],
    },
    {
      id: '4-4-2', label: '4-4-2', title: '经典双前锋',
      note: '[文献] 经典收缩防反形状（2024/25 仅 20 次）：两条紧凑四后卫/四中场线，双前锋协同压迫。',
      slots: [[-50, 0], [-36, 22], [-40, 8], [-40, -8], [-36, -22], [-14, 8], [-16, 0], [-8, 24], [10, 7], [-8, -24], [14, -7]],
    },
    {
      id: '3-5-2', label: '3-5-2', title: '孔蒂/图赫尔形状',
      note: '[文献] 中场人数优势 + 翼卫提供宽度：三中卫、双翼卫往返、双前锋顶前。',
      slots: [[-50, 0], [-28, 24], [-40, 10], [-42, 0], [-40, -10], [-16, 12], [-20, 0], [-16, -12], [10, 7], [-28, -24], [14, -7]],
    },
    {
      id: '5-3-2', label: '5-3-2', title: '低位防反',
      note: '[文献] 意大利/克罗地亚的防守变体：翼卫回收成五后卫，夺球后直打双前锋。',
      slots: [[-50, 0], [-34, 22], [-42, 10], [-44, 0], [-42, -10], [-20, 12], [-24, 0], [-20, -12], [8, 7], [-34, -22], [10, -7]],
    },
    {
      id: '3-2-4-1', label: '3-2-4-1', title: '出球压迫形状',
      note: '[文献] 2025 年教练圈热议的出球形状：双枢轴居中，边后卫前插成四人攻击线。',
      slots: [[-50, 0], [2, 22], [-40, 10], [-42, 0], [-40, -10], [-26, 7], [-26, -7], [1, 10], [1, -10], [3, -24], [14, 0]],
    },
  ],
};

/* ===========================================================================
 * 14. 队史最佳阵容（4-4-2 · 媒体与名宿口径评选，非官方）
 * --------------------------------------------------------------------------
 * 资料与评选依据见 docs/曼联历史最佳阵容卡面资料.md：主选骨架来自
 * 名宿评选汇总 + 球迷共识 + The Athletic 队史百大系列。members 顺序与槽位
 * 一一对应（门将 → 后卫 → 中场 → 前锋），at 为草坪局部坐标 [推定] 示意落点。
 * bench 为替补席 10 人（备选池全员），卡面数据在 ALL_TIME_CARDS。
 * 号码为各时代标志性号码，首发与替补间重复属正常（跨时代组合）。
 * ========================================================================= */
export const ALL_TIME_VERSION = 1;
export const ALL_TIME = {
  formation: '4-4-2',
  note: '队史最佳阵容（4-4-2 · 弗格森）：评选为媒体与名宿口径、非官方评选。替补席 10 人可像现役阵容一样「换上」登场；号码为各时代标志性号码，重复属正常。',
  coach: {
    slug: 'ferguson',
    coach: true,
    num: null,
    name: 'Alex Ferguson',
    nameZh: '亚历克斯·弗格森',
    pos: 'HC',
    posZh: '主教练',
    nation: 'SCO',
    at: [5, 35.2],
  },
  members: [
    { slug: 'schmeichel', num: 1,  name: 'Peter Schmeichel', nameZh: '彼得·舒梅切尔',   pos: 'GK', posZh: '门将',   nation: 'DEN', at: [-50, 0] },
    { slug: 'gneville',   num: 2,  name: 'Gary Neville',     nameZh: '加里·内维尔',     pos: 'RB', posZh: '右后卫', nation: 'ENG', at: [-36, 22] },
    { slug: 'ferdinand',  num: 5,  name: 'Rio Ferdinand',    nameZh: '里奥·费迪南德',   pos: 'CB', posZh: '中后卫', nation: 'ENG', at: [-40, 8] },
    { slug: 'vidic',      num: 15, name: 'Nemanja Vidić',    nameZh: '内马尼亚·维迪奇', pos: 'CB', posZh: '中后卫', nation: 'SRB', at: [-40, -8] },
    { slug: 'irwin',      num: 3,  name: 'Denis Irwin',      nameZh: '丹尼斯·埃尔文',   pos: 'LB', posZh: '左后卫', nation: 'IRL', at: [-36, -22] },
    { slug: 'best',       num: 7,  name: 'George Best',      nameZh: '乔治·贝斯特',     pos: 'RW', posZh: '右边锋', nation: 'NIR', at: [-6, 26] },
    { slug: 'keane',      num: 16, name: 'Roy Keane',        nameZh: '罗伊·基恩',       pos: 'CM', posZh: '中场 · 队长', nation: 'IRL', at: [-16, 0], captain: true },
    { slug: 'scholes',    num: 18, name: 'Paul Scholes',     nameZh: '保罗·斯科尔斯',   pos: 'CM', posZh: '中场',   nation: 'ENG', at: [-18, -10] },
    { slug: 'giggs',      num: 11, name: 'Ryan Giggs',       nameZh: '瑞恩·吉格斯',     pos: 'LW', posZh: '左边锋', nation: 'WAL', at: [-6, -26] },
    { slug: 'charlton',   num: 9,  name: 'Bobby Charlton',   nameZh: '博比·查尔顿',     pos: 'CF', posZh: '前锋',   nation: 'ENG', at: [14, 6] },
    { slug: 'law',        num: 10, name: 'Denis Law',        nameZh: '丹尼斯·劳',       pos: 'ST', posZh: '中锋',   nation: 'SCO', at: [14, -6] },
  ],
  bench: [
    { slug: 'cantona',    num: 7,  name: 'Eric Cantona',        nameZh: '埃里克·坎通纳',     pos: 'CAM', posZh: '前腰',     nation: 'FRA' },
    { slug: 'ronaldo',    num: 7,  name: 'Cristiano Ronaldo',   nameZh: '克里斯蒂亚诺·罗纳尔多', pos: 'RW', posZh: '右边锋', nation: 'POR' },
    { slug: 'beckham',    num: 7,  name: 'David Beckham',       nameZh: '大卫·贝克汉姆',     pos: 'RM',  posZh: '右前卫',   nation: 'ENG' },
    { slug: 'rooney',     num: 10, name: 'Wayne Rooney',        nameZh: '韦恩·鲁尼',         pos: 'ST',  posZh: '中锋',     nation: 'ENG' },
    { slug: 'stam',       num: 31, name: 'Jaap Stam',           nameZh: '雅普·斯塔姆',       pos: 'CB',  posZh: '中后卫',   nation: 'NED' },
    { slug: 'evra',       num: 3,  name: 'Patrice Evra',        nameZh: '帕特里斯·埃弗拉',   pos: 'LB',  posZh: '左后卫',   nation: 'FRA' },
    { slug: 'edwards',    num: null, name: 'Duncan Edwards',    nameZh: '邓肯·爱德华兹',     pos: 'CM',  posZh: '中场',     nation: 'ENG' },
    { slug: 'vandersar',  num: 1,  name: 'Edwin van der Sar',   nameZh: '埃德温·范德萨',     pos: 'GK',  posZh: '门将',     nation: 'NED' },
    { slug: 'vannistelrooy', num: 10, name: 'Ruud van Nistelrooy', nameZh: '范尼斯特鲁伊',   pos: 'ST',  posZh: '中锋',     nation: 'NED' },
    { slug: 'solskjaer',  num: 20, name: 'Ole Gunnar Solskjær', nameZh: '奥勒·索尔斯克亚',   pos: 'ST',  posZh: '中锋',     nation: 'NOR' },
  ],
};


/* ===========================================================================
 * 15. 队史最佳阵容卡面数据（与 ALL_TIME members/bench/coach 按 slug 关联）
 * --------------------------------------------------------------------------
 * 出场/进球为曼联俱乐部全赛事口径，各来源统计有差异的数据标「约」，
 * 制作展示时 statNote 如实说明。评选口径为媒体与名宿评选、非官方。
 * ========================================================================= */
export const ALL_TIME_CARDS = {
  players: [
    {
      slug: 'ferguson', coach: true, num: null, pos: 'HC', posZh: '主教练',
      nat: 'SCO', natZh: '苏格兰', nameZh: '亚历克斯·弗格森',
      nameEn: 'SIR ALEX FERGUSON', born: '1941',
      statLabel: '曼联执教（1986–2013）',
      stats: [['场次', '1500'], ['胜场', '895'], ['胜率', '60%']],
      statNote: '执教场次与胜场为全赛事口径公开约值（约 1500 场 895 胜），截至 2013-05 退休',
      achievements: [
        ['1986-11', '自阿伯丁入主曼联（此前已率队打破凯尔特人/流浪者对苏超的垄断）'],
        ['1990', '足总杯夺冠保住帅位，随后开启红色王朝'],
        ['1993', '夺得英超元年冠军，终结英格兰顶级联赛 26 年等待'],
        ['1992-98', '「92 班」贝克汉姆、斯科尔斯、吉格斯、内维尔兄弟成材'],
        ['1999', '诺坎普补时逆转拜仁，加冕三冠王，同年受封爵士'],
        ['2008', '莫斯科雨夜点球胜切尔西夺队史第三座欧冠，C罗封金球'],
        ['2013-05', '退休：26 年 38 座奖杯（13 英超），率曼联登顶英格兰夺冠最多俱乐部'],
      ],
      honours: ['英超冠军 ×13', '足总杯 ×5', '联赛杯 ×4', '欧冠 ×2（1999 / 2008）', '欧洲优胜者杯 ×1（1991）', '世俱杯 ×1（2008）'],
    },
    {
      slug: 'schmeichel', num: '1', pos: 'GK', posZh: '门将',
      nat: 'DEN', natZh: '丹麦', nameZh: '彼得·舒梅切尔',
      nameEn: 'PETER SCHMEICHEL', born: '1963',
      statLabel: '曼联生涯（1991–1999）',
      stats: [['出场', '398'], ['零封', '约180'], ['奖杯', '15']],
      statNote: '出场数另有 298 的统计口径；零封为公开口径约值',
      achievements: [
        ['1991', '£50.5 万自布隆德比加盟，被誉为史上最划算签约之一'],
        ['1992', '「丹麦童话」：欧洲杯冠军主力门将'],
        ['1994-97', '英超三冠 + 足总杯两冠，更衣室之声'],
        ['1999', '诺坎普三冠王收官（对拜仁一役头球扳平为经典）'],
        ['1999', '功成身退转投葡萄牙体育'],
      ],
      honours: ['英超 ×5', '足总杯 ×3', '欧冠 ×1（1999）', '欧洲杯 ×1（1992）'],
    },
    {
      slug: 'gneville', num: '2', pos: 'RB', posZh: '右后卫',
      nat: 'ENG', natZh: '英格兰', nameZh: '加里·内维尔',
      nameEn: 'GARY NEVILLE', born: '1975',
      statLabel: '曼联生涯（1992–2011）',
      stats: [['出场', '602'], ['进球', '7'], ['英超', '8']],
      statNote: '队史后卫出场纪录；一生一队',
      achievements: [
        ['1992', '92 班：青年足总杯冠军主力'],
        ['1994', '首夺英超+足总杯双冠'],
        ['2005', '接基恩任队长'],
        ['2008', '莫斯科欧冠冠军'],
        ['2011', '挂靴：一生一队，后成为知名评论员'],
      ],
      honours: ['英超 ×8', '足总杯 ×3', '联赛杯 ×2', '欧冠 ×1（2008）'],
    },
    {
      slug: 'ferdinand', num: '5', pos: 'CB', posZh: '中后卫',
      nat: 'ENG', natZh: '英格兰', nameZh: '里奥·费迪南德',
      nameEn: 'RIO FERDINAND', born: '1978',
      statLabel: '曼联生涯（2002–2014）',
      stats: [['出场', '455'], ['进球', '8'], ['英超', '6']],
      statNote: '加盟费 £2910 万为当时后卫世界纪录',
      achievements: [
        ['2002', '自利兹联加盟（当时后卫身价纪录）'],
        ['2008', '莫斯科欧冠冠军主力中卫'],
        ['2008-09', '英超两连冠，欧冠两进决赛'],
        ['2013', '弗格森谢幕战举杯'],
        ['2014', '告别转投女王公园巡游者'],
      ],
      honours: ['英超 ×6', '欧冠 ×1（2008）', '世俱杯 ×1（2008）'],
    },
    {
      slug: 'vidic', num: '15', pos: 'CB', posZh: '中后卫',
      nat: 'SRB', natZh: '塞尔维亚', nameZh: '内马尼亚·维迪奇',
      nameEn: 'NEMANJA VIDIĆ', born: '1981',
      statLabel: '曼联生涯（2006–2014）',
      stats: [['出场', '300'], ['进球', '21'], ['英超', '5']],
      statNote: '号码初为 15、2010 起改 4；进球为公开口径约值',
      achievements: [
        ['2006-01', '自莫斯科斯巴达加盟'],
        ['2007-09', '与费迪南德组成欧洲最佳中卫搭档'],
        ['2008', '莫斯科欧冠冠军'],
        ['2009/2011', '两获 PFA 年度最佳球员（中卫稀有双选）'],
        ['2010', '接任队长，2014 告别转投国米'],
      ],
      honours: ['英超 ×5', '欧冠 ×1（2008）', '联赛杯 ×3'],
    },
    {
      slug: 'irwin', num: '3', pos: 'LB', posZh: '左后卫',
      nat: 'IRL', natZh: '爱尔兰', nameZh: '丹尼斯·埃尔文',
      nameEn: 'DENIS IRWIN', born: '1965',
      statLabel: '曼联生涯（1990–2002）',
      stats: [['出场', '529'], ['进球', '33'], ['英超', '7']],
      statNote: '队史出场榜第 10；弗格森称其为「七分先生」',
      achievements: [
        ['1990', '£62.5 万自奥尔德姆加盟'],
        ['1993-2001', '七夺英超的两翼定海神针，专职定位球手'],
        ['1999', '三冠王主力左后卫'],
        ['2002', '告别战挂靴'],
      ],
      honours: ['英超 ×7', '足总杯 ×3', '联赛杯 ×2', '欧冠 ×1（1999）'],
    },
    {
      slug: 'best', num: '7', pos: 'RW', posZh: '右边锋',
      nat: 'NIR', natZh: '北爱尔兰', nameZh: '乔治·贝斯特',
      nameEn: 'GEORGE BEST', born: '1946',
      statLabel: '曼联生涯（1963–1974）',
      stats: [['出场', '470'], ['进球', '181'], ['金球', '1']],
      statNote: '年代无固定背号，7 号为其传承标志；「神圣三杰」之一',
      achievements: [
        ['1963', '17 岁首秀即梅开二度'],
        ['1965/1967', '两夺英甲冠军'],
        ['1968', '温布利 4–1 本菲卡首夺欧洲冠军杯，同年当选欧洲金球奖'],
        ['1968', '「El Beatle」风靡欧洲'],
        ['1974', '因场外生活早早离队，2005 年去世，约十万人送葬'],
      ],
      honours: ['英甲 ×2', '欧冠 ×1（1968）', '欧洲金球奖 ×1（1968）'],
    },
    {
      slug: 'keane', num: '16', pos: 'CM', posZh: '中场 · 队长',
      nat: 'IRL', natZh: '爱尔兰', nameZh: '罗伊·基恩',
      nameEn: 'ROY KEANE', born: '1971',
      statLabel: '曼联生涯（1993–2005）',
      stats: [['出场', '480'], ['进球', '51'], ['英超', '7']],
      statNote: '英超口径 326 场 33 球；90 年代末至千禧初的精神领袖',
      achievements: [
        ['1993', '£375 万（当时英国纪录）自诺丁汉森林加盟'],
        ['1997', '接坎通纳任队长'],
        ['1999', '欧冠半决赛客场对尤文统帅级表现（决赛停赛）'],
        ['1999', '三冠王'],
        ['2005', '离队（后执教桑德兰等）'],
      ],
      honours: ['英超 ×7', '足总杯 ×4', '欧冠 ×1（1999）'],
    },
    {
      slug: 'scholes', num: '18', pos: 'CM', posZh: '中场',
      nat: 'ENG', natZh: '英格兰', nameZh: '保罗·斯科尔斯',
      nameEn: 'PAUL SCHOLES', born: '1974',
      statLabel: '曼联生涯（1993–2013）',
      stats: [['出场', '718'], ['进球', '155'], ['英超', '11']],
      statNote: '队史出场榜第 4；以远射与调度著称，齐达内与哈维均公开盛赞',
      achievements: [
        ['1994', '首秀梅开二度'],
        ['1999', '三冠王中场核心（决赛停赛）'],
        ['2008', '莫斯科欧冠冠军'],
        ['2011', '短暂退役半年后复出'],
        ['2013', '与弗格森同日谢幕'],
      ],
      honours: ['英超 ×11', '欧冠 ×2（1999 / 2008）'],
    },
    {
      slug: 'giggs', num: '11', pos: 'LW', posZh: '左边锋',
      nat: 'WAL', natZh: '威尔士', nameZh: '瑞恩·吉格斯',
      nameEn: 'RYAN GIGGS', born: '1973',
      statLabel: '曼联生涯（1990–2014）',
      stats: [['出场', '963'], ['进球', '168'], ['英超', '13']],
      statNote: '队史出场纪录（963 场），13 座英超全勤',
      achievements: [
        ['1991', '17 岁完成一线队首秀'],
        ['1992-93', '英超元年两冠起步'],
        ['1999', '足总杯半决赛对阿森纳的半场千里走单骑（队史最佳进球）'],
        ['2008', '莫斯科欧冠冠军'],
        ['2014', '挂靴（963 场），随即进入教练组'],
      ],
      honours: ['英超 ×13', '足总杯 ×4', '联赛杯 ×4', '欧冠 ×2（1999 / 2008）'],
    },
    {
      slug: 'charlton', num: '9', pos: 'CF', posZh: '前锋',
      nat: 'ENG', natZh: '英格兰', nameZh: '博比·查尔顿',
      nameEn: 'SIR BOBBY CHARLTON', born: '1937',
      statLabel: '曼联生涯（1956–1973）',
      stats: [['出场', '758'], ['进球', '249'], ['世界杯', '1']],
      statNote: '出场与进球均为队史第二（吉格斯 963 场、鲁尼 253 球）；2023 年去世',
      achievements: [
        ['1958', '慕尼黑空难幸存者，此后成为重建旗帜'],
        ['1966', '英格兰世界杯冠军核心，同年当选欧洲金球奖'],
        ['1968', '欧冠决赛梅开二度，首支登顶欧洲的英格兰球队'],
        ['1973', '告别；1984 受封爵士，南看台以其命名'],
        ['2023-10', '去世，享年 86；The Athletic 等评选的队史最伟大球员'],
      ],
      honours: ['英甲 ×3', '足总杯 ×1（1963）', '欧冠 ×1（1968）', '世界杯 ×1（1966）', '欧洲金球奖 ×1（1966）'],
    },
    {
      slug: 'law', num: '10', pos: 'ST', posZh: '中锋',
      nat: 'SCO', natZh: '苏格兰', nameZh: '丹尼斯·劳',
      nameEn: 'DENIS LAW', born: '1940',
      statLabel: '曼联生涯（1962–1973）',
      stats: [['出场', '404'], ['进球', '237'], ['金球', '1']],
      statNote: '队史射手榜第 3；曼联第一个被称作「King」的人',
      achievements: [
        ['1962', '£11.5 万自都灵加盟'],
        ['1963', '足总杯夺冠，走出空难低谷的第一座奖杯'],
        ['1964', '欧洲金球奖（迄今唯一苏格兰籍）'],
        ['1965/1967', '两夺英甲'],
        ['1968', '因伤缺席欧冠决赛（生涯最大遗憾）'],
      ],
      honours: ['英甲 ×2', '足总杯 ×1（1963）', '欧洲金球奖 ×1（1964）'],
    },
    {
      slug: 'cantona', num: '7', pos: 'CAM', posZh: '前腰',
      nat: 'FRA', natZh: '法国', nameZh: '埃里克·坎通纳',
      nameEn: 'ERIC CANTONA', born: '1966',
      statLabel: '曼联生涯（1992–1997）',
      stats: [['出场', '185'], ['进球', '82'], ['英超', '4']],
      statNote: '英超口径 64 球；「曼联国王」，传奇 7 号的开创者',
      achievements: [
        ['1992-11', '自利兹联加盟，英超王朝奠基人'],
        ['1993', '英超元年冠军'],
        ['1995', '飞踹球迷禁赛复出，率队逆转纽卡斯尔夺冠'],
        ['1996-97', '英超两连冠后于 31 岁急流勇退'],
      ],
      honours: ['英超 ×4', '足总杯 ×2'],
    },
    {
      slug: 'ronaldo', num: '7', pos: 'RW', posZh: '右边锋',
      nat: 'POR', natZh: '葡萄牙', nameZh: '克里斯蒂亚诺·罗纳尔多',
      nameEn: 'CRISTIANO RONALDO', born: '1985',
      statLabel: '曼联生涯（2003–2009 / 2021–2022）',
      stats: [['出场', '346'], ['进球', '145'], ['金球', '1']],
      statNote: '两段生涯合计口径约值',
      achievements: [
        ['2003', '18 岁自里斯本竞技加盟，接过 7 号'],
        ['2008', '42 球赛季：欧冠冠军 + 金球奖 + 世界足球先生'],
        ['2009', '以当时世界纪录转会皇马'],
        ['2021', '回归曼联并成为当季队内最佳射手'],
      ],
      honours: ['英超 ×3', '欧冠 ×1（2008）', '欧洲金球奖 ×1（2008）'],
    },
    {
      slug: 'beckham', num: '7', pos: 'RM', posZh: '右前卫',
      nat: 'ENG', natZh: '英格兰', nameZh: '大卫·贝克汉姆',
      nameEn: 'DAVID BECKHAM', born: '1975',
      statLabel: '曼联生涯（1993–2003）',
      stats: [['出场', '394'], ['进球', '85'], ['英超', '6']],
      statNote: '92 班成员；标志性任意球与传中',
      achievements: [
        ['1995', '青年军首秀亮相'],
        ['1996', '中场吊射温布尔登一球成名'],
        ['1999', '三冠王核心'],
        ['2001', '对希腊的任意球绝平送英格兰进世界杯'],
        ['2003', '转会皇马，7 号交予 C 罗'],
      ],
      honours: ['英超 ×6', '足总杯 ×2', '欧冠 ×1（1999）'],
    },
    {
      slug: 'rooney', num: '10', pos: 'ST', posZh: '中锋',
      nat: 'ENG', natZh: '英格兰', nameZh: '韦恩·鲁尼',
      nameEn: 'WAYNE ROONEY', born: '1985',
      statLabel: '曼联生涯（2004–2017）',
      stats: [['出场', '559'], ['进球', '253'], ['英超', '5']],
      statNote: '253 球为队史射手王纪录',
      achievements: [
        ['2004', '£2700 万自埃弗顿加盟（出道即绝杀阿森纳的少年）'],
        ['2008', '莫斯科欧冠冠军核心'],
        ['2011', '曼市德比倒钩 + 欧冠决赛点球'],
        ['2017', '超越查尔顿（249）加冕队史射手王后回归埃弗顿'],
      ],
      honours: ['英超 ×5', '欧冠 ×1（2008）', '足总杯 ×1（2016）'],
    },
    {
      slug: 'stam', num: '31', pos: 'CB', posZh: '中后卫',
      nat: 'NED', natZh: '荷兰', nameZh: '雅普·斯塔姆',
      nameEn: 'JAAP STAM', born: '1972',
      statLabel: '曼联生涯（1998–2001）',
      stats: [['出场', '127'], ['进球', '1'], ['英超', '3']],
      statNote: '1999 三冠王定海神针',
      achievements: [
        ['1998', '£1060 万（当时后卫世界纪录）自埃因霍温加盟'],
        ['1999', '三冠王主力中卫'],
        ['2001', '因自传风波被出售，弗格森事后称之为最大失误'],
      ],
      honours: ['英超 ×3（三连冠）', '欧冠 ×1（1999）'],
    },
    {
      slug: 'evra', num: '3', pos: 'LB', posZh: '左后卫',
      nat: 'FRA', natZh: '法国', nameZh: '帕特里斯·埃弗拉',
      nameEn: 'PATRICE EVRA', born: '1981',
      statLabel: '曼联生涯（2006–2014）',
      stats: [['出场', '379'], ['英超', '5'], ['欧冠', '1']],
      statNote: '出场数为公开口径约值',
      achievements: [
        ['2006-01', '自摩纳哥加盟，很快坐稳左路主力'],
        ['2008', '莫斯科欧冠冠军主力左后卫'],
        ['2008-09', '入选欧足联年度最佳阵容'],
        ['2014', '转投尤文，队长之一功成身退'],
      ],
      honours: ['英超 ×5', '欧冠 ×1（2008）', '联赛杯 ×3'],
    },
    {
      slug: 'edwards', num: null, pos: 'CM', posZh: '中场',
      nat: 'ENG', natZh: '英格兰', nameZh: '邓肯·爱德华兹',
      nameEn: 'DUNCAN EDWARDS', born: '1936',
      statLabel: '曼联生涯（1953–1958）',
      stats: [['出场', '177'], ['进球', '21'], ['英甲', '2']],
      statNote: '年代无固定背号；「若非慕尼黑空难，或为队史最伟大球员」',
      achievements: [
        ['1953', '16 岁完成一线队首秀'],
        ['1956-57', '「巴斯比宝贝」蝉联英甲主力'],
        ['1958-02', '慕尼黑空难重伤，15 天后不幸离世，年仅 21 岁'],
      ],
      honours: ['英甲 ×2（1956 / 1957）'],
    },
    {
      slug: 'vandersar', num: '1', pos: 'GK', posZh: '门将',
      nat: 'NED', natZh: '荷兰', nameZh: '埃德温·范德萨',
      nameEn: 'EDWIN VAN DER SAR', born: '1970',
      statLabel: '曼联生涯（2005–2011）',
      stats: [['出场', '266'], ['零封', '约130'], ['英超', '4']],
      statNote: '零封为公开口径约值',
      achievements: [
        ['2005', '34 岁自富勒姆加盟，补上舒梅切尔后的门将之问'],
        ['2008', '莫斯科点球大战扑出阿内尔卡，锁定欧冠'],
        ['2008-09', '英超连续 1311 分钟不丢球（联赛纪录）'],
        ['2011', '温布利欧冠决赛谢幕'],
      ],
      honours: ['英超 ×4', '欧冠 ×1（2008）'],
    },
    {
      slug: 'vannistelrooy', num: '10', pos: 'ST', posZh: '中锋',
      nat: 'NED', natZh: '荷兰', nameZh: '范尼斯特鲁伊',
      nameEn: 'RUUD VAN NISTELROOY', born: '1976',
      statLabel: '曼联生涯（2001–2006）',
      stats: [['出场', '219'], ['进球', '150'], ['场均', '0.68']],
      statNote: '效率之王：场均 0.68 球',
      achievements: [
        ['2001', '£1900 万自埃因霍温加盟'],
        ['2002-03', '单季 44 球，英超 25 球加冕射手王'],
        ['2006', '转会皇马'],
      ],
      honours: ['英超 ×1（2003）', '足总杯 ×1（2004）', '联赛杯 ×1（2006）'],
    },
    {
      slug: 'solskjaer', num: '20', pos: 'ST', posZh: '中锋',
      nat: 'NOR', natZh: '挪威', nameZh: '奥勒·索尔斯克亚',
      nameEn: 'OLE GUNNAR SOLSKJÆR', born: '1973',
      statLabel: '曼联生涯（1996–2007）',
      stats: [['出场', '366'], ['进球', '126'], ['英超', '6']],
      statNote: '「娃娃脸杀手」：超级替补的代名词',
      achievements: [
        ['1996', '£150 万自莫尔德加盟'],
        ['1999', '诺坎普补时绝杀拜仁，三冠王之夜'],
        ['1999', '对诺丁汉森林替补登场 12 分钟连入 4 球'],
        ['2007', '因伤退役留任教练组，2018–2021 任曼联主帅'],
      ],
      honours: ['英超 ×6', '欧冠 ×1（1999）', '足总杯 ×2'],
    },
  ],
};
