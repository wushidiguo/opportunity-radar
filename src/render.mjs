// 输出渲染：table（终端友好）、json（机器可读）、csv（可导入表格/导出）
import { FACTOR_DEFS } from './score.mjs';

function pad(str, width) {
  str = String(str);
  return str.length >= width ? str.slice(0, width) : str + ' '.repeat(width - str.length);
}
function daysSince(iso, now) {
  if (!iso) return '?';
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '?';
  return Math.max(0, Math.round((now - t) / 86400000)) + 'd';
}

export function renderTable(cards, now = Date.now()) {
  const lines = [];
  lines.push('OSS Opportunity Radar — Open-Source Commercialization Opportunities');
  lines.push('');
  lines.push(
    pad('Rank', 5) + pad('Score', 8) + pad('Grade', 8) + pad('Gap', 6) +
    pad('Repo', 40) + pad('Stars', 9) + pad('Issues', 8) + pad('Comm.', 7)
  );
  lines.push('-'.repeat(94));
  cards.forEach((card, i) => {
    const r = card.repo;
    const commercialized = card.commercialized ? 'Yes' : 'Gap';
    lines.push(
      pad(i + 1, 5) + pad(card.score + '/100', 8) + pad(card.grade.code + ' ' + card.grade.label, 8) +
      pad(card.gap, 6) + pad(r.fullName, 40) + pad(r.stars, 9) + pad(r.openIssues, 8) + pad(commercialized, 8)
    );
    if (r.description) lines.push('  ' + String(r.description).slice(0, 88));
    const parts = card.factors.filter((f) => f.points !== 0).map((f) => f.key + '=' + f.points + (f.detail ? '(' + f.detail + ')' : ''));
    if (parts.length) lines.push('  Factors: ' + parts.join('  '));
    lines.push('');
  });
  lines.push('Score = Popularity(20) + Demand(15) + Activity(10) + Health(15) + Gap(40, may be negative)  |  Comm. Yes = has a product site / cloud / hosted product');
  return lines.join('\n');
}

export function renderJson(cards) {
  const payload = cards.map((card) => ({
    repo: card.repo,
    score: card.score,
    grade: card.grade,
    gap: card.gap,
    commercialized: card.commercialized,
    signals: card.signals || [],
    factors: card.factors,
  }));
  return JSON.stringify(payload, null, 2);
}

export function renderCsv(cards) {
  const factorKeys = FACTOR_DEFS.map((f) => f.key);
  const header = ['rank', 'score', 'grade', 'gap', 'commercialized', 'repo', 'stars', 'open_issues', 'license', 'homepage', 'pushed_at', 'html_url', ...factorKeys];
  const rows = cards.map((card, i) => {
    const r = card.repo;
    const byKey = Object.fromEntries(card.factors.map((f) => [f.key, f.points]));
    return [
      i + 1, card.score, card.grade.code, card.gap, card.commercialized ? 1 : 0, r.fullName,
      r.stars, r.openIssues, r.license ? r.license.key : '', r.homepage || '', r.pushedAt || '', r.htmlUrl,
      ...factorKeys.map((k) => byKey[k] ?? 0),
    ];
  });
  const esc = (v) => {
    const s = String(v == null ? '' : v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  return [header, ...rows].map((row) => row.map(esc).join(',')).join('\n');
}
