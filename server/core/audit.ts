import crypto from "crypto";

export function hashObject(data: any): string {
  const json = JSON.stringify(data);
  return crypto.createHash("sha256").update(json).digest("hex");
}

export function generateTraceId(): string {
  return crypto.randomUUID();
}

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
