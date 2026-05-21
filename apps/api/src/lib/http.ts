export function headerToString(value?: string | string[] | undefined): string | undefined {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

export function safeParseInt(value?: string | string[] | undefined, fallback = 0): number {
  const s = headerToString(value);
  if (!s) return fallback;
  const n = parseInt(s as string);
  return Number.isNaN(n) ? fallback : n;
}
