const PASSWORD_ALGORITHM = "pbkdf2_sha256";
const PASSWORD_ITERATIONS = 210_000;
const PASSWORD_KEY_LENGTH = 32;
const SESSION_ALGORITHM = "HMAC";
const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;
export const SESSION_COOKIE_NAME = "vira_session";

const encoder = new TextEncoder();

function asBufferSource(bytes: Uint8Array): BufferSource {
  return bytes as unknown as BufferSource;
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(normalized);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function safeEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left[index] ^ right[index];
  return difference === 0;
}

async function derivePasswordKey(password: string, salt: Uint8Array, iterations: number): Promise<ArrayBuffer> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  return crypto.subtle.deriveBits({ name: "PBKDF2", salt: asBufferSource(salt), iterations, hash: "SHA-256" }, key, PASSWORD_KEY_LENGTH * 8);
}

export async function createPasswordHash(password: string): Promise<string> {
  if (password.length < 12 || password.length > 256) throw new Error("A senha deve ter entre 12 e 256 caracteres.");
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const derived = new Uint8Array(await derivePasswordKey(password, salt, PASSWORD_ITERATIONS));
  return `${PASSWORD_ALGORITHM}$${PASSWORD_ITERATIONS}$${toBase64Url(salt)}$${toBase64Url(derived)}`;
}

export async function verifyPassword(password: string, encodedHash: string): Promise<boolean> {
  if (password.length > 256) return false;
  const parts = encodedHash.split("$");
  if (parts.length !== 4 || parts[0] !== PASSWORD_ALGORITHM) return false;
  const iterations = Number(parts[1]);
  if (!Number.isSafeInteger(iterations) || iterations < 100_000 || iterations > 1_000_000) return false;
  try {
    const salt = fromBase64Url(parts[2]);
    const expected = fromBase64Url(parts[3]);
    const actual = new Uint8Array(await derivePasswordKey(password, salt, iterations));
    return safeEqual(actual, expected);
  } catch {
    return false;
  }
}

async function signSessionPayload(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: SESSION_ALGORITHM, hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign(SESSION_ALGORITHM, key, encoder.encode(payload));
  return toBase64Url(new Uint8Array(signature));
}

export async function createSessionToken(subject: string, secret: string, maxAgeMs = SESSION_MAX_AGE_SECONDS * 1000): Promise<string> {
  if (!subject || secret.length < 32) throw new Error("Configuração de sessão inválida.");
  const now = Date.now();
  const payload = toBase64Url(encoder.encode(JSON.stringify({ sub: subject, iat: now, exp: now + maxAgeMs })));
  return `${payload}.${await signSessionPayload(payload, secret)}`;
}

export async function verifySessionToken(token: string, secret: string): Promise<string | null> {
  if (!token || secret.length < 32) return null;
  const [payload, signature, ...extra] = token.split(".");
  if (!payload || !signature || extra.length > 0) return null;
  try {
    const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: SESSION_ALGORITHM, hash: "SHA-256" }, false, ["verify"]);
    const valid = await crypto.subtle.verify(SESSION_ALGORITHM, key, asBufferSource(fromBase64Url(signature)), encoder.encode(payload));
    if (!valid) return null;
    const decoded = JSON.parse(new TextDecoder().decode(fromBase64Url(payload))) as { sub?: unknown; exp?: unknown };
    if (typeof decoded.sub !== "string" || !decoded.sub || typeof decoded.exp !== "number" || !Number.isFinite(decoded.exp) || decoded.exp <= Date.now()) return null;
    return decoded.sub;
  } catch {
    return null;
  }
}

export { SESSION_MAX_AGE_SECONDS };
