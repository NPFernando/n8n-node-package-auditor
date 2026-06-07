import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('n8n community-node package metadata', () => {
  it('declares installable n8n community-node package metadata while preserving the CLI bin', async () => {
    const packageJson = JSON.parse(await readFile(join(process.cwd(), 'package.json'), 'utf8')) as {
      name?: string;
      keywords?: string[];
      bin?: Record<string, string>;
      n8n?: { n8nNodesApiVersion?: number; nodes?: string[] };
    };

    expect(packageJson.name).toBe('n8n-nodes-package-auditor');
    expect(packageJson.keywords).toContain('n8n-community-node-package');
    expect(packageJson.bin).toEqual({ 'n8n-node-package-auditor': 'dist/cli.js' });
    expect(packageJson.n8n?.n8nNodesApiVersion).toBe(1);
    expect(packageJson.n8n?.nodes).toContain('dist/nodes/PackageAuditor/PackageAuditor.node.js');
  });
});

describe('PackageAuditor n8n node', () => {
  it('exposes package path, output format, and minimum score parameters', async () => {
    const { PackageAuditor } = await import('../src/nodes/PackageAuditor/PackageAuditor.node.js');
    const node = new PackageAuditor();

    expect(node.description.displayName).toBe('n8n Package Auditor');
    expect(node.description.name).toBe('packageAuditor');
    expect(node.description.usableAsTool).toBe(true);
    expect(node.description.properties.map((property) => property.name)).toEqual(['packagePath', 'format', 'minScore']);
  }, 15000);

  it('audits each incoming item and returns structured plus formatted output', async () => {
    const { PackageAuditor } = await import('../src/nodes/PackageAuditor/PackageAuditor.node.js');
    const node = new PackageAuditor();
    const context = {
      getInputData: () => [{ json: {} }],
      getNode: () => ({ name: 'n8n Package Auditor', type: 'packageAuditor' }),
      continueOnFail: () => false,
      getNodeParameter: (name: string) => {
        if (name === 'packagePath') return 'examples/healthy-package';
        if (name === 'format') return 'markdown';
        if (name === 'minScore') return 90;
        throw new Error(`Unexpected parameter ${name}`);
      },
    };

    const execute = node.execute as unknown as (this: unknown) => Promise<Array<Array<{ json: Record<string, unknown> }>>>;
    const [items] = await execute.call(context);

    expect(items).toHaveLength(1);
    expect(items[0].json.packageName).toBe('n8n-nodes-healthy-example');
    expect(items[0].json.score).toBe(100);
    expect(items[0].json.passed).toBe(true);
    expect(items[0].json.formattedReport).toContain('# n8n Node Package Audit');
  });
});