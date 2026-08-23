# OSS Opportunity Radar

开源商业化机会雷达：从 GitHub 数据自动发现"用户需求很强但还没人做好商业化"的开源机会。

> 🌐 **在线地址：** [https://wushidiguo.github.io/opportunity-radar/](https://wushidiguo.github.io/opportunity-radar/)
>（由 GitHub Actions 每日自动更新数据快照并发布）

## 已实现（v0.3.0）

- **Web App**（`web/`）：纯静态、无构建步骤的机会卡片浏览器 — 按 topic 切换、搜索、排序、最低分过滤、保存机会（localStorage）、可解释的机会分因子
- **评分引擎**（`src/score.mjs`）：纯函数、确定性、可解释的 Opportunity Score（0~100，含 8 个因子明细）
- **数据获取**（`src/fetch.mjs`）：`gh search repos` 实时数据；`--demo` 模式读本地 fixture 离线可用
- **CLI**（`bin/opportunity-radar.mjs`）：table / json / csv 三种输出，支持 `--min-score` 过滤、`--out` 写文件
- **数据管线**（`scripts/build-snapshot.mjs`）：拉取实时 GitHub 数据生成 Web 数据快照
- **测试**（`test/`）：31 个单元 + 集成 + 渲染测试（`node --test`）
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

# 重建 Web 数据快照（可指定 topic 与数量）
node scripts/build-snapshot.mjs --topics ai,self-hosted,database,devops --limit 25

# 运行测试
npm test
```

## Opportunity Score（0~100）

| 因子 | 满分 | 说明 |
|---|---|---|
| popularity | 30 | log10(stars) × 10 |
| demand | 20 | open_issues / 50 |
| activity | 15 | 180 天内 push 15 分；365 天内 5 分 |
| notArchived | 10 | 未归档 |
| issueTracker | 10 | 有 issue tracker |
| license | 5 | 有 license（排除 other） |
| description | 5 | 有描述 |
| issueRatio | 5 | issue/star ≥ 0.02 |

等级：A 强机会 ≥65 ｜ B 中机会 ≥45 ｜ C 弱机会 ≥25 ｜ D 低信号 <25

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
