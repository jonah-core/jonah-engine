import express from "express";
import dotenv from "dotenv";
import Redis from "ioredis";
import crypto from "crypto";

dotenv.config();

const app = express();
app.use(express.json());

/* ============================================================
   REDIS CONNECTION (STANDARDIZED)
============================================================ */

if (!process.env.REDIS_PUBLIC_URL) {
  console.error("FATAL: REDIS_PUBLIC_URL is not defined.");
  process.exit(1);
}

const redis = new Redis(process.env.REDIS_PUBLIC_URL);

/* ============================================================
   SOVEREIGN MODE
============================================================ */

const SOVEREIGN_MODE = process.env.SOVEREIGN_MODE === "true";

/* ============================================================
   HEALTH CHECK
============================================================ */

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

/* ============================================================
   ESCALATION ENGINE
============================================================ */

function determineEscalation(governanceScore: number) {
  if (governanceScore >= 80) {
    return { level: 0, action: "none" };
  }
  if (governanceScore >= 60) {
    return { level: 1, action: "performance_monitoring" };
  }
  if (governanceScore >= 40) {
    return { level: 2, action: "critical_alert" };
  }
  return { level: 3, action: "sovereign_intervention_required" };
}

/* ============================================================
   EVALUATE
============================================================ */

app.post("/evaluate", async (req, res) => {
  try {
    const { user, score } = req.body;

    if (!user || typeof score !== "number") {
      return res.status(400).json({
        status: "error",
        message: "Invalid payload",
      });
    }

    const governanceScore = Math.max(0, Math.min(100, score));
    const escalation = determineEscalation(governanceScore);

    const sovereignActivated =
      escalation.level === 3 && SOVEREIGN_MODE;

    const evaluationId = crypto.randomUUID();

    const payload = {
      evaluationId,
      user,
      governanceScore,
      escalationLevel: escalation.level,
      escalationAction: escalation.action,
      sovereignEscalationActivated: sovereignActivated,
      timestamp: new Date().toISOString(),
    };

    await redis.set(
      `audit:${evaluationId}`,
      JSON.stringify(payload)
    );

    await redis.set("audit:last", evaluationId);

    res.json(payload);

  } catch (err) {
    console.error("Redis / Evaluation error:", err);
    res.status(500).json({
      status: "error",
      message: "Internal server error",
    });
  }
});

/* ============================================================
   START SERVER
============================================================ */

const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
  console.log(`JONAH Engine running on port ${PORT}`);
});
