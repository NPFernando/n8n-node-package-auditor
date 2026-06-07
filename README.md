# n8n Node Package Auditor

A TypeScript CLI that audits n8n community-node packages for public package quality, CI readiness, npm provenance publishing, and documentation hygiene.

It was built as a portfolio-friendly automation tool after hardening and publishing `n8n-nodes-textdotlk`.

## What it checks

- n8n community-node keyword
- package license, repository, and issue tracker metadata
- `package.json` `n8n` node/credential entry points
- build/lint script availability
- GitHub Actions CI workflow signals
- npm Trusted Publishing / provenance workflow signals
- README installation and usage sections
- SECURITY.md or README security guidance

## Install for local development

```bash
git clone https://github.com/NPFernando/n8n-node-package-auditor.git
cd n8n-node-package-auditor
nvm use
npm ci
npm run validate
```

## Usage

Run against an n8n community node package folder:

```bash
npm run build
node dist/cli.js ../n8n-nodes-textdotlk
```

Output formats:

```bash
node dist/cli.js ../n8n-nodes-textdotlk --format text
node dist/cli.js ../n8n-nodes-textdotlk --format json
node dist/cli.js ../n8n-nodes-textdotlk --format markdown
```

Gate automation with a minimum score:

```bash
node dist/cli.js ../n8n-nodes-textdotlk --min-score 85
```

## Example

```text
n8n Node Package Audit

Package: n8n-nodes-healthy-example@1.0.0
Score: 100/100
Summary: 10 passed, 0 warnings, 0 failed
```

## Development

```bash
npm ci
npm test
npm run lint
npm run build
npm run validate
```

## Design notes

- Local-first CLI; no secrets required.
- Static package-folder audit only; it does not call npm or GitHub APIs yet.
- Failing checks exit with a non-zero status so the tool can run in CI.
- JSON and Markdown formats are intended for automation reports and PR comments.

## Roadmap

- Add optional npm registry version/provenance verification.
- Add GitHub API checks for package/repo topics and latest CI status.
- Add configurable scoring profiles.
- Publish as an npm package after CLI UX stabilizes.

## Security

This tool reads local package files and prints metadata. It should not read `.env` files or secrets. If future API integrations are added, credentials should be provided through environment variables and never serialized into reports.
