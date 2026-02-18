import express from "express";
import dotenv from "dotenv";
import Redis from "ioredis";
import { verifyAuditRecord } from "./core/audit";

dotenv.config();

const app = express();
app.use(express.json());

const redis = new Redis(process.env.REDIS_URL as string);

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

/**
 * TEMPORARY: inject test record into Redis
 */
app.post("/inject", async (req, res) => {
  const { id, payload, hash, previousHash, signatureVersion } = req.body;

  if (!id || !payload || !hash || !previousHash || !signatureVersion) {
    return res.status(400).json({ error: "Invalid body" });
  }

  const record = {
    payload,
    hash,
    previousHash,
    signatureVersion
  };

  await redis.set(`audit:${id}`, JSON.stringify(record));

  return res.json({ injected: true });
});

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
