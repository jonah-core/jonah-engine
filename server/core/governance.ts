export interface GovernanceResult {
  governanceScore: number;
  flags: string[];
  riskLevel: "low" | "medium" | "high";
}

function normalizePayload(payload: any) {
  // deterministic ordering (important for chain stability)
  return JSON.parse(JSON.stringify(payload, Object.keys(payload).sort()));
}

export function evaluateGovernance(payload: any): GovernanceResult {
  let score = 100;
  const flags: string[] = [];

  const normalized = normalizePayload(payload);

  // ─────────────────────────────
  // STRUCTURAL RULES
  // ─────────────────────────────

  if (!normalized.user) {
    score -= 20;
    flags.push("missing_user");
  }

  if (Object.keys(normalized).length === 0) {
    score -= 50;
    flags.push("empty_payload");
  }

  // ─────────────────────────────
  // CONSISTENCY RULES
  // ─────────────────────────────

  if (typeof normalized.score === "number") {
    if (normalized.score < 0 || normalized.score > 100) {
      score -= 30;
      flags.push("invalid_score_range");
    }

    if (normalized.score < 40) {
      score -= 10;
      flags.push("low_performance_indicator");
    }
  }

  // ─────────────────────────────
  // INTEGRITY SIGNALS
  // ─────────────────────────────

  if (typeof normalized.user === "string") {
    if (normalized.user.length < 3) {
      score -= 10;
      flags.push("weak_user_identifier");
    }
  }

  // Floor clamp
  if (score < 0) score = 0;

  // Risk grading
  let riskLevel: "low" | "medium" | "high";

  if (score >= 80) {
    riskLevel = "low";
  } else if (score >= 50) {
    riskLevel = "medium";
  } else {
    riskLevel = "high";
  }

  return {
    governanceScore: score,
    flags,
    riskLevel
  };
}
