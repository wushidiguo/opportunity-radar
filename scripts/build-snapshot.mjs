#!/usr/bin/env node
// 构建 Web 数据快照：拉取较大候选池、按"商业化空白感知"评分 + 洞察挖掘每期 Top 机会
// 用法: node scripts/build-snapshot.mjs [--topics a,b,c] [--pool N] [--top M] [--insight-top K] [--demo] [--out FILE]
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { searchReposByTopic, isListRepo, isContentRepo } from '../src/fetch.mjs';
import { computeScore } from '../src/score.mjs';
import { buildInsight, refineScore } from '../src/insight.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_OUT = path.join(__dirname, '..', 'web', 'data', 'opportunities.json');
const DEFAULT_TOPICS = ['ai', 'self-hosted', 'database', 'devops', 'llm'];

function parseArgs(argv) {
  const opts = { topics: DEFAULT_TOPICS, pool: 120, top: 40, insightTop: 8, demo: false, out: DEFAULT_OUT };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--topics') opts.topics = (argv[++i] || '').split(',').map((s) => s.trim()).filter(Boolean);
    else if (a === '--pool') opts.pool = Number(argv[++i]) || 120;
    else if (a === '--top') opts.top = Number(argv[++i]) || 40;
    else if (a === '--insight-top') opts.insightTop = Number(argv[++i]) || 8;
    else if (a === '--demo') opts.demo = true;
    else if (a === '--out') opts.out = argv[++i];
    else throw new Error('unknown option: ' + a);
  }
  if (opts.topics.length === 0) throw new Error('--topics cannot be empty');
  return opts;
}

const opts = parseArgs(process.argv.slice(2));
const now = Date.now();
const topics = {};

for (const topic of opts.topics) {
  const repos = searchReposByTopic(topic, opts.pool, { demo: opts.demo })
    .filter((r) => !isListRepo(r) && !isContentRepo(r));

  let cards = repos
    .map((repo) => {
      const c = computeScore(repo, { now, queryTopic: topic });
      return { repo, score: c.score, grade: c.grade, gap: c.gap, commercialized: c.commercialized, signals: c.signals, factors: c.factors };
    })
    .sort((a, b) => b.score - a.score || b.gap - a.gap || b.repo.stars - a.repo.stars);

  // 洞察挖掘：只对 Top K 个候选挖 issue/README，生成"付费理由"并微调分数
  if (!opts.demo && opts.insightTop > 0) {
    const mined = cards.slice(0, opts.insightTop);
    for (const card of mined) {
      try {
        const insight = buildInsight(card.repo.fullName);
        card.insight = insight;
        card.score = refineScore(card.score, insight);
        card.grade = (await import('../src/score.mjs')).gradeFor(Math.max(0, Math.min(100, card.score)));
      } catch (e) {
        card.insight = null;
        card.insightError = String(e.message).slice(0, 120);
      }
    }
    cards.sort((a, b) => b.score - a.score || b.gap - a.gap || b.repo.stars - a.repo.stars);
  }

  cards = cards.slice(0, opts.top)
    .map((c, i) => ({ rank: i + 1, repo: c.repo, score: c.score, grade: c.grade, gap: c.gap, commercialized: c.commercialized, signals: c.signals, factors: c.factors, insight: c.insight || null }));
  topics[topic] = cards;
  const withInsight = cards.filter((c) => c.insight).length;
  console.error('[' + topic + '] pool=' + repos.length + ' top=' + cards.length + ' insight=' + withInsight + ' best=' + (cards[0] ? cards[0].score : 0));
}

const snapshot = { generatedAt: new Date(now).toISOString(), scoreMax: 100, model: 'v2+insight', topics };
const json = JSON.stringify(snapshot);
mkdirSync(path.dirname(opts.out), { recursive: true });
writeFileSync(opts.out, json, 'utf8');
console.error('written: ' + opts.out + ' (' + (json.length / 1024).toFixed(1) + ' KB, ' + Object.keys(topics).length + ' topics)');
