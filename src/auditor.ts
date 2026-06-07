import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { AuditCheck, AuditReport, AuditSummary, CheckStatus, PackageJson } from './types.js';

async function readTextIfExists(path: string): Promise<string | null> {
  try {
    return await readFile(path, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}

function hasHeading(readme: string | null, heading: string): boolean {
  if (!readme) return false;
  const pattern = new RegExp(`^#{1,3}\\s+${heading}\\b`, 'im');
  return pattern.test(readme);
}

function hasWorkflowWith(workflows: Array<string | null>, patterns: RegExp[]): boolean {
  return workflows.some((content) => content !== null && patterns.every((pattern) => pattern.test(content)));
}

function evaluateCiWorkflow(workflows: Array<string | null>): { status: CheckStatus; message: string } {
  const hasInstall = hasWorkflowWith(workflows, [/npm\s+ci/is]);
  const hasValidation = hasWorkflowWith(workflows, [/npm\s+run\s+(lint|build|test|validate)|npm\s+test|npx\s+tsc/is]);
  const hasAnyCiSignal = hasWorkflowWith(workflows, [/name:\s*CI|npm\s+ci|npm\s+run\s+(lint|build|test|validate)|npm\s+test|npx\s+tsc/is]);

  if (hasInstall && hasValidation) {
    return { status: 'pass', message: 'CI workflow installs dependencies and runs validation commands.' };
  }

  if (hasAnyCiSignal) {
    return {
      status: 'warn',
      message: 'CI workflow signal found, but npm ci plus validation commands were not both detected.',
    };
  }

  return { status: 'warn', message: 'No obvious CI validation workflow detected.' };
}

function evaluatePublishWorkflow(workflows: Array<string | null>): { status: CheckStatus; message: string } {
  const hasTagTrigger = hasWorkflowWith(workflows, [/push\s*:/is, /tags\s*:/is]);
  const hasOidc = hasWorkflowWith(workflows, [/id-token\s*:\s*write/is]);
  const hasProvenancePublish = hasWorkflowWith(workflows, [/npm\s+publish[^\n]*--provenance|npm\s+run\s+release|n8n-node\s+release/is]);

  if (hasTagTrigger && hasOidc && hasProvenancePublish) {
    return { status: 'pass', message: 'Publish workflow includes tag trigger, OIDC, and provenance publish signals.' };
  }

  if (hasOidc || hasProvenancePublish) {
    return {
      status: 'warn',
      message: 'Publish workflow has partial provenance signals, but tag trigger, OIDC, and publish command were not all detected.',
    };
  }

  return { status: 'fail', message: 'No npm provenance/Trusted Publishing workflow detected.' };
}

function check(
  id: string,
  title: string,
  status: CheckStatus,
  message: string,
  weight: number,
  recommendation?: string,
): AuditCheck {
  return { id, title, status, message, weight, recommendation };
}

function scoreChecks(checks: AuditCheck[]): number {
  const total = checks.reduce((sum, item) => sum + item.weight, 0);
  const earned = checks.reduce((sum, item) => {
    if (item.status === 'pass') return sum + item.weight;
    if (item.status === 'warn') return sum + item.weight * 0.5;
    return sum;
  }, 0);
  return total === 0 ? 0 : Math.round((earned / total) * 100);
}

function summarize(checks: AuditCheck[]): AuditSummary {
  return checks.reduce<AuditSummary>(
    (summary, item) => {
      summary[item.status] += 1;
      return summary;
    },
    { pass: 0, warn: 0, fail: 0 },
  );
}

function requirePackageName(pkg: PackageJson): string {
  return typeof pkg.name === 'string' && pkg.name.trim() ? pkg.name : '(unknown package)';
}

export async function auditPackage(packagePath: string): Promise<AuditReport> {
  const packageJsonPath = join(packagePath, 'package.json');
  const packageJsonText = await readTextIfExists(packageJsonPath);
  if (!packageJsonText) {
    throw new Error(`No package.json found at ${packageJsonPath}`);
  }

  let pkg: PackageJson;
  try {
    pkg = JSON.parse(packageJsonText) as PackageJson;
  } catch (error) {
    throw new Error(`Invalid package.json: ${(error as Error).message}`);
  }

  const readme = await readTextIfExists(join(packagePath, 'README.md'));
  const security = await readTextIfExists(join(packagePath, 'SECURITY.md'));
  const workflows = await Promise.all([
    readTextIfExists(join(packagePath, '.github/workflows/ci.yml')),
    readTextIfExists(join(packagePath, '.github/workflows/ci.yaml')),
    readTextIfExists(join(packagePath, '.github/workflows/publish.yml')),
    readTextIfExists(join(packagePath, '.github/workflows/publish.yaml')),
  ]);

  const checks: AuditCheck[] = [];
  const keywords = Array.isArray(pkg.keywords) ? pkg.keywords : [];
  const scripts = pkg.scripts ?? {};
  const hasRepository =
    typeof pkg.repository === 'string'
      ? pkg.repository.trim().length > 0
      : Boolean(pkg.repository?.url && pkg.repository.url.trim().length > 0);
  const hasBugs =
    typeof pkg.bugs === 'string' ? pkg.bugs.trim().length > 0 : Boolean(pkg.bugs?.url && pkg.bugs.url.trim().length > 0);
  const n8nConfig = pkg.n8n;

  checks.push(
    check(
      'metadata.community-keyword',
      'Community node keyword',
      keywords.includes('n8n-community-node-package') ? 'pass' : 'fail',
      keywords.includes('n8n-community-node-package')
        ? 'Package declares the n8n community-node keyword.'
        : 'Package is missing the n8n community-node keyword.',
      12,
      'Add "n8n-community-node-package" to package.json keywords.',
    ),
  );

  checks.push(
    check(
      'metadata.license',
      'License metadata',
      typeof pkg.license === 'string' && pkg.license.length > 0 ? 'pass' : 'warn',
      pkg.license ? `License declared as ${pkg.license}.` : 'No license field found in package.json.',
      6,
      'Add a package.json license field and LICENSE file if publishing publicly.',
    ),
  );

  checks.push(
    check(
      'metadata.repository',
      'Repository metadata',
      hasRepository && hasBugs ? 'pass' : hasRepository ? 'warn' : 'fail',
      hasRepository && hasBugs
        ? 'Repository and issue tracker metadata are present.'
        : hasRepository
          ? 'Repository metadata exists, but bugs/issues metadata is missing.'
          : 'Repository metadata is missing.',
      10,
      'Add repository and bugs URLs so users can find source and report issues.',
    ),
  );

  const hasNodeEntries = Array.isArray(n8nConfig?.nodes) && n8nConfig.nodes.some((entry) => typeof entry === 'string' && entry.trim());
  const hasCredentialEntries =
    Array.isArray(n8nConfig?.credentials) && n8nConfig.credentials.some((entry) => typeof entry === 'string' && entry.trim());
  const hasN8nConfig = Boolean(n8nConfig?.n8nNodesApiVersion && (hasNodeEntries || hasCredentialEntries));
  checks.push(
    check(
      'n8n.config',
      'n8n package config',
      hasN8nConfig ? 'pass' : 'fail',
      hasN8nConfig ? 'package.json contains n8n node/credential entry points.' : 'package.json is missing usable n8n configuration.',
      16,
      'Add n8n.n8nNodesApiVersion plus nodes and/or credentials entry points.',
    ),
  );

  checks.push(
    check(
      'scripts.validation',
      'Validation scripts',
      scripts.lint && scripts.build ? 'pass' : scripts.build || scripts.lint ? 'warn' : 'fail',
      scripts.lint && scripts.build
        ? 'Build and lint scripts are available.'
        : 'Package should expose build and lint scripts for CI validation.',
      10,
      'Add scripts such as "lint": "n8n-node lint" and "build": "n8n-node build".',
    ),
  );

  const ciWorkflow = evaluateCiWorkflow(workflows);
  checks.push(
    check(
      'ci.workflow',
      'CI workflow',
      ciWorkflow.status,
      ciWorkflow.message,
      10,
      'Add a GitHub Actions workflow that runs npm ci, lint, build, tests, and package checks.',
    ),
  );

  const publishWorkflow = evaluatePublishWorkflow(workflows);
  checks.push(
    check(
      'publish.provenance',
      'npm provenance publishing',
      publishWorkflow.status,
      publishWorkflow.message,
      14,
      'Add a tag-triggered publish workflow with id-token: write and npm publish --provenance or an n8n-node release flow.',
    ),
  );

  checks.push(
    check(
      'readme.installation',
      'README installation section',
      hasHeading(readme, 'Installation') ? 'pass' : 'warn',
      hasHeading(readme, 'Installation') ? 'README includes installation guidance.' : 'README is missing an Installation section.',
      6,
      'Document npm/n8n installation steps.',
    ),
  );

  checks.push(
    check(
      'readme.usage',
      'README usage section',
      hasHeading(readme, 'Usage') ? 'pass' : 'warn',
      hasHeading(readme, 'Usage') ? 'README includes usage guidance.' : 'README is missing a Usage section.',
      6,
      'Add examples showing resources, operations, and credential setup.',
    ),
  );

  checks.push(
    check(
      'security.policy',
      'Security documentation',
      security || hasHeading(readme, 'Security') ? 'pass' : 'warn',
      security || hasHeading(readme, 'Security')
        ? 'Security reporting guidance is documented.'
        : 'No SECURITY.md or README Security section found.',
      10,
      'Add SECURITY.md or a README Security section with reporting guidance and secret-handling notes.',
    ),
  );

  return {
    packagePath,
    packageName: requirePackageName(pkg),
    version: pkg.version,
    score: scoreChecks(checks),
    summary: summarize(checks),
    checks,
  };
}
