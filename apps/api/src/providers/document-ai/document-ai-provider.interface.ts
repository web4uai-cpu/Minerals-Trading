/**
 * Document AI Provider interface — field extraction from uploaded documents.
 *
 * MVP: SandboxDocumentAiProvider (returns fixture fields).
 * Later: AWS Textract integration. Parsed output stored in MongoDB.
 */

import { ComplianceItemType } from '@khanij/types';

export interface ExtractedFields {
  docType: ComplianceItemType;
  fields: Record<string, string | number | null>;
  confidence: number; // 0–1
  rawText?: string;
}

export interface DocumentAiProvider {
  extractFields(s3Key: string, docType: ComplianceItemType): Promise<ExtractedFields>;
}

/** DI token for the DocumentAiProvider interface. */
export const DOCUMENT_AI_PROVIDER = Symbol('DOCUMENT_AI_PROVIDER');
