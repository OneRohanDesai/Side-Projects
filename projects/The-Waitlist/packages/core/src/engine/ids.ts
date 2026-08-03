import { customAlphabet } from "nanoid";

const alphabet = "0123456789abcdefghijklmnopqrstuvwxyz";
const nanoid = customAlphabet(alphabet, 12);
const shortId = customAlphabet(alphabet, 8);
const tokenId = customAlphabet(alphabet + "ABCDEFGHIJKLMNOPQRSTUVWXYZ", 16);

export function createId(prefix?: string): string {
  const id = nanoid();
  return prefix ? `${prefix}_${id}` : id;
}

export function createSlug(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return `${base || "queue"}-${shortId()}`;
}

export function createPublicToken(): string {
  return tokenId();
}
