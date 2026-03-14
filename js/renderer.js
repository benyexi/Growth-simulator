/**
 * renderer.js
 * 等轴测林分可视化 + 平均标准木面板
 * 基于论文表4-4-7形态参数（枝角77°，层距1.7m，冠高比0.20）
 *
 * 对外接口：
 *   mkGrid()           → GridCell[]
 *   drawStand(...)     → void  （内部调用 drawMeanTree）
 */

import { NR, NC, SI_BASE, SLOW_H, SLOW_D, MODES } from './constants.js';
import { growthH } from './growth_model.js';

// ── 伪随机数生成器（种子固定，保证每次网格相同）─────────────────
function prng(seed) {
  let x = seed >>> 0;
  return () => {
    x = (Math.imul(1664525, x) + 1013904223) >>> 0;
    return x / 4294967295;
  };
}

// ── 网格初始化 ────────────────────────────────────────────────────

/**
 * 生成 NR×NC 网格，每个格子带随机抖动和大小变化因子。
 * @returns {GridCell[]}  {row, col, jx, jy, sv, id}
 */
export function mkGrid() {
  const rand = prng(77);
  const grid = [];
  for (let row = 0; row < NR; row++) {
    for (let col = 0; col < NC; col++) {
      grid.push({
        row, col,
        jx: (rand() - 0.5) * 0.14,   // 水平抖动
        jy: (rand() - 0.5) * 0.14,   // 垂直抖动
        sv: 0.86 + rand() * 0.28,    // 个体大小变异
        id: row * NC + col,
      });
    }
  }
  return grid;
}

// ── 等轴测单树绘制（林分视图用）──────────────────────────────────
function isoTree(ctx, x, gy, tH, tileW, state, dbhFrac) {
  if (state === 'stump') {
    const sw = Math.max(2, tileW * 0.16);
    const sh = Math.max(3, tH * 0.07);
    ctx.fillStyle = '#9e7a50';
    ctx.fillRect(x - sw / 2, gy - sh, sw, sh);
    ctx.strokeStyle = 'rgba(55,35,18,.28)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.ellipse(x, gy - sh, sw * 0.76, sw * 0.28, 0, 0, Math.PI * 2);
    ctx.stroke();
    return;
  }

  const dying = state === 'cut';
  const tw = Math.max(1.5, tH * 0.020);

  // 主干
  ctx.fillStyle = dying ? '#c0a870' : '#e0dace';
  ctx.fillRect(x - tw / 2, gy - tH, tw, tH);

  // 树皮纹理
  if (!dying && tH > 10) {
    ctx.strokeStyle = 'rgba(85,68,42,.14)';
    ctx.lineWidth = 0.38;
    const nl = Math.max(2, Math.floor(tH / 9));
    for (let i = 1; i <= nl; i++) {
      const ly = gy - tH * i / (nl + 1);
      ctx.beginPath();
      ctx.moveTo(x - tw * 0.3, ly);
      ctx.lineTo(x + tw * 0.3, ly);
      ctx.stroke();
    }
  }

  // 树冠
  const crownHalfW = Math.min(tileW * 1.35, tH * 0.21) * Math.max(0.12, dbhFrac);
  const ctop = gy - tH * 0.96;
  const cbot = gy - tH * 0.20;
  const cHpx = cbot - ctop;
  const nb = Math.max(4, Math.min(14, Math.round(cHpx / (tH / Math.max(7, cHpx / 3.5)))));
  const ls = cHpx / (nb - 1);

  for (let b = 0; b < nb; b++) {
    const fr = b / (nb - 1);
    const by = ctop + cHpx * fr;
    const wp = fr < 0.35 ? 0.18 + (fr / 0.35) * 0.82 : 1 - ((fr - 0.35) / 0.65) * 0.50;
    const rx = crownHalfW * wp;
    const ry = Math.max(ls * 0.48, rx * 0.13);
    const gv = dying ? 110 + Math.round(fr * 14) : 78 + Math.round(fr * 46);
    const rv = dying ? 100 + Math.round(fr * 18) : 17  + Math.round(fr * 32);

    ctx.fillStyle = `rgba(${rv},${gv},${7 + Math.round(fr * 4)},.92)`;
    ctx.beginPath();
    ctx.ellipse(x, by, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = `rgba(${rv - 6},${gv - 20},5,.20)`;
    ctx.lineWidth = 0.3;
    ctx.stroke();

    // 侧枝
    if (!dying && rx > 4) {
      ctx.strokeStyle = `rgba(${62 + Math.round(fr * 18)},${48 + Math.round(fr * 12)},${30 + Math.round(fr * 8)},.28)`;
      ctx.lineWidth = Math.max(0.4, tw * 0.11);
      ctx.beginPath(); ctx.moveTo(x, by); ctx.lineTo(x - rx * 0.86, by + rx * 0.05); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x, by); ctx.lineTo(x + rx * 0.86, by + rx * 0.05); ctx.stroke();
    }
  }
}

// ── 详细单树绘制（平均标准木面板用）──────────────────────────────
function detailTree(ctx, x, gy, tH, dbhFrac) {
  const crownHalfW = tH * 0.21 * Math.max(0.12, dbhFrac);
  const tw = Math.max(4, tH * 0.022);

  // 主干
  ctx.fillStyle = '#e2ddd0';
  ctx.fillRect(x - tw / 2, gy - tH, tw, tH);

  // 树皮纹理
  ctx.strokeStyle = 'rgba(85,65,40,.15)';
  ctx.lineWidth = 0.65;
  const nLines = Math.floor(tH / 14);
  for (let i = 1; i <= nLines; i++) {
    const y  = gy - tH * i / (nLines + 1);
    const lw = tw * (0.22 + Math.random() * 0.24);
    ctx.beginPath(); ctx.moveTo(x - lw, y); ctx.lineTo(x + lw, y); ctx.stroke();
  }

  // 树冠（分层椭圆）
  const ctop = gy - tH * 0.95;
  const cbot = gy - tH * 0.18;
  const cH   = cbot - ctop;
  const nb   = Math.max(5, Math.min(14, Math.round(tH / 16)));
  const ls   = cH / (nb - 1);

  for (let b = 0; b < nb; b++) {
    const fr = b / (nb - 1);
    const by = ctop + cH * fr;
    const wp = fr < 0.35 ? 0.16 + (fr / 0.35) * 0.84 : 1 - ((fr - 0.35) / 0.65) * 0.52;
    const rx = crownHalfW * wp;
    const ry = Math.max(ls * 0.46, rx * 0.12);

    // 枝条
    ctx.strokeStyle = `rgba(${60 + Math.round(fr * 22)},${46 + Math.round(fr * 14)},${30 + Math.round(fr * 8)},.30)`;
    ctx.lineWidth = Math.max(0.6, tw * 0.11 * (1 - fr * 0.2));
    const bl = rx * 0.84;
    ctx.beginPath(); ctx.moveTo(x, by); ctx.lineTo(x - bl, by + bl * 0.10); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x, by); ctx.lineTo(x + bl, by + bl * 0.10); ctx.stroke();

    // 叶层
    const gv = 84 + Math.round(fr * 44);
    const rv = 18 + Math.round(fr * 30);
    ctx.fillStyle = `rgba(${rv},${gv},${10 + Math.round(fr * 6)},.90)`;
    ctx.beginPath(); ctx.ellipse(x, by, rx, ry, 0, 0, Math.PI * 2); ctx.fill();

    // 叶片纹理
    const nlf = Math.round(rx / 9);
    for (let li = 0; li < nlf; li++) {
      const lx = x  + (Math.random() - 0.5) * rx * 1.18;
      const ly = by + (Math.random() - 0.5) * ry * 1.1;
      if ((lx - x) ** 2 / rx ** 2 + (ly - by) ** 2 / ry ** 2 > 0.88) continue;
      ctx.fillStyle = `rgba(${rv - 4},${gv - 14},8,.34)`;
      ctx.beginPath();
      ctx.ellipse(lx, ly, rx * 0.09, rx * 0.05, Math.random() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.strokeStyle = `rgba(${rv + 14},${gv + 10},12,.15)`;
    ctx.lineWidth = 0.28;
    ctx.beginPath(); ctx.ellipse(x, by, rx, ry, 0, 0, Math.PI * 2); ctx.stroke();
  }
}

// ── 平均标准木面板 ────────────────────────────────────────────────

/**
 * 在右侧 140×300px 画布上绘制平均标准木。
 * @param {StandRecord} data     当前年数据
 * @param {object}      variety  品种对象
 * @param {number}      SI       立地指数
 * @param {number}      rotLen   轮伐期
 */
function drawMeanTree(data, variety, SI, rotLen) {
  const cv  = document.getElementById('cvT');
  const W = 140, H = 300;
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');

  ctx.fillStyle = '#f7f6f2';
  ctx.fillRect(0, 0, W, H);

  const siScale = SI / SI_BASE;
  const maxH  = growthH(rotLen, variety.H, siScale, SLOW_H) * 1.02;
  const ppm   = (H * 0.78) / Math.max(maxH, 1);
  const tH    = Math.max(10, data.h * ppm);
  const gy    = H - 14;
  const xc    = W / 2 - 10;
  const bx    = W - 11;
  const dbhFrac = Math.min(1, data.dbh / (variety.D.K * siScale * 1.2));

  // 高度刻度线
  ctx.strokeStyle = 'rgba(100,100,100,.18)';
  ctx.lineWidth = 0.7;
  ctx.setLineDash([2, 3]);
  ctx.beginPath(); ctx.moveTo(bx, gy - tH); ctx.lineTo(bx, gy); ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = 'rgba(55,55,55,.55)';
  ctx.font = '9px sans-serif';
  ctx.textAlign = 'right';
  for (let i = 0; i <= 4; i++) {
    const fr = i / 4;
    const y  = gy - tH * fr;
    ctx.strokeStyle = 'rgba(100,100,100,.25)';
    ctx.lineWidth = 0.45;
    ctx.beginPath(); ctx.moveTo(bx - 3, y); ctx.lineTo(bx + 3, y); ctx.stroke();
    ctx.fillText((data.h * fr).toFixed(0) + 'm', bx - 3, y + 3);
  }
  ctx.textAlign = 'left';

  detailTree(ctx, xc, gy, tH, dbhFrac);

  // 胸径位置标线（1.3 m）
  const bhy  = gy - 1.3 * ppm;
  const tw2  = Math.max(2.5, tH * 0.022);
  ctx.strokeStyle = 'rgba(182,40,12,.62)';
  ctx.lineWidth = 1.1;
  ctx.setLineDash([3, 2]);
  ctx.beginPath(); ctx.moveTo(xc - tw2 * 3, bhy); ctx.lineTo(xc + tw2 * 3, bhy); ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = 'rgba(170,34,10,.76)';
  ctx.font = 'bold 9px sans-serif';
  ctx.fillText('DBH', xc + tw2 * 3 + 2, bhy + 3);

  // 年份标题
  ctx.fillStyle = 'rgba(34,34,34,.55)';
  ctx.font = '500 10px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Year ' + data.t, W / 2, 11);
  ctx.textAlign = 'left';

  // 文字指标
  document.getElementById('tSt').textContent =
    'H̄ ' + data.h.toFixed(1) + ' m\n' +
    'D̄ ' + data.dbh.toFixed(1) + ' cm\n' +
    'V̄ ' + (data.vi * 1000).toFixed(1) + ' dm³';
}

// ── 等轴测林分主视图 ──────────────────────────────────────────────

/**
 * 绘制 12×12 等轴测林分 + 右侧标准木面板。
 *
 * @param {number}               yr       当前林龄
 * @param {StandRecord[]}        simT     含间伐的模拟结果
 * @param {Map}                  states   getStates() 返回的树木状态 Map
 * @param {object}               variety  品种对象
 * @param {number}               SI       立地指数
 * @param {number}               rotLen   轮伐期
 * @param {Array}                sched    间伐方案
 * @param {GridCell[]}           grd      mkGrid() 返回的网格
 */
export function drawStand(yr, simT, states, variety, SI, rotLen, sched, grd) {
  const cvEl = document.getElementById('cvS');
  const W = cvEl.parentElement.clientWidth || 520;
  const H = Math.round(W * 0.72);
  cvEl.width = W; cvEl.height = H;
  const ctx = cvEl.getContext('2d');

  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, W, H);

  const data = simT[yr - 1] || simT[simT.length - 1];
  const siScale = SI / SI_BASE;
  const dbhMax  = variety.D.K * siScale + SLOW_D * (rotLen - variety.D.a / variety.D.b);
  const dbhFrac = Math.min(1, Math.max(0.08, data.dbh / dbhMax));

  // 等轴测瓦片参数
  const LH  = 46;
  const mg  = 0.04;
  const avW = W * (1 - 2 * mg);
  const avH = H - LH - H * mg;
  const tW  = Math.min(avW / (NR + NC), avH / ((NR + NC) * 0.5));
  const tH  = tW * 0.5;
  const ox  = W / 2;
  const oy  = LH + (avH - (NR + NC) * tH) / 2;

  // 等轴测坐标转换
  function iso(c, r) {
    return { x: ox + (c - r) * tW, y: oy + (c + r) * tH };
  }

  // 绘制地面菱形瓦片
  for (let r = 0; r < NR; r++) {
    for (let c = 0; c < NC; c++) {
      const { x, y } = iso(c, r);
      ctx.fillStyle = (r + c) % 2 === 0 ? '#D4A843' : '#C49020';
      ctx.beginPath();
      ctx.moveTo(x, y - tH); ctx.lineTo(x + tW, y);
      ctx.lineTo(x, y + tH); ctx.lineTo(x - tW, y);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,.018)';
      ctx.lineWidth = 0.4;
      ctx.stroke();
    }
  }

  // 树高映射到像素（0–28m → tH*0.55 – tH*5.0）
  const hf     = Math.min(1, data.h / 28);
  const baseTH = tH * 0.55 + (tH * 5.0 - tH * 0.55) * hf;

  // 按等轴测深度排序后绘制（画家算法）
  const sorted = [...grd].sort((a, b) => (a.row + a.col) - (b.row + b.col));
  for (const cell of sorted) {
    const { row: r, col: c, jx, jy, sv, id } = cell;
    const st  = states.get(id) || 'live';
    const { x, y } = iso(c + jx, r + jy);
    const gy  = y + tH * 0.04;
    const ps  = 0.48 + (r + c) / ((NR + NC - 2)) * 0.52;  // 透视大小衰减
    isoTree(ctx, x, gy, baseTH * sv * ps, tW * sv * ps, st, dbhFrac);
  }

  // 标题文字
  ctx.fillStyle = 'rgba(20,20,20,.68)';
  ctx.font = `500 ${Math.round(W * 0.016)}px sans-serif`;
  const thinLabel = sched
    .filter(e => yr >= e.yr)
    .map((e, i) => `T${i + 1}(Yr${e.yr})`)
    .join(' ');
  const title = `${variety.name}人工林  Year ${yr}${thinLabel ? ' — ' + thinLabel : ''}`;
  ctx.fillText(title, W / 2 - ctx.measureText(title).width / 2, 18);

  // 当年间伐提示
  const evNow = sched.filter(e => e.yr === yr);
  if (evNow.length) {
    ctx.fillStyle = 'rgba(165,30,10,.78)';
    ctx.font = `500 ${Math.round(W * 0.013)}px sans-serif`;
    const m = `第${sched.indexOf(evNow[0]) + 1}次间伐 — ${MODES[evNow[0].mode].lb}（${Math.round(MODES[evNow[0].mode].f * 100)}%）`;
    ctx.fillText(m, W / 2 - ctx.measureText(m).width / 2, 33);
  }

  // 同步刷新平均标准木面板
  drawMeanTree(data, variety, SI, rotLen);
}
