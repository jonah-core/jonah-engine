import express from "express";
import dotenv from "dotenv";
import Redis from "ioredis";
import crypto from "crypto";
import { verifyAuditRecord } from "./core/audit";
import { evaluateGovernance } from "./core/governance";

dotenv.config();

const app = express();
app.use(express.json());

const redis = new Redis(process.env.REDIS_URL as string);

const ACTIVE_KEY_ID = process.env.JONAH_ACTIVE_KEY_ID as string;
const KEY_MAP = JSON.parse(process.env.JONAH_KEYS as string);

function getSecretByKeyId(keyId: string): string {
  const secret = KEY_MAP[keyId];
  if (!secret) {
    throw new Error("Invalid signatureVersion");
  }
  return secret;
}

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

/**
 * PRODUCTION EVALUATE WITH GOVERNANCE ENFORCEMENT
 */
app.post("/evaluate", async (req, res) => {
  try {
    const inputPayload = req.body;

    if (!inputPayload || typeof inputPayload !== "object") {
      return res.status(400).json({ error: "Invalid payload" });
    }

    // 🔐 Governance Enforcement
    const governance = evaluateGovernance(inputPayload);

    const payload = {
      ...inputPayload,
      governanceScore: governance.governanceScore,
      governanceFlags: governance.flags
    };

    const evaluationId = crypto.randomUUID();
    const previousHash =
      (await redis.get("audit:lastHash")) || "0000000000000000";

    const secret = getSecretByKeyId(ACTIVE_KEY_ID);

    const hash = crypto
      .createHmac("sha256", secret)
      .update(JSON.stringify(payload) + previousHash)
      .digest("hex");

    const record = {
      payload,
      hash,
      previousHash,
      signatureVersion: ACTIVE_KEY_ID,
      timestamp: Date.now()
    };

    await redis.set(`audit:${evaluationId}`, JSON.stringify(record));
    await redis.set("audit:lastHash", hash);

    return res.json({
      evaluationId,
      hash,
      signatureVersion: ACTIVE_KEY_ID,
      governanceScore: governance.governanceScore,
      governanceFlags: governance.flags
    });
  } catch {
    return res.status(500).json({ error: "Evaluation failed" });
  }
});

/**
 * VERIFY ENDPOINT
 */
app.get("/verify/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const record = await redis.get(`audit:${id}`);

    if (!record) {
      return res.status(404).json({ error: "Not found" });
    }

    const parsed = JSON.parse(record);

    const result = verifyAuditRecord(
      id,
      parsed.payload,
      parsed.hash,
      parsed.previousHash,
      parsed.signatureVersion
    );

    return res.json(result);
  } catch {
    return res.status(500).json({ error: "Verification failed" });
  }
});

const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
  console.log(`JONAH Engine running on port ${PORT}`);
});
