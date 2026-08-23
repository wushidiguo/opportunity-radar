// 输出渲染：table（终端友好）、json（机器可读）、csv（可导入表格/导出）
import { FACTOR_DEFS } from './score.mjs';

function pad(str, width) {
  str = String(str);
  return str.length >= width ? str.slice(0, width) : str + ' '.repeat(width - str.length);
}

function daysSince(iso, now = Date.now()) {
  if (!iso) return '?';
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '?';
  const d = Math.max(0, Math.round((now - t) / 86400000));
  return d + 'd';
}

/** 表格输出：每行一个仓库，下方缩进展示得分因子（机会分可解释）。 */
export function renderTable(cards, now = Date.now()) {
  const lines = [];
  lines.push('OSS Opportunity Radar — 开源商业化机会雷达');
  lines.push('');
  lines.push(
    pad('Rank', 5) + pad('Score', 8) + pad('Grade', 8) +
    pad('Repo', 40) + pad('Stars', 9) + pad('Issues', 8) +
    pad('License', 12) + pad('Pushed', 8)
  );
  lines.push('-'.repeat(98));
  cards.forEach((card, i) => {
    const r = card.repo;
    const license = r.license ? r.license.key : 'none';
    lines.push(
      pad(i + 1, 5) + pad(card.score + '/100', 8) +
      pad(card.grade.code + ' ' + card.grade.label, 8) +
      pad(r.fullName, 40) + pad(r.stars, 9) + pad(r.openIssues, 8) +
      pad(license, 12) + pad(daysSince(r.pushedAt, now), 8)
    );
    if (r.description) {
      lines.push('  ' + String(r.description).slice(0, 90));
    }
    const parts = card.factors
      .filter((f) => f.points > 0)
      .map((f) => `${f.key}=${f.points}${f.detail ? '(' + f.detail + ')' : ''}`);
    if (parts.length) {
      lines.push('  因子: ' + parts.join('  '));
    }
    lines.push('');
  });
  lines.push('Score 公式: 热度(30) + 需求(20) + 活跃度(15) + 未归档(10) + issueTracker(10) + license(5) + description(5) + issueRatio(5)');
  return lines.join('\n');
}

/** JSON 输出：完整机器可读卡片。 */
export function renderJson(cards) {
  const payload = cards.map((card) => ({
    rank: undefined, // 由调用方注入
    repo: card.repo,
    score: card.score,
    grade: card.grade,
    factors: card.factors,
  }));
  return JSON.stringify(payload, null, 2);
}

/** CSV 输出：每个因子一列，便于 Excel/Sheets 分析或导出。 */
export function renderCsv(cards) {
  const factorKeys = FACTOR_DEFS.map((f) => f.key);
  const header = ['rank', 'score', 'grade', 'repo', 'stars', 'open_issues', 'license', 'pushed_at', 'html_url', ...factorKeys];
  const rows = cards.map((card, i) => {
    const r = card.repo;
    const byKey = Object.fromEntries(card.factors.map((f) => [f.key, f.points]));
    return [
      i + 1, card.score, card.grade.code, r.fullName, r.stars, r.openIssues,
      r.license ? r.license.key : '', r.pushedAt || '', r.htmlUrl,
      ...factorKeys.map((k) => byKey[k] ?? 0),
    ];
  });
  const esc = (v) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  return [header, ...rows].map((row) => row.map(esc).join(',')).join('\n');
}
