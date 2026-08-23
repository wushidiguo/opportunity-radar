# OSS Opportunity Radar — Agent 启动手册

## 项目简介

OSS Opportunity Radar 是“开源商业化机会雷达”。  
目标：从 GitHub 数据中自动发现“用户需求很强但还没人做好商业化”的开源机会，并连接想赚钱的人和缺商业化的开源项目。

参考文档：
- 根目录 `three-money-making-projects.md`
- 根目录 `OPPORTUNITY_RADAR_PRODUCT_SPEC.md`
- 根目录 `opportunity-radar.mjs`（当前原型）

## 启动工作 Prompt

> 你是 OSS Opportunity Radar 的技术负责人。请把项目从原型推进到可上线状态。
>
> 必须完成：
> 1. **需求分解与管理**
>    - 拆解用户故事：机会搜索、机会分、机会卡片、AI 周报、订阅、机会认领。
>    - 定义 P0/P1/P2 和验收标准。
> 2. **架构设计**
>    - 设计数据管道（GH Archive）、评分服务、Web App、Newsletter、支付、撮合市场。
>    - 基础设施优先云服务：建议 BigQuery/DuckDB + Cloud Run/Fly.io + Managed Postgres + Stripe + Resend/Buttondown。
> 3. **详细设计**
>    - 机会分公式、数据模型、API、周报生成流程、订阅计费。
> 4. **测试设计**
>    - 单元测试：机会分计算、数据清洗。
>    - 集成测试：GH Archive/API 拉取、数据库、Stripe Webhook、Newsletter 发送。
>    - E2E：用户订阅 → 收到周报 → 保存机会 → 认领。
> 5. **编码实现**
>    - 使用 `opportunity-radar.mjs` 作为评分参考，逐步产品化。
> 6. **CI/CD**
>    - GitHub Actions：test、build、deploy、定时数据更新。
> 7. **上线准备**
>    - 监控、日志、备份、域名、SSL、Stripe、Newsletter 发送域名验证。
>
> 规则：
> - 遇到人工步骤（云账号、GitHub Token、Stripe、邮件服务、域名）时，明确列出。
> - Agent 可并行：一个做数据管道，一个做 Web/API，一个做 Newsletter/支付；使用 worktree 隔离。

## 人工前置条件

- [ ] GitHub Token（public repo 读取权限即可）
- [ ] GCP 或其他云服务账号（BigQuery 可选；也可先用 DuckDB 本地跑）
- [ ] 托管数据库（PostgreSQL，建议 Neon/Supabase/RDS/Cloud SQL）
- [ ] 域名
- [ ] Stripe 账号（订阅收费）
- [ ] 邮件服务（Resend/Buttondown/SendGrid）
- [ ] LLM API Key（如需需求聚类）

## 并行开发建议

```bash
git worktree add ../opportunity-radar-wt-data -b opportunity-radar/dev/data
git worktree add ../opportunity-radar-wt-web -b opportunity-radar/dev/web
git worktree add ../opportunity-radar-wt-billing -b opportunity-radar/dev/billing
```

每个 Agent 只修改 `opportunity-radar/` 下自己的模块。
