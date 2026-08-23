#!/usr/bin/env node
// 构建 Web 数据快照：拉取较大候选池，按"商业化空白感知的机会分"排名，保留高分者
// 用法: node scripts/build-snapshot.mjs [--topics a,b,c] [--pool N] [--top M] [--demo] [--out FILE]
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { searchReposByTopic, isListRepo, isContentRepo } from '../src/fetch.mjs';
import { computeScore } from '../src/score.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_OUT = path.join(__dirname, '..', 'web', 'data', 'opportunities.json');
const DEFAULT_TOPICS = ['ai', 'self-hosted', 'database', 'devops', 'llm'];

function parseArgs(argv) {
  const opts = { topics: DEFAULT_TOPICS, pool: 120, top: 30, demo: false, out: DEFAULT_OUT };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--topics') opts.topics = (argv[++i] || '').split(',').map((s) => s.trim()).filter(Boolean);
    else if (a === '--pool') opts.pool = Number(argv[++i]) || 120;
    else if (a === '--top') opts.top = Number(argv[++i]) || 30;
    else if (a === '--demo') opts.demo = true;
    else if (a === '--out') opts.out = argv[++i];
    else throw new Error('unknown option: ' + a);
  }
  if (opts.topics.length === 0) throw new Error('--topics 不能为空');
  return opts;
}

const opts = parseArgs(process.argv.slice(2));
const now = Date.now();
const topics = {};

for (const topic of opts.topics) {
  const repos = searchReposByTopic(topic, opts.pool, { demo: opts.demo })
    .filter((r) => !isListRepo(r) && !isContentRepo(r));
  const cards = repos
    .map((repo) => {
      const c = computeScore(repo, { now, queryTopic: topic });
      return { repo, score: c.score, grade: c.grade, gap: c.gap, commercialized: c.commercialized, signals: c.signals, factors: c.factors };
    })
    .sort((a, b) => b.score - a.score || b.gap - a.gap || b.repo.stars - a.repo.stars)
    .slice(0, opts.top)
    .map((c, i) => ({ rank: i + 1, repo: c.repo, score: c.score, grade: c.grade, gap: c.gap, commercialized: c.commercialized, signals: c.signals, factors: c.factors }));
  topics[topic] = cards;
  console.error('[' + topic + '] pool=' + repos.length + ' -> top=' + cards.length + ' (best=' + (cards[0] ? cards[0].score : 0) + ')');
}

const snapshot = { generatedAt: new Date(now).toISOString(), scoreMax: 100, model: 'v2', topics };
const json = JSON.stringify(snapshot);
mkdirSync(path.dirname(opts.out), { recursive: true });
writeFileSync(opts.out, json, 'utf8');
console.error('written: ' + opts.out + ' (' + (json.length / 1024).toFixed(1) + ' KB, ' + Object.keys(topics).length + ' topics)');
