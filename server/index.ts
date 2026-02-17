import express from "express";
import cors from "cors";
import crypto from "crypto";

import { computeScore } from "./core/kernel";
import { governanceDescriptor } from "./core/governance";

/* =========================
   SECURITY CONFIG
========================= */

const MAX_ALLOWED_AGE_MS = 60000;
const MAX_FUTURE_DRIFT_MS = 5000;
const HMAC_SECRET = process.env.JONAH_SECRET || "default_dev_secret";

/* =========================
   EXPIRATION VALIDATION
========================= */

function validateExpiration(
  timestamp: string,
  maxAgeMs: number
): void {

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
   NONCE VALIDATION
========================= */

function validateNonce(nonce: string): void {
  if (!nonce) {
    throw new Error("Missing nonce");
  }

  if (nonce.length < 8) {
    throw new Error("Invalid nonce");
  }
}

/* =========================
   SIGNATURE WITH NONCE BINDING
========================= */

function buildSignature(payload: any): string {
  const canonical = JSON.stringify(payload);

  return crypto
    .createHmac("sha256", HMAC_SECRET)
    .update(canonical)
    .digest("hex");
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

app.get("/health", (req, res) => {
  res.json({
    status: "JONAH ACTIVE",
    nonce_bound: true,
    version: "1.1.0"
  });
});

/* =========================
   EVALUATE
========================= */

app.post("/evaluate", (req, res) => {
  try {

    const {
      input,
      mode,
      timestamp,
      max_age_ms,
      nonce
    } = req.body;

    // SECURITY STEP 1
    validateExpiration(timestamp, max_age_ms);

    // SECURITY STEP 2
    validateNonce(nonce);

    // CORE ENGINE
    const score = computeScore(req.body);

    const governance = governanceDescriptor(mode);

    // NONCE NOW PART OF SIGNED PAYLOAD
    const signaturePayload = {
      input,
      mode,
      score,
      governance,
      timestamp,
      nonce
    };

    const signature = buildSignature(signaturePayload);

    res.json({
      score,
      governance,
      signature
    });

  } catch (err: any) {
    res.status(400).json({
      error: err.message
    });
  }
});

/* =========================
   START SERVER
========================= */

app.listen(PORT, () => {
  console.log(`JONAH Engine running on port ${PORT}`);
});
