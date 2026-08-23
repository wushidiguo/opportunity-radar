# OSS Opportunity Radar Architecture

## System Context

```text
GH Archive / GitHub Search -> Data Pipeline -> Postgres -> Web App (Next.js)
                                                         -> Newsletter Service
                                                         -> Stripe Billing
```

## Components

- **Data Pipeline**: Airflow/dbt/BigQuery 或 DuckDB 定时计算。
- **Scoring Service**: 计算 Opportunity Score。
- **Web App**: 机会卡片、搜索、筛选、用户保存/认领。
- **Newsletter Service**: 生成并发送 AI 周报。
- **Billing**: Stripe 订阅。
- **Marketplace (P2)**: 供需匹配和撮合。

## Cloud Services（优先）

- Data: BigQuery / DuckDB + GH Archive
- Compute: Cloud Run / Fly.io / Render
- Database: PostgreSQL (Neon/Supabase/RDS/Cloud SQL)
- Email: Resend / Buttondown / SendGrid
- Payments: Stripe
- CI/CD: GitHub Actions
- LLM: OpenAI / Anthropic / 自托管

## Data Flow

1. 定时任务从 GH Archive 拉取事件。
2. 清洗并计算仓库指标。
3. 生成机会分写入 Postgres。
4. Web App 查询展示。
5. 周报任务生成内容并通过邮件服务发送。
