// CLI 入口逻辑：参数解析 -> 取数 -> 评分 -> 排序/过滤 -> 渲染
import { writeFileSync } from 'node:fs';
import { computeScore } from './score.mjs';
import { searchReposByTopic } from './fetch.mjs';
import { renderTable, renderJson, renderCsv } from './render.mjs';

export const USAGE = `OSS Opportunity Radar CLI
用法: node bin/opportunity-radar.mjs <topic> [limit] [options]

参数:
  topic                GitHub topic，如 ai、self-hosted、database
  limit                返回仓库数量，默认 10

选项:
  --demo               使用本地 fixture 数据（离线演示/测试）
  --format <fmt>       输出格式: table | json | csv（默认 table）
  --min-score <n>      只显示机会分 >= n 的仓库
  --out <file>         同时写入文件（json/csv 常用）
  --help               显示帮助
`;

export function parseArgs(argv) {
  const opts = {
    topic: null,
    limit: 10,
    demo: false,
    format: 'table',
    minScore: 0,
    out: null,
  };
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--demo') opts.demo = true;
    else if (a === '--help' || a === '-h') opts.help = true;
    else if (a === '--format') opts.format = argv[++i];
    else if (a === '--min-score') opts.minScore = Number(argv[++i]) || 0;
    else if (a === '--out') opts.out = argv[++i];
    else if (a === '--limit') opts.limit = Number(argv[++i]) || 10;
    else if (a.startsWith('--')) throw new Error(`未知选项: ${a}`);
    else positional.push(a);
  }
  if (opts.help) return opts;
  if (!positional[0]) throw new Error('缺少 topic 参数');
  opts.topic = positional[0];
  if (positional[1]) opts.limit = Number(positional[1]) || opts.limit;
  if (!['table', 'json', 'csv'].includes(opts.format)) {
    throw new Error(`不支持的格式 "${opts.format}"（可选 table|json|csv）`);
  }
  return opts;
}

export function main(argv = process.argv.slice(2)) {
  let opts;
  try {
    opts = parseArgs(argv);
    if (opts.help) {
      console.log(USAGE);
      return;
    }
    const repos = searchReposByTopic(opts.topic, opts.limit, { demo: opts.demo });
    const now = Date.now();
    const cards = repos
      .map((repo) => ({ repo, ...computeScore(repo, { now }) }))
      .sort((a, b) => b.score - a.score || b.repo.stars - a.repo.stars)
      .map((card, i) => ({ ...card, rank: i + 1 }))
      .filter((card) => card.score >= opts.minScore);

    let output;
    if (opts.format === 'json') output = renderJson(cards);
    else if (opts.format === 'csv') output = renderCsv(cards);
    else output = renderTable(cards, now);

    console.log(output);
    if (opts.out) {
      writeFileSync(opts.out, output + '\n', 'utf8');
      console.error(`[已写入] ${opts.out}`);
    }
    if (cards.length === 0) {
      console.error(`提示: 无满足 --min-score ${opts.minScore} 的结果`);
    }
  } catch (err) {
    console.error(`Error: ${err.message}`);
    if (err.hint) console.error(err.hint);
    if (opts && opts.help) console.log(USAGE);
    process.exitCode = 1;
  }
}
