import type {
  IDataObject,
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
} from 'n8n-workflow';

import { auditPackage, formatMarkdownReport, formatTextReport } from '../../index.js';
import type { AuditReport } from '../../types.js';

type OutputFormat = 'json' | 'markdown' | 'text';

function formatReport(report: AuditReport, format: OutputFormat): string | AuditReport {
  if (format === 'markdown') return formatMarkdownReport(report);
  if (format === 'text') return formatTextReport(report);
  return report;
}

function reportToJson(report: AuditReport, format: OutputFormat, minScore: number): IDataObject {
  const formattedReport = formatReport(report, format);
  return {
    packagePath: report.packagePath,
    packageName: report.packageName,
    version: report.version,
    score: report.score,
    summary: report.summary as unknown as IDataObject,
    checks: report.checks as unknown as IDataObject[],
    minScore,
    passed: report.summary.fail === 0 && report.score >= minScore,
    format,
    formattedReport: typeof formattedReport === 'string' ? formattedReport : JSON.stringify(formattedReport, null, 2),
  };
}

export class PackageAuditor implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'n8n Package Auditor',
    name: 'packageAuditor',
    group: ['transform'],
    version: 1,
    subtitle: '={{$parameter["format"]}}',
    description: 'Audit n8n community-node packages for metadata, CI, provenance, and documentation readiness',
    defaults: {
      name: 'n8n Package Auditor',
    },
    usableAsTool: true,
    inputs: ['main'],
    outputs: ['main'],
    properties: [
      {
        displayName: 'Package Path',
        name: 'packagePath',
        type: 'string',
        default: '.',
        required: true,
        description: 'Path to the package folder as seen by the n8n runtime. For Docker, mount the target repo into the container first.',
      },
      {
        displayName: 'Output Format',
        name: 'format',
        type: 'options',
        default: 'json',
        options: [
          { name: 'JSON', value: 'json' },
          { name: 'Markdown', value: 'markdown' },
          { name: 'Text', value: 'text' },
        ],
        description: 'Format to include in the formattedReport field',
      },
      {
        displayName: 'Minimum Score',
        name: 'minScore',
        type: 'number',
        default: 80,
        typeOptions: {
          minValue: 0,
          maxValue: 100,
        },
        description: 'Minimum acceptable score used to set the passed field',
      },
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const returnData: INodeExecutionData[] = [];

    for (let itemIndex = 0; itemIndex < items.length; itemIndex += 1) {
      const packagePath = this.getNodeParameter('packagePath', itemIndex) as string;
      const format = this.getNodeParameter('format', itemIndex) as OutputFormat;
      const minScore = this.getNodeParameter('minScore', itemIndex, 80) as number;

      try {
        const report = await auditPackage(packagePath);
        returnData.push({
          json: reportToJson(report, format, minScore),
          pairedItem: { item: itemIndex },
        });
      } catch (error) {
        const message = (error as Error).message;
        if (!this.continueOnFail()) throw error;
        returnData.push({
          json: {
            error: message,
            packagePath,
            passed: false,
          },
          pairedItem: { item: itemIndex },
        });
      }
    }

    return [returnData];
  }
}
