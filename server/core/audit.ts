import crypto from "crypto";

/* ============================================================
   ENV KEY PARSER
============================================================ */

function parseJonahKeys(): Record<string, string> {
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

function getActiveKey() {
  const activeKeyId = process.env.JONAH_ACTIVE_KEY_ID;
  const keys = parseJonahKeys();

  if (!activeKeyId) {
    throw new Error("JONAH_ACTIVE_KEY_ID not defined");
  }

  const secret = keys[activeKeyId];

  if (!secret) {
    throw new Error(`Active key '${activeKeyId}' not found in JONAH_KEYS`);
  }

  return { activeKeyId, secret };
}

/* ============================================================
   HASH + HMAC
============================================================ */

export function hashObject(obj: any): string {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(obj))
    .digest("hex");
}

export function hmacSign(data: string, secret: string): string {
  return crypto
    .createHmac("sha256", secret)
    .update(data)
    .digest("hex");
}

/* ============================================================
   BUILD SIGNATURE (UPDATED WITH key_id)
============================================================ */

export function buildEvaluationSignature(
  input: any,
  result: any,
  governance: any
) {
  const { activeKeyId, secret } = getActiveKey();

  const input_hash = hashObject(input);

  const evaluation_payload = {
    input_hash,
    result,
    governance,
  };

  const evaluation_hash = hashObject(evaluation_payload);

  const hmac = hmacSign(evaluation_hash, secret);

  return {
    key_id: activeKeyId,
    timestamp: new Date().toISOString(),
    input_hash,
    evaluation_hash,
    hmac,
  };
}

/* ============================================================
   VERIFY SIGNATURE (MULTI KEY SUPPORT)
============================================================ */

export function verifyEvaluationSignature(
  input: any,
  result: any,
  governance: any,
  signature: any
) {
  const keys = parseJonahKeys();

  const keyExists = !!keys[signature.key_id];

  if (!keyExists) {
    return {
      valid: false,
      checks: {
        key_exists: false,
        input_hash_match: false,
        evaluation_hash_match: false,
        hmac_match: false,
      },
    };
  }

  const secret = keys[signature.key_id];

  const recomputed_input_hash = hashObject(input);

  const evaluation_payload = {
    input_hash: recomputed_input_hash,
    result,
    governance,
  };

  const recomputed_evaluation_hash = hashObject(evaluation_payload);

  const recomputed_hmac = hmacSign(
    recomputed_evaluation_hash,
    secret
  );

  const input_hash_match =
    recomputed_input_hash === signature.input_hash;

  const evaluation_hash_match =
    recomputed_evaluation_hash === signature.evaluation_hash;

  const hmac_match =
    recomputed_hmac === signature.hmac;

  return {
    valid:
      keyExists &&
      input_hash_match &&
      evaluation_hash_match &&
      hmac_match,
    checks: {
      key_exists: keyExists,
      input_hash_match,
      evaluation_hash_match,
      hmac_match,
    },
  };
}
