export interface EvaluationInput {
  epistemic: number;
  structural: number;
  risk: number;
  ethical: number;
}

export interface EvaluationOutput {
  rationality_score: number;
}

export function computeScore(input: EvaluationInput): EvaluationOutput {
  const { epistemic, structural, risk, ethical } = input;

  const score =
    (0.35 * epistemic +
      0.25 * structural +
      0.20 * (1 - risk) +
      0.20 * ethical) * 100;

  return {
    rationality_score: Number(score.toFixed(2)),
  };
}
