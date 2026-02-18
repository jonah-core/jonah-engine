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

/* ==============================
   CANONICAL JSON (DETERMINISTIC)
============================== */

function canonicalStringify(obj: any): string {
  return JSON.stringify(obj, Object.keys(obj).sort());
}

function sha256(data: string): string {
  return crypto.createHash("sha256").update(data).digest("hex");
}

/* ==============================
   AUDIT CHAIN LOGGING
============================== */

async function writeAuditLog(payload: any, result: any) {
  const id = uuidv4();
  const timestamp = new Date().toISOString();

  const canonicalPayload = canonicalStringify(payload);
  const canonicalResult = canonicalStringify(re
