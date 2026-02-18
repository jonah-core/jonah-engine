import express from "express";
import cors from "cors";
import Redis from "ioredis";
import { v4 as uuidv4 } from "uuid";
import crypto from "crypto";
import { computeScore, EvaluationInput } from "./core/kernel";

const app = express();
const PORT = process.env.PORT || 8080;

/* ==============================
   REDIS INITIALIZATION
============================== */

const redis = new Redis(process.env.REDIS_URL || "");

/* ==============================
   CONSTANTS
============================== */

const MAX_ALLOWED_AGE_MS = 60000;
const MAX_FUTURE_DRIFT_MS = 5000;

const RATE_LIMIT_WINDOW_MS = 60000;
const RATE_LIMIT_MAX = 60;

/* ==============================
   MIDDLEWARE
============================== */

app.use(cors());
app.use(express.json());

/* ==============================
   UTILITIES
============================== */

function validateTimestamp(timestamp: string, maxAgeMs: number) {
  if (!timestamp) throw new Error("Missing timestamp");

  const requestTime = new Date(timestamp).getTime();
  if (isNaN(requestTime)) throw new Error("Invalid timestamp format");

  const now = Date.now();

  if (requestTime - now > MAX_FUTURE_DRIFT_MS) {
    throw new Error("Timestamp too far in future");
  }

  const age = now - requestTime;

  if (age > maxAgeMs) {
    throw new Error("Signature expired");
  }

  if (maxAgeMs > MAX_ALLOWED_AGE_MS) {
    throw new Error("max_age_ms exceeds allowed limit");
  }
}

async function enforceReplayProtection(nonce: string, maxAgeMs: number) {
  if (!nonce) throw new Error("Missing nonce");

  const exists = await redis.get(`nonce:${nonce}`);
  if (exists) throw new Error("Replay detected");

  await redis.set(`nonce:${nonce}`, "1", "PX", maxAgeMs);
}

async function enforceRateLimit(ip: string) {
  const key = `rate:${ip}`;
  const current = await redis.incr(key);

  if (current === 1) {
    await redis.pexpire(key, RATE_LIMIT_WINDOW_MS);
  }

  if (current > RATE_LIMIT_MAX) {
    throw new Error("Rate limit exceeded");
  }
}

async function writeAuditLog(payload: any, result: any) {
  const id = uuidv4();
  const record = {
    id,
    timestamp: new Date().toISOString(),
    payload,
    result
  };

  await redis.lpush("audit:log", JSON.stringify(record));
  await redis.ltrim("audit:log", 0, 999);
}

/* ==============================
   HEALTH ENDPOINT
============================== */

app.get("/health", async (_req, res) => {
  const redisOk = redis.status === "ready";

  res.json({
    status: "JONAH ACTIVE",
    redis: redisOk,
    replay_protection: true,
    rate_limit: true,
    audit: true,
    version: "1.4.0"
  });
});

/* ==============================
   EVALUATION ENDPOINT
============================== */

app.post("/evaluate", async (req, res) => {
  try {
    const {
      epistemic,
      structural,
      risk,
      ethical,
      timestamp,
      max_age_ms,
      nonce
    } = req.body;

    validateTimestamp(timestamp, max_age_ms);
    await enforceReplayProtection(nonce, max_age_ms);
    await enforceRateLimit(req.ip);

    const input: EvaluationInput = {
      epistemic,
      structural,
      risk,
      ethical
    };

    const result = computeScore(input);

    await writeAuditLog(req.body, result);

    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

/* ==============================
   START SERVER
============================== */

app.listen(PORT, () => {
  console.log(`JONAH Engine running on port ${PORT}`);
});
