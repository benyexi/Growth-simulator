/**
 * ui.js
 * 应用状态管理 + 全部 DOM 操作与事件绑定。
 * 支持 Logistic / 3-PG 双模型切换。
 */

import { VARIETIES, MODES } from './constants.js';
import { runSim }              from './growth_model.js';
import { runSim3PG }           from './3pg_core.js';
import { USE_TYPES, DEFAULT_CLIMATE, SPECIES_PARAMS } from './3pg_params.js';
import { mkThinSets, getStates } from './thinning.js';
import { mkGrid, drawStand }  from './renderer.js';
import { drawChart }           from './chart_viz.js';

// ── 应用状态（单一可信来源）──────────────────────────────────────
const S = {
  simT:    [],               // 含间伐模拟序列
  sim0:    [],               // 无间伐基准序列
  grd:     [],               // 网格抖动数组
  sched:   [{ yr: 6, mode: 0 }],  // 间伐方案
  tSets:   [],               // 间伐树木集合
  curYr:   1,
  rotLen:  20,
  vKey:    'vol',
  tmr:     null,
  running: false,
  modelType: 'logistic',     // 'logistic' | '3pg'
  climate: JSON.parse(JSON.stringify(DEFAULT_CLIMATE)),  // 深拷贝
};

// ── DOM 读取辅助 ──────────────────────────────────────────────────
function getVarietyIdx() { return +document.getElementById('variety').value; }
function getVariety()    { return VARIETIES[getVarietyIdx()]; }
function getSI()         { return +document.getElementById('SI').value; }
function getN0()         { return +document.getElementById('N0').value; }
function is3PG()         { return S.modelType === '3pg'; }

// ── 3-PG 专用读取 ────────────────────────────────────────────────
function getFR()       { return +document.getElementById('FR').value; }
function getCO2()      { return +document.getElementById('co2').value; }
function getMaxASW()   { return +document.getElementById('maxASW').value; }
function getIrrig()    { return +document.getElementById('irrigAnn').value; }
function getUseType()  { return document.getElementById('useType').value; }

// ── 指标卡片刷新 ──────────────────────────────────────────────────
function updMetrics() {
  const d = S.simT[S.curYr - 1] || S.simT[S.simT.length - 1];
  document.getElementById('mRow').innerHTML = [
    ['密度 株/ha', 'N',   ''],
    ['胸径',       'dbh', 'cm'],
    ['树高',       'h',   'm'],
    ['断面积',     'ba',  'm²/ha'],
    ['蓄积量',     'vol', 'm³/ha'],
  ].map(([l, k, u]) =>
    `<div class="mc"><p class="ml">${l}</p>` +
    `<p class="mv">${d[k]}<span style="font-size:10px;font-weight:400;color:#999;margin-left:3px;">${u}</span></p></div>`
  ).join('');
}

// ── 品种速生期信息（仅 Logistic）──────────────────────────────────
function updVarInfo() {
  const el = document.getElementById('varInfo');
  if (is3PG()) {
    el.innerHTML = `<p style="font-size:11px;color:#999;margin:0;">三倍体毛白杨 B301 · 3-PG 过程模型</p>`;
    return;
  }
  const vr = getVariety();
  el.innerHTML =
    `<p style="font-size:11px;color:#999;margin:0;">速生期 — ` +
    `胸径Yr${vr.fgp.D.t1.toFixed(0)}–${vr.fgp.D.t2.toFixed(0)} | ` +
    `树高Yr${vr.fgp.H.t1.toFixed(0)}–${vr.fgp.H.t2.toFixed(0)} | ` +
    `材积Yr${vr.fgp.V.t1.toFixed(0)}–${vr.fgp.V.t2.toFixed(0)}</p>`;
}

// ── 获取当前模型的"品种"对象（用于渲染和图表）──────────────────
function getEffectiveVariety() {
  if (is3PG()) {
    // 3-PG 模式下构造一个兼容的品种对象
    return {
      name: '三倍体毛白杨 B301',
      H: { a: 1.48, b: 0.37, K: 21.95 },
      D: { a: 1.73, b: 0.56, K: 22.76 },
      V: { a: 3.64, b: 0.53, K: 0.43 },
      fgp: { D: { t1: 1, t2: 5 }, H: { t1: 1, t2: 5 }, V: { t1: 2, t2: 5 } },
    };
  }
  return getVariety();
}

function getEffectiveSI() {
  return is3PG() ? 16 : getSI();
}

// ── 跳转到指定年份（核心刷新函数）───────────────────────────────
export function goTo(yr) {
  S.curYr = Math.max(1, Math.min(yr, S.rotLen));
  document.getElementById('yrSl').value = S.curYr;
  document.getElementById('yrLb').textContent = S.curYr;

  const states = getStates(S.curYr, S.sched, S.tSets);
  drawStand(S.curYr, S.simT, states, getEffectiveVariety(), getEffectiveSI(), S.rotLen, S.sched, S.grd);
  updMetrics();
  drawChart(S.simT, S.sim0, S.curYr, S.vKey, getEffectiveVariety());
}

// ── 播放控制 ──────────────────────────────────────────────────────
function stopPl() {
  S.running = false;
  clearInterval(S.tmr);
  document.getElementById('btnPl').textContent = 'Play';
}

function startPl() {
  S.running = true;
  document.getElementById('btnPl').textContent = '暂停';
  if (S.curYr >= S.rotLen) S.curYr = 1;
  const spd = +document.getElementById('spd').value;
  S.tmr = setInterval(() => {
    S.curYr++;
    if (S.curYr > S.rotLen) { stopPl(); return; }
    goTo(S.curYr);
  }, spd);
}

function togglePl() { S.running ? stopPl() : startPl(); }

function updSpd() {
  const v = document.getElementById('spd').value;
  document.getElementById('oSpd').textContent = v;
  if (S.running) { stopPl(); startPl(); }
}

// ── 图表指标切换 ──────────────────────────────────────────────────
export function setVK(k) {
  S.vKey = k;
  document.querySelectorAll('.gtab').forEach(b => b.classList.remove('on'));
  document.querySelector(`.gtab[data-vkey="${k}"]`)?.classList.add('on');
  drawChart(S.simT, S.sim0, S.curYr, S.vKey, getEffectiveVariety());
}

// ── 模型切换 ──────────────────────────────────────────────────────
function onModelChange() {
  S.modelType = document.getElementById('modelType').value;
  const logP = document.getElementById('logisticPanel');
  const pgP  = document.getElementById('threePGPanel');

  if (is3PG()) {
    logP.style.display = 'none';
    pgP.style.display  = '';
    // 应用用途默认值
    applyUseTypeDefaults();
  } else {
    logP.style.display = '';
    pgP.style.display  = 'none';
  }
  rebuild();
}

function applyUseTypeDefaults() {
  const ut = USE_TYPES[getUseType()];
  if (!ut) return;
  document.getElementById('N0').value  = ut.defaultN0;
  document.getElementById('oN0').textContent = ut.defaultN0;
  document.getElementById('rot').value = ut.defaultRot;
  document.getElementById('rot').min   = ut.minRot;
  document.getElementById('rot').max   = ut.maxRot;
  document.getElementById('oRot').textContent = ut.defaultRot;
  document.getElementById('FR').value  = ut.defaultFR;
  document.getElementById('oFR').textContent = ut.defaultFR;
  document.getElementById('irrigAnn').value = ut.defaultIrr;
  document.getElementById('oIrrig').textContent = ut.defaultIrr;
}

// ── 气候数据表格渲染 ──────────────────────────────────────────────
function renderClimateTable() {
  const tbody = document.getElementById('climateBody');
  if (!tbody) return;
  const mNames = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];
  tbody.innerHTML = S.climate.map((c, i) =>
    `<tr>
      <td>${mNames[i]}</td>
      <td><input type="number" class="clim-input" data-idx="${i}" data-key="Tmax"     value="${c.Tmax}"     step="1"   style="width:48px;"></td>
      <td><input type="number" class="clim-input" data-idx="${i}" data-key="Tmin"      value="${c.Tmin}"     step="1"   style="width:48px;"></td>
      <td><input type="number" class="clim-input" data-idx="${i}" data-key="precip"    value="${c.precip}"   step="5"   style="width:52px;"></td>
      <td><input type="number" class="clim-input" data-idx="${i}" data-key="solarRad"  value="${c.solarRad}" step="0.5" style="width:52px;"></td>
    </tr>`
  ).join('');
}

function onClimateInput(e) {
  if (!e.target.classList.contains('clim-input')) return;
  const idx = +e.target.dataset.idx;
  const key = e.target.dataset.key;
  S.climate[idx][key] = +e.target.value;
  rebuild();
}

function resetClimate() {
  S.climate = JSON.parse(JSON.stringify(DEFAULT_CLIMATE));
  renderClimateTable();
  rebuild();
}

// ── 全量重建（参数变化时调用）────────────────────────────────────
export function rebuild() {
  if (S.running) stopPl();

  const N0 = getN0();
  S.rotLen = +document.getElementById('rot').value;

  // 同步显示值
  document.getElementById('oN0').textContent  = N0;
  document.getElementById('oRot').textContent = S.rotLen;
  document.getElementById('yrSl').max = S.rotLen;
  if (S.curYr > S.rotLen) S.curYr = S.rotLen;

  S.tSets = mkThinSets(S.sched);

  if (is3PG()) {
    // ── 3-PG 模型 ──
    const cfg = {
      N0, rotLen: S.rotLen, sched: S.sched,
      FR:       getFR(),
      climate:  S.climate,
      co2:      getCO2(),
      maxASW:   getMaxASW(),
      irrigAnn: getIrrig(),
    };
    S.simT = runSim3PG(cfg);
    S.sim0 = runSim3PG({ ...cfg, sched: [] });

    document.getElementById('oFR').textContent    = cfg.FR;
    document.getElementById('oCO2').textContent   = cfg.co2;
    document.getElementById('oMaxASW').textContent = cfg.maxASW;
    document.getElementById('oIrrig').textContent = cfg.irrigAnn;
  } else {
    // ── Logistic 模型 ──
    const SI = getSI();
    document.getElementById('oSI').textContent = SI;
    S.simT = runSim(N0, SI, S.sched, S.rotLen, getVarietyIdx());
    S.sim0 = runSim(N0, SI, [],      S.rotLen, getVarietyIdx());
  }

  S.grd = mkGrid();
  renderThinUI();
  updVarInfo();
  setVK(S.vKey);
  goTo(S.curYr);
}

// ── 间伐方案 UI ───────────────────────────────────────────────────
function renderThinUI() {
  const div = document.getElementById('thinList');
  div.innerHTML = '';

  S.sched.forEach((ev, i) => {
    const card = document.createElement('div');
    card.className = 'tcard';

    const hd = document.createElement('div');
    hd.style.cssText = 'display:flex;align-items:center;gap:7px;flex-wrap:wrap;';
    hd.innerHTML =
      `<span style="font-size:12px;font-weight:500;">第${i + 1}次间伐</span>` +
      `<span style="font-size:12px;color:#666;">年份</span>` +
      `<input type="number" min="1" max="${S.rotLen - 1}" value="${ev.yr}"
         data-idx="${i}"
         style="width:50px;font-size:12px;padding:2px 6px;border:1px solid #ddd;border-radius:4px;"
         class="thin-yr-input">` +
      `<span style="font-size:11px;color:#999;">${MODES[ev.mode].lb} · ${Math.round(MODES[ev.mode].f * 100)}%</span>` +
      (S.sched.length > 1
        ? `<button data-idx="${i}" class="thin-del-btn"
             style="font-size:11px;padding:2px 7px;border:1px solid #ddd;border-radius:4px;background:#fff;cursor:pointer;margin-left:auto;">删除</button>`
        : '');
    card.appendChild(hd);

    const mr = document.createElement('div');
    mr.className = 'mbtns';
    MODES.forEach((m, mi) => {
      const b = document.createElement('button');
      b.className = 'mb' + (ev.mode === mi ? ' on' : '');
      b.textContent = m.sh;
      b.title = m.lb;
      b.dataset.evIdx = i;
      b.dataset.modeIdx = mi;
      b.classList.add('thin-mode-btn');
      mr.appendChild(b);
    });
    card.appendChild(mr);
    div.appendChild(card);
  });
}

// ── 间伐事件操作 ──────────────────────────────────────────────────
function addThin() {
  const lastYr = S.sched[S.sched.length - 1]?.yr || 5;
  S.sched.push({ yr: Math.min(S.rotLen - 1, lastYr + 5), mode: 0 });
  S.tSets = mkThinSets(S.sched);
  renderThinUI();
  rebuild();
}

function delEv(idx) {
  S.sched.splice(idx, 1);
  S.tSets = mkThinSets(S.sched);
  renderThinUI();
  rebuild();
}

function updEvYr(idx, val) {
  S.sched[idx].yr = Math.max(1, Math.min(S.rotLen - 1, parseInt(val) || 1));
  S.tSets = mkThinSets(S.sched);
  goTo(S.curYr);
}

// ── 事件代理：间伐卡片区域 ────────────────────────────────────────
function bindThinListDelegate() {
  const thinList = document.getElementById('thinList');

  thinList.addEventListener('input', e => {
    if (e.target.classList.contains('thin-yr-input')) {
      updEvYr(+e.target.dataset.idx, e.target.value);
    }
  });

  thinList.addEventListener('click', e => {
    const del  = e.target.closest('.thin-del-btn');
    const mode = e.target.closest('.thin-mode-btn');
    if (del)  { delEv(+del.dataset.idx); return; }
    if (mode) {
      const i  = +mode.dataset.evIdx;
      const mi = +mode.dataset.modeIdx;
      S.sched[i].mode = mi;
      S.tSets = mkThinSets(S.sched);
      renderThinUI();
      goTo(S.curYr);
    }
  });
}

// ── 静态控件事件绑定 ─────────────────────────────────────────────
function bindStaticControls() {
  // 模型切换
  document.getElementById('modelType').addEventListener('change', onModelChange);

  // Logistic: 品种 / 立地
  ['variety', 'SI'].forEach(id => {
    document.getElementById(id).addEventListener('change', rebuild);
    document.getElementById(id).addEventListener('input',  rebuild);
  });

  // 共享: 密度 / 轮伐期
  ['N0', 'rot'].forEach(id => {
    document.getElementById(id).addEventListener('change', rebuild);
    document.getElementById(id).addEventListener('input',  rebuild);
  });

  // 播放速度
  document.getElementById('spd').addEventListener('input', updSpd);

  // 播放 / 暂停
  document.getElementById('btnPl').addEventListener('click', togglePl);

  // Reset
  document.getElementById('btnReset').addEventListener('click', () => goTo(1));

  // 年份滑块
  document.getElementById('yrSl').addEventListener('input', () => {
    if (S.running) stopPl();
    goTo(+document.getElementById('yrSl').value);
  });

  // 图表指标切换
  document.getElementById('chartTabs').addEventListener('click', e => {
    const btn = e.target.closest('.gtab');
    if (btn) setVK(btn.dataset.vkey);
  });

  // 添加间伐
  document.getElementById('addThin').addEventListener('click', addThin);

  // ── 3-PG 专用控件 ──
  ['FR', 'co2', 'maxASW', 'irrigAnn'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', rebuild);
      el.addEventListener('change', rebuild);
    }
  });

  // 3-PG 用途切换
  const useEl = document.getElementById('useType');
  if (useEl) useEl.addEventListener('change', () => { applyUseTypeDefaults(); rebuild(); });

  // 气候数据编辑
  const climBody = document.getElementById('climateBody');
  if (climBody) climBody.addEventListener('input', onClimateInput);

  // 重置气候
  const resetBtn = document.getElementById('resetClimate');
  if (resetBtn) resetBtn.addEventListener('click', resetClimate);

  // 窗口缩放重绘
  window.addEventListener('resize', () => {
    const states = getStates(S.curYr, S.sched, S.tSets);
    drawStand(S.curYr, S.simT, states, getEffectiveVariety(), getEffectiveSI(), S.rotLen, S.sched, S.grd);
  });
}

// ── 初始化入口（由 app.js 调用）──────────────────────────────────
export function init() {
  bindStaticControls();
  bindThinListDelegate();
  renderClimateTable();
  rebuild();
}
