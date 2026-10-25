/* ===========================================================================
 * 老特拉福德球场 · 交互式三维展览
 * js/app.js —— 页面外壳与交互层
 * ---------------------------------------------------------------------------
 * 职责边界（几何全部在 js/stadium.js，本文件不构建任何球场几何）：
 *   · 渲染器 / 场景 / 雾 / 环境贴图
 *   · 天空穹顶与太阳（时刻滑块驱动的日照、方位角、高度角与阴影）
 *   · 相机与 OrbitControls、视点平滑过渡
 *   · 后处理（UnrealBloom，夜间泛光）
 *   · HUD 统计、面板与事件绑定、键盘快捷键、看台拾取、档案抽屉
 *
 * 坐标约定（与 js/data.js 一致）：+X 东 / −X 西 / +Z 南 / −Z 北 / +Y 上，
 * 原点在草坪中心，单位米。
 * ========================================================================= */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

import {
  DATA_VERSION,
  META,
  PITCH,
  RUN_OFF,
  BOWL_INNER,
  STANDS,
  STAND_ORDER,
  QUADRANTS,
  FEATURES,
  CONTEXT,
  COLORS,
  VIEWPOINTS,
  SOURCES,
  DISCLAIMER,
  HERITAGE,
  PLAYERS,
  LINEUP,
  COACH,
  PLAYER_CARDS,
  ALL_TIME,
  ALL_TIME_CARDS,
  FORMATIONS,
} from './data.js';

/* ===========================================================================
 * 0. 常量与小工具
 * ========================================================================= */

const PI = Math.PI;
const DEG = PI / 180;
const TAU = PI * 2;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** 0xRRGGBB → '#rrggbb'（供 CSS 变量使用） */
const hex = (n) => `#${n.toString(16).padStart(6, '0')}`;

/** 两个十六进制颜色按 t 线性混合，返回 '#rrggbb' */
function mixHex(a, b, t) {
  const pa = Number.parseInt(a.slice(1), 16);
  const pb = Number.parseInt(b.slice(1), 16);
  const r = Math.round(lerp((pa >> 16) & 255, (pb >> 16) & 255, t));
  const g = Math.round(lerp((pa >> 8) & 255, (pb >> 8) & 255, t));
  const bl = Math.round(lerp(pa & 255, pb & 255, t));
  return `#${((r << 16) | (g << 8) | bl).toString(16).padStart(6, '0')}`;
}

const fmtInt = (n) => (Number.isFinite(n) ? Math.round(n).toLocaleString('en-US') : '—');

const $ = (id) => document.getElementById(id);

const params = new URLSearchParams(window.location.search);
const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const IS_NARROW = () => window.matchMedia('(max-width: 900px)').matches;
const IS_TOUCH = window.matchMedia('(hover: none)').matches;

/* ===========================================================================
 * 1. 元素引用
 * ========================================================================= */

const el = {
  app: $('app'),
  canvas: $('scene'),

  boot: $('boot'),
  bootBar: $('bootBar'),
  bootStatus: $('bootStatus'),
  bootPercent: $('bootPercent'),
  bootSteps: $('bootSteps'),
  bootNote: $('bootNote'),

  fallback: $('fallback'),
  fallbackTitle: $('fallbackTitle'),
  fallbackText: $('fallbackText'),
  fallbackMessage: $('fallbackMessage'),
  fallbackRetry: $('fallbackRetry'),
  fallbackShell: $('fallbackShell'),

  toast: $('toast'),

  viewsToggle: $('viewsToggle'),
  controlsToggle: $('controlsToggle'),
  archiveButton: $('archiveButton'),
  playersButton: $('playersButton'),
  helpButton: $('helpButton'),
  fullscreenButton: $('fullscreenButton'),
  metaBuild: $('metaBuild'),

  hero: $('hero'),
  heroFacts: $('heroFacts'),
  heroNote: $('heroNote'),

  viewPanel: $('viewPanel'),
  viewGroups: $('viewGroups'),
  viewPanelCount: $('viewPanelCount'),
  eyePanel: $('eyePanel'),
  eyeGroups: $('eyeGroups'),
  eyePanelCount: $('eyePanelCount'),
  lineupPanel: $('lineupPanel'),
  lineupGroups: $('lineupGroups'),
  lineupPanelCount: $('lineupPanelCount'),
  lineupRoster: $('lineupRoster'),
  formationPicker: $('formationPicker'),
  figuresToggle: $('figuresToggle'),
  collapseViews: $('collapseViews'),
  collapseEye: $('collapseEye'),
  collapseLineup: $('collapseLineup'),

  atmospherePanel: $('atmospherePanel'),
  collapseControls: $('collapseControls'),
  controlsToHeritage: $('controlsToHeritage'),
  clock: $('clock'),
  timePhase: $('timePhase'),
  sunNote: $('sunNote'),
  timeRange: $('timeRange'),
  timePresets: $('timePresets'),
  dayNightRow: $('dayNightRow'),
  seatModeGrid: $('seatModeGrid'),
  seatModeName: $('seatModeName'),
  seatModeDesc: $('seatModeDesc'),
  explodeRange: $('explodeRange'),
  explodeValue: $('explodeValue'),
  roofRange: $('roofRange'),
  roofValue: $('roofValue'),

  heritagePanel: $('heritagePanel'),
  collapseHeritage: $('collapseHeritage'),
  heritageToControls: $('heritageToControls'),
  heritageTimeline: $('heritageTimeline'),
  heritageHonours: $('heritageHonours'),
  heritageNote: $('heritageNote'),
  anthemPlayer: $('anthemPlayer'),
  anthemPlay: $('anthemPlay'),
  anthemStop: $('anthemStop'),
  anthemState: $('anthemState'),
  anthemProgress: $('anthemProgress'),
  anthemTime: $('anthemTime'),
  anthemNote: $('anthemNote'),
  anthemTitle: $('anthemTitle'),
  anthemSub: $('anthemSub'),

  standCard: $('standCard'),
  standCardKicker: $('standCardKicker'),
  standCardName: $('standCardName'),
  standCardEn: $('standCardEn'),
  standCardFormer: $('standCardFormer'),
  standCardGrid: $('standCardGrid'),
  standCardTiers: $('standCardTiers'),
  standCardFacade: $('standCardFacade'),
  standCardContext: $('standCardContext'),
  standCardFly: $('standCardFly'),
  standCardArchive: $('standCardArchive'),
  standCardClose: $('standCardClose'),

  pickTip: $('pickTip'),
  pickTipName: $('pickTipName'),
  pickTipMeta: $('pickTipMeta'),

  captionIndex: $('captionIndex'),
  captionTitle: $('captionTitle'),
  captionText: $('captionText'),

  statSeats: $('statSeats'),
  statTriangles: $('statTriangles'),
  statBuild: $('statBuild'),
  statStands: $('statStands'),
  statTiers: $('statTiers'),

  bottomDisclaimer: $('bottomDisclaimer'),

  dockReset: $('dockReset'),
  dockRotate: $('dockRotate'),
  dockSection: $('dockSection'),
  dockRoof: $('dockRoof'),
  dockNight: $('dockNight'),
  dockArchive: $('dockArchive'),
  dockFullscreen: $('dockFullscreen'),

  mouseHint: $('mouseHint'),
  dismissHint: $('dismissHint'),

  archive: $('archive'),
  archiveScrim: $('archiveScrim'),
  archiveClose: $('archiveClose'),
  archiveBody: $('archiveBody'),
  archiveStats: $('archiveStats'),
  archiveFacts: $('archiveFacts'),
  archiveBasis: $('archiveBasis'),
  archiveStands: $('archiveStands'),
  archiveSources: $('archiveSources'),
  archiveDisclaimerShort: $('archiveDisclaimerShort'),
  archiveDisclaimerLong: $('archiveDisclaimerLong'),

  players: $('players'),
  playersScrim: $('playersScrim'),
  playersClose: $('playersClose'),
  playersAdd: $('playersAdd'),
  playersBody: $('playersBody'),
  playersNote: $('playersNote'),
  squadToggle: $('squadToggle'),
  customForm: $('customForm'),
  customFormCancel: $('customFormCancel'),
  customName: $('customName'),
  customNameZh: $('customNameZh'),
  customNum: $('customNum'),
  customPos: $('customPos'),
  customNation: $('customNation'),
  customBorn: $('customBorn'),
  customPhoto: $('customPhoto'),
  customPhotoPreview: $('customPhotoPreview'),
  customStatLabel: $('customStatLabel'),
  customStatKey: [0, 1, 2].map((i) => $(`customStatKey${i}`)),
  customStatVal: [0, 1, 2].map((i) => $(`customStatVal${i}`)),
  customAchievements: $('customAchievements'),
  customHonours: $('customHonours'),

  dataExport: $('dataExport'),
  dataImport: $('dataImport'),
  dataImportFile: $('dataImportFile'),

  lineupCard: $('lineupCard'),
  lineupCardInner: $('lineupCardInner'),
};

/* ===========================================================================
 * 2. 座席模式表与视点分组
 * ========================================================================= */

/** 座席显示模式：id 与 js/stadium.js 的 setSeatMode() 取值一一对应 */
const SEAT_MODES = [
  {
    id: 'natural',
    name: '自然分布',
    desc: '按公开容量口径加权的座席分布，散座与空位混合，接近比赛日的观感。',
  },
  {
    id: 'blocks',
    name: '分区块',
    desc: '按看台与层段分区着色，便于读出碗体的分层与四角象限的衔接关系。',
  },
  {
    id: 'capacity',
    name: '容量满座',
    desc: '全部座席点亮的满座状态；总数为生成器按几何排布算出的座席数，与官方 74,244 口径不完全相等。',
  },
  {
    id: 'away',
    name: '客队区',
    desc: '东看台客队球迷区以深色区分。曼联官网口径：客队球迷区位于东看台（旧称 Scoreboard End）。',
  },
  {
    id: 'off',
    name: '隐藏座席',
    desc: '不绘制座席，仅保留结构构件，用于观察看台台阶与屋盖悬挑的几何关系。',
  },
];

/** 视点分组：按 VIEWPOINTS.type 归组，面板与编号键位都依此顺序 */
const VIEW_GROUPS = [
  { type: 'aerial', label: '鸟瞰', en: 'AERIAL', hint: '整体关系与轮廓' },
  { type: 'eye', label: '人眼高度', en: 'EYE LEVEL', hint: '1.7 m 站立视线' },
  { type: 'section', label: '剖视', en: 'SECTION', hint: '沿轴剖开的结构' },
  { type: 'lineup', label: '阵容', en: 'LINEUP', hint: '4-2-3-1 站位人形' },
];

/** 分组后的扁平顺序（供数字键与序号显示使用） */
const ORDERED_VIEWS = VIEW_GROUPS.flatMap((g) => VIEWPOINTS.filter((v) => v.type === g.type));

/** 看台 → 立面视点（信息卡上的「转到该侧视点」） */
const STAND_VIEW = {
  north: 'north-facade',
  south: 'south-facade',
  east: 'east-facade',
  west: 'west-facade',
};

/** 看台拾取键与 stadium.parts 的对应关系 */
const STAND_PART_KEY = {
  north: 'standNorth',
  south: 'standSouth',
  east: 'standEast',
  west: 'standWest',
};

const COMPASS_16 = [
  '北', '北北东', '东北', '东北东', '东', '东南东', '东南', '南南东',
  '南', '南南西', '西南', '西南西', '西', '西北西', '西北', '北北西',
];

/* ===========================================================================
 * 3. 全局状态
 * ========================================================================= */

function pickViewpoint(id) {
  return ORDERED_VIEWS.some((v) => v.id === id) ? id : 'aerial-se';
}
function pickSeatMode(id) {
  return SEAT_MODES.some((m) => m.id === id) ? id : 'natural';
}

const state = {
  hour: clamp(Number.parseFloat(params.get('time') ?? '18.4') || 18.4, 0, 24),
  view: pickViewpoint(params.get('view') ?? 'aerial-se'),
  seatMode: pickSeatMode(params.get('seat') ?? 'natural'),
  explode: 0,
  roofOpacity: 100,
  section: params.get('section') === '1',
  context: params.get('context') !== '0',
  floodlights: params.get('lights') !== '0',
  autoRotate: params.get('rotate') === '1',
  archiveOpen: false,
  archiveTab: 'stats',
  playersOpen: false,
  customFormOpen: false,   // 抽屉里的「添加自定义球员」表单
  lineupActive: false,   // 是否处于阵容站位机位（隐藏人形 + 机位锁定）
  lineupFocus: null,     // 当前推近的球员 name（null = 总览）
  formation: FORMATIONS.default,
  squad: 'current',      // 'current' 现役 2026-27 / 'alltime' 队史最佳 XI
  lineupFiguresManual: false,   // 人形常显开关（开时离开阵容机位也可见）
  picked: null,          // 当前悬停的看台键
  pinned: null,          // 点击锁定的看台键
  night: 0,              // 0 = 白昼，1 = 全夜
  solar: null,
  envDirty: true,
  envHour: null,         // 上次重建环境贴图的时刻
  hintDismissed: false,
  started: false,
  panelViewsOpen: false,
  panelControlsOpen: false,
  viewsCollapsed: false,
  eyeCollapsed: true,
  lineupCollapsed: true,
  controlsCollapsed: false,
  consoleTab: 'atmosphere',   // 'atmosphere' 控制面板 / 'heritage' 队史档案库
  heritageCollapsed: false,
  anthemStopped: false,       // 用户手动停止后不再自动续播
};

/* 舞台对象 */
let renderer = null;
let scene = null;
let camera = null;
let controls = null;
let composer = null;
let bloomPass = null;
let stadium = null;
let skyUniforms = null;
let skyScene = null;
let envRT = null;
let pmrem = null;
let sunLight = null;
let moonLight = null;
let hemiLight = null;
let pitchFlood = null;
let facadeFill = null;
let floodSpots = [];
let raycaster = null;
let hoverHelper = null;

/* 运行时 */
let elapsed = 0;
let lastFrame = 0;
let viewTween = null;
let toastTimer = null;
let bootBarTimer = null;
let pointerNDC = new THREE.Vector2();
let pointerClient = { x: 0, y: 0 };
let pointerInside = false;
let pointerDirty = false;
let pointerDownAt = null;
let hoveredStand = null;
let standByKey = null;

/* ===========================================================================
 * 4. 引导 / 回退 / 轻提示
 * ========================================================================= */

function setBoot(percent, message) {
  if (!el.bootBar) return;
  const value = clamp(percent, 0, 100);
  el.bootBar.style.width = `${value}%`;
  if (message) el.bootStatus.textContent = message;
  el.bootPercent.textContent = `${String(Math.round(value)).padStart(2, '0')}%`;
  const step = Math.min(5, Math.floor(value / 20));
  if (el.bootSteps) {
    [...el.bootSteps.children].forEach((li, i) => li.classList.toggle('is-on', i < step));
  }
}

/**
 * 等待下一帧。后台标签页里 requestAnimationFrame 会被浏览器节流甚至暂停，
 * 因此用定时器兜底，保证加载流程不会卡在引导遮罩上。
 */
const nextFrame = () => new Promise((resolve) => {
  let settled = false;
  const fire = () => {
    if (settled) return;
    settled = true;
    resolve();
  };
  requestAnimationFrame(fire);
  window.setTimeout(fire, 120);
});

/** 几何构建是同步过程，构建期间进度条按时间缓慢爬升，避免看起来卡死 */
function startBootCreep(from, to, ms) {
  stopBootCreep();
  const t0 = performance.now();
  bootBarTimer = setInterval(() => {
    const t = clamp((performance.now() - t0) / ms, 0, 1);
    setBoot(lerp(from, to, 1 - Math.pow(1 - t, 2)));
  }, 90);
}
function stopBootCreep() {
  if (bootBarTimer) clearInterval(bootBarTimer);
  bootBarTimer = null;
}

function finishBoot() {
  stopBootCreep();
  setBoot(100, '进入球场');
  window.setTimeout(() => {
    el.boot?.classList.add('is-done');
    document.body.classList.add('is-ready');
    // 首帧从高处收束到初始视点，形成入场感
    if (params.get('intro') === '0' || REDUCED_MOTION) {
      setViewInstant(state.view);
    } else {
      const start = STATE_FREE_START();
      camera.position.set(start.x, start.y, start.z);
      controls.target.set(0, 12, 0);
      controls.update();
      flyTo(state.view, 2.8, { intro: true });
    }
  }, 320);
}

function showFallback(title, text, detail) {
  stopBootCreep();
  el.boot?.classList.add('is-done');
  if (el.fallback) {
    if (title) el.fallbackTitle.textContent = title;
    if (text) el.fallbackText.textContent = text;
    if (el.fallbackMessage) {
      el.fallbackMessage.textContent = detail || '';
      el.fallbackMessage.hidden = !detail;
    }
    el.fallback.hidden = false;
  }
}

function showToast(message, ms = 2600) {
  if (!el.toast) return;
  el.toast.textContent = message;
  el.toast.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => el.toast.classList.remove('is-visible'), ms);
}

/* ===========================================================================
 * 5. 天空与日照
 * ---------------------------------------------------------------------------
 * 天空色全部取自 js/data.js 的 COLORS.sky（dayTop / dayBottom / nightTop /
 * nightBottom / sunset），在 0–24 时之间按关键帧插值；日落时段偏暖。
 * 太阳位置用纬 53.4631°N 的简化日轨算出真实的高度角与方位角。
 * ========================================================================= */

const SKY = COLORS.sky;
const C = {
  dayTop: hex(SKY.dayTop),
  dayBottom: hex(SKY.dayBottom),
  nightTop: hex(SKY.nightTop),
  nightBottom: hex(SKY.nightBottom),
  sunset: hex(SKY.sunset),
};

const LATITUDE = 53.4631;
/** 简化赤纬：8° 近似 4 月下旬—8 月中旬，日出约 04:40、日落约 19:25 */
const DECLINATION = clamp(Number.parseFloat(params.get('dec') ?? '8') || 8, -23.44, 23.44);

/**
 * 天空关键帧。top / horizon / ground / fog 为十六进制字符串，
 * 其余为标量；hour 单调递增，首尾闭合到 24 时。
 */
const SKY_STOPS = [
  { h: 0.0,  top: C.nightTop,                        horizon: C.nightBottom,                        ground: '#06060a', fog: '#080b12', sunColor: '#93a9d8', sun: 0.0,  hemi: 0.14, exposure: 0.88, density: 0.0016, stars: 1.0 },
  { h: 4.4,  top: C.nightTop,                        horizon: mixHex(C.nightBottom, C.sunset, 0.10), ground: '#07070b', fog: '#0b0f16', sunColor: '#9fb2dd', sun: 0.0,  hemi: 0.15, exposure: 0.89, density: 0.0016, stars: 0.92 },
  { h: 5.5,  top: mixHex(C.nightTop, C.dayTop, 0.22), horizon: mixHex(C.nightBottom, C.sunset, 0.55), ground: '#12100f', fog: '#3a3436', sunColor: '#e08a5a', sun: 0.24, hemi: 0.24, exposure: 0.93, density: 0.0014, stars: 0.42 },
  { h: 6.6,  top: mixHex(C.nightTop, C.dayTop, 0.46), horizon: C.sunset,                          ground: '#241d18', fog: '#7a5f4e', sunColor: '#ff9d5c', sun: 1.35, hemi: 0.4,  exposure: 0.99, density: 0.0011, stars: 0.1 },
  { h: 8.0,  top: mixHex(C.dayTop, C.nightTop, 0.16), horizon: mixHex(C.sunset, C.dayBottom, 0.66), ground: '#2b3327', fog: '#95928a', sunColor: '#ffd9a6', sun: 2.5,  hemi: 0.6,  exposure: 1.03, density: 0.0009, stars: 0.0 },
  { h: 12.0, top: C.dayTop,                          horizon: C.dayBottom,                          ground: '#33402f', fog: '#a7b3ad', sunColor: '#fff8ec', sun: 3.2,  hemi: 0.78, exposure: 1.06, density: 0.0007, stars: 0.0 },
  { h: 15.0, top: mixHex(C.dayTop, C.dayBottom, 0.16), horizon: mixHex(C.dayBottom, C.sunset, 0.16), ground: '#333d2c', fog: '#b0ac9c', sunColor: '#ffeacb', sun: 2.95, hemi: 0.68, exposure: 1.05, density: 0.0007, stars: 0.0 },
  { h: 17.4, top: mixHex(C.dayTop, C.sunset, 0.22),  horizon: mixHex(C.dayBottom, C.sunset, 0.46), ground: '#3a3327', fog: '#bda184', sunColor: '#ffcf8e', sun: 2.4,  hemi: 0.52, exposure: 1.02, density: 0.0008, stars: 0.0 },
  { h: 18.9, top: mixHex(C.dayTop, C.sunset, 0.46),  horizon: C.sunset,                            ground: '#2c2620', fog: '#96755a', sunColor: '#ff9048', sun: 1.15, hemi: 0.36, exposure: 0.98, density: 0.0010, stars: 0.06 },
  { h: 19.9, top: mixHex(C.nightTop, C.sunset, 0.24), horizon: mixHex(C.sunset, C.nightBottom, 0.62), ground: '#151318', fog: '#3b3540', sunColor: '#ffb27a', sun: 0.16, hemi: 0.24, exposure: 0.93, density: 0.0013, stars: 0.46 },
  { h: 21.0, top: C.nightTop,                        horizon: C.nightBottom,                        ground: '#06060a', fog: '#080b12', sunColor: '#93a9d8', sun: 0.0,  hemi: 0.14, exposure: 0.88, density: 0.0016, stars: 1.0 },
  { h: 24.0, top: C.nightTop,                        horizon: C.nightBottom,                        ground: '#06060a', fog: '#080b12', sunColor: '#93a9d8', sun: 0.0,  hemi: 0.14, exposure: 0.88, density: 0.0016, stars: 1.0 },
];

const colorCache = new Map();
function cachedColor(css) {
  if (!colorCache.has(css)) colorCache.set(css, new THREE.Color(css));
  return colorCache.get(css);
}

/** 在关键帧之间插值，得到该时刻的整套天空参数 */
function sampleSky(hour) {
  let a = SKY_STOPS[0];
  let b = SKY_STOPS[SKY_STOPS.length - 1];
  for (let i = 0; i < SKY_STOPS.length - 1; i++) {
    if (hour >= SKY_STOPS[i].h && hour <= SKY_STOPS[i + 1].h) {
      a = SKY_STOPS[i];
      b = SKY_STOPS[i + 1];
      break;
    }
  }
  const t = smoothstep(0, 1, (hour - a.h) / Math.max(0.0001, b.h - a.h));
  const mixColor = (key) => cachedColor(a[key]).clone().lerp(cachedColor(b[key]), t);
  return {
    top: mixColor('top'),
    horizon: mixColor('horizon'),
    ground: mixColor('ground'),
    fog: mixColor('fog'),
    sunColor: mixColor('sunColor'),
    sun: lerp(a.sun, b.sun, t),
    hemi: lerp(a.hemi, b.hemi, t),
    exposure: lerp(a.exposure, b.exposure, t),
    density: lerp(a.density, b.density, t),
    stars: lerp(a.stars, b.stars, t),
  };
}

/** 简化日轨：返回高度角（弧度）、方位角（度，自北顺时针）与光照权重 */
function solarState(hour) {
  const H = (hour - 12) * 15 * DEG;              // 时角，正午为 0
  const lat = LATITUDE * DEG;
  const dec = DECLINATION * DEG;
  const sinAlt = Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec) * Math.cos(H);
  const altitude = Math.asin(clamp(sinAlt, -1, 1));
  const cosAz = clamp(
    (Math.sin(dec) - Math.sin(altitude) * Math.sin(lat)) / Math.max(1e-4, Math.cos(altitude) * Math.cos(lat)),
    -1, 1,
  );
  let azimuth = Math.acos(cosAz);                  // 自北起算，上午在东侧
  if (H > 0) azimuth = TAU - azimuth;              // 下午转到西侧
  const altDeg = altitude / DEG;
  const azDeg = (azimuth / DEG + 360) % 360;

  // 世界方向：北 = −Z、东 = +X
  const dir = new THREE.Vector3(
    Math.sin(azimuth) * Math.cos(altitude),
    Math.sin(altitude),
    -Math.cos(azimuth) * Math.cos(altitude),
  ).normalize();

  return {
    altitude,
    altDeg,
    azDeg,
    dir,
    compass: COMPASS_16[Math.round(azDeg / 22.5) % 16],
    // 太阳落下后泛光灯逐渐接管：日落后半小时内基本完成过渡
    daylight: smoothstep(-1.5, 8, altDeg),
    twilight: Math.exp(-Math.pow((altDeg + 1.5) / 6.2, 2)),
    night: 1 - smoothstep(-1.5, 7, altDeg),
  };
}

/** 中文时段名（与 CSS 的 data-phase 联动） */
function phaseForHour(hour) {
  if (hour < 4.6) return '深夜';
  if (hour < 6.4) return '黎明';
  if (hour < 10.4) return '清晨';
  if (hour < 13.6) return '正午';
  if (hour < 16.8) return '午后';
  if (hour < 18.6) return '黄昏';
  if (hour < 20.0) return '暮色';
  return '夜幕';
}

function phaseKey(hour) {
  const name = phaseForHour(hour);
  if (name === '深夜' || name === '夜幕') return 'night';
  if (name === '黄昏' || name === '暮色' || name === '黎明') return 'dusk';
  return 'day';
}

/* ---------- 天空穹顶着色器 ---------- */

const SKY_VERT = /* glsl */`
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const SKY_FRAG = /* glsl */`
  uniform vec3 uTop;
  uniform vec3 uHorizon;
  uniform vec3 uGround;
  uniform vec3 uSunColor;
  uniform vec3 uSunDir;
  uniform vec3 uMoonDir;
  uniform float uSunStrength;
  uniform float uMoonStrength;
  uniform float uStars;
  uniform float uTime;
  varying vec3 vDir;

  float hash13(vec3 p) {
    p = fract(p * 0.3183099 + vec3(0.71, 0.113, 0.419));
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }

  float starField(vec3 d) {
    vec3 p = d * 260.0;
    vec3 cell = floor(p);
    float n = hash13(cell);
    float s = smoothstep(0.9962, 0.9997, n);
    vec3 f = fract(p) - 0.5;
    float twinkle = 0.55 + 0.45 * sin(uTime * 1.6 + n * 58.0);
    return s * twinkle * smoothstep(0.42, 0.0, length(f));
  }

  void main() {
    vec3 d = normalize(vDir);
    float h = d.y;

    vec3 col = mix(uHorizon, uTop, pow(clamp(h, 0.0, 1.0), 0.58));
    col = mix(col, uGround, smoothstep(0.0, -0.26, h));

    vec3 sd = normalize(uSunDir);
    float sunDot = max(dot(d, sd), 0.0);
    col += uSunColor * (pow(sunDot, 900.0) * 2.4 + pow(sunDot, 14.0) * 0.3 + pow(sunDot, 2.4) * 0.05) * uSunStrength;

    vec3 md = normalize(uMoonDir);
    float moonDot = max(dot(d, md), 0.0);
    col += vec3(0.74, 0.82, 0.96) * (pow(moonDot, 3000.0) * 2.2 + pow(moonDot, 40.0) * 0.05) * uMoonStrength;

    col += vec3(0.86, 0.9, 1.0) * starField(d) * uStars;
    gl_FragColor = vec4(col, 1.0);
  }
`;

function buildSky() {
  skyUniforms = {
    uTop: { value: new THREE.Color(C.nightTop) },
    uHorizon: { value: new THREE.Color(C.nightBottom) },
    uGround: { value: new THREE.Color('#06060a') },
    uSunColor: { value: new THREE.Color('#93a9d8') },
    uSunDir: { value: new THREE.Vector3(0, 1, 0) },
    uMoonDir: { value: new THREE.Vector3(0, -1, 0) },
    uSunStrength: { value: 0 },
    uMoonStrength: { value: 0.9 },
    uStars: { value: 1 },
    uTime: { value: 0 },
  };

  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(1800, 48, 32),
    new THREE.ShaderMaterial({
      uniforms: skyUniforms,
      vertexShader: SKY_VERT,
      fragmentShader: SKY_FRAG,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    }),
  );
  dome.name = 'skyDome';
  scene.add(dome);

  // 环境贴图只包含天空穹顶：专供 PBR 材质做环境光，随时刻重建
  skyScene = new THREE.Scene();
  skyScene.add(dome.clone());
  pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
}

/** 重建环境贴图（开支较大，只在时刻明显变化时调用） */
function updateEnvMap() {
  if (!pmrem || !skyScene || !scene) return;
  const previous = envRT;
  // 模糊半径 0.03：再大 PMREM 的采样数会超过上限并被裁剪（three 会打印告警）
  envRT = pmrem.fromScene(skyScene, 0.03, 1, 4000);
  scene.environment = envRT.texture;
  previous?.dispose();
}

/* ===========================================================================
 * 6. 渲染器 / 场景 / 后处理
 * ========================================================================= */

function initRenderer() {
  let context = null;
  try {
    context = el.canvas.getContext('webgl2') || el.canvas.getContext('webgl');
  } catch (error) {
    context = null;
  }
  if (!context) return false;

  renderer = new THREE.WebGLRenderer({
    canvas: el.canvas,
    context,
    antialias: true,
    powerPreference: 'high-performance',
    alpha: false,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(el.app.clientWidth, el.app.clientHeight, false);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  // 局部裁剪：球场模块用 material.clippingPlanes 实现“剖切”，
  // 这个开关不打开时那些裁剪面会被静默忽略（three 的 clipping.init 参数）
  renderer.localClippingEnabled = true;
  return true;
}

function initScene() {
  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(new THREE.Color('#1b1a20').getHex(), 0.001);

  camera = new THREE.PerspectiveCamera(40, el.app.clientWidth / el.app.clientHeight, 0.5, 5000);
  camera.position.set(330, 205, 300);

  controls = new OrbitControls(camera, el.canvas);
  controls.target.set(0, 12, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.055;
  controls.rotateSpeed = 0.62;
  controls.zoomSpeed = 0.85;
  controls.panSpeed = 0.7;
  controls.screenSpacePanning = false;   // 平移贴着地面走，便于绕场查看
  controls.minDistance = 14;
  controls.maxDistance = 1600;
  controls.maxPolarAngle = PI * 0.494;   // 不允许穿到地平线以下
  controls.autoRotateSpeed = 0.35;
  controls.update();

  // 光照装置：太阳（唯一投影光源）、月亮补光、天穹环境光、夜间草坪与立面照明
  sunLight = new THREE.DirectionalLight(0xffffff, 3.2);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(2048, 2048);
  sunLight.shadow.camera.near = 10;
  sunLight.shadow.camera.far = 1800;
  sunLight.shadow.camera.left = -330;
  sunLight.shadow.camera.right = 330;
  sunLight.shadow.camera.top = 330;
  sunLight.shadow.camera.bottom = -330;
  sunLight.shadow.bias = -0.0006;
  sunLight.shadow.normalBias = 0.5;
  scene.add(sunLight);
  scene.add(sunLight.target);

  moonLight = new THREE.DirectionalLight(0xc3d8e8, 0);
  moonLight.position.set(-260, 320, -220);
  scene.add(moonLight);

  hemiLight = new THREE.HemisphereLight(new THREE.Color(C.dayBottom), new THREE.Color('#27352b'), 0.7);
  scene.add(hemiLight);

  // 草坪泛光：夜间为主看台与草坪提供均匀下打光
  pitchFlood = new THREE.PointLight(0xeaf6ff, 0, 620, 2);
  pitchFlood.position.set(0, 58, 0);
  scene.add(pitchFlood);

  // 立面洗墙：夜间把四座看台的立面板提亮，夜景里能读出分格
  facadeFill = new THREE.HemisphereLight(new THREE.Color('#2b3a4a'), new THREE.Color('#3a1519'), 0);
  scene.add(facadeFill);

  buildSky();
  initComposer();
  initPicking();
}

function initComposer() {
  const width = el.app.clientWidth;
  const height = el.app.clientHeight;
  composer = new EffectComposer(renderer);
  composer.setPixelRatio(renderer.getPixelRatio());
  composer.setSize(width, height);
  composer.addPass(new RenderPass(scene, camera));

  bloomPass = new UnrealBloomPass(new THREE.Vector2(width, height), 0.1, 0.6, 0.86);
  composer.addPass(bloomPass);
  composer.addPass(new OutputPass());
}

/* ===========================================================================
 * 7. 环境应用（每当时刻或开关改变）
 * ========================================================================= */

function applyEnvironment() {
  if (!scene || !skyUniforms) return;

  const sky = sampleSky(state.hour);
  const solar = solarState(state.hour);
  state.solar = solar;
  state.night = solar.night;

  skyUniforms.uTop.value.copy(sky.top);
  skyUniforms.uHorizon.value.copy(sky.horizon);
  skyUniforms.uGround.value.copy(sky.ground);
  skyUniforms.uSunColor.value.copy(sky.sunColor);
  skyUniforms.uSunDir.value.copy(solar.dir);
  skyUniforms.uSunStrength.value = clamp(sky.sun / 3.2, 0, 1) * 0.92 + solar.twilight * 0.34;
  skyUniforms.uMoonDir.value.set(-solar.dir.x, Math.max(0.22, 0.72 - solar.altDeg / 70), -solar.dir.z).normalize();
  skyUniforms.uMoonStrength.value = solar.night;
  skyUniforms.uStars.value = sky.stars;

  scene.fog.color.copy(sky.fog);
  scene.fog.density = sky.density;

  hemiLight.color.copy(sky.horizon);
  hemiLight.groundColor.set(0x27352b);
  hemiLight.intensity = sky.hemi;

  // 环境光强度必须随太阳一起衰减，否则碗体会在夜里仍保留白昼的填充感
  scene.environmentIntensity = 0.16 + 0.5 * solar.daylight;

  if (solar.altDeg > -1.2) {
    sunLight.position.copy(solar.dir).multiplyScalar(900);
    sunLight.visible = true;
  } else {
    sunLight.visible = false;
  }
  sunLight.target.position.set(0, 6, 0);
  sunLight.color.copy(sky.sunColor);
  sunLight.intensity = sky.sun;

  moonLight.intensity = solar.night * 0.34;

  // 泛光灯总开关：白昼无效，夜间可整组关掉
  const rig = state.floodlights ? 1 : 0;
  pitchFlood.intensity = state.night * 2600 * rig;
  facadeFill.intensity = state.night * (state.floodlights ? 0.4 : 0.08);
  floodSpots.forEach((spot) => {
    spot.intensity = state.night * 5200 * rig;
  });

  renderer.toneMappingExposure = sky.exposure;
  // 夜景泛光：白昼几乎不发光，夜里让灯桥与屏幕的溢出发亮
  if (bloomPass) {
    bloomPass.strength = state.floodlights ? 0.06 + solar.night * 0.52 : 0.05;
    bloomPass.radius = 0.32 + solar.night * 0.34;
    bloomPass.threshold = 0.94 - solar.night * 0.28;
  }

  // 球场模块自身的昼夜状态：夜间启用泛光灯与屏幕的自发光
  stadium?.setNight(state.floodlights && state.night > 0.45);

  updateTimeUI();
  phaseKeyToDataset();

  // 环境贴图按 0.4 小时的步长重建，兼顾观感与开销
  if (state.envHour === null || Math.abs(state.envHour - state.hour) > 0.4) {
    state.envHour = state.hour;
    updateEnvMap();
  }
  state.envDirty = false;
}

function phaseKeyToDataset() {
  if (el.app) el.app.dataset.phase = phaseKey(state.hour);
}

function updateTimeUI() {
  const hours = Math.floor(state.hour);
  const minutes = Math.floor((state.hour - hours) * 60);
  const clock = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  el.clock.textContent = clock;
  el.timePhase.textContent = phaseForHour(state.hour);

  const solar = state.solar || solarState(state.hour);
  const sign = solar.altDeg >= 0 ? '+' : '−';
  el.sunNote.textContent =
    `太阳高度 ${sign}${Math.abs(solar.altDeg).toFixed(1)}° · 方位 ${solar.azDeg.toFixed(0)}° ${solar.compass} · 纬度 ${LATITUDE.toFixed(2)}°N`;

  el.timeRange.value = String(state.hour);
  el.timeRange.setAttribute('aria-valuetext', `${clock}，${phaseForHour(state.hour)}`);

  // 与预设最接近且足够近时高亮该预设
  let nearest = null;
  let nearestDistance = Infinity;
  el.timePresets?.querySelectorAll('button').forEach((button) => {
    const target = Number(button.dataset.hour);
    const distance = Math.abs(target - state.hour);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearest = button;
    }
    button.classList.remove('is-active');
  });
  if (nearest && nearestDistance < 0.4) nearest.classList.add('is-active');

  // 昼夜对调按钮的激活态
  const key = phaseKey(state.hour);
  el.dayNightRow?.querySelectorAll('button').forEach((button) => {
    button.classList.toggle('is-active', button.dataset.phase === key);
  });
  el.dockNight?.setAttribute('aria-pressed', String(key === 'night'));
  el.dockNight?.classList.toggle('is-active', key === 'night');
}

function setHour(hour, announce = false) {
  state.hour = clamp(hour, 0, 24);
  state.envDirty = true;
  updateTimeUI();
  savePrefs();
  if (announce) {
    showToast(`${phaseForHour(state.hour)} · ${state.hour.toFixed(1).replace('.', ' 时 ')} 分`);
  }
}

/* ===========================================================================
 * 8. 球场模块交互封装
 * ========================================================================= */

function setSeatMode(modeId, announce = true) {
  const mode = SEAT_MODES.find((m) => m.id === modeId);
  if (!mode) return;
  state.seatMode = modeId;
  stadium?.setSeatMode(modeId);
  el.seatModeGrid.querySelectorAll('button').forEach((button) => {
    button.classList.toggle('is-active', button.dataset.seatMode === modeId);
  });
  el.seatModeName.textContent = mode.name;
  el.seatModeDesc.textContent = mode.desc;
  savePrefs();
  if (announce) showToast(`座席显示 · ${mode.name}`);
}

function setExplode(percent, announce = false) {
  state.explode = clamp(percent, 0, 100);
  stadium?.setExplode(state.explode / 100);
  el.explodeRange.value = String(state.explode);
  el.explodeValue.textContent = `${Math.round(state.explode)}%`;
  if (announce && state.explode > 0) showToast(`结构剖视 · 看台分离 ${Math.round(state.explode)}%`);
}

function setRoofOpacity(percent, announce = false) {
  state.roofOpacity = clamp(percent, 0, 100);
  stadium?.setRoofOpacity(state.roofOpacity / 100);
  el.roofRange.value = String(state.roofOpacity);
  el.roofValue.textContent = `${Math.round(state.roofOpacity)}%`;
  el.dockRoof?.setAttribute('aria-pressed', String(state.roofOpacity > 50));
  el.dockRoof?.classList.toggle('is-active', state.roofOpacity <= 50);
  if (announce) showToast(state.roofOpacity <= 50 ? '屋盖透明 · 可透视看台台阶' : '屋盖不透明');
}

function setSection(on, announce = true) {
  state.section = Boolean(on);
  stadium?.setSection(state.section);
  setSwitch('section', state.section);
  el.dockSection?.setAttribute('aria-pressed', String(state.section));
  el.dockSection?.classList.toggle('is-active', state.section);
  if (announce) showToast(state.section ? '剖切显示 · 沿南北向剖开' : '剖切显示已关闭');
}

function setContextVisible(on, announce = true) {
  state.context = Boolean(on);
  stadium?.setContextVisible(state.context);
  setSwitch('context', state.context);
  savePrefs();
  if (announce) showToast(state.context ? '周边配景已显示' : '周边配景已隐藏');
}

function setAutoRotate(on, announce = true) {
  state.autoRotate = Boolean(on);
  if (controls) {
    controls.autoRotate = state.autoRotate;
    controls.autoRotateSpeed = 0.35;
  }
  setSwitch('rotate', state.autoRotate);
  el.dockRotate?.setAttribute('aria-pressed', String(state.autoRotate));
  el.dockRotate?.classList.toggle('is-active', state.autoRotate);
  savePrefs();
  if (announce) showToast(state.autoRotate ? '自动环绕已开启' : '自动环绕已关闭');
}

function setFloodlights(on, announce = true) {
  state.floodlights = Boolean(on);
  setSwitch('floodlights', state.floodlights);
  state.envDirty = true;
  savePrefs();
  if (announce) showToast(state.floodlights ? '泛光灯已启用' : '泛光灯已关闭');
}

/** 昼夜对调：白昼 12:30 / 夜间 20:36（纯时刻驱动，日照与泛光灯保持一致） */
function toggleDayNight(announce = true) {
  const isNight = phaseKey(state.hour) === 'night';
  setHour(isNight ? 12.5 : 20.6);
  if (announce) showToast(isNight ? '切换到白昼 · 12:30' : '切换到夜间 · 20:36');
}

/** 统一驱动面板里 role="switch" 的按钮 */
function setSwitch(key, on) {
  document.querySelectorAll(`.switch[data-switch="${key}"]`).forEach((button) => {
    button.setAttribute('aria-checked', String(Boolean(on)));
    button.classList.toggle('is-active', Boolean(on));
  });
}

/* ===========================================================================
 * 9. 相机：视点解析、过渡与 UI
 * ========================================================================= */

/** 把 VIEWPOINTS 的一条记录解析为相机位姿（处理 eyeHeight 的地面高度语义） */
function resolveViewpoint(vp) {
  const groundY = vp.pos[1];
  // type === 'eye' 且给了 eyeHeight 时，pos[1] 视为地面高度，相机 y = 地面高度 + eyeHeight
  const y = vp.eyeHeight != null ? groundY + vp.eyeHeight : groundY;
  return {
    id: vp.id,
    position: new THREE.Vector3(vp.pos[0], y, vp.pos[2]),
    target: new THREE.Vector3(vp.target[0], vp.target[1], vp.target[2]),
    fov: vp.fov ?? 45,
  };
}

/** 入场的初始机位：比初始视点更高更远，收束过去时更有压迫感 */
function STATE_FREE_START() {
  const base = resolveViewpoint(ORDERED_VIEWS.find((v) => v.id === state.view) || ORDERED_VIEWS[0]);
  return base.position.clone().multiplyScalar(1.42).setY(base.position.y * 1.5 + 120);
}

function applyDebugCamera() {
  if (!camera || !params.get('cam')) return;
  const cam = params.get('cam').split(',').map(Number);
  const look = (params.get('look') || '0,12,0').split(',').map(Number);
  if (cam.length !== 3 || look.length !== 3 || cam.some(Number.isNaN) || look.some(Number.isNaN)) return;
  camera.position.set(cam[0], cam[1], cam[2]);
  controls.target.set(look[0], look[1], look[2]);
  camera.lookAt(controls.target);
  controls.update();
}

function setViewInstant(id) {
  const vp = ORDERED_VIEWS.find((v) => v.id === id);
  if (!vp || !camera) return;
  const resolved = resolveViewpoint(vp);
  viewTween = null;
  state.view = id;
  camera.position.copy(resolved.position);
  controls.target.copy(resolved.target);
  camera.fov = resolved.fov;
  camera.updateProjectionMatrix();
  camera.lookAt(controls.target);
  controls.enabled = true;
  controls.update();
  syncLineupMode(vp);
  if (vp.type === 'lineup') controls.enabled = false;   // 阵容机位锁定
  updateViewUI();
  applyDebugCamera();
}

function flyTo(id, duration = 1.5, options = {}) {
  const vp = ORDERED_VIEWS.find((v) => v.id === id);
  if (!vp || !camera || state.archiveOpen) return;
  const resolved = options.pose || resolveViewpoint(vp);
  viewTween = {
    startedAt: performance.now(),
    duration: REDUCED_MOTION ? Math.min(duration, 0.25) : duration,
    fromPosition: camera.position.clone(),
    toPosition: resolved.position,
    fromTarget: controls.target.clone(),
    toTarget: resolved.target,
    fromFov: camera.fov,
    toFov: resolved.fov,
    intro: Boolean(options.intro),
  };
  controls.enabled = false;
  controls.autoRotate = false;
  state.view = id;
  syncLineupMode(vp);
  updateViewUI();
}

/** 进入/离开阵容机位时显隐人形组并复位焦点 */
function syncLineupMode(vp) {
  const active = vp?.type === 'lineup';
  if (active === state.lineupActive) return;
  state.lineupActive = active;
  // 离开机位时：若用户开了「人形常显」则保持可见，否则收回人形
  stadium?.setLineupVisible(active || state.lineupFiguresManual);
  // 推近机位距人形约 9 m，放宽 OrbitControls 的最小距离，否则会被推回 14 m 外
  controls.minDistance = active ? 3 : 14;
  if (!active) {
    state.lineupFocus = null;
    figureLieTarget = 0;   // 人形立正
    el.lineupCard?.classList.remove('is-visible', 'is-flipped');
  }
}

function stepView(delta) {
  const index = ORDERED_VIEWS.findIndex((v) => v.id === state.view);
  const next = (index + delta + ORDERED_VIEWS.length) % ORDERED_VIEWS.length;
  flyTo(ORDERED_VIEWS[next].id, 1.3);
}

function updateViewUI() {
  document.querySelectorAll('.view-button').forEach((button) => {
    button.classList.toggle('is-active', button.dataset.view === state.view);
  });

  const index = ORDERED_VIEWS.findIndex((v) => v.id === state.view);
  const vp = ORDERED_VIEWS[index] || ORDERED_VIEWS[0];
  // 主标题只在整体鸟瞰时保留，贴近的机位让位给画面
  document.body.classList.toggle('hero-hidden', ['aerial-se', 'aerial-nw', 'aerial-sw'].indexOf(state.view) < 0);

  el.captionIndex.textContent = String(index + 1).padStart(2, '0');
  el.captionTitle.textContent = vp.nameZh || vp.name;
  el.captionText.textContent = vp.note || GROUP_HINT[vp.type] || '';
}

const GROUP_HINT = {
  aerial: '整体鸟瞰机位，用来看清碗体、四角象限与草坪的平面关系。',
  eye: '人眼高度机位（站立视线 1.7 m），用于判断真实尺度与遮挡。',
  section: '剖视机位，沿南北向剖开，露出三层看台台阶与屋盖悬挑。',
  lineup: '阵容站位机位：机位锁定在死忠区球门后，鼠标靠近红色人形可推近看球员卡。',
};

function tickCamera(dt) {
  if (!viewTween) {
    controls.update(dt);
    return;
  }
  const raw = clamp((performance.now() - viewTween.startedAt) / (viewTween.duration * 1000), 0, 1);
  const e = easeInOutCubic(raw);
  camera.position.lerpVectors(viewTween.fromPosition, viewTween.toPosition, e);
  controls.target.lerpVectors(viewTween.fromTarget, viewTween.toTarget, e);
  camera.fov = lerp(viewTween.fromFov, viewTween.toFov, e);
  camera.updateProjectionMatrix();
  camera.lookAt(controls.target);

  if (raw >= 1) {
    const finishedIntro = viewTween.intro;
    viewTween = null;
    controls.enabled = state.view !== 'lineup';       // 阵容机位保持锁定
    controls.autoRotate = state.autoRotate && state.view !== 'lineup';
    controls.update();
    if (finishedIntro) dismissMouseHint();
  }
}

/* ===========================================================================
 * 10. 看台拾取（Raycaster）
 * ========================================================================= */

function initPicking() {
  raycaster = new THREE.Raycaster();
  raycaster.layers.set(0);
  standByKey = new Map();
  hoverHelper = new THREE.Box3Helper(new THREE.Box3(), new THREE.Color(COLORS.structure.accent));
  hoverHelper.material.transparent = true;
  hoverHelper.material.opacity = 0.85;
  hoverHelper.material.depthTest = false;
  hoverHelper.visible = false;
  hoverHelper.renderOrder = 999;
  scene.add(hoverHelper);
}

/** 把四座看台的根对象缓存起来，并给其后代打上看台标记，便于拾取回查 */
function indexStands() {
  standByKey = new Map();
  if (!stadium?.parts) return;
  STAND_ORDER.forEach((key) => {
    const part = stadium.parts[STAND_PART_KEY[key]];
    if (!part) return;
    standByKey.set(key, part);
    part.traverse((obj) => {
      obj.userData.__standKey = key;
    });
  });
}

function pickTargets() {
  return [...standByKey.values()];
}

function standKeyAt(clientX, clientY) {
  if (!standByKey?.size || !camera) return null;
  const rect = el.canvas.getBoundingClientRect();
  pointerNDC.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  pointerNDC.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointerNDC, camera);
  const hits = raycaster.intersectObjects(pickTargets(), true);
  for (const hit of hits) {
    let node = hit.object;
    while (node) {
      if (node.userData?.__standKey) return node.userData.__standKey;
      node = node.parent;
    }
  }
  return null;
}

function updateHoverHelper(key) {
  if (!hoverHelper) return;
  if (!key) {
    hoverHelper.visible = false;
    return;
  }
  const part = standByKey.get(key);
  if (!part) {
    hoverHelper.visible = false;
    return;
  }
  const box = new THREE.Box3().setFromObject(part);
  if (box.isEmpty()) {
    hoverHelper.visible = false;
    return;
  }
  hoverHelper.box.copy(box);
  hoverHelper.visible = true;
}

/** 每帧最多做一次拾取，避免指针事件把 CPU 打满 */
function refreshPick() {
  if (!pointerDirty || !state.started) return;
  pointerDirty = false;
  if (state.archiveOpen) {
    setHover(null);
    return;
  }
  if (state.view === 'lineup') {
    updateLineupPointer();   // 阵容机位下改做人形靠近判定
    return;
  }
  if (state.playersOpen) {
    setHover(null);
    return;
  }
  const key = pointerInside ? standKeyAt(pointerClient.x, pointerClient.y) : null;
  setHover(key);
  if (key) {
    el.pickTip.style.left = `${pointerClient.x}px`;
    el.pickTip.style.top = `${pointerClient.y}px`;
  }
}

function setHover(key) {
  if (hoveredStand === key) return;
  hoveredStand = key;
  updateHoverHelper(key || state.pinned);
  if (key) {
    const data = STANDS[key];
    el.pickTipName.textContent = `${data.nameZh} · ${data.name}`;
    const tiers = data.tiers?.length ?? 0;
    el.pickTipMeta.textContent = `${tiers} 层 · ${fmtInt(data.seats?.value)} 座 · 点击查看档案`;
    el.pickTip.classList.add('is-open');
    el.canvas.style.cursor = 'pointer';
  } else {
    el.pickTip.classList.remove('is-open');
    el.canvas.style.cursor = '';
  }
}

function pinStand(key) {
  state.pinned = key || null;
  updateHoverHelper(key || hoveredStand);
  document.body.classList.toggle('has-pick', Boolean(key));
  if (!key) {
    el.standCard.classList.remove('is-open');
    return;
  }
  buildStandCard(key);
  el.standCard.classList.add('is-open');
  // 初始位置让开看台，避免信息卡正对被选中的体量
  if (key === 'north') flyTo('aerial-nw', 1.2);
}

function buildStandCard(key) {
  const data = STANDS[key];
  if (!data) return;
  const tiers = data.tiers ?? [];
  const tierCount = tiers.length;
  const rows = tiers.reduce((sum, t) => sum + (t.rows || 0), 0);

  el.standCardKicker.textContent = `STAND FILE · ${String(STAND_ORDER.indexOf(key) + 1).padStart(2, '0')} / 04`;
  el.standCardName.textContent = data.nameZh;
  el.standCardEn.textContent = (data.nameEn || data.name || '').toUpperCase();
  el.standCardFormer.textContent = data.former
    ? `原名 ${data.former}${data.renamedNote ? ` · ${data.renamedNote.replace(/^\[[^\]]+\]\s*/, '')}` : ''}`
    : '';

  el.standCardGrid.innerHTML = [
    [String(tierCount), '层段 TIERS'],
    [fmtInt(data.seats?.value), '座席 SEATS'],
    [`${(data.roofHeight ?? 0).toFixed(0)} m`, '屋盖高度 ROOF'],
    [`${rows}`, '总排数 ROWS'],
    [data.roofCantilever ? `${data.roofCantilever} m` : '—', '屋盖悬挑 CANTILEVER'],
    [data.direction === 'north' ? '北侧' : data.direction === 'south' ? '南侧' : data.direction === 'east' ? '东侧' : '西侧', '方位 SIDE'],
  ]
    .map(([value, label]) => `<div><b>${value}</b><small>${label}</small></div>`)
    .join('');

  el.standCardTiers.innerHTML = tiers.length
    ? tiers
        .map(
          (t) =>
            `<div class="stand-tier"><i>${t.id}</i><span>${t.rows} 排 · 行距 ${t.rowDepth} m · 排高 ${t.rowRise} m</span><em>起始 ${t.startDepth} m</em></div>`,
        )
        .join('')
    : '<div class="stand-tier"><i>—</i><span>层段数据未提供</span><em></em></div>';

  el.standCardFacade.innerHTML = `<strong>立面 · ${data.facade?.style ?? '—'}</strong>${data.facade?.note ?? ''}`;

  const contextBits = [];
  if (data.contextNote) contextBits.push(data.contextNote);
  if (data.asymmetryNote) contextBits.push(data.asymmetryNote);
  if (data.awayFansNote) contextBits.push(data.awayFansNote);
  if (data.stairsOfficial) contextBits.push(`台阶 ${data.stairsOfficial} 级（官方导览口径）。`);
  if (data.leitchGable) contextBits.push('中央仍存 Archibald Leitch 设计的老通道山墙（1910）。');
  if (data.seats?.src) contextBits.push(`座席口径：${data.seats.src}`);
  el.standCardContext.innerHTML =
    `<strong>背景与实证</strong>${contextBits.length ? contextBits.join(' ') : '该看台暂无额外的公开来源说明。'}`;
}

function clearPick() {
  setHover(null);
  pinStand(null);
}

/* ===========================================================================
 * 10b. 阵容站位机位：总览锁定 · 靠近即锁定 · 翻转球员卡
 * ========================================================================= */

const LINEUP_HOVER_PX = 52;      // 鼠标与人形屏幕锚点的判定半径
const LINEUP_REARM_DELAY = 1000; // 退出锁定后，重新开始靠近判定的冷却（ms）

let lineupRearmAt = 0;           // 早于该时刻不进行靠近判定

/** 世界坐标 → 页面客户区像素（在人形后或视野外时返回 null） */
function worldToClient(vector) {
  if (!camera) return null;
  const projected = vector.clone().project(camera);
  if (projected.z > 1) return null;
  const rect = el.canvas.getBoundingClientRect();
  return {
    x: rect.left + ((projected.x + 1) / 2) * rect.width,
    y: rect.top + ((1 - projected.y) / 2) * rect.height,
  };
}

/** 推近机位：稍远一点（约 12 m），让人形整体落在卡面覆盖范围内 */
function lineupFocusPose(part) {
  const at = part.worldAt;
  return {
    position: new THREE.Vector3(at.x - 11.5, 4.8, at.z + 2.8),
    target: new THREE.Vector3(at.x + 0.4, 1.35, at.z),
    fov: 42,
  };
}

/** 按 slug 取球员的卡面内容数据：PLAYER_CARDS → 队史卡面 → 自定义球员（同结构） */
function cardDataFor(player) {
  if (!player?.slug) return null;
  return PLAYER_CARDS.players.find((item) => item.slug === player.slug)
    ?? ALL_TIME_CARDS.players.find((item) => item.slug === player.slug)
    ?? customPlayers.find((item) => item.slug === player.slug)
    ?? null;
}

/** 无照片卡面的占位底图（深红渐变 + 暗纹，正面留白给球衣号码与姓名） */
const NO_PHOTO_DATA_URI = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 340 500">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0.6" y2="1">
      <stop offset="0" stop-color="#4a0a17"/>
      <stop offset="0.55" stop-color="#2a060d"/>
      <stop offset="1" stop-color="#160308"/>
    </linearGradient>
  </defs>
  <rect width="340" height="500" fill="url(#g)"/>
  <g stroke="#c8102e" stroke-opacity="0.16" stroke-width="1">
    <path d="M0 60 H340 M0 120 H340 M0 180 H340 M0 240 H340 M0 300 H340 M0 360 H340 M0 420 H340"/>
    <path d="M60 0 V500 M140 0 V500 M220 0 V500 M300 0 V500"/>
  </g>
</svg>`)}`;

/** 球员卡正面照片：自定义球员没传照片时用占位底图 */
function playerPhoto(player) {
  return player?.photo || NO_PHOTO_DATA_URI;
}

/** 宽松版球衣（衣身加宽，两位数号码缩号后仍留在衣服内） */
function jerseySVG(num) {
  const size = String(num).length > 1 ? 28 : 34;
  return `<svg class="fjersey" aria-label="球衣号码 ${num}" viewBox="0 0 100 100" width="88" height="88">
    <path d="M28 10 C36 4 43 2 50 2 C57 2 64 4 72 10 L92 22 L84 42 L76 37 L76 93 L24 93 L24 37 L16 42 L8 22 Z" fill="#c8102e" stroke="#7c0a1e" stroke-width="2"/>
    <path d="M43 6.5 Q50 14 57 6.5" stroke="#7c0a1e" stroke-width="2.4" fill="none"/>
    <path d="M22 14 l9 7 M17 20 l9 7" stroke="#f2ede8" stroke-width="2.8" opacity=".9"/>
    <path d="M78 14 l-9 7 M83 20 l-9 7" stroke="#f2ede8" stroke-width="2.8" opacity=".9"/>
    <text x="50" y="66" text-anchor="middle" font-size="${size}" font-weight="500" font-family="Georgia, 'Times New Roman', serif" fill="#f7efe9">${num}</text>
  </svg>`;
}

/** 主教练角标：西装领带（替代球衣号码） */
function suitSVG() {
  return `<svg class="fjersey" aria-label="主教练西装" viewBox="0 0 100 100" width="88" height="88">
    <path d="M28 10 C36 4 43 2 50 2 C57 2 64 4 72 10 L92 22 L84 42 L76 37 L76 93 L24 93 L24 37 L16 42 L8 22 Z" fill="#1d1a1c" stroke="#000" stroke-width="2"/>
    <path d="M42 7 L50 17 L58 7 L55 4 L50 6 L45 4 Z" fill="#f2ede8"/>
    <path d="M38 6 L50 17 L44 34 L30 16 Z" fill="#151215"/>
    <path d="M62 6 L50 17 L56 34 L70 16 Z" fill="#151215"/>
    <path d="M50 17 L45.5 26 L50 46 L54.5 26 Z" fill="#7c0a1e" stroke="#4d0512" stroke-width="1.4"/>
  </svg>`;
}

/**
 * 成品数字卡面（与 assets/球员卡面/ 的离线卡同一设计）：
 * 正面 = 照片背景 + 位置/国籍角标 + 队徽 + 英文名 + 球衣号码；
 * 背面 = 三项生涯数据 + 成就节点 + 荣誉徽章。
 * card 来自 PLAYER_CARDS（按 slug 关联），photo/num/captain 来自 PLAYERS。
 */
function fullCardHTML(card, player) {
  const num = player.num ?? '—';
  const isCoach = !!card.coach;
  const chips = isCoach
    ? `<span class="fchip" data-tooltip="Head Coach">HC</span>`
      + `<span class="fchip" data-tooltip="${card.natZh ?? player.nation ?? ''}">${card.nat}</span>`
    : `<span class="fchip" data-tooltip="${player.posZh ?? card.posZh}">${card.pos}</span>`
      + `<span class="fchip" data-tooltip="${player.nation ?? card.natZh}">${card.nat}</span>`;
  const crest = `<img class="fcrest" alt="" src="${PLAYER_CARDS.crest}" loading="lazy">`;
  const stats = card.stats.map(([k, v]) => `<div class="fstat"><b>${v}</b><small>${k}</small></div>`).join('');
  const ach = card.achievements
    .map(([year, text]) => `<div><b>${year}</b> — ${text}</div>`)
    .join('');
  const honours = card.honours?.length
    ? `<div class="fhonours">${card.honours.map((h) => `<span>${h}</span>`).join('')}</div>`
    : '';
  const captain = player.captain ? '<span class="fchip">C</span>' : '';
  const badge = isCoach
    ? `HEAD COACH · MANCHESTER UNITED`
    : `NO.${num} · MANCHESTER UNITED${player.captain ? ' · CAPTAIN' : ''}`;
  return `
    <div class="fcard" role="button" tabindex="0" aria-label="${player.nameZh}数字卡面，点击翻面">
      <div class="fface">
        <img class="fphoto" alt="" src="${playerPhoto(player)}" loading="lazy">
        <div class="fshade" aria-hidden="true"></div>
        ${crest}
        <div style="position:absolute;top:14px;left:14px;display:flex;gap:6px;">${chips}${captain}</div>
        <div class="fname">
          <small>${badge}</small>
          <strong>${player.name}</strong>
        </div>
        ${isCoach ? suitSVG() : jerseySVG(num)}
      </div>
      <div class="fface fback">
        <div class="fback-inner">
          <div class="fback-head"><span>CAREER · 生涯与成就</span><small>${isCoach ? 'HEAD COACH' : `NO.${num}`}</small></div>
          <p class="fstat-label">${card.statLabel}</p>
          <div class="fstats">${stats}</div>
          <div class="fach">${ach}</div>
          <div style="margin-top:auto;">
            ${honours}
            <p class="fnote">${card.statNote}。${isCoach ? '' : '照片为网络搜集图，公开分发前需确认授权。'}</p>
          </div>
        </div>
      </div>
    </div>`;
}

/** 空白占位卡（主教练等暂无卡面的对象） */
function blankCardHTML(player) {
  return `
    <div class="fcard fcard-blank" aria-label="${player.nameZh}卡面制作中">
      <div class="fface fcard-blank">
        <div class="fblank-msg">数字卡面制作中<small>${player.name} · ${player.pos}</small></div>
      </div>
    </div>`;
}

/** 卡面翻面：抽屉与阵容浮层共用（事件委托，幂等绑定） */
let cardFlipBound = false;
function bindCardFlip() {
  if (cardFlipBound) return;
  cardFlipBound = true;
  document.addEventListener('click', (event) => {
    const card = event.target.closest('.fcard');
    if (card) card.classList.toggle('is-flipped');
  });
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const card = event.target instanceof HTMLElement && event.target.closest('.fcard');
    if (card) {
      event.preventDefault();
      card.classList.toggle('is-flipped');
    }
  });
}

function fillLineupCard(player) {
  // 成品卡直接覆盖草稿内容（340×500 设计稿按 0.882 缩放进 300px 浮层）
  const card = cardDataFor(player);
  el.lineupCardInner.innerHTML = card
    ? fullCardHTML(card, player)
    : blankCardHTML(player);
}

function focusLineup(part) {
  state.lineupFocus = part.name;
  flyTo('lineup', 1.0, { pose: lineupFocusPose(part) });
  fillLineupCard(part.player);
  el.lineupCard.classList.remove('is-flipped');
  el.lineupCard.classList.add('is-visible');
  el.canvas.style.cursor = 'pointer';
}

function unfocusLineup(immediate = false) {
  if (!state.lineupFocus) return;
  state.lineupFocus = null;
  lineupRearmAt = performance.now() + LINEUP_REARM_DELAY;   // 1 s 后才开始下次判定
  el.lineupCard.classList.remove('is-visible', 'is-flipped');
  el.canvas.style.cursor = '';
  flyTo('lineup', immediate ? 0.6 : 1.1);   // 回到总览机位（仍锁定）
}

/**
 * 每帧（指针脏时）在阵容机位下做「鼠标靠近」判定。
 * 靠近任一人形即锁定机位与卡面；锁定后忽略后续鼠标移动（避免视角乱飘），
 * 由 Esc / 点击空白 / 切走视点退出。
 */
function updateLineupPointer() {
  if (state.view !== 'lineup' || !stadium?.lineupParts?.length) return;
  if (state.lineupFocus) return;                     // 已锁定：鼠标不再参与判定
  if (formationTween) return;                        // 阵型走位期间不锁定（互斥）
  if (performance.now() < lineupRearmAt) return;     // 退出锁定后的冷却期
  if (!pointerInside) return;

  let nearest = null;
  let bestDist = Infinity;
  for (const part of stadium.lineupParts) {
    const client = worldToClient(part.anchor);
    if (!client) continue;
    const dist = Math.hypot(client.x - pointerClient.x, client.y - pointerClient.y);
    if (dist < bestDist) {
      bestDist = dist;
      nearest = part;
    }
  }
  if (nearest && bestDist <= LINEUP_HOVER_PX) focusLineup(nearest);
}

/** 焦点球员的卡面跟随其头顶锚点（补间飞行期间也保持贴住） */
function updateLineupCardAnchor() {
  if (state.view !== 'lineup' || !state.lineupFocus || !stadium?.lineupParts) return;
  const part = stadium.lineupParts.find((p) => p.name === state.lineupFocus);
  if (!part) return;
  const client = worldToClient(part.anchor);
  if (!client) return;
  el.lineupCard.style.left = `${Math.round(client.x)}px`;
  el.lineupCard.style.top = `${Math.round(client.y)}px`;
}

/* ===========================================================================
 * 11. 数据驱动的界面构建
 * ========================================================================= */

/** 解析 COLORS 里的颜色路径，写入座席模式按钮的色块 */
function applySwatches() {
  document.querySelectorAll('[data-swatch]').forEach((node) => {
    const [group, key] = node.dataset.swatch.split('.');
    const value = COLORS?.[group]?.[key];
    if (typeof value === 'number') node.style.setProperty('--swatch', hex(value));
  });
}

function buildHeroFacts() {
  const seats = META.capacity?.premierLeague ?? META.capacity?.seatedOnly ?? 0;
  const rows = [
    [fmtInt(seats), '座席（英超申报）'],
    [`${PITCH.length} × ${PITCH.width}`, '草坪（米 · 推定）'],
    [`${STANDS.north.roofCantilever} m`, '北看台屋盖悬挑'],
    [`${STAND_ORDER.length} + ${QUADRANTS?.corners?.length ?? 4}`, '看台 + 四角象限'],
  ];
  el.heroFacts.innerHTML = rows
    .map(([value, label]) => `<div class="hero-fact"><b>${value}</b><small>${label}</small></div>`)
    .join('');
}

/** 按类型把视点按钮渲染进指定面板容器（含分组小标题） */
function renderViewPanel(container, types) {
  if (!container) return;
  container.innerHTML = VIEW_GROUPS
    .filter((group) => types.includes(group.type))
    .map((group) => {
      const items = VIEWPOINTS.filter((v) => v.type === group.type);
      if (!items.length) return '';
      const buttons = items
        .map((vp) => {
          const order = ORDERED_VIEWS.indexOf(vp) + 1;
          const badge = order <= 10 ? `<kbd>${order === 10 ? 0 : order}</kbd>` : '';
          return `<button class="view-button" type="button" data-view="${vp.id}" title="${vp.note || vp.nameZh}">
            <span class="vb-index">${String(order).padStart(2, '0')}</span>
            <span class="vb-name">${vp.nameZh || vp.name}</span>
            ${badge}
          </button>`;
        })
        .join('');
      return `<div class="view-group">
        <div class="view-group-head"><span>${group.en} · ${group.label}</span><em>${group.hint}</em></div>
        ${buttons}
      </div>`;
    })
    .join('');
}

function buildViewList() {
  // 左列「视点导航」：鸟瞰 + 剖视；左列「观众视角」：人眼高度；右列「阵容站位」
  renderViewPanel(el.viewGroups, ['aerial', 'section']);
  renderViewPanel(el.eyeGroups, ['eye']);
  renderViewPanel(el.lineupGroups, ['lineup']);
  const countIn = (types) => String(VIEWPOINTS.filter((v) => types.includes(v.type)).length).padStart(2, '0');
  el.viewPanelCount.textContent = countIn(['aerial', 'section']);
  el.viewPanelCount.title = `共 ${VIEWPOINTS.filter((v) => ['aerial', 'section'].includes(v.type)).length} 个视点`;
  el.eyePanelCount.textContent = countIn(['eye']);
  el.eyePanelCount.title = `共 ${VIEWPOINTS.filter((v) => v.type === 'eye').length} 个视点`;
  el.lineupPanelCount.textContent = countIn(['lineup']);
}

/** 阵容面板的 11 人名单：按 LINEUP 顺序（门将 → 后卫 → 中场 → 前锋），点击直达特写 */
function buildLineupRoster() {
  if (!el.lineupRoster) return;
  el.lineupRoster.innerHTML = lineupSlots.map((slot) => {
    const player = slot.player;
    return `<button class="roster-row" type="button" data-slot="${slot.slotName}" title="${player.nameZh} · ${player.posZh ?? player.pos}">
      <b>${player.num ?? '—'}</b>
      <span>${player.nameZh}</span>
      <em>${player.pos}</em>
    </button>`;
  }).join('');
}

/** 阵型选择器（8 套热门阵型，来源见 data.js FORMATIONS） */
function buildFormationPicker() {
  if (!el.formationPicker) return;
  el.formationPicker.innerHTML = FORMATIONS.list.map((formation) => `
    <button class="formation-btn${formation.id === state.formation ? ' is-active' : ''}" type="button"
            data-formation="${formation.id}" title="${formation.note}">
      ${formation.label}
    </button>`).join('');
}

function populateArchive() {
  const s = stadium?.stats;
  const tierTotal = STAND_ORDER.reduce((sum, k) => sum + (STANDS[k].tiers?.length ?? 0), 0);
  const rowTotal = STAND_ORDER.reduce(
    (sum, k) => sum + (STANDS[k].tiers ?? []).reduce((a, t) => a + (t.rows || 0), 0),
    0,
  );

  el.archiveStats.innerHTML = [
    [fmtInt(META.capacity?.premierLeague), '座席目标数（官方申报口径）'],
    [s ? fmtInt(s.seats) : '—', '生成座席（按几何排布）'],
    [
      Object.entries(META.standSeats ?? {})
        .map(([k, v]) => `${({ north: '北', south: '南', east: '东', west: '西', quadrants: '四角' })[k] ?? k} ${fmtInt(v.value)}`)
        .join(' · '),
      '官方分看台座席口径',
    ],
    [s ? fmtInt(s.triangles) : '—', '三角面'],
    [s ? `${Math.round(s.buildMs)} ms` : '—', '几何构建耗时'],
    [`${s?.standCount ?? STAND_ORDER.length} / ${s?.tierCount ?? tierTotal}`, '看台数 / 层段数'],
    [`${rowTotal}`, '看台总排数（重建值）'],
    [`${PITCH.length} × ${PITCH.width} m`, '草坪尺寸（推定）'],
    [`${BOWL_INNER.halfX.toFixed(1)} / ${BOWL_INNER.halfZ.toFixed(1)} m`, '碗体内缘半宽 X / Z'],
    [`${RUN_OFF.goalLine} / ${RUN_OFF.touchLine} m`, '球门线 / 边线缓冲'],
    [`${META.capacity?.recordAttendance ? fmtInt(META.capacity.recordAttendance) : '—'}`, '历史最高上座（1939，含站席）'],
  ]
    .map(([value, label]) => `<div><b>${value}</b><small>${label}</small></div>`)
    .join('');

  el.archiveFacts.innerHTML = [
    ['球场', `${META.name} · ${META.nameEn}`],
    ['别称', META.nickname],
    ['俱乐部', `${META.clubZh} · ${META.club}`],
    ['所在地', `${META.cityZh} · ${META.city}`],
    ['启用', `${META.opened} · ${META.openedNote.replace(/^\[[^\]]+\]\s*/, '')}`],
    ['设计', META.architect],
    ['欧足联分级', META.uefaCategory],
    ['坐标', `${META.osGridRef} · ${META.osGridRefNote.replace(/^\[[^\]]+\]\s*/, '')}`],
    [
      '容量（三口径并列）',
      `英超申报 ${fmtInt(META.capacity?.premierLeague)} · 欧战口径 ${fmtInt(META.capacity?.uefa)} · 仅座席 ${fmtInt(META.capacity?.seatedOnly)}`,
    ],
  ]
    .map(([k, v]) => `<div><span>${k}</span><span>${v}</span></div>`)
    .join('');

  el.archiveBasis.innerHTML = [
    ['草坪尺寸', `${PITCH.length} × ${PITCH.width} m 按标准假定，未取得老特拉福德实测来源。${PITCH.lengthNote}`],
    ['看台排布', '排数、行距 0.78 m、排高 0.42 m、层间环廊宽度均为重建值 [推算]。'],
    ['已确证的官方数据', '北看台三层 · 屋盖悬挑 58.5 m · 台阶 177 级 · 南看台单层 · 容量 74,244（英超申报）。'],
    ['外立面', '材质、分格与屋顶形态为重建，未取得任何官方建筑图纸。'],
    ['周边配景', CONTEXT?.note ?? '道路、停车场与地标方位取自公开来源与实测核查，坐标为示意性反推。'],
    ['标识处理', '不复制任何俱乐部注册商标图形；立面仅使用文字标识，徽章位置以抽象几何占位。'],
    ['数据版本', `js/data.js DATA_VERSION = ${DATA_VERSION}`],
  ]
    .map(([k, v]) => `<div><span>${k}</span><span>${v}</span></div>`)
    .join('');

  el.archiveStands.innerHTML = STAND_ORDER.map((key, index) => {
    const d = STANDS[key];
    const tiers = d.tiers ?? [];
    const notes = [];
    if (d.renamedNote) notes.push(d.renamedNote);
    if (d.asymmetryNote) notes.push(d.asymmetryNote);
    if (d.awayFansNote) notes.push(d.awayFansNote);
    if (d.contextNote) notes.push(d.contextNote);
    if (d.facade?.note) notes.push(d.facade.note);
    if (d.roofCantileverNote) notes.push(`屋盖悬挑：${d.roofCantileverNote}`);
    if (d.stairsOfficial) notes.push(`台阶 ${d.stairsOfficial} 级 · 官方导览口径。`);

    return `<article class="archive-stand">
      <h4>${String(index + 1).padStart(2, '0')} ${d.nameZh}<em>${(d.nameEn || '').toUpperCase()}</em></h4>
      <p><b>原名</b> ${d.former || '—'} · <b>层数</b> ${tiers.length} 层 ·
        <b>座席</b> ${fmtInt(d.seats?.value)}（${d.seats?.src ?? '口径未标注'}）</p>
      <p><b>层段</b> ${tiers.map((t) => `${t.id}：${t.rows} 排 / 起 ${t.startDepth} m / 标高 ${t.baseHeight} m`).join('；') || '—'}</p>
      <p><b>尺度</b> 看台总进深 ${d.totalDepth ?? '—'} m · 屋盖前缘标高 ${d.roofHeight ?? '—'} m ·
        ${d.roofCantilever ? `悬挑 ${d.roofCantilever} m` : '悬挑未标注'}</p>
      <p><b>立面</b> ${d.facade?.style ?? '—'}</p>
      ${notes.map((n) => `<p class="note${n.startsWith('[官方]') ? ' note--official' : ''}">${n}</p>`).join('')}
    </article>`;
  }).join('');

  el.archiveSources.innerHTML = SOURCES.map((src) => {
    const blocked = src.status === 'blocked';
    return `<div class="source-item${blocked ? ' source-item--blocked' : ''}">
      <div class="source-item-top">
        <span class="source-label">${src.label}</span>
        <span class="source-tier">${src.tier}</span>
      </div>
      <span class="source-url">${src.url}</span>
      ${blocked ? `<p class="source-blocked-note">${src.note ?? '构建环境无法访问该来源'}</p>` : ''}
    </div>`;
  }).join('');

  el.archiveDisclaimerShort.textContent = DISCLAIMER.short;
  el.archiveDisclaimerLong.innerHTML = DISCLAIMER.long.map((text) => `<li>${text}</li>`).join('');

  el.heroNote.textContent = DISCLAIMER.short;
  el.bottomDisclaimer.textContent = DISCLAIMER.short;
}

/* ===========================================================================
 * 9b. 队史档案库面板与队歌播放器
 * ---------------------------------------------------------------------------
 * 面板本身是静态壳，内容来自 js/data.js 的 HERITAGE；队歌用 <audio> 循环播放，
 * 受浏览器自动播放策略约束：首帧被拒时挂一次性交互监听，用户一落地就续上。
 * ========================================================================= */

/** 秒 → mm:ss */
function formatClock(seconds) {
  const safe = Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
  const minutes = Math.floor(safe / 60);
  return `${String(minutes).padStart(2, '0')}:${String(Math.floor(safe % 60)).padStart(2, '0')}`;
}

function renderHeritage() {
  const milestones = HERITAGE?.milestones ?? [];
  const honours = HERITAGE?.honours ?? [];

  if (el.heritageTimeline) {
    el.heritageTimeline.innerHTML = milestones
      .map((item) => `<li>
        <span class="timeline-year">${item.year}</span>
        <span class="timeline-body">
          <strong>${item.title}</strong>
          <small>${item.text}</small>
        </span>
      </li>`)
      .join('');
  }

  if (el.heritageHonours) {
    el.heritageHonours.innerHTML = honours
      .map((item) => `<div class="honour">
        <b>${item.value}</b>
        <span>${item.label}</span>
        <small>${item.note ?? ''}</small>
      </div>`)
      .join('');
  }

  if (el.heritageNote) el.heritageNote.textContent = HERITAGE?.note ?? '';
  if (el.anthemTitle) el.anthemTitle.textContent = HERITAGE?.anthem?.title ?? '曼联队歌';
  if (el.anthemSub) el.anthemSub.textContent = HERITAGE?.anthem?.subtitle ?? '';
  if (el.anthemNote) el.anthemNote.textContent = HERITAGE?.anthem?.note ?? '';
}

function setAnthemState(text, playing) {
  if (el.anthemState) el.anthemState.textContent = text;
  if (el.anthemPlay) {
    el.anthemPlay.textContent = playing ? '播放中' : '播放';
    el.anthemPlay.classList.toggle('is-active', Boolean(playing));
    el.anthemPlay.setAttribute('aria-pressed', String(Boolean(playing)));
  }
}

function updateAnthemProgress() {
  const audio = el.anthemPlayer;
  if (!audio) return;
  const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
  const current = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
  if (el.anthemTime) el.anthemTime.textContent = `${formatClock(current)} / ${formatClock(duration)}`;
  if (el.anthemProgress) {
    el.anthemProgress.style.width = duration > 0 ? `${(current / duration) * 100}%` : '0%';
  }
}

function startAnthem(notify) {
  const audio = el.anthemPlayer;
  if (!audio) return;
  state.anthemStopped = false;
  const played = audio.play();
  if (played && typeof played.catch === 'function') {
    played.catch(() => {
      // 自动播放被拦：保持待播状态，等用户第一次交互再续
      if (!state.anthemStopped) setAnthemState('待播放', false);
      if (notify) showToast('浏览器拦截了自动播放，点「播放」即可出声');
    });
  }
}

function stopAnthem(notify) {
  const audio = el.anthemPlayer;
  if (!audio) return;
  state.anthemStopped = true;
  audio.pause();
  audio.currentTime = 0;
  setAnthemState('已停止', false);
  updateAnthemProgress();
  if (notify) showToast('队歌已停止');
}

function toggleAnthem() {
  const audio = el.anthemPlayer;
  if (!audio) return;
  if (audio.paused) startAnthem(true);
  else stopAnthem(true);
}

function initAnthem() {
  const audio = el.anthemPlayer;
  if (!audio) return;

  const config = HERITAGE?.anthem ?? {};
  audio.src = config.src ?? 'assets/manchester-united-anthem.mp3';
  audio.loop = true;
  audio.preload = 'auto';
  audio.volume = clamp(Number(config.volume) || 0.55, 0, 1);

  audio.addEventListener('loadedmetadata', updateAnthemProgress);
  audio.addEventListener('durationchange', updateAnthemProgress);
  audio.addEventListener('timeupdate', updateAnthemProgress);
  audio.addEventListener('play', () => setAnthemState('循环播放', true));
  audio.addEventListener('pause', () => {
    if (state.anthemStopped) setAnthemState('已停止', false);
  });
  audio.addEventListener('error', () => {
    setAnthemState('音频未载入', false);
    showToast('队歌文件读取失败：assets/manchester-united-anthem.mp3');
  });

  el.anthemPlay?.addEventListener('click', () => startAnthem(true));
  el.anthemStop?.addEventListener('click', () => stopAnthem(true));

  // 首次交互后允许发声（自动播放策略），只续一次
  const unlock = () => {
    if (!state.anthemStopped && audio.paused) startAnthem(false);
  };
  window.addEventListener('pointerdown', unlock, { once: true });
  window.addEventListener('keydown', unlock, { once: true });

  updateAnthemProgress();
  setAnthemState('未播放', false);
  startAnthem(false);
}

/** 控制台两个面板互斥显示：02 控制 / 03 队史 */
function applyConsoleTab() {
  const showHeritage = state.consoleTab === 'heritage';
  if (el.heritagePanel) {
    el.heritagePanel.hidden = !showHeritage;
    if (showHeritage) {
      el.heritagePanel.classList.toggle('is-collapsed', state.heritageCollapsed);
    } else {
      el.heritagePanel.classList.remove('is-open');
    }
  }
  if (el.atmospherePanel) el.atmospherePanel.hidden = showHeritage;
  el.controlsToHeritage?.setAttribute('aria-pressed', String(showHeritage));
  el.heritageToControls?.setAttribute('aria-pressed', String(!showHeritage));
}

function setConsoleTab(tab, notify) {
  state.consoleTab = tab === 'heritage' ? 'heritage' : 'atmosphere';
  applyConsoleTab();
  if (notify) showToast(state.consoleTab === 'heritage' ? '队史档案库 · 曼联 1878—2013' : '控制台 · 日照 · 座席 · 剖视');
}

/** 把球场模块的统计写进 HUD 与顶栏 */
function applyStats() {
  const s = stadium?.stats;
  if (!s) return;
  const tierTotal = STAND_ORDER.reduce((sum, k) => sum + (STANDS[k].tiers?.length ?? 0), 0);
  const seatTotal = s.seats ?? s.generatedSeatTotal ?? 0;

  el.statSeats.textContent = fmtInt(seatTotal);
  el.statTriangles.textContent = fmtInt(s.triangles);
  el.statBuild.textContent = `${Math.round(s.buildMs)}`;
  el.statStands.textContent = `${s.standCount ?? STAND_ORDER.length}`;
  el.statTiers.textContent = `${s.tierCount ?? tierTotal}`;

  el.metaBuild.textContent =
    `座席 ${fmtInt(seatTotal)} · 三角面 ${fmtInt(s.triangles)} · 构建 ${Math.round(s.buildMs)} ms`;

  const rows = s.seatRows ? ` · 座席排 ${fmtInt(s.seatRows)}` : '';
  console.info(
    `[老特拉福德] 座席=${fmtInt(seatTotal)} 三角面=${fmtInt(s.triangles)} 看台=${s.standCount} 层段=${s.tierCount}${rows} 构建=${Math.round(s.buildMs)}ms`,
  );
}

/* ===========================================================================
 * 12. 档案抽屉
 * ========================================================================= */

function setArchiveTab(tab) {
  const tabs = document.querySelectorAll('.archive-tab');
  tabs.forEach((button) => {
    const active = button.dataset.tab === tab;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-selected', String(active));
  });
  document.querySelectorAll('.archive-tabpanel').forEach((panel) => {
    panel.hidden = panel.id !== `panel-${tab}`;
  });
  state.archiveTab = tab;
  el.archiveBody.scrollTop = 0;
}

function openArchive(tab = 'stats') {
  state.archiveOpen = true;
  setArchiveTab(tab);
  el.archive.classList.add('is-open');
  el.archive.setAttribute('aria-hidden', 'false');
  el.archiveButton?.setAttribute('aria-expanded', 'true');
  controls.autoRotate = false;
  setHover(null);
  el.archiveClose.focus({ preventScroll: true });
}

function closeArchive() {
  state.archiveOpen = false;
  el.archive.classList.remove('is-open');
  el.archive.setAttribute('aria-hidden', 'true');
  el.archiveButton?.setAttribute('aria-expanded', 'false');
  controls.autoRotate = state.autoRotate;
  el.archiveButton?.focus({ preventScroll: true });
}

function toggleArchive(tab) {
  if (state.archiveOpen && (!tab || tab === state.archiveTab)) closeArchive();
  else openArchive(tab || state.archiveTab || 'stats');
}

/* --- 曼联球员 · 球员卡抽屉 ----------------------------------------------- */

/* 自定义球员卡：localStorage 持久化（本机浏览器），数据结构与 PLAYER_CARDS.players
 * 条目 + PLAYERS.members 条目的并集一致，因此 cardDataFor / fullCardHTML / 换人体系
 * 无需特判即可使用。添加后并入替补池，随「换上」进入所有出现球员卡的板块。 */
const CUSTOM_PLAYERS_KEY = 'oldtrafford.customPlayers.v1';

function loadCustomPlayers() {
  try {
    const raw = JSON.parse(localStorage.getItem(CUSTOM_PLAYERS_KEY) || '[]');
    return Array.isArray(raw) ? raw.filter((p) => p && p.slug && p.name) : [];
  } catch {
    return [];
  }
}

let customPlayers = loadCustomPlayers();

function saveCustomPlayers() {
  try {
    localStorage.setItem(CUSTOM_PLAYERS_KEY, JSON.stringify(customPlayers));
  } catch {
    showToast('保存失败：浏览器存储空间不足（照片可能过大）', 4200);
  }
}

/** 位置表：表单下拉与 posZh 推导共用（id 与现有 PLAYERS.pos 口径一致） */
const CUSTOM_POS = [
  ['GK', '门将'], ['CB', '中后卫'], ['LB', '左后卫'], ['RB', '右后卫'],
  ['CDM', '后腰'], ['CM', '中场'], ['CAM', '前腰'],
  ['RW', '右边锋'], ['LW', '左边锋'], ['CF', '前锋'], ['ST', '中锋'],
];

/** 解析「年份|说明」多行文本为 achievements 数组；非法行忽略 */
function parseAchievementLines(text) {
  return String(text || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const sep = line.indexOf('|');
      return sep > 0
        ? [line.slice(0, sep).trim(), line.slice(sep + 1).trim()]
        : ['', line];
    });
}

/** 读入照片文件并压缩成 JPEG dataURL（最长边 512 px），localStorage 才放得下 */
function readPhotoFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, 512 / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('照片读取失败'));
    };
    img.src = url;
  });
}

function addCustomPlayer(data) {
  const pos = CUSTOM_POS.some(([id]) => id === data.pos) ? data.pos : 'CM';
  // 卡面字段与场上身份字段合并成一条记录：既是替补池成员也是 PLAYER_CARDS 条目，
  // benchPool 与 customPlayers 持有同一对象，删除时的 indexOf 才能命中
  const player = {
    slug: `custom-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`,
    num: data.num || null,
    name: data.name,
    nameZh: data.nameZh || data.name,
    pos,
    posZh: CUSTOM_POS.find(([id]) => id === pos)[1],
    nation: data.nation || '—',
    photo: data.photo || '',
    custom: true,
    nat: data.nation || '—',
    natZh: data.natZh || '',
    nameEn: data.name.toUpperCase(),
    born: data.born || '',
    statLabel: data.statLabel || '自定义数据',
    stats: data.stats?.length ? data.stats : [['出场', '—'], ['进球', '—'], ['助攻', '—']],
    statNote: '自定义球员卡，数据由访客自行填写',
    achievements: data.achievements ?? [],
    honours: data.honours ?? [],
  };
  customPlayers.push(player);
  saveCustomPlayers();
  benchPool.push(player);
  savePrefs();   // 自定义卡入库即入档（槽位引用按 slug 关联）
  populatePlayers();
  showToast(`已添加自定义球员 ${player.nameZh} · 现在替补席，可用「换上」登场`, 3600);
  return player;
}

function removeCustomPlayer(slug) {
  const index = customPlayers.findIndex((p) => p.slug === slug);
  if (index < 0) return false;
  const player = customPlayers[index];
  customPlayers.splice(index, 1);
  saveCustomPlayers();

  // 若正在场上：先换回原首发十一人（slotName 即原球员的 name）
  const slotIndex = lineupSlots.findIndex((slot) => slot.player?.slug === slug);
  if (slotIndex >= 0) {
    const slot = lineupSlots[slotIndex];
    const original = PLAYERS.groups[0]?.members.find((p) => p.name === slot.slotName)
      ?? { name: slot.slotName, nameZh: slot.slotName, pos: '—', posZh: '—' };
    slot.player = original;
    const part = stadium?.lineupParts?.find((p) => p.name === slot.slotName);
    if (part) {
      part.player = original;
      part.group.traverse((obj) => {
        if (obj.userData?.lineupPlayer !== undefined) obj.userData.lineupPlayer = original.name;
      });
    }
  }
  const benchIndex = benchPool.indexOf(player);
  if (benchIndex >= 0) benchPool.splice(benchIndex, 1);

  // 焦点卡正好停在被删球员身上时先退出锁定
  const focused = stadium?.lineupParts?.find((p) => p.name === state.lineupFocus);
  if (focused?.player?.slug === slug) unfocusLineup(true);

  populatePlayers();
  buildLineupRoster();
  savePrefs();
  showToast(`已删除自定义球员 ${player.nameZh}`);
  return true;
}

/* 换人：首发 11 个「槽位」（站位坐标不变，人员可换）+ 替补池（轮换名单）。
 * 槽位与替补池是运行时状态，不写回 js/data.js（数据契约保持静态）。
 * 替补池尾部并入自定义球员（localStorage），随「换上」进入所有卡面板块。 */
const lineupSlots = LINEUP.members.map((member) => ({
  slotName: member.name,
  player: PLAYERS.groups[0]?.members.find((p) => p.name === member.name)
    ?? { name: member.name, nameZh: member.name, pos: '—', posZh: '—' },
}));
let benchPool = [...(PLAYERS.groups[1]?.members ?? []), ...customPlayers];

/* --- 阵容切换：现役 2026-27 ⇄ 队史最佳 XI（4-4-2 · 弗格森）----------------
 * 物理人形锚点（slotName）不变，按槽位序号把 slot.player 换成对应阵容的球员，
 * 再补间走位到新落点；替补池整体替换（现役池尾部含自定义球员）。教练人形
 * 位置不动，只换卡面对象（卡里克 ⇄ 弗格森）。 */

/** 教练人形的卡面对象：现役 = 卡里克，队史 = 弗格森（位置均为南看台前沿教练区） */
function coachPlayerForSquad(mode) {
  if (mode === 'alltime') return { ...ALL_TIME.coach, photo: '' };
  return {
    slug: COACH.slug, coach: true, num: null,
    name: COACH.name, nameZh: COACH.nameZh,
    pos: COACH.pos, posZh: COACH.posZh, nation: COACH.nation, photo: '',
  };
}

function benchForSquad(mode) {
  return mode === 'alltime'
    ? [...ALL_TIME.bench]
    : [...(PLAYERS.groups[1]?.members ?? []), ...customPlayers];
}

/** 静默切换槽位/替补池/教练/阵型复位（无镜头、无提示）——交互切换与开机恢复共用 */
function setSquadState(mode) {
  const isAll = mode === 'alltime';
  state.squad = mode;
  lineupSlots.forEach((slot, index) => {
    slot.player = isAll
      ? ALL_TIME.members[index]
      : PLAYERS.groups[0]?.members.find((p) => p.name === slot.slotName)
        ?? { name: slot.slotName, nameZh: slot.slotName, pos: '—', posZh: '—' };
  });
  benchPool = benchForSquad(mode);

  // 同步场上人形（userData.lineupPlayer 供拾取与卡面定位）与教练卡面
  if (stadium?.lineupParts) {
    lineupSlots.forEach((slot) => {
      const part = stadium.lineupParts.find((p) => p.name === slot.slotName);
      if (!part) return;
      part.player = slot.player;
      part.group.traverse((obj) => {
        if (obj.userData?.lineupPlayer !== undefined) obj.userData.lineupPlayer = slot.player.name;
      });
    });
    const coachPart = stadium.lineupParts.find((p) => p.player?.coach);
    if (coachPart) {
      coachPart.player = coachPlayerForSquad(mode);
      coachPart.group.traverse((obj) => {
        if (obj.userData?.lineupPlayer !== undefined) obj.userData.lineupPlayer = coachPart.player.name;
      });
    }
  }

  // 阵型：队史固定 4-4-2；回现役恢复默认
  if (isAll) state.formation = '4-4-2';
  else state.formation = FORMATIONS.default;
  buildSquadToggle();
  buildFormationPicker();
  return isAll;
}

function applySquad(mode) {
  if ((mode !== 'current' && mode !== 'alltime') || mode === state.squad) return;

  // 互斥：卡面锁定与换人模式先退出
  if (state.lineupFocus) unfocusLineup(true);
  if (pendingSub) endPendingSub();

  const isAll = setSquadState(mode);
  startLineupTween(
    isAll ? ALL_TIME.members.map((m) => m.at) : LINEUP.members.map((m) => m.at),
    isAll ? '队史最佳 XI · 4-4-2 · 弗格森' : '现役阵容 2026-27',
  );

  populatePlayers();
  buildLineupRoster();
  savePrefs();
  showToast(isAll ? '已切换至队史最佳阵容（含替补席 10 人）' : '已切换回现役阵容', 3000);
}

/** 段控高亮 + 阵型选择只在现役模式开放 */
function buildSquadToggle() {
  if (!el.squadToggle) return;
  el.squadToggle.querySelectorAll('[data-squad]').forEach((button) => {
    button.classList.toggle('is-active', button.dataset.squad === state.squad);
  });
  el.formationPicker?.classList.toggle('is-disabled', state.squad !== 'current');
}

/* ===========================================================================
 * 阵容与氛围设置的本地持久化（localStorage，与自定义球员卡同一存储策略）
 * --------------------------------------------------------------------------
 * 快照结构 oldtrafford.prefs.v1：
 *   { version, squad, formation,
 *     swaps: [{ slot: 槽位名(slotName), ref: 'slug:xxx' | 球员名 }],   // 仅记与默认不同的槽位
 *     prefs: { hour, seatMode, context, floodlights, autoRotate } }
 * 恢复优先级：URL 查询参数 > 本地快照 > 代码默认值。
 * ========================================================================= */
const PREFS_KEY = 'oldtrafford.prefs.v1';

function readPrefs() {
  try {
    const raw = JSON.parse(localStorage.getItem(PREFS_KEY) || 'null');
    return raw && typeof raw === 'object' ? raw : null;
  } catch {
    return null;
  }
}

/** 槽位默认球员：现役 = 同名首发；队史 = 同序号 ALL_TIME 首发 */
function defaultPlayerForSlot(slot, index) {
  return state.squad === 'alltime'
    ? ALL_TIME.members[index]
    : PLAYERS.groups[0]?.members.find((p) => p.name === slot.slotName)
      ?? { name: slot.slotName };
}

function snapshotPrefs() {
  const swaps = [];
  lineupSlots.forEach((slot, index) => {
    const def = defaultPlayerForSlot(slot, index);
    if (slot.player?.name !== def?.name) {
      swaps.push({
        slot: slot.slotName,
        ref: slot.player?.custom ? `slug:${slot.player.slug}` : slot.player?.name,
      });
    }
  });
  return {
    version: 1,
    squad: state.squad,
    formation: state.formation,
    swaps,
    prefs: {
      hour: state.hour,
      seatMode: state.seatMode,
      context: state.context,
      floodlights: state.floodlights,
      autoRotate: state.autoRotate,
    },
  };
}

let prefsSaveTimer = null;
function savePrefs() {
  clearTimeout(prefsSaveTimer);
  prefsSaveTimer = setTimeout(() => {
    prefsSaveTimer = null;
    flushPrefs();
  }, 300);
}

/** 立即写盘（beforeunload 兜底 / 导出复用）：存储满或隐私模式静默失败 */
function flushPrefs() {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(snapshotPrefs()));
  } catch { /* 静默 */ }
}

/* --- 本机数据导出 / 导入（档案抽屉）：自定义球员卡 + 阵容与氛围设置 ---------- */

const EXPORT_APP_ID = 'old-trafford-exhibition';
const EXPORT_VERSION = 1;

/** 导出：当前快照 + 自定义球员卡 → JSON 文件下载 */
function exportLocalData() {
  flushPrefs();
  const payload = {
    app: EXPORT_APP_ID,
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    customPlayers,
    prefs: readPrefs(),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const link = document.createElement('a');
  link.href = url;
  link.download = `old-trafford-data-${stamp}.json`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
  showToast(`已导出 ${customPlayers.length} 张自定义卡与当前设置`, 3200);
}

/** 导入：校验 → 写回两个 localStorage 键 → 刷新生效；坏文件不动存量 */
function importLocalData(file) {
  const fail = (msg) => showToast(`导入失败：${msg}`, 3600);
  if (!file) return;
  file.text().then((text) => {
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      fail('不是有效的 JSON 文件');
      return;
    }
    if (data?.app !== EXPORT_APP_ID || data.version !== EXPORT_VERSION) {
      fail('文件格式不匹配（需本页导出的备份）');
      return;
    }
    if (!Array.isArray(data.customPlayers) || !data.prefs) {
      fail('备份内容不完整');
      return;
    }
    try {
      localStorage.setItem(CUSTOM_PLAYERS_KEY, JSON.stringify(data.customPlayers));
      localStorage.setItem(PREFS_KEY, JSON.stringify(data.prefs));
    } catch {
      fail('浏览器存储写入失败');
      return;
    }
    showToast('导入成功，正在刷新…', 2000);
    window.setTimeout(() => window.location.reload(), 600);
  }).catch(() => fail('文件读取失败'));
}

/** 把氛围设置合入 state（boot 初始 setter 之前调用；URL 参数优先） */
function applyStoredPrefsToState() {
  const snap = readPrefs();
  if (!snap?.prefs) return;
  const p = snap.prefs;
  if (!params.has('time') && Number.isFinite(p.hour)) state.hour = clamp(p.hour, 0, 24);
  if (!params.has('seat') && SEAT_MODES.some((m) => m.id === p.seatMode)) state.seatMode = p.seatMode;
  if (!params.has('context') && typeof p.context === 'boolean') state.context = p.context;
  if (!params.has('lights') && typeof p.floodlights === 'boolean') state.floodlights = p.floodlights;
  if (!params.has('rotate') && typeof p.autoRotate === 'boolean') state.autoRotate = p.autoRotate;
}

/** 人形直接落位（不走补间）——开机恢复阵型用，坐标换算与 tickFormationTween 一致 */
function placeFiguresAt(slots) {
  if (!stadium?.lineupParts || !stadium.lineupFrame) return;
  const f = stadium.lineupFrame;
  lineupSlots.forEach((slot, index) => {
    const part = stadium.lineupParts.find((p) => p.name === slot.slotName);
    if (!part || !Array.isArray(slots[index])) return;
    part.group.position.set(slots[index][0], 0, slots[index][1]);
    const lx = part.group.position.x;
    const lz = part.group.position.z;
    part.worldAt.set(
      f.position.x + lx * f.cos + lz * f.sin,
      part.group.position.y,
      f.position.z - lx * f.sin + lz * f.cos,
    );
    part.anchor.copy(part.worldAt);
  });
}

/** 开机恢复阵容：模式 → 换人回放 → 阵型落位（boot 里 populatePlayers 之后调用） */
function restoreLineupPrefs() {
  const snap = readPrefs();
  if (!snap || (snap.squad !== 'alltime' && snap.squad !== 'current')) return;
  const changed = snap.squad !== state.squad;
  if (changed) setSquadState(snap.squad);
  else buildSquadToggle();

  // 回放换人：自定义球员按 slug 找回，官方/传奇按名字在对应替补池里找
  (Array.isArray(snap.swaps) ? snap.swaps : []).forEach(({ slot: slotName, ref } = {}) => {
    if (!slotName || !ref) return;
    const index = lineupSlots.findIndex((s) => s.slotName === slotName);
    if (index < 0) return;
    const incoming = typeof ref === 'string' && ref.startsWith('slug:')
      ? customPlayers.find((p) => p.slug === ref.slice(5))
      : benchForSquad(state.squad).find((p) => p.name === ref);
    if (!incoming || !benchPool.includes(incoming)) return;   // 卡已删/不在池：回落默认
    const slot = lineupSlots[index];
    const outgoing = slot.player;
    slot.player = incoming;
    benchPool.splice(benchPool.indexOf(incoming), 1, outgoing);
    const part = stadium?.lineupParts?.find((p) => p.name === slotName);
    if (part) {
      part.player = incoming;
      part.group.traverse((obj) => {
        if (obj.userData?.lineupPlayer !== undefined) obj.userData.lineupPlayer = incoming.name;
      });
    }
  });

  // 阵型落位：现役按存档阵型，队史固定 4-4-2（ALL_TIME 落点）
  if (state.squad === 'alltime') {
    if (changed) placeFiguresAt(ALL_TIME.members.map((m) => m.at));
  } else if (typeof snap.formation === 'string' && FORMATIONS.list.some((f) => f.id === snap.formation)) {
    const formation = FORMATIONS.list.find((f) => f.id === snap.formation);
    if (formation.id !== FORMATIONS.default) {
      state.formation = formation.id;
      buildFormationPicker();
      placeFiguresAt(formation.slots);
    }
  }

  populatePlayers();
  buildLineupRoster();
}

let pendingSub = null;   // 待换上的替补球员（换人模式）

/** 把替补换到槽位上，被换下的回到替补池；同步更新场上人形、名单与抽屉 */
function substitutePlayer(slotIndex, incoming) {
  const slot = lineupSlots[slotIndex];
  if (!slot || !incoming || !benchPool.includes(incoming)) return false;
  const outgoing = slot.player;
  slot.player = incoming;
  benchPool.splice(benchPool.indexOf(incoming), 1, outgoing);
  const part = stadium?.lineupParts?.find((p) => p.name === slot.slotName);
  if (part) {
    part.player = slot.player;
    part.group.traverse((obj) => {
      if (obj.userData?.lineupPlayer !== undefined) obj.userData.lineupPlayer = slot.player.name;
    });
  }
  populatePlayers();
  buildLineupRoster();
  showToast(`换人 · ${outgoing.nameZh} ⇄ ${incoming.nameZh}`);
  savePrefs();
  return true;
}

function beginSubstitution(player) {
  pendingSub = player;
  document.body.classList.add('is-subbing');
  if (state.playersOpen) closePlayers();
  // 互斥：卡面锁定与换人俯视抢视角，先收起卡面
  if (state.lineupFocus) unfocusLineup(true);
  // 换人时先升到高空俯视、人形平躺方便挑选，点完再回落（见 pointerup / 名单的换人分支）
  figureLieTarget = -Math.PI / 2;
  if (state.view === 'lineup') flyTo('lineup', 0.9, { pose: LINEUP_TOPDOWN_POSE() });
  showToast(`换上 ${player.nameZh}：点击场上任意球员（或阵容名单）完成对调，Esc 取消`, 3600);
}

function endPendingSub() {
  pendingSub = null;
  figureLieTarget = 0;   // 人形立正
  document.body.classList.remove('is-subbing');
}

/* --- 阵型切换：人形补间走位，相机先升到高空俯视、到位后回落总览 ------- */

/** 高空俯视机位：正对实测球场中心，机身对齐长轴（白线在画面里横平竖直） */
const LINEUP_TOPDOWN_POSE = () => {
  const frame = stadium?.pitchFrame;
  if (!frame) {
    return { position: new THREE.Vector3(0, 118, 0.1), target: new THREE.Vector3(0, 0, 0), fov: 50 };
  }
  // 沿进攻长轴往回偏 0.6 m，让俯视的"上方向"指向进攻方向（抵消直视退化的翻滚）
  const ax = Math.cos(frame.angle);
  const az = -Math.sin(frame.angle);
  return {
    position: new THREE.Vector3(frame.center.x - ax * 0.6, 118, frame.center.z - az * 0.6),
    target: new THREE.Vector3(frame.center.x, 0, frame.center.z),
    fov: 50,
  };
};

let formationTween = null;

/** 人形平躺角：俯视走位/换人时 -π/2（头朝进攻方向平躺），其余 0（立正） */
let figureLieTarget = 0;
let figureLieAngle = 0;   // 当前躺角（每帧向 figureLieTarget 平滑）

/** 把 11 个槽位对应的人形补间到 targets（草坪局部坐标数组）：阵型切换与阵容切换共用 */
function startLineupTween(targets, toastText) {
  if (!stadium) return;
  const movers = [];
  lineupSlots.forEach((slot, index) => {
    const part = stadium?.lineupParts?.find((p) => p.name === slot.slotName);
    if (!part || !Array.isArray(targets[index])) return;
    movers.push({
      part,
      from: part.group.position.clone(),
      to: new THREE.Vector3(targets[index][0], 0, targets[index][1]),
      offset: stadium.parts.lineup.position,
    });
  });
  if (!movers.length) return;

  formationTween = { startedAt: performance.now(), duration: REDUCED_MOTION ? 500 : 1700, movers };
  lineupRearmAt = performance.now() + 2800;   // 走位期间不做靠近判定
  figureLieTarget = -Math.PI / 2;             // 俯视走位期间人形平躺（头朝进攻方向）
  if (state.view === 'lineup') {
    flyTo('lineup', 1.1, { pose: LINEUP_TOPDOWN_POSE() });
    if (toastText) showToast(toastText, 3000);
  }
}

function switchFormation(id) {
  const formation = FORMATIONS.list.find((f) => f.id === id);
  if (!formation || id === state.formation) return;
  if (state.squad !== 'current') return;      // 队史阵容固定 4-4-2 落点，不响应阵型切换
  state.formation = id;
  buildFormationPicker();

  // 互斥：卡面锁定与阵型切换抢视角，切换前先收起卡面
  if (state.lineupFocus) unfocusLineup(true);

  startLineupTween(formation.slots, `阵型 ${formation.label} · ${formation.title}`);
  savePrefs();
}

/** 每帧推进人形走位补间；到位后自动回落到阵容总览机位 */
function tickFormationTween() {
  if (!formationTween) return;
  const raw = clamp((performance.now() - formationTween.startedAt) / formationTween.duration, 0, 1);
  const e = easeInOutCubic(raw);
  for (const mover of formationTween.movers) {
    mover.part.group.position.lerpVectors(mover.from, mover.to, e);
    // 局部草坪坐标 → 世界坐标（含实测框架的平移与长轴旋转）
    const f = stadium.lineupFrame;
    const lx = mover.part.group.position.x;
    const lz = mover.part.group.position.z;
    mover.part.worldAt.set(
      f.position.x + lx * f.cos + lz * f.sin,
      mover.part.group.position.y,
      f.position.z - lx * f.sin + lz * f.cos,
    );
    mover.part.anchor.copy(mover.part.worldAt);
  }
  if (raw >= 1) {
    formationTween = null;
    figureLieTarget = 0;   // 走位完成，人形立正
    if (state.view === 'lineup' && !pendingSub) flyTo('lineup', 1.1);   // 回总览（仍锁定）
  }
}

/** 单张卡的包裹层：卡面 + 场上/换上标记 +（自定义卡的）编辑/删除按钮组。
 *  catalog = true 时为图鉴纯浏览（无换上按钮，避免跨池换人卡死在换人模式） */
function playerCardWrap(player, { onPitch = false, legend = false, catalog = false } = {}) {
  const card = cardDataFor(player);
  const cardHTML = card ? fullCardHTML(card, player) : blankCardHTML(player);
  const action = onPitch
    ? '<span class="fcard-tag">场上</span>'
    : catalog ? ''
      : `<button class="fcard-sub" type="button" data-sub="${player.name}">换上</button>`;
  const customActions = player.custom
    ? `<div class="fcard-custom-actions">
        <button class="fcard-edit" type="button" data-custom-edit="${player.slug}" title="修改这张自定义球员卡">编辑</button>
        <button class="fcard-del" type="button" data-custom-del="${player.slug}" title="删除这张自定义球员卡">删除</button>
      </div>`
    : '';
  const wrapClass = player.custom ? ' fcard-wrap--custom' : (legend ? ' fcard-wrap--legend' : '');
  return `<div class="fcard-wrap${wrapClass}">${cardHTML}${action}${customActions}</div>`;
}

function populatePlayers() {
  if (!el.playersBody) return;
  const alltime = state.squad === 'alltime';
  el.playersNote.textContent = alltime ? ALL_TIME.note : PLAYERS.note;
  const groups = alltime
    ? [
        { title: '队史首发', titleEn: 'ALL-TIME XI', members: lineupSlots.map((slot) => ({ ...slot.player, onPitch: true })) },
        { title: '传奇替补', titleEn: 'LEGENDS', members: benchPool },
      ]
    : [
        { title: '场上十一人', titleEn: 'ON PITCH XI', members: lineupSlots.map((slot) => ({ ...slot.player, onPitch: true })) },
        { title: '替补席', titleEn: 'BENCH', members: benchPool },
      ];

  /* 传奇图鉴：队史首发 + 传奇替补 + 弗格森，始终展示在现役之后；
   * 已出现在上方分区（场上/替补池）的传奇不再重复 */
  const liveNames = new Set([
    ...lineupSlots.map((slot) => slot.player?.name),
    ...benchPool.map((p) => p.name),
  ]);
  const legends = [...ALL_TIME.members, ...ALL_TIME.bench, ALL_TIME.coach]
    .filter((p) => !liveNames.has(p.name));

  el.playersBody.innerHTML = groups.map((group) => `
    <div class="players-section">
      <h3>${group.title} <span>/ ${group.titleEn}</span></h3>
      <div class="players-grid">${group.members.map((p) => playerCardWrap(p, { onPitch: p.onPitch })).join('')}</div>
    </div>
  `).join('') + `
    <div class="players-section players-section--legends">
      <h3>传奇球星 <span>/ LEGENDS · 队史最佳阵容图鉴</span></h3>
      <div class="players-grid">${legends.map((p) => playerCardWrap(p, { legend: true, catalog: true })).join('')}</div>
    </div>
  `;
}

function openPlayers() {
  state.playersOpen = true;
  el.players.classList.add('is-open');
  el.players.setAttribute('aria-hidden', 'false');
  el.playersButton?.setAttribute('aria-expanded', 'true');
  controls.autoRotate = false;
  setHover(null);
  el.playersClose.focus({ preventScroll: true });
}

function closePlayers() {
  state.playersOpen = false;
  if (state.customFormOpen) toggleCustomForm(false);   // 关抽屉顺带收起表单
  el.players.classList.remove('is-open');
  el.players.setAttribute('aria-hidden', 'true');
  el.playersButton?.setAttribute('aria-expanded', 'false');
  controls.autoRotate = state.autoRotate;
  el.playersButton?.focus({ preventScroll: true });
}

function togglePlayers() {
  if (state.playersOpen) closePlayers();
  else openPlayers();
}

/* --- 自定义球员表单：抽屉头部入口 → 表单 → 保存进替补池 ------------------- */

/** 填充位置下拉（模块加载后调用一次） */
function buildCustomFormOptions() {
  if (!el.customPos) return;
  el.customPos.innerHTML = CUSTOM_POS
    .map(([id, zh]) => `<option value="${id}">${id} · ${zh}</option>`)
    .join('');
  el.customPos.value = 'CM';
}

function toggleCustomForm(force) {
  const open = typeof force === 'boolean' ? force : !state.customFormOpen;
  if (open === state.customFormOpen && el.customForm.hidden === !open) return;   // 状态一致则跳过
  state.customFormOpen = open;
  el.customForm.hidden = !open;
  el.playersAdd?.setAttribute('aria-expanded', String(open));
  if (open) {
    el.customName?.focus({ preventScroll: true });
    el.customForm.scrollIntoView({ block: 'nearest', behavior: REDUCED_MOTION ? 'auto' : 'smooth' });
  } else {
    resetCustomForm();   // 关闭即回到「添加」模式，避免残留编辑态
  }
}

function resetCustomForm() {
  el.customForm?.reset();
  if (el.customPos) el.customPos.value = 'CM';
  if (el.customPhotoPreview) el.customPhotoPreview.hidden = true;
  pendingCustomPhoto = null;
  editingCustomSlug = null;
  setCustomFormMode(false);
}

let pendingCustomPhoto = null;   // 表单里已压缩、待随提交一起保存的照片 dataURL
let editingCustomSlug = null;    // 正在编辑的自定义球员 slug（null = 添加模式）

/** 表单文案随添加/编辑模式切换 */
function setCustomFormMode(isEdit) {
  const title = el.customForm?.querySelector('h3');
  const submit = el.customForm?.querySelector('.custom-form-save');
  if (title) title.textContent = isEdit ? '编辑自定义球员卡' : '添加自定义球员卡';
  if (submit) submit.textContent = isEdit ? '保存修改' : '保存并加入替补席';
}

/** 打开表单：传 player = 编辑模式（预填），不传 = 添加模式（清空） */
function openCustomFormFor(player) {
  resetCustomForm();
  if (player) {
    editingCustomSlug = player.slug;
    el.customName.value = player.name ?? '';
    el.customNameZh.value = player.nameZh && player.nameZh !== player.name ? player.nameZh : '';
    el.customNum.value = player.num ?? '';
    if (el.customPos) el.customPos.value = CUSTOM_POS.some(([id]) => id === player.pos) ? player.pos : 'CM';
    el.customNation.value = player.nation && player.nation !== '—' ? player.nation : '';
    el.customBorn.value = player.born ?? '';
    el.customStatLabel.value = player.statLabel ?? '';
    player.stats?.forEach(([k, v], i) => {
      if (el.customStatKey[i]) el.customStatKey[i].value = k ?? '';
      if (el.customStatVal[i]) el.customStatVal[i].value = v ?? '';
    });
    el.customAchievements.value = (player.achievements ?? [])
      .map(([y, t]) => (y ? `${y}|${t}` : t)).join('\n');
    el.customHonours.value = (player.honours ?? [])
      .map((h) => (Array.isArray(h) ? h[1] : h)).join('\n');
    pendingCustomPhoto = player.photo || '';
    if (el.customPhotoPreview && pendingCustomPhoto) {
      el.customPhotoPreview.querySelector('img').src = pendingCustomPhoto;
      el.customPhotoPreview.hidden = false;
    }
    setCustomFormMode(true);
  }
  toggleCustomForm(true);
}

/** 表单提交：编辑模式 → 就地更新；添加模式 → addCustomPlayer（并入替补池并刷新抽屉） */
function submitCustomForm(event) {
  event.preventDefault();
  const name = el.customName?.value.trim();
  if (!name) {
    el.customName?.focus();
    return;
  }
  const data = {
    name,
    nameZh: el.customNameZh?.value.trim() || '',
    num: el.customNum?.value ? Number(el.customNum.value) : null,
    pos: el.customPos?.value || 'CM',
    nation: el.customNation?.value.trim().toUpperCase() || '',
    born: el.customBorn?.value.trim() || '',
    photo: pendingCustomPhoto || '',
    statLabel: el.customStatLabel?.value.trim() || '',
    stats: [0, 1, 2]
      .map((i) => [el.customStatKey[i]?.value.trim(), el.customStatVal[i]?.value.trim()])
      .filter(([k, v]) => k || (v && v !== '—'))
      .map(([k, v]) => [k || '—', v || '—']),
    achievements: parseAchievementLines(el.customAchievements?.value),
    honours: parseAchievementLines(el.customHonours?.value),
  };
  if (editingCustomSlug) updateCustomPlayer(editingCustomSlug, data);
  else addCustomPlayer(data);
  resetCustomForm();
  toggleCustomForm(false);
  if (!editingCustomSlug) {
    // 让用户立刻看到替补席里的新卡
    el.playersBody?.scrollTo({ top: el.playersBody.scrollHeight, behavior: REDUCED_MOTION ? 'auto' : 'smooth' });
  }
}

/** 编辑模式：就地更新同一条记录（对象引用被替补池/槽位共用，改字段即全局生效） */
function updateCustomPlayer(slug, data) {
  const entry = customPlayers.find((p) => p.slug === slug);
  if (!entry) return false;
  const pos = CUSTOM_POS.some(([id]) => id === data.pos) ? data.pos : 'CM';
  Object.assign(entry, {
    num: data.num || null,
    name: data.name,
    nameZh: data.nameZh || data.name,
    pos,
    posZh: CUSTOM_POS.find(([id]) => id === pos)[1],
    nation: data.nation || '—',
    nat: data.nation || '—',
    nameEn: data.name.toUpperCase(),
    born: data.born || '',
    statLabel: data.statLabel || '自定义数据',
    stats: data.stats?.length ? data.stats : [['出场', '—'], ['进球', '—'], ['助攻', '—']],
    achievements: data.achievements ?? [],
    honours: data.honours ?? [],
    photo: data.photo ?? '',
  });
  saveCustomPlayers();

  // 名字可能改了：同步场上人形的拾取标记
  if (stadium?.lineupParts) {
    lineupSlots.forEach((slot) => {
      if (slot.player !== entry) return;
      const part = stadium.lineupParts.find((p) => p.name === slot.slotName);
      part?.group.traverse((obj) => {
        if (obj.userData?.lineupPlayer !== undefined) obj.userData.lineupPlayer = entry.name;
      });
    });
  }
  populatePlayers();
  buildLineupRoster();
  // 若 3D 特写正停在该球员上，就地刷新卡面
  const part = stadium?.lineupParts?.find((p) => p.name === state.lineupFocus);
  if (part?.player === entry) fillLineupCard(entry);
  savePrefs();
  showToast(`已更新自定义球员 ${entry.nameZh}`);
  return true;
}

/** 绑定表单事件（抽屉元素常驻 DOM，幂等） */
function bindCustomForm() {
  if (!el.customForm || el.customForm.dataset.bound) return;
  el.customForm.dataset.bound = '1';
  buildCustomFormOptions();
  el.playersAdd?.addEventListener('click', () => {
    if (state.customFormOpen) toggleCustomForm(false);
    else openCustomFormFor(null);
  });
  el.customFormCancel?.addEventListener('click', () => toggleCustomForm(false));
  el.customForm.addEventListener('submit', submitCustomForm);
  el.customPhoto?.addEventListener('change', async () => {
    const file = el.customPhoto.files?.[0];
    if (!file) return;
    try {
      pendingCustomPhoto = await readPhotoFile(file);
      if (el.customPhotoPreview) {
        el.customPhotoPreview.querySelector('img').src = pendingCustomPhoto;
        el.customPhotoPreview.hidden = false;
      }
    } catch {
      pendingCustomPhoto = null;
      if (el.customPhotoPreview) el.customPhotoPreview.hidden = true;
      showToast('照片读取失败，请换一张图片');
    }
  });
}

/* ===========================================================================
 * 13. 事件绑定
 * ========================================================================= */

function dismissMouseHint() {
  if (state.hintDismissed) return;
  state.hintDismissed = true;
  el.mouseHint?.classList.add('is-hidden');
}

function bindViewPanel() {
  // 视点按钮分布在三个面板里（视点导航 / 观众视角 / 阵容站位），统一委托
  [el.viewGroups, el.eyeGroups, el.lineupGroups].forEach((container) => {
    container?.addEventListener('click', (event) => {
      const button = event.target.closest('.view-button');
      if (!button) return;
      flyTo(button.dataset.view, 1.5);
      if (IS_NARROW()) closePanels();
    });
  });

  // 阵型选择：人形补间走位，相机先升俯视再回落
  el.formationPicker?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-formation]');
    if (!button) return;
    switchFormation(button.dataset.formation);
  });

  // 阵容切换：现役 2026-27 ⇄ 队史最佳 XI（槽位/替补池/教练/走位整体切换）
  el.squadToggle?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-squad]');
    if (!button) return;
    applySquad(button.dataset.squad);
  });

  // 人形显隐开关：开启后任意机位都能看到阵容人形
  el.figuresToggle?.addEventListener('click', () => {
    state.lineupFiguresManual = !state.lineupFiguresManual;
    el.figuresToggle.classList.toggle('is-active', state.lineupFiguresManual);
    el.figuresToggle.setAttribute('aria-pressed', String(state.lineupFiguresManual));
    stadium?.setLineupVisible(state.lineupFiguresManual || state.lineupActive);
    showToast(state.lineupFiguresManual ? '人形常显 · 任意机位可见' : '人形仅阵容机位显示');
  });

  // 阵容名单：换人模式下点击 = 对调；否则点击 = 飞入该球员特写并锁定
  el.lineupRoster?.addEventListener('click', (event) => {
    const row = event.target.closest('.roster-row');
    if (!row) return;
    if (formationTween) return;              // 走位期间不抢视角（互斥）
    const slotIndex = lineupSlots.findIndex((s) => s.slotName === row.dataset.slot);
    if (slotIndex < 0) return;
    if (pendingSub) {
      const incoming = pendingSub;
      endPendingSub();
      if (substitutePlayer(slotIndex, incoming) && state.view === 'lineup') flyTo('lineup', 1.0);
      return;
    }
    const part = stadium?.lineupParts?.find((p) => p.name === lineupSlots[slotIndex].slotName);
    if (!part) return;                       // 几何未就绪时忽略
    focusLineup(part);
    if (IS_NARROW()) closePanels();
  });
}

function bindControlsPanel() {
  el.timeRange.addEventListener('input', () => setHour(Number.parseFloat(el.timeRange.value)));

  el.timePresets.addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (!button) return;
    setHour(Number.parseFloat(button.dataset.hour), true);
  });

  el.dayNightRow?.addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (!button) return;
    setHour(button.dataset.phase === 'night' ? 20.6 : 12.5, true);
  });

  el.seatModeGrid.querySelectorAll('button').forEach((button) => {
    button.addEventListener('click', () => setSeatMode(button.dataset.seatMode));
  });

  el.explodeRange.addEventListener('input', () => setExplode(Number.parseFloat(el.explodeRange.value)));
  el.explodeRange.addEventListener('change', () => setExplode(Number.parseFloat(el.explodeRange.value), true));

  el.roofRange.addEventListener('input', () => setRoofOpacity(Number.parseFloat(el.roofRange.value)));
  el.roofRange.addEventListener('change', () => setRoofOpacity(Number.parseFloat(el.roofRange.value), true));

  document.querySelectorAll('.switch[data-switch]').forEach((button) => {
    button.addEventListener('click', () => {
      const key = button.dataset.switch;
      const next = button.getAttribute('aria-checked') !== 'true';
      if (key === 'section') setSection(next);
      else if (key === 'context') setContextVisible(next);
      else if (key === 'rotate') setAutoRotate(next);
      else if (key === 'floodlights') setFloodlights(next);
    });
  });
}

function bindPanelCollapse() {
  const applyCollapsed = (panel, button, collapsed) => {
    if (!panel || !button) return;
    panel.classList.toggle('is-collapsed', collapsed);
    button.setAttribute('aria-expanded', String(collapsed));
    button.setAttribute('aria-label', collapsed ? '展开面板' : '收起面板');
  };

  const setCollapsed = (panel, button, key, collapsed) => {
    state[key] = collapsed;
    applyCollapsed(panel, button, collapsed);
  };

  // 同侧互斥：展开一块面板时自动收起同侧其余面板
  const expandLeft = (which) => {
    setCollapsed(el.viewPanel, el.collapseViews, 'viewsCollapsed', which !== 'views');
    setCollapsed(el.eyePanel, el.collapseEye, 'eyeCollapsed', which !== 'eye');
  };
  const expandRight = (which) => {
    setCollapsed(el.lineupPanel, el.collapseLineup, 'lineupCollapsed', which !== 'lineup');
    setCollapsed(el.atmospherePanel, el.collapseControls, 'controlsCollapsed', which !== 'console');
    if (el.heritagePanel && el.collapseHeritage) {
      setCollapsed(el.heritagePanel, el.collapseHeritage, 'heritageCollapsed', which !== 'console');
    }
  };

  el.collapseViews.addEventListener('click', () => {
    if (state.viewsCollapsed) expandLeft('views');
    else setCollapsed(el.viewPanel, el.collapseViews, 'viewsCollapsed', true);
  });
  el.collapseEye.addEventListener('click', () => {
    if (state.eyeCollapsed) expandLeft('eye');
    else setCollapsed(el.eyePanel, el.collapseEye, 'eyeCollapsed', true);
  });
  el.collapseLineup.addEventListener('click', () => {
    if (state.lineupCollapsed) expandRight('lineup');
    else setCollapsed(el.lineupPanel, el.collapseLineup, 'lineupCollapsed', true);
  });
  el.collapseControls.addEventListener('click', () => {
    if (state.controlsCollapsed) expandRight('console');
    else setCollapsed(el.atmospherePanel, el.collapseControls, 'controlsCollapsed', true);
  });
  el.collapseHeritage?.addEventListener('click', () => {
    if (state.heritageCollapsed) expandRight('console');
    else setCollapsed(el.heritagePanel, el.collapseHeritage, 'heritageCollapsed', true);
  });

  // 初始：左列展开「视点导航」，右列展开「控制台」，其余收起
  expandLeft('views');
  expandRight('console');

  // 控制台两块面板互相切换（04 控制 ⇄ 05 队史）
  el.controlsToHeritage?.addEventListener('click', () => setConsoleTab('heritage', true));
  el.heritageToControls?.addEventListener('click', () => setConsoleTab('atmosphere', true));

  // 窄屏：底部抽屉由顶栏按钮唤出，一次只开一个
  const openPanel = (which) => {
    const viewsOpen = which === 'views' && !state.panelViewsOpen;
    const controlsOpen = which === 'controls' && !state.panelControlsOpen;
    closePanels();
    if (viewsOpen) {
      el.viewPanel.classList.add('is-open');
      state.panelViewsOpen = true;
      el.viewsToggle.setAttribute('aria-expanded', 'true');
    }
    if (controlsOpen) {
      applyConsoleTab();
      const panel = state.consoleTab === 'heritage' ? el.heritagePanel : el.atmospherePanel;
      panel.classList.add('is-open');
      state.panelControlsOpen = true;
      el.controlsToggle.setAttribute('aria-expanded', 'true');
    }
  };
  el.viewsToggle.addEventListener('click', () => openPanel('views'));
  el.controlsToggle.addEventListener('click', () => openPanel('controls'));

  // 点击画面收起抽屉
  el.canvas.addEventListener('pointerdown', () => {
    if (IS_NARROW()) closePanels();
  });
}

function closePanels() {
  el.viewPanel.classList.remove('is-open');
  el.atmospherePanel.classList.remove('is-open');
  el.heritagePanel?.classList.remove('is-open');
  state.panelViewsOpen = false;
  state.panelControlsOpen = false;
  el.viewsToggle?.setAttribute('aria-expanded', 'false');
  el.controlsToggle?.setAttribute('aria-expanded', 'false');
}

function bindPicking() {
  el.canvas.addEventListener('pointermove', (event) => {
    pointerInside = true;
    pointerClient.x = event.clientX;
    pointerClient.y = event.clientY;
    pointerDirty = true;
  });
  el.canvas.addEventListener('pointerleave', () => {
    pointerInside = false;
    pointerDirty = true;
  });
  el.canvas.addEventListener('pointerdown', (event) => {
    pointerDownAt = { x: event.clientX, y: event.clientY };
    // 用户一动镜头就取消补间，避免相机和手抢方向盘
    if (viewTween) {
      viewTween = null;
      controls.enabled = state.view !== 'lineup';   // 阵容机位保持锁定
    }
  });
  el.canvas.addEventListener('pointerup', (event) => {
    const down = pointerDownAt;
    pointerDownAt = null;
    if (!down) return;
    const moved = Math.hypot(event.clientX - down.x, event.clientY - down.y);
    if (moved > 6 || event.button !== 0) return;
    if (state.view === 'lineup') {
      // 换人模式：点击当前锁定的场上人形 = 与替补对调，卡面就地更新
      if (pendingSub && state.lineupFocus) {
        const slotIndex = lineupSlots.findIndex((s) => s.slotName === state.lineupFocus);
        const part = stadium?.lineupParts?.find((p) => p.name === state.lineupFocus);
        const incoming = pendingSub;
        endPendingSub();
        if (slotIndex >= 0 && part && substitutePlayer(slotIndex, incoming)) {
          fillLineupCard(part.player);
          el.lineupCard.classList.remove('is-flipped');
          flyTo('lineup', 1.0);   // 换人完成，从俯视回落总览
        }
        return;
      }
      // 阵容机位：点击画布空白处即回总览；点卡面翻转由卡面自身的 click 处理
      if (state.lineupFocus) unfocusLineup();
      return;
    }
    const key = standKeyAt(event.clientX, event.clientY);
    if (key) pinStand(key === state.pinned ? null : key);
    else if (state.pinned) pinStand(null);
  });
  el.canvas.addEventListener('pointerenter', () => {
    pointerInside = true;
  });
}

function bindStandCard() {
  el.standCardClose.addEventListener('click', () => pinStand(null));
  el.standCardFly.addEventListener('click', () => {
    const view = STAND_VIEW[state.pinned];
    if (view) flyTo(view, 1.6);
    if (IS_NARROW()) el.standCard.classList.remove('is-open');
  });
  el.standCardArchive.addEventListener('click', () => openArchive('stands'));
}

function bindChrome() {
  el.archiveButton.addEventListener('click', () => toggleArchive());
  el.helpButton.addEventListener('click', () => toggleArchive('keys'));
  el.archiveClose.addEventListener('click', closeArchive);
  el.archiveScrim.addEventListener('click', closeArchive);
  el.dockArchive.addEventListener('click', () => toggleArchive());

  // 本机数据导出 / 导入（档案抽屉 · 建造统计页底部）
  el.dataExport?.addEventListener('click', exportLocalData);
  el.dataImport?.addEventListener('click', () => el.dataImportFile?.click());
  el.dataImportFile?.addEventListener('change', () => {
    const file = el.dataImportFile.files?.[0];
    el.dataImportFile.value = '';   // 允许连续导入同名文件
    importLocalData(file);
  });

  el.playersButton?.addEventListener('click', () => togglePlayers());
  el.playersClose.addEventListener('click', closePlayers);
  el.playersScrim.addEventListener('click', closePlayers);
  bindCustomForm();

  // 替补卡的「换上」与自定义卡的「编辑 / 删除」
  el.playersBody?.addEventListener('click', (event) => {
    const target = event.target instanceof HTMLElement ? event.target : null;
    const editBtn = target?.closest('[data-custom-edit]');
    if (editBtn) {
      const player = customPlayers.find((p) => p.slug === editBtn.dataset.customEdit);
      if (player) openCustomFormFor(player);
      return;
    }
    const delBtn = target?.closest('[data-custom-del]');
    if (delBtn) {
      removeCustomPlayer(delBtn.dataset.customDel);
      return;
    }
    const subBtn = target?.closest('[data-sub]');
    if (!subBtn) return;
    const player = benchPool.find((p) => p.name === subBtn.dataset.sub);
    if (player) beginSubstitution(player);
  });

  document.querySelectorAll('.archive-tab').forEach((button) => {
    button.addEventListener('click', () => setArchiveTab(button.dataset.tab));
  });

  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else document.documentElement.requestFullscreen?.().catch(() => showToast('浏览器拒绝了全屏请求'));
  };
  el.fullscreenButton.addEventListener('click', toggleFullscreen);
  el.dockFullscreen.addEventListener('click', toggleFullscreen);
  document.addEventListener('fullscreenchange', () => {
    const on = Boolean(document.fullscreenElement);
    el.fullscreenButton.classList.toggle('is-active', on);
    el.dockFullscreen.classList.toggle('is-active', on);
  });

  el.dockReset.addEventListener('click', () => {
    resetCamera();
  });
  el.dockRotate.addEventListener('click', () => setAutoRotate(!state.autoRotate));
  el.dockSection.addEventListener('click', () => setSection(!state.section));
  el.dockRoof.addEventListener('click', () => setRoofOpacity(state.roofOpacity > 50 ? 12 : 100, true));
  el.dockNight.addEventListener('click', () => toggleDayNight());

  el.dismissHint.addEventListener('click', dismissMouseHint);

  el.fallbackRetry?.addEventListener('click', () => window.location.reload());
  el.fallbackShell?.addEventListener('click', () => {
    el.fallback.hidden = true;
    el.boot?.classList.add('is-done');
    document.body.classList.add('is-ready');
    window.requestAnimationFrame(() => {});
  });
}

function resetCamera() {
  if (state.explode > 0) setExplode(0, true);
  setViewInstant('aerial-se');
  flyTo('aerial-se', 1.4);
  showToast('视角已复位 · 东南鸟瞰');
}

function bindKeyboard() {
  window.addEventListener('keydown', (event) => {
    const target = event.target;
    const typing = target instanceof HTMLElement
      && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);

    if (event.key === 'Escape') {
      event.preventDefault();
      if (state.customFormOpen) toggleCustomForm(false);
      else if (state.archiveOpen) closeArchive();
      else if (state.playersOpen) closePlayers();
      else if (pendingSub) {
        endPendingSub();
        showToast('已取消换人');
      }
      else if (state.lineupFocus) unfocusLineup(true);
      else if (state.view === 'lineup') {
        showToast('已离开阵容站位');
        flyTo('aerial-se', 1.3);
      }
      else if (state.pinned) pinStand(null);
      else if (IS_NARROW() && (state.panelViewsOpen || state.panelControlsOpen)) closePanels();
      else dismissMouseHint();
      return;
    }
    if (typing && !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    if (event.metaKey || event.ctrlKey || event.altKey) return;

    const key = event.key;
    switch (key) {
      case '[':
        event.preventDefault();
        stepView(-1);
        return;
      case ']':
        event.preventDefault();
        stepView(1);
        return;
      case ' ':
        event.preventDefault();
        setAutoRotate(!state.autoRotate);
        return;
      default:
        break;
    }

    switch (key.toLowerCase()) {
      case 'r':
        resetCamera();
        break;
      case 'n':
        toggleDayNight();
        break;
      case 'e':
        setSection(!state.section);
        break;
      case 'x':
        setRoofOpacity(state.roofOpacity > 50 ? 12 : 100, true);
        break;
      case 'c':
        setContextVisible(!state.context);
        break;
      case 'k':
        toggleArchive();
        break;
      case 'p':
        togglePlayers();
        break;
      case 'm':
        toggleAnthem();
        break;
      case 'v':
        setConsoleTab(state.consoleTab === 'heritage' ? 'atmosphere' : 'heritage', true);
        break;
      case 'h':
      case '?':
        toggleArchive('keys');
        break;
      case 'f':
        if (document.fullscreenElement) document.exitFullscreen?.();
        else document.documentElement.requestFullscreen?.().catch(() => showToast('浏览器拒绝了全屏请求'));
        break;
      default:
        // 数字键 1…9 与 0 对应视点列表序号
        if (/^[0-9]$/.test(key)) {
          const index = key === '0' ? 9 : Number(key) - 1;
          const vp = ORDERED_VIEWS[index];
          if (vp) flyTo(vp.id, 1.5);
        }
        break;
    }
  });
}

function onResize() {
  if (!renderer || !camera) return;
  const width = el.app.clientWidth;
  const height = el.app.clientHeight;
  if (!width || !height) return;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
  composer?.setSize(width, height);
  bloomPass?.setSize(width, height);
}

/* ===========================================================================
 * 14. 主循环
 * ========================================================================= */

function animate(now) {
  const seconds = now * 0.001;
  const dt = Math.min(0.06, lastFrame ? seconds - lastFrame : 0.016);
  lastFrame = seconds;
  elapsed += dt;

  if (skyUniforms) skyUniforms.uTime.value = elapsed;
  if (state.envDirty) applyEnvironment();

  tickCamera(dt);
  refreshPick();
  updateLineupCardAnchor();
  tickFormationTween();

  // 人形平躺/立正的角度平滑过渡（绕自身 Z 轴，躺下时头朝 +X 进攻方向）
  if (stadium?.lineupParts?.length && Math.abs(figureLieTarget - figureLieAngle) > 0.002) {
    figureLieAngle += (figureLieTarget - figureLieAngle) * Math.min(1, dt * 5);
    for (const part of stadium.lineupParts) part.group.rotation.z = figureLieAngle;
  }

  if (composer) composer.render();
  else renderer.render(scene, camera);
}

/* ===========================================================================
 * 15. 泛光灯位（从球场模块的灯桥位置取）
 * ========================================================================= */

function attachFloodlights() {
  const parts = stadium?.parts?.floodlights;
  if (!Array.isArray(parts) || !parts.length) return;
  scene.updateMatrixWorld(true);
  parts.forEach((part) => {
    // 用包围盒而不是原点：灯桥可能是以基座为原点的组
    const box = new THREE.Box3().setFromObject(part);
    if (box.isEmpty()) return;
    const center = box.getCenter(new THREE.Vector3());
    const spot = new THREE.SpotLight(0xf2f7ff, 0, 900, 0.44, 0.85, 2);
    spot.position.set(center.x, box.max.y + 1.5, center.z);
    spot.target.position.set(center.x * 0.16, 1, center.z * 0.16);
    scene.add(spot);
    scene.add(spot.target);
    floodSpots.push(spot);
  });
}

/* ===========================================================================
 * 16. 初始化
 * ========================================================================= */

async function loadStadium() {
  setBoot(34, '导入公开来源尺寸');
  await nextFrame();

  setBoot(46, '生成草坪与球门 · 碗形看台台阶');
  startBootCreep(46, 76, 2600);
  await nextFrame();

  const module = await import('./stadium.js');
  if (typeof module.buildStadium !== 'function') {
    throw new Error('js/stadium.js 未导出 buildStadium()');
  }
  const started = performance.now();
  const built = module.buildStadium({ seats: true, context: true });
  const wallMs = performance.now() - started;
  // stadium.js 的 stats.buildMs 若缺失、为 0 或小到取整后为 0（例如它只统计了某个局部阶段），
  // 就用本层实测的墙钟耗时兜底，避免 HUD 上出现「0 ms」这种没有信息量的读数。
  if (built && built.stats && Math.round(Number(built.stats.buildMs) || 0) <= 0) {
    built.stats.buildMs = Math.round(wallMs);
    built.stats.buildMsSource = 'app-measured';
  }
  stopBootCreep();
  return built;
}

async function init() {
  applyStoredPrefsToState();   // 本地存档的阵容/氛围设置合入初始状态（URL 参数优先）
  // 仅在防抖尚有未落盘变更时兜底写盘：无条件写会把导入/清空刚写入的键用内存旧态覆盖
  window.addEventListener('beforeunload', () => { if (prefsSaveTimer) flushPrefs(); });
  if (params.get('ui') === '0') document.body.classList.add('hide-ui');
  if (document.fullscreenEnabled === false) el.fullscreenButton.style.display = 'none';

  buildHeroFacts();
  buildViewList();
  applySwatches();
  bindViewPanel();
  bindControlsPanel();
  bindPanelCollapse();
  bindChrome();
  bindStandCard();
  bindPicking();
  bindKeyboard();
  updateViewUI();

  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', () => window.setTimeout(onResize, 180));

  if (!initRenderer()) {
    document.body.classList.add('is-ready');
    showFallback(
      '浏览器不支持 WebGL',
      '本页需要 WebGL 才能显示三维球场。请改用较新的 Chrome / Edge / Firefox，或在浏览器设置中启用硬件加速。',
      'WebGLRenderingContext 创建失败',
    );
    return;
  }

  initScene();
  setBoot(12, '建立三维上下文');
  await nextFrame();

  setBoot(22, '编译天空穹顶与日照模型');
  applyEnvironment();
  await nextFrame();

  onResize();

  if (params.get('shell') === '1') {
    // 只浏览界面外壳：不加载几何，用于几何模块尚未就绪时预览交互层
    populateArchive();
    restoreLineupPrefs();   // 恢复存档阵容（shell 模式无几何，只恢复名单与抽屉）
    bindCardFlip();
    finishBoot();
    renderer.setAnimationLoop(animate);
    state.started = true;
    return;
  }

  try {
    stadium = await loadStadium();
  } catch (error) {
    document.body.classList.add('is-ready');
    showFallback(
      '球场几何尚未就绪',
      '页面外壳与交互层已加载，但三维几何模块没有就绪。本页必须通过本地 HTTP 服务打开'
        + '（ES module 在 file:// 协议下无法加载），且需要 js/stadium.js 与 js/data.js 同时存在。'
        + '如果几何模块仍在编写中，可先点「仅浏览界面外壳」查看交互层。',
      String(error?.message || error),
    );
    renderer.setAnimationLoop(animate);
    return;
  }

  scene.add(stadium.root);
  indexStands();
  attachFloodlights();

  setBoot(84, '校准日照与结构剖视');
  await nextFrame();

  // 依初始状态把开关拨到正确位置（不再重复提示）
  setSeatMode(state.seatMode, false);
  setExplode(state.explode, false);
  setRoofOpacity(state.roofOpacity, false);
  setSection(state.section, false);
  setContextVisible(state.context, false);
  setFloodlights(state.floodlights, false);
  setAutoRotate(state.autoRotate, false);
  applyStats();
  populateArchive();
  restoreLineupPrefs();    // 恢复存档阵容：模式 → 换人回放 → 阵型落位（内部刷新名单与抽屉）
  buildFormationPicker();
  bindCardFlip();          // 成品卡翻面：抽屉与阵容浮层共用一次委托
  renderHeritage();
  initAnthem();
  applyConsoleTab();

  // ?console=heritage 可直接打开队史面板（与 ?archive= 同类的调试入口）
  if (params.get('console') === 'heritage') setConsoleTab('heritage', false);

  setBoot(94, '装配泛光灯与后处理');
  applyEnvironment();
  await nextFrame();

  if (params.get('debug') === '1') {
    window.__STADIUM__ = stadium;
    window.__SCENE__ = scene;
    window.__RENDERER__ = renderer;
    window.__APP__ = { camera, controls, state, THREE, setView: setViewInstant, flyTo };
  }

  await new Promise((resolve) => window.setTimeout(resolve, 260));
  finishBoot();
  renderer.setAnimationLoop(animate);
  state.started = true;

  if (params.get('archive')) {
    window.setTimeout(() => openArchive(params.get('archive')), 1800);
  }
  if (params.get('view')) {
    window.setTimeout(() => flyTo(state.view, 1.4), 320);
  }
}

init();