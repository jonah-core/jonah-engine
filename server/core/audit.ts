import crypto from "crypto";

/* =========================================================
   KEY LOADER (Multi-Key Rotation)
========================================================= */

function parseKeys(): Record<string, string> {
  const raw = process.env.JONAH_KEYS || "";
  const pairs = raw.split(",").map(k => k.trim()).filter(Boolean);

  const map: Record<string, string> = {};

  for (const pair of pairs) {
    const [id, secret] = pair.split(":");
    if (id && secret) {
      map[id.trim()] = secret.trim();
    }
  }

  return map;
}

function getActiveKey(): { key_id: string; secret: string } {
  const activeId = process.env.JONAH_ACTIVE_KEY_ID;
  const keys = parseKeys();

  if (!activeId || !keys[activeId]) {
    throw new Error("Invalid JONAH key configuration");
  }

  return {
    key_id: activeId,
    secret: keys[activeId],
  };
}

/* =========================================================
   HASHING UTILITIES
========================================================= */

export function hashObject(obj: any): string {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(obj))
    .digest("hex");
}

function hmacSign(payload: string, secret: string): string {
  return crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");
}

/* =========================================================
   TRACE ID
========================================================= */

export function generateTraceId(): string {
  return crypto.randomUUID();
}

/* =========================================================
   SIGNATURE BUILDER (HMAC + key_id)
========================================================= */

export function buildEvaluationSignature(
  input: any,
  result: any,
  governance: any
) {
  const { key_id, secret } = getActiveKey();

  const input_hash = hashObject(input);

  const evaluation_payload = {
    input_hash,
    result,
    governance,
  };

  const evaluation_hash = hashObject(evaluation_payload);

  const hmac = hmacSign(evaluation_hash, secret);

  return {
    key_id,
    trace_id: generateTraceId(),
    timestamp: new Date().toISOString(),
    input_hash,
    evaluation_hash,
    hmac,
  };
}

/* =========================================================
   SIGNATURE VERIFIER
========================================================= */

export function verifyEvaluationSignature(
  input: any,
  result: any,
  governance: any,
  signature: any
) {
  const keys = parseKeys();

  const secret = keys[signature.key_id];
  if (!secret) {
    return {
      valid: false,
      checks: {
        input_hash_match: false,
        evaluation_hash_match: false,
        hmac_match: false,
      },
    };
  }

  const recomputed_input_hash = hashObject(input);

  const evaluation_payload = {
    input_hash: recomputed_input_hash,
    result,
    governance,
  };

  const recomputed_evaluation_hash = hashObject(evaluation_payload);
  const recomputed_hmac = hmacSign(recomputed_evaluation_hash, secret);

  const input_hash_match =
    recomputed_input_hash === signature.input_hash;

  const evaluation_hash_match =
    recomputed_evaluation_hash === signature.evaluation_hash;

  const hmac_match =
    recomputed_hmac === signature.hmac;

  return {
    valid: input_hash_match && evaluation_hash_match && hmac_match,
    checks: {
      input_hash_match,
      evaluation_hash_match,
      hmac_match,
    },
  };
}
