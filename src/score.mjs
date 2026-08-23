// Opportunity Score 评分引擎（纯函数、无 I/O、确定性）
// 公式来自 OPPORTUNITY_RADAR_PRODUCT_SPEC.md 第 4 节：
//   Score = 0~100
//   热度     log10(stars) * 10，最高 30
//   需求     open_issues / 50，最高 20
//   活跃度   180 天内 push 得 15，365 天内 5
//   未归档   10
//   有 issue tracker 10
//   有 license 5
//   有 description 5
//   issue/star 比例 >= 0.02 得 5

export const SCORE_MAX = 100;

// 因子定义：展示顺序即 CSV 列顺序
export const FACTOR_DEFS = [
  { key: 'popularity',   label: '热度 (log10 stars)',     max: 30 },
  { key: 'demand',       label: '需求 (open issues/50)',  max: 20 },
  { key: 'activity',     label: '活跃度 (近期 push)',      max: 15 },
  { key: 'notArchived',  label: '未归档',                 max: 10 },
  { key: 'issueTracker', label: '有 issue tracker',        max: 10 },
  { key: 'license',      label: '有 license',             max: 5 },
  { key: 'description',  label: '有 description',         max: 5 },
  { key: 'issueRatio',   label: 'issue/star 比例 >= 0.02', max: 5 },
];

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function gradeFor(score) {
  if (score >= 65) return { code: 'A', label: '强机会' };
  if (score >= 45) return { code: 'B', label: '中机会' };
  if (score >= 25) return { code: 'C', label: '弱机会' };
  return { code: 'D', label: '低信号' };
}

/**
 * 计算单个仓库的机会分。
 * @param {object} repo 归一化仓库对象（见 src/fetch.mjs normalizeRepo）
 * @param {{now?: number}} opts now 用于测试的固定时间戳（ms）
 * @returns {{score: number, grade: {code,label}, factors: Array, total: number}}
 */
export function computeScore(repo = {}, opts = {}) {
  const now = typeof opts.now === 'number' ? opts.now : Date.now();
  const stars = toNumber(repo.stars);
  const openIssues = toNumber(repo.openIssues);

  const factors = [];
  const add = (key, rawPoints, detail) => {
    const def = FACTOR_DEFS.find((f) => f.key === key);
    const points = Math.round(clamp(toNumber(rawPoints), 0, def.max) * 100) / 100;
    factors.push({ key, label: def.label, points, max: def.max, detail: detail || '' });
    return points;
  };

  let total = 0;

  // 热度：log10(stars) * 10，最高 30
  if (stars > 0) {
    total += add('popularity', Math.log10(stars) * 10, `${stars} stars`);
  } else {
    add('popularity', 0, '0 stars');
  }

  // 需求：open_issues / 50，最高 20
  total += add('demand', openIssues / 50, `${openIssues} open issues`);

  // 活跃度：180 天内 push 得 15，365 天内 5
  const pushedAt = repo.pushedAt ? Date.parse(repo.pushedAt) : NaN;
  const daysSincePush = Number.isFinite(pushedAt) ? (now - pushedAt) / 86400000 : Number.POSITIVE_INFINITY;
  if (daysSincePush <= 180) {
    total += add('activity', 15, `pushed ~${Math.max(0, Math.round(daysSincePush))}d ago`);
  } else if (daysSincePush <= 365) {
    total += add('activity', 5, `pushed ~${Math.round(daysSincePush)}d ago`);
  } else if (Number.isFinite(daysSincePush)) {
    add('activity', 0, `last push ${Math.round(daysSincePush)}d ago`);
  } else {
    add('activity', 0, 'no push date');
  }

  // 未归档
  if (!repo.archived) {
    total += add('notArchived', 10, '');
  } else {
    add('notArchived', 0, 'archived');
  }

  // 有 issue tracker
  if (repo.hasIssues) {
    total += add('issueTracker', 10, '');
  } else {
    add('issueTracker', 0, '');
  }

  // 有 license（排除 'other'）
  const licenseKey = repo.license && repo.license.key ? repo.license.key : null;
  if (licenseKey && licenseKey !== 'other') {
    total += add('license', 5, licenseKey);
  } else {
    add('license', 0, licenseKey ? `license=${licenseKey}` : 'no license');
  }

  // 有 description
  if (repo.description && String(repo.description).length > 0) {
    total += add('description', 5, '');
  } else {
    add('description', 0, '');
  }

  // issue/star 比例 >= 0.02
  if (stars > 0 && openIssues / stars >= 0.02) {
    total += add('issueRatio', 5, `ratio=${(openIssues / stars).toFixed(3)}`);
  } else if (stars > 0) {
    add('issueRatio', 0, `ratio=${(openIssues / stars).toFixed(3)}`);
  } else {
    add('issueRatio', 0, 'no stars');
  }

  const rounded = Math.round(clamp(total, 0, SCORE_MAX));
  return {
    score: rounded,
    grade: gradeFor(rounded),
    total: Math.round(total * 100) / 100,
    factors,
  };
}
