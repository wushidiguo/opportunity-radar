// Opportunity Score 评分引擎 v2（纯函数、无 I/O、确定性）
// 核心改进：不只奖励"热度"，而是衡量"商业化空白" —
//   强需求 + 还没有公司化/托管/产品化 web 产品 = 高机会；
//   虽然有需求但已被 n8n/Supabase/ComfyUI 这类公司化项目 = 低机会。
// 商业化信号主要来自 repo 的 homepage / description / owner / license / stars。

export const SCORE_MAX = 100;

const PERMISSIVE = new Set(['Apache-2.0', 'MIT', 'BSD-2-Clause', 'BSD-3-Clause', 'ISC', '0BSD', 'Unlicense']);
// 商业化/托管关键词；先剔除 "self-hosted" 以免误判 DIY 项目
const HOSTED_KEYWORDS = /(cloud|hosted|saas|enterprise|managed|pricing|dedicated|premium|hosting|offering)/i;
const GITHUB_HOST_RE = /(^|\.)github\.(com|io)$/i;
// DIY/自托管倾向 topic（强需求、往往没有现成商业化产品）
const DIY_TOPIC_RE = /self-hosted|selfhosted|self-hosting|cli|dashboard|home|library|tool|privacy|owncast|diy|self-host/i;

export const FACTOR_DEFS = [
  { key: 'popularity', label: 'Popularity (log10 stars)',  max: 20 },
  { key: 'demand',     label: 'Demand (open issues)',      max: 15 },
  { key: 'activity',   label: 'Activity (recent push)',   max: 10 },
  { key: 'health',     label: 'Health (archived+issues+desc+wiki)', max: 15 },
  { key: 'gap',        label: 'Commercialization gap',    max: 40 },
];

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}
function hostOf(homepage) {
  if (!homepage) return '';
  try { return new URL(homepage).host; } catch { return ''; }
}

/** 检测"商业化已存在"或"商业化空白"的信号。 */
export function detectCommercialSignals(repo = {}, _ctx = {}) {
  const homepage = (repo.homepage || '').trim();
  const desc = (repo.description || '').replace(/self[- ]?host(ed|ing)?/gi, ''); // 剔除 self-hosted
  const host = hostOf(homepage);
  const isGhHost = !host || GITHUB_HOST_RE.test(host);
  const signals = [];

  if (homepage && !isGhHost) signals.push('productSite');        // 有公司/产品官网（最强信号）
  else if (!homepage) signals.push('noHomepage');                 // 无官网 → 空白更强
  else signals.push('githubPages');

  if (HOSTED_KEYWORDS.test(desc)) signals.push('hostedKeyword'); // 描述含 cloud/saas/enterprise/managed 等
  if (repo.ownerType === 'Organization') signals.push('orgBacked');
  else if (repo.ownerType === 'User') signals.push('userOwned');

  const lic = (repo.license && (repo.license.key || repo.license.spdx || '')) || '';
  if (PERMISSIVE.has(lic)) signals.push('permissive');
  const stars = toNumber(repo.stars);
  if (stars > 40000) signals.push('huge');
  if (stars > 120000) signals.push('mega');
  if (repo.isFork) signals.push('fork');

  // "已商业化" = 有产品官网 或 描述里出现托管/云/企业等词
  const commercialized = signals.includes('productSite') || signals.includes('hostedKeyword');
  return { signals, commercialized };
}

/** 商业化空白得分，可正可负（-20..40）。越高越空白、越值得做；越低越已饱和。 */
export function gapFactor(repo = {}, ctx = {}) {
  const { signals } = detectCommercialSignals(repo, ctx);
  let g = 20;
  if (signals.includes('productSite')) g -= 12;
  if (signals.includes('hostedKeyword')) g -= 8;
  if (signals.includes('huge')) g -= 8;
  if (signals.includes('mega')) g -= 8;
  if (signals.includes('fork')) g -= 6;
  if (signals.includes('noHomepage')) g += 8;
  if (signals.includes('userOwned')) g += 4;
  if (signals.includes('permissive')) g += 4;
  if (ctx && ctx.queryTopic && DIY_TOPIC_RE.test(ctx.queryTopic)) g += 6;
  return Math.round(clamp(g, -20, 40));
}

export function gradeFor(score) {
  if (score >= 75) return { code: 'A', label: 'Strong' };
  if (score >= 60) return { code: 'B', label: 'Moderate' };
  if (score >= 45) return { code: 'C', label: 'Weak' };
  return { code: 'D', label: 'Low signal' };
}

export function computeScore(repo = {}, opts = {}) {
  const now = typeof opts.now === 'number' ? opts.now : Date.now();
  const stars = toNumber(repo.stars);
  const openIssues = toNumber(repo.openIssues);
  const factors = [];

  let total = 0;
  const addNonNeg = (key, rawPoints, detail) => {
    const def = FACTOR_DEFS.find((f) => f.key === key);
    const points = Math.round(clamp(toNumber(rawPoints), 0, def.max) * 100) / 100;
    factors.push({ key, label: def.label, points, max: def.max, detail: detail || '' });
    total += points;
  };

  // 热度：sublinear，避免大项目压倒性霸榜
  addNonNeg('popularity', stars > 0 ? Math.log10(stars + 1) * 5 : 0, stars + ' stars');
  // 需求：open issues
  addNonNeg('demand', openIssues / 150, openIssues + ' open issues');

  // 活跃度
  const pushedAt = repo.pushedAt ? Date.parse(repo.pushedAt) : NaN;
  const days = Number.isFinite(pushedAt) ? (now - pushedAt) / 86400000 : Number.POSITIVE_INFINITY;
  if (days <= 180) addNonNeg('activity', 10, 'pushed ~' + Math.max(0, Math.round(days)) + 'd ago');
  else if (days <= 365) addNonNeg('activity', 4, 'pushed ~' + Math.round(days) + 'd ago');
  else addNonNeg('activity', 0, Number.isFinite(days) ? 'last push ' + Math.round(days) + 'd ago' : 'no push date');

  // 项目健康
  let health = 0;
  if (!repo.archived) health += 4;
  if (repo.hasIssues) health += 4;
  if (repo.description && String(repo.description).length > 0) health += 4;
  if (repo.hasWiki !== false) health += 3;
  addNonNeg('health', health, '');

  // 商业化空白（核心，可负）
  const ctx = { queryTopic: opts.queryTopic };
  const gap = gapFactor(repo, ctx);
  const { commercialized } = detectCommercialSignals(repo, ctx);
  const gapDef = FACTOR_DEFS.find((f) => f.key === 'gap');
  factors.push({ key: 'gap', label: gapDef.label, points: gap, max: gapDef.max, detail: commercialized ? 'commercialized' : 'gap' });
  total += gap;

  const rounded = Math.round(clamp(total, 0, SCORE_MAX));
  return {
    score: rounded,
    grade: gradeFor(rounded),
    total: Math.round(total * 100) / 100,
    factors,
    gap,
    commercialized,
    signals: detectCommercialSignals(repo, ctx).signals,
  };
}
