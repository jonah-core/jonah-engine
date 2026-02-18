import express from "express";
import cors from "cors";
import Redis from "ioredis";
import { v4 as uuidv4 } from "uuid";
import crypto from "crypto";
import { computeScore, EvaluationInput } from "./core/kernel";

/* =====================================================
   APP INIT
===================================================== */

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());

/* =====================================================
   REDIS
===================================================== */

const redis = new Redis(process.env.REDIS_URL || "");

redis.on("error", (err) => {
  console.error("Redis error:", err);
});

/* =====================================================
   CONSTANTS
===================================================== */

const MAX_ALLOWED_AGE_MS = 60000;
const MAX_FUTURE_DRIFT_MS = 5000;

const RATE_LIMIT_WINDOW_MS = 60000;
const RATE_LIMIT_MAX = 60;

const HMAC_SECRET = process.env.JONAH_SECRET || "";

/* =====================================================
   UTILITIES
===================================================== */

function validateTimestamp(timestamp: string, maxAgeMs: number) {
  if (!timestamp) throw new Error("Missing timestamp");

  const requestTime = new Date(timestamp).getTime();
  if (isNaN(requestTime)) throw new Error("Invalid timestamp format");

  if (!maxAgeMs) throw new Error("Missing max_age_ms");

  if (maxAgeMs > MAX_ALLOWED_AGE_MS)
    throw new Error("max_age_ms exceeds allowed limit");

  const now = Date.now();

  if (requestTime - now > MAX_FUTURE_DRIFT_MS)
    throw new Error("Timestamp too far in future");

  const age = now - requestTime;

  if (age > maxAgeMs)
    throw new Error("Signature expired");
}

async function enforceReplayProtection(nonce: string, maxAgeMs: number) {
  if (!nonce) throw new Error("Missing nonce");

  const key = `nonce:${nonce}`;
  const exists = await redis.get(key);

  if (exists) throw new Error("Replay detected");

  await redis.set(key, "1", "PX", maxAgeMs);
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

function validateNumericInputs(input: any) {
  const { epistemic, structural, risk, ethical } = input;

  if (
    typeof epistemic !== "number" ||
    typeof structural !== "number" ||
    typeof risk !== "number" ||
    typeof ethical !== "number"
  ) {
    throw new Error("All scoring inputs must be numeric");
  }

  if (
    epistemic < 0 || epistemic > 1 ||
    structural < 0 || structural > 1 ||
    risk < 0 || risk > 1 ||
    ethical < 0 || ethical > 1
  ) {
    throw new Error("All scoring inputs must be between 0 and 1");
  }
}

function canonicalStringify(obj: any): string {
  return JSON.stringify(obj, Object.keys(obj).sort());
}

function sha256(data: string): string {
  return crypto.createHash("sha256").update(data).digest("hex");
}

function verifyHmac(payload: any, signature: string) {
  if (!HMAC_SECRET) throw new Error("Server misconfigured: missing secret");
  if (!signature) throw new Error("Missing HMAC signature");

  const canonical = canonicalStringify(payload);

  const expected = crypto
    .createHmac("sha256", HMAC_SECRET)
    .update(canonical)
    .digest("hex");

  if (expected !== signature)
    throw new Error("Invalid signature");
}

async function writeAuditLog(payload: any, result: any) {
  const id = uuidv4();
  const timestamp = new Date().toISOString();

  const canonicalPayload = canonicalStringify(payload);
  const canonicalResult = canonicalStringify(result);

  const previousHash =
    (await redis.lindex("audit:chain", 0)) || "GENESIS";

  const combined =
    previousHash + canonicalPayload + canonicalResult + timestamp;

  const currentHash = sha256(combined);

  const record = {
    id,
    timestamp,
    payload,
    result,
    previous_hash: previousHash,
    hash: currentHash
  };

  await redis.lpush("audit:chain", currentHash);
  await redis.lpush("audit:log", JSON.stringify(record));
  await redis.ltrim("audit:chain", 0, 999);
  await redis.ltrim("audit:log", 0, 999);
}

/* =====================================================
   HEALTH
===================================================== */

app.get("/health", async (_req, res) => {
  res.json({
    status: "JONAH ACTIVE",
    redis: redis.status === "ready",
    replay_protection: true,
    rate_limit: true,
    audit_chain: true,
    hmac_enabled: !!HMAC_SECRET,
    version: "2.0.0"
  });
});

/* =====================================================
   EVALUATE
===================================================== */

app.post("/evaluate", async (req, res) => {
  try {
    const {
      epistemic,
      structural,
      risk,
      ethical,
      timestamp,
      max_age_ms,
      nonce,
      signature
    } = req.body;

    validateNumericInputs(req.body);

    validateTimestamp(timestamp, max_age_ms);

    await enforceReplayProtection(nonce, max_age_ms);

    await enforceRateLimit(req.ip);

    const signedPayload = {
      epistemic,
      structural,
      risk,
      ethical,
      timestamp,
      max_age_ms,
      nonce
    };

    verifyHmac(signedPayload, signature);

    const input: EvaluationInput = {
      epistemic,
      structural,
      risk,
      ethical
    };

    const result = computeScore(input);

    await writeAuditLog(signedPayload, result);

    res.json(result);

  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

/* =====================================================
   START
===================================================== */

app.listen(PORT, () => {
  console.log(`JONAH Engine running on port ${PORT}`);
});
