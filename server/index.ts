import express from "express";
import cors from "cors";

import { computeScore } from "./core/kernel";
import { governanceDescriptor } from "./core/governance";
import {
  buildEvaluationSignature,
  verifyEvaluationSignature
} from "./core/audit";

/* =========================
   SECURITY CONFIG
========================= */

const MAX_ALLOWED_AGE_MS = 60000;
const MAX_FUTURE_DRIFT_MS = 5000;

function validateExpiration(
  timestamp: string,
  maxAgeMs: number
): void {

  if (!timestamp) {
    throw new Error("Missing timestamp");
  }

  if (!maxAgeMs) {
    throw new Error("Missing max_age_ms");
  }

  if (maxAgeMs > MAX_ALLOWED_AGE_MS) {
    throw new Error("max_age_ms exceeds allowed limit");
  }

  const requestTime = new Date(timestamp);

  if (isNaN(requestTime.getTime())) {
    throw new Error("Invalid RFC3339 timestamp");
  }

  const now = new Date();
  const ageMs = now.getTime() - requestTime.getTime();

  if (ageMs < -MAX_FUTURE_DRIFT_MS) {
    throw new Error("Timestamp too far in future");
  }

  if (ageMs > maxAgeMs) {
    throw new Error("Signature expired");
  }
}

/* =========================
   APP INIT
========================= */

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());

/* =========================
   HEALTH
========================= */

app.get("/health", (req, res) => {
  res.json({
    status: "JONAH ACTIVE",
    version: "1.0.0"
  });
});

/* =========================
   EVALUATE ENDPOINT
========================= */

app.post("/evaluate", (req, res) => {
  try {

    const { timestamp, max_age_ms } = req.body;

    // ✅ SECURITY LAYER (tidak ubah core call)
    validateExpiration(timestamp, max_age_ms);

    // ✅ BIARKAN LOGIKA ASLI ANDA TETAP
    const result = computeScore(req.body);

    res.json(result);

  } catch (err: any) {
    res.status(400).json({
      error: err.message
    });
  }
});

/* =========================
   START SERVER
========================= */

app.listen(PORT, () => {
  console.log(`JONAH Engine running on port ${PORT}`);
});
