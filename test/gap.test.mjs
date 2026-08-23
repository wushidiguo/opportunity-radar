// 商业化空白检测测试：用真实案例校准（Supabase/n8n/ComfyUI 应判已商业化；glance 判空白）
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectCommercialSignals, gapFactor } from '../src/score.mjs';

function mk(o) {
  return { stars: 0, openIssues: 0, archived: false, license: { key: 'MIT' }, hasIssues: true, description: '', homepage: '', ownerType: 'User', isFork: false, hasWiki: true, ...o };
}

test('supabase: 有产品官网 + 托管关键词 + 巨型 → 已商业化', () => {
  const d = detectCommercialSignals(mk({ homepage: 'https://supabase.com', description: 'dedicated Postgres database', ownerType: 'Organization', stars: 108287 }));
  assert.equal(d.commercialized, true);
  assert.ok(d.signals.includes('productSite'));
  assert.ok(d.signals.includes('hostedKeyword'));
});

test('n8n: 描述含 self-host or cloud → 已商业化（cloud 关键词命中）', () => {
  const d = detectCommercialSignals(mk({ homepage: 'https://n8n.io', description: 'self-host or cloud, 400+ integrations', ownerType: 'Organization', stars: 201849 }));
  assert.equal(d.commercialized, true);
});

test('ComfyUI: 官网 comfy.org → 已商业化', () => {
  const d = detectCommercialSignals(mk({ homepage: 'https://www.comfy.org/', ownerType: 'Organization', stars: 129018 }));
  assert.equal(d.commercialized, true);
});

test('glance (自托管,无官网): 未商业化，高 gap', () => {
  const repo = mk({ homepage: '', description: 'A self-hosted dashboard that puts all your feeds in one place', ownerType: 'Organization', stars: 36531 });
  const d = detectCommercialSignals(repo);
  assert.equal(d.commercialized, false);
  assert.ok(d.signals.includes('noHomepage'));
  assert.ok(!d.signals.includes('hostedKeyword'));
  assert.equal(gapFactor(repo, { queryTopic: 'self-hosted' }) >= 30, true);
});

test('无官网但已是公司化组织(如 turso 类)会因无 homepage 获得一定 gap（已知局限）', () => {
  // 说明性断言：这类项目通过 org 类型 + 无 homepage 会被判"部分空白"，但不当作强信号
  const repo = mk({ homepage: '', description: 'A SQL database in Rust, SQLite-compatible', ownerType: 'Organization', stars: 24000 });
  const d = detectCommercialSignals(repo);
  assert.equal(d.commercialized, false); // 无官网无关键词时为 false（诚实处理，不做过度推断）
  assert.ok(!d.signals.includes('productSite'));
});
