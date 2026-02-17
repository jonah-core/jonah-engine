import crypto from "crypto";

/*
|--------------------------------------------------------------------------
| HASH UTILITY
|--------------------------------------------------------------------------
*/

export function hashObject(obj: any): string {
  const normalized = JSON.stringify(obj, Object.keys(obj).sort());
  return crypto.createHash("sha256").update(normalized).digest("hex");
}

export function hmacSign(payload: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

/*
|--------------------------------------------------------------------------
| KEY REGISTRY (MULTI KEY SUPPORT)
|--------------------------------------------------------------------------
|
| ENV FORMAT:
| JONAH_ACTIVE_KEY_ID = k1
| JONAH_KEYS = k1:secret1,k2:secret2
|
*/

function loadKeyRegistry() {
  const keysRaw = process.env.JONAH_KEYS || "";
  const activeKeyId = process.env.JONAH_ACTIVE_KEY_ID || "";

  const registry = keysRaw.split(",").reduce((acc: any, pair) => {
    const [id, secret] = pair.split(":");
    if (id && secret) {
      acc[id.trim()] = secret.trim();
    }
    return acc;
  }, {});

  if (!activeKeyId || !registry[activeKeyId]) {
    throw new Error("JONAH active key not configured properly");
  }

  return {
    activeKeyId,
    registry
  };
}

/*
|--------------------------------------------------------------------------
| BUILD SIGNATURE
|--------------------------------------------------------------------------
*/

export function buildEvaluationSignature(
  input: any,
  result: any,
  governance: any
) {
  const { activeKeyId, registry } = loadKeyRegistry();
  const secret = registry[activeKeyId];

  const input_hash = hashObject(input);

  const evaluation_payload = {
    input_hash,
    result,
    governance
  };

  const evaluation_hash = hashObject(evaluation_payload);
  const hmac = hmacSign(evaluation_hash, secret);

  return {
    key_id: activeKeyId,
    input_hash,
    evaluation_hash,
    hmac,
    timestamp: new Date().toISOString()
  };
}

/*
|--------------------------------------------------------------------------
| VERIFY SIGNATURE
|--------------------------------------------------------------------------
*/

export function verifyEvaluationSignature(
  input: any,
  result: any,
  governance: any,
  signature: any
) {
  const { registry } = loadKeyRegistry();

  const keyId = signature?.key_id;
  const secret = registry[keyId];

  if (!secret) {
    return {
      valid: false,
      checks: {
        key_exists: false,
        input_hash_match: false,
        evaluation_hash_match: false,
        hmac_match: false
      }
    };
  }

  const recomputed_input_hash = hashObject(input);

  const evaluation_payload = {
    input_hash: recomputed_input_hash,
    result,
    governance
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
      key_exists: true,
      input_hash_match,
      evaluation_hash_match,
      hmac_match
    }
  };
}
