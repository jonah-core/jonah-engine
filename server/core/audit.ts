import crypto from "crypto";
import { getActiveKey, getKeyById } from "./security";

export interface AuditRecord {
  evaluationId: string;
  payload: any;
  hash: string;
  previousHash: string;
  signatureVersion: string;
}

export function createAuditHash(payload: any, previousHash: string) {
  const { keyId, secret } = getActiveKey();

  const hash = crypto
    .createHmac("sha256", secret)
    .update(JSON.stringify(payload) + previousHash)
    .digest("hex");

  return {
    hash,
    signatureVersion: keyId
  };
}

export function verifyAuditRecord(
  evaluationId: string,
  payload: any,
  hash: string,
  previousHash: string,
  signatureVersion: string
) {
  const secret = getKeyById(signatureVersion);

  const recalculated = crypto
    .createHmac("sha256", secret)
    .update(JSON.stringify(payload) + previousHash)
    .digest("hex");

  return {
    evaluationId,
    valid: recalculated === hash,
    hash,
    previousHash,
    signatureVersion
  };
}
