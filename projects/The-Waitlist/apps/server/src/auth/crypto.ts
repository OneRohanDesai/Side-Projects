/**
 * Cryptographic helpers for auth.
 * Session tokens are never stored in plaintext — only SHA-256 hashes.
 */

const te = new TextEncoder();

export function randomToken(bytes = 32): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return Buffer.from(buf).toString("base64url");
}

export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", te.encode(input));
  return Buffer.from(digest).toString("hex");
}

/** Constant-time string equality for equal-length hex/base64 tokens. */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const ba = te.encode(a);
  const bb = te.encode(b);
  let out = 0;
  for (let i = 0; i < ba.length; i++) out |= ba[i]! ^ bb[i]!;
  return out === 0;
}

/**
 * Argon2id via Bun — memory-hard, resistant to GPU/ASIC cracking.
 * memoryCost ~19 MiB, timeCost 2 is OWASP-aligned for interactive logins.
 */
export async function hashPassword(password: string): Promise<string> {
  return Bun.password.hash(password, {
    algorithm: "argon2id",
    memoryCost: 19456,
    timeCost: 2,
  });
}

export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  try {
    return await Bun.password.verify(password, hash);
  } catch {
    return false;
  }
}

/** Hash IP / UA for session binding without storing PII in cleartext. */
export async function hashClientMeta(value: string): Promise<string> {
  // salt with app constant so rainbow tables of plain IPs are useless
  return sha256Hex(`wl:v1:${value}`);
}
