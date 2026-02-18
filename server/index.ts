import express from "express";
import crypto from "crypto";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());

/* ======================================================
   CONFIG
====================================================== */

const JONAH_ACTIVE_KEY_ID = process.env.JONAH_ACTIVE_KEY_ID || "prod_v2";
const JONAH_KEYS = process.env.JONAH_KEYS
  ? JSON.parse(process.env.JONAH_KEYS)
  : {};

const SOVEREIGN_MODE = process.env.SOVEREIGN_MODE === "true";

/* ======================================================
   HEALTH
====================================================== */

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

/* ======================================================
   ENV CHECK (DEBUG)
====================================================== */

app.get("/env-check", (req, res) => {
  res.json({
    SOVEREIGN_MODE: process.env.SOVEREIGN_MODE,
    parsed: SOVEREIGN_MODE,
  });
});

/* ======================================================
   HASH ENGINE
====================================================== */

function generateHash(payload: any, previousHash: string, keyId: string) {
  const secret = JONAH_KEYS[keyId];
  if (!secret) {
    throw new Error("Invalid keyId");
  }

  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(JSON.stringify(payload) + previousHash);
  return hmac.digest("hex");
}

/* ======================================================
   INJECT (Rotation Compatible)
====================================================== */

app.post("/inject", (req, res) => {
  try {
    const {
      id,
      payload,
      hash,
      previousHash,
      signatureVersion,
    } = req.body;

    const expectedHash = generateHash(
      payload,
      previousHash,
      signatureVersion
    );

    if (expectedHash !== hash) {
      return res.status(400).json({
        error: "Invalid hash",
      });
    }

    return res.json({
      injected: true,
    });
  } catch (err: any) {
    return res.status(500).json({
      error: err.message,
    });
  }
});

/* ======================================================
   GOVERNANCE V2 + SOVEREIGN ESCALATION
====================================================== */

app.post("/evaluate", (req, res) => {
  const { user, score } = req.body;

  const evaluationId = crypto.randomUUID();
  const previousHash = "0000000000000000";

  const payload = { user, score };

  const hash = generateHash(payload, previousHash, JONAH_ACTIVE_KEY_ID);

  /* ===============================
     GOVERNANCE LOGIC
  =============================== */

  let governanceScore = 100;
  const governanceFlags: string[] = [];
  let riskLevel = "low";

  if (score < 80) {
    governanceScore -= 10;
    governanceFlags.push("low_performance_indicator");
  }

  if (score < 50) {
    governanceScore -= 20;
    governanceFlags.push("critical_performance_indicator");
    riskLevel = "high";
  }

  /* ===============================
     SOVEREIGN LAYER
  =============================== */

  if (SOVEREIGN_MODE && riskLevel === "high") {
    governanceScore -= 10;
    governanceFlags.push("sovereign_intervention_required");
  }

  return res.json({
    evaluationId,
    hash,
    signatureVersion: JONAH_ACTIVE_KEY_ID,
    governanceScore,
    governanceFlags,
    riskLevel,
  });
});

/* ======================================================
   VERIFY
====================================================== */

app.get("/verify/:id", (req, res) => {
  return res.json({
    message: "Verification endpoint placeholder",
  });
});

/* ======================================================
   SERVER
====================================================== */

const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
  console.log(`JONAH Engine running on port ${PORT}`);
});
