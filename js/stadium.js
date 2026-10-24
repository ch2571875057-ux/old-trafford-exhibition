/**
 * js/stadium.js · 老特拉福德装配器（真实模型版）
 * ---------------------------------------------------------------------------
 * 几何来源：`assets/old-trafford.glb`（摄影测量模型，约 28.9 MB、1135 个网格、
 * 178 742 个三角面、91 个材质）。本文件不再程序化生成球场，只负责把这个外部
 * 模型“装配”成 index.html 需要的形状：
 *
 *   1. 标定：模型自带地理朝向与英制单位（根节点 scale 0.0254），需要绕 Y 旋转、
 *      水平平移并下移，使草坪中心落在原点、草坪顶面落到 y = 0，从而沿用应用既有的
 *      世界坐标约定（北 = -Z、南 = +Z、东 = +X、西 = -X、草坪长轴 = X 轴）。
 *   2. 拆分四座看台：模型是整体网格（连座席台面 `*1` 都只有 3 大块），按三角面
 *      所在象限把几何切成 N/S/E/W 四组，再加“场地静态件”与“周边配景”两组。
 *      切分后每个看台都是独立 Group，应用侧的拾取高亮、分层爆炸、分看台座席
 *      着色才能生效。
 *   3. 接口：与旧程序化版本保持一致（见 app.js 第 10/11/15 章）——
 *      root / parts / bounds / stats / seatCount / setNight / setSeatMode /
 *      getSeatMode / setExplode / setRoofOpacity / setSection / setContextVisible /
 *      dispose。
 *
 * 标定常数来自离线几何分析（tools/glb_*.py），不要随手改；`MODEL_YAW_DEG`
 * 若发现南北整体反了，改 ±180 即可。
 * ---------------------------------------------------------------------------
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { STAND_ORDER, STANDS, PLAYERS, LINEUP, COACH } from './data.js';

/* ===========================================================================
 * 1. 模型标定常量
 * ======================================================================== */

/** 模型文件位置（相对本模块，index.html 与页面同源） */
const MODEL_URL = new URL('../assets/old-trafford.glb', import.meta.url).href;

/**
 * 草坪（绿色贴图网格 node 33/34）顶点在水平面上的主成分方向：
 * 长轴相对模型 +X 轴 152.0653°，草坪矩形 137.2 × 86.8 m。
 */
const MODEL_PITCH_AXIS_DEG = 152.0653;

/** 草坪中心（模型坐标，单位 m） */
const MODEL_PITCH_CENTER = { x: -5.161, z: 14.098 };

/** 草坪顶面高度（模型坐标，单位 m）→ 平移到 y = 0 */
const MODEL_PITCH_TOP_Y = 8.151;

/**
 * 让「草坪长轴 = X 轴、三层最高的北看台 = -Z」的偏航角。
 * 草坪矩形有 180° 对称，能摆正长轴的只有 152.0653° 与 332.0653°：
 * 152.0653° 会把最高的三层看台放到 +Z（单层低看台放 -Z），与应用
 * “北 = -Z”的约定相反，因此取 +180° 之后的值。
 */
const MODEL_YAW_DEG = MODEL_PITCH_AXIS_DEG + 180;

/* ===========================================================================
 * 2. 与应用侧的约定
 * ======================================================================== */

/** 看台 key → parts 里的键名（与 app.js STAND_PART_KEY 对应） */
const STAND_PART_KEY = {
  north: 'standNorth',
  south: 'standSouth',
  east: 'standEast',
  west: 'standWest',
};

/** 爆炸展开方向（北 = -Z、南 = +Z、东 = +X、西 = -X） */
const EXPLODE_DIR = {
  north: new THREE.Vector3(0, 0, -1),
  south: new THREE.Vector3(0, 0, 1),
  east: new THREE.Vector3(1, 0, 0),
  west: new THREE.Vector3(-1, 0, 0),
};

/** 爆炸滑杆 100% 时看台外移的距离（与旧版 46 m 保持一致） */
const EXPLODE_DISTANCE = 46;

/** 剖切：保留 z ≤ 0 的北半幅（与旧版同一平面、同一语义） */
const SECTION_PLANE = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0);

/** 屋盖材质：4 片悬挑屋面板 + 钢桁架体系（setRoofOpacity 的着色目标） */
const ROOF_MATERIALS = new Set(['*30', '*36']);

/** 座席材质：看台台阶面 + 座席点阵 + 队徽贴花（setSeatMode 的着色目标） */
const SEAT_MATERIALS = new Set(['*1', '*7', '305px-Man_Utd_FC_.svg']);

/** 草坪材质：草地与绿色缓冲带（爆炸时不能跟着看台飞出去） */
const PITCH_MATERIALS = new Set(['*6', '*18']);

/** 夜间自发光的材质（玻璃幕墙 / 照片幕墙） */
const NIGHT_MATERIAL_RE = /glass|photo texture|translucent/i;

/**
 * 平面半径（m）超过该值、且整块网格都在外围的，归入“周边配景”（只有最外圈的
 * 照片建筑板落在这里；看台外立面半径约 100–115 m，必须跟着看台一起动）。
 */
const CONTEXT_RADIUS = 118;

/**
 * 场地静态件判定：包围盒扁平（高 < 2.5 m）且贴地（顶面 < 3.5 m）的网格
 * ——草坪、地坪、走道等，进“场地”组，不参与爆炸。
 */
const SITE_MAX_HEIGHT = 2.5;
const SITE_MAX_TOP_Y = 3.5;

/** 座席数的面积估算口径：每座位占用的看台台面面积（m²） */
const SEAT_AREA_PER_SEAT = 0.3;

/** 座席着色方案：材料色 ×（贴图）决定最终颜色 */
const SEAT_MODES = {
  natural: null,
  blocks: {
    north: '#ffc6cd',
    south: '#bcd0ff',
    east: '#ffd79c',
    west: '#a9eec6',
  },
  capacity: '#ff9a90',
  away: { east: '#2b3240' },
  off: '#8d8983',
};

/** 光灯塔锚点：模型屋盖四角的桁架塔位置，attachFloodlights 会取 Box3 顶部 */
const FLOODLIGHT_ANCHORS = [
  [-88, 46, -72],
  [88, 46, -72],
  [88, 46, 72],
  [-88, 46, 72],
];

/** 展台台面标高：略低于模型自带地坪（y ≈ -0.5），模型正好坐在台座上 */
const PLINTH_TOP_Y = -0.55;

/* ===========================================================================
 * 3. 小工具
 * ======================================================================== */

const clamp01 = (value) => Math.min(1, Math.max(0, Number(value) || 0));

/** 引导遮罩文案（只改文字，不动进度条——app.js 的 creep 正在写它） */
function setBootStatus(message) {
  if (typeof document === 'undefined') return;
  const el = document.getElementById('bootStatus');
  if (el) el.textContent = message;
}

/** 按 URL 载入 GLB，并把下载进度写进引导遮罩；大文件请求偶发被掐断时自动重试 */
function loadModel(attempt = 0) {
  return new Promise((resolve, reject) => {
    const loader = new GLTFLoader();
    loader.load(
      MODEL_URL,
      resolve,
      (event) => {
        if (!event) return;
        const megabytes = (event.loaded / 1048576).toFixed(1);
        if (event.total) {
          const percent = Math.round((event.loaded / event.total) * 100);
          setBootStatus(`载入老特拉福德实测模型 ${percent}%（${megabytes} MB）`);
        } else {
          setBootStatus(`载入老特拉福德实测模型 ${megabytes} MB`);
        }
      },
      (error) => {
        // 共享开发服务在多人同时拉 29 MB 模型时偶发断流：最多重试 2 次
        if (attempt < 2) {
          setBootStatus(`模型下载中断，正在重试（第 ${attempt + 1} 次）…`);
          window.setTimeout(() => {
            loadModel(attempt + 1).then(resolve).catch(reject);
          }, 1500);
          return;
        }
        reject(error);
      },
    );
  });
}

/**
 * 用原始顶点属性 + 新的索引数组造一个“切片”几何体：
 * 顶点缓冲共享（省内存），只换索引；包围盒/包围球按切片自身收紧，
 * 否则 three 会按整块原始属性算包围盒，拾取与悬停框会全乱。
 */
function sliceGeometry(source, indices) {
  const geometry = new THREE.BufferGeometry();
  for (const name of Object.keys(source.attributes)) {
    geometry.setAttribute(name, source.attributes[name]);
  }
  for (const name of Object.keys(source.morphAttributes ?? {})) {
    geometry.morphAttributes[name] = source.morphAttributes[name];
  }
  geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(indices), 1));

  const position = geometry.attributes.position;
  const min = new THREE.Vector3(Infinity, Infinity, Infinity);
  const max = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
  const vertex = new THREE.Vector3();
  for (let i = 0; i < indices.length; i += 1) {
    vertex.fromBufferAttribute(position, indices[i]);
    min.min(vertex);
    max.max(vertex);
  }
  geometry.boundingBox = new THREE.Box3(min, max);
  const center = geometry.boundingBox.getCenter(new THREE.Vector3());
  let maxDistanceSq = 0;
  for (let i = 0; i < indices.length; i += 1) {
    vertex.fromBufferAttribute(position, indices[i]);
    const distanceSq = vertex.distanceToSquared(center);
    if (distanceSq > maxDistanceSq) maxDistanceSq = distanceSq;
  }
  geometry.boundingSphere = new THREE.Sphere(center, Math.sqrt(maxDistanceSq));
  return geometry;
}

/* ===========================================================================
 * 4. 按象限把整体网格拆成四座看台 + 场地 + 周边配景
 * ======================================================================== */

/**
 * 修正材质参数。
 *
 * 这份模型的 91 个材质全部带 `KHR_materials_ior: { ior: 1000 }`（Blender 导出时
 * 把“高光为 0”写成了 IOR 1000）。Three 的 GLTFLoader 会照抄成 `ior = 1000`，
 * 于是菲涅耳反射率接近 1，整个球场在城市环境贴图下变成一层灰白镜面。
 * 这些材质本来就是照片贴图的漫反射面，把 IOR 拉回电介质默认值即可恢复纹理原色。
 *
 * @param {THREE.Material | undefined} material
 */
function normalizeMaterial(material) {
  if (!material || material.userData.__normalized) return;
  material.userData.__normalized = true;
  if (Number.isFinite(material.ior) && material.ior > 2) material.ior = 1.5;
}

/**
 * 把整体网格切成 6 组：四个看台象限、场地静态件（草坪/地坪）、周边配景。
 * 切分粒度为三角面——模型里连座席台面都只有 3 大块，按网格整体归类会让
 * 爆炸展开时整片碗体一起飞走。
 *
 * @param {THREE.Object3D} source 已完成标定（matrixWorld 即应用世界坐标）的模型根
 * @param {Record<string, THREE.Group>} standGroups 四个看台组
 * @param {THREE.Group} contextGroup 周边配景组
 * @param {THREE.Group} siteGroup 场地静态件组
 */
function splitByStand(source, standGroups, contextGroup, siteGroup) {
  const meshes = [];
  source.traverse((object) => {
    if (object.isMesh && object.geometry?.attributes?.position) meshes.push(object);
  });

  const report = {
    triangles: 0,
    deckArea: 0,
    deckPlanArea: 0,
    materials: new Set(),
    roofMaterials: new Set(),
    nightMaterials: new Set(),
    seatMaterialsByStand: new Map(STAND_ORDER.map((key) => [key, new Set()])),
    seatMaterialCache: new Map(),
    pieceCount: 0,
  };

  const world = new THREE.Vector3();
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const ab = new THREE.Vector3();
  const ac = new THREE.Vector3();
  const normal = new THREE.Vector3();

  for (const mesh of meshes) {
    const geometry = mesh.geometry;
    const position = geometry.attributes.position;
    const index = geometry.index ? geometry.index.array : null;
    const triangleCount = Math.floor((index ? index.length : position.count) / 3);
    if (!triangleCount) continue;

    const matrix = mesh.matrixWorld;
    const baseMaterial = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    normalizeMaterial(baseMaterial);
    const materialName = baseMaterial?.name ?? '';
    const isSeatMaterial = SEAT_MATERIALS.has(materialName);
    const isRoofMaterial = ROOF_MATERIALS.has(materialName);

    // 顶点烘焙到应用世界坐标，同时求整块网格的平面半径与竖向范围
    const vertexCount = position.count;
    const worldPositions = new Float32Array(vertexCount * 3);
    let minPlanRadius = Infinity;
    let meshMinY = Infinity;
    let meshMaxY = -Infinity;
    for (let i = 0; i < vertexCount; i += 1) {
      world.fromBufferAttribute(position, i).applyMatrix4(matrix);
      worldPositions[i * 3] = world.x;
      worldPositions[i * 3 + 1] = world.y;
      worldPositions[i * 3 + 2] = world.z;
      const planRadius = Math.hypot(world.x, world.z);
      if (planRadius < minPlanRadius) minPlanRadius = planRadius;
      if (world.y < meshMinY) meshMinY = world.y;
      if (world.y > meshMaxY) meshMaxY = world.y;
    }

    // 静态件（草坪/地坪/走道）：扁平且贴地，不参与爆炸与拾取
    const isSitePiece = meshMaxY - meshMinY < SITE_MAX_HEIGHT && meshMaxY < SITE_MAX_TOP_Y;
    // 周边配景：整块网格都在最外圈之外
    const belongsToContext = !isSitePiece && minPlanRadius > CONTEXT_RADIUS;

    // 逐三角面分桶（site / context / 四个象限）
    const buckets = new Map();
    for (let t = 0; t < triangleCount; t += 1) {
      const i0 = index ? index[t * 3] : t * 3;
      const i1 = index ? index[t * 3 + 1] : t * 3 + 1;
      const i2 = index ? index[t * 3 + 2] : t * 3 + 2;
      a.set(worldPositions[i0 * 3], worldPositions[i0 * 3 + 1], worldPositions[i0 * 3 + 2]);
      b.set(worldPositions[i1 * 3], worldPositions[i1 * 3 + 1], worldPositions[i1 * 3 + 2]);
      c.set(worldPositions[i2 * 3], worldPositions[i2 * 3 + 1], worldPositions[i2 * 3 + 2]);

      // 座席台面的面积 → 座席数估算（台阶面的水平投影才是“每人占多少地”）
      if (isSeatMaterial) {
        ab.subVectors(b, a);
        ac.subVectors(c, a);
        normal.crossVectors(ab, ac);
        const length = normal.length();
        if (length > 1e-6) {
          const cosine = Math.abs(normal.y) / length;
          if (cosine > 0.5) {
            const area = length * 0.5;
            report.deckArea += area;
            report.deckPlanArea += area * cosine;
          }
        }
      }

      let key;
      if (isSitePiece || PITCH_MATERIALS.has(materialName)) {
        key = 'site';
      } else if (belongsToContext) {
        key = 'context';
      } else {
        const centroidX = (a.x + b.x + c.x) / 3;
        const centroidZ = (a.z + b.z + c.z) / 3;
        key = Math.abs(centroidX) >= Math.abs(centroidZ)
          ? (centroidX >= 0 ? 'east' : 'west')
          : (centroidZ >= 0 ? 'south' : 'north');
      }

      let bucket = buckets.get(key);
      if (!bucket) {
        bucket = [];
        buckets.set(key, bucket);
      }
      bucket.push(i0, i1, i2);
    }

    report.triangles += triangleCount;

    // 按桶生成切片网格
    for (const [key, indices] of buckets) {
      const target = key === 'context'
        ? contextGroup
        : (key === 'site' ? siteGroup : standGroups[key]);
      if (!target || !indices.length) continue;

      let material = baseMaterial;
      if (isSeatMaterial && standGroups[key]) {
        const cacheKey = `${key}|${baseMaterial.uuid}`;
        material = report.seatMaterialCache.get(cacheKey);
        if (!material) {
          material = baseMaterial.clone();
          material.name = `${materialName}#${key}`;
          // 记下原始底色，座席模式着色时在它上面做乘法，避免把贴图色调抹平
          material.userData.baseColor = baseMaterial.color.clone();
          report.seatMaterialCache.set(cacheKey, material);
        }
        report.seatMaterialsByStand.get(key)?.add(material);
      }

      const piece = new THREE.Mesh(sliceGeometry(geometry, indices), material);
      piece.name = mesh.name;
      piece.matrixAutoUpdate = false;
      piece.matrix.copy(matrix);
      piece.castShadow = true;
      piece.receiveShadow = true;
      target.add(piece);
      report.pieceCount += 1;

      if (isRoofMaterial) report.roofMaterials.add(material);
      if (NIGHT_MATERIAL_RE.test(materialName)) report.nightMaterials.add(material);
      report.materials.add(material);
    }
  }

  return report;
}

/* ===========================================================================
 * 5. 展览底座
 * ---------------------------------------------------------------------------
 * 真实模型自带一圈地坪，但出图时它是“漂浮”的。这里补一个博物馆式台座：
 *   台面板 → 红嵌线 → 内缩主体（挂铭牌）→ 外扩台脚，
 * 四层都用圆角矩形挤出，尺寸从模型实际包围盒推算，模型换了台座也跟着变。
 * ======================================================================== */

/** 展台俯视轮廓：圆角矩形，落在 XZ 平面上 */
function roundedRectShape(width, depth, radius) {
  const halfW = width / 2;
  const halfD = depth / 2;
  const r = Math.min(radius, halfW, halfD);
  const shape = new THREE.Shape();
  shape.moveTo(-halfW + r, -halfD);
  shape.lineTo(halfW - r, -halfD);
  shape.quadraticCurveTo(halfW, -halfD, halfW, -halfD + r);
  shape.lineTo(halfW, halfD - r);
  shape.quadraticCurveTo(halfW, halfD, halfW - r, halfD);
  shape.lineTo(-halfW + r, halfD);
  shape.quadraticCurveTo(-halfW, halfD, -halfW, halfD - r);
  shape.lineTo(-halfW, -halfD + r);
  shape.quadraticCurveTo(-halfW, -halfD, -halfW + r, -halfD);
  return shape;
}

/** 一层台座板：沿 +Y 挤出，顶面正好落在 topY */
function plinthSlab(width, depth, radius, topY, height, material) {
  const geometry = new THREE.ExtrudeGeometry(roundedRectShape(width, depth, radius), {
    depth: height,
    bevelEnabled: false,
    curveSegments: 18,
  });
  geometry.rotateX(-Math.PI / 2);      // 挤出方向 +Z → +Y，轮廓落在 XZ 平面
  geometry.translate(0, topY - height, 0);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** 台座正面铭牌贴图：现画一张 canvas，避免额外资源与网络请求 */
function makePlinthLabel() {
  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // letterSpacing 是较新的 Canvas2D 属性，不支持时退化为普通字距
  try { ctx.letterSpacing = '18px'; } catch { /* 忽略 */ }

  ctx.font = '400 92px "Songti SC", "Times New Roman", serif';
  ctx.fillStyle = '#e8e2dc';
  ctx.fillText('OLD TRAFFORD', 1024, 96);

  ctx.font = '400 40px "Songti SC", "Times New Roman", serif';
  ctx.fillStyle = 'rgba(200, 16, 46, 0.92)';
  ctx.fillText('THEATRE OF DREAMS · 1910', 1024, 188);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

/**
 * 依模型包围盒生成展台
 * 剖面自上而下：台面板 → 红嵌线 → 内缩主体（挂铭牌）→ 外扩台脚
 * @param {THREE.Box3} modelBox 已标定的模型世界包围盒
 * @returns {THREE.Group} 展台组（带 userData.label / userData.size）
 */
/**
 * 在模型网格里找西端球门（白框 + 网），用于把阵容整体对齐到真实球门位。
 * 筛选条件即球门的几何特征：西端、门宽 7.32 m 量级、门高 2.44 m 量级、
 * 足印薄（框架 + 网）。找不到时返回 null（回退到草坪坐标系的标称位置）。
 */
/**
 * 在模型网格里找两端球门（白框 + 网），量出**实测球场基准**：
 * 两端球门线的中点 = 球场中心；两端球门中心的连线 = 进攻长轴。
 * 这样阵型对齐的是真实白线，而不是草坪贴图的主成分方向（两者不严格重合）。
 * 任一端找不到时返回 null（回退到标称草坪坐标系）。
 */
function findPitchFrame(root) {
  const ends = { W: [], E: [] };
  const box = new THREE.Box3();
  root.traverse((object) => {
    if (!object.isMesh || !object.visible) return;
    box.setFromObject(object);
    if (box.isEmpty()) return;
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    if (Math.abs(center.x) < 42 || Math.abs(center.x) > 60) return;   // 两端球门区
    if (size.z < 5.5 || size.z > 10) return;            // 门宽 7.32 m（含框）
    if (size.y < 1.2 || size.y > 3.6) return;           // 门高 2.44 m
    if (size.x > 4.5) return;                           // 框架 + 网的进深
    if (center.y < 0.4 || center.y > 3.2) return;       // 立在地面上
    ends[center.x < 0 ? 'W' : 'E'].push(box.clone());
  });
  const measure = (list, isWest) => {
    if (!list.length) return null;
    const union = list[0].clone();
    for (let i = 1; i < list.length; i += 1) union.union(list[i]);
    return {
      lineX: isWest ? union.max.x : union.min.x,        // 球门线平面（网向场外延，取朝向场地的一侧）
      centerZ: (union.min.z + union.max.z) / 2,         // 球门中心
      width: union.max.z - union.min.z,                 // 应 ≈ 7.32 m（自检用）
      count: list.length,
    };
  };
  const west = measure(ends.W, true);
  const east = measure(ends.E, false);
  if (!west || !east) return null;
  const dx = east.lineX - west.lineX;
  const dz = east.centerZ - west.centerZ;
  return {
    west, east,
    center: { x: (west.lineX + east.lineX) / 2, z: (west.centerZ + east.centerZ) / 2 },
    length: Math.hypot(dx, dz),                          // 实测球场长（应 ≈ 105 m）
    angle: Math.atan2(-dz, dx),                          // 长轴相对 +X 的偏角（rotation.y）
  };
}

/**
 * 阵容站位人形（胶囊体身体 + 球体头，俱乐部红），按 LINEUP 的草坪坐标摆放。
 * 每个人形附带一个放大的不可见命中球（Raycaster 不看 visible，命中手感更宽容），
 * app.js 用 anchor（头顶上方锚点）做屏幕投影定位球员卡。
 * westGoal 存在时整体平移，把门将（局部坐标第一个成员）对到球门线前 4.5 m、
 * 球门正中——模型草坪中心与比赛场地中心并不严格重合，不能直接信标称坐标。
 */
function createLineup(pitchFrame) {
  const group = new THREE.Group();
  group.name = 'lineup';

  const bodyGeometry = new THREE.CapsuleGeometry(0.42, 1.25, 6, 20);   // 总高 ≈ 2.1 m
  const headGeometry = new THREE.SphereGeometry(0.32, 20, 14);
  const hitGeometry = new THREE.SphereGeometry(1.9, 8, 6);
  const bodyMaterial = new THREE.MeshStandardMaterial({
    name: 'lineupBody', color: 0xc8102e, roughness: 0.55, metalness: 0.08,
  });
  const headMaterial = new THREE.MeshStandardMaterial({
    name: 'lineupHead', color: 0xe2493f, roughness: 0.45, metalness: 0.05,
  });
  const hitMaterial = new THREE.MeshBasicMaterial({ name: 'lineupHitProxy' });

  const startingXi = PLAYERS.groups[0]?.members ?? [];
  const gkMember = LINEUP.members[0];                   // 约定：第一个成员是门将

  /* 实测球场基准：组原点 = 球场中心、长轴 = 两端球门连线。
   * 局部坐标仍是理想草坪坐标（门将 (-50, 0)），由组的平移 + 旋转映射到真实白线。
   * 未量到双端球门时回退：不旋转，仅按标称半场 52.5 m 平移。 */
  let cosA = 1;
  let sinA = 0;
  if (pitchFrame) {
    group.rotation.y = pitchFrame.angle;
    cosA = Math.cos(pitchFrame.angle);
    sinA = Math.sin(pitchFrame.angle);
    // 门将局部 (-50, 0) → 球门线前 4.5 m、球门中心（小禁区前沿）
    group.position.set(
      pitchFrame.west.lineX + 4.5 + 50 * cosA,
      0,
      pitchFrame.west.centerZ - 50 * sinA,
    );
  } else {
    group.position.set(gkMember.at[0] + 52.5 - 50 + 4.5, 0, gkMember.at[1]);
  }

  // 局部坐标 → 世界坐标（含组的平移与长轴旋转）
  const localToWorld = (local) => new THREE.Vector3(
    group.position.x + local.x * cosA + local.z * sinA,
    local.y,
    group.position.z - local.x * sinA + local.z * cosA,
  );

  const parts = [];
  for (const member of LINEUP.members) {
    const player = startingXi.find((p) => p.name === member.name);
    if (!player || !Array.isArray(member.at)) continue;

    const figure = new THREE.Group();
    figure.name = `lineup-${player.name}`;
    figure.position.set(member.at[0], 0, member.at[1]);

    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.y = 1.04;
    const head = new THREE.Mesh(headGeometry, headMaterial);
    head.position.y = 2.42;
    const hit = new THREE.Mesh(hitGeometry, hitMaterial);
    hit.position.y = 1.35;
    hit.visible = false;                          // 不渲染，但可被射线与投影取到
    hit.userData.lineupPlayer = player.name;
    figure.add(body, head, hit);
    group.add(figure);

    const worldAt = localToWorld(figure.position);
    parts.push({
      name: player.name,
      player,
      group: figure,
      worldAt,                                              // 世界坐标（含整体对齐）
      anchor: worldAt.clone(),                              // 卡面锚点：胶囊底部（脚底）
    });
  }

  /* ---- 主教练：教练区（南看台前沿技术区），同款几何体；卡面暂为空白占位 ---- */
  if (Array.isArray(COACH.at)) {
    const coachFigure = new THREE.Group();
    coachFigure.name = 'lineup-head-coach';
    coachFigure.position.set(COACH.at[0], 0, COACH.at[1]);
    const coachBody = new THREE.Mesh(bodyGeometry, bodyMaterial);
    coachBody.position.y = 1.04;
    const coachHead = new THREE.Mesh(headGeometry, headMaterial);
    coachHead.position.y = 2.42;
    const coachHit = new THREE.Mesh(hitGeometry, hitMaterial);
    coachHit.position.y = 1.35;
    coachHit.visible = false;
    coachHit.userData.lineupPlayer = COACH.name;
    coachFigure.add(coachBody, coachHead, coachHit);
    group.add(coachFigure);

    // 教练区同属实测球场框架：局部坐标由组的平移 + 长轴旋转映射到世界
    const coachWorld = localToWorld(coachFigure.position);
    parts.push({
      name: COACH.name,
      player: { blank: true, num: null, name: COACH.name, nameZh: COACH.nameZh, pos: COACH.pos },
      group: coachFigure,
      worldAt: coachWorld,
      anchor: coachWorld.clone(),
    });
  }

  group.visible = false;
  return { group, parts, frame: { position: group.position.clone(), cos: cosA, sin: sinA } };
}

function createPlinth(modelBox) {
  const group = new THREE.Group();
  group.name = 'plinth';

  const center = modelBox.getCenter(new THREE.Vector3());
  const size = modelBox.getSize(new THREE.Vector3());

  const margin = 18;                               // 台面比模型外扩 18 m，形成一圈展台边
  const width = Math.round((size.x + margin * 2) / 2) * 2;
  const depth = Math.round((size.z + margin * 2) / 2) * 2;
  const radius = 30;

  const topY = PLINTH_TOP_Y;
  const topHeight = 1.90;                          // 台面板（承托模型的那一层）
  const accentHeight = 0.60;                       // 红嵌线
  const bodyHeight = 5.00;                         // 内缩主体（铭牌所在的立面）
  const footHeight = 1.80;                         // 底部外扩的台脚
  const accentInset = 1.00;
  const bodyInset = 7.00;
  const footInset = 1.50;

  const topMaterial = new THREE.MeshStandardMaterial({
    name: 'plinthTop', color: new THREE.Color('#4a4e55'), roughness: 0.7, metalness: 0.2,
  });
  const accentMaterial = new THREE.MeshStandardMaterial({
    name: 'plinthAccent',
    color: new THREE.Color('#c8102e'),
    emissive: new THREE.Color('#3a0710'),
    emissiveIntensity: 0.5,
    roughness: 0.5,
    metalness: 0.1,
  });
  const bodyMaterial = new THREE.MeshStandardMaterial({
    name: 'plinthBody', color: new THREE.Color('#16181b'), roughness: 0.92, metalness: 0.08,
  });
  const footMaterial = new THREE.MeshStandardMaterial({
    name: 'plinthBase', color: new THREE.Color('#2a2d32'), roughness: 0.86, metalness: 0.12,
  });

  // 台面板
  group.add(plinthSlab(width, depth, radius, topY, topHeight, topMaterial));

  // 红嵌线
  const accentTopY = topY - topHeight;
  group.add(plinthSlab(
    width - accentInset * 2, depth - accentInset * 2, radius - accentInset,
    accentTopY, accentHeight, accentMaterial,
  ));

  // 内缩主体
  const bodyTopY = accentTopY - accentHeight;
  group.add(plinthSlab(
    width - bodyInset * 2, depth - bodyInset * 2, radius - bodyInset,
    bodyTopY, bodyHeight, bodyMaterial,
  ));

  // 外扩台脚
  const footTopY = bodyTopY - bodyHeight;
  group.add(plinthSlab(
    width - footInset * 2, depth - footInset * 2, radius - footInset,
    footTopY, footHeight, footMaterial,
  ));

  // 铭牌挂在主体正面（+Z，默认东南鸟瞰机位正对的一侧）
  const labelTexture = makePlinthLabel();
  if (labelTexture) {
    const bodyDepth = depth - bodyInset * 2;
    const labelWidth = Math.min(52, bodyDepth * 0.24);
    const labelHeight = labelWidth * 0.125;
    const labelMaterial = new THREE.MeshBasicMaterial({
      map: labelTexture,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      toneMapped: false,
      name: 'plinthLabel',
    });
    const label = new THREE.Mesh(new THREE.PlaneGeometry(labelWidth, labelHeight), labelMaterial);
    label.name = 'plinthLabel';
    label.position.set(0, bodyTopY - bodyHeight * 0.5, bodyDepth * 0.5 + 0.08);
    group.add(label);
    group.userData.label = label;
  }

  group.position.set(center.x, 0, center.z);
  group.userData.size = {
    width, depth, height: topHeight + accentHeight + bodyHeight + footHeight,
  };
  return group;
}

/* ===========================================================================
 * 6. 主入口
 * ======================================================================== */

export async function buildStadium(options = {}) {
  const startedAt = performance.now();
  const withSeats = options.seats !== false;

  setBootStatus('载入老特拉福德实测模型…');
  const gltf = await loadModel();
  const source = gltf.scene;

  // Blender 默认立方体（根节点 `Cube`，2×2×2 站在原点）是导出残留，必须剔除
  const strayCube = source.getObjectByName('Cube');
  if (strayCube) strayCube.removeFromParent();

  setBootStatus('标定模型朝向与场地标高…');

  const root = new THREE.Group();
  root.name = 'oldTrafford';

  // 四个看台组 + 场地组 + 周边配景组（顺序与 STAND_ORDER 一致）
  const standGroups = {};
  for (const key of STAND_ORDER) {
    const group = new THREE.Group();
    group.name = STAND_PART_KEY[key];
    root.add(group);
    standGroups[key] = group;
  }
  const contextGroup = new THREE.Group();
  contextGroup.name = 'context';
  root.add(contextGroup);
  const siteGroup = new THREE.Group();
  siteGroup.name = 'site';
  root.add(siteGroup);

  // 临时变换链：root(单位阵) → yaw(朝向) → align(平移/落地) → gltf.scene
  // 每块网格的 matrixWorld 就此烘成应用世界坐标，切片时直接沿用。
  const yawGroup = new THREE.Group();
  yawGroup.rotation.y = THREE.MathUtils.degToRad(MODEL_YAW_DEG);
  const alignGroup = new THREE.Group();
  alignGroup.position.set(-MODEL_PITCH_CENTER.x, -MODEL_PITCH_TOP_Y, -MODEL_PITCH_CENTER.z);
  alignGroup.add(source);
  yawGroup.add(alignGroup);
  root.add(yawGroup);
  root.updateMatrixWorld(true);

  setBootStatus('按象限拆分四座看台…');
  const report = splitByStand(source, standGroups, contextGroup, siteGroup);

  // 变换已烘进各网格，临时链可以摘掉（source 此时已被搬空）
  root.remove(yawGroup);

  /* ---- 展览台座：模型坐上去，台面略低于模型自带地坪 ---- */
  setBootStatus('砌筑展览台座…');
  const modelBox = new THREE.Box3().setFromObject(root);
  const plinth = createPlinth(modelBox);
  root.add(plinth);

  /* ---- 阵容站位人形（默认隐藏，仅阵容机位显示；先找西端球门再整体对齐） ---- */
  const pitchFrame = findPitchFrame(root);
  const { group: lineupGroup, parts: lineupParts, frame: lineupFrame } = createLineup(pitchFrame);
  root.add(lineupGroup);

  /* ---- 地面：台座之外再铺一张大地面，让雾把远处边缘吃掉，
         避免整座球场像浮在空中 ---- */
  const plinthHeight = plinth.userData.size?.height ?? 6;
  const groundY = PLINTH_TOP_Y - plinthHeight - 0.06;
  const groundGeometry = new THREE.PlaneGeometry(12000, 12000);
  groundGeometry.rotateX(-Math.PI / 2);
  const groundMaterial = new THREE.MeshStandardMaterial({
    name: 'ground',
    color: new THREE.Color('#232720'),
    roughness: 1,
    metalness: 0,
  });
  const ground = new THREE.Mesh(groundGeometry, groundMaterial);
  ground.name = 'groundPlane';
  ground.position.y = groundY;
  ground.receiveShadow = true;
  root.add(ground);

  /* ---- 光灯塔代理：app.js 只用它的 Box3 取位置，几何不可见 ---- */
  const floodlights = [];
  const floodlightGeometry = new THREE.BoxGeometry(6, 6, 6);
  const floodlightMaterial = new THREE.MeshBasicMaterial({ name: 'floodlightProxy' });
  for (const [x, y, z] of FLOODLIGHT_ANCHORS) {
    const proxy = new THREE.Mesh(floodlightGeometry, floodlightMaterial);
    proxy.name = 'floodlight';
    proxy.position.set(x, y, z);
    proxy.visible = false;          // 不参与渲染，但 Box3.setFromObject 仍会取到
    root.add(proxy);
    floodlights.push(proxy);
  }

  /* ---- 屋盖材质默认按“可透明”准备，后面只改 opacity，避免反复重编译 ---- */
  for (const material of report.roofMaterials) {
    material.transparent = true;
    material.depthWrite = true;
    material.needsUpdate = true;
  }

  /* ---- 参与剖切的材质（地面除外，免得剖切时脚下漏空） ---- */
  const clippingMaterials = [...report.materials].filter((material) => material !== groundMaterial);

  /* ---- 状态 ---- */
  let seatMode = 'natural';
  let nightOn = false;
  let sectionOn = false;

  function applySeatMode(mode) {
    seatMode = SEAT_MODES[mode] ? mode : 'natural';
    const tint = SEAT_MODES[seatMode];
    const tintColor = new THREE.Color();
    for (const key of STAND_ORDER) {
      const materials = report.seatMaterialsByStand.get(key);
      if (!materials) continue;
      let color = '#ffffff';
      if (typeof tint === 'string') color = tint;
      else if (tint && typeof tint === 'object' && tint[key]) color = tint[key];
      tintColor.setStyle(color);
      for (const material of materials) {
        const base = material.userData.baseColor ?? material.color;
        material.color.copy(base).multiply(tintColor);
      }
    }
  }

  function setNight(on) {
    nightOn = Boolean(on);
    for (const material of report.nightMaterials) {
      let dirty = false;
      if (!material.emissiveMap && material.map) {
        material.emissiveMap = material.map;
        dirty = true;
      }
      if (!material.emissiveMap) continue;
      material.emissive.setStyle('#fff4e6');
      material.emissiveIntensity = nightOn ? 0.55 : 0;
      if (dirty) material.needsUpdate = true;
    }
  }

  function setSection(on) {
    sectionOn = Boolean(on);
    for (const material of clippingMaterials) {
      material.clippingPlanes = sectionOn ? [SECTION_PLANE] : null;
      material.needsUpdate = true;
    }
  }

  function setRoofOpacity(value) {
    const opacity = clamp01(value);
    for (const material of report.roofMaterials) {
      material.opacity = opacity;
      const transparent = opacity < 0.995;
      if (material.transparent !== transparent) {
        material.transparent = transparent;
        material.needsUpdate = true;
      }
      material.depthWrite = !transparent;
    }
  }

  function setContextVisible(on) {
    contextGroup.visible = Boolean(on);
  }

  function setLineupVisible(on) {
    lineupGroup.visible = Boolean(on);
  }

  function setExplode(value) {
    const amount = clamp01(value);
    for (const key of STAND_ORDER) {
      const group = standGroups[key];
      if (!group) continue;
      group.position.copy(EXPLODE_DIR[key]).multiplyScalar(amount * EXPLODE_DISTANCE);
    }
  }

  const bounds = new THREE.Box3().setFromObject(root);
  const tierCount = STAND_ORDER.reduce((sum, key) => sum + (STANDS[key]?.tiers?.length ?? 0), 0);
  const seatCount = report.deckPlanArea > 0
    ? Math.round(report.deckPlanArea / SEAT_AREA_PER_SEAT / 100) * 100
    : 0;

  const stats = {
    seats: seatCount,
    triangles: report.triangles,
    buildMs: performance.now() - startedAt,
    standCount: STAND_ORDER.length,
    tierCount,
    pieces: report.pieceCount,
    deckPlanArea: Math.round(report.deckPlanArea),
    seatSource: '看台台面水平投影面积估算',
  };

  // parts 的键名必须与 app.js 的 STAND_PART_KEY 完全一致（standNorth 等）
  const parts = { context: contextGroup, site: siteGroup, ground, plinth, floodlights, lineup: lineupGroup };
  for (const key of STAND_ORDER) parts[STAND_PART_KEY[key]] = standGroups[key];

  function dispose() {
    const geometries = new Set();
    const materials = new Set();
    const attributes = new Set();
    root.traverse((object) => {
      if (!object.isMesh) return;
      if (object.geometry) {
        geometries.add(object.geometry.index);
        for (const attribute of Object.values(object.geometry.attributes)) attributes.add(attribute);
        geometries.add(object.geometry);
      }
      if (Array.isArray(object.material)) object.material.forEach((item) => materials.add(item));
      else if (object.material) materials.add(object.material);
    });
    for (const geometry of geometries) geometry?.dispose?.();
    for (const attribute of attributes) attribute?.dispose?.();
    for (const material of materials) {
      for (const value of Object.values(material)) {
        if (value && value.isTexture) value.dispose();
      }
      material.dispose?.();
    }
    root.removeFromParent();
  }

  applySeatMode(withSeats ? 'natural' : 'off');
  setExplode(0);
  setRoofOpacity(1);
  setSection(false);
  setContextVisible(options.context !== false);
  setLineupVisible(false);

  setBootStatus('老特拉福德就绪');

  return {
    root,
    parts,
    bounds,
    stats,
    seatCount: stats.seats,
    lineupParts,
    pitchFrame,          // 实测球场基准（两端球门量得：中心 / 长轴角 / 长度）
    lineupFrame,         // 阵容组的变换（局部草坪坐标 → 世界坐标）
    getSeatMode: () => seatMode,
    setSeatMode: applySeatMode,
    setNight,
    setSection,
    setRoofOpacity,
    setContextVisible,
    setLineupVisible,
    setExplode,
    dispose,
  };
}

export default buildStadium;
