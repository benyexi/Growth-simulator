/**
 * chart_viz.js
 * Chart.js 生长曲线封装。
 * 依赖全局 Chart（从 CDN <script> 标签加载）。
 */

// 模块级 Chart 实例，每次重绘前销毁旧实例
let lch = null;

const AXIS_LABELS = {
  vol: '蓄积量 m³/ha',
  dbh: '胸径 cm',
  h:   '树高 m',
  ba:  '断面积 m²/ha',
  mai: 'MAI m³/ha/yr',
};

/**
 * 绘制生长曲线图（无间伐 vs 当前方案，速生期背景，当前年标记点）。
 *
 * @param {StandRecord[]} simT    含间伐的模拟序列
 * @param {StandRecord[]} sim0    无间伐基准序列
 * @param {number}        curYr  当前林龄（高亮点）
 * @param {string}        vKey   指标键 'vol'|'dbh'|'h'|'ba'|'mai'
 * @param {object}        variety 品种对象（用于读取速生期 fgp）
 */
export function drawChart(simT, sim0, curYr, vKey, variety) {
  const fgpMap = {
    vol: variety.fgp.V,
    dbh: variety.fgp.D,
    h:   variety.fgp.H,
    ba:  variety.fgp.D,
    mai: variety.fgp.V,
  };
  const fp = fgpMap[vKey];

  const labels  = simT.map(d => 'Yr' + d.t);
  const fgpData = simT.map(d => (d.t >= fp.t1 && d.t <= fp.t2) ? d[vKey] : null);

  if (lch) lch.destroy();

  lch = new Chart(document.getElementById('chC'), {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: '无间伐',
          data: sim0.map(d => d[vKey]),
          borderColor: '#888780',
          borderWidth: 1.5,
          pointRadius: 0,
          tension: 0.35,
          fill: false,
          order: 3,
        },
        {
          label: '间伐',
          data: simT.map(d => d[vKey]),
          borderColor: '#185FA5',
          borderWidth: 2.5,
          pointRadius: 0,
          tension: 0.35,
          fill: false,
          order: 2,
        },
        {
          label: '速生期',
          data: fgpData,
          borderColor: 'transparent',
          backgroundColor: 'rgba(52,168,83,.14)',
          borderWidth: 0,
          pointRadius: 0,
          fill: 'origin',
          tension: 0.35,
          order: 4,
        },
        {
          label: '当前',
          data: simT.map((_, i) => i === curYr - 1 ? simT[i][vKey] : null),
          borderColor: '#E24B4A',
          borderWidth: 0,
          pointRadius: simT.map((_, i) => i === curYr - 1 ? 6 : 0),
          pointBackgroundColor: '#E24B4A',
          showLine: false,
          order: 1,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: items => items[0].label,
            label: item  => item.dataset.label + ': ' + item.parsed.y?.toFixed(1),
          },
        },
      },
      scales: {
        x: {
          ticks: { autoSkip: true, maxTicksLimit: 12, font: { size: 10 } },
          grid:  { color: 'rgba(128,128,128,.06)' },
        },
        y: {
          ticks: { font: { size: 10 } },
          title: { display: true, text: AXIS_LABELS[vKey], font: { size: 10 } },
        },
      },
    },
  });
}
