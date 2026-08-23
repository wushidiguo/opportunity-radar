// CLI 集成测试（demo 模式离线运行）
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BIN = path.join(__dirname, '..', 'bin', 'opportunity-radar.mjs');

function run(args) {
  return spawnSync(process.execPath, [BIN, ...args], { encoding: 'utf8' });
}

test('demo 表格输出包含标题、仓库和因子说明', () => {
  const r = run(['ai', '5', '--demo']);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /OSS Opportunity Radar/);
  assert.match(r.stdout, /\w+\/\w+/); // owner/repo 出现在表格
  assert.match(r.stdout, /Factors:/);
});

test('demo JSON 输出可解析且按分数降序', () => {
  const r = run(['ai', '10', '--demo', '--format', 'json']);
  assert.equal(r.status, 0, r.stderr);
  const cards = JSON.parse(r.stdout);
  assert.ok(cards.length >= 1 && cards.length <= 10, 'demo 输出应 1..10，实际 ' + cards.length);
  for (let i = 1; i < cards.length; i++) {
    assert.ok(cards[i - 1].score >= cards[i].score);
  }
  assert.ok(cards[0].factors.length > 0);
  assert.ok(cards[0].repo.fullName);
  assert.ok(typeof cards[0].gap === 'number');
  assert.ok(typeof cards[0].commercialized === 'boolean');
});

test('demo CSV 输出包含 v2 因子列和表头', () => {
  const r = run(['self-hosted', '5', '--demo', '--format', 'csv']);
  assert.equal(r.status, 0, r.stderr);
  const lines = r.stdout.trim().split('\n');
  const header = lines[0].split(',');
  for (const col of ['rank', 'score', 'grade', 'gap', 'repo', 'popularity', 'demand', 'activity', 'health']) {
    assert.ok(header.includes(col), 'missing column ' + col);
  }
  assert.ok(lines.length >= 2 && lines.length <= 6, '1 header + <=5 rows, 实际 ' + lines.length);
});

test('--min-score 过滤生效', () => {
  const r = run(['ai', '10', '--demo', '--format', 'json', '--min-score', '70']);
  assert.equal(r.status, 0, r.stderr);
  const cards = JSON.parse(r.stdout);
  assert.ok(cards.length > 0 && cards.length <= 10);
  for (const c of cards) assert.ok(c.score >= 70);
});

test('limit 生效', () => {
  const r = run(['ai', '3', '--demo', '--format', 'json']);
  const cards = JSON.parse(r.stdout);
  assert.ok(cards.length >= 1 && cards.length <= 3, 'limit 3 输出应 <=3，实际 ' + cards.length);
});

test('未知 topic 在 demo 模式下报错且非零退出', () => {
  const r = run(['no-such-topic-xyz', '3', '--demo']);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /Error/);
});

test('--help 正常退出', () => {
  const r = run(['--help']);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /Usage/);
});

test('缺 topic 参数报错', () => {
  const r = run([]);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /missing/);
});
