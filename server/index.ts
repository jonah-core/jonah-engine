import express from "express";
import cors from "cors";

import { computeScore } from "./core/kernel";
import { governanceDescriptor } from "./core/governance";
import {
  buildEvaluationSignature,
  verifyEvaluationSignature
} from "./core/audit";

const app = express();
const PORT = process.env.PORT || 8080;

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
  const governance = governanceDescriptor();
  res.json(governance);
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
   VERIFY
========================= */
app.post("/api/v1/verify", (req, res) => {
  try {
    const { input, result, governance, signature } = req.body;

    const verification = verifyEvaluationSignature(
