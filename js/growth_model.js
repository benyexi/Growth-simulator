/**
 * growth_model.js
 * Logistic 生长模型（姜岳忠2006博士论文表4-2-5参数）
 * + 后期线性慢速生长补偿
 *
 * 对外接口：runSim(N0, SI, sched, rotLen, varietyIdx) → StandRecord[]
 * 后续替换为 3-PG 时只需提供相同签名的 runSim，其余模块无需改动。
 */

import { VARIETIES, MODES, SI_BASE, N_REF, SLOW_D, SLOW_H } from './constants.js';

// ── 单木生长函数 ──────────────────────────────────────────────────

/**
 * 胸径生长（Logistic + 后期线性补偿）
 * @param {number} t        林龄（年）
 * @param {object} p        品种 D 参数 {a, b, K}
 * @param {number} siScale  立地指数比例 SI/SI_BASE
 * @param {number} densCorr 密度修正系数
 * @param {number} slowRate 后期线性增量 (cm/yr)
 */
export function growthD(t, p, siScale, densCorr, slowRate) {
  const tInfl = p.a / p.b;
  const logVal = p.K * siScale / (1 + Math.exp(p.a - p.b * t));
  const linearExtra = Math.max(0, t - tInfl) * slowRate * densCorr;
  return (logVal + linearExtra) * densCorr;
}

/**
 * 树高生长（Logistic + 后期线性补偿）
 * @param {number} t        林龄（年）
 * @param {object} p        品种 H 参数 {a, b, K}
 * @param {number} siScale  立地指数比例 SI/SI_BASE
 * @param {number} slowRate 后期线性增量 (m/yr)
 */
export function growthH(t, p, siScale, slowRate) {
  const tInfl = p.a / p.b;
  const logVal = p.K * siScale / (1 + Math.exp(p.a - p.b * t));
  const linearExtra = Math.max(0, t - tInfl) * slowRate;
  return logVal + linearExtra;
}

/**
 * 单株材积（二元材积式）
 * @param {number} D 胸径 cm
 * @param {number} H 树高 m
 * @returns {number} 材积 m³
 */
export function vStem(D, H) {
  return 5.84e-5 * Math.pow(D, 1.952) * Math.pow(H, 0.876);
}

// ── 林分模拟主函数 ────────────────────────────────────────────────

/**
 * 逐年模拟林分生长
 * @param {number}   N0          初植密度（株/ha）
 * @param {number}   SI          立地指数（m，20年）
 * @param {Array}    sched       间伐方案 [{yr, mode}, ...]，空数组表示不间伐
 * @param {number}   rotLen      轮伐期（年）
 * @param {number}   varietyIdx  品种索引 0–3
 * @returns {StandRecord[]}      每年一条记录
 *
 * StandRecord: { t, N, dbh, h, ba, vol, mai, vi }
 */
export function runSim(N0, SI, sched, rotLen, varietyIdx) {
  const vr = VARIETIES[varietyIdx];
  const siScale = SI / SI_BASE;
  let N = N0;
  let releaseLag = 0;   // 间伐后释放效应剩余年数
  let prevD = 0;
  const res = [];

  for (let t = 1; t <= rotLen; t++) {
    const densCorr = Math.pow(N_REF / Math.max(N, 100), 0.28);

    let H = growthH(t, vr.H, siScale, SLOW_H);
    let D = growthD(t, vr.D, siScale, densCorr, SLOW_D);

    // 间伐后释放加速（简化：前2年额外20%增量）
    if (releaseLag > 0) {
      D = prevD + Math.max(0, D - prevD) * (1 + 0.20 * (releaseLag / 2));
      releaseLag--;
    }

    // 当年间伐事件
    if (sched) {
      const ev = sched.find(e => e.yr === t);
      if (ev) {
        N = Math.max(1, Math.round(N * (1 - MODES[ev.mode].f)));
        releaseLag = 2;
      }
    }

    const BA  = N * Math.PI / 4 * (D / 100) ** 2;
    const vi  = vStem(D, H);
    const Vol = N * vi;

    res.push({
      t,
      N:   Math.round(N),
      dbh: +D.toFixed(1),
      h:   +H.toFixed(1),
      ba:  +BA.toFixed(2),
      vol: +Vol.toFixed(1),
      mai: +(Vol / t).toFixed(2),
      vi,
    });

    prevD = D;
  }

  return res;
}
