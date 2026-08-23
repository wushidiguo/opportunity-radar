// 洞察引擎纯函数测试（离线，合成数据）
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyDemand, detectMonetization, refineScore, buildReason } from '../src/insight.mjs';

test('classifyDemand: 按关键词给 issue 计数并采样', () => {
  const issues = [
    { title: 'Please add a hosted cloud version', body: '', comments: 0 },
    { title: 'I would be happy to pay for a mobile app', body: '', comments: 3 },
    { title: 'Feature request: desktop client', body: 'would be great', comments: 0 },
    { title: 'Add REST API / webhook support', body: '', comments: 1 },
    { title: 'Just a bug report', body: 'it crashes', comments: 5 },
  ];
  const d = classifyDemand(issues);
  assert.equal(d.total, 4); // 4 条命中需求信号（bug 不算）
  const c = d.counts;
  assert.equal(c.hosted, 1);                                   // "hosted cloud version"
  assert.equal(c.api, 1);                                      // "REST API / webhook"
  assert.ok(c.paid >= 1);                                      // "pay for"
  assert.ok(c.mobile >= 1);                                    // "mobile app"（可与 paid 重叠）
  assert.ok(c.feature >= 1);                                   // "Feature request"/"would be great"（可与 hosted 重叠）
  assert.ok(d.buckets.find(b => b.key === 'feature').samples.length >= 1);
});

test('classifyDemand: 统计无回复 issue', () => {
  const d = classifyDemand([
    { title: 'add mobile app', body: '', comments: 0 },
    { title: 'bug', body: '', comments: 0 },
    { title: 'hosted please', body: '', comments: 2 },
  ]);
  assert.equal(d.unanswered, 2);
});

test('detectMonetization: 有定价/付费词 → 已商业化', () => {
  const m = detectMonetization('Start free. Plans from $29/mo. Cloud & enterprise available.');
  assert.equal(m.isMonetized, true);
  assert.equal(m.hasPricing, true);
  assert.equal(m.hasCloud, true);
});

test('detectMonetization: 自托管无定价 → 未商业化', () => {
  const m = detectMonetization('Self-hosted. Run with docker compose. Fully open source.');
  assert.equal(m.isMonetized, false);
  assert.equal(m.hasSelfHost, true);
});

test('refineScore: 强需求+未商业化 → 加分', () => {
  const insight = { demand: { counts: { hosted: 5, paid: 3, mobile: 4, api: 10, feature: 20 }, total: 42, unanswered: 70 }, commercialization: { isMonetized: false } };
  const score = refineScore(60, insight);
  assert.ok(score > 60, '应有加分，实际 ' + score);
});

test('refineScore: 需求空洞 → 扣分', () => {
  const insight = { demand: { counts: { hosted: 0, paid: 0, mobile: 0, api: 0, feature: 0 }, total: 0, unanswered: 5 }, commercialization: { isMonetized: false } };
  const score = refineScore(80, insight);
  assert.ok(score < 80, '需求空洞应扣分，实际 ' + score);
});

test('refineScore: 已商业化 → 扣分', () => {
  const insight = { demand: { counts: { hosted: 2, paid: 0, mobile: 1, api: 1, feature: 3 }, total: 7, unanswered: 2 }, commercialization: { isMonetized: true } };
  const score = refineScore(70, insight);
  assert.ok(score < 70, '已商业化应扣分，实际 ' + score);
});

test('buildReason: 生成含诉求与商业化的中文叙述', () => {
  const insight = {
    demand: { counts: { hosted: 3, paid: 0, mobile: 2, api: 1, feature: 9 }, total: 15, unanswered: 38 },
    commercialization: { isMonetized: false, hasSelfHost: true, hasPricing: false, hasCloud: false },
  };
  const reason = buildReason(insight);
  assert.ok(reason.includes('hosted/cloud 3'));
  assert.ok(reason.includes('features 9'));
  assert.match(reason, /strong case for a hosted|real gap/);
  assert.match(reason, /unanswered issues/);
});

test('buildReason: 已商业化时说明', () => {
  const insight = {
    demand: { counts: { hosted: 1, paid: 0, mobile: 0, api: 0, feature: 2 }, total: 3, unanswered: 0 },
    commercialization: { isMonetized: true, hasPricing: true, hasCloud: true },
  };
  const reason = buildReason(insight);
  assert.match(reason, /pricing/);
});
