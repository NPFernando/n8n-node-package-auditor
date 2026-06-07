# n8n Node Package Auditor

An n8n community node plus CLI that audits n8n community-node packages for public package quality, CI readiness, npm provenance publishing, and documentation hygiene.

It was built as a portfolio-friendly automation tool after hardening and publishing `n8n-nodes-textdotlk`.

## What it checks

- n8n community-node keyword
- package license, repository, and issue tracker metadata
- `package.json` `n8n` node/credential entry points
- build/lint script availability
- GitHub Actions CI workflow signals, including dependency installation plus validation commands
- npm Trusted Publishing / provenance workflow signals, including tag triggers and OIDC permissions
- README installation and usage sections
- `SECURITY.md` or README security guidance

## Install in n8n

After the package is published to npm, install it from n8n:

1. Go to **Settings → Community Nodes**.
2. Select **Install a community node**.
3. Enter:

```text
n8n-nodes-package-auditor
```

4. Click **Install** and restart n8n if prompted.

The installed node appears as **n8n Package Auditor**.

### n8n node parameters

- **Package Path**: Path to the package folder as seen by the n8n runtime.
- **Output Format**: `JSON`, `Markdown`, or `Text` for the `formattedReport` field.
- **Minimum Score**: Score threshold used to set the boolean `passed` output.

For Docker-based n8n, mount the package/repo you want to audit into the n8n container first, then use that container path in **Package Path**.

## Install as a CLI

After publish, install globally:

```bash
npm install -g n8n-nodes-package-auditor
```

The CLI binary remains:

```bash
n8n-node-package-auditor ./some-n8n-node-package --format text
```

## Local development setup

```bash
git clone https://github.com/NPFernando/n8n-node-package-auditor.git
cd n8n-node-package-auditor
nvm use # Node.js 22.14+ and npm 10+
npm ci
npm run validate
```

## CLI usage from source

Run against an n8n community-node package folder:

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

## Example output

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
npm pack --dry-run
```

Verify the package installs and loads in a real n8n Docker image:

```bash
npm run smoke:n8n:docker
```

To verify a published npm version after release:

```bash
PACKAGE_VERSION=0.1.0 npm run smoke:n8n:docker
```

## Design notes

- Local-first CLI and n8n node; no secrets required.
- Static package-folder audit only; it does not call npm or GitHub APIs yet.
- Failing checks exit with a non-zero status so the CLI can run in CI.
- The n8n node returns structured fields plus a `formattedReport` string.
- JSON and Markdown formats are intended for automation reports and PR comments.
- Text reports hide absolute local path prefixes by default to avoid leaking machine-specific WSL/home paths in public snippets.

## Roadmap

- Add optional npm registry version/provenance verification.
- Add GitHub API checks for package/repo topics and latest CI status.
- Add configurable scoring profiles.
- Add npm/GitHub URL audit mode for n8n Cloud-friendly workflows.

## Security

This tool reads package files from the path you provide and prints package metadata. It should not read `.env` files or secrets. If future API integrations are added, credentials should be provided through environment variables or n8n credentials and never serialized into reports.
