import crypto from "crypto";

/* =========================
   HASH UTILITY
========================= */

export function hashObject(data: any): string {
  const json = JSON.stringify(data);
  return crypto.createHash("sha256").update(json).digest("hex");
}

export function generateTraceId(): string {
  return crypto.randomUUID();
}

/* =========================
   SIGNATURE BUILDER
========================= */

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

  const evaluation_hash = hashObject(evaluation_payload);

  return {
    trace_id: generateTraceId(),
    timestamp: new Date().toISOString(),
    input_hash,
    evaluation_hash
  };
}

/* =========================
   SIGNATURE VERIFIER
========================= */

export function verifyEvaluationSignature(
  input: any,
  result: any,
  governance: any,
  signature: any
) {
  const recomputed_input_hash = hashObject(input);

  const evaluation_payload = {
    input_hash: recomputed_input_hash,
    result,
    governance
  };

  const recomputed_evaluation_hash = hashObject(evaluation_payload);

  const input_valid =
    recomputed_input_hash === signature.input_hash;

  const evaluation_valid =
    recomputed_evaluation_hash === signature.evaluation_hash;

  return {
    valid: input_valid && evaluation_valid,
    checks: {
      input_hash_match: input_valid,
      evaluation_hash_match: evaluation_valid
    }
  };
}
