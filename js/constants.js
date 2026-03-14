// ── Grid dimensions ───────────────────────────────────────────────
export const NR = 12;
export const NC = 12;

// ── Reference values ──────────────────────────────────────────────
export const SI_BASE = 16;   // reference site index (m at 20 yr)
export const N_REF   = 833;  // reference density (stems/ha)

// ── Late-stage slow-growth rates ─────────────────────────────────
export const SLOW_D = 0.40;  // cm/yr  diameter increment after inflection
export const SLOW_H = 0.25;  // m/yr   height increment after inflection

// ── 品种参数（姜岳忠2006 博士论文表4-2-5, 4-2-6）──────────────────
// Logistic:  y = K / (1 + exp(a − b·t))
// fgp: fast-growth period [t1, t2]
export const VARIETIES = [
  {
    name: '易县毛白杨',
    H: { a: 1.48, b: 0.37, K: 21.95 },
    D: { a: 1.73, b: 0.56, K: 22.76 },
    V: { a: 3.64, b: 0.53, K: 0.43 },
    fgp: { D: { t1: 0.7, t2: 5.4 }, H: { t1: 0.5, t2: 7.6 }, V: { t1: 4.4, t2: 9.3 } },
  },
  {
    name: '鲁毛50',
    H: { a: 1.58, b: 0.32, K: 22.09 },
    D: { a: 1.68, b: 0.50, K: 22.81 },
    V: { a: 3.83, b: 0.50, K: 0.41 },
    fgp: { D: { t1: 0.7, t2: 6.0 }, H: { t1: 0.8, t2: 8.9 }, V: { t1: 5.0, t2: 10.2 } },
  },
  {
    name: '细皮毛白杨',
    H: { a: 1.58, b: 0.33, K: 21.70 },
    D: { a: 1.74, b: 0.50, K: 22.28 },
    V: { a: 3.92, b: 0.51, K: 0.39 },
    fgp: { D: { t1: 0.8, t2: 6.1 }, H: { t1: 0.8, t2: 8.7 }, V: { t1: 5.0, t2: 10.1 } },
  },
  {
    name: '南×毛新',
    H: { a: 1.50, b: 0.37, K: 21.94 },
    D: { a: 1.95, b: 0.50, K: 25.88 },
    V: { a: 4.29, b: 0.62, K: 0.41 },
    fgp: { D: { t1: 1.3, t2: 6.5 }, H: { t1: 0.5, t2: 7.5 }, V: { t1: 4.8, t2: 9.0 } },
  },
];

// ── 间伐模式 ───────────────────────────────────────────────────────
// fn(row, col) → true = 该位置的树被伐除
export const MODES = [
  { lb: '隔行（奇数行）', sh: '隔行↕奇', f: 0.50,   fn: (r, _c) => r % 2 === 1 },
  { lb: '隔行（偶数行）', sh: '隔行↕偶', f: 0.50,   fn: (r, _c) => r % 2 === 0 },
  { lb: '隔株（行内）',   sh: '隔株→',   f: 0.50,   fn: (_r, c) => c % 2 === 1 },
  { lb: '棋盘式',         sh: '棋盘⊞',   f: 0.50,   fn: (r,  c) => (r + c) % 2 === 1 },
  { lb: '三去一',         sh: '三去一',  f: 0.333,  fn: (r, _c) => r % 3 === 2 },
  { lb: '四去一',         sh: '四去一',  f: 0.25,   fn: (r, _c) => r % 4 === 3 },
];
