// CLI 入口逻辑：参数解析 -> 取数 -> 评分 -> 排序/过滤 -> 渲染
import { writeFileSync } from 'node:fs';
import { computeScore } from './score.mjs';
import { searchReposByTopic, isListRepo, isContentRepo } from './fetch.mjs';
import { renderTable, renderJson, renderCsv } from './render.mjs';

export const USAGE = 'OSS Opportunity Radar CLI\n' +
'用法: node bin/opportunity-radar.mjs <topic> [limit] [options]\n' +
'\n' +
'参数: topic / limit / --demo / --format table|json|csv / --min-score n / --out file / --include-lists / --help';

export function parseArgs(argv) {
  const opts = { topic: null, limit: 10, demo: false, format: 'table', minScore: 0, out: null, includeLists: false };
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--demo') opts.demo = true;
    else if (a === '--help' || a === '-h') opts.help = true;
    else if (a === '--include-lists') opts.includeLists = true;
    else if (a === '--format') opts.format = argv[++i];
    else if (a === '--min-score') opts.minScore = Number(argv[++i]) || 0;
    else if (a === '--out') opts.out = argv[++i];
    else if (a === '--limit') opts.limit = Number(argv[++i]) || 10;
    else if (a.startsWith('--')) throw new Error('未知选项: ' + a);
    else positional.push(a);
  }
  if (opts.help) return opts;
  if (!positional[0]) throw new Error('缺少 topic 参数');
  opts.topic = positional[0];
  if (positional[1]) opts.limit = Number(positional[1]) || opts.limit;
  if (!['table', 'json', 'csv'].includes(opts.format)) throw new Error('不支持的格式 "' + opts.format + '"（可选 table|json|csv）');
  return opts;
}

export function main(argv = process.argv.slice(2)) {
  let opts;
  try {
    opts = parseArgs(argv);
    if (opts.help) { console.log(USAGE); return; }
    const repos = searchReposByTopic(opts.topic, opts.limit, { demo: opts.demo })
      .filter((r) => (opts.includeLists ? true : !isListRepo(r) && !isContentRepo(r)));
    const now = Date.now();
    const cards = repos
      .map((repo) => ({ repo, ...computeScore(repo, { now, queryTopic: opts.topic }) }))
      .sort((a, b) => b.score - a.score || b.repo.stars - a.repo.stars)
      .map((card, i) => ({ ...card, rank: i + 1 }))
      .filter((card) => card.score >= opts.minScore);

    let output;
    if (opts.format === 'json') output = renderJson(cards);
    else if (opts.format === 'csv') output = renderCsv(cards);
    else output = renderTable(cards, now);
    console.log(output);
    if (opts.out) { writeFileSync(opts.out, output + '\n', 'utf8'); console.error('[已写入] ' + opts.out); }
    if (cards.length === 0) console.error('提示: 无满足 --min-score ' + opts.minScore + ' 的结果');
  } catch (err) {
    console.error('Error: ' + err.message);
    if (err.hint) console.error(err.hint);
    process.exitCode = 1;
  }
}
