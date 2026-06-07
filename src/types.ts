export type CheckStatus = 'pass' | 'warn' | 'fail';

export interface AuditCheck {
  id: string;
  title: string;
  status: CheckStatus;
  message: string;
  recommendation?: string;
  weight: number;
}

export interface AuditSummary {
  pass: number;
  warn: number;
  fail: number;
}

export interface AuditReport {
  packagePath: string;
  packageName: string;
  version?: string;
  score: number;
  summary: AuditSummary;
  checks: AuditCheck[];
}

export interface PackageJson {
  name?: string;
  version?: string;
  license?: string;
  keywords?: string[];
  repository?: string | { type?: string; url?: string };
  bugs?: { url?: string } | string;
  homepage?: string;
  scripts?: Record<string, string>;
  n8n?: {
    n8nNodesApiVersion?: number;
    credentials?: string[];
    nodes?: string[];
    [key: string]: unknown;
  };
  [key: string]: unknown;
}
