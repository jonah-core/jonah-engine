export function verifyEvaluationSignature(
  input: any,
  result: any,
  governance: any,
  signature: any
) {
  const keysRaw = process.env.JONAH_KEYS || "";
  const activeKeys = keysRaw.split(",").reduce((acc: any, pair) => {
    const [id, secret] = pair.split(":");
    if (id && secret) {
      acc[id.trim()] = secret.trim();
    }
    return acc;
  }, {});

  const keyId = signature.key_id;
  const secret = activeKeys[keyId];

  if (!secret) {
    return {
      valid: false,
      checks: {
        input_hash_match: false,
        evaluation_hash_match: false,
        hmac_match: false,
        key_found: false
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
      input_hash_match,
      evaluation_hash_match,
      hmac_match,
      key_found: true
    }
  };
}
