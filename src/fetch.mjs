// GitHub 数据获取：优先走 gh CLI（真实数据），--demo 时读本地 fixture（离线可用）
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_PATH = path.join(__dirname, '..', 'test', 'fixtures', 'repos.json');

const GH_FIELDS = 'fullName,description,stargazersCount,openIssuesCount,isArchived,license,pushedAt,hasIssues,url,homepage,forksCount,owner,hasWiki,isFork,language';

/** 把 gh search 返回的仓库归一化为评分引擎使用的形状。 */
export function normalizeRepo(r = {}) {
  const license = r.license && r.license.key && r.license.key !== 'other' ? r.license.key : null;
  return {
    fullName: r.fullName || 'unknown/unknown',
    description: r.description ?? null,
    stars: Number(r.stargazersCount) || 0,
    openIssues: Number(r.openIssuesCount) || 0,
    archived: Boolean(r.isArchived),
    license: r.license && r.license.key ? { key: r.license.key, name: r.license.name } : null,
    pushedAt: r.pushedAt ?? null,
    hasIssues: Boolean(r.hasIssues),
    htmlUrl: r.url || ('https://github.com/' + r.fullName),
    homepage: r.homepage || '',
    forks: Number(r.forksCount) || 0,
    ownerType: (r.owner && r.owner.type) || null,
    isFork: Boolean(r.isFork),
    hasWiki: Boolean(r.hasWiki),
    language: r.language || null,
  };
}

/** 判断是否为 curated list / 聚合清单仓库（非真实产品，应排除）。 */
export function isListRepo(repo = {}) {
  const name = (repo.fullName || '').split('/').pop().toLowerCase();
  return name.startsWith('awesome-') || /(-|\/)list$/.test(name) || name.includes('awesome');
}

/** 判断是否为"内容/学习/合集"型仓库（教程、指南、书单、合集——不是可商业化产品）。 */
export function isContentRepo(repo = {}) {
  const name = (repo.fullName || '').split('/').pop().toLowerCase();
  const desc = (repo.description || '').toLowerCase();
  const nameHit = /(awesome|beginners?|lessons?|tutorial|guide|books?|resources?|cheat|roadmap|notes|course|curated|examples?|answers?|questions?|leetcode|interview|20\d\d-|-in-\d|-beginners|system-?prompt|prompt-?leak|models-of-ai-tools|ai-?tools)/.test(name);
  const descHit = /(guide|tutorial|lessons?|curated|collection|list of|learn (about|how)|introduc|course|cheat|resources|教程|指南|学习|课程|笔记|入门|书籍|合集|清单|习题|答案|extracted system prompts|leaked system prompts)/.test(desc);
  return nameHit || descHit;
}

/** 按 topic 搜索热门仓库。opts.demo=true 时读本地 fixture。 */
export function searchReposByTopic(topic, limit = 10, opts = {}) {
  if (opts.demo) return loadFixture(topic).slice(0, limit);
  const args = ['search', 'repos', 'topic:' + topic, '--limit', String(limit), '--sort', 'stars', '--json', GH_FIELDS];
  const res = spawnSync('gh', args, { encoding: 'utf8', env: { ...process.env, GH_NO_UPDATE_NOTIFIER: '1' } });
  if (res.status !== 0) {
    const err = new Error('gh search failed for topic "' + topic + '": ' + ((res.stderr || '').trim() || 'unknown error'));
    err.hint = '请确认已安装并登录 GitHub CLI（gh auth login），或使用 --demo 以本地 fixture 离线运行。';
    throw err;
  }
  return JSON.parse(res.stdout).map(normalizeRepo);
}

/** 读取本地 fixture 数据（离线演示/测试用）。 */
export function loadFixture(topic) {
  if (!existsSync(FIXTURE_PATH)) throw new Error('fixture 文件不存在: ' + FIXTURE_PATH);
  const data = JSON.parse(readFileSync(FIXTURE_PATH, 'utf8'));
  const repos = data[topic] ?? data[String(topic).toLowerCase()];
  if (!repos) throw new Error('topic "' + topic + '" 无 fixture 数据（可用: ' + Object.keys(data).join(', ') + '）');
  return repos.map(normalizeRepo);
}
