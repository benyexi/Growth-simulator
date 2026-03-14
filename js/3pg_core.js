/**
 * 3pg_core.js
 * 3-PGmix 月步长过程模型引擎（三倍体毛白杨）
 *
 * 对外接口：
 *   runSim3PG(config) → StandRecord[]
 *   输出格式与 growth_model.js 的 runSim() 完全一致：
 *   [{t, N, dbh, h, ba, vol, mai, vi}]
 *
 * 参考：
 *   Landsberg & Waring, 1997; Forrester & Tang, 2016
 *   张萱, 2023 硕士论文（三倍体毛白杨参数化）
 */

import { SPECIES_PARAMS, MODEL_DEFAULTS, DAYS_IN_MONTH } from './3pg_params.js';
import { MODES } from './constants.js';

// ── 辅助函数 ──────────────────────────────────────────────────────

/** 饱和水汽压 (kPa) */
function eSat(T_C) {
  return 0.6108 * Math.exp(17.27 * T_C / (T_C + 237.3));
}

/** VPD 估算：日均 VPD ≈ esat(Tav) − esat(Tmin) */
function calcVPD(Tmax, Tmin) {
  const Tav = (Tmax + Tmin) / 2;
  return Math.max(0, eSat(Tav) - eSat(Tmin));
}

/** 霜冻天数（论文公式 2-7）*/
function calcFrostDays(Tmin) {
  if (Tmin < -9)  return 30;
  if (Tmin < 0)   return -2 * Tmin + 11.6;
  return 0;
}

// ── 环境修正因子 ──────────────────────────────────────────────────

/** 温度修正 fT（论文公式 3-4）*/
function fTemperature(Tav, Tmin, Topt, Tmax) {
  if (Tav <= Tmin || Tav >= Tmax) return 0;
  const a = (Tav - Tmin) / (Topt - Tmin);
  const b = (Tmax - Tav) / (Tmax - Topt);
  const exp = (Tmax - Topt) / (Topt - Tmin);
  return a * Math.pow(b, exp);
}

/** 霜冻修正 fF（论文公式 3-5）*/
function fFrost(frostDays, kF) {
  return Math.max(0, 1 - kF * (frostDays / 30));
}

/** 肥力修正 fN（论文公式 3-6）*/
function fNutrition(FR, fN0, nfN) {
  return 1 - (1 - fN0) * Math.pow(1 - FR, nfN);
}

/** 林龄修正 fAge（论文公式 3-7）*/
function fAgeFn(standAge, maxAge, rAge, nAge) {
  const relAge = standAge / maxAge;
  return 1 / (1 + Math.pow(relAge / rAge, nAge));
}

/** VPD 修正 fD（论文公式 3-8）*/
function fVPD(VPD, kD) {
  return Math.exp(-kD * VPD);
}

/** 土壤水分修正 fθ（论文公式 3-9）*/
function fSoilWater(ASW, maxASW, cTheta, nTheta) {
  if (maxASW <= 0) return 1;
  const relWater = ASW / maxASW;
  const relDeficit = 1 - relWater;
  return 1 / (1 + Math.pow(relDeficit / cTheta, nTheta));
}

/** CO2 修正 — 光合效率（论文公式 3-10）*/
function fCO2alpha(co2, fCalpha700) {
  return fCalpha700 * co2 / (350 * (fCalpha700 - 1) + co2);
}

/** CO2 修正 — 冠层导度（Sands 2004 公式 7）*/
function fCO2conductance(co2, fCg700) {
  return fCg700 / (2 * fCg700 - 1 + (1 - fCg700) * co2 / 350);
}

// ── Penman-Monteith 蒸腾计算 ──────────────────────────────────────

/**
 * 月蒸腾量 (mm/month)
 * @param {number} solarRad  日均太阳辐射 MJ/m²/day
 * @param {number} VPD       水汽压差 kPa
 * @param {number} Tav       月均温 °C
 * @param {number} gc        冠层导度 m/s
 * @param {number} days      该月天数
 */
function transpPM(solarRad, VPD, Tav, gc, days) {
  const LAMBDA = 2.46e6;    // J/kg 蒸发潜热
  const GAMMA  = 66;        // Pa/K 干湿表常数
  const RHO_CP = 1221;      // J/(m³·K)  空气 ρ×cp
  const GA     = 0.2;       // m/s 边界层导度

  // 净辐射 W/m²（总辐射 × 0.7 近似）
  const Rn = Math.max(0, solarRad * 0.7 * 1e6 / 86400);

  // 饱和水汽压曲线斜率 (Pa/K)
  const es    = 611 * Math.exp(17.27 * Tav / (Tav + 237.3));
  const delta = 4098 * es / (Tav + 237.3) ** 2;

  // VPD → Pa
  const VPD_Pa = VPD * 1000;

  if (gc < 1e-6) return 0;

  const num = delta * Rn + RHO_CP * VPD_Pa * GA;
  const den = LAMBDA * (delta + GAMMA * (1 + GA / gc));

  // mm/s → mm/day → mm/month
  return Math.max(0, (num / den) * 86400 * days);
}

// ── SLA 随林龄变化 ────────────────────────────────────────────────
function calcSLA(standAge, SLA0, SLA1, tSLA) {
  return SLA1 + (SLA0 - SLA1) * Math.exp(-Math.LN2 * standAge / tSLA);
}

// ── 叶凋落率随林龄变化 ────────────────────────────────────────────
function calcGammaF(standAge, gammaF0, gammaF1, tgammaF) {
  const tYr = tgammaF / 12;  // 转换为年
  return gammaF1 * gammaF0 /
    (gammaF0 + (gammaF1 - gammaF0) * Math.exp(-Math.LN2 * standAge / tYr));
}

// ── pFS（叶干分配比）随 DBH 变化 ──────────────────────────────────
function calcPFS(dbh, pFS2, pFS20) {
  if (dbh <= 0) return pFS2;
  const power = Math.log(pFS20 / pFS2) / Math.log(20 / 2);
  return pFS2 * Math.pow(Math.max(dbh, 0.1) / 2, power);
}

// ── 主模拟函数 ────────────────────────────────────────────────────

/**
 * @param {object} config
 *   N0:       初植密度 (stems/ha)
 *   rotLen:   轮伐期 (years)
 *   sched:    间伐方案 [{yr, mode}]
 *   FR:       肥力等级 (0-1)
 *   climate:  月气候 [{Tmax, Tmin, precip, solarRad, nRainDays}] ×12
 *   co2:      CO2 浓度 (ppm)
 *   maxASW:   最大有效土壤水 (mm)
 *   irrigAnn: 年灌溉量 (mm)，均分到4-8月
 *
 * @returns {StandRecord[]} 每年一条: {t, N, dbh, h, ba, vol, mai, vi}
 */
export function runSim3PG(config) {
  const sp = SPECIES_PARAMS;
  const md = MODEL_DEFAULTS;
  const {
    N0, rotLen, sched, FR, climate, co2, maxASW, irrigAnn,
  } = config;

  // ── 状态变量初始化 ──
  let N   = N0;
  let WF  = md.WF_init;          // 叶 tDM/ha
  let WS  = md.WS_init;          // 干 tDM/ha
  let WR  = md.WR_init;          // 根 tDM/ha
  let ASW = maxASW;              // 当前有效土壤水 mm
  let WF_pool = 0;               // 落叶树越冬叶库

  // 灌溉：年总量均分到 4-8 月（生长季灌溉）
  const irrMonths = [4, 5, 6, 7, 8];
  const irrPerMonth = irrigAnn / irrMonths.length;

  // 环境修正（与月无关的常数）
  const fN = fNutrition(FR, md.fN0, md.nfN);
  const m  = md.m0 + (1 - md.m0) * FR;  // 肥力对分配的影响

  const results = [];

  // ── 逐年循环 ──
  for (let yr = 1; yr <= rotLen; yr++) {
    const standAge = yr;  // 简化：以年为单位

    // 间伐：年初执行
    if (sched) {
      const ev = sched.find(e => e.yr === yr);
      if (ev) {
        const frac = MODES[ev.mode].f;
        N  = Math.max(1, Math.round(N * (1 - frac)));
        WF *= (1 - frac);
        WS *= (1 - frac);
        WR *= (1 - frac);
      }
    }

    // 林龄修正
    const fAge = fAgeFn(standAge, md.maxAge, md.rAge, md.nAge);

    // CO2 修正
    const fCa = fCO2alpha(co2, md.fCalpha700);
    const fCg = fCO2conductance(co2, md.fCg700);

    // SLA
    const SLA = calcSLA(standAge, sp.SLA0, sp.SLA1, sp.tSLA);

    // 叶凋落率
    const gammaF = calcGammaF(standAge, sp.gammaF0, sp.gammaF1, sp.tgammaF);

    // 当前 DBH (用于碳分配)
    let avDBH = 0;
    if (N > 0 && WS > 0) {
      const avWS_kg = WS / N * 1000;  // 单株干生物量 kg
      avDBH = Math.pow(avWS_kg / sp.aWS, 1 / sp.nWS);
    }

    // pFS (叶干比)
    const pFS = calcPFS(avDBH, sp.pFS2, sp.pFS20);

    // ── 逐月循环 ──
    for (let m_idx = 0; m_idx < 12; m_idx++) {
      const clim  = climate[m_idx];
      const days  = DAYS_IN_MONTH[m_idx];
      const month = m_idx + 1;
      const Tav   = (clim.Tmax + clim.Tmin) / 2;
      const VPD   = calcVPD(clim.Tmax, clim.Tmin);
      const frostD = calcFrostDays(clim.Tmin);

      // ── 落叶物候 ──
      // 叶存在期：leafgrow月底 ~ leaffall月初
      const hasLeaves = (month > sp.leafgrow && month < sp.leaffall);
      const isLeafOut = (month === sp.leafgrow);  // 展叶月：部分叶
      const isLeafFall = (month === sp.leaffall);

      // 春季展叶：从越冬叶库恢复
      if (isLeafOut && WF_pool > 0) {
        WF = WF_pool;
        WF_pool = 0;
      }

      // 秋季落叶：叶全部脱落
      if (isLeafFall) {
        WF_pool = WF;  // 记录备下年恢复
        WF = 0;
      }

      // 无叶期跳过光合
      if (!hasLeaves && !isLeafOut) {
        // 仅更新水分平衡（降水补充）
        const precip_net = clim.precip * 0.95;  // 无叶微截留
        const irr = irrMonths.includes(month) ? irrPerMonth : 0;
        // 冬季土壤蒸发很低
        const esoil = Math.max(0, Tav) * 0.1 * days * 0.03;  // 粗估
        ASW = Math.min(maxASW, Math.max(0, ASW + precip_net + irr - esoil));
        continue;
      }

      // ── LAI 计算 ──
      // LAI = WF(tDM/ha) × 1000(kg/tDM) × SLA(m²/kg) / 10000(m²/ha)
      const LAI = WF * SLA * 0.1;
      const LAI_eff = isLeafOut ? LAI * 0.5 : LAI;  // 展叶月折半

      // ── 光截获 (Beer-Lambert) ──
      const PAR     = clim.solarRad * 0.5 * days;      // MJ/m²/month (PAR ≈ 50% 总辐射)
      const fIPAR   = 1 - Math.exp(-sp.k * LAI_eff);   // 截获比例
      const APAR    = PAR * fIPAR;                      // 吸收 PAR MJ/m²/month

      // ── 环境修正因子 ──
      const fT  = fTemperature(Tav, sp.Tmin, sp.Topt, sp.Tmax);
      const fF  = fFrost(frostD, md.kF);
      const fD  = fVPD(VPD, md.kD);
      const fSW = fSoilWater(ASW, maxASW, md.cTheta, md.nTheta);

      // 综合光能利用效率（论文公式 3-2）
      const physMod = fT * fF * fN * Math.min(fD, fSW) * fAge * fCa;
      const alphaC  = sp.alphaCx * physMod;

      // ── GPP / NPP ──
      // GPP = αc × APAR  (单位转换: molC/molPAR × MJ → tDM/ha)
      // 1 MJ PAR ≈ 4.6 mol photons,  12 gC/molC, ×2 for DM/C, ÷1e6 g→t, ×10000 m²→ha
      const GPP_CONV = 4.6 * 12 * 2 * 0.01;  // ≈ 1.104
      const GPP = alphaC * APAR * GPP_CONV;   // tDM/ha/month
      const NPP = GPP * md.Y;

      // ── 碳分配（论文公式 3-12 ~ 3-15）──
      const phi  = Math.min(fD, fSW);
      const mPhi = m * phi;
      const etaR = (sp.pRx * sp.pRn) / (sp.pRn + (sp.pRx - sp.pRn) * Math.max(0.01, mPhi));
      const etaS = (1 - etaR) / (1 + pFS);
      const etaF = pFS * etaS;

      const dWF = etaF * NPP;
      const dWS = etaS * NPP;
      const dWR = etaR * NPP;

      // ── 凋落与周转 ──
      const litterF = gammaF * WF;
      const litterR = sp.gammaR * WR;

      // ── 更新生物量 ──
      WF = Math.max(0, WF + dWF - litterF);
      WS = Math.max(0, WS + dWS);
      WR = Math.max(0, WR + dWR - litterR);

      // ── 水分平衡 ──
      // 降雨截留
      const canopyCover = Math.min(1, LAI_eff / sp.LAImaxIntcptn);
      const interception = md.MaxIntcptn * canopyCover * clim.precip;
      const precip_net   = clim.precip - interception;

      // 灌溉
      const irr = irrMonths.includes(month) ? irrPerMonth : 0;

      // 冠层导度（论文公式 3-21）
      const gc = sp.MaxCond * fAge * fT * Math.min(fD, fSW) * fCg *
                 Math.min(1, LAI_eff / sp.LAIgcx);

      // Penman-Monteith 蒸腾
      const transp = transpPM(clim.solarRad, VPD, Tav, gc, days);

      // 土壤蒸发（简化：未覆盖地面的平衡蒸发）
      const es_slope = 4098 * eSat(Tav) / (Tav + 237.3) ** 2;
      const Eeq = (es_slope / (es_slope + 0.066)) *
                  (clim.solarRad * 0.7 / 2.46) * days;
      const esoil = Math.max(0, Eeq * 0.5 * (1 - canopyCover));

      // 更新 ASW
      ASW = ASW + precip_net + irr - transp - esoil;
      ASW = Math.max(0, Math.min(maxASW, ASW));

      // ── 自疏检测（3/2 幂法则）──
      if (N > 0 && WS > 0) {
        const avWS_kg = WS / N * 1000;
        const wSx = md.wSx1000 * Math.pow(1000 / N, md.thinPower);
        if (avWS_kg > wSx) {
          // 求 N_new 使 WS*1000/N_new = wSx1000*(1000/N_new)^thinPower
          const WS_kg_ha = WS * 1000;
          const N_new = Math.max(1, Math.round(
            Math.pow(WS_kg_ha / (md.wSx1000 * Math.pow(1000, md.thinPower)),
                     1 / (1 - md.thinPower))
          ));
          if (N_new < N) {
            const frac = N_new / N;
            WF *= frac;
            WR *= frac;
            N = N_new;
          }
        }
      }
    }  // end month loop

    // ── 年末：反算胸径/树高/材积 ──
    let dbh = 0, h = 0, vol_ha = 0, vi = 0;
    if (N > 0 && WS > 0) {
      const avWS_kg = WS / N * 1000;
      dbh = Math.pow(avWS_kg / sp.aWS, 1 / sp.nWS);
      h   = sp.aH * Math.pow(dbh, sp.nHB) * Math.pow(N, sp.nHC);
      vi  = sp.aV * Math.pow(dbh, sp.nVB) * Math.pow(h, sp.nVH);  // m³/tree
      vol_ha = vi * N;
    }
    const BA = N * Math.PI / 4 * (dbh / 100) ** 2;

    results.push({
      t:   yr,
      N:   Math.round(N),
      dbh: +dbh.toFixed(1),
      h:   +h.toFixed(1),
      ba:  +BA.toFixed(2),
      vol: +vol_ha.toFixed(1),
      mai: +(vol_ha / yr).toFixed(2),
      vi,
    });
  }  // end year loop

  return results;
}
