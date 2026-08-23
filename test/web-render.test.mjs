// 前端渲染逻辑测试：在 Node vm 中加载 app.js，用 stub DOM 驱动完整渲染管线
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

function makeElement() {
  return {
    innerHTML: '',
    textContent: '',
    value: '',
    addEventListener() {},
    setAttribute() {},
    classList: { toggle() {}, add() {}, contains() { return false; } },
    querySelectorAll() { return []; },
  };
}

function runApp(snapshot) {
  const elements = {};
  const sandbox = {
    document: {
      getElementById(id) {
        if (!elements[id]) elements[id] = makeElement();
        return elements[id];
      },
      addEventListener(event, cb) {
        if (event === 'DOMContentLoaded') sandbox.__ready = cb;
      },
    },
    localStorage: { getItem() { return '[]'; }, setItem() {} },
    fetch: () => Promise.resolve({ ok: true, json: () => Promise.resolve(snapshot) }),
    console,
    Set,
    Date,
    Promise,
    Math,
  };
  const code = readFileSync(path.join(ROOT, 'web', 'app.js'), 'utf8');
  const context = vm.createContext(sandbox);
  vm.runInContext(code, context);
  assert.ok(sandbox.__ready, 'DOMContentLoaded handler not registered');
  sandbox.__ready();
  return elements;
}

test('渲染管线生成机会卡片', async () => {
  const snapshot = JSON.parse(readFileSync(path.join(ROOT, 'web', 'data', 'opportunities.json'), 'utf8'));
  const elements = runApp(snapshot);
  await new Promise((r) => setTimeout(r, 50));

  const cardsHTML = elements.cards.innerHTML;
  assert.ok(cardsHTML.length > 0, 'cards 渲染为空');
  assert.match(cardsHTML, /class="card"/, '应有卡片节点');
  assert.match(cardsHTML, /class="ring-inner"/, '应有评分环');
  assert.match(cardsHTML, /class="badge [ABCD]"/, '应有等级徽章');
  assert.match(cardsHTML, /github\.com\//, '应有仓库链接');
  assert.match(elements.status.textContent, /个机会/, '应有状态文案');
  assert.match(elements.meta.textContent, /数据快照/, '应有元信息');

  const topCard = snapshot.topics[Object.keys(snapshot.topics)[0]][0];
  assert.ok(cardsHTML.includes(topCard.repo.fullName), '缺少最高分仓库: ' + topCard.repo.fullName);

  // 若最高分卡片有洞察，则应渲染"洞见"框（这是产品的核心价值）
  if (topCard.insight) {
    assert.match(cardsHTML, /💡 洞见/, '应有洞见框');
    assert.match(cardsHTML, /insight-reason/, '应有洞见理由');
  }
});

test('渲染结果包含机会分', async () => {
  const snapshot = JSON.parse(readFileSync(path.join(ROOT, 'web', 'data', 'opportunities.json'), 'utf8'));
  const elements = runApp(snapshot);
  await new Promise((r) => setTimeout(r, 50));
  assert.match(elements.cards.innerHTML, /机会分 \d+\/100/, '缺少机会分显示');
});
