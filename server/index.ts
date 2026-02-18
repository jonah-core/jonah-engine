import express from "express";
import dotenv from "dotenv";
import Redis from "ioredis";
import crypto from "crypto";

dotenv.config();

const app = express();
app.use(express.json());

const redis = new Redis(process.env.REDIS_URI as string);

const SOVEREIGN_MODE = process.env.SOVEREIGN_MODE === "true";

/* ============================
   HEALTH CHECK
============================ */
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

/* ============================
   ENV DEBUG (TEMPORARY)
============================ */
app.get("/env-check", (req, res) => {
  res.json({
    SOVEREIGN_MODE: process.env.SOVEREIGN_MODE,
    parsed: SOVEREIGN_MODE,
  });
});

/* ============================
   EVALUATE — SOVEREIGN ESCALATION ENGINE
============================ */
app.post("/evaluate", async (req, res) => {
  try {
    const { user, score } = req.body;

    const governanceScore = Math.max(0, Math.min(100, score));

    let escalationLevel = 0;
    let escalationAction = "none";

    if (governanceScore >= 80) {
      escalationLevel = 0;
      escalationAction = "none";
    } else if (governanceScore >= 60) {
      escalationLevel = 1;
      escalationAction = "performance_monitoring";
    } else if (governanceScore >= 40) {
      escalationLevel = 2;
      escalationAction = "critical_alert";
    } else {
      escalationLevel = 3;
      escalationAction = "sovereign_intervention_required";
    }

    const sovereignActivated =
      escalationLevel === 3 && SOVEREIGN_MODE === true;

    const riskLevel =
      escalationLevel >= 2 ? "high" :
      escalationLevel === 1 ? "medium" :
      "low";

    const evaluationId = crypto.randomUUID();
    const previousHash = "0000000000000000";

    const payload = {
      user,
      governanceScore,
      escalationLevel,
      escalationAction,
      sovereignActivated,
      riskLevel,
      timestamp: Date.now()
    };

    const secret = "STATIC_SIGNATURE_KEY";
    const hash = crypto
      .createHmac("sha256", secret)
      .update(JSON.stringify(payload) + previousHash)
      .digest("hex");

    await redis.set(
      `audit:${evaluationId}`,
      JSON.stringify({
        payload,
        hash,
        previousHash,
        signatureVersion: "prod_v3"
      })
    );

    res.json({
      evaluationId,
      governanceScore,
      escalationLevel,
      escalationAction,
      sovereignActivated,
      riskLevel,
      signatureVersion: "prod_v3"
    });

  } catch (err) {
    res.status(500).json({ error: "Evaluation failed" });
  }
});

/* ============================
   VERIFY
============================ */
app.get("/verify/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const record = await redis.get(`audit:${id}`);
    if (!record) {
      return res.status(404).json({ error: "Not found" });
    }

    const parsed = JSON.parse(record);

    const secret = "STATIC_SIGNATURE_KEY";
    const recalculated = crypto
      .createHmac("sha256", secret)
      .update(JSON.stringify(parsed.payload) + parsed.previousHash)
      .digest("hex");

    res.json({
      evaluationId: id,
      valid: recalculated === parsed.hash,
      escalationLevel: parsed.payload.escalationLevel,
      escalationAction: parsed.payload.escalationAction,
      sovereignActivated: parsed.payload.sovereignActivated
    });

  } catch (err) {
    res.status(500).json({ error: "Verification failed" });
  }
});

app.listen(8080, () => {
  console.log("JONAH Engine running on port 8080");
});
