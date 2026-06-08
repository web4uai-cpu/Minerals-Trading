import { Injectable } from '@nestjs/common';
import { ComplianceItemType } from '@khanij/types';
import { DocumentAiProvider, ExtractedFields } from './document-ai-provider.interface';

/**
 * Sandbox Document AI Provider — returns structured fixture fields
 * based on document type. No real OCR/AI processing.
 */
@Injectable()
export class SandboxDocumentAiProvider implements DocumentAiProvider {
  private readonly fixtures: Record<string, Record<string, string | number | null>> = {
    [ComplianceItemType.MINING_LEASE]: {
      leaseNumber: 'ML-RJ-2022-001',
      holder: 'SANDBOX STONE EXPORTS PVT LTD',
      mineral: 'Dimensional Stone',
      state: 'Rajasthan',
      area: '25 hectares',
      validFrom: '2022-01-01',
      validUntil: '2042-12-31',
    },
    [ComplianceItemType.ENV_CLEARANCE]: {
      ecNumber: 'EC/2022/RJ/001',
      projectName: 'Sandbox Mine Project',
      category: 'B1',
      validFrom: '2022-06-01',
      validUntil: '2027-05-31',
    },
    [ComplianceItemType.PAN]: {
      panNumber: 'AAAAA1234A',
      name: 'SANDBOX MINERALS PVT LTD',
      panType: 'Company',
    },
    [ComplianceItemType.GST_REG]: {
      gstin: '07AAAAA1234A1Z1',
      tradeName: 'SANDBOX MINERALS',
      status: 'Active',
      state: 'Delhi',
    },
  };

  async extractFields(s3Key: string, docType: ComplianceItemType): Promise<ExtractedFields> {
    const fields = this.fixtures[docType] ?? {
      documentId: 'SANDBOX-DOC-001',
      extractedFrom: s3Key,
      note: 'No fixture defined for this document type (sandbox)',
    };

    return {
      docType,
      fields,
      confidence: 0.95,
      rawText: `[Sandbox extracted text for ${docType} from ${s3Key}]`,
    };
  }
}
