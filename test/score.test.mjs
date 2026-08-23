// Opportunity Score 引擎 v2 单元测试（纯函数，无 I/O）
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeScore, gradeFor, gapFactor, detectCommercialSignals, FACTOR_DEFS, SCORE_MAX } from '../src/score.mjs';

const NOW = Date.parse('2026-08-25T00:00:00Z');
const DAY = 86400000;

// 一个高需求的"空白"自托管项目底座
function repo(overrides = {}) {
  return {
    fullName: 'owner/selfhosted-tool',
    description: 'A self-hosted tool for teams',
    stars: 30000,
    openIssues: 500,
    archived: false,
    license: { key: 'MIT', name: 'MIT License' },
    pushedAt: new Date(NOW - 10 * DAY).toISOString(),
    hasIssues: true,
    htmlUrl: 'https://github.com/owner/selfhosted-tool',
    homepage: '',
    ownerType: 'User',
    isFork: false,
    hasWiki: true,
    ...overrides,
  };
}
function factorOf(card, key) {
  const f = card.factors.find((x) => x.key === key);
  assert.ok(f, 'factor ' + key + ' 缺失');
  return f;
}

test('FACTOR_DEFS 满分合计 = 100', () => {
  assert.equal(FACTOR_DEFS.reduce((s, f) => s + f.max, 0), SCORE_MAX);
});

test('热度: log10(stars+1)*5，封顶 20', () => {
  const pop = (stars) => factorOf(computeScore(repo({ stars }), { now: NOW }), 'popularity').points;
  assert.ok(pop(10_000) > pop(1000));
  assert.equal(pop(1000000), 20);
  assert.equal(pop(0), 0);
});

test('需求: open_issues/150，封顶 15', () => {
  const dem = (n) => factorOf(computeScore(repo({ openIssues: n }), { now: NOW }), 'demand').points;
  assert.equal(dem(150), 1);
  assert.equal(dem(1500), 10);
  assert.equal(dem(100000), 15);
});

test('活跃度: <=180d 10 分，<=365d 4 分，更久 0 分', () => {
  const act = (pushedAt) => factorOf(computeScore(repo({ pushedAt }), { now: NOW }), 'activity').points;
  assert.equal(act(new Date(NOW - 180 * DAY).toISOString()), 10);
  assert.equal(act(new Date(NOW - 181 * DAY).toISOString()), 4);
  assert.equal(act(new Date(NOW - 400 * DAY).toISOString()), 0);
  assert.equal(act(null), 0);
});

test('健康: 未归档/有issue/有desc/有wiki 合计 15', () => {
  const card = computeScore(repo(), { now: NOW });
  assert.equal(factorOf(card, 'health').points, 15);
  const archived = computeScore(repo({ archived: true, hasIssues: false, description: null, hasWiki: false }), { now: NOW });
  assert.ok(factorOf(archived, 'health').points < 15);
});

test('商业化：有产品官网会被标记已商业化', () => {
  const c = computeScore(repo({ homepage: 'https://vendor.example' }), { now: NOW });
  assert.equal(c.commercialized, true);
  assert.ok(c.gap < gapFactor(repo(), { queryTopic: 'self-hosted' }));
});

test('商业化: 描述含 cloud/saas 等词标记已商业化且 gap 降低', () => {
  const c = computeScore(repo({ description: 'The managed cloud platform for teams' }), { now: NOW });
  assert.equal(c.commercialized, true);
});

test('自托管无官网项目: 高 gap、未商业化、偏高总分', () => {
  const c = computeScore(repo(), { now: NOW, queryTopic: 'self-hosted' });
  assert.equal(c.commercialized, false);
  assert.ok(c.gap >= 30, 'gap 应较高，实际 ' + c.gap);
  assert.ok(c.score >= 70, '高空白高需求应得高分，实际 ' + c.score);
});

test('已被公司化的大项目: gap 为负、总分被压低', () => {
  const c = computeScore(repo({ stars: 200000, homepage: 'https://vendor.example', description: 'enterprise cloud platform' }), { now: NOW });
  assert.equal(c.commercialized, true);
  assert.ok(c.gap <= 0, '公司化大项目 gap 应 <= 0，实际 ' + c.gap);
  assert.ok(c.score < 60, '公司化大项目应被压低，实际 ' + c.score);
});

test('commercialized 大项目排名低于高空白项目', () => {
  const giant = computeScore(repo({ stars: 200000, homepage: 'https://vendor.example', description: 'enterprise cloud platform' }), { now: NOW });
  const gap = computeScore(repo(), { now: NOW, queryTopic: 'self-hosted' });
  assert.ok(gap.score > giant.score, gap.score + ' 应 > ' + giant.score);
});

test('detectCommercialSignals: 产品官网+关键词+巨型 = 已商业化', () => {
  const d = detectCommercialSignals(repo({ homepage: 'https://x.com', description: 'enterprise cloud', stars: 90000 }));
  assert.equal(d.commercialized, true);
  assert.ok(d.signals.includes('productSite'));
  assert.ok(d.signals.includes('hostedKeyword'));
  assert.ok(d.signals.includes('huge'));
});

test('detectCommercialSignals: self-hosted 描述不误判 hostedKeyword', () => {
  const d = detectCommercialSignals(repo({ description: 'A self-hosted dashboard for your feeds', homepage: '' }));
  assert.equal(d.commercialized, false);
  assert.ok(d.signals.includes('noHomepage'));
  assert.ok(!d.signals.includes('hostedKeyword'));
});

test('gradeFor 阈值: 75/60/45', () => {
  assert.equal(gradeFor(100).code, 'A');
  assert.equal(gradeFor(75).code, 'A');
  assert.equal(gradeFor(74).code, 'B');
  assert.equal(gradeFor(60).code, 'B');
  assert.equal(gradeFor(45).code, 'C');
  assert.equal(gradeFor(44).code, 'D');
});

test('确定性: 相同输入 + 固定 now 结果一致', () => {
  const a = computeScore(repo(), { now: NOW });
  const b = computeScore(repo(), { now: NOW });
  assert.equal(a.score, b.score);
  assert.deepEqual(a.factors, b.factors);
});

test('容错: 缺失/异常字段不抛错', () => {
  assert.doesNotThrow(() => computeScore(undefined, { now: NOW }));
  assert.doesNotThrow(() => computeScore({}, { now: NOW }));
  assert.doesNotThrow(() => computeScore({ stars: 'abc', openIssues: NaN, pushedAt: 'x', license: null }, { now: NOW }));
});
