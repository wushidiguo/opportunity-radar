# OSS Opportunity Radar

[![Deploy to GitHub Pages](https://github.com/wushidiguo/opportunity-radar/actions/workflows/deploy.yml/badge.svg)](https://github.com/wushidiguo/opportunity-radar/actions/workflows/deploy.yml)
[![Tests](https://github.com/wushidiguo/opportunity-radar/actions/workflows/ci.yml/badge.svg)](https://github.com/wushidiguo/opportunity-radar/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18-green.svg)](package.json)

> **Find open-source projects with strong demand but weak commercialization — the gaps where a commercial product could thrive.**

OSS Opportunity Radar is an automated tool that mines GitHub to surface open-source opportunities:
projects where there is clearly **unmet demand** (discovered from real issue/discussion signals) but
little or no organized commercial offering yet. Every opportunity ships with a **data-backed insight** — 
how many users are asking for what, and whether anyone is already monetizing it.

> Live demo: **[https://wushidiguo.github.io/opportunity-radar/](https://wushidiguo.github.io/opportunity-radar/)**

---

## Motivation

Most "open-source opportunity" lists rank projects by **stars**. This is misleading: high popularity usually means the project is **already commercialized** — e.g. Supabase, ComfyUI, n8n and their hosts all have product sites, cloud offerings and pricing pages. Ranking by fame finds the **worst** opportunities, not the best.

This project scores on the **commercialization gap** instead: reward projects with real, verified demand that **nobody has nicely packaged for money yet**.

## What it finds

- **Strong demand**: measured from open issues, activity and usage signals, not just stars.
- **Commercialization gap**: a project site, cloud/hosted keywords, or a huge star count push a project *down*, because those are signs it is already monetized.
- **Real insights**: the engine reads open issue text and the README to count what users actually ask for — hosted/cloud versions, paying, mobile, API/integration, features — and whether the maintainers are leaving those requests unanswered.

## Features

- **Web app** — a static, zero-build opportunity browser: switch topics, search, sort, filter, save favorites, with an **insight** panel per card.
- **Scoring engine (v2)** — popularity + demand + activity + health + **commercialization gap**.
- **Insight engine** — mines open issues + README to count demand signals (hosted / paid / mobile / API / feature / self-host), unanswered requests, and detect monetization — then writes a one-line, data-backed reason.
- **CLI** — table / JSON / CSV output, min-score filter, offline demo mode, list/content filtering.
- **CI/CD** — tests on every push, a daily data snapshot, and automatic GitHub Pages deploys.

## Live demo

The live site is refreshed automatically every day by a scheduled GitHub Actions job:

[https://wushidiguo.github.io/opportunity-radar/](https://wushidiguo.github.io/opportunity-radar/)

## How it works

1. **Collect** — search GitHub for candidate repositories per topic (a larger pool than just the top stars).
2. **Score** — run the v2 scoring engine. Unlike naive popularity scoring, it penalizes known-commercialized projects (product site, cloud/hosted keywords, huge stars) and rewards real demand plus a commercialization gap.
3. **Mine insight** — for the top candidates, read their open issues and README to quantify demand signals and detect monetization evidence, producing a concrete "why someone would pay" reason.
4. **Publish** — rank the opportunities and serve them in the web app (rebuilt daily).

### Opportunity score (0-100)

| Factor | Max | Description |
|---|---|---|
| popularity | 20 | log10(stars+1) x 5 (sublinear, so big projects do not dominate) |
| demand | 15 | open_issues / 150 |
| activity | 10 | pushed within 180d = 10; within 365d = 4 |
| health | 15 | not archived + has issues + has description + has wiki |
| **gap** | **40 (can be negative)** | **commercialization gap (core)** |

**Gap signals**: a non-GitHub product homepage, or cloud/saas/enterprise/managed keywords in the description, mark a project as *commercialized* and drag it down. No homepage, a DIY/self-hosted topic, or a permissive license push it up. Very large star counts (>120k) are penalized as likely-commoditized. Grades: A >= 75, B >= 60, C >= 45, D < 45.

## Getting started

### Prerequisites

- **Node.js >= 18**
- **GitHub CLI (`gh`)** authenticated — needed for live data. Use `--demo` mode to run fully offline.

### CLI

```bash
# Offline demo (no gh needed)
node bin/opportunity-radar.mjs ai 10 --demo

# Live data (gh must be logged in)
node bin/opportunity-radar.mjs ai 10

# JSON export + min-score filter
node bin/opportunity-radar.mjs database 20 --format json --min-score 70

# CSV export (one column per factor)
node bin/opportunity-radar.mjs self-hosted 20 --format csv --out opportunities.csv
```

### Build the data snapshot

```bash
node scripts/build-snapshot.mjs --topics ai,self-hosted,database,devops,llm --pool 120 --top 40
```

This fetches a larger candidate pool, scores it, mines insights for the top candidates, and writes
`web/data/opportunities.json` for the web app.

### Run the web app locally

```bash
node scripts/serve.mjs
# open http://localhost:4173
```

### Run the tests

```bash
npm test
```

## Project structure

```text
opportunity-radar/
  bin/opportunity-radar.mjs   # CLI entry
  src/
    score.mjs                 # v2 scoring engine (pure, explainable)
    insight.mjs               # insight engine (issue + README mining)
    fetch.mjs                 # GitHub data fetching / fixture fallback
    render.mjs                # table / json / csv rendering
    cli.mjs                   # arg parsing + main flow
  scripts/
    build-snapshot.mjs        # build the web data snapshot
    serve.mjs                 # local static server
  web/                        # static web app (no build step)
  test/                       # unit / integration / render / insight tests
  .github/workflows/          # CI + daily snapshot + Pages deploy
```

## Contributing

Contributions are welcome. Please open an issue to discuss a change before opening a pull request, and make sure `npm test` passes locally.

## License

[MIT](LICENSE)

## Acknowledgments

Inspired by the observation that open-source popularity and commercialization are often inversely related when it comes to *opportunity*. The demand signals come directly from public GitHub issue data.
