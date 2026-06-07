import { describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { auditPackage, formatMarkdownReport, formatTextReport } from '../src/index.js';

async function createPackage(files: Record<string, string>): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'n8n-auditor-'));
  for (const [relativePath, content] of Object.entries(files)) {
    const fullPath = join(dir, relativePath);
    await mkdir(join(fullPath, '..'), { recursive: true });
    await writeFile(fullPath, content, 'utf8');
  }
  return dir;
}

describe('auditPackage', () => {
  it('scores a healthy n8n community package and reports passing checks', async () => {
    const dir = await createPackage({
      'package.json': JSON.stringify({
        name: 'n8n-nodes-example',
        version: '1.0.0',
        license: 'MIT',
        keywords: ['n8n-community-node-package'],
        repository: { type: 'git', url: 'git+https://github.com/example/n8n-nodes-example.git' },
        bugs: { url: 'https://github.com/example/n8n-nodes-example/issues' },
        n8n: {
          n8nNodesApiVersion: 1,
          credentials: ['dist/credentials/Example.credentials.js'],
          nodes: ['dist/nodes/Example/Example.node.js'],
        },
        scripts: { lint: 'n8n-node lint', build: 'n8n-node build' },
      }),
      'README.md': '# Example\n\n## Installation\n\n## Usage\n\n## Security\n',
      '.github/workflows/ci.yml': 'name: CI\non: [push]\njobs:\n  validate:\n    runs-on: ubuntu-latest\n    steps:\n      - run: npm ci\n      - run: npm run validate\n',
      '.github/workflows/publish.yml':
        'name: Publish\non:\n  push:\n    tags:\n      - "*.*.*"\npermissions:\n  id-token: write\njobs:\n  publish:\n    steps:\n      - run: npm publish --provenance\n',
      'SECURITY.md': '# Security\n',
    });

    const report = await auditPackage(dir);

    expect(report.packageName).toBe('n8n-nodes-example');
    expect(report.score).toBeGreaterThanOrEqual(90);
    expect(report.summary.fail).toBe(0);
    expect(report.checks.map((check) => check.id)).toContain('metadata.community-keyword');
    expect(report.checks.find((check) => check.id === 'publish.provenance')?.status).toBe('pass');
  });

  it('flags missing n8n metadata, provenance workflow, and README sections', async () => {
    const dir = await createPackage({
      'package.json': JSON.stringify({
        name: 'bad-package',
        version: '0.0.1',
      }),
      'README.md': '# Bad Package\n',
    });

    const report = await auditPackage(dir);

    expect(report.score).toBeLessThan(60);
    expect(report.summary.fail).toBeGreaterThan(0);
    expect(report.checks.find((check) => check.id === 'n8n.config')?.status).toBe('fail');
    expect(report.checks.find((check) => check.id === 'publish.provenance')?.status).toBe('fail');
    expect(report.checks.find((check) => check.id === 'readme.installation')?.status).toBe('warn');
  });

  it('does not accept empty n8n entry arrays or empty repository metadata as healthy', async () => {
    const dir = await createPackage({
      'package.json': JSON.stringify({
        name: 'n8n-nodes-empty',
        version: '0.0.1',
        keywords: ['n8n-community-node-package'],
        repository: {},
        bugs: {},
        n8n: { n8nNodesApiVersion: 1, nodes: [], credentials: [] },
      }),
      'README.md': '# Empty\n\n## Installation\n\n## Usage\n',
    });

    const report = await auditPackage(dir);

    expect(report.checks.find((check) => check.id === 'n8n.config')?.status).toBe('fail');
    expect(report.checks.find((check) => check.id === 'metadata.repository')?.status).toBe('fail');
  });

  it('does not pass CI workflow checks from workflow name alone', async () => {
    const dir = await createPackage({
      'package.json': JSON.stringify({
        name: 'n8n-nodes-ci-placeholder',
        version: '0.0.1',
        keywords: ['n8n-community-node-package'],
        license: 'MIT',
        repository: { type: 'git', url: 'https://github.com/example/repo' },
        bugs: { url: 'https://github.com/example/repo/issues' },
        n8n: { n8nNodesApiVersion: 1, nodes: ['dist/node.js'] },
        scripts: { lint: 'n8n-node lint', build: 'n8n-node build' },
      }),
      'README.md': '# Example\n\n## Installation\n\n## Usage\n\n## Security\n',
      '.github/workflows/ci.yml': 'name: CI\non: [push]\njobs:\n  validate:\n    runs-on: ubuntu-latest\n',
      '.github/workflows/publish.yml':
        'name: Publish\non:\n  push:\n    tags:\n      - "*.*.*"\npermissions:\n  id-token: write\njobs:\n  publish:\n    steps:\n      - run: npm publish --provenance\n',
    });

    const report = await auditPackage(dir);

    expect(report.checks.find((check) => check.id === 'ci.workflow')?.status).toBe('warn');
  });

  it('warns when a provenance publish workflow is not tag triggered', async () => {
    const dir = await createPackage({
      'package.json': JSON.stringify({
        name: 'n8n-nodes-untagged-publish',
        version: '0.0.1',
        keywords: ['n8n-community-node-package'],
        license: 'MIT',
        repository: { type: 'git', url: 'https://github.com/example/repo' },
        bugs: { url: 'https://github.com/example/repo/issues' },
        n8n: { n8nNodesApiVersion: 1, nodes: ['dist/node.js'] },
        scripts: { lint: 'n8n-node lint', build: 'n8n-node build' },
      }),
      'README.md': '# Example\n\n## Installation\n\n## Usage\n\n## Security\n',
      '.github/workflows/ci.yml': 'name: CI\non: [push]\njobs:\n  validate:\n    steps:\n      - run: npm ci\n      - run: npm run validate\n',
      '.github/workflows/publish.yml':
        'name: Publish\non: workflow_dispatch\npermissions:\n  id-token: write\njobs:\n  publish:\n    steps:\n      - run: npm publish --provenance\n',
    });

    const report = await auditPackage(dir);

    expect(report.checks.find((check) => check.id === 'publish.provenance')?.status).toBe('warn');
  });
});

describe('report formatters', () => {
  it('renders text and markdown reports with score and grouped findings', async () => {
    const dir = await createPackage({
      'package.json': JSON.stringify({
        name: 'n8n-nodes-example',
        version: '1.0.0',
        keywords: ['n8n-community-node-package'],
        license: 'MIT',
        repository: { type: 'git', url: 'https://github.com/example/repo' },
        bugs: { url: 'https://github.com/example/repo/issues' },
        n8n: { n8nNodesApiVersion: 1, nodes: ['dist/node.js'] },
      }),
      'README.md': '# Example\n\n## Installation\n\n## Usage\n\n## Security\n',
      'SECURITY.md': '# Security\n',
    });

    const report = await auditPackage(dir);

    expect(formatTextReport(report)).toContain('n8n Node Package Audit');
    expect(formatTextReport(report)).toContain('Package: n8n-nodes-example');
    expect(formatMarkdownReport(report)).toContain('# n8n Node Package Audit');
    expect(formatMarkdownReport(report)).toContain('## Failed');
  });

  it('does not print absolute local paths in text reports by default', async () => {
    const dir = await createPackage({
      'package.json': JSON.stringify({
        name: 'n8n-nodes-path-safe',
        version: '1.0.0',
        keywords: ['n8n-community-node-package'],
        n8n: { n8nNodesApiVersion: 1, nodes: ['dist/node.js'] },
      }),
    });

    const report = await auditPackage(dir);
    const text = formatTextReport(report);

    expect(text).not.toContain(dir);
    expect(text).toContain('Path: n8n-auditor-');
  });
});
