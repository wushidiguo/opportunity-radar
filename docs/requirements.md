# OSS Opportunity Radar Requirements

## MVP Goals

1. 用户可按 topic 查看开源项目机会卡片。
2. 每个机会卡片展示 Opportunity Score、stars、issues、license、活跃度。
3. 支持订阅 AI 周报。
4. 用户可保存/认领机会。
5. 付费用户可导出数据或调用 API。

## User Stories

- 作为独立开发者，我想找到“有人需要但没人做好商业化”的开源方向。
- 作为 VC，我想按行业/语言筛选高潜力开源项目。
- 作为开源维护者，我想发布“寻找商业化合伙人”的需求。

## P0 / P1 / P2

- P0：机会搜索、机会分、机会卡片、周报订阅。
- P1：LLM 需求聚类、商业化空白地图、机会认领表单。
- P2：完整撮合市场、支付分成、私有数据接入。

## Acceptance Criteria

- [x] 能按 topic 返回 10 个机会卡片。（CLI 已实现：`node bin/opportunity-radar.mjs <topic> 10`）
- [x] 机会分可解释（展示因子）。（table 输出显示因子明细，json/csv 含全部分解）
- [x] 数据导出：CSV/JSON。（`--format csv|json`，付费门禁待接 Stripe）
- [ ] 用户可订阅周报并收到邮件。（需邮件服务人工配置：Resend/Buttondown + 域名验证）
