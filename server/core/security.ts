export interface JonahKeyStore {
  [keyId: string]: string;
}

function loadKeys(): JonahKeyStore {
  const raw = process.env.JONAH_KEYS;
  if (!raw) {
    throw new Error("JONAH_KEYS not defined");
  }

  try {
    return JSON.parse(raw);
  } catch {
    throw new Error("Invalid JONAH_KEYS format");
  }
}

export function getActiveKey() {
  const keyStore = loadKeys();
  const activeId = process.env.JONAH_ACTIVE_KEY_ID;

  if (!activeId) {
    throw new Error("JONAH_ACTIVE_KEY_ID not defined");
  }

  const secret = keyStore[activeId];
  if (!secret) {
    throw new Error(`Active key '${activeId}' not found in JONAH_KEYS`);
  }

  return {
    keyId: activeId,
    secret
  };
}

export function getKeyById(keyId: string) {
  const keyStore = loadKeys();
  const secret = keyStore[keyId];

  if (!secret) {
    throw new Error(`Key '${keyId}' not found`);
  }

  return secret;
}
