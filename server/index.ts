import express from "express";
import crypto from "crypto";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());

/* ============================================================
   CORE CONFIG
============================================================ */

const PORT = process.env.PORT || 8080;
const SOVEREIGN_MODE = process.env.SOVEREIGN_MODE === "true";

/* ============================================================
   HASH ENGINE
============================================================ */

function generateHash(payload: any, previousHash: string) {
  const data = JSON.stringify(payload) + previousHash;
  return crypto.createHash("sha256").update(data).digest("hex");
}

/* ============================================================
   SOVEREIGN ESCALATION FRAMEWORK (DETERMINISTIC)
============================================================ */

function calculateEscalation(governanceScore: number) {
  let escalationLevel = 0;
  let governanceFlags: string[] = [];
  let action = "none";

  if (governanceScore >= 80) {
    escalationLevel = 0;
    action = "none";
  } else if (governanceScore >= 60) {
    escalationLevel = 1;
    governanceFlags.push("performance_monitoring");
    action = "performance_monitoring";
  } else if (governanceScore >= 40) {
    escalationLevel = 2;
    governanceFlags.push("critical_alert");
    action = "critical_alert";
  } else {
    escalationLevel = 3;
    governanceFlags.push("sovereign_intervention_required");
    action = "sovereign_intervention_required";
  }

  let sovereignAction = null;

  if (escalationLevel === 3 && SOVEREIGN_MODE) {
    sovereignAction = "SOVEREIGN_ESCALATION_LAYER_ACTIVATED";
  }

  return {
    escalationLevel,
    governanceFlags,
    action,
    sovereignAction
  };
}

/* ============================================================
   HEALTH CHECK
============================================================ */

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

/* ============================================================
   ENV CHECK (DEBUG SAFE)
============================================================ */

app.get("/env-check", (req, res) => {
  res.json({
    SOVEREIGN_MODE: process.env.SOVEREIGN_MODE,
    parsed: SOVEREIGN_MODE
  });
});

/* ============================================================
   EVALUATION ENGINE
============================================================ */

app.post("/evaluate", (req, res) => {
  const { user, score } = req.body;

  if (typeof score !== "number") {
    return res.status(400).json({
      error: "Score must be numeric"
    });
  }

  const governanceScore = Math.max(0, Math.min(100, score));

  const escalation = calculateEscalation(governanceScore);

  const evaluationId = crypto.randomUUID();
  const previousHash = "0000000000000000";
  const hash = generateHash({ user, score }, previousHash);

  return res.json({
    evaluationId,
    hash,
    signatureVersion: "prod_v2",
    governanceScore,
    escalationLevel: escalation.escalationLevel,
    governanceFlags: escalation.governanceFlags,
    action: escalation.action,
    sovereignAction: escalation.sovereignAction
  });
});

/* ============================================================
   SERVER START
============================================================ */

app.listen(PORT, () => {
  console.log(`JONAH Engine running on port ${PORT}`);
});
