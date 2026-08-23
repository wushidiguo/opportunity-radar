// GitHub 数据获取：优先走 gh CLI（真实数据），--demo 时读本地 fixture（离线可用）
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_PATH = path.join(__dirname, '..', 'test', 'fixtures', 'repos.json');

const GH_FIELDS = 'fullName,description,stargazersCount,openIssuesCount,isArchived,license,pushedAt,hasIssues,url';

/** 把 gh search 返回的仓库归一化为评分引擎使用的形状。 */
export function normalizeRepo(r = {}) {
  return {
    fullName: r.fullName || 'unknown/unknown',
    description: r.description ?? null,
    stars: Number(r.stargazersCount) || 0,
    openIssues: Number(r.openIssuesCount) || 0,
    archived: Boolean(r.isArchived),
    license: r.license && r.license.key ? { key: r.license.key, name: r.license.name } : null,
    pushedAt: r.pushedAt ?? null,
    hasIssues: Boolean(r.hasIssues),
    htmlUrl: r.url || `https://github.com/${r.fullName}`,
  };
}

/** 按 topic 搜索热门仓库。opts.demo=true 时读本地 fixture。 */
export function searchReposByTopic(topic, limit = 10, opts = {}) {
  if (opts.demo) return loadFixture(topic).slice(0, limit);

  const args = [
    'search', 'repos',
    `topic:${topic}`,
    '--limit', String(limit),
    '--sort', 'stars',
    '--json', GH_FIELDS,
  ];
  const res = spawnSync('gh', args, {
    encoding: 'utf8',
    env: { ...process.env, GH_NO_UPDATE_NOTIFIER: '1' },
  });
  if (res.status !== 0) {
    const err = new Error(`gh search failed for topic "${topic}": ${(res.stderr || '').trim() || 'unknown error'}`);
    err.hint = '请确认已安装并登录 GitHub CLI（gh auth login），或使用 --demo 以本地 fixture 离线运行。';
    throw err;
  }
  const rows = JSON.parse(res.stdout);
  return rows.map(normalizeRepo);
}

/** 读取本地 fixture 数据（离线演示/测试用）。 */
export function loadFixture(topic) {
  if (!existsSync(FIXTURE_PATH)) {
    throw new Error(`fixture 文件不存在: ${FIXTURE_PATH}`);
  }
  const data = JSON.parse(readFileSync(FIXTURE_PATH, 'utf8'));
  const repos = data[topic] ?? data[String(topic).toLowerCase()];
  if (!repos) {
    throw new Error(`topic "${topic}" 无 fixture 数据（可用: ${Object.keys(data).join(', ')}）`);
  }
  return repos.map(normalizeRepo);
}
