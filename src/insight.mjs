// 洞察引擎：挖掘 open issue 文本中的付费/功能需求信号 + 从 README 判断商业化程度
// 目标是给出"付费用户为何值得掏钱"的数据化理由，而不只是元数据启发式。
import { spawnSync } from 'node:child_process';

// 需求信号分类：关键词命中 issue 标题/正文前段
const DEMAND_BUCKETS = [
  { key: 'hosted',  label: '托管/云版',   re: /(hosted|hosting|official\s+cloud|cloud\s+version|saas|managed|multi-tenant|multi-user|team\s+plan|collaborat)/i },
  { key: 'paid',    label: '付费/商业',   re: /(willing\s+to\s+pay|would\s+pay|happy\s+to\s+pay|pay\s+for|bu(y|ying)|subscription|pricing|paid\s+plan|donate|sponsor|commercial\s+license|sell)/i },
  { key: 'mobile',  label: '移动端',      re: /(mobile|ios|android|phone\s+app|windows\s+phone|tablet)/i },
  { key: 'api',     label: 'API/集成',    re: /(rest\s+api|webhook|sdk|integration|plugin|cli\s+tool|api\s+for)/i },
  { key: 'feature', label: '功能诉求',    re: /(feature\s+request|would\s+be\s+great|please\s+add|please\s+support|support\s+for|missing|add\s+support|ability\s+to|i\s+wish|it\s+would\s+be\s+nice|would\s+love)/i },
  { key: 'selfhost', label: '自托管',      re: /(self-?host|selfhost|docker\s+compose|self\s+hosting)/i },
];

function hitsAny(text, re) { return re.test(text); }

/** 纯函数：对一组 issue（含 title/body/comments）做需求信号分类。 */
export function classifyDemand(issues = []) {
  const buckets = DEMAND_BUCKETS.map((b) => ({ key: b.key, label: b.label, count: 0, samples: [] }));
  const byKey = Object.fromEntries(buckets.map((b) => [b.key, b]));
  let total = 0;
  let unanswered = 0;
  for (const iss of issues) {
    const text = (iss.title || '') + '\n' + String(iss.body || '').slice(0, 400);
    let matched = false;
    for (const b of DEMAND_BUCKETS) {
      if (hitsAny(text, b.re)) {
        byKey[b.key].count += 1;
        if (matched === false) matched = true;
        if (byKey[b.key].samples.length < 3 && iss.title) byKey[b.key].samples.push(iss.title);
      }
    }
    if (matched) total += 1;
    if ((iss.comments || 0) === 0) unanswered += 1;
  }
  const counts = {};
  for (const b of buckets) counts[b.key] = b.count;
  return { buckets, counts, total, unanswered, issueCount: issues.length };
}

/** 纯函数：从 README 文本判断是否已有商业化（定价/付费/托管/赞助）。 */
export function detectMonetization(readme = '', repo = {}) {
  const txt = String(readme || '');
  const hasPricing = /(pricing|plans|start\s+free|sign\s*up|per\s+month|monthly|subscription|buy\s+(now|a\s+license)|enterprise\s+plan|contact\s+sales|\$\s?\d+)/i.test(txt);
  const hasCloud = /(cloud|hosted|managed\s+service|paas|official\s+cloud)/i.test(txt);
  const hasSelfHost = /(self-?host|self-?custo|selfhosted|docker|on-?prem)/i.test(txt);
  const hasSponsor = /(sponsor|github\.com\/sponsors|become\s+a\s+sponsor)/i.test(txt);
  const isMonetized = hasPricing;   // 出现定价/付款＝明确商业化
  return { isMonetized, hasPricing, hasCloud, hasSelfHost, hasSponsor };
}

/** 纯函数：根据洞察微调总分。核心：有具体付费诉求且未商业化 → 加分；需求信号空洞 → 扣分；已商业化 → 扣分。 */
export function refineScore(baseScore, insight) {
  if (!insight) return Math.round(baseScore);
  let adj = 0;
  const c = (insight.demand && insight.demand.counts) || {};
  const featureish = (c.hosted || 0) + (c.paid || 0) + (c.mobile || 0) + (c.api || 0) + (c.feature || 0);
  if (insight.commercialization && insight.commercialization.isMonetized) {
    adj -= 6;
  } else {
    if (featureish >= 30) adj += 10;
    else if (featureish >= 15) adj += 7;
    else if (featureish >= 6) adj += 4;
    else adj -= 4; // 洞见薄弱：几乎无诉求 → 缺少付费理由
  }
  if ((insight.demand && insight.demand.unanswered) >= 60) adj += 3; // 大量未回复＝需求被忽视
  return Math.round(baseScore + adj);
}

/** 纯函数：生成一句话洞察。 */
export function buildReason(insight) {
  if (!insight) return '';
  const c = (insight.demand && insight.demand.counts) || {};
  const bucketSummary = (k, label) => (c[k] ? label + ' ' + c[k] + ' 条' : '');
  const parts = [bucketSummary('hosted', '托管/云'), bucketSummary('paid', '付费'), bucketSummary('mobile', '移动端'), bucketSummary('api', 'API/集成'), bucketSummary('feature', '功能'), bucketSummary('selfhost', '自托管')].filter(Boolean);
  const dem = parts.length ? 'open issue 中强烈诉求：' + parts.join('、') : '未发现明显付费/功能诉求';
  const total = insight.demand ? insight.demand.total : 0;
  const comm = insight.commercialization || {};
  let last;
  if (comm.isMonetized) last = ' README 已出现定价/付费（商业化候选，需验证是否已有人在做）。';
  else if (comm.hasCloud) last = ' README 提到云/托管，但无定价——可能正在商业化进程中。';
  else if (comm.hasSelfHost) last = ' 以自托管为主，README 未见定价/托管版 → 强烈建议做托管版/付费版。';
  else last = ' README 未见商业化线索 → 存在商业化空白。';
  if ((insight.demand && insight.demand.unanswered) >= 20) last += '（另有 ' + insight.demand.unanswered + ' 条 issue 无人回复，需求被忽视）';
  return '共 ' + total + ' 个信号，' + dem + '；' + last;
}

/* ---- 网络封装（通过 gh CLI） ---- */

function ghJson(args) {
  const res = spawnSync('gh', args, { encoding: 'utf8', env: { ...process.env, GH_NO_UPDATE_NOTIFIER: '1' } });
  if (res.status !== 0) throw new Error('gh 请求失败: ' + ((res.stderr || '').trim() || args.join(' ')));
  return JSON.parse(res.stdout);
}

export function fetchOpenIssues(repoFullName, limit = 100) {
  const rows = ghJson(['api', 'repos/' + repoFullName + '/issues?state=open&per_page=' + limit + '&sort=created&direction=desc']);
  // 过滤掉 pull requests（它们也出现在 issues 接口）
  return rows.filter((r) => !r.pull_request).map((r) => ({ title: r.title || '', body: r.body || '', comments: r.comments || 0, url: r.html_url || '' }));
}

export function fetchReadme(repoFullName) {
  const b64 = ghJson(['api', 'repos/' + repoFullName + '/readme', '--jq', '.content']);
  return Buffer.from(String(b64).replace(/\s/g, ''), 'base64').toString('utf8');
}

/** 主入口：对一个仓库构建洞察（可能抛错，调用方需 try/catch）。 */
export function buildInsight(repoFullName, opts = {}) {
  const issues = opts.issueFetcher ? opts.issueFetcher(repoFullName) : fetchOpenIssues(repoFullName, opts.issueLimit || 100);
  const demand = classifyDemand(issues);
  let readme = '';
  try { readme = opts.readmeFetcher ? opts.readmeFetcher(repoFullName) : fetchReadme(repoFullName); } catch { /* 无 README 时忽略 */ }
  const commercialization = detectMonetization(readme);
  const insight = { demand, commercialization, issueCount: issues.length };
  insight.reason = buildReason(insight);
  insight.scoreDelta = refineScore(0, insight) - 0; // 用于展示性估算
  return insight;
}
