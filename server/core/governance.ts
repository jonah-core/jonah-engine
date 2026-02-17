import crypto from "crypto";

export const ENGINE_NAME = "JONAH_CORE";
export const KERNEL_VERSION = "1.0.0";
export const MODE = "SOVEREIGN_RATIONALITY";

function generateKernelHash(): string {
  const data = `${ENGINE_NAME}-${KERNEL_VERSION}-${MODE}`;
  return crypto.createHash("sha256").update(data).digest("hex");
}

export function governanceDescriptor() {
  return {
    engine: ENGINE_NAME,
    version: KERNEL_VERSION,
    mode: MODE,
    deterministic: true,
    kernel_hash: generateKernelHash()
  };
}
