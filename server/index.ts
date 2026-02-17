import express from "express";
import cors from "cors";
import Redis from "ioredis";

import { computeScore, EvaluationInput } from "./core/kernel";

/* =========================
   CONFIG
========================= */

const MAX_ALLOWED_AGE_MS = 60000;
const MAX_FUTURE_DRIFT_MS = 5000;

const RATE_LIMIT_WINDOW_MS = 60000; // 60 detik
const RATE_LIMIT_MAX = 60;          // 60 request per window

const REDIS_URL = process.env.REDIS_URL || "";
const redis = new Redis(REDIS_URL);

/* =========================
   EXPIRATION VALIDATION
========================= */

function validateExpiration(timestamp: string, maxAgeMs: number): void {
  if (!timestamp) throw new Error("Missing timestamp");
  if (!maxAgeMs) throw new Error("Missing max_age_ms");

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
   REPLAY PROTECTION
========================= */

async function validateAndStoreNonce(
  nonce: string,
  ttlMs: number
): Promise<void> {

  if (!nonce) throw new Error("Missing nonce");
  if (nonce.length < 8) throw new Error("Invalid nonce");

  const key = `nonce:${nonce}`;

  const result = await redis.set(
    key,
    "1",
    "PX",
    ttlMs,
    "NX"
  );

  if (result === null) {
    throw new Error("Replay detected");
  }
}

/* =========================
   RATE LIMITING (Redis)
========================= */

async function enforceRateLimit(ip: string): Promise<void> {

  const key = `ratelimit:${ip}`;

  const count = await redis.incr(key);

  if (count === 1) {
    await redis.pexpire(key, RATE_LIMIT_WINDOW_MS);
  }

  if (count > RATE_LIMIT_MAX) {
    throw new Error("Rate limit exceeded");
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

app.get("/health", async (_req, res) => {
  try {
    const redisStatus = await redis.ping();

    res.json({
      status: "JONAH ACTIVE",
      redis: redisStatus === "PONG",
      replay_protection: true,
      rate_limit: true,
      version: "1.3.0"
    });

  } catch {
    res.json({
      status: "JONAH ACTIVE",
      redis: false,
      replay_protection: false,
      rate_limit: false,
      version: "1.3.0"
    });
  }
});

/* =========================
   EVALUATE
========================= */

app.post("/evaluate", async (req, res) => {
  try {

    const clientIp =
      req.headers["x-forwarded-for"]?.toString().split(",")[0] ||
      req.socket.remoteAddress ||
      "unknown";

    // 1️⃣ Rate limit
    await enforceRateLimit(clientIp);

    const {
      epistemic,
      structural,
      risk,
      ethical,
      timestamp,
      max_age_ms,
      nonce
    } = req.body;

    // 2️⃣ Expiration
    validateExpirat
