# OSS Opportunity Radar

开源商业化机会雷达：从 GitHub 数据自动发现"用户需求很强但还没人做好商业化"的开源机会。

> 🌐 **在线地址：** [https://wushidiguo.github.io/opportunity-radar/](https://wushidiguo.github.io/opportunity-radar/)
>（由 GitHub Actions 每日自动更新数据快照并发布；洞察来自对 open issue 与 README 的文本挖掘）

## 已实现（v0.5.0）

- **洞察引擎**（`src/insight.mjs`）：**挖掘 open issue 文本 + README**，给出"用户为何付费"的数据化理由——统计托管/云、付费、移动端、API/集成、功能诉求与"无人回复"数量，并从 README 检测是否有定价/付费/托管版。每张机会卡片都会显示一句**数据化洞见**（如："41 个信号，37 条功能诉求，33 条 issue 无人回复，README 无定价 → 商业化空白，适合做托管版"）
- **Web App**（`web/`）：机会卡片浏览器 — 按 topic 切换、搜索、排序、最低分过滤、保存机会、显示"已商业化/商业化空白"标签、机会分因子与**洞见理由**
- **评分引擎 v2**（`src/score.mjs`）：不只奖励热度，而是衡量"商业化空白"——明显已公司化/托管化的项目（Supabase、ComfyUI、n8n、Hermes）自动标记"已商业化"并压分；强需求且无商业化产品的项目排名靠前
- **数据获取**（`src/fetch.mjs`）：`gh search repos` 实时数据；`--demo` 模式读本地 fixture 离线可用
- **CLI**（`bin/opportunity-radar.mjs`）：table / json / csv 三种输出，支持 `--min-score` 过滤、`--out` 写文件
- **数据管线**（`scripts/build-snapshot.mjs`）：拉取较大候选池 → 评分 → **对 Top 机会挖掘洞察** → 生成 Web 数据快照
- **测试**（`test/`）：46 个单元 + 集成 + 渲染 + 洞察测试（`node --test`）
- **CI/CD**（`.github/workflows/`）：CI 测试 + 每日数据快照 + GitHub Pages 自动发布

## 快速开始

```bash
# Web App 本地预览
node scripts/serve.mjs
# 打开 http://localhost:4173

# 离线演示（不需要 gh）
node bin/opportunity-radar.mjs ai 10 --demo

# 实时数据（需要 gh 已登录）
node bin/opportunity-radar.mjs ai 10

# 重建 Web 数据快照（拉较大候选池、按"机会分"排名、默认排除清单/教程类）
node scripts/build-snapshot.mjs --topics ai,self-hosted,database,devops,llm --pool 100 --top 30

# 运行测试
npm test
```

## Opportunity Score（0~100）

| 因子 | 满分 | 说明 |
|---|---|---|
| popularity | 20 | log10(stars+1) × 5（sublinear，避免大项目霸榜） |
| demand | 15 | open_issues / 150 |
| activity | 10 | 180 天内 push 10 分；365 天内 4 分 |
| health | 15 | 未归档 + 有 issue + 有描述 + 有 wiki |
| **gap** | **40（可负）** | **商业化空白（核心）**：有官网/托管/云产品则扣分，越"空白"越高分 |

**gap 信号**：有产品官网（非 GitHub）、描述含 cloud/saas/enterprise/managed 等关键词 → 判"已商业化"并扣分；无官网、自托管 topic、宽松许可证 → 加分。Stars 极大（>12 万）会被"已商业化"重罚。

等级：A 强机会 ≥75 ｜ B 中机会 ≥60 ｜ C 弱机会 ≥45 ｜ D 低信号 <45

## 项目结构

```text
opportunity-radar/
  bin/opportunity-radar.mjs   # CLI 入口
  src/
    score.mjs                 # 评分引擎（纯函数）
    fetch.mjs                 # gh CLI / fixture 取数
    render.mjs                # table/json/csv 渲染
    cli.mjs                   # 参数解析 + 主流程
  scripts/
    build-snapshot.mjs        # 生成 Web 数据快照
    serve.mjs                 # 本地静态服务器
  web/
    index.html                # Web App 页面
    app.js                    # 前端逻辑（无构建步骤）
    style.css
    data/opportunities.json   # 数据快照（CI 自动更新）
  test/                       # 单元/集成/渲染测试
  docs/                       # 需求/架构/测试/上线清单
  .github/workflows/          # CI + 每日快照 + Pages 发布
```

## 下一步（人工前置条件）

- [ ] 邮件服务（Resend/Buttondown）域名验证 → AI 周报订阅
- [ ] Stripe 产品/价格 → 付费解锁 CSV/API 导出
- [ ] 自定义域名绑定（当前用 GitHub Pages 默认域名）
- [ ] GH Archive/BigQuery → 历史趋势与 LLM 需求聚类

详见 `docs/launch-checklist.md` 和根目录 `OPPORTUNITY_RADAR_PRODUCT_SPEC.md`。
