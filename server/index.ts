import express from "express";
import cors from "cors";
import { evaluate } from "./core/evaluator";
import { governanceDescriptor } from "./core/governance";
import { buildEvaluationSignature } from "./core/audit";

const app = express();

app.use(cors());
app.use(express.json());

/**
 * Health Endpoint
 */
app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    engine: "JONAH_CORE",
    timestamp: new Date().toISOString()
  });
});

/**
 * Governance Metadata Endpoint
 */
app.get("/api/v1/governance", (req, res) => {
  res.json(governanceDescriptor());
});

/**
 * Core Evaluation Endpoint
 */
app.post("/api/v1/evaluate", (req, res) => {
  try {
    const input = req.body;

    const result = evaluate(input);
    const governance = governanceDescriptor();

    const signature = buildEvaluationSignature(
      input,
      result,
      governance
    );

    res.json({
      governance,
      signature,
      result
    });

  } catch (error) {
    res.status(500).json({
      error: "Evaluation failed",
      deterministic: false
    });
  }
});

/**
 * Server Boot
 */
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`JONAH Core running on port ${PORT}`);
});
