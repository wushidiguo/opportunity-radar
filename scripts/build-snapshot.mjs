#!/usr/bin/env node
// 构建 Web 数据快照：从 GitHub 实时数据生成 web/data/opportunities.json
// 用法: node scripts/build-snapshot.mjs [--topics a,b,c] [--limit N] [--demo] [--out FILE]
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { searchReposByTopic } from '../src/fetch.mjs';
import { computeScore } from '../src/score.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_OUT = path.join(__dirname, '..', 'web', 'data', 'opportunities.json');
const DEFAULT_TOPICS = ['ai', 'self-hosted', 'database', 'devops'];

function parseArgs(argv) {
  const opts = { topics: DEFAULT_TOPICS, limit: 25, demo: false, out: DEFAULT_OUT };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--topics') opts.topics = (argv[++i] || '').split(',').map((s) => s.trim()).filter(Boolean);
    else if (a === '--limit') opts.limit = Number(argv[++i]) || 25;
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
  const repos = searchReposByTopic(topic, opts.limit, { demo: opts.demo });
  const cards = repos
    .map((repo) => ({ repo, ...computeScore(repo, { now }) }))
    .sort((a, b) => b.score - a.score || b.repo.stars - a.repo.stars)
    .map((c, i) => ({ rank: i + 1, repo: c.repo, score: c.score, grade: c.grade, factors: c.factors }));
  topics[topic] = cards;
  console.error('[' + topic + '] ' + cards.length + ' repos');
}

const snapshot = { generatedAt: new Date(now).toISOString(), scoreMax: 100, topics };
const json = JSON.stringify(snapshot);
mkdirSync(path.dirname(opts.out), { recursive: true });
writeFileSync(opts.out, json, 'utf8');
console.error('written: ' + opts.out + ' (' + (json.length / 1024).toFixed(1) + ' KB, ' + Object.keys(topics).length + ' topics)');
