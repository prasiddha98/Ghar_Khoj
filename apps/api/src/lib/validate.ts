export function parseIntParam(raw: unknown, name: string): number {
  const value = typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : raw;
  const id = typeof value === "string" || typeof value === "number" ? Number(value) : NaN;
  if (!value || Number.isNaN(id)) {
    throw new Error(`Invalid ${name}`);
  }
  return id;
}

export function requireNonEmptyString(value: unknown, name: string, maxLen = 2000): string {
  if (typeof value !== "string") throw new Error(`Invalid ${name}`);
  const v = value.trim();
  if (!v) throw new Error(`${name} is required`);
  if (v.length > maxLen) throw new Error(`${name} too long`);
  return v;
}

