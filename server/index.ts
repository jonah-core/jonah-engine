import express from "express";
import cors from "cors";
import { computeScore } from "./core/kernel";
import { governanceDescriptor } from "./core/governance";
import { buildEvaluationSignature } from "./core/audit";

const app = express();

app.use(cors());
app.use(express.json());

/* =========================
   HEALTH
========================= */

app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    engine: "JONAH_CORE",
    timestamp: new Date().toISOString()
  });
});

/* =========================
   GOVERNANCE
========================= */

app.get("/api/v1/governance", (req, res) => {
  res.json(governanceDescriptor());
});

/* =========================
   EVALUATE
========================= */

app.post("/api/v1/evaluate", (req, res) => {
  try {
    const input = req.body;

    const result = computeScore(input);
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
      error: "Evaluation failed"
    });
  }
});

/* =========================
   START
========================= */

const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
  console.log(`JONAH Core running on port ${PORT}`);
});
