#!/usr/bin/env node
import { auditPackage, formatMarkdownReport, formatTextReport } from './index.js';

type OutputFormat = 'text' | 'json' | 'markdown';

function printHelp(): void {
  console.log(`n8n-node-package-auditor

Usage:
  n8n-node-package-auditor <package-path> [--format text|json|markdown] [--min-score 80]

Examples:
  n8n-node-package-auditor .
  n8n-node-package-auditor ../n8n-nodes-textdotlk --format markdown
  n8n-node-package-auditor . --format json --min-score 90
`);
}

function parseArgs(argv: string[]): { packagePath: string; format: OutputFormat; minScore?: number } {
  let packagePath = '';
  let format: OutputFormat = 'text';
  let minScore: number | undefined;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }
    if (arg === '--format') {
      const next = argv[++index];
      if (!['text', 'json', 'markdown'].includes(next)) throw new Error(`Unsupported format: ${next}`);
      format = next as OutputFormat;
      continue;
    }
    if (arg === '--min-score') {
      const next = Number(argv[++index]);
      if (!Number.isFinite(next) || next < 0 || next > 100) throw new Error('--min-score must be a number from 0 to 100');
      minScore = next;
      continue;
    }
    if (arg.startsWith('-')) throw new Error(`Unknown option: ${arg}`);
    packagePath = arg;
  }

  if (!packagePath) packagePath = '.';
  return { packagePath, format, minScore };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const report = await auditPackage(args.packagePath);

  if (args.format === 'json') console.log(JSON.stringify(report, null, 2));
  if (args.format === 'markdown') console.log(formatMarkdownReport(report));
  if (args.format === 'text') console.log(formatTextReport(report));

  if (report.summary.fail > 0 || (args.minScore !== undefined && report.score < args.minScore)) {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error(`Error: ${(error as Error).message}`);
  process.exitCode = 1;
});
