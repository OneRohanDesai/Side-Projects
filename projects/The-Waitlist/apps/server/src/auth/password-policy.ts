/**
 * Strict password policy — simple UX message, strong requirements.
 */
export function validatePassword(password: string): string | null {
  if (typeof password !== "string") return "Invalid password";
  if (password.length < 12) return "Password must be at least 12 characters";
  if (password.length > 128) return "Password is too long (max 128)";
  if (/\s/.test(password)) return "Password must not contain spaces";
  if (!/[a-z]/.test(password)) return "Include a lowercase letter";
  if (!/[A-Z]/.test(password)) return "Include an uppercase letter";
  if (!/[0-9]/.test(password)) return "Include a number";
  if (!/[^A-Za-z0-9]/.test(password)) return "Include a symbol character";

  const lower = password.toLowerCase();
  const banned = [
    "password",
    "password123",
    "12345678901",
    "qwertyuiop",
    "letmein",
    "thewaitlist",
    "waitlist123",
    "adminadmin",
  ];
  for (const b of banned) {
    if (lower.includes(b)) return "Password is too common";
  }
  return null;
}

export function validateUsername(username: string): string | null {
  if (typeof username !== "string") return "Invalid username";
  const u = username.trim();
  if (u.length < 3) return "Username must be at least 3 characters";
  if (u.length > 32) return "Username is too long (max 32)";
  if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(u)) {
    return "Username: start with a letter; only letters, numbers, underscore";
  }
  const reserved = ["admin", "root", "system", "api", "public", "null", "me"];
  if (reserved.includes(u.toLowerCase())) return "Username is reserved";
  return null;
}
