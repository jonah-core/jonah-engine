import express from "express";
import dotenv from "dotenv";
import crypto from "crypto";
import Redis from "ioredis";

dotenv.config();

const app = express();
app.use(express.json());

const redis = new Redis(process.env.REDIS_URL as string);

// ===============================
// ENV CONFIG
// ===============================

const SOVEREIGN_MODE = process.env.SOVEREIGN_MODE === "true";

// ===============================
// HEALTH
// ===============================

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// ===============================
// ENV CHECK (DEBUG)
// ===============================

app.get("/env-check", (req, res) => {
  res.json({
    SOVEREIGN_MODE: process.env.SOVEREIGN_MODE,
    parsed: SOVEREIGN_MODE,
  });
});

// ===============================
// GOVERNANCE LOGIC
// ===============================

function evaluateGovernance(score: number) {
  let governanceScore = 100;
  const governanceFlags: string[] = [];
  let riskLevel = "low";

  if (score < 50) {
    governanceScore -= 30;
    governanceFlags.push("low_performance_indicator");
  }

  if (score < 20) {
    governanceScore -= 20;
    governanceFlags.push("critical_performance_indicator");
    riskLevel = "high";
  }

  // Sovereign Override Layer
  if (SOVEREIGN_MODE && score < 30) {
    governanceFlags.push("sovereign_intervention_required");
    riskLevel = "high";
  }

  return {
    governanceScore,
    governanceFlags,
    riskLevel,
  };
}

// ===============================
// HASH GENERATION
// ===============================

function generateHash(payload: any, previousHash: string) {
  const keys = JSON.parse(process.env.JONAH_KEYS as string);
  const activeKey = process.env.JONAH_ACTIVE_KEY_ID as string;
  const secret = keys[activeKey];

  return crypto
    .createHmac("sha256", secret)
    .update(JSON.stringify(payload) + previousHash)
    .digest("hex");
}

// ===============================
// EVALUATE ENDPOINT
// ===============================

app.post("/evaluate", async (req, res) => {
  const { user, score } = req.body;

  const evaluationId = crypto.randomUUID();
  const previousHash = "0000000000000000";

  const payload = { user, score };

  const hash = generateHash(payload, previousHash);

  const governance = evaluateGovernance(score);

  await redis.set(
    `audit:${evaluationId}`,
    JSON.stringify({
      payload,
      hash,
      previousHash,
      signatureVersion: process.env.JONAH_ACTIVE_KEY_ID,
    })
  );

  res.json({
    evaluationId,
    hash,
    signatureVersion: process.env.JONAH_ACTIVE_KEY_ID,
    ...governance,
  });
});

// ===============================
// VERIFY ENDPOINT
// ===============================

app.get("/verify/:id", async (req, res) => {
  const { id } = req.params;

  const record = await redis.get(`audit:${id}`);
  if (!record) {
    return res.status(404).json({ error: "Not found" });
  }

  const parsed = JSON.parse(record);

  const recalculated = generateHash(
    parsed.payload,
    parsed.previousHash
  );

  res.json({
    evaluationId: id,
    valid: recalculated === parsed.hash,
    hash: parsed.hash,
    previousHash: parsed.previousHash,
    signatureVersion: parsed.signatureVersion,
  });
});

// ===============================
// SERVER START
// ===============================

const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
  console.log(`JONAH Engine running on port ${PORT}`);
});

