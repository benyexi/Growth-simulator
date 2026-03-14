/**
 * thinning.js
 * 间伐逻辑：纯函数，无副作用，不依赖 DOM。
 */

import { NR, NC, MODES } from './constants.js';

/**
 * 根据间伐方案预计算每次间伐涉及的树木 ID 集合。
 * 每次间伐只能从上次间伐后的存活树中选取。
 *
 * @param {Array} sched  [{yr, mode}, ...]
 * @returns {Set[]}      每次间伐对应一个 Set<number>（树木 ID = row*NC + col）
 */
export function mkThinSets(sched) {
  const alive = new Set();
  for (let r = 0; r < NR; r++) {
    for (let c = 0; c < NC; c++) {
      alive.add(r * NC + c);
    }
  }

  const tSets = [];
  for (const ev of sched) {
    const removed = new Set();
    for (const id of alive) {
      const r = Math.floor(id / NC);
      const c = id % NC;
      if (MODES[ev.mode].fn(r, c)) removed.add(id);
    }
    tSets.push(removed);
    for (const id of removed) alive.delete(id);
  }

  return tSets;
}

/**
 * 计算指定林龄时每棵树的状态。
 *
 * @param {number} yr      当前林龄
 * @param {Array}  sched   间伐方案 [{yr, mode}, ...]
 * @param {Set[]}  tSets   mkThinSets() 的返回值
 * @returns {Map<number, 'live'|'cut'|'stump'>}
 */
export function getStates(yr, sched, tSets) {
  const states = new Map();
  for (let r = 0; r < NR; r++) {
    for (let c = 0; c < NC; c++) {
      states.set(r * NC + c, 'live');
    }
  }

  for (let i = 0; i < sched.length; i++) {
    const removed = tSets[i] || new Set();
    if (yr > sched[i].yr) {
      for (const id of removed) states.set(id, 'stump');
    } else if (yr === sched[i].yr) {
      for (const id of removed) states.set(id, 'cut');
    }
  }

  return states;
}
