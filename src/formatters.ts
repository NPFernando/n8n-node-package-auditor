import type { AuditCheck, AuditReport, CheckStatus } from './types.js';

const statusIcon: Record<CheckStatus, string> = {
  pass: '✓',
  warn: '!',
  fail: '✗',
};

function groupByStatus(report: AuditReport, status: CheckStatus): AuditCheck[] {
  return report.checks.filter((check) => check.status === status);
}

function statusLabel(status: CheckStatus): string {
  if (status === 'pass') return 'Passed';
  if (status === 'warn') return 'Warnings';
  return 'Failed';
}

export function formatTextReport(report: AuditReport): string {
  const lines = [
    'n8n Node Package Audit',
    '',
    `Package: ${report.packageName}${report.version ? `@${report.version}` : ''}`,
    `Path: ${report.packagePath}`,
    `Score: ${report.score}/100`,
    `Summary: ${report.summary.pass} passed, ${report.summary.warn} warnings, ${report.summary.fail} failed`,
    '',
  ];

  for (const status of ['fail', 'warn', 'pass'] as const) {
    const checks = groupByStatus(report, status);
    lines.push(`${statusLabel(status)}:`);
    if (checks.length === 0) {
      lines.push('  none');
    } else {
      for (const check of checks) {
        lines.push(`  ${statusIcon[status]} ${check.title}: ${check.message}`);
        if (check.status !== 'pass' && check.recommendation) lines.push(`    -> ${check.recommendation}`);
      }
    }
    lines.push('');
  }

  return lines.join('\n').trimEnd();
}

export function formatMarkdownReport(report: AuditReport): string {
  const lines = [
    '# n8n Node Package Audit',
    '',
    `- Package: \`${report.packageName}${report.version ? `@${report.version}` : ''}\``,
    `- Score: **${report.score}/100**`,
    `- Summary: ${report.summary.pass} passed, ${report.summary.warn} warnings, ${report.summary.fail} failed`,
    '',
  ];

  for (const status of ['fail', 'warn', 'pass'] as const) {
    lines.push(`## ${statusLabel(status)}`);
    lines.push('');
    const checks = groupByStatus(report, status);
    if (checks.length === 0) {
      lines.push('None.');
    } else {
      for (const check of checks) {
        lines.push(`- ${statusIcon[status]} **${check.title}** — ${check.message}`);
        if (check.status !== 'pass' && check.recommendation) lines.push(`  - Recommendation: ${check.recommendation}`);
      }
    }
    lines.push('');
  }

  return lines.join('\n').trimEnd();
}
