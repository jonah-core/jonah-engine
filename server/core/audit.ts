import crypto from "crypto";

export interface AuditRecord {
  evaluationId: string;
  payload: any;
  hash: string;
  previousHash: string;
  signatureVersion: string;
}

/**
 * Create deterministic HMAC hash chained with previous hash
 */
export function createAuditHash(
  payload: any,
  previousHash: string,
  secret: string
): string {
  return crypto
    .createHmac("sha256", secret)
    .update(JSON.stringify(payload) + previousHash)
    .digest("hex");
}

/**
 * Verify existing audit record integrity
 */
export function verifyAuditRecord(
  evaluationId: string,
  payload: any,
  hash: string,
  previousHash: string,
  secret: string
) {
  const recalculated = crypto
    .createHmac("sha256", secret)
    .update(JSON.stringify(payload) + previousHash)
    .digest("hex");

  return {
    evaluationId,
    valid: recalculated === hash,
    hash,
    previousHash
  };
}
