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
  helpButton: $('helpButton'),
  fullscreenButton: $('fullscreenButton'),
  metaBuild: $('metaBuild'),

  hero: $('hero'),
  heroFacts: $('heroFacts'),
  heroNote: $('heroNote'),

  viewPanel: $('viewPanel'),
  viewGroups: $('viewGroups'),
  viewPanelCount: $('viewPanelCount'),
  collapseViews: $('collapseViews'),

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
  roofOpacity: 1,
  section: params.get('section') === '1',
  context: params.get('context') !== '0',
  floodlights: params.get('lights') !== '0',
  autoRotate: params.get('rotate') === '1',
  archiveOpen: false,
  archiveTab: 'stats',
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
  if (announce) showToast(state.autoRotate ? '自动环绕已开启' : '自动环绕已关闭');
}

function setFloodlights(on, announce = true) {
  state.floodlights = Boolean(on);
  setSwitch('floodlights', state.floodlights);
  state.envDirty = true;
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
  updateViewUI();
  applyDebugCamera();
}

function flyTo(id, duration = 1.5, options = {}) {
  const vp = ORDERED_VIEWS.find((v) => v.id === id);
  if (!vp || !camera || state.archiveOpen) return;
  const resolved = resolveViewpoint(vp);
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
  updateViewUI();
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
    controls.enabled = true;
    controls.autoRotate = state.autoRotate;   // 补间结束后恢复自动环绕
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

function buildViewList() {
  el.viewGroups.innerHTML = VIEW_GROUPS.map((group) => {
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
  }).join('');
  el.viewPanelCount.textContent = String(VIEWPOINTS.length).padStart(2, '0');
  el.viewPanelCount.title = `共 ${VIEWPOINTS.length} 个视点`;
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

/* ===========================================================================
 * 13. 事件绑定
 * ========================================================================= */

function dismissMouseHint() {
  if (state.hintDismissed) return;
  state.hintDismissed = true;
  el.mouseHint?.classList.add('is-hidden');
}

function bindViewPanel() {
  el.viewGroups.addEventListener('click', (event) => {
    const button = event.target.closest('.view-button');
    if (!button) return;
    flyTo(button.dataset.view, 1.5);
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
    panel.classList.toggle('is-collapsed', collapsed);
    button.setAttribute('aria-expanded', String(collapsed));
    button.setAttribute('aria-label', collapsed ? '展开面板' : '收起面板');
  };

  el.collapseViews.addEventListener('click', () => {
    state.viewsCollapsed = !state.viewsCollapsed;
    applyCollapsed(el.viewPanel, el.collapseViews, state.viewsCollapsed);
  });
  el.collapseControls.addEventListener('click', () => {
    state.controlsCollapsed = !state.controlsCollapsed;
    applyCollapsed(el.atmospherePanel, el.collapseControls, state.controlsCollapsed);
  });
  el.collapseHeritage?.addEventListener('click', () => {
    state.heritageCollapsed = !state.heritageCollapsed;
    if (el.heritagePanel && el.collapseHeritage) {
      applyCollapsed(el.heritagePanel, el.collapseHeritage, state.heritageCollapsed);
    }
  });

  // 控制台两块面板互相切换（02 控制 ⇄ 03 队史）
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
      controls.enabled = true;
    }
  });
  el.canvas.addEventListener('pointerup', (event) => {
    const down = pointerDownAt;
    pointerDownAt = null;
    if (!down) return;
    const moved = Math.hypot(event.clientX - down.x, event.clientY - down.y);
    if (moved > 6 || event.button !== 0) return;
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
      if (state.archiveOpen) closeArchive();
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