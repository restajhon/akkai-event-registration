import "server-only";

import {
  randomBytes,
  randomInt,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";

const PAIRING_CODE_LENGTH = 6;
const PAIRING_TOKEN_BYTES = 32;
const PAIRING_TTL_MS = 15 * 60 * 1000;
const SCRYPT_KEY_LENGTH = 32;
const SCRYPT_N = 16_384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_MAXMEM = 32 * 1024 * 1024;

const encodedHashPattern =
  /^scrypt\$N=(\d+)\$r=(\d+)\$p=(\d+)\$([A-Za-z0-9_-]+)\$([A-Za-z0-9_-]+)$/;

export type PairingCredentials = {
  pairingCode: string;
  pairingToken: string;
  pairingCodeHash: string;
  pairingTokenHash: string;
  pairingExpiresAt: string;
};

function deriveKey(credential: string, salt: Buffer) {
  return new Promise<Buffer>((resolve, reject) => {
    scryptCallback(
      credential,
      salt,
      SCRYPT_KEY_LENGTH,
      {
        N: SCRYPT_N,
        r: SCRYPT_R,
        p: SCRYPT_P,
        maxmem: SCRYPT_MAXMEM,
      },
      (error, derivedKey) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(derivedKey);
      },
    );
  });
}

function formatHash(salt: Buffer, derivedKey: Buffer) {
  return [
    "scrypt",
    `N=${SCRYPT_N}`,
    `r=${SCRYPT_R}`,
    `p=${SCRYPT_P}`,
    salt.toString("base64url"),
    derivedKey.toString("base64url"),
  ].join("$");
}

async function hashCredential(credential: string) {
  const salt = randomBytes(16);
  const derivedKey = await deriveKey(credential, salt);

  return formatHash(salt, derivedKey);
}

async function verifyCredential(credential: string, encodedHash: string) {
  const match = encodedHashPattern.exec(encodedHash);

  if (!match) {
    return false;
  }

  const [, nValue, rValue, pValue, encodedSalt, encodedDerivedKey] = match;
  const n = Number(nValue);
  const r = Number(rValue);
  const p = Number(pValue);

  if (n !== SCRYPT_N || r !== SCRYPT_R || p !== SCRYPT_P) {
    return false;
  }

  try {
    const salt = Buffer.from(encodedSalt, "base64url");
    const expectedDerivedKey = Buffer.from(encodedDerivedKey, "base64url");

    if (
      salt.length !== 16 ||
      expectedDerivedKey.length !== SCRYPT_KEY_LENGTH
    ) {
      return false;
    }

    const derivedKey = await deriveKey(credential, salt);

    return (
      derivedKey.length === expectedDerivedKey.length &&
      timingSafeEqual(derivedKey, expectedDerivedKey)
    );
  } catch {
    return false;
  }
}

export function generatePairingCode() {
  return randomInt(0, 10 ** PAIRING_CODE_LENGTH)
    .toString()
    .padStart(PAIRING_CODE_LENGTH, "0");
}

export function generatePairingToken() {
  return randomBytes(PAIRING_TOKEN_BYTES).toString("base64url");
}

export async function createPairingCredentials(
  now = Date.now(),
): Promise<PairingCredentials> {
  const pairingCode = generatePairingCode();
  const pairingToken = generatePairingToken();

  return {
    pairingCode,
    pairingToken,
    pairingCodeHash: await hashCredential(pairingCode),
    pairingTokenHash: await hashCredential(pairingToken),
    pairingExpiresAt: new Date(now + PAIRING_TTL_MS).toISOString(),
  };
}

export async function verifyPairingCode(
  pairingCode: string,
  encodedHash: string,
) {
  if (!/^\d{6}$/.test(pairingCode)) {
    return false;
  }

  return verifyCredential(pairingCode, encodedHash);
}
