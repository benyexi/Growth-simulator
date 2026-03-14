/**
 * 3pg_params.js
 * 三倍体毛白杨 3-PGmix 模型参数（张萱2023硕士论文 表3.1）
 * + 华北平原（高唐站）默认月气候数据
 */

// ── 树种生理参数（三倍体毛白杨 B301）─────────────────────────────
export const SPECIES_PARAMS = {
  // ── 生物量分配与转化 ──
  pFS2:    0.1,       // 叶干分配比 @ DBH=2cm
  pFS20:   0.053,     // 叶干分配比 @ DBH=20cm
  aWS:     0.0319,    // 干生物量-DBH 常数  (Ws = aWS × D^nWS, kg)
  nWS:     2.8303,    // 干生物量-DBH 幂指数
  pRx:     0.37,      // NPP→根 最大分配比
  pRn:     0.16,      // NPP→根 最小分配比
  gammaF1: 0.027,     // 叶最大凋落率 (1/month)
  gammaF0: 0.001,     // 叶初始凋落率 (1/month)
  tgammaF: 12,        // 叶凋落中值林龄 (months)
  gammaR:  0.02,      // 根月周转率 (1/month)

  // ── 落叶物候 ──
  leafgrow: 3,        // 展叶月 (3月底开始长叶)
  leaffall: 10,       // 落叶月 (10月初落叶)

  // ── 温度三基点 ──
  Tmin:  5,           // 光合最低温 (°C)
  Topt: 20,           // 光合最适温 (°C)
  Tmax: 40,           // 光合最高温 (°C)

  // ── 比叶面积 ──
  SLA0:  12.7,        // 幼龄 SLA (m²/kg)
  SLA1:  10.0,        // 成熟 SLA (m²/kg)
  tSLA:   1,          // SLA 中值林龄 (years)

  // ── 冠层结构 ──
  fullCanAge:     2.5, // 林分郁闭年龄 (years)
  LAImaxIntcptn:  3.97,// 最大降水截留对应 LAI
  alphaCx:        0.07,// 冠层量子效率 (molC/molPAR)
  k:              0.5, // 消光系数 (Beer-Lambert)
  MaxCond:        0.02,// 最大冠层导度 (m/s)
  LAIgcx:         3.5, // 最大导度对应 LAI

  // ── 枝皮比 ──
  fracBB0: 0.98,      // 初始枝皮占干比
  fracBB1: 0.38,      // 成熟枝皮占干比

  // ── 木材密度 ──
  rhoMin: 0.354,      // 幼龄密度 (t/m³)
  rhoMax: 0.354,      // 成熟密度 (t/m³)
  tRho:   1,          // 密度中值林龄 (years)

  // ── 异速生长关系 ──
  aH:  0.9706,        // 树高常数   H = aH × D^nHB × N^nHC
  nHB: 1.0216,        // 树高-DBH 幂
  nHC: 0,             // 树高-密度 幂
  aV:  0.000085,      // 材积常数   V = aV × D^nVB × H^nVH
  nVB: 1.742,         // 材积-DBH 幂
  nVH: 0.8534,        // 材积-H 幂

  // ── 树冠几何 ──
  crownshape: 2,      // 冠形 (2=椭球)
  aK:   1.934,        // 冠幅常数
  nKB:  0.4952,       // 冠幅-DBH 幂
  nKH: -0.23,         // 冠幅-H 幂
};

// ── 模型默认参数（论文未明确列出，使用 3-PG 标准默认值）──────
export const MODEL_DEFAULTS = {
  Y:         0.47,    // NPP/GPP 碳利用效率
  kF:        1.0,     // 霜冻导致停止生长天数系数
  kD:        0.05,    // VPD 响应系数 (1/kPa)
  fN0:       0.5,     // FR=0 时肥力因子值
  nfN:       1.0,     // 肥力幂指数
  m0:        0.0,     // 肥力对分配影响 (m = m0 + (1-m0)×FR)
  wSx1000:   300,     // 自疏最大单株生物量 @1000株/ha (kg)
  thinPower: 1.5,     // 自疏幂 (3/2 法则)
  gammaN:    0.0,     // 非密度死亡率 (/year)
  MaxIntcptn: 0.15,   // 最大降雨截留率
  BLcond:    0.2,     // 边界层导度 (m/s)

  // 林龄效应
  nAge:  4,           // 林龄影响指数
  rAge:  0.95,        // fAge=0.5 时的相对林龄
  maxAge: 50,         // 最大生理寿命 (years)

  // CO2 响应
  fCalpha700: 1.4,    // CO2=700ppm 时光合增效
  fCg700:     0.7,    // CO2=700ppm 时导度降低

  // 土壤水分（砂壤土, 论文3.1.4节）
  cTheta: 0.6,        // 50%缺水时相对含水量
  nTheta: 7,          // 水分减少影响指数

  // 初始生物量（1年生根萌苗）
  WF_init: 0.01,      // 叶初始生物量 (tDM/ha)
  WS_init: 0.01,      // 干初始生物量 (tDM/ha)
  WR_init: 0.01,      // 根初始生物量 (tDM/ha)
};

// ── 用途预设 ─────────────────────────────────────────────────────
export const USE_TYPES = {
  pulp: {
    name: '纸浆林 (短轮伐)',
    defaultN0:  1666,
    defaultRot: 5,
    minRot:     3,
    maxRot:     12,
    defaultIrr: 0,      // 默认灌溉量 mm/year
    defaultFR:  0.7,     // 默认肥力
  },
  saw: {
    name: '锯材林 (长轮伐)',
    defaultN0:  833,
    defaultRot: 20,
    minRot:     10,
    maxRot:     30,
    defaultIrr: 0,
    defaultFR:  0.6,
  },
};

// ── 华北平原（高唐站 36°58′N）典型月气候数据 ───────────────────
// 年均温 13.2°C, 年降水 563mm (论文 2.1 节)
export const DEFAULT_CLIMATE = [
  // { month, Tmax, Tmin, precip, solarRad, nRainDays }
  //   Tmax/Tmin: °C,  precip: mm,  solarRad: MJ/m²/day,  nRainDays: days
  { month:  1, Tmax:  2, Tmin: -8, precip:   5, solarRad:  8.5, nRainDays: 2 },
  { month:  2, Tmax:  6, Tmin: -4, precip:   8, solarRad: 10.5, nRainDays: 3 },
  { month:  3, Tmax: 13, Tmin:  1, precip:  15, solarRad: 14.0, nRainDays: 4 },
  { month:  4, Tmax: 21, Tmin:  8, precip:  25, solarRad: 18.0, nRainDays: 5 },
  { month:  5, Tmax: 27, Tmin: 14, precip:  35, solarRad: 21.0, nRainDays: 6 },
  { month:  6, Tmax: 32, Tmin: 20, precip:  65, solarRad: 22.0, nRainDays: 8 },
  { month:  7, Tmax: 32, Tmin: 23, precip: 180, solarRad: 19.0, nRainDays: 13 },
  { month:  8, Tmax: 31, Tmin: 22, precip: 140, solarRad: 18.0, nRainDays: 11 },
  { month:  9, Tmax: 27, Tmin: 15, precip:  50, solarRad: 15.5, nRainDays: 7 },
  { month: 10, Tmax: 20, Tmin:  8, precip:  25, solarRad: 12.5, nRainDays: 5 },
  { month: 11, Tmax: 11, Tmin:  0, precip:  12, solarRad:  9.0, nRainDays: 3 },
  { month: 12, Tmax:  4, Tmin: -6, precip:   5, solarRad:  7.5, nRainDays: 2 },
];

// 每月天数
export const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
