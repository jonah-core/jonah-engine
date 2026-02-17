import express from "express";
import cors from "cors";
import Redis from "ioredis";
import { computeScore, EvaluationInput } from "./core/kernel";

const app = express();
const PORT = process.env.PORT || 8080;

const redis = new Redis(process.env.REDIS_URL || "");

const MAX_ALLOWED_AGE_MS = 60000;
const MAX_FUTURE_DRIFT_MS = 5000;

const RATE_LIMIT_WINDOW_MS = 60000;
const RATE_LIMIT_MAX = 60;

app.use(cors());
app.use(express.json());

/* =========================
   HELPERS
========================= */

function validateExpiration(timestamp: string, maxAgeMs: number) {
  if (!timestamp) throw new Error("Missing timestamp");
  if (!maxAgeMs) throw new Error("Missing max_age_ms");
  if (maxAgeMs > MAX_ALLOWED_AGE_MS)
    throw new Error("max_age_ms exceeds allowed limit");

  const requestTime = new Date(timestamp);
  if (isNaN(requestTime.getTime()))
    throw new Error("Invalid RFC3339 timestamp");

  const now = new Date();
  const ageMs = now.getTime() - requestTime.getTime();

  if (ageMs < -MAX_FUTURE_DRIFT_MS)
    throw new Error("Timestamp too far in future");

  if (ageMs > maxAgeMs)
    throw new Error("Signature expired");
}

async function validateAndStoreNonce(nonce: string, ttlMs: number) {
  if (!nonce) throw new Error("Missing nonce");

  const key = `nonce:${nonce}`;

  const result = await redis.set(key, "1", "PX", ttlMs, "NX");

  if (result === null)
    throw new Error("Replay detected");
}

async function enforceRateLimit(ip: string) {
  const key = `ratelimit:${ip}`;
  const count = await redis.incr(key);

  if (count === 1)
    await redis.pexpire(key, RATE_LIMIT_WINDOW_MS);

  if (count > RATE_LIMIT_MAX)
    throw new Error("Rate limit exceeded");
}

/* =========================
   ROUTES
========================= */

app.get("/health", async (_req, res) => {
  try {
    const pong = await redis.ping();

    res.json({
      status: "JONAH ACTIVE",
      redis: pong === "PONG",
      replay_protection: true,
      rate_limit: true,
      version: "1.3.1"
    });
  } catch {
    res.json({
      status: "JONAH ACTIVE",
      redis: false,
      replay_protection: false,
      rate_limit: false,
      version: "1.3.1"
    });
  }
});

app.post("/evaluate", async (req, res) => {
  try {

    const ip =
      req.headers["x-forwarded-for"]?.toString().split(",")[0] ||
      req.socket.remoteAddress ||
      "unknown";

    await enforceRateLimit(ip);

    const {
      epistemic,
      structural,
      risk,
      ethical,
      timestamp,
      max_age_ms,
      nonce
    } = req.body;

    validateExpiration(timestamp, max_age_ms);
    await validateAndStoreNonce(nonce, max_age_ms);

    const input: EvaluationInput = {
      epistemic,
      structural,
      risk,
      ethical
    };

    const result = computeScore(input);

    res.json(result);

  } catch (err: any) {
    res.status(429).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`JONAH Engine running on port ${PORT}`);
});
