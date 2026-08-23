// Web 数据快照结构校验 + 前端静态文件健全性检查
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

function read(p) {
  return readFileSync(path.join(ROOT, p), 'utf8');
}

test('数据快照存在且结构完整', () => {
  const raw = read('web/data/opportunities.json');
  const data = JSON.parse(raw);
  assert.ok(data.generatedAt, 'generatedAt 字段缺失');
  assert.equal(data.scoreMax, 100);
  assert.ok(Object.keys(data.topics).length >= 3, '应至少 3 个 topic');
  for (const [topic, cards] of Object.entries(data.topics)) {
    assert.ok(cards.length > 0, topic + ' 无卡片');
    for (const card of cards) {
      assert.ok(card.score >= 0 && card.score <= 100, topic + ' score 越界: ' + card.score);
      assert.ok(card.grade && card.grade.code, topic + ' 缺 grade');
      assert.ok(card.repo && card.repo.fullName, topic + ' 缺 repo');
      assert.ok(Array.isArray(card.factors) && card.factors.length > 0, topic + ' 缺 factors');
      assert.ok(card.repo.htmlUrl && card.repo.htmlUrl.startsWith('https://'), topic + ' htmlUrl 异常');
    }
  }
});

test('快照按机会分降序排列', () => {
  const data = JSON.parse(read('web/data/opportunities.json'));
  for (const [topic, cards] of Object.entries(data.topics)) {
    for (let i = 1; i < cards.length; i++) {
      assert.ok(cards[i - 1].score >= cards[i].score, topic + ' 未按分数降序: ' + cards[i - 1].repo.fullName);
    }
  }
});

test('index.html 引用 app.js 与 style.css', () => {
  const html = read('web/index.html');
  assert.match(html, /<script src="app.js">/);
  assert.match(html, /<link rel="stylesheet" href="style.css" \/>/);
});

test('app.js 语法合法（node --check）', () => {
  const res = spawnSync(process.execPath, ['--check', path.join(ROOT, 'web', 'app.js')], { encoding: 'utf8' });
  assert.equal(res.status, 0, res.stderr);
});

test('app.js 引用 data/opportunities.json', () => {
  assert.match(read('web/app.js'), /data\/opportunities\.json/);
});

test('build-snapshot --demo 可离线生成快照', () => {
  const out = path.join(ROOT, 'web', 'data', 'demo-check.json');
  const res = spawnSync(process.execPath, [
    path.join(ROOT, 'scripts', 'build-snapshot.mjs'),
    '--demo', '--topics', 'ai,database', '--limit', '5', '--out', out,
  ], { encoding: 'utf8' });
  assert.equal(res.status, 0, res.stderr);
  const data = JSON.parse(readFileSync(out, 'utf8'));
  assert.equal(data.topics.ai.length, 5);
  assert.equal(data.topics.database.length, 5);
  rmSync(out, { force: true });
});

test('静态页面必需文件齐全', () => {
  for (const f of ['web/index.html', 'web/app.js', 'web/style.css', 'web/data/opportunities.json']) {
    assert.ok(existsSync(path.join(ROOT, f)), f + ' 不存在');
  }
});
