// @khanij/blockchain — Blockchain evidence layer domain logic (audit hash anchoring, hash chain verification, immutability checks)

export {
  computeAnchorHash,
  createAnchorProof,
  verifyAnchorProof,
  verifyChain,
} from './logic/hash-chain';
export type { AnchorRecord, AnchorProof } from './logic/hash-chain';

export {
  createEvidenceAnchor,
  verifyEvidenceAnchor,
} from './logic/evidence-registry';
export type { EvidenceAnchor } from './logic/evidence-registry';
