export interface GovernanceResult {
  governanceScore: number;
  flags: string[];
}

export function evaluateGovernance(payload: any): GovernanceResult {
  let score = 100;
  const flags: string[] = [];

  // Rule 1: payload must contain user
  if (!payload.user) {
    score -= 20;
    flags.push("missing_user");
  }

  // Rule 2: score must be between 0–100 if provided
  if (typeof payload.score === "number") {
    if (payload.score < 0 || payload.score > 100) {
      score -= 30;
      flags.push("invalid_score_range");
    }
  }

  // Rule 3: no empty object
  if (Object.keys(payload).length === 0) {
    score -= 50;
    flags.push("empty_payload");
  }

  if (score < 0) score = 0;

  return {
    governanceScore: score,
    flags
  };
}
