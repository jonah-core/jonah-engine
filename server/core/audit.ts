import crypto from "crypto";

/* =========================
   HASH UTIL
========================= */

export function hashObject(obj: any): string {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(obj))
    .digest("hex");
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

  const signaturePayload = {
    trace_id: generateTraceId(),
    timestamp: new Date().toISOString(),
    input_hash,
    evaluation_hash
  };

  const secret = process.env.JONAH_SECRET || "";

  const hmac = crypto
    .createHmac("sha256", secret)
    .update(JSON.stringify(signaturePayload))
    .digest("hex");

  return {
    ...signaturePayload,
    hmac
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

  const recomputed_evaluation_hash = hashObject({
    input_hash: recomputed_input_hash,
    result,
    governance
  });

  const secret = process.env.JONAH_SECRET || "";

  const recomputed_hmac = crypto
    .createHmac("sha256", secret)
    .update(
      JSON.stringify({
        trace_id: signature.trace_id,
        timestamp: signature.timestamp,
        input_hash: recomputed_input_hash,
        evaluation_hash: recomputed_evaluation_hash
      })
    )
    .digest("hex");

  return {
    valid:
      recomputed_input_hash === signature.input_hash &&
      recomputed_evaluation_hash === signature.evaluation_hash &&
      recomputed_hmac === signature.hmac,
    checks: {
      input_hash_match:
        recomputed_input_hash === signature.input_hash,
      evaluation_hash_match:
        recomputed_evaluation_hash === signature.evaluation_hash,
      hmac_match:
        recomputed_hmac === signature.hmac
    }
  };
}
