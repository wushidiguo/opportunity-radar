# Contributing

Thank you for your interest in OSS Opportunity Radar. Contributions of all kinds are welcome — bug reports, feature requests, docs, and pull requests.

## How to contribute

1. **Open an issue** first to discuss the change — especially for new features or model/scoring changes.
2. **Fork** the repository and create a feature branch.
3. **Make your change**, keeping the code consistent with the existing style (plain ESM Node.js, no build step).
4. **Add or update tests** for any behavioral change (the project uses the built-in Node.js test runner).
5. **Run the full test suite locally** before opening a pull request:

```bash
npm test
```

## Development

```bash
# CLI (offline demo)
node bin/opportunity-radar.mjs ai 10 --demo

# Web app locally
node scripts/serve.mjs   # http://localhost:4173

# Rebuild the data snapshot (needs GitHub CLI authenticated)
node scripts/build-snapshot.mjs --topics ai,self-hosted,database --pool 100 --top 40
```

## Code organization

- `src/score.mjs` — scoring engine (pure, explainable).
- `src/insight.mjs` — insight engine (mines open issues + README for demand and commercialization signals).
- `src/fetch.mjs` — GitHub data fetching / offline fixture fallback.
- `src/render.mjs`, `src/cli.mjs` — output rendering and CLI. 
- `scripts/` — snapshot builder and local static server.
- `web/` — the static web app.
- `test/` — unit, integration, render, and insight tests.

## Notes

- The scoring is **heuristic** by design: it uses public metadata, issue text and README heuristics to estimate a "commercialization gap". Feedback and better signals are welcome.
- Live data requires the GitHub CLI; `--demo` mode runs fully offline with committed fixtures.

By contributing you agree that your contributions are licensed under the [MIT License](LICENSE).
