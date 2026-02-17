import crypto from "crypto";

/*
========================================
JONAH CORE — AUDIT + CRYPTO SIGNING
========================================
Deterministic hashing + HMAC signing
*/

const SECRET_KEY = process.env.JONAH_SECRET || "JONAH_DEV_SECRET";

/*
========================================
UTILS
========================================
*/

function stableStringify(obj: any): string {
  return JSON.stringify(sortObject(obj));
}

function sortObject(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(sortObject);
  }
  if (obj !== null && typeof obj === "object") {
    return Object.keys(obj)
      .sort()
      .reduce((acc: any, key) => {
        acc[key] = sortObject(obj[key]);
        return acc;
      }, {});
  }
  return obj;
}

export function hashObject(obj: any): string {
  return crypto
    .createHash("sha256")
    .update(stableStringify(obj))
    .digest("hex");
}

export function generateTraceId(): string {
  return crypto.randomUUID();
}

/*
========================================
HMAC SIGNER
========================================
*/

function signPayload(payload: any): string {
  return crypto
    .createHmac("sha256", SECRET_KEY)
    .update(stableStringify(payload))
    .digest("hex");
}

/*
========================================
SIGNATURE BUILDER
========================================
*/

export function buildEvaluationSignature(
  input: any,
  result: any,
  governance: any
) {
  const input_hash = hashObject(input);

  const evaluation_payload = {
    input_hash,
    result,
    governance
  };

  const evaluation_hash = hashOb_
