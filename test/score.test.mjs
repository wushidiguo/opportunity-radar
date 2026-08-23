// Opportunity Score 引擎单元测试（纯函数，无 I/O）
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeScore, gradeFor, FACTOR_DEFS, SCORE_MAX } from '../src/score.mjs';

// 固定"现在"，保证测试确定性（fixture 里最新 push 是 2026-08 附近）
const NOW = Date.parse('2026-08-25T00:00:00Z');

function repo(overrides = {}) {
  return {
    fullName: 'owner/repo',
    description: 'A great open source project',
    stars: 1000,
    openIssues: 50,
    archived: false,
    license: { key: 'mit', name: 'MIT License' },
    pushedAt: '2026-08-01T00:00:00Z', // 24 天前
    hasIssues: true,
    htmlUrl: 'https://github.com/owner/repo',
    ...overrides,
  };
}

function factorOf(card, key) {
  const f = card.factors.find((x) => x.key === key);
  assert.ok(f, `factor ${key} should exist`);
  return f;
}

test('FACTOR_DEFS 满分合计 = 100', () => {
  assert.equal(FACTOR_DEFS.reduce((s, f) => s + f.max, 0), SCORE_MAX);
});

test('理想仓库得分 100 且所有因子满分', () => {
  const card = computeScore(repo({ openIssues: 1000 }), { now: NOW }); // 1000/50=20 需求满分
  assert.equal(card.score, 100);
  assert.equal(card.total, 100);
  assert.equal(card.grade.code, 'A');
  for (const f of FACTOR_DEFS) {
    assert.equal(factorOf(card, f.key).points, f.max, `${f.key} should be max`);
  }
});

test('热度: log10(stars)*10，封顶 30', () => {
  assert.equal(factorOf(computeScore(repo({ stars: 10 }), { now: NOW }), 'popularity').points, 10);
  assert.equal(factorOf(computeScore(repo({ stars: 100 }), { now: NOW }), 'popularity').points, 20);
  assert.equal(factorOf(computeScore(repo({ stars: 1_000_000_000 }), { now: NOW }), 'popularity').points, 30);
  assert.equal(factorOf(computeScore(repo({ stars: 0 }), { now: NOW }), 'popularity').points, 0);
});

test('需求: open_issues/50，封顶 20，可产生小数分', () => {
  assert.equal(factorOf(computeScore(repo({ openIssues: 25 }), { now: NOW }), 'demand').points, 0.5);
  assert.equal(factorOf(computeScore(repo({ openIssues: 1000 }), { now: NOW }), 'demand').points, 20);
  assert.equal(factorOf(computeScore(repo({ openIssues: 0 }), { now: NOW }), 'demand').points, 0);
});

test('活跃度: <=180 天 15 分，<=365 天 5 分，更久 0 分', () => {
  const day = 86400000;
  assert.equal(factorOf(computeScore(repo({ pushedAt: new Date(NOW - 180 * day).toISOString() }), { now: NOW }), 'activity').points, 15);
  assert.equal(factorOf(computeScore(repo({ pushedAt: new Date(NOW - 181 * day).toISOString() }), { now: NOW }), 'activity').points, 5);
  assert.equal(factorOf(computeScore(repo({ pushedAt: new Date(NOW - 365 * day).toISOString() }), { now: NOW }), 'activity').points, 5);
  assert.equal(factorOf(computeScore(repo({ pushedAt: new Date(NOW - 366 * day).toISOString() }), { now: NOW }), 'activity').points, 0);
  assert.equal(factorOf(computeScore(repo({ pushedAt: null }), { now: NOW }), 'activity').points, 0);
});

test('归档仓库失去 10 分', () => {
  const base = computeScore(repo(), { now: NOW }).score;
  const archived = computeScore(repo({ archived: true }), { now: NOW });
  assert.equal(archived.score, base - 10);
  assert.equal(factorOf(archived, 'notArchived').points, 0);
});

test('无 issue tracker 失去 10 分', () => {
  const base = computeScore(repo(), { now: NOW }).score;
  const noTracker = computeScore(repo({ hasIssues: false }), { now: NOW });
  assert.equal(noTracker.score, base - 10);
});

test('license 为 other 或缺失时失去 5 分', () => {
  const base = computeScore(repo(), { now: NOW }).score;
  assert.equal(computeScore(repo({ license: { key: 'other', name: 'Other' } }), { now: NOW }).score, base - 5);
  assert.equal(computeScore(repo({ license: null }), { now: NOW }).score, base - 5);
  assert.equal(factorOf(computeScore(repo({ license: {} }), { now: NOW }), 'license').points, 0);
  assert.equal(factorOf(computeScore(repo(), { now: NOW }), 'license').points, 5);
});

test('无 description 失去 5 分', () => {
  const base = computeScore(repo(), { now: NOW }).score;
  assert.equal(computeScore(repo({ description: null }), { now: NOW }).score, base - 5);
  assert.equal(computeScore(repo({ description: '' }), { now: NOW }).score, base - 5);
});

test('issue/star 比例 < 0.02 失去 5 分（边界 0.02 恰好达标）', () => {
  assert.equal(factorOf(computeScore(repo({ openIssues: 10 }), { now: NOW }), 'issueRatio').points, 0); // 0.01
  assert.equal(factorOf(computeScore(repo({ openIssues: 20 }), { now: NOW }), 'issueRatio').points, 5); // 恰好 0.02
  assert.equal(factorOf(computeScore(repo({ openIssues: 100 }), { now: NOW }), 'issueRatio').points, 5); // 0.1
});

test('几乎无信号的仓库得分很低但不为负', () => {
  const card = computeScore(repo({
    stars: 0, openIssues: 0, description: null, license: null,
    hasIssues: false, pushedAt: null, archived: true,
  }), { now: NOW });
  assert.ok(card.score >= 0);
  assert.ok(card.score < 25);
  assert.equal(card.grade.code, 'D');
});

test('得分确定性: 相同输入 + 固定 now 得到相同结果', () => {
  const a = computeScore(repo(), { now: NOW });
  const b = computeScore(repo(), { now: NOW });
  assert.equal(a.score, b.score);
  assert.deepEqual(a.factors, b.factors);
});

test('gradeFor 阈值: 65/45/25', () => {
  assert.equal(gradeFor(100).code, 'A');
  assert.equal(gradeFor(65).code, 'A');
  assert.equal(gradeFor(64).code, 'B');
  assert.equal(gradeFor(45).code, 'B');
  assert.equal(gradeFor(44).code, 'C');
  assert.equal(gradeFor(25).code, 'C');
  assert.equal(gradeFor(24).code, 'D');
  assert.equal(gradeFor(0).code, 'D');
});

test('容错: 缺失/异常字段不抛错', () => {
  assert.doesNotThrow(() => computeScore(undefined, { now: NOW }));
  assert.doesNotThrow(() => computeScore({}, { now: NOW }));
  assert.doesNotThrow(() => computeScore({ stars: 'abc', openIssues: NaN, pushedAt: 'not-a-date' }, { now: NOW }));
});
