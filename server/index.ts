import express from "express";
import crypto from "crypto";
import Redis from "ioredis";

const app = express();
app.use(express.json());

const redis = new Redis(process.env.REDIS_URL!);

const SOVEREIGN_MODE = process.env.SOVEREIGN_MODE === "true";

/* =========================
   GOVERNANCE ENGINE
========================= */

function calculateGovernance(score: number) {
  let governanceScore = 100;
  let governanceFlags: string[] = [];
  let riskLevel = "low";

  if (score < 30) {
    governanceScore = 60;
    governanceFlags.push("critical_performance_indicator");
    riskLevel = "high";
  } else if (score < 70) {
    governanceScore = 80;
    governanceFlags.push("medium_performance_indicator");
    riskLevel = "medium";
  } else if (score < 95) {
    governanceScore = 90;
    governanceFlags.push("low_performance_indicator");
    riskLevel = "low";
  }

  // Sovereign escalation layer
  if (SOVEREIGN_MODE) {
    if (riskLevel === "high") {
      governanceFlags.push("sovereign_intervention_required");
      governanceScore -= 10;
    }

    if (riskLevel === "medium") {
      governanceFlags.push("sovereign_monitoring");
    }
  }

  return { governanceScore, governanceFlags, riskLevel };
}

/* =========================
   EVALUATE ENDPOINT
========================= */

app.post("/evaluate", async (req, res) => {
  const { user, score } = req.body;

  const evaluationId = crypto.randomUUID();

  const payload = JSON.stringify({ user, score });
  const previousHash = "0000000000000000";
  const activeKeyId = process.env.JONAH_ACTIVE_KEY_ID!;
  const keys = JSON.parse(process.env.JONAH_KEYS!);
  const secret = keys[activeKeyId];

  const hash = crypto
    .createHmac("sha256", secret)
    .update(payload + previousHash)
    .digest("hex");

  const governance = calculateGovernance(score);

  const record = {
    evaluationId,
    hash,
    previousHash,
    signatureVersion: activeKeyId,
    ...governance,
  };

  await redis.set(`audit:${evaluationId}`, JSON.stringify(record));

  res.json(record);
});

/* =========================
   VERIFY ENDPOINT
========================= */

app.get("/verify/:id", async (req, res) => {
  const record = await redis.get(`audit:${req.params.id}`);
  if (!record) return res.status(404).json({ error: "Not found" });

  res.json(JSON.parse(record));
});

/* =========================
   HEALTH
========================= */

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.listen(8080, () => {
  console.log("JONAH Engine running on port 8080");
});
