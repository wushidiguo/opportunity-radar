# OSS Opportunity Radar Testing Strategy

## Unit Tests

- Opportunity Score 计算。
- 数据清洗逻辑。
- 周报模板渲染。
- Stripe Webhook 签名校验。

## Integration Tests

- GH Archive / GitHub Search API 拉取。
- Postgres 读写。
- Newsletter 发送（测试邮箱）。
- Stripe 订阅创建/取消。

## E2E Tests

- 用户打开机会列表 → 订阅周报 → 收到邮件。
- 用户付费 → 解锁导出/API。
- 用户保存机会 → 个人中心可见。

## CI

GitHub Actions：

```yaml
- npm ci
- npm test
- npm run lint
- docker build
- deploy to staging
- schedule data pipeline
```
